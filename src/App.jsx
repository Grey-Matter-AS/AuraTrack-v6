import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventTimer } from './hooks/useEventTimer';
import { useEventHistory } from './hooks/useEventHistory';
import { useTaggingWizard } from './hooks/useTaggingWizard';
import { useSettings } from './hooks/useSettings';
import { useNavigation } from './hooks/useNavigation';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import { setHapticEnabled } from './utils/hapticFeedback';
import { db } from './data/db';
import { deleteEvent as deleteEventRecord } from './data/records';
import { DeleteModal } from './components/DeleteModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useWakeLock } from './hooks/useWakeLock';
import { MedicationsContext, useMedicationsStore } from './hooks/useMedications';
import { useNotifications } from './hooks/useNotifications';
import { useEegDiary } from './hooks/useEegDiary';
import { useWellbeing } from './hooks/useWellbeing';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import { getVisibleDosesForPanel } from './utils/medicationSchedule';
import { emergencyPlan } from './utils/dangerFlags';
import { DATA_CHANGED_EVENT } from './utils/dataEvents';
import { BackupReminderModal } from './components/BackupReminderModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { ManualEntrySheet } from './components/ManualEntrySheet';
import IdleView from './pages/IdleView';
import RecordingView from './pages/RecordingView';
import TaggingView from './pages/TaggingView';
import SettingsView from './pages/SettingsView';
import EventDetailView from './pages/EventDetailView';
import AboutView from './pages/AboutView';
import HelpView from './pages/HelpView';
import { MedicationConflictDialog } from './components/MedicationConflictDialog';
import { Button, ToastProvider } from './components/ui';
import { HelpIcon, HistoryIcon, SettingsIcon } from './components/AppIcons';

function Header({ onSettings, onHistory, onHelp }) {
  const { t } = useTranslation();
  return (
    <div className="app-header app-width-shell pt-4 pb-3 shrink-0">
      <div className="app-header__brand text-center">
        <h1 className="app-header__brand-title text-[10px] font-black tracking-[0.4em] uppercase">AURATRACK</h1>
        <div className="h-1 w-4 bg-[var(--accent)] mx-auto mt-1 rounded-full opacity-60" />
      </div>
      <div className="app-header__nav">
        <button
          onClick={onHistory}
          className="ui-btn ui-btn--secondary ui-btn--sm app-header__nav-btn app-header__history"
        >
          <HistoryIcon className="w-4 h-4 shrink-0" />
          <span className="app-header__label">{t('nav.history')}</span>
        </button>
        <div className="app-header__actions">
          <button
            onClick={onSettings}
            className="ui-btn ui-btn--secondary ui-btn--sm app-header__nav-btn app-header__settings"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span className="app-header__label">{t('nav.settings')}</span>
          </button>
          <button
            onClick={onHelp}
            className="ui-btn ui-btn--secondary ui-btn--sm app-header__help"
            aria-label={t('nav.help_label')}
          >
            <HelpIcon className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Loaded on first use (charts, PDF reports, peer-to-peer sync and QR codes are large and rarely needed
// at launch). The service worker still caches them, so they work offline.
const HistoryView = lazy(() => import('./pages/HistoryView'));
const SyncModal = lazy(() => import('./components/SyncModal'));

function ScreenLoading() {
  return <div className="flex-1 w-full" aria-busy="true" />;
}

function App() {
  const { t } = useTranslation();
  const nav = useNavigation();
  const status = nav.status;
  // Recording and tagging a new seizure replace the screen stack (nothing to go back to)
  const setStatus = nav.reset;
  const [itemToDelete, setItemToDelete] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);
  const toastApi = useRef(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [medLogCount, setMedLogCount] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [syncModal, setSyncModal] = useState({ open: false, connectToken: null, offerSDP: null });

  const timer = useEventTimer();
  const {
    history: recentHistory,
    load: loadHistory,
    loadAll,
    deleteEvent,
  } = useEventHistory();
  const wizard = useTaggingWizard();
  const { settings, updateSettings, resetSettings, lastError: settingsError, clearLastError: clearSettingsError } = useSettings();
  const { emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes } = settings;
  const plan = useMemo(
    () => emergencyPlan({ emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes }),
    [emergencyAlertMinutes, clusterMinCount, clusterWindowMinutes]
  );
  const pwa = usePWAInstall();
  const wakeLock = useWakeLock();
  const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false);
  const meds = useMedicationsStore();
  const notifications = useNotifications();
  const eeg = useEegDiary();
  const wellbeing = useWellbeing(settings);
  const video = useVideoRecorder();
  const storagePersistence = usePersistentStorage();
  const stoppingRef = useRef(false);

  // Most App messages are failures; success messages pass tone 'success'
  const showToast = useCallback((msg, tone = 'error') => {
    toastApi.current?.(msg, tone, 5000);
  }, []);

  const refreshEvents = useCallback(async () => {
    await loadHistory();
    const allEvents = await loadAll();
    setFullHistory(allEvents);
    return allEvents;
  }, [loadAll, loadHistory]);

  // A tapped reminder brings the app to the front: show home (today's doses, wellbeing check-in),
  // unless a seizure is being recorded or tagged
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (event) => {
      if (event.data?.type !== 'auratrack-notification-open') return;
      if (!['RECORDING', 'TAGGING'].includes(nav.status)) nav.reset('IDLE');
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener('message', onMessage);
  }, [nav]);

  // A sync or restore changed stored data: reload what the home screen and History show
  const { load: loadWellbeing } = wellbeing;
  useEffect(() => {
    const reload = () => {
      refreshEvents().catch(() => {});
      loadWellbeing().catch(() => {});
      db.medicationLogs.count().then(setMedLogCount).catch(() => {});
    };
    window.addEventListener(DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reload);
  }, [refreshEvents, loadWellbeing]);

  // Sync haptic preference to the module singleton
  useEffect(() => { setHapticEnabled(settings.hapticFeedback); }, [settings.hapticFeedback]);

  // Detect URL hash for QR-based sync (opened by scanning a QR code on another device)
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash;
      const syncMatch = hash.match(/^#sync=(.+)/);
      const offerMatch = hash.match(/^#sdp=(.+)/);
      const answerMatch = hash.match(/^#sdp-answer=(.+)/);
      if (syncMatch || offerMatch || answerMatch) {
        window.history.replaceState(null, '', window.location.pathname);
        setSyncModal({
          open: true,
          connectToken: syncMatch?.[1] ?? null,
          offerSDP: offerMatch?.[1] ?? null,
        });
      }
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Crash recovery: resume the recording (start time, phase taps, quick notes) if the app was closed.
  // The functions used are stable, so this runs once on launch.
  const { restore: restoreTimer } = timer;
  const { setNotes: setWizardNotes } = wizard;
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_startTime');
      if (localStorage.getItem('aura_status') === 'RECORDING' && saved) {
        restoreTimer(parseInt(saved, 10));
        const savedNotes = localStorage.getItem('aura_notes');
        if (savedNotes) setWizardNotes(savedNotes);
        const id = setTimeout(() => setStatus('RECORDING'), 0);
        return () => clearTimeout(id);
      }
    } catch { /* private browsing — crash recovery unavailable */ }
  }, [restoreTimer, setWizardNotes, setStatus]);

  useEffect(() => {
    if (status === 'IDLE') {
      loadHistory().catch((err) => console.error('Failed to refresh history:', err));
      loadAll().then(setFullHistory).catch((err) => console.error('Failed to refresh full history:', err));
      meds.load().catch(() => showToast(t('toast.load_medications_failed')));
      // Fill in missed/assumed doses first so today's list and history include them
      meds.markMissedDoses()
        .catch(() => showToast(t('toast.record_missed_doses_failed')))
        .then(() => {
          meds.getLogsForDay(Date.now()).then(setTodayLogs).catch(() => showToast(t('toast.load_today_doses_failed')));
          // Only the number is needed (backup reminder): count, don't load every dose ever logged
          db.medicationLogs.count().then(setMedLogCount).catch(() => showToast(t('toast.load_medication_history_failed')));
        });
      wellbeing.load().catch(() => showToast(t('toast.load_wellbeing_failed')));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, loadHistory, loadAll, t]);

  useEffect(() => {
    if (!settingsError) return;
    const id = setTimeout(() => {
      showToast(settingsError.message);
      clearSettingsError();
    }, 0);
    return () => clearTimeout(id);
  }, [settingsError, clearSettingsError, showToast]);

  useEffect(() => {
    if (!meds.lastError) return;
    const id = setTimeout(() => {
      showToast(meds.lastError.message);
      meds.clearLastError();
    }, 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds.lastError]);

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  const handleBackupSuccess = useCallback(async () => {
    await updateSettings('lastSuccessfulBackupAt', Date.now());
    await updateSettings('lastBackupReminderDismissedAt', 0);
    showToast(t('toast.encrypted_backup_saved'), 'success');
  }, [showToast, t, updateSettings]);

  useEffect(() => {
    if (settings.backupReminderEnabled === false) return;
    if (settings.lastSuccessfulBackupAt || settings.lastBackupReminderDismissedAt) return;
    if (!fullHistory.length && !meds.medications.length && !medLogCount && !wellbeing.entries.length && !eeg.activeSession && !eeg.currentActivity) return;
    updateSettings('lastBackupReminderDismissedAt', Date.now()).catch(() => {});
  }, [
    medLogCount,
    eeg.activeSession,
    eeg.currentActivity,
    fullHistory.length,
    meds.medications.length,
    wellbeing.entries.length,
    settings.backupReminderEnabled,
    settings.lastBackupReminderDismissedAt,
    settings.lastSuccessfulBackupAt,
    updateSettings,
  ]);

  const hasBackupEligibleData =
    fullHistory.length || meds.medications.length || medLogCount || wellbeing.entries.length || eeg.activeSession || eeg.currentActivity;
  const backupReminderBaseline = Math.max(settings.lastSuccessfulBackupAt || 0, settings.lastBackupReminderDismissedAt || 0);
  const shouldShowBackupReminder = Boolean(
    settings.backupReminderEnabled !== false &&
    status === 'IDLE' &&
    hasBackupEligibleData &&
    backupReminderBaseline &&
    nowMs - backupReminderBaseline >= (settings.backupReminderIntervalDays || 7) * 864e5
  );

  // Wake Lock: keep screen on during recording; show banner on unsupported browsers
  const { acquire: acquireWakeLock, release: releaseWakeLock, supported: wakeLockSupported } = wakeLock;
  const { scheduleForToday } = notifications;
  useEffect(() => {
    let resetTimer;
    if (status === 'RECORDING') {
      acquireWakeLock()
        .then(ok => { if (!ok && !wakeLockSupported) setWakeLockUnsupported(true); })
        .catch(() => { if (!wakeLockSupported) setWakeLockUnsupported(true); });
    } else {
      releaseWakeLock();
      resetTimer = setTimeout(() => setWakeLockUnsupported(false), 0);
    }
    return () => clearTimeout(resetTimer);
  }, [status, acquireWakeLock, releaseWakeLock, wakeLockSupported]);

  // Re-acquire wake lock when tab regains focus (OS releases it on tab switch)
  // Also re-schedule notifications on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        if (status === 'RECORDING') acquireWakeLock().catch(() => {});
        scheduleForToday(meds.medications, {
          enabled: settings.wellbeingDailyReminderEnabled,
          time: settings.wellbeingReminderTime,
          hasTodayEntry: wellbeing.todayEntries.length > 0,
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [status, meds.medications, settings.wellbeingDailyReminderEnabled, settings.wellbeingReminderTime, wellbeing.todayEntries.length, acquireWakeLock, scheduleForToday]);

  // Schedule notifications whenever medication list changes
  useEffect(() => {
    scheduleForToday(meds.medications, {
      enabled: settings.wellbeingDailyReminderEnabled,
      time: settings.wellbeingReminderTime,
      hasTodayEntry: wellbeing.todayEntries.length > 0,
    });
  }, [meds.medications, settings.wellbeingDailyReminderEnabled, settings.wellbeingReminderTime, wellbeing.todayEntries.length, scheduleForToday]);

  const handleStart = async () => {
    wizard.reset();
    video.reset();
    const seizureStartTime = timer.startTimer();
    await eeg.stopForSeizureStart(seizureStartTime);
    setStatus('RECORDING');
  };

  const handleManualCreate = async ({ date, time, durationSec, manualDurations }) => {
    try {
      const startTime = new Date(`${date}T${time}`).getTime();
      const id = await db.events.add({
        uuid: crypto.randomUUID(),
        startTime,
        date: new Date(startTime).toLocaleDateString(),
        time: new Date(startTime).toLocaleTimeString(),
        duration: durationSec,
        manualDurations: manualDurations ?? {},
        laps: {},
        type: 'Uncategorized',
        isComplete: false,
        editLog: [],
        userModeAtTime: settings.userMode,
        isManualEntry: true,
        eegSessionId: eeg.activeSession?.id || null,
        eegSessionUuid: eeg.activeSession?.uuid || '',
      });
      wizard.loadForManualEntry(id, manualDurations, { date, time });
      await refreshEvents();
      setShowManualEntry(false);
      setStatus('TAGGING');
    } catch (err) {
      console.error('Failed to create manual entry:', err);
      showToast(t('toast.create_entry_failed'));
    }
  };

  // Ends a recording and saves it. A normal stop goes on to tagging; the 12-minute emergency stop
  // (status epilepticus) saves the seizure as it is, with the stop note before any quick notes.
  const stopRecording = async ({ emergency = false } = {}) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const savedVideo = video.isRecording ? await video.stop() : video.savedVideo;
      const ev = timer.stopTimer();
      if (!ev) { if (emergency) setStatus('IDLE'); return; }
      const eventPayload = {
        uuid: crypto.randomUUID(),
        ...ev,
        type: 'Uncategorized',
        isComplete: emergency,
        editLog: [],
        userModeAtTime: settings.userMode,
        ...(emergency ? {
          notes: [t('recording.auto_stop_note'), wizard.notes].filter(Boolean).join('\n'),
          isEmergencyStop: true,
        } : {}),
        eegSessionId: eeg.activeSession?.id || null,
        eegSessionUuid: eeg.activeSession?.uuid || '',
        ...(savedVideo || { videoAttached: false }),
      };
      const id = await db.events.add(eventPayload);
      await eeg.addSeizureReference({ id, ...eventPayload });
      if (emergency) {
        wizard.reset();
        await refreshEvents();
        setStatus('IDLE');
      } else {
        wizard.setActiveEvent(id);
        setStatus('TAGGING');
      }
    } catch (err) {
      console.error(emergency ? 'Emergency stop save failed:' : 'Failed to save event:', err);
      showToast(t(emergency ? 'toast.emergency_save_failed' : 'toast.save_event_failed'));
      if (emergency) setStatus('IDLE');
    } finally {
      stoppingRef.current = false;
    }
  };
  const handleStop = () => stopRecording();
  const handleEmergencyStop = () => stopRecording({ emergency: true });

  // Editing opens on top of where it started (detail or History) and returns there afterwards
  const handleEdit = (event) => { wizard.loadForEdit(event); timer.setForEdit(event.duration, event.laps, event.startTime); nav.navigate('TAGGING'); };
  const finishTagging = (wasEditing) => (wasEditing ? nav.goBack() : setStatus('IDLE'));

  const handleSave = async () => {
    try {
      const targetId = wizard.activeEventId;
      const wasEditing = Boolean(wizard.editingId);
      await wizard.handleFinalSave();
      if (targetId) {
        const event = await db.events.get(targetId);
        if (event?.eegSessionId) await eeg.addSeizureReference(event);
      }
      await refreshEvents();
      finishTagging(wasEditing);
    } catch (err) {
      console.error('Save failed:', err);
      showToast(t('toast.save_failed'));
    }
  };

  const handleSkipTagging = async () => {
    try {
      const targetId = wizard.activeEventId;
      const wasEditing = Boolean(wizard.editingId);
      await wizard.handleDeferredSave();
      if (targetId) {
        const event = await db.events.get(targetId);
        if (event?.eegSessionId) await eeg.addSeizureReference(event);
      }
      await refreshEvents();
      finishTagging(wasEditing);
    } catch (err) {
      console.error('Deferred save failed:', err);
      showToast(t('toast.save_failed'));
    }
  };

  const handleCancel = async () => {
    const wasEditing = Boolean(wizard.editingId);
    if (wizard.activeEventId && !wasEditing) {
      try {
        await deleteEventRecord(wizard.activeEventId);
        await refreshEvents();
      } catch (err) {
        console.error('Discarding the recording failed:', err);
        showToast(t('toast.delete_failed'));
      }
    }
    video.reset();
    wizard.reset();
    finishTagging(wasEditing);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteEvent(itemToDelete);
      await refreshEvents();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast(t('toast.delete_failed'));
    } finally {
      setItemToDelete(null);
    }
  };


  const goToDetail = (id) => nav.navigate('EVENT_DETAIL', { eventId: id });
  const goToAbout = () => nav.navigate('ABOUT');
  const showHeader = !['RECORDING', 'TAGGING'].includes(status);

  // Active quick note labels (filter empties)
  const activeQuickNoteLabels = (settings.quickNoteLabels || []).filter(l => l.trim());

  // Medication derivations
  const activeMedications = meds.medications.filter(m => m.active && !m.isRescue);
  const allActiveMedications = meds.medications.filter(m => m.active);
  const emergencyMedications = meds.medications.filter(m => m.active && m.showInEmergency);
  const medicationGroups = getVisibleDosesForPanel(activeMedications, todayLogs);

  const handleSaveDoses = async (doses) => {
    try {
      const now = Date.now();
      for (const { medicationId, scheduledHHMM, note } of doses) {
        await meds.logDoseWithStatus(medicationId, scheduledHHMM ?? null, now, 'taken', note);
      }
      const logs = await meds.getLogsForDay(Date.now());
      setTodayLogs(logs);
      const names = doses.map(d => {
        const med = meds.medications.find(m => m.id === d.medicationId);
        return med ? med.name : '';
      }).filter(Boolean);
      showToast(t('toast.doses_logged', { names: names.join(', ') }), 'success');
    } catch (err) {
      console.error('Failed to save dose logs:', err);
      showToast(t('toast.save_dose_logs_failed'));
    }
  };

  return (
    <div
      className="flex flex-col h-dvh w-full font-sans overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      data-theme={settings.theme}
      data-accent={settings.accentColor}
      data-font-size={settings.fontSize}
    >
      {/* Inside the themed root so toasts pick up theme and accent */}
      <MedicationsContext.Provider value={meds}>
      <ToastProvider apiRef={toastApi}>
      {/* Never offered during a recording or tagging: reloading would lose what is being recorded */}
      {pwa.needRefresh && showHeader && (
        <div className="ui-update-bar" role="status">
          <span>{t('app.update_available')}</span>
          <Button variant="secondary" size="sm" onClick={() => pwa.updateServiceWorker()}>{t('app.update_reload')}</Button>
        </div>
      )}
      {showHeader && <Header onHistory={() => nav.openFromHome('HISTORY')} onSettings={() => nav.openFromHome('SETTINGS')} onHelp={() => nav.openFromHome('HELP')} />}

      {status === 'RECORDING' && wakeLockUnsupported && (
        <div className="shrink-0 text-xs text-center px-4 py-2"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-on-raised-muted)', borderBottom: '1px solid var(--border)' }}>
          {t('toast.screen_may_sleep')}
        </div>
      )}

      <div
        data-scroll-region={status === 'RECORDING' ? 'recording' : 'app'}
        className={`flex-1 min-h-0 flex flex-col items-center px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] ${status === 'RECORDING' ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {status === 'IDLE'         && <IdleView plan={plan} history={recentHistory} fullHistory={fullHistory} onStart={handleStart} onManualEntry={() => setShowManualEntry(true)} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} medicationGroups={medicationGroups} allActiveMedications={allActiveMedications} onSaveDoses={handleSaveDoses} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} eegSession={eeg.activeSession} eegCurrentActivity={eeg.currentActivity} onStartEegSession={eeg.startSession} onEndEegSession={eeg.endSession} onStartEegActivity={eeg.startActivity} onStopEegActivity={eeg.stopActivity} onOpenEegDiary={() => nav.navigate('HISTORY', { tab: 'eeg' })} eegDiaryEnabled={settings.eegDiaryEnabled} wellbeing={wellbeing} wellbeingEnabled={settings.wellbeingEnabled} />}
        {status === 'RECORDING'    && <RecordingView elapsed={timer.elapsed} startTime={timer.startTime} laps={timer.laps} onLap={timer.recordLap} onStop={handleStop} onEmergencyStop={handleEmergencyStop} onQuickNote={l => wizard.addQuickNote(l, timer.elapsed)} userMode={settings.userMode} quickNoteLabels={activeQuickNoteLabels} emergencyMedications={emergencyMedications} neurologistName={settings.neurologistName} neurologistContact={settings.neurologistContact} emergencyContact={settings.emergencyContact} durationFormat={settings.durationFormat} plan={plan} onStartVideo={async () => { const result = await video.start({ seizureStartTime: timer.startTime, seizureStartLabel: timer.startTime ? new Date(timer.startTime).toLocaleString() : new Date().toLocaleString(), preferredFacingMode: settings.userMode === 'CARETAKER' ? 'environment' : 'user' }); if (!result?.ok) showToast(video.error || t('toast.video_start_failed')); }} onStopVideo={async () => { await video.stop(); }} onSwitchCamera={async () => { const result = await video.switchCamera(); if (!result?.ok && result?.reason !== 'single_camera') showToast(video.error || t('toast.video_switch_failed')); }} videoRecording={video.isRecording} videoSupported={video.isSupported} videoError={video.error} previewStream={video.previewStream} canSwitchCamera={video.canSwitchCamera} />}
        {status === 'TAGGING'      && <TaggingView {...wizard} savedSets={settings.favoriteSymptomSets} customSymptoms={settings.customSymptoms} history={fullHistory} onUpdateSetting={updateSettings} elapsed={timer.elapsed} laps={timer.laps} startTime={timer.startTime} onSave={handleSave} onSkip={handleSkipTagging} onCancel={handleCancel} durationFormat={settings.durationFormat} />}
        {status === 'HISTORY'      && <Suspense fallback={<ScreenLoading />}><HistoryView onBack={nav.goBack} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} historyPageSize={settings.historyPageSize} settings={settings} viewState={nav.current} onViewStateChange={nav.updateCurrent} eeg={eeg} wellbeing={wellbeing} events={fullHistory} onOpenBackup={() => nav.navigate('SETTINGS', { tab: 'data' })} /></Suspense>}
        {status === 'SETTINGS'     && <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onBack={nav.goBack} tab={nav.current.tab || 'identity'} onTabChange={tab => nav.updateCurrent({ tab })} pwa={pwa} notificationPermission={notifications.permission} onRequestNotificationPermission={async () => { const p = await notifications.requestPermission(); if (p === 'granted') notifications.scheduleForToday(meds.medications, { enabled: settings.wellbeingDailyReminderEnabled, time: settings.wellbeingReminderTime, hasTodayEntry: wellbeing.todayEntries.length > 0 }); return p; }} onSync={() => setSyncModal({ open: true, connectToken: null, offerSDP: null })} storagePersistence={storagePersistence} onBackupSuccess={handleBackupSuccess} />}
        {status === 'EVENT_DETAIL' && <EventDetailView eventId={nav.current.eventId} plan={plan} onEdit={handleEdit} onClose={nav.goBack} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} />}
        {status === 'HELP'         && <HelpView onBack={nav.goBack} onAbout={goToAbout} />}
        {status === 'ABOUT'        && <AboutView onBack={nav.goBack} />}
      </div>

      {/* In the layout flow (not floating), so it takes its own space and never covers content */}
      {pwa.isVisible && (
        <div className="shrink-0 w-full app-width-shell mx-auto px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          <PWAInstallBanner isVisible={pwa.isVisible} isIOS={pwa.isIOS} install={pwa.install} dismiss={pwa.dismiss} showManualInstructions={pwa.showManualInstructions} dismissManual={pwa.dismissManual} />
        </div>
      )}

      {itemToDelete && <DeleteModal onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />}
      {showManualEntry && <ManualEntrySheet onConfirm={handleManualCreate} onClose={() => setShowManualEntry(false)} />}
      <BackupReminderModal
        isOpen={shouldShowBackupReminder}
        overdueDays={settings.backupReminderIntervalDays || 7}
        onBackupNow={() => nav.openFromHome('SETTINGS', { tab: 'data' })}
        onSnooze={async () => {
          await updateSettings('lastBackupReminderDismissedAt', Date.now());
        }}
        onDisable={async () => {
          await updateSettings('backupReminderEnabled', false);
        }}
      />
      {syncModal.open && (
        <Suspense fallback={null}>
          <SyncModal
            isOpen
            onClose={() => setSyncModal({ open: false, connectToken: null, offerSDP: null })}
            connectToken={syncModal.connectToken}
            offerSDP={syncModal.offerSDP}
          />
        </Suspense>
      )}

      <MedicationConflictDialog />
      </ToastProvider>
      </MedicationsContext.Provider>
    </div>
  );
}

export default App;
