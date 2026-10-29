import { useTranslation } from 'react-i18next';
import { DownloadIcon } from './AppIcons';
import { Button, CloseButton, Dialog, Inset } from './ui';

export function BackupReminderModal({ isOpen, overdueDays = 7, onBackupNow, onSnooze, onDisable }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <Dialog
      onClose={onSnooze}
      actions={(
        <>
          <Button variant="primary" fullWidth onClick={onBackupNow}>{t('backup.reminder.backup_now', 'Back up now')}</Button>
          <Button variant="secondary" fullWidth onClick={onSnooze}>{t('backup.reminder.snooze', 'Remind me later')}</Button>
          <Button variant="warning" fullWidth onClick={onDisable}>{t('backup.reminder.turn_off', 'Turn off backup reminders')}</Button>
        </>
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-label">{t('backup.reminder.eyebrow', 'Recovery reminder')}</p>
          <h3 className="text-base font-black uppercase tracking-widest">{t('backup.reminder.title', 'Create a fresh backup')}</h3>
        </div>
        <CloseButton label={t('backup.reminder.dismiss', 'Dismiss')} onClick={onSnooze} />
      </div>
      <Inset>
        <div className="mb-2 inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest">
          <DownloadIcon className="w-5 h-5 shrink-0" />
          {t('backup.reminder.panel_title', 'Protect against PWA data loss')}
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t(
            'backup.reminder.body',
            'It has been more than {{days}} days since the last successful backup. A new encrypted backup helps recover data after browser resets, site-data deletion, or device migration.',
            { days: overdueDays }
          )}
        </p>
      </Inset>
    </Dialog>
  );
}
