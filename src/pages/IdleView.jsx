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
  const [customHours, setCustomHours] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3">
      <div className="w-full max-w-md rounded-[2rem] p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{t('eeg.start_session', 'Start EEG Diary')}</h3>
          <button onClick={onClose} className="app-icon-action app-icon-action--primary !min-h-[36px] !px-3">
            {t('eeg.close', 'Close')}
          </button>
        </div>
        <div className="flex gap-2">
          {['24h', '72h', 'custom'].map(option => {
            const active = durationPreset === option;
            return (
              <button
                key={option}
                onClick={() => setDurationPreset(option)}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
                style={{
                  backgroundColor: active ? 'var(--action-blue)' : 'var(--bg-raised)',
                  color: active ? '#fff' : 'var(--text-on-raised)',
                  border: active ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
        {durationPreset === 'custom' && (
          <input
            type="number"
            min="1"
            value={customHours}
            onChange={e => setCustomHours(e.target.value)}
            placeholder={t('eeg.custom_hours', 'Custom hours')}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        )}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('eeg.session_label_placeholder', 'Session label (optional)')}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('eeg.session_notes_placeholder', 'Notes for this EEG session (optional)')}
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onStart({ durationPreset, customHours, title, notes })}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {t('eeg.start', 'Start')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('eeg.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3">
      <div className="w-full max-w-md rounded-[2rem] p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{t('eeg.start_activity', 'Start EEG Activity')}</h3>
          <button onClick={onClose} className="app-icon-action app-icon-action--primary !min-h-[36px] !px-3">
            {t('eeg.close', 'Close')}
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('eeg.search_activities_placeholder', 'Search common activities')}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <div className="max-h-40 overflow-auto rounded-2xl p-2 space-y-2" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          {filtered.map(activity => {
            const active = selected === activity;
            return (
              <button
                key={activity}
                onClick={() => setSelected(activity)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold"
                style={{
                  backgroundColor: active ? 'var(--action-blue)' : 'var(--bg-card)',
                  color: active ? '#fff' : 'var(--text-primary)',
                  border: active ? '1px solid var(--action-blue-border)' : '1px solid transparent',
                }}
              >
                {activity}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={customActivityText}
          onChange={e => setCustomActivityText(e.target.value)}
          placeholder={t('eeg.exact_activity_placeholder', 'Exact activity details (optional)')}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select
          value={moodLabel}
          onChange={e => setMoodLabel(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">{t('eeg.mood_placeholder', 'Mood (optional)')}</option>
          {EEG_MOOD_OPTIONS.map(mood => <option key={mood} value={mood}>{mood}</option>)}
        </select>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('eeg.notes_placeholder', 'Notes (optional)')}
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onStart({ activityLabel: selected, customActivityText, moodLabel, notes })}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {t('eeg.start', 'Start')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('eeg.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
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
          <button
            onClick={() => setShowSessionSheet(true)}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('idle.start_eeg_diary', 'Start EEG Diary')}
          </button>
        )}
      </div>

      {/* Zone 2: medication panel + recent events — unified scrollable section */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollFade className="space-y-3" wrapperClassName="flex-1">
          {wellbeingEnabled && wellbeing && (
            <div
              className="w-full rounded-2xl p-3 flex items-center justify-between gap-3"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="min-w-0 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)' }}
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
              <button
                onClick={() => setShowWellbeingSheet(true)}
                className="rounded-xl px-3 py-2 text-[10px] font-medium uppercase tracking-widest active:scale-95 transition-all shrink-0"
                style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
              >
                {t('wellbeing.log_action', 'Log')}
              </button>
            </div>
          )}

          {eegSession && (
            <div className="rounded-[2rem] p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--accent)' }}>{t('idle.eeg_active', 'EEG Diary Active')}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{eegSession.title || t('idle.eeg_session_default', 'EEG monitoring session')}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                    {t('idle.eeg_session_elapsed', 'Session elapsed')}: {durationFormat === 'human' ? formatDuration(eegElapsed) : `${eegElapsed}s`}
                  </p>
                </div>
                <button
                  onClick={() => onEndEegSession?.(eegSession.id)}
                  className="app-icon-action app-icon-action--danger"
                >
                  {t('idle.end_eeg', 'End EEG')}
                </button>
              </div>

              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                {eegCurrentActivity ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => onStopEegActivity?.(eegCurrentActivity.id)}
                        className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                        style={{ backgroundColor: '#dc2626', color: '#fff', border: '1px solid #991b1b' }}
                      >
                        {t('idle.stop_activity', 'Stop Activity')}
                      </button>
                      <button
                        onClick={onOpenEegDiary}
                        className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                        style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
                      >
                        {t('idle.view_log', 'View Log')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('idle.eeg_no_activity', 'No EEG activity running')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowActivitySheet(true)}
                        className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                        style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
                      >
                        {t('idle.start_activity', 'Start Activity')}
                      </button>
                      <button
                        onClick={onOpenEegDiary}
                        className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
                        style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
                      >
                        {t('idle.view_log', 'View Log')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {t('idle.eeg_auto_stop_hint', 'If a seizure starts, any active EEG activity is stopped automatically and a seizure reference is added to the EEG log.')}
              </p>
            </div>
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
            <div className="border-2 border-dashed border-slate-800 rounded-3xl py-8 text-center">
              <p className="italic text-sm" style={{ color: 'var(--text-secondary)' }}>{t('idle.no_events')}</p>
            </div>
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
