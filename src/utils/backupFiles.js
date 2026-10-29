import { db } from '../data/db';
import {
  CANONICAL_BACKUP_SCHEMA,
  CANONICAL_BACKUP_VERSION,
  buildCanonicalBackupPayload,
  sanitizeImportPayload,
} from './importSanitizer';

export const ENCRYPTED_BACKUP_SCHEMA = 'auratrack.encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const MIN_BACKUP_PASSPHRASE_LENGTH = 8;

const PBKDF2_ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('This browser does not support encrypted backups.');
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePassphrase(passphrase) {
  return String(passphrase ?? '').normalize('NFKC');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.length % 4 ? base64 + '='.repeat(4 - (base64.length % 4)) : base64;
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
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

export async function collectCanonicalBackupPayload(settingsSource = null) {
  const events = await db.events.toArray();
  const [settingsRows, medications, medicationLogs, medicationChanges, eegSessions, eegActivities, wellbeingEntries] = await Promise.all([
    db.settings.toArray().catch(() => []),
    db.medications.toArray().catch(() => []),
    db.medicationLogs.toArray().catch(() => []),
    db.medicationChanges.toArray().catch(() => []),
    db.eegSessions?.toArray?.().catch(() => []) ?? [],
    db.eegActivities?.toArray?.().catch(() => []) ?? [],
    db.wellbeingEntries?.toArray?.().catch(() => []) ?? [],
  ]);

  return buildCanonicalBackupPayload({
    settings: settingsSource ?? settingsRows,
    events,
    medications,
    medicationLogs,
    medicationChanges,
    eegSessions,
    eegActivities,
    wellbeingEntries,
  });
}

export function summarizeBackupPayload(payload) {
  const data = sanitizeImportPayload(payload);
  return {
    events: data.events.length,
    medications: data.medications.length,
    medicationLogs: data.medicationLogs.length,
    medicationChanges: data.medicationChanges.length,
    eegSessions: data.eegSessions.length,
    eegActivities: data.eegActivities.length,
    wellbeingEntries: data.wellbeingEntries.length,
  };
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
  if (
    parsed?.schema === CANONICAL_BACKUP_SCHEMA ||
    parsed?.version === CANONICAL_BACKUP_VERSION ||
    Array.isArray(parsed) ||
    (parsed && typeof parsed === 'object')
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
    const key = await deriveEncryptionKey(passphrase, salt, parsed.kdf?.iterations || PBKDF2_ITERATIONS);
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
