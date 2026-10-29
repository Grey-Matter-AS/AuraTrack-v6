import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from '../components/EventCard';
import { MedicationDosePanel } from '../components/MedicationDosePanel';
import { buildDangerMap } from '../utils/dangerFlags';
import { ScrollFade } from '../components/ScrollFade';
import { EEG_ACTIVITY_OPTIONS, EEG_MOOD_OPTIONS } from '../data/constants';
import { formatDuration } from '../utils/formatters';
import { WellbeingEntrySheet } from '../components/WellbeingEntrySheet';
import { ActivityIcon } from '../components/AppIcons';
import { BottomSheet, Button, Card, ChipGroup, ChoiceList, EmptyState, Field, Inset, NumberInput, Select, TextArea, TextInput } from '../components/ui';

// Shared sizing for the two home-screen circle buttons — sized so both fit side by side on a ~393px phone
const circleButtonStyle = {
  width: 'min(11rem, 36vmin)',
  height: 'min(11rem, 36vmin)',
  fontSize: 'min(1.25rem, 4vmin)',
  lineHeight: 0.95,
  borderWidth: 'min(10px, 1.8vmin)',
  borderStyle: 'solid',
  borderColor: '#1e293b',
  hyphens: 'none',
  overflowWrap: 'break-word',
};

function EegSessionSheet({ onClose, onStart }) {
  const { t } = useTranslation();
  const [durationPreset, setDurationPreset] = useState('24h');
  const [customHours, setCustomHours] = useState(0);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <BottomSheet
      title={t('eeg.start_session', 'Start EEG Diary')}
      onClose={onClose}
      footer={(
        <div className="ui-button-row">
          <Button variant="primary" onClick={() => onStart({ durationPreset, customHours: customHours ? String(customHours) : '', title, notes })}>{t('eeg.start', 'Start')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('eeg.cancel', 'Cancel')}</Button>
        </div>
      )}
    >
      <Field label={t('eeg.duration_label', 'Duration')}>
        <ChipGroup
          fill
          label={t('eeg.duration_label', 'Duration')}
          value={durationPreset}
          onChange={setDurationPreset}
          options={['24h', '72h', 'custom'].map(option => ({ value: option, label: option }))}
        />
      </Field>
      {durationPreset === 'custom' && (
        <NumberInput label={t('eeg.custom_hours', 'Custom hours')} value={customHours} onChange={setCustomHours} maxLength={3} />
      )}
      <TextInput label={t('eeg.session_label', 'Session label')} value={title} onChange={setTitle} placeholder={t('eeg.session_label_placeholder', 'Session label (optional)')} />
      <TextArea label={t('eeg.notes_label', 'Notes')} value={notes} onChange={setNotes} placeholder={t('eeg.session_notes_placeholder', 'Notes for this EEG session (optional)')} rows={3} />
    </BottomSheet>
  );
}

function EegActivitySheet({ onClose, onStart }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('Watching TV');
  const [moodLabel, setMoodLabel] = useState('');
  const [customActivityText, setCustomActivityText] = useState('');
  const [notes, setNotes] = useState('');
  const filtered = EEG_ACTIVITY_OPTIONS.filter(activity => activity.toLowerCase().includes(query.toLowerCase())).slice(0, 20);

  return (
    <BottomSheet
      title={t('eeg.start_activity', 'Start EEG Activity')}
      onClose={onClose}
      footer={(
        <div className="ui-button-row">
          <Button variant="primary" onClick={() => onStart({ activityLabel: selected, customActivityText, moodLabel, notes })}>{t('eeg.start', 'Start')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('eeg.cancel', 'Cancel')}</Button>
        </div>
      )}
    >
      <TextInput label={t('eeg.activity_label', 'Activity')} value={query} onChange={setQuery} placeholder={t('eeg.search_activities_placeholder', 'Search common activities')} />
      <Inset className="max-h-48 overflow-y-auto !p-2">
        <ChoiceList value={selected} onChange={setSelected} options={filtered.map(activity => ({ value: activity, label: activity }))} />
      </Inset>
      <TextInput label={t('eeg.exact_activity_label', 'Details')} value={customActivityText} onChange={setCustomActivityText} placeholder={t('eeg.exact_activity_placeholder', 'Exact activity details (optional)')} />
      <Select
        label={t('eeg.mood_label', 'Mood')}
        placeholder={t('eeg.mood_placeholder', 'Mood (optional)')}
        value={moodLabel}
        onChange={setMoodLabel}
        options={EEG_MOOD_OPTIONS.map(mood => ({ value: mood, label: mood }))}
      />
      <TextArea label={t('eeg.notes_label', 'Notes')} value={notes} onChange={setNotes} placeholder={t('eeg.notes_placeholder', 'Notes (optional)')} rows={3} />
    </BottomSheet>
  );
}

export default function IdleView({
  history,
  fullHistory,
  onStart,
  onManualEntry,
  onEdit,
  onDelete,
  onViewDetail,
  medicationGroups,
  allActiveMedications,
  onSaveDoses,
  durationFormat = 'seconds',
  dateFormat = 'locale',
  timeFormat = '12h',
  eegSession = null,
  eegCurrentActivity = null,
  onStartEegSession,
  onEndEegSession,
  onStartEegActivity,
  onStopEegActivity,
  onOpenEegDiary,
  eegDiaryEnabled = false,
  wellbeing = null,
  wellbeingEnabled = true,
}) {
  const { t } = useTranslation();
  const dangerMap = useMemo(() => buildDangerMap(fullHistory?.length ? fullHistory : history), [fullHistory, history]);
  const hasMedications = Object.keys(medicationGroups ?? {}).length > 0 || (allActiveMedications?.length ?? 0) > 0;
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [showActivitySheet, setShowActivitySheet] = useState(false);
  const [showWellbeingSheet, setShowWellbeingSheet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const eegElapsed = eegSession ? Math.floor((now - eegSession.startTime) / 1000) : 0;
  const currentActivityElapsed = eegCurrentActivity ? Math.floor((now - eegCurrentActivity.startTime) / 1000) : 0;

  useEffect(() => {
    if (!eegSession && !eegCurrentActivity) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [eegSession, eegCurrentActivity]);

  return (
    <div className="app-page-shell flex-1 flex flex-col items-center overflow-hidden">
      {showSessionSheet && (
        <EegSessionSheet
          onClose={() => setShowSessionSheet(false)}
          onStart={async payload => {
            await onStartEegSession?.(payload);
            setShowSessionSheet(false);
          }}
        />
      )}
      {showActivitySheet && (
        <EegActivitySheet
          onClose={() => setShowActivitySheet(false)}
          onStart={async payload => {
            await onStartEegActivity?.(payload);
            setShowActivitySheet(false);
          }}
        />
      )}
      {showWellbeingSheet && wellbeing && (
        <WellbeingEntrySheet
          factorDefinitions={wellbeing.factorDefinitions}
          onSave={wellbeing.saveEntry}
          onClose={() => setShowWellbeingSheet(false)}
        />
      )}

      {/* Zone 1: START button — viewport-relative size, decoupled from font-size scaling */}
      <div className="w-full py-3 sm:py-6 shrink-0 flex flex-col items-center gap-4">
        <div className="w-full flex justify-center items-center gap-4">
          <button
            onClick={onStart}
            className="bg-red-600 active:scale-95 active:bg-red-500 transition-all rounded-full shadow-[0_0_60px_rgba(225,29,72,0.4)] flex items-center justify-center text-white font-black ring-4 ring-red-900/20 text-center px-2"
            style={{ ...circleButtonStyle, color: '#fff' }}
          >
            {t('idle.start')}
          </button>
          {onManualEntry && (
            <button
              onClick={onManualEntry}
              className="bg-amber-500 active:scale-95 active:bg-amber-400 transition-all rounded-full shadow-[0_0_60px_rgba(245,158,11,0.4)] flex items-center justify-center text-black font-black ring-4 ring-amber-900/20 text-center px-2"
              style={circleButtonStyle}
            >
              {t('idle.log_past')}
            </button>
          )}
        </div>
        {!eegSession && eegDiaryEnabled && (
          <Button variant="secondary" size="sm" onClick={() => setShowSessionSheet(true)}>
            {t('idle.start_eeg_diary', 'Start EEG Diary')}
          </Button>
        )}
      </div>

      {/* Zone 2: medication panel + recent events — unified scrollable section */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollFade className="space-y-3" wrapperClassName="flex-1">
          {wellbeingEnabled && wellbeing && (
            <Card compact className="w-full flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-48 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent-text)' }}
                >
                  <ActivityIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {wellbeing.todayEntries.length ? t('wellbeing.logged_today', 'Wellbeing Logged Today') : t('wellbeing.daily_checkin', 'Daily Wellbeing Check-In')}
                  </p>
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--text-dim)' }}>
                    {wellbeing.todayEntries.length
                      ? t('wellbeing.entries_today', { count: wellbeing.todayEntries.length, defaultValue: '{{count}} entries today' })
                      : t('wellbeing.idle_hint', 'Mood and context are optional, but help with pattern spotting.')}
                  </p>
                </div>
              </div>
              <Button variant="primary" size="sm" className="shrink-0" onClick={() => setShowWellbeingSheet(true)}>
                {t('wellbeing.log_action', 'Log')}
              </Button>
            </Card>
          )}

          {eegSession && (
            <Card tone="accent" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--accent-text)' }}>{t('idle.eeg_active', 'EEG Diary Active')}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{eegSession.title || t('idle.eeg_session_default', 'EEG monitoring session')}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                    {t('idle.eeg_session_elapsed', 'Session elapsed')}: {durationFormat === 'human' ? formatDuration(eegElapsed) : `${eegElapsed}s`}
                  </p>
                </div>
                <Button variant="danger" size="sm" className="shrink-0" onClick={() => onEndEegSession?.(eegSession.id)}>
                  {t('idle.end_eeg', 'End EEG')}
                </Button>
              </div>

              <Inset>
                {eegCurrentActivity ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('idle.current_activity', 'Current activity')}</p>
                        <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>{eegCurrentActivity.activityLabel}</p>
                        {eegCurrentActivity.customActivityText && (
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{eegCurrentActivity.customActivityText}</p>
                        )}
                        {eegCurrentActivity.moodLabel && (
                          <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{t('eeg.mood_label', 'Mood')}: {eegCurrentActivity.moodLabel}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('alert.elapsed')}</p>
                        <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>
                          {durationFormat === 'human' ? formatDuration(currentActivityElapsed) : `${currentActivityElapsed}s`}
                        </p>
                      </div>
                    </div>
                    <div className="ui-button-row">
                      <Button variant="danger" onClick={() => onStopEegActivity?.(eegCurrentActivity.id)}>{t('idle.stop_activity', 'Stop Activity')}</Button>
                      <Button variant="primary" onClick={onOpenEegDiary}>{t('idle.view_log', 'View Log')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('idle.eeg_no_activity', 'No EEG activity running')}</p>
                    <div className="ui-button-row">
                      <Button variant="primary" onClick={() => setShowActivitySheet(true)}>{t('idle.start_activity', 'Start Activity')}</Button>
                      <Button variant="secondary" onClick={onOpenEegDiary}>{t('idle.view_log', 'View Log')}</Button>
                    </div>
                  </div>
                )}
              </Inset>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {t('idle.eeg_auto_stop_hint', 'If a seizure starts, any active EEG activity is stopped automatically and a seizure reference is added to the EEG log.')}
              </p>
            </Card>
          )}

          {hasMedications && (
            <MedicationDosePanel
              medicationGroups={medicationGroups}
              allActiveMedications={allActiveMedications ?? []}
              onSaveDoses={onSaveDoses}
            />
          )}

          <div className="flex justify-between items-center mb-1 px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{t('idle.recent_events')}</h3>
            {history.length > 0 && (
              <span className="app-status-badge app-status-badge--neutral">{t('idle.last_5')}</span>
            )}
          </div>

          {history.length === 0 ? (
            <EmptyState>{t('idle.no_events')}</EmptyState>
          ) : (
            history.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
                dangerFlags={dangerMap[event.id]}
                durationFormat={durationFormat}
                dateFormat={dateFormat}
                timeFormat={timeFormat}
              />
            ))
          )}
        </ScrollFade>
      </div>
    </div>
  );
}
