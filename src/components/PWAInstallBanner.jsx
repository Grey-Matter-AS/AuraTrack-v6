import { useTranslation } from 'react-i18next';
import { InstallIcon } from './AppIcons';
import { Button, CloseButton } from './ui';

// Rendered in the app layout flow (App), so it takes its own space instead of covering content.
export function PWAInstallBanner({ isVisible, isIOS, install, dismiss, showManualInstructions, dismissManual }) {
  const { t } = useTranslation();
  if (!isVisible) return null;

  const title = showManualInstructions || isIOS ? t('install.add_to_home') : t('install.title');
  const hint = showManualInstructions
    ? <>{t('install.manual_prefix')} <strong style={{ color: 'var(--text-primary)' }}>...</strong> {t('install.manual_suffix')}</>
    : isIOS ? t('install.ios_hint') : t('install.offline_hint');

  return (
    <div className="ui-card flex flex-wrap items-center gap-3 shadow-xl" style={{ border: '1px solid var(--border)' }}>
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)' }}
      >
        <InstallIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-[10rem]">
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{hint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isIOS && !showManualInstructions && (
          <Button variant="primary" size="sm" icon={<InstallIcon className="w-4 h-4" />} onClick={install}>
            {t('install.install')}
          </Button>
        )}
        <CloseButton label={t('install.dismiss')} onClick={showManualInstructions ? dismissManual : dismiss} />
      </div>
    </div>
  );
}
