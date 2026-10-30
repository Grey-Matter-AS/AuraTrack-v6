import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from '../components/EventCard';
import { SEIZURE_TYPES, seizureTypeLabel } from '../data/constants';
import SeizureTrendChart from '../components/SeizureTrendChart';
import { buildDangerMap, emergencyPlan } from '../utils/dangerFlags';
import { Tabs } from '../components/ui';
import { MedicationHistoryTab } from '../components/MedicationHistoryTab';
import { EEGDiaryTab } from '../components/EEGDiaryTab';
import { WellbeingTab } from '../components/WellbeingTab';
import ExportView from './ExportView';
import { ScrollFade } from '../components/ScrollFade';
import { useMedications } from '../hooks/useMedications';
import { DateInput, EmptyState, Select } from '../components/ui';
import { endOfLocalDay, parseLocalDate } from '../utils/dates';

export default function HistoryView({ onBack, onEdit, onDelete, onViewDetail, historyPageSize = 10, settings = {}, initialTab = 'seizures', eeg = null, wellbeing = null, events = [], onOpenBackup = null, viewState: navState, onViewStateChange }) {
  const { t } = useTranslation();
  const { changes: medicationChanges } = useMedications();
  const { durationFormat = 'seconds', dateFormat = 'locale', timeFormat = '12h' } = settings;
  // Tab, page and filters live in the navigation entry (when given), so they are still there when the
  // user opens a seizure and comes back
  const [localState, setLocalState] = useState({});
  const viewState = navState ?? localState;
  const setView = (patch) => (onViewStateChange ? onViewStateChange(patch) : setLocalState(prev => ({ ...prev, ...patch })));
  const {
    tab: requestedTab = initialTab, page = 0, typeFilter = '', completionFilter = 'all', fromDate = '', toDate = '',
  } = viewState;
  const setPage = (next) => setView({ page: next });
  const [hasEegData, setHasEegData] = useState(false);
  useEffect(() => {
    let alive = true;
    eeg?.getSessions?.().then(sessions => { if (alive) setHasEegData(sessions.length > 0); }).catch(() => {});
    return () => { alive = false; };
  }, [eeg]);

  // Wellbeing and EEG show when switched on, or when there is already data to look back at
  const showWellbeing = settings.wellbeingEnabled !== false || (wellbeing?.entries?.length ?? 0) > 0;
  const showEeg = settings.eegDiaryEnabled === true || hasEegData || Boolean(eeg?.activeSession);
  const HISTORY_TABS = [
    { id: 'seizures',    label: t('history.tab_seizures')    },
    { id: 'medications', label: t('history.tab_medications') },
    ...(showWellbeing ? [{ id: 'wellbeing', label: t('history.tab_wellbeing', 'Wellbeing') }] : []),
    ...(showEeg ? [{ id: 'eeg', label: t('history.tab_eeg', 'EEG Diary') }] : []),
    { id: 'export',      label: t('history.tab_export')      },
  ];
  const activeTab = HISTORY_TABS.some(tab => tab.id === requestedTab) ? requestedTab : 'seizures';

  const allEvents = events;

  const filtered = allEvents.filter(e => {
    if (typeFilter && (e.type || 'Uncategorized') !== typeFilter) return false;
    if (completionFilter === 'needs_details' && e.isComplete) return false;
    if (fromDate || toDate) {
      const eventTs = e.startTime ?? NaN;
      if (fromDate && eventTs < parseLocalDate(fromDate).getTime()) return false;
      if (toDate   && eventTs > endOfLocalDay(parseLocalDate(toDate))) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / historyPageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = filtered.slice(currentPage * historyPageSize, (currentPage + 1) * historyPageSize);
  const needsDetailsCount = allEvents.filter(e => !e.isComplete).length;

  const { emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes } = settings;
  const plan = useMemo(
    () => emergencyPlan({ emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes }),
    [emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes]
  );
  const dangerMap = useMemo(() => buildDangerMap(allEvents, plan), [allEvents, plan]);

  return (
    <div className="app-page-shell flex-1 flex flex-col w-full overflow-hidden mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="ui-btn ui-btn--secondary ui-btn--sm"
        >
          {t('nav.back')}
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{t('history.title')}</h2>
        {activeTab === 'seizures' && (
          <span className="app-status-badge app-status-badge--neutral ml-auto">
            {t('history.events_count', { count: filtered.length })}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 shrink-0">
        <Tabs tabs={HISTORY_TABS} activeTab={activeTab} onTabChange={tab => setView({ tab, page: 0 })} />
      </div>

      {/* ── SEIZURES TAB ── */}
      {activeTab === 'seizures' && (
        <ScrollFade wrapperClassName="flex-1">
          <SeizureTrendChart allEvents={allEvents} medicationChanges={medicationChanges} />

          <div className="mb-4 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex-1 basis-40 min-w-0">
                <Select
                  aria-label={t('history.all_types')}
                  placeholder={t('history.all_types')}
                  value={typeFilter}
                  onChange={value => setView({ typeFilter: value, page: 0 })}
                  options={[...SEIZURE_TYPES, 'Uncategorized'].map(type => ({ value: type, label: type === 'Uncategorized' ? t('history.uncategorized') : seizureTypeLabel(type, t) }))}
                />
              </div>
              <button
                type="button"
                aria-pressed={completionFilter === 'needs_details'}
                onClick={() => setView({ completionFilter: completionFilter === 'needs_details' ? 'all' : 'needs_details', page: 0 })}
                className="ui-chip shrink-0"
              >
                {t('history.needs_details', 'Needs details')} {needsDetailsCount > 0 ? `(${needsDetailsCount})` : ''}
              </button>
              {(typeFilter || fromDate || toDate || completionFilter !== 'all') && (
                <button
                  onClick={() => setView({ typeFilter: '', fromDate: '', toDate: '', completionFilter: 'all', page: 0 })}
                  className="ui-btn ui-btn--secondary ui-btn--sm shrink-0"
                >
                  {t('history.clear')}
                </button>
              )}
            </div>
            <div className="ui-row">
              <DateInput
                value={fromDate}
                max={toDate || undefined}
                onChange={value => setView({ fromDate: value, page: 0 })}
                aria-label={t('history.from_date', 'From')}
                placeholder={t('history.from_date_hint', 'From date')}
              />
              <DateInput
                value={toDate}
                min={fromDate || undefined}
                onChange={value => setView({ toDate: value, page: 0 })}
                aria-label={t('history.to_date', 'To')}
                placeholder={t('history.to_date_hint', 'To date')}
              />
            </div>
          </div>

          {paged.length === 0 ? (
            <EmptyState>{t('history.no_events')}</EmptyState>
          ) : (
            paged.map(event => (
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

          {totalPages > 1 && (
            <div className="flex flex-wrap justify-between items-center gap-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                className="ui-btn ui-btn--secondary ui-btn--sm"
              >
                {t('history.prev')}
              </button>
              <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-faint)' }}>
                {t('history.page_of', { page: currentPage + 1, total: totalPages })}
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(Math.min(Math.max(0, totalPages - 1), currentPage + 1))}
                className="ui-btn ui-btn--secondary ui-btn--sm"
              >
                {t('history.next')}
              </button>
            </div>
          )}
        </ScrollFade>
      )}

      {/* ── MEDICATIONS TAB ── */}
      {activeTab === 'medications' && (
        <ScrollFade wrapperClassName="flex-1">
          <MedicationHistoryTab settings={settings} />
        </ScrollFade>
      )}

      {activeTab === 'wellbeing' && wellbeing && (
        <ScrollFade wrapperClassName="flex-1">
          <WellbeingTab events={allEvents} wellbeing={wellbeing} settings={settings} />
        </ScrollFade>
      )}

      {activeTab === 'eeg' && eeg && (
        <ScrollFade wrapperClassName="flex-1">
          <EEGDiaryTab
            activeSession={eeg.activeSession}
            getSessions={eeg.getSessions}
            getActivitiesForSession={eeg.getActivitiesForSession}
            onUpdateActivity={eeg.updateActivity}
            onDeleteActivity={eeg.deleteActivity}
            onEndSession={eeg.endSession}
          />
        </ScrollFade>
      )}

      {/* ── EXPORT TAB ── */}
      {activeTab === 'export' && (
        <ScrollFade wrapperClassName="flex-1">
          <ExportView settings={settings} eeg={eeg} onOpenBackup={onOpenBackup} />
        </ScrollFade>
      )}

    </div>
  );
}
