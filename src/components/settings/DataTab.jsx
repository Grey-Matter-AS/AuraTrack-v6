import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../data/db';
import { assertImportFileSafe } from '../../utils/importSanitizer';
import { mergeRemoteData } from '../../utils/syncHelpers';
import { BackupTransferModal } from '../BackupTransferModal';
import { parseBackupFileText } from '../../utils/backupFiles';
import { ActionBtn, FieldLabel, Row, Section, Segments } from './atoms';
import { Checkbox, Toggle, useToast } from '../ui';
import { DownloadIcon, InstallIcon, ResetIcon, SyncIcon, TrashIcon, UploadIcon } from '../AppIcons';
import pkg from '../../../package.json';
import { clearAllData } from '../../data/records';
import { describeMergeResult } from '../../utils/mergeSummary';

// ─── Data & Backup tab: the one home for backup and restore, sync, storage, reset ──
export function DataTab({ settings, onUpdate, onReset, pwa, onSync, storagePersistence, onBackupSuccess }) {
  const { t } = useTranslation();
  const fileInputRef = useRef();
  const [storageInfo, setStorageInfo] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [backupModal, setBackupModal] = useState({ mode: null, fileName: '', fileText: '' });
  useEffect(() => {
    if ('storage' in navigator) {
      navigator.storage.estimate().then(est => {
        const usedKB = Math.round((est.usage || 0) / 1024);
        const quotaMB = Math.round((est.quota || 0) / 1024 / 1024);
        setStorageInfo({ usedKB, quotaMB });
      });
    }
  }, []);

  // Settings messages use the app-wide toasts so they show on every settings tab
  const showToast = useToast();
  const flash = (msg, tone = 'success') => showToast(msg, tone);
  // After a full copy, the two things a phone's OS grants per device (they can't be copied)
  const summarizeImportResult = (result) => [
    describeMergeResult(result, t),
    result.settingsScope === 'all' ? t('settings.data.after_full_restore') : '',
  ].filter(Boolean).join(' ');

  // Copy display and device settings on restore: on by default only when this phone has no seizures yet
  const [copyAllOnRestore, setCopyAllOnRestore] = useState(false);
  useEffect(() => {
    let alive = true;
    db.events.count().then(n => { if (alive) setCopyAllOnRestore(n === 0); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const restoreScope = copyAllOnRestore ? 'all' : 'shared';

  const handleExportBackup = () => setBackupModal({ mode: 'export', fileName: '', fileText: '' });

  const processImport = async (file) => {
    try {
      assertImportFileSafe(file);
      const text = await file.text();
      const parsed = parseBackupFileText(text);
      if (parsed.kind === 'encrypted') {
        setBackupModal({ mode: 'import', fileName: file.name, fileText: text });
        return;
      }
      const result = await mergeRemoteData(parsed.parsed, { settingsScope: restoreScope });
      flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
    } catch (err) {
      console.error('Import failed:', err);
      flash(t('settings.data.import_failed'), 'error');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processImport(file);
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'AuraTrack Backup', accept: { 'application/json': ['.json', '.atbak'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        await processImport(file);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleClearAllData = async () => {
    try {
      await clearAllData();
      setShowClearConfirm(false);
      flash(t('settings.data.all_deleted'));
    } catch (err) {
      console.error('Failed to clear data:', err);
      flash(t('settings.data.delete_failed'), 'error');
    }
  };

  const handleResetSettings = async () => {
    await onReset?.();
    setShowResetConfirm(false);
    flash(t('settings.data.settings_reset'));
  };

  const handleEncryptedImportSuccess = (result) => {
    flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
  };

  const handleEncryptedExportSuccess = async (summary) => {
    await onBackupSuccess?.(summary);
    flash(t('settings.data.exported', { events: summary.events, meds: summary.medications }));
  };

  const persistenceStatusLabel = {
    checking: t('settings.data.persistence_checking', 'Checking storage protection…'),
    granted: t('settings.data.persistence_granted', 'Persistent storage enabled'),
    not_requested: t('settings.data.persistence_not_requested', 'Permission can be requested'),
    denied: t('settings.data.persistence_denied', 'Best-effort storage only'),
    unsupported: t('settings.data.persistence_unsupported', 'Persistent storage not supported'),
    error: t('settings.data.persistence_error', 'Persistent storage request failed'),
  }[storagePersistence?.status || 'checking'];

  const persistenceStatusHelp = {
    checking: t('settings.data.persistence_help_checking', 'AuraTrack is checking whether the browser will protect this PWA storage from eviction.'),
    granted: t('settings.data.persistence_help_granted', 'Browser-managed storage has been marked persistent. Data should not be evicted except by explicit user action.'),
    not_requested: t('settings.data.persistence_help_not_requested', 'This browser may show a permission prompt, so AuraTrack waits for you to request storage protection manually.'),
    denied: t('settings.data.persistence_help_denied', 'The browser did not grant persistent storage. Backups remain the main protection against data loss.'),
    unsupported: t('settings.data.persistence_help_unsupported', 'This browser does not expose persistent storage controls. Backups remain the main protection against data loss.'),
    error: t('settings.data.persistence_help_error', 'AuraTrack could not confirm persistent storage protection on this device. Backups remain the main protection against data loss.'),
  }[storagePersistence?.status || 'checking'];

  const persistenceFlowDetail = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_detail_flow_prompt', 'User-initiated request. A browser permission prompt may appear when you tap the button.')
    : t('settings.data.persistence_detail_flow_auto', 'Automatic browser decision. The browser may silently grant or deny without showing a permission popup.');

  const persistenceBrowserDetail = storagePersistence?.engine === 'webkit'
    ? t('settings.data.persistence_detail_browser_webkit', 'WebKit browsers on iPhone/iPad and Safari-class environments usually decide this silently. Installing the app can help storage quotas, but backups are still essential.')
    : storagePersistence?.engine === 'chromium'
      ? t('settings.data.persistence_detail_browser_chromium', 'Chromium browsers such as Chrome and Edge usually decide this from browser heuristics, so tapping again may recheck without showing a prompt.')
      : storagePersistence?.engine === 'gecko'
        ? t('settings.data.persistence_detail_browser_gecko', 'Firefox-class browsers may show a permission prompt when requested from this screen.')
        : t('settings.data.persistence_detail_browser_generic', 'Browser behavior varies by engine and device.');

  const persistenceReasonDetail = (storagePersistence?.status === 'denied' || storagePersistence?.status === 'not_requested')
    ? t('settings.data.persistence_detail_reason', 'Exact denial reasons are not exposed by the web API, so AuraTrack can only show the browser result, not why it decided that way.')
    : null;

  const persistenceActionLabel = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_request', 'Request access')
    : t('settings.data.persistence_retry', 'Try again');

  const persistenceTechnicalDetails = storagePersistence?.supported
    ? [
        {
          label: t('settings.data.persistence_detail_browser_label', 'Browser'),
          value: `${storagePersistence.browserLabel || t('settings.data.persistence_detail_unknown', 'Unknown')} · ${storagePersistence.platformLabel || t('settings.data.persistence_detail_unknown', 'Unknown')}`,
        },
        {
          label: t('settings.data.persistence_detail_flow_label', 'Request mode'),
          value: persistenceFlowDetail,
        },
        {
          label: t('settings.data.persistence_detail_api_label', 'Web API'),
          value: 'navigator.storage.persist() / persisted()',
        },
      ]
    : [];

  const lastBackupLabel = settings.lastSuccessfulBackupAt
    ? new Date(settings.lastSuccessfulBackupAt).toLocaleString()
    : t('settings.data.backup_never', 'Never');

  const show = () => true;
  return (
    <>
      {/* ── DATA & BACKUP ── */}
      {show('data') && <Section title={t('settings.data.section')}>
        {storageInfo && (
          <Row label={t('settings.data.storage_used')} help={t('settings.data.storage_help')}>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {t('settings.data.storage_value', { kb: storageInfo.usedKB })}
              <span className="text-[var(--text-dim)] font-normal">{t('settings.data.storage_quota', { mb: storageInfo.quotaMB })}</span>
            </p>
          </Row>
        )}

        <Row
          label={t('settings.data.persistence_status', 'Storage protection')}
          help={
            <div className="space-y-2">
              <p>{persistenceStatusHelp}</p>
              <p>{persistenceBrowserDetail}</p>
              {persistenceReasonDetail && <p>{persistenceReasonDetail}</p>}
            </div>
          }
        >
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <p className="text-sm font-bold" style={{ color: storagePersistence?.persisted ? 'var(--text-success)' : 'var(--text-primary)' }}>
              {persistenceStatusLabel}
            </p>
            {storagePersistence?.supported && !storagePersistence?.persisted && (
              <button
                onClick={() => storagePersistence.requestPersistence?.({ userInitiated: true })}
                className="ui-btn ui-btn--secondary ui-btn--sm"
              >
                {persistenceActionLabel}
              </button>
            )}
          </div>
        </Row>
        {persistenceTechnicalDetails.length > 0 && (
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {t('settings.data.persistence_details_title', 'Technical details')}
            </p>
            {persistenceTechnicalDetails.map((detail) => (
              <div key={detail.label} className="flex flex-col gap-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                  {detail.label}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <Row label={t('settings.data.last_backup', 'Last successful backup')} help={t('settings.data.last_backup_help', 'Updated when an encrypted backup file is saved successfully.')}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{lastBackupLabel}</p>
        </Row>

        <div>
          <Row label={t('settings.data.backup_reminders', 'Backup reminders')} help={t('settings.data.backup_reminders_help', 'Reminders appear when no successful backup has been created within the chosen interval.')}>
            <Toggle value={settings.backupReminderEnabled !== false} onChange={value => onUpdate('backupReminderEnabled', value)} label={t('settings.data.backup_reminders', 'Backup reminders')} />
          </Row>
          {settings.backupReminderEnabled !== false && (
            <div className="mt-3">
              <FieldLabel>{t('settings.data.backup_interval', 'Reminder interval')}</FieldLabel>
              <Segments
                options={[
                  { value: 7, label: t('settings.data.backup_interval_7', '7 days') },
                  { value: 14, label: t('settings.data.backup_interval_14', '14 days') },
                  { value: 30, label: t('settings.data.backup_interval_30', '30 days') },
                ]}
                value={settings.backupReminderIntervalDays || 7}
                onChange={value => onUpdate('backupReminderIntervalDays', value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionBtn label={t('settings.data.export_backup')} sub={t('settings.data.export_sub')} icon={<UploadIcon className="w-5 h-5" />} onClick={handleExportBackup} />
          <ActionBtn label={t('settings.data.import_data')}   sub={t('settings.data.import_sub')}    icon={<DownloadIcon className="w-5 h-5" />} onClick={handleImportClick} />
        </div>
        {/* Restoring onto a new phone usually wants an exact copy; a phone in use keeps its own look */}
        <Checkbox
          checked={copyAllOnRestore}
          onChange={setCopyAllOnRestore}
          label={t('settings.data.restore_copy_all')}
          help={t('settings.data.restore_copy_all_help')}
        />
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{t('backup.modal.videos_not_included')}</p>
        {onSync && (
          <ActionBtn label={t('settings.data.sync_device')} sub={t('settings.data.sync_sub')} icon={<SyncIcon className="w-5 h-5" />} onClick={onSync} />
        )}

        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('settings.data.security_title')}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.data.security_current')}
          </p>
          <div className="space-y-2 pt-1">
            {['exports', 'sync', 'recommendation'].map((item) => (
              <div key={item} className="flex gap-2 items-start">
                <span className="text-xs leading-6" style={{ color: 'var(--accent-text)' }}>•</span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`settings.data.security_${item}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
        {/* Hidden native file picker opened by the Import button — not a visible field */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input ref={fileInputRef} type="file" accept=".atbak,.json,application/json" className="hidden" onChange={handleImport} />



        {/* Danger Zone */}
        <div className="border-t mt-2 pt-5 space-y-3" style={{ borderColor: 'rgba(185,28,28,0.3)' }}>
          <p className="app-status-badge app-status-badge--danger">{t('settings.data.danger_zone')}</p>

          {showClearConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626' }}>
              <p className="text-white text-sm font-bold">{t('settings.data.clear_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleClearAllData} className="ui-btn ui-btn--danger ui-btn--md flex-1">
                  {t('settings.data.clear_yes')}
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="ui-btn ui-btn--secondary ui-btn--md flex-1">
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.clear_btn')} icon={<TrashIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowClearConfirm(true)} />
          )}
        </div>
      </Section>}

      {/* ── ABOUT (shown in Data tab) ── */}
      {show('data') && <Section title={t('settings.about_section.section')}>
        <Row label={t('settings.about_section.version')}><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrack v{pkg.version}</p></Row>
        <Row label={t('settings.about_section.schema')}><p className="text-sm font-bold text-[var(--text-primary)]">{db.name} v{db.verno}</p></Row>
        {pwa?.canInstallManually && (
          <div>
            <ActionBtn
              label={t('settings.about_section.reinstall')}
              sub={t('settings.about_section.reinstall_sub')}
              icon={<InstallIcon className="w-5 h-5" />}
              onClick={pwa.resetDismissal}
            />
          </div>
        )}
        <div className="pt-1">
          {showResetConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626' }}>
              <p className="text-white text-sm font-bold">{t('settings.data.reset_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleResetSettings} className="ui-btn ui-btn--danger ui-btn--md flex-1">
                  {t('settings.data.reset_yes')}
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="ui-btn ui-btn--secondary ui-btn--md flex-1">
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.reset_btn')} icon={<ResetIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowResetConfirm(true)} />
          )}
        </div>
      </Section>}

      {backupModal.mode === 'export' && (
        <BackupTransferModal
          key="settings-backup-export"
          isOpen
          mode="export"
          settings={settings}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onExportSuccess={handleEncryptedExportSuccess}
        />
      )}

      {backupModal.mode === 'import' && (
        <BackupTransferModal
          key={`settings-backup-import-${backupModal.fileName}`}
          isOpen
          mode="import"
          fileName={backupModal.fileName}
          fileText={backupModal.fileText}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onImportSuccess={handleEncryptedImportSuccess}
          settingsScope={restoreScope}
        />
      )}

    </>
  );
}
