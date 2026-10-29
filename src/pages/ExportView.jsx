import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { ScrollFade } from '../components/ScrollFade';
import { ExportCard } from '../components/ExportCard';
import { PrintPreviewOverlay } from '../components/PrintPreviewOverlay';
import { BackupTransferModal } from '../components/BackupTransferModal';
import { ActivityIcon, CalendarIcon, DownloadIcon, EyeIcon, FileStackIcon, ReportIcon, StethoscopeIcon, TableIcon, WarningIcon } from '../components/AppIcons';
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

export default function ExportView({ onBack, settings = {}, isEmbedded = false, eeg = null, onBackupSuccess = null }) {
  const { t } = useTranslation();
  const [printPreview, setPrintPreview] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [fromDate, setFromDate] = useState(
    () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const today = new Date().toISOString().slice(0, 10);
  const { medications, changes: medicationChanges, getLogsForPeriod } = useMedications();
  const changesInSelectedRange = () => {
    const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
    const toMs = new Date(toDate).setHours(23, 59, 59, 999);
    return medicationChanges.filter(change => change.effectiveAt >= fromMs && change.effectiveAt <= toMs);
  };
  const [diaryMonth, setDiaryMonth] = useState(
    () => new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
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
    const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
    const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    const wellbeingEntries = await getWellbeingEntriesForPeriod(fromMs, toMs);
    setPrintPreview(buildNeurologistReportPreview(events, settings, medications, medLogs, { fromDate, toDate, fromMs, toMs }, wellbeingEntries, medicationChanges));
  };

  const handleNeurologistReportPdf = async () => {
    const events = await getEvents();
    const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
    const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
    const medLogs = await getLogsForPeriod(fromMs, toMs);
    const wellbeingEntries = await getWellbeingEntriesForPeriod(fromMs, toMs);
    await exportNeurologistReportPDF(events, settings, medications, medLogs, { fromDate, toDate, fromMs, toMs }, wellbeingEntries, medicationChanges);
  };

  const ContentWrapper = isEmbedded ? 'div' : ScrollFade;
  const contentWrapperProps = isEmbedded
    ? { className: 'space-y-3' }
    : { className: 'space-y-3', wrapperClassName: 'flex-1' };

  return (
    <div className={isEmbedded ? 'w-full pb-10 space-y-0' : 'app-page-shell flex-1 flex flex-col w-full overflow-hidden mx-auto'}>
      {printPreview && (
        <PrintPreviewOverlay
          title={printPreview.title}
          styles={printPreview.styles}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}
      {showBackupModal && (
        <BackupTransferModal
          key="history-export-backup"
          isOpen
          mode="export"
          settings={settings}
          onClose={() => setShowBackupModal(false)}
          onExportSuccess={onBackupSuccess}
        />
      )}

      {/* Header — hidden when embedded in History tab */}
      {!isEmbedded && (
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('nav.back')}
          </button>
          <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('export.title')}
          </h2>
        </div>
      )}

      {/* Date Range Pickers */}
      <div className="mb-6 shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
          {t('export.date_range')}
        </p>
        <div className="date-selector-stack">
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.from')}</p>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.to')}</p>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={today}
              onChange={e => setToDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      <ContentWrapper {...contentWrapperProps}>

        {/* ── Raw Data Exports ── */}
        <p className="text-[9px] font-black uppercase tracking-[0.3em] px-1" style={{ color: 'var(--text-faint)' }}>
          {t('export.raw_data')}
        </p>

        <ExportCard
          label={t('export.backup_json_label')}
          description={t('export.backup_json_desc')}
          icon={<FileStackIcon className="w-5 h-5" />}
          actions={[{
            label: t('export.generate'),
            icon: <DownloadIcon className="w-4 h-4" />,
            onClick: async () => setShowBackupModal(true),
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
              const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
              const toMs   = new Date(toDate).setHours(23, 59, 59, 999);
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
          className="rounded-2xl px-5 py-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
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
          className="rounded-2xl p-6 space-y-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent)', boxShadow: `0 0 20px color-mix(in srgb, var(--accent) 15%, transparent)` }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff' }}
            >
              <StethoscopeIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
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
              className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-center active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
            >
              <EyeIcon className="w-4 h-4" />
              {t('export.open_preview')}
            </button>
            <button
              onClick={handleNeurologistReportPdf}
              className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-center active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
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
          className="rounded-2xl p-5 space-y-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: 'var(--bg-raised)' }}
            >
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('export.diary_label')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                {t('export.diary_desc')}
              </p>
            </div>
          </div>
          <div className="date-selector-stack">
            <div className="flex-1">
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>{t('export.month')}</p>
              <input
                type="month"
                value={diaryMonth}
                max={today.slice(0, 7)}
                onChange={e => setDiaryMonth(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="date-selector-actions">
              <button
                onClick={handleSeizureDiary}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
                style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
              >
                <EyeIcon className="w-4 h-4" />
                {t('export.open_preview')}
              </button>
              <button
                onClick={handleSeizureDiaryPdf}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95"
                style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
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

      </ContentWrapper>
    </div>
  );
}
