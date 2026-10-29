import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon, EyeIcon, UploadIcon } from './AppIcons';
import { BottomSheet, Button, Inset, TextInput } from './ui';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  collectCanonicalBackupPayload,
  decryptEncryptedBackup,
  encryptBackupPayload,
  hasBackupContent,
  parseBackupFileText,
  suggestedEncryptedBackupName,
  summarizeBackupPayload,
} from '../utils/backupFiles';
import { saveTextFile } from '../utils/exportHelpers';
import { mergeRemoteData } from '../utils/syncHelpers';

function StepText({ children }) {
  return <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</p>;
}


export function BackupTransferModal({
  isOpen,
  mode,
  settings = null,
  fileName = '',
  fileText = '',
  onClose,
  onExportSuccess,
  onImportSuccess,
}) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isExport = mode === 'export';
  const title = isExport
    ? t('backup.modal.export_title', 'Create Encrypted Backup')
    : t('backup.modal.import_title', 'Import Encrypted Backup');
  const submitLabel = isExport
    ? t('backup.modal.export_cta', 'Create backup')
    : t('backup.modal.import_cta', 'Decrypt and import');
  const icon = isExport ? <DownloadIcon className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />;

  const guidance = useMemo(() => {
    if (passphrase.length === 0) return '';
    if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
      return t(
        'backup.modal.passphrase_short_hint',
        `Use at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters. A few memorable words works well.`
      );
    }
    return t(
      'backup.modal.passphrase_ok_hint',
      'Keep this passphrase somewhere safe. AuraTrack cannot recover it later.'
    );
  }, [passphrase, t]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
      setError(
        t(
          'backup.modal.passphrase_short_error',
          `Passphrase must be at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`
        )
      );
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError(t('backup.modal.passphrase_mismatch', 'Passphrases do not match.'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = await collectCanonicalBackupPayload(settings);
      if (!hasBackupContent(payload)) {
        setError(t('backup.modal.no_data', 'No health data available to back up.'));
        setBusy(false);
        return;
      }

      const encrypted = await encryptBackupPayload(payload, passphrase);
      const result = await saveTextFile(
        JSON.stringify(encrypted, null, 2),
        suggestedEncryptedBackupName(),
        t('backup.modal.file_description', 'AuraTrack encrypted backup'),
        ['.atbak'],
      );
      if (!result?.ok) {
        if (!result?.cancelled) {
          setError(t('backup.modal.export_failed', 'Encrypted backup could not be saved.'));
        }
        setBusy(false);
        return;
      }
      await onExportSuccess?.(summarizeBackupPayload(payload));
      onClose?.();
    } catch (exportError) {
      console.error('Encrypted backup export failed:', exportError);
      setError(exportError?.message || t('backup.modal.export_failed', 'Encrypted backup could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!fileText) {
      setError(t('backup.modal.file_missing', 'Backup file is unavailable.'));
      return;
    }
    if (!passphrase) {
      setError(t('backup.modal.passphrase_required', 'Enter the backup passphrase to continue.'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const parsed = parseBackupFileText(fileText);
      if (parsed.kind !== 'encrypted') {
        throw new Error(t('backup.modal.not_encrypted', 'Selected file is not an encrypted backup.'));
      }
      const decrypted = await decryptEncryptedBackup(parsed.parsed, passphrase);
      const result = await mergeRemoteData(decrypted);
      await onImportSuccess?.(result);
      onClose?.();
    } catch (importError) {
      console.error('Encrypted backup import failed:', importError);
      setError(
        importError?.code === 'decrypt_failed'
          ? t('backup.modal.import_bad_passphrase', 'Incorrect passphrase or damaged backup file.')
          : importError?.message || t('backup.modal.import_failed', 'Backup import failed.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title={isExport ? t('backup.modal.export_eyebrow', 'Encrypted backup') : t('backup.modal.import_eyebrow', 'Secure restore')}
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      footer={(
        <>
          {error && <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-sm font-bold">{error}</p>}
          <div className="ui-button-row">
            <Button variant="primary" onClick={isExport ? handleExport : handleImport} disabled={busy}>
              {busy ? t('backup.modal.working', 'Working...') : submitLabel}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy}>{t('backup.modal.cancel', 'Cancel')}</Button>
          </div>
        </>
      )}
    >
      <h3 className="text-base font-black uppercase tracking-widest">{title}</h3>
      <Inset className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
          {icon}
          {isExport ? t('backup.modal.export_panel_title', 'Portable encrypted file') : t('backup.modal.import_panel_title', 'Decrypt in memory only')}
        </div>
        {isExport ? (
          <>
            <StepText>{t('backup.modal.export_body', 'AuraTrack will encrypt the backup before saving it. The file name can be changed in the save dialog.')}</StepText>
            <StepText>{t('backup.modal.export_warning', 'If you forget this passphrase, the backup cannot be recovered.')}</StepText>
          </>
        ) : (
          <>
            <StepText>{t('backup.modal.import_body', 'AuraTrack will decrypt this backup in memory, import it, and will not write a plaintext copy to device storage.')}</StepText>
            <StepText>{t('backup.modal.import_file', 'Selected file: {{fileName}}', { fileName: fileName || t('backup.modal.file_unknown', 'unknown file') })}</StepText>
          </>
        )}
      </Inset>

      <TextInput
        type={showSecret ? 'text' : 'password'}
        label={t('backup.modal.passphrase_label', 'Passphrase')}
        value={passphrase}
        onChange={setPassphrase}
        autoComplete={isExport ? 'new-password' : 'current-password'}
        placeholder={t('backup.modal.passphrase_placeholder', 'Enter backup passphrase')}
      />

      {isExport && (
        <TextInput
          type={showSecret ? 'text' : 'password'}
          label={t('backup.modal.confirm_label', 'Confirm passphrase')}
          value={confirmPassphrase}
          onChange={setConfirmPassphrase}
          autoComplete="new-password"
          placeholder={t('backup.modal.confirm_placeholder', 'Re-enter backup passphrase')}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" icon={<EyeIcon className="w-4 h-4" />} onClick={() => setShowSecret(value => !value)}>
          {showSecret ? t('backup.modal.hide', 'Hide') : t('backup.modal.show', 'Show')}
        </Button>
        <p className="flex-1 basis-40 text-right text-[11px]" style={{ color: 'var(--text-dim)' }}>{guidance}</p>
      </div>
    </BottomSheet>
  );
}
