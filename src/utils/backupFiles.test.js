import { describe, expect, it } from 'vitest';
import { decryptEncryptedBackup, encryptBackupPayload, parseBackupFileText } from './backupFiles';

describe('encrypted backups', () => {
  const payload = { schema: 'auratrack.backup', data: { events: [{ uuid: 'e', startTime: 1, duration: 2, notes: 'æøå 🧠' }] } };

  it('decrypt to exactly what was encrypted', async () => {
    const file = await encryptBackupPayload(payload, 'correct horse battery');
    expect(parseBackupFileText(JSON.stringify(file)).kind).toBe('encrypted');
    expect(await decryptEncryptedBackup(file, 'correct horse battery')).toEqual(payload);
  });

  it('refuse a wrong passphrase', async () => {
    const file = await encryptBackupPayload(payload, 'correct horse battery');
    await expect(decryptEncryptedBackup(file, 'wrong passphrase')).rejects.toMatchObject({ code: 'decrypt_failed' });
  });

  it('refuse a file asking for an absurd key strength (it would freeze the app)', async () => {
    const file = await encryptBackupPayload(payload, 'correct horse battery');
    file.kdf.iterations = 1e12;
    await expect(decryptEncryptedBackup(file, 'correct horse battery')).rejects.toMatchObject({ code: 'decrypt_failed' });
  });

  it('refuse a short passphrase', async () => {
    await expect(encryptBackupPayload(payload, 'short')).rejects.toMatchObject({ code: 'passphrase_too_short' });
  });
});
