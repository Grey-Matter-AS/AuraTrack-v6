import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { ExportCard } from '../components/ExportCard';
import { PrintPreviewOverlay } from '../components/PrintPreviewOverlay';
import { ActivityIcon, ArrowRightIcon, CalendarIcon, DownloadIcon, EyeIcon, FileStackIcon, ReportIcon, StethoscopeIcon, TableIcon, WarningIcon } from '../components/AppIcons';
import {
  exportToCSV,
  buildEventTablePreview,
  buildNeurologistReportPreview,
  buildSeizureDiaryPreview,
  buildEegDiaryPreview,
  exportEventLogPDF,
  exportNeurologistReportPDF,
  exportSeizureDiaryPDF,
  exportEegDiaryPDF,
  filterEventsByDateRange,
} from '../utils/exportHelpers';
import { useMedications } from '../hooks/useMedications';
import { DateInput } from '../components/ui';
import { addLocalDays, endOfLocalDay, localDateKey, localMonthKey, parseLocalDate } from '../utils/dates';

// Lives inside History → Export. Backups have one home (Settings → Data & Backup); this links there.
export default function ExportView({ settings = {}, eeg = null, onOpenBackup = null }) {
  const { t } = useTranslation();
  const [printPreview, setPrintPreview] = useState(null);
  const [fromDate, setFromDate] = useState(
    () => localDateKey(addLocalDays(Date.now(), -30))
  );
  const [toDate, setToDate] = useState(
    () => localDateKey()
  );
  const today = localDateKey();
  const { medications, changes: medicationChanges, getLogsForPeriod } = useMedications();
  const changesInSelectedRange = () => {
    const fromMs = parseLocalDate(fromDate).getTime();
    const toMs = endOfLocalDay(parseLocalDate(toDate));
    return medicationChanges.filter(change => change.effectiveAt >= fromMs && change.effectiveAt <= toMs);
  };
  const [diaryMonth, setDiaryMonth] = useState(
    () => localMonthKey()
  );

  const getEegBundle = async () => {
    const sessions = eeg ? await eeg.getSessions() : await db.eegSessions.orderBy('startTime').reverse().toArray();
    const session = sessions[0] || null;
    const activities = session
      ? (eeg ? await eeg.getActivitiesForSession(session.id) : (await db.eegActivities.where('sessionId').equals(session.id).sortBy('startTime')).reverse())
      : [];
    const allActivities = await db.eegActivities.orderBy('startTime').reverse().toArray();
    return { sessions, session, activities, allActivities };
  };

  const getEvents = async () => {
    const all = await db.events.orderBy('startTime').reverse().toArray();
    return filterEventsByDateRange(all, fromDate, toDate);
  };

  const getWellbeingEntriesForPeriod = async (fromMs, toMs) => (
    db.wellbeingEntries
      .where('recordedAt')
      .between(fromMs, toMs, true, true)
      .toArray()
      .catch(() => [])
  );

  const handleSimplePdfReport = async () => {
    const events = await getEvents();
    setPrintPreview(buildEventTablePreview(events, changesInSelectedRange()));
  };

  const handleSimplePdfDownload = async () => {
    const events = await getEvents();
    await exportEventLogPDF(events, changesInSelectedRange());
  };

  const handleSeizureDiary = async () => {
    const all = await db.events.orderBy('startTime').toArray();
    const [year, month] = diaryMonth.split('-').map(Number);
    setPrintPreview(buildSeizureDiaryPreview(all, settings, medications, month, year, medicationChanges));
  };

  const handleSeizureDiaryPdf = async () => {
    const all = await db.events.orderBy('startTime').toArray();
    const [year, month] = diaryMonth.split('-').map(Number);
    await exportSeizureDiaryPDF(all, settings, medications, month, year, medicationChanges);
  };

  const handleNeurologistReport = async () => {
    const events = await getEvents();
    const fromMs = parseLocalDate(fromDate).getTime();
    const toMs   = endOfLocalDay(parseLocalDate(toDate));
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    const wellbeingEntries = await getWellbeingEntriesForPeriod(fromMs, toMs);
    setPrintPreview(buildNeurologistReportPreview(events, settings, medications, medLogs, { fromDate, toDate, fromMs, toMs }, wellbeingEntries, medicationChanges));
  };

  const handleNeurologistReportPdf = async () => {
    const events = await getEvents();
    const fromMs = parseLocalDate(fromDate).getTime();
    const toMs   = endOfLocalDay(parseLocalDate(toDate));
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    const wellbeingEntries = await getWellbeingEntriesForPeriod(fromMs, toMs);
    await exportNeurologistReportPDF(events, settings, medications, medLogs, { fromDate, toDate, fromMs, toMs }, wellbeingEntries, medicationChanges);
  };

  return (
    <div className="w-full pb-10 space-y-0">
      {printPreview && (
        <PrintPreviewOverlay
          title={printPreview.title}
          styles={printPreview.styles}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}

      {/* Date Range Pickers */}
      <div className="mb-6 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
          {t('export.date_range')}
        </p>
        <div className="ui-row">
          <DateInput label={t('export.from')} value={fromDate} max={toDate} onChange={setFromDate} />
          <DateInput label={t('export.to')} value={toDate} min={fromDate} max={today} onChange={setToDate} />
        </div>
      </div>

      <div className="space-y-3">

        {/* ── Raw Data Exports ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1" style={{ color: 'var(--text-faint)' }}>
          {t('export.raw_data')}
        </p>

        <ExportCard
          label={t('export.backup_json_label')}
          description={t('export.backup_json_desc')}
          icon={<FileStackIcon className="w-5 h-5" />}
          actions={[{
            label: t('export.go_to_backup'),
            icon: <ArrowRightIcon className="w-4 h-4" />,
            onClick: async () => onOpenBackup?.(),
          }]}
        />
        <ExportCard
          label={t('export.csv_label')}
          description={t('export.csv_desc')}
          icon={<TableIcon className="w-5 h-5" />}
          actions={[{
            label: t('export.generate'),
            icon: <DownloadIcon className="w-4 h-4" />,
            onClick: async () => {
              const events = await getEvents();
              const fromMs = parseLocalDate(fromDate).getTime();
              const toMs   = endOfLocalDay(parseLocalDate(toDate));
              const logs   = await getLogsForPeriod(fromMs, toMs);
              const eegBundle = await getEegBundle();
              const wellbeingEntries = await getWellbeingEntriesForPeriod(fromMs, toMs);
              await exportToCSV(events, medications, logs, eegBundle.sessions, eegBundle.allActivities, wellbeingEntries, changesInSelectedRange());
            },
          }]}
        />
        <ExportCard
          label={t('export.pdf_label')}
          description={t('export.pdf_desc')}
          icon={<ReportIcon className="w-5 h-5" />}
          actions={[
            { label: t('export.open_preview'), icon: <EyeIcon className="w-4 h-4" />, onClick: handleSimplePdfReport, variant: 'secondary' },
            { label: t('export.download_pdf'), icon: <DownloadIcon className="w-4 h-4" />, onClick: handleSimplePdfDownload },
          ]}
        />

        <div
          className="ui-card"
        >
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-dim)' }}>
            {t('export.privacy_notice_title')}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('export.privacy_notice_body')}
          </p>
        </div>

        {/* ── Clinical Report ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          {t('export.clinical_report')}
        </p>

        <div
          className="ui-card ui-card--accent !p-5 space-y-3"
        >
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff' }}
            >
              <StethoscopeIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 basis-48">
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('export.neuro_report_label')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {t('export.neuro_report_desc')}
              </p>
	              {!settings.personName && (
	                <p className="app-status-badge app-status-badge--warning mt-2">
	                  <WarningIcon className="w-3.5 h-3.5" />
	                  {String(t('export.neuro_report_warning')).replace(/^[^\p{Letter}\p{Number}]+/u, '').trim()}
	                </p>
	              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleNeurologistReport}
              className="ui-btn ui-btn--primary ui-btn--md flex-1 min-w-[150px]"
            >
              <EyeIcon className="w-4 h-4" />
              {t('export.open_preview')}
            </button>
            <button
              onClick={handleNeurologistReportPdf}
              className="ui-btn ui-btn--primary ui-btn--md flex-1 min-w-[150px]"
            >
              <DownloadIcon className="w-4 h-4" />
              {t('export.download_pdf')}
            </button>
          </div>
        </div>

        {/* ── Seizure Diary ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          {t('export.diary_title')}
        </p>

        <div
          className="ui-card !p-5 space-y-3"
        >
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'var(--bg-raised)' }}
            >
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 basis-48">
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('export.diary_label')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {t('export.diary_desc')}
              </p>
            </div>
          </div>
          <div className="ui-row">
            <DateInput type="month" label={t('export.month')} value={diaryMonth} max={today.slice(0, 7)} onChange={setDiaryMonth} />
            <div className="date-selector-actions">
              <button
                onClick={handleSeizureDiary}
                className="ui-btn ui-btn--primary ui-btn--sm"
              >
                <EyeIcon className="w-4 h-4" />
                {t('export.open_preview')}
              </button>
              <button
                onClick={handleSeizureDiaryPdf}
                className="ui-btn ui-btn--primary ui-btn--sm"
              >
                <DownloadIcon className="w-4 h-4" />
                {t('export.download_pdf')}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1 pt-3" style={{ color: 'var(--text-faint)' }}>
          {t('export.eeg_title', 'EEG Diary')}
        </p>

        <ExportCard
          label={t('export.eeg_label', 'EEG Clinical Table')}
          description={t('export.eeg_desc', 'Export the most recent EEG session as a table-first clinical PDF.')}
          icon={<ActivityIcon className="w-5 h-5" />}
          actions={[
            {
              label: t('export.open_preview'),
              icon: <EyeIcon className="w-4 h-4" />,
              variant: 'secondary',
              onClick: async () => {
                const eegBundle = await getEegBundle();
                if (!eegBundle.session) return;
                setPrintPreview(buildEegDiaryPreview(eegBundle.session, eegBundle.activities));
              },
            },
            {
              label: t('export.download_pdf'),
              icon: <DownloadIcon className="w-4 h-4" />,
              onClick: async () => {
                const eegBundle = await getEegBundle();
                if (!eegBundle.session) return;
                await exportEegDiaryPDF(eegBundle.session, eegBundle.activities);
              },
            },
          ]}
        />

      </div>
    </div>
  );
}
