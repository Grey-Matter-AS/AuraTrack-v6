import { useTranslation } from 'react-i18next';
import pkg from '../../package.json';
import { ScrollFade } from '../components/ScrollFade';

const GITHUB_URL = 'https://github.com/Grey-Matter-AS/AuraTrack';
const PRIVACY_POINT_KEYS = ['local', 'sharing', 'sync', 'exports'];

export default function AboutView({ onBack }) {
  const { t } = useTranslation();
  const privacyPoints = PRIVACY_POINT_KEYS.map((key) => ({
    key,
    title: t(`about.privacy_points.${key}.title`),
    body: t(`about.privacy_points.${key}.body`),
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
          {t('about.title')}
        </h2>
      </div>

      <ScrollFade className="space-y-4" wrapperClassName="flex-1">

        <div className="text-center py-5">
          <h1 className="text-2xl font-black tracking-[0.3em] uppercase" style={{ color: 'var(--text-primary)' }}>
            AURATRACK
          </h1>
          <div className="h-1 w-8 bg-[var(--accent)] mx-auto mt-2 rounded-full" />
          <span
            className="app-status-badge app-status-badge--neutral mt-3"
          >
            v{pkg.version}
          </span>
        </div>

        <Section title={t('about.section_about')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.about_text')}
          </p>
        </Section>

        <Section title={t('about.section_developer')}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Grey Matter AS</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}
            >
              {t('about.github')}
            </a>
          </div>
        </Section>

        <Section title={t('about.section_privacy')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.privacy_text')}
          </p>
          <div className="mt-4 space-y-3">
            {privacyPoints.map((point) => (
              <div
                key={point.key}
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}
              >
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                  {point.title}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {point.body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t('about.section_disclaimer')}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('about.disclaimer_text')}
          </p>
        </Section>

        <Section title={t('about.section_opensource')}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            {t('about.opensource_text')}
          </p>
          <div className="flex gap-3">
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              {t('about.license')}
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
            >
              {t('about.report_issue')}
            </a>
          </div>
        </Section>

        <div className="pb-4" />
      </ScrollFade>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
