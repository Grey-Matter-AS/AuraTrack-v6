import { useTranslation } from 'react-i18next';
import { formatDuration, formatEventDate, formatEventTime } from '../utils/formatters';
import { EyeIcon, TrashIcon, WarningIcon } from './AppIcons';

function DangerBadge({ dangerFlags }) {
  const { t } = useTranslation();
  const flags = dangerFlags?.flags;
  if (!flags?.length) return null;
  const isCluster = flags.includes('cluster');
  const isLong    = flags.includes('long_duration');

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {isLong && (
        <span
          className="app-status-badge app-status-badge--warning"
          title={t('event_card.long_duration_title')}
        >
          <WarningIcon className="w-3 h-3" /> {t('event_card.long_duration_badge')}
        </span>
      )}
      {isCluster && (
        <span
          className="app-status-badge app-status-badge--danger"
          title={t('event_card.cluster_title', { count: dangerFlags.clusterCount })}
        >
          <WarningIcon className="w-3 h-3" /> {t('event_card.cluster_badge', { count: dangerFlags.clusterCount })}
        </span>
      )}
    </div>
  );
}

export function EventCard({ event, onEdit, onDelete, onViewDetail, dangerFlags, durationFormat = 'seconds', dateFormat = 'locale', timeFormat = '12h' }) {
  const { t } = useTranslation();
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
  const handleView = () => onViewDetail ? onViewDetail(event.id) : onEdit(event);
  const flags = dangerFlags?.flags;

  return (
    <div
      className="p-4 rounded-2xl shadow-lg"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: flags?.length
          ? '1px solid rgba(239,68,68,0.4)'
          : '1px solid var(--border-subtle)',
      }}
    >
      {/* Top row */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{event.type || t('event_card.unknown')}</p>
            {event.isEdited && (
              <span
                className="app-status-badge app-status-badge--info"
              >{t('event_card.edited')}</span>
            )}
            {event.isManualEntry && (
              <span
                className="app-status-badge app-status-badge--info"
              >{t('event_card.manual_entry')}</span>
            )}
            {event.videoAttached && (
              <span
                className="app-status-badge app-status-badge--info"
              >{t('recording.video_badge', 'Video')}</span>
            )}
            {event.eegSessionId && (
              <span
                className="app-status-badge app-status-badge--warning"
              >{t('eeg.badge', 'EEG')}</span>
            )}
            {!event.isComplete && (
              <span
                className="app-status-badge app-status-badge--warning"
              >{t('event_card.untagged', 'Untagged')}</span>
            )}
          </div>
          <p className="text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>
            {formatEventDate(event.startTime, dateFormat)} • {formatEventTime(event.startTime, timeFormat)}
          </p>
          <DangerBadge dangerFlags={dangerFlags} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}
          >
            <span
              className="font-mono font-black text-lg"
              style={{ color: flags?.includes('long_duration') ? 'var(--text-warning)' : 'var(--text-danger)' }}
            >
              {fmtDur(event.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleView}
          className="ui-btn ui-btn--primary ui-btn--sm flex-1"
        >
          <EyeIcon className="w-4 h-4 shrink-0" />
          <span className="app-chip-text">{t('event_card.view_edit')}</span>
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="ui-btn ui-btn--danger ui-btn--sm"
        >
          <TrashIcon className="w-4 h-4 shrink-0" />
          <span className="app-chip-text">{t('event_card.delete')}</span>
        </button>
      </div>
    </div>
  );
}
