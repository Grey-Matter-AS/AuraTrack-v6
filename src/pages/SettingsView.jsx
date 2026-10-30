import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsForm } from '../components/SettingsForm';
import { Tabs } from '../components/ui';
import { ScrollFade } from '../components/ScrollFade';

// tab / onTabChange: the open tab is kept in the navigation entry, so Back from Help (or a sheet)
// returns to the same tab
export default function SettingsView({ settings, onUpdate, onReset, onBack, pwa, notificationPermission, onRequestNotificationPermission, onSync, tab, onTabChange, initialTab = 'identity', storagePersistence = null, onBackupSuccess = null }) {
  const { t } = useTranslation();
  const [localTab, setLocalTab] = useState(initialTab);
  const activeTab = tab ?? localTab;
  const setActiveTab = onTabChange ?? setLocalTab;

  const TABS = [
    { id: 'identity',    label: t('settings.tabs.identity')    },
    { id: 'medications', label: t('settings.tabs.medications') },
    { id: 'appearance',  label: t('settings.tabs.appearance')  },
    { id: 'recording',   label: t('settings.tabs.recording')   },
    { id: 'clinician',   label: t('settings.tabs.clinician')   },
    { id: 'data',        label: t('settings.tabs.data_backup') },
  ];

  return (
    <div className="app-page-shell flex-1 flex flex-col w-full overflow-hidden mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="ui-btn ui-btn--secondary ui-btn--sm"
        >
          {t('nav.back')}
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          {t('settings.title')}
        </h2>
        <span className="app-status-badge app-status-badge--neutral ml-auto">
          {settings.userMode === 'CARETAKER' ? t('settings.badge_caretaker') : t('settings.badge_self')}
        </span>
      </div>

      <div className="mb-4 shrink-0">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <ScrollFade wrapperClassName="flex-1">
        <SettingsForm
          settings={settings}
          onUpdate={onUpdate}
          onReset={onReset}
          pwa={pwa}
          activeTab={activeTab}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={onRequestNotificationPermission}
          onSync={onSync}
          storagePersistence={storagePersistence}
          onBackupSuccess={onBackupSuccess}
        />
      </ScrollFade>

    </div>
  );
}
