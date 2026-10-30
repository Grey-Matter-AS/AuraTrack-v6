import { useTranslation } from 'react-i18next';
import { Select, TextArea, Toggle, useToast } from './ui';
import { setLanguage } from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Dansk' },
  { code: 'nb', label: 'Norsk Bokmål' },
  { code: 'nn', label: 'Nynorsk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'sv', label: 'Svenska' },
  { code: 'fi', label: 'Suomi' },
];

import { FieldLabel, Row, Section, Segments, TextField } from './settings/atoms';
import { MedicationSection } from './settings/MedicationsTab';
import { RecordingTab } from './settings/RecordingTab';
import { DataTab } from './settings/DataTab';

// ─── Main component ───────────────────────────────────────────
export function SettingsForm({ settings, onUpdate, onReset, pwa, activeTab, notificationPermission, onRequestNotificationPermission, onSync, storagePersistence, onBackupSuccess }) {
  const { t } = useTranslation();
  // Settings messages use the app-wide toasts so they show on every settings tab
  const showToast = useToast();
  const flash = (msg, tone = 'success') => showToast(msg, tone);
  const noteLabel = settings.userMode === 'CARETAKER' ? t('settings.identity.patient_name') : t('settings.identity.your_name');
  const tab = activeTab || 'identity';
  const show = (id) => !activeTab || tab === id;

  return (
    <div className="space-y-4 w-full pb-10">

      {/* ── IDENTITY / PROFILE ── */}
      {show('identity') && <Section title={t('settings.identity.section')}>
        <div>
          <FieldLabel>{t('settings.identity.mode')}</FieldLabel>
          <Segments
            options={[
              { value: 'CARETAKER', label: t('settings.identity.mode_caretaker') },
              { value: 'PATIENT',   label: t('settings.identity.mode_self') }
            ]}
            value={settings.userMode}
            onChange={v => onUpdate('userMode', v)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-2">
            {settings.userMode === 'CARETAKER'
              ? t('settings.identity.mode_desc_caretaker')
              : t('settings.identity.mode_desc_self')}
          </p>
        </div>
        <TextField label={noteLabel} value={settings.personName} onChange={v => onUpdate('personName', v)} placeholder={t('settings.identity.name_placeholder')} />
        {settings.userMode === 'CARETAKER' && (
          <TextField label={t('settings.identity.caretaker_name')} value={settings.caretakerName} onChange={v => onUpdate('caretakerName', v)} placeholder={t('settings.identity.caretaker_placeholder')} />
        )}
        <TextField label={t('settings.identity.dob')} value={settings.dateOfBirth} onChange={v => onUpdate('dateOfBirth', v)} type="date" />
        <TextField label={t('settings.identity.emergency_contact')} value={settings.emergencyContact} onChange={v => onUpdate('emergencyContact', v)} placeholder={t('settings.identity.emergency_placeholder')} />
      </Section>}

      {/* ── APPEARANCE + DISPLAY ── */}
      {show('appearance') && <Section title={t('settings.appearance.section')}>
        <div>
          <FieldLabel>{t('settings.appearance.theme')}</FieldLabel>
          <Segments
            options={[
              { value: 'dark',   label: t('settings.appearance.theme_dark') },
              { value: 'light',  label: t('settings.appearance.theme_light') },
              { value: 'system', label: t('settings.appearance.theme_system') }
            ]}
            value={settings.theme}
            onChange={v => onUpdate('theme', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.accent')}</FieldLabel>
          <div className="flex gap-4 flex-wrap pt-1">
            {[
              { key: 'red',    hex: '#dc2626', label: t('settings.appearance.accent_red')    },
              { key: 'blue',   hex: '#5b8def', label: t('settings.appearance.accent_blue')   },
              { key: 'green',  hex: '#16a34a', label: t('settings.appearance.accent_green')  },
              { key: 'purple', hex: '#9333ea', label: t('settings.appearance.accent_purple') },
              { key: 'amber',  hex: '#d97706', label: t('settings.appearance.accent_amber')  },
            ].map(({ key, hex, label }) => (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <button
                  title={label}
                  onClick={() => onUpdate('accentColor', key)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    settings.accentColor === key
                      ? 'ring-4 ring-offset-2 scale-110'
                      : 'opacity-50 active:opacity-100'
                  }`}
                  style={{ backgroundColor: hex, outlineColor: hex }}
                />
                <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.text_size')}</FieldLabel>
          <Segments
            options={[
              { value: 'small',  label: 'S'      },
              { value: 'normal', label: t('settings.appearance.text_size_normal', 'Normal') },
              { value: 'large',  label: 'L'      },
              { value: 'xlarge', label: 'XL'     },
            ]}
            value={settings.fontSize}
            onChange={v => onUpdate('fontSize', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.language')}</FieldLabel>
          <Select
            aria-label={t('settings.appearance.language')}
            value={settings.language || 'en'}
            onChange={value => {
              setLanguage(value);
              onUpdate('language', value);
            }}
            options={LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
          />
        </div>
      </Section>}

      {show('appearance') && <Section title={t('settings.display.section')}>
        <div>
          <FieldLabel>{t('settings.display.page_size')}</FieldLabel>
          <Segments
            options={[5, 10, 25, 50].map(n => ({ value: n, label: String(n) }))}
            value={settings.historyPageSize}
            onChange={v => onUpdate('historyPageSize', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.date_format')}</FieldLabel>
          <Select
            aria-label={t('settings.display.date_format')}
            value={settings.dateFormat}
            onChange={value => onUpdate('dateFormat', value)}
            options={[
              { value: 'locale', label: t('settings.display.date_system') },
              { value: 'ISO', label: 'ISO  — 2025-05-14' },
              { value: 'US', label: 'US   — 05/14/2025' },
              { value: 'EU', label: 'EU   — 14/05/2025' },
            ]}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.duration_display')}</FieldLabel>
          <Segments
            options={[{ value: 'seconds', label: '123s' }, { value: 'human', label: '2m 3s' }]}
            value={settings.durationFormat}
            onChange={v => onUpdate('durationFormat', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.time_format')}</FieldLabel>
          <Segments
            options={[{ value: '12h', label: '12h' }, { value: '24h', label: '24h' }]}
            value={settings.timeFormat}
            onChange={v => onUpdate('timeFormat', v)}
          />
        </div>
      </Section>}
      {show('recording') && <RecordingTab settings={settings} onUpdate={onUpdate} notificationPermission={notificationPermission} onRequestNotificationPermission={onRequestNotificationPermission} />}

      {show('data') && <DataTab settings={settings} onUpdate={onUpdate} onReset={onReset} pwa={pwa} onSync={onSync} storagePersistence={storagePersistence} onBackupSuccess={onBackupSuccess} />}

      {/* ── MEDICATIONS ── */}
      {show('medications') && <MedicationSection flash={flash} notificationPermission={notificationPermission} onRequestNotificationPermission={onRequestNotificationPermission} settings={settings} onUpdate={onUpdate} />}

      {/* ── REPORTS & NEUROLOGIST ── */}
      {show('clinician') && <Section title={t('settings.reports.section')}>
        <p className="text-[11px] text-[var(--text-dim)] -mt-2">{t('settings.reports.section_desc')}</p>
        <TextField label={t('settings.reports.neuro_name')} value={settings.neurologistName} onChange={v => onUpdate('neurologistName', v)} placeholder={t('settings.reports.neuro_name_placeholder')} />
        <TextField label={t('settings.reports.institution')} value={settings.neurologistInstitution} onChange={v => onUpdate('neurologistInstitution', v)} placeholder={t('settings.reports.institution_placeholder')} />
        <TextField label={t('settings.reports.contact')} value={settings.neurologistContact} onChange={v => onUpdate('neurologistContact', v)} placeholder={t('settings.reports.contact_placeholder')} />
        <Row label={t('settings.reports.include_dob')} help={t('settings.reports.include_dob_help')}>
          <Toggle value={settings.includePatientDOB !== false} onChange={v => onUpdate('includePatientDOB', v)} label={t('settings.reports.include_dob')} />
        </Row>
        <div>
          <FieldLabel>{t('settings.reports.additional_notes')}</FieldLabel>
          <TextArea
            aria-label={t('settings.reports.additional_notes')}
            value={settings.reportNotes || ''}
            onChange={value => onUpdate('reportNotes', value)}
            placeholder={t('settings.reports.notes_placeholder')}
            rows={4}
          />
        </div>
      </Section>}

    </div>
  );
}
