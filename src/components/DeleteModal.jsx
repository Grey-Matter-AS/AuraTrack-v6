import { useTranslation } from 'react-i18next';
import { WarningIcon } from './AppIcons';
import { Button, Dialog } from './ui';

export function DeleteModal({ onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <Dialog
      title={t('delete_modal.title')}
      message={t('delete_modal.body')}
      onClose={onCancel}
      actions={(
        <>
          <Button variant="danger" size="lg" fullWidth onClick={onConfirm}>{t('delete_modal.confirm')}</Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>{t('delete_modal.cancel')}</Button>
        </>
      )}
    >
      <div className="order-first w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--danger)', color: 'var(--on-action)' }}>
        <WarningIcon className="w-8 h-8" />
      </div>
    </Dialog>
  );
}
