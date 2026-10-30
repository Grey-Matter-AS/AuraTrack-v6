import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollFade } from '../components/ScrollFade';

const SECTION_IDS = [
  'whats_new',
  'recording',
  'tagging',
  'manual',
  'medications',
  'wellbeing',
  'eeg',
  'history',
  'reports',
  'sync_backup',
  'settings',
];

export default function HelpView({ onBack, onAbout }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  const sections = SECTION_IDS.map(id => ({
    id,
    title: t(`help.sections.${id}.title`),
    steps: t(`help.sections.${id}.steps`, { returnObjects: true }),
  }));

  return (
    <div className="app-page-shell flex-1 flex flex-col w-full overflow-hidden mx-auto">

      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="ui-btn ui-btn--secondary ui-btn--sm"
        >
          {t('nav.back')}
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          {t('help.title')}
        </h2>
      </div>

      <ScrollFade className="space-y-2" wrapperClassName="flex-1">

        {sections.map(section => (
          <div
            key={section.id}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => toggle(section.id)}
              className="w-full flex items-center justify-between px-4 py-3 active:opacity-70 transition-opacity"
            >
              <span className="text-[11px] font-black uppercase tracking-widest text-left" style={{ color: 'var(--text-on-raised)' }}>
                {section.title}
              </span>
              <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text-on-raised-muted)' }}>
                {expanded === section.id ? '▲' : '▼'}
              </span>
            </button>

            {expanded === section.id && (
              <div className="px-4 pb-4 space-y-3">
                {Array.isArray(section.steps) && section.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span
                      className="shrink-0 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: 'var(--action-blue)', color: '#fff' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-on-raised-muted)' }}>{step}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={onAbout}
          className="ui-btn ui-btn--secondary ui-btn--md ui-btn--full mt-2"
        >
          {t('help.about_btn')}
        </button>

        <div className="pb-4" />
      </ScrollFade>
    </div>
  );
}
