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
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
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
            <div className="flex gap-2 items-center">
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                <option value="">{t('history.all_types')}</option>
                {SEIZURE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <button
                onClick={() => { setCompletionFilter(f => f === 'needs_details' ? 'all' : 'needs_details'); setPage(0); }}
                className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shrink-0"
                style={{
                  backgroundColor: completionFilter === 'needs_details' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: completionFilter === 'needs_details' ? '#fff' : 'var(--text-on-raised)',
                  border: completionFilter === 'needs_details' ? '1px solid transparent' : '1px solid var(--border)',
                }}
              >
                {t('history.needs_details', 'Needs details')} {needsDetailsCount > 0 ? `(${needsDetailsCount})` : ''}
              </button>
              {(fromDate || toDate || completionFilter !== 'all') && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setCompletionFilter('all'); setPage(0); }}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shrink-0"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
                >
                  {t('history.clear')}
                </button>
              )}
            </div>
            <div className="flex gap-2 date-time-row">
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => { setFromDate(e.target.value); setPage(0); }}
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              />
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => { setToDate(e.target.value); setPage(0); }}
                className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              />
            </div>
          </div>

          {paged.length === 0 ? (
            <div className="border-2 border-dashed rounded-3xl py-8 text-center" style={{ borderColor: 'var(--border)' }}>
              <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>{t('history.no_events')}</p>
            </div>
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
            <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}
              >
                {t('history.prev')}
              </button>
              <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-faint)' }}>
                {t('history.page_of', { page: currentPage + 1, total: totalPages })}
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(p => Math.min(Math.max(0, totalPages - 1), p + 1))}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase disabled:opacity-30 transition-all"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)' }}
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
