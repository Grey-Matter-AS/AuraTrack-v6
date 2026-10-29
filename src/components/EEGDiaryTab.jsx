import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration, formatEventDate, formatEventTime } from '../utils/formatters';
import { EEG_ACTIVITY_OPTIONS, EEG_MOOD_OPTIONS } from '../data/constants';
import { BottomSheet, Button, Card, DateInput, FieldRow, NumberInput, Select, TextArea, TextInput } from './ui';

const EEG_SESSION_STATUS_STYLES = {
  COMPLETED: {
    backgroundColor: '#16a34a',
    color: '#fff',
    border: '1px solid #15803d',
  },
  ACTIVE: {
    backgroundColor: '#d97706',
    color: '#fff',
    border: '1px solid #b45309',
  },
  ERROR: {
    backgroundColor: '#dc2626',
    color: '#fff',
    border: '1px solid #991b1b',
  },
};

function getEegSessionStatusStyle(status) {
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus.includes('ERROR') || normalizedStatus.includes('FAIL')) {
    return EEG_SESSION_STATUS_STYLES.ERROR;
  }

  if (normalizedStatus === 'COMPLETED') {
    return EEG_SESSION_STATUS_STYLES.COMPLETED;
  }

  return EEG_SESSION_STATUS_STYLES.ACTIVE;
}

// datetime-local fields hold local time; toISOString() would show (and save back) UTC
const toLocalInput = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function ActivityEditor({ activity, onSave, onDelete, onClose }) {
  const { t } = useTranslation();
  const [activityLabel, setActivityLabel] = useState(activity.activityLabel || '');
  const [customActivityText, setCustomActivityText] = useState(activity.customActivityText || '');
  const [moodLabel, setMoodLabel] = useState(activity.moodLabel || '');
  const [notes, setNotes] = useState(activity.notes || '');
  const [startTime, setStartTime] = useState(() => toLocalInput(activity.startTime));
  const [endTime, setEndTime] = useState(() => activity.endTime ? toLocalInput(activity.endTime) : '');
  const [durationSec, setDurationSec] = useState(Number(activity.durationSec || 0));
  const isReference = activity.kind === 'SEIZURE_REFERENCE';

  const save = () => onSave(isReference ? { notes } : {
    activityLabel,
    customActivityText,
    moodLabel,
    notes,
    startTime: new Date(startTime).getTime(),
    endTime: endTime ? new Date(endTime).getTime() : null,
    durationSec: Number(durationSec || 0),
  });

  return (
    <BottomSheet
      title={isReference ? t('eeg.edit_seizure_reference', 'EEG Seizure Reference') : t('eeg.edit_activity', 'Edit EEG Activity')}
      onClose={onClose}
      footer={(
        <div className="ui-button-row">
          <Button variant="success" onClick={save}>{t('eeg.save', 'Save')}</Button>
          {!isReference && <Button variant="danger" onClick={() => onDelete(activity.id)}>{t('eeg.delete', 'Delete')}</Button>}
        </div>
      )}
    >
      {isReference ? (
        <>
          <p className="text-sm font-bold">{activity.activityLabel}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {t('eeg.linked_description', 'This entry is linked to the seizure record and keeps its timing from that event.')}
          </p>
          <TextArea label={t('eeg.notes_label', 'Notes')} value={notes} onChange={setNotes} rows={4} />
        </>
      ) : (
        <>
          <Select
            label={t('eeg.activity_label', 'Activity')}
            value={activityLabel}
            onChange={setActivityLabel}
            options={EEG_ACTIVITY_OPTIONS.map(option => ({ value: option, label: option }))}
          />
          <TextInput label={t('eeg.exact_activity_label', 'Details')} value={customActivityText} onChange={setCustomActivityText} placeholder={t('eeg.exact_activity_placeholder', 'Exact activity details (optional)')} />
          <Select
            label={t('eeg.mood_label', 'Mood')}
            placeholder={t('eeg.no_mood', 'No mood')}
            value={moodLabel}
            onChange={setMoodLabel}
            options={EEG_MOOD_OPTIONS.map(option => ({ value: option, label: option }))}
          />
          <FieldRow min="13rem">
            <DateInput type="datetime-local" label={t('eeg.start_time_label', 'Start')} value={startTime} onChange={setStartTime} />
            <DateInput type="datetime-local" label={t('eeg.end_time_label', 'End')} value={endTime} onChange={setEndTime} />
          </FieldRow>
          <NumberInput label={t('eeg.duration_seconds', 'Duration seconds')} value={durationSec} onChange={setDurationSec} maxLength={6} />
          <TextArea label={t('eeg.notes_label', 'Notes')} value={notes} onChange={setNotes} rows={4} />
        </>
      )}
    </BottomSheet>
  );
}

export function EEGDiaryTab({
  activeSession,
  getSessions,
  getActivitiesForSession,
  onUpdateActivity,
  onDeleteActivity,
  onEndSession,
}) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activities, setActivities] = useState([]);
  const [editingActivity, setEditingActivity] = useState(null);

  useEffect(() => {
    getSessions().then(rows => {
      setSessions(rows);
      setSelectedSessionId(current => current || activeSession?.id || rows[0]?.id || null);
    }).catch(err => console.error('Failed to load EEG sessions:', err));
  }, [activeSession?.id, getSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    getActivitiesForSession(selectedSessionId)
      .then(setActivities)
      .catch(err => console.error('Failed to load EEG activities:', err));
  }, [selectedSessionId, getActivitiesForSession]);

  const selectedSession = sessions.find(session => session.id === selectedSessionId) || null;

  return (
    <div className="space-y-4">
      {editingActivity && (
        <ActivityEditor
          activity={editingActivity}
          onSave={async updates => {
            await onUpdateActivity(editingActivity.id, updates);
            const next = await getActivitiesForSession(selectedSessionId);
            setActivities(next);
            setEditingActivity(null);
          }}
          onDelete={async (activityId) => {
            await onDeleteActivity(activityId);
            const next = await getActivitiesForSession(selectedSessionId);
            setActivities(next);
            setEditingActivity(null);
          }}
          onClose={() => setEditingActivity(null)}
        />
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--accent-text)' }}>{t('eeg.title', 'EEG Diary')}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
              {t('eeg.description', 'EEG sessions stay separate from seizure history. Seizures recorded during EEG appear here as linked reference rows.')}
            </p>
          </div>
          {activeSession && (
            <Button variant="danger" size="sm" className="shrink-0" onClick={() => onEndSession(activeSession.id)}>
              {t('eeg.end_active', 'End Active EEG')}
            </Button>
          )}
        </div>
        {sessions.length > 0 ? (
          <Select
            aria-label={t('eeg.session_default', 'EEG session')}
            value={selectedSessionId ? String(selectedSessionId) : ''}
            onChange={value => setSelectedSessionId(Number(value))}
            options={sessions.map(session => ({
              value: String(session.id),
              label: `${session.title || t('eeg.session_default', 'EEG session')} - ${formatEventDate(session.startTime)} ${formatEventTime(session.startTime)}`,
            }))}
          />
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>{t('eeg.no_sessions', 'No EEG sessions yet.')}</p>
        )}
      </Card>

      {selectedSession && (
        <Card className="space-y-3">
          <div className="ui-row text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('eeg.started', 'Started')}</p>
              <p style={{ color: 'var(--text-primary)' }}>{formatEventDate(selectedSession.startTime)} {formatEventTime(selectedSession.startTime)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('event_detail.status')}</p>
              <p
                className="app-status-badge mt-1"
                style={getEegSessionStatusStyle(selectedSession.status)}
              >
                {selectedSession.status}
              </p>
            </div>
          </div>
          {selectedSession.notes && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>{selectedSession.notes}</p>
          )}
          {activities.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>{t('eeg.no_activities', 'No EEG activities logged for this session.')}</p>
          ) : (
            activities.map(activity => (
              <button
                key={activity.id}
                type="button"
                onClick={() => setEditingActivity(activity)}
                className="ui-inset block w-full text-left active:opacity-80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className={activity.kind === 'SEIZURE_REFERENCE' ? 'app-status-badge app-status-badge--danger' : 'app-status-badge app-status-badge--neutral'}>
                      {activity.kind === 'SEIZURE_REFERENCE' ? t('eeg.seizure_reference', 'Seizure reference') : t('eeg.activity', 'Activity')}
                    </p>
                    <p className="text-sm font-black mt-1" style={{ color: 'var(--text-primary)' }}>{activity.activityLabel}</p>
                    {activity.customActivityText && (
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{activity.customActivityText}</p>
                    )}
                    {activity.moodLabel && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{t('eeg.mood_label', 'Mood')}: {activity.moodLabel}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('export.docs.duration')}</p>
                    <p className="text-sm font-mono font-black" style={{ color: 'var(--text-primary)' }}>{formatDuration(activity.durationSec || 0)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  <span>{formatEventDate(activity.startTime)} {formatEventTime(activity.startTime)}</span>
                  <span>{activity.endTime ? `${formatEventTime(activity.endTime)}` : t('eeg.running', 'Running')}</span>
                </div>
              </button>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
