import { useTranslation } from 'react-i18next';

// Wide screens: wrapping chips. Narrow screens: one dropdown, so the tabs never crowd out the
// page content and no tab is ever off-screen.
export function Tabs({ tabs, activeTab, onTabChange }) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0">
      <div role="tablist" className="ui-tabs-chips ui-chip-group">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            onClick={() => onTabChange(tab.id)}
            className="ui-chip"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <select
        className="ui-tabs-select ui-field"
        aria-label={t('common.section', 'Section')}
        value={activeTab}
        onChange={e => onTabChange(e.target.value)}
      >
        {tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
      </select>
    </div>
  );
}
