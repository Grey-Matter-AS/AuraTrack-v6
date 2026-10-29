import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from '../components/EventCard';
import { SEIZURE_TYPES } from '../data/constants';
import SeizureTrendChart from '../components/SeizureTrendChart';
import { buildDangerMap } from '../utils/dangerFlags';
import { Tabs } from '../components/Tabs';
import { MedicationHistoryTab } from '../components/MedicationHistoryTab';
import { EEGDiaryTab } from '../components/EEGDiaryTab';
import { WellbeingTab } from '../components/WellbeingTab';
import ExportView from './ExportView';
import { ScrollFade } from '../components/ScrollFade';
import { useMedications } from '../hooks/useMedications';
import { EmptyState } from '../components/ui';

export default function HistoryView({ onBack, onEdit, onDelete, onViewDetail, historyPageSize = 10, settings = {}, initialTab = 'seizures', eeg = null, wellbeing = null, events = [], onBackupSuccess = null }) {
  const { t } = useTranslation();
  const { changes: medicationChanges } = useMedications();
  const { durationFormat = 'seconds', dateFormat = 'locale', timeFormat = '12h' } = settings;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const HISTORY_TABS = [
    { id: 'seizures',    label: t('history.tab_seizures')    },
    { id: 'medications', label: t('history.tab_medications') },
    { id: 'wellbeing',   label: t('history.tab_wellbeing', 'Wellbeing') },
    { id: 'eeg',         label: t('history.tab_eeg', 'EEG Diary') },
    { id: 'export',      label: t('history.tab_export')      },
  ];

  const allEvents = events;

  const filtered = allEvents.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (completionFilter === 'needs_details' && e.isComplete) return false;
    if (fromDate || toDate) {
      const eventTs = e.startTime ?? NaN;
      if (fromDate && eventTs < new Date(fromDate).setHours(0, 0, 0, 0)) return false;
      if (toDate   && eventTs > new Date(toDate).setHours(23, 59, 59, 999)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / historyPageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = filtered.slice(currentPage * historyPageSize, (currentPage + 1) * historyPageSize);
  const needsDetailsCount = allEvents.filter(e => !e.isComplete).length;

  const dangerMap = useMemo(() => buildDangerMap(allEvents), [allEvents]);

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
        <Tabs tabs={HISTORY_TABS} activeTab={activeTab} onTabChange={tab => { setActiveTab(tab); setPage(0); }} />
      </div>

      {/* ── SEIZURES TAB ── */}
      {activeTab === 'seizures' && (
        <ScrollFade wrapperClassName="flex-1">
          <SeizureTrendChart allEvents={allEvents} medicationChanges={medicationChanges} />

          <div className="mb-4 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                className="ui-field flex-1 basis-40"
                aria-label={t('history.all_types')}
              >
                <option value="">{t('history.all_types')}</option>
                {SEIZURE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <button
                type="button"
                aria-pressed={completionFilter === 'needs_details'}
                onClick={() => { setCompletionFilter(f => f === 'needs_details' ? 'all' : 'needs_details'); setPage(0); }}
                className="ui-chip shrink-0"
              >
                {t('history.needs_details', 'Needs details')} {needsDetailsCount > 0 ? `(${needsDetailsCount})` : ''}
              </button>
              {(fromDate || toDate || completionFilter !== 'all') && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setCompletionFilter('all'); setPage(0); }}
                  className="ui-btn ui-btn--secondary ui-btn--sm shrink-0"
                >
                  {t('history.clear')}
                </button>
              )}
            </div>
            <div className="ui-row">
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => { setFromDate(e.target.value); setPage(0); }}
                aria-label={t('history.from_date', 'From')}
                className="ui-field"
              />
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => { setToDate(e.target.value); setPage(0); }}
                aria-label={t('history.to_date', 'To')}
                className="ui-field"
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
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="ui-btn ui-btn--secondary ui-btn--sm"
              >
                {t('history.prev')}
              </button>
              <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-faint)' }}>
                {t('history.page_of', { page: currentPage + 1, total: totalPages })}
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(p => Math.min(Math.max(0, totalPages - 1), p + 1))}
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
          <ExportView isEmbedded settings={settings} eeg={eeg} onBackupSuccess={onBackupSuccess} />
        </ScrollFade>
      )}

    </div>
  );
}
