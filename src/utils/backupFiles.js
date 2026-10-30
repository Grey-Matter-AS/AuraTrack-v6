import { db } from '../data/db';
import { readDeviceSettings } from '../data/profiles';
import {
  BACKUP_TABLES,
  CANONICAL_BACKUP_SCHEMA,
  buildCanonicalBackupPayload,
  sanitizeImportPayload,
} from './importSanitizer';
import { dateStamp } from './dates';
import { fromBase64Url, toBase64Url } from './base64url';

export const ENCRYPTED_BACKUP_SCHEMA = 'auratrack.encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const MIN_BACKUP_PASSPHRASE_LENGTH = 8;

const PBKDF2_ITERATIONS = 310000;
// A file asking for more would freeze the app while deriving the key
const MAX_PBKDF2_ITERATIONS = 2_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('This browser does not support encrypted backups.');
  }
}

function normalizePassphrase(passphrase) {
  return String(passphrase ?? '').normalize('NFKC');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveEncryptionKey(passphrase, salt, iterations) {
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normalizePassphrase(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Every table of the database, read in one transaction so the copy is consistent. A table that
// can't be read fails the whole backup: a backup that silently misses data is worse than none.
// database: another patient's database (all-patients backup); default the active one
export async function collectCanonicalBackupPayload(settingsSource = null, database = db) {
  const snapshot = await database.transaction('r', database.tables, async () => {
    const out = {};
    for (const table of database.tables) out[table.name] = await table.toArray();
    return out;
  });
  // This device's own settings (mode, language, look) live in the device database: include them
  const deviceRows = await readDeviceSettings().catch(() => []);
  snapshot.settings = [...snapshot.settings.filter(row => !deviceRows.some(d => d.key === row.key)), ...deviceRows];
  const missing = BACKUP_TABLES.filter(table => !(table in snapshot));
  if (missing.length) throw new Error(`Backup could not read: ${missing.join(', ')}`);
  if (settingsSource) snapshot.settings = settingsSource;
  return buildCanonicalBackupPayload(snapshot, { schemaVersion: database.verno });
}

export function summarizeBackupPayload(payload) {
  const data = sanitizeImportPayload(payload);
  return Object.fromEntries(BACKUP_TABLES.filter(table => table !== 'tombstones').map(table => [table, data[table].length]));
}

export function hasBackupContent(payload) {
  const summary = summarizeBackupPayload(payload);
  return Object.values(summary).some(count => count > 0);
}

export function suggestedEncryptedBackupName() {
  return `auratrack-backup-${dateStamp()}.atbak`;
}

export function parseBackupFileText(text) {
  const parsed = JSON.parse(text);
  if (parsed?.schema === ENCRYPTED_BACKUP_SCHEMA) {
    return { kind: 'encrypted', parsed };
  }
  // An AuraTrack backup, an old plain list of seizures, or an object holding at least one known table
  if (
    parsed?.schema === CANONICAL_BACKUP_SCHEMA ||
    parsed?.schema === 'auratrack.household-backup' ||
    Array.isArray(parsed) ||
    (parsed && typeof parsed === 'object' && BACKUP_TABLES.some(table => Array.isArray(parsed[table])))
  ) {
    return { kind: 'plain', parsed };
  }
  throw new Error('Backup file is invalid.');
}

export async function encryptBackupPayload(payload, passphrase) {
  requireCrypto();
  const normalized = normalizePassphrase(passphrase);
  if (normalized.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    const error = new Error('Backup passphrase is too short.');
    error.code = 'passphrase_too_short';
    throw error;
  }

  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveEncryptionKey(normalized, salt, PBKDF2_ITERATIONS);
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );

  return {
    schema: ENCRYPTED_BACKUP_SCHEMA,
    version: ENCRYPTED_BACKUP_VERSION,
    exportedAt: Date.now(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64Url(salt),
    },
    cipher: {
      name: 'AES-GCM',
      length: 256,
      iv: toBase64Url(iv),
    },
    ciphertext: toBase64Url(ciphertext),
  };
}

export async function decryptEncryptedBackup(parsed, passphrase) {
  requireCrypto();
  if (parsed?.schema !== ENCRYPTED_BACKUP_SCHEMA) {
    throw new Error('Backup file is not encrypted.');
  }

  try {
    const salt = fromBase64Url(parsed.kdf?.salt || '');
    const iv = fromBase64Url(parsed.cipher?.iv || '');
    const ciphertext = fromBase64Url(parsed.ciphertext || '');
    const iterations = Number(parsed.kdf?.iterations) || PBKDF2_ITERATIONS;
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) throw new Error('Unsupported key strength');
    const key = await deriveEncryptionKey(passphrase, salt, iterations);
    const plaintextBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return JSON.parse(textDecoder.decode(plaintextBuffer));
  } catch (error) {
    const decryptError = new Error('Incorrect passphrase or damaged backup file.');
    decryptError.code = 'decrypt_failed';
    decryptError.cause = error;
    throw decryptError;
  }
}
