import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventTimer } from './hooks/useEventTimer';
import { useEventHistory } from './hooks/useEventHistory';
import { useTaggingWizard } from './hooks/useTaggingWizard';
import { useSettings } from './hooks/useSettings';
import { usePersistentStorage } from './hooks/usePersistentStorage';
import { setHapticEnabled } from './utils/hapticFeedback';
import { db } from './data/db';
import { DeleteModal } from './components/DeleteModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useWakeLock } from './hooks/useWakeLock';
import { useMedications } from './hooks/useMedications';
import { useNotifications } from './hooks/useNotifications';
import { useEegDiary } from './hooks/useEegDiary';
import { useWellbeing } from './hooks/useWellbeing';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import { getVisibleDosesForPanel } from './utils/medicationSchedule';
import { BackupReminderModal } from './components/BackupReminderModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { ManualEntrySheet } from './components/ManualEntrySheet';
import IdleView from './pages/IdleView';
import RecordingView from './pages/RecordingView';
import TaggingView from './pages/TaggingView';
import HistoryView from './pages/HistoryView';
import SettingsView from './pages/SettingsView';
import EventDetailView from './pages/EventDetailView';
import AboutView from './pages/AboutView';
import HelpView from './pages/HelpView';
import SyncModal from './components/SyncModal';
import { MedicationConflictDialog } from './components/MedicationConflictDialog';
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
          className="app-toolbar-btn app-header__nav-btn app-header__history gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          <HistoryIcon className="w-4 h-4 shrink-0" />
          {t('nav.history')}
        </button>
        <div className="app-header__actions">
          <button
            onClick={onSettings}
            className="app-toolbar-btn app-header__nav-btn app-header__settings gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            {t('nav.settings')}
          </button>
          <button
            onClick={onHelp}
            className="app-toolbar-btn app-header__help text-[12px] font-black active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            aria-label={t('nav.help_label')}
          >
            <HelpIcon className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('IDLE');
  const [previousStatus, setPreviousStatus] = useState('IDLE');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [detailEventId, setDetailEventId] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [todayLogs, setTodayLogs] = useState([]);
  const [allMedLogs, setAllMedLogs] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [syncModal, setSyncModal] = useState({ open: false, connectToken: null, offerSDP: null });
  const [historyInitialTab, setHistoryInitialTab] = useState('seizures');
  const [settingsInitialTab, setSettingsInitialTab] = useState('identity');

  const timer = useEventTimer();
  const {
    history: recentHistory,
    load: loadHistory,
    loadAll,
    deleteEvent,
  } = useEventHistory();
  const wizard = useTaggingWizard();
  const { settings, updateSettings, resetSettings, lastError: settingsError, clearLastError: clearSettingsError } = useSettings();
  const pwa = usePWAInstall();
  const wakeLock = useWakeLock();
  const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false);
  const meds = useMedications();
  const notifications = useNotifications();
  const eeg = useEegDiary();
  const wellbeing = useWellbeing(settings);
  const video = useVideoRecorder();
  const storagePersistence = usePersistentStorage();
  const stoppingRef = useRef(false);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  const refreshEvents = useCallback(async () => {
    await loadHistory();
    const allEvents = await loadAll();
    setFullHistory(allEvents);
    return allEvents;
  }, [loadAll, loadHistory]);

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

  // Crash recovery: resume timer if browser closed during recording
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_startTime');
	      if (localStorage.getItem('aura_status') === 'RECORDING' && saved) {
	        timer.restore(parseInt(saved, 10));
	        const id = setTimeout(() => setStatus('RECORDING'), 0);
	        return () => clearTimeout(id);
	      }
    } catch { /* private browsing — crash recovery unavailable */ }
  }, []);

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
          db.medicationLogs.toArray().then(setAllMedLogs).catch(() => showToast(t('toast.load_medication_history_failed')));
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
  }, [settingsError, clearSettingsError]);

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
    showToast(t('toast.encrypted_backup_saved'));
  }, [showToast, t, updateSettings]);

  useEffect(() => {
    if (settings.backupReminderEnabled === false) return;
    if (settings.lastSuccessfulBackupAt || settings.lastBackupReminderDismissedAt) return;
    if (!fullHistory.length && !meds.medications.length && !allMedLogs.length && !wellbeing.entries.length && !eeg.activeSession && !eeg.currentActivity) return;
    updateSettings('lastBackupReminderDismissedAt', Date.now()).catch(() => {});
  }, [
    allMedLogs.length,
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
    fullHistory.length || meds.medications.length || allMedLogs.length || wellbeing.entries.length || eeg.activeSession || eeg.currentActivity;
  const backupReminderBaseline = Math.max(settings.lastSuccessfulBackupAt || 0, settings.lastBackupReminderDismissedAt || 0);
  const shouldShowBackupReminder = Boolean(
    settings.backupReminderEnabled !== false &&
    status === 'IDLE' &&
    hasBackupEligibleData &&
    backupReminderBaseline &&
    nowMs - backupReminderBaseline >= (settings.backupReminderIntervalDays || 7) * 864e5
  );

  // Wake Lock: keep screen on during recording; show banner on unsupported browsers
	  useEffect(() => {
	    let resetTimer;
	    if (status === 'RECORDING') {
	      wakeLock.acquire().then(ok => {
	        if (!ok && !wakeLock.supported) setWakeLockUnsupported(true);
	      });
	    } else {
	      wakeLock.release();
	      resetTimer = setTimeout(() => setWakeLockUnsupported(false), 0);
	    }
	    return () => clearTimeout(resetTimer);
	  }, [status]);

  // Re-acquire wake lock when tab regains focus (OS releases it on tab switch)
  // Also re-schedule notifications on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        if (status === 'RECORDING') wakeLock.acquire();
        notifications.scheduleForToday(meds.medications, {
          enabled: settings.wellbeingDailyReminderEnabled,
          time: settings.wellbeingReminderTime,
          hasTodayEntry: wellbeing.todayEntries.length > 0,
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [status, meds.medications, settings.wellbeingDailyReminderEnabled, settings.wellbeingReminderTime, wellbeing.todayEntries.length]);

  // Schedule notifications whenever medication list changes
  useEffect(() => {
    notifications.scheduleForToday(meds.medications, {
      enabled: settings.wellbeingDailyReminderEnabled,
      time: settings.wellbeingReminderTime,
      hasTodayEntry: wellbeing.todayEntries.length > 0,
    });
  }, [meds.medications, settings.wellbeingDailyReminderEnabled, settings.wellbeingReminderTime, wellbeing.todayEntries.length]);

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

  const handleStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const savedVideo = video.isRecording ? await video.stop() : video.savedVideo;
      const ev = timer.stopTimer();
      if (!ev) return;
      const eventPayload = {
        uuid: crypto.randomUUID(),
        ...ev,
        type: 'Uncategorized',
        isComplete: false,
        editLog: [],
        userModeAtTime: settings.userMode,
        eegSessionId: eeg.activeSession?.id || null,
        eegSessionUuid: eeg.activeSession?.uuid || '',
        ...(savedVideo || { videoAttached: false }),
      };
      const id = await db.events.add(eventPayload);
      await eeg.addSeizureReference({ id, ...eventPayload });
      wizard.setActiveEvent(id);
      setStatus('TAGGING');
    } catch (err) {
      console.error('Failed to save event:', err);
      showToast(t('toast.save_event_failed'));
    } finally {
      stoppingRef.current = false;
    }
  };

  const handleEdit = (event) => { wizard.loadForEdit(event); timer.setForEdit(event.duration, event.laps, event.startTime); setStatus('TAGGING'); };

  const handleSave = async () => {
    try {
      const targetId = wizard.activeEventId;
      await wizard.handleFinalSave();
      if (targetId) {
        const event = await db.events.get(targetId);
        if (event?.eegSessionId) await eeg.addSeizureReference(event);
      }
      await refreshEvents();
      setStatus('IDLE');
    } catch (err) {
      console.error('Save failed:', err);
      showToast(t('toast.save_failed'));
    }
  };

  const handleSkipTagging = async () => {
    try {
      const targetId = wizard.activeEventId;
      await wizard.handleDeferredSave();
      if (targetId) {
        const event = await db.events.get(targetId);
        if (event?.eegSessionId) await eeg.addSeizureReference(event);
      }
      await refreshEvents();
      setStatus('IDLE');
    } catch (err) {
      console.error('Deferred save failed:', err);
      showToast(t('toast.save_failed'));
    }
  };

  const handleCancel = async () => {
    if (wizard.activeEventId && !wizard.editingId) {
      await db.events.delete(wizard.activeEventId).catch(() => {});
      await refreshEvents().catch(() => {});
    }
    video.reset();
    wizard.reset();
    setStatus('IDLE');
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

  const handleEmergencyStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const savedVideo = video.isRecording ? await video.stop() : video.savedVideo;
      const ev = timer.stopTimer();
      if (!ev) { setStatus('IDLE'); return; }
      const eventPayload = {
        uuid: crypto.randomUUID(),
        ...ev,
        type: 'Uncategorized',
        isComplete: true,
        editLog: [],
        userModeAtTime: settings.userMode,
        notes: 'PATIENT UNRESPONSIVE — all timers automatically stopped at 12 minutes.',
        isEmergencyStop: true,
        eegSessionId: eeg.activeSession?.id || null,
        eegSessionUuid: eeg.activeSession?.uuid || '',
        ...(savedVideo || { videoAttached: false }),
      };
      const id = await db.events.add(eventPayload);
      await eeg.addSeizureReference({ id, ...eventPayload });
      wizard.reset();
      await refreshEvents();
      setStatus('IDLE');
    } catch (err) {
      console.error('Emergency stop save failed:', err);
      showToast(t('toast.emergency_save_failed'));
      setStatus('IDLE');
    } finally {
      stoppingRef.current = false;
    }
  };

  const goToDetail = (id) => { setPreviousStatus(status); setDetailEventId(id); setStatus('EVENT_DETAIL'); };
  const goToHelp = () => { setPreviousStatus(status); setStatus('HELP'); };
  const goToAbout = () => { setPreviousStatus(status); setStatus('ABOUT'); };
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
      showToast(t('toast.doses_logged', { names: names.join(', ') }));
    } catch (err) {
      console.error('Failed to save dose logs:', err);
      showToast(t('toast.save_dose_logs_failed'));
    }
  };

  return (
    <div
      className="flex flex-col h-dvh w-full font-sans overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', paddingTop: 'env(safe-area-inset-top)' }}
      data-theme={settings.theme}
      data-accent={settings.accentColor}
      data-font-size={settings.fontSize}
    >
      {showHeader && <Header onHistory={() => setStatus('HISTORY')} onSettings={() => { setSettingsInitialTab('identity'); setStatus('SETTINGS'); }} onHelp={goToHelp} />}

      {status === 'RECORDING' && wakeLockUnsupported && (
        <div className="shrink-0 text-xs text-center px-4 py-2"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-on-raised-muted)', borderBottom: '1px solid var(--border)' }}>
          {t('toast.screen_may_sleep')}
        </div>
      )}

      <div
        data-scroll-region={status === 'RECORDING' ? 'recording' : 'app'}
        className={`flex-1 flex flex-col items-center px-3 pb-8 ${status === 'RECORDING' ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {status === 'IDLE'         && <IdleView history={recentHistory} fullHistory={fullHistory} onStart={handleStart} onManualEntry={() => setShowManualEntry(true)} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} medicationGroups={medicationGroups} allActiveMedications={allActiveMedications} onSaveDoses={handleSaveDoses} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} eegSession={eeg.activeSession} eegCurrentActivity={eeg.currentActivity} onStartEegSession={eeg.startSession} onEndEegSession={eeg.endSession} onStartEegActivity={eeg.startActivity} onStopEegActivity={eeg.stopActivity} onOpenEegDiary={() => { setHistoryInitialTab('eeg'); setStatus('HISTORY'); }} eegDiaryEnabled={settings.eegDiaryEnabled} wellbeing={wellbeing} wellbeingEnabled={settings.wellbeingEnabled} />}
        {status === 'RECORDING'    && <RecordingView elapsed={timer.elapsed} startTime={timer.startTime} laps={timer.laps} onLap={timer.recordLap} onStop={handleStop} onEmergencyStop={handleEmergencyStop} onQuickNote={l => wizard.addQuickNote(l, timer.elapsed)} userMode={settings.userMode} quickNoteLabels={activeQuickNoteLabels} emergencyMedications={emergencyMedications} neurologistName={settings.neurologistName} neurologistContact={settings.neurologistContact} emergencyContact={settings.emergencyContact} durationFormat={settings.durationFormat} onStartVideo={async () => { const result = await video.start({ seizureStartTime: timer.startTime, seizureStartLabel: timer.startTime ? new Date(timer.startTime).toLocaleString() : new Date().toLocaleString(), preferredFacingMode: settings.userMode === 'CARETAKER' ? 'environment' : 'user' }); if (!result?.ok) showToast(video.error || t('toast.video_start_failed')); }} onStopVideo={async () => { await video.stop(); }} onSwitchCamera={async () => { const result = await video.switchCamera(); if (!result?.ok && result?.reason !== 'single_camera') showToast(video.error || t('toast.video_switch_failed')); }} videoRecording={video.isRecording} videoSupported={video.isSupported} videoError={video.error} previewStream={video.previewStream} canSwitchCamera={video.canSwitchCamera} />}
        {status === 'TAGGING'      && <TaggingView {...wizard} elapsed={timer.elapsed} laps={timer.laps} startTime={timer.startTime} onSave={handleSave} onSkip={handleSkipTagging} onCancel={handleCancel} durationFormat={settings.durationFormat} />}
        {status === 'HISTORY'      && <HistoryView onBack={() => setStatus('IDLE')} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} historyPageSize={settings.historyPageSize} settings={settings} initialTab={historyInitialTab} eeg={eeg} wellbeing={wellbeing} events={fullHistory} onBackupSuccess={handleBackupSuccess} />}
        {status === 'SETTINGS'     && <SettingsView key={settingsInitialTab} settings={settings} onUpdate={updateSettings} onReset={resetSettings} onBack={() => setStatus('IDLE')} pwa={pwa} notificationPermission={notifications.permission} onRequestNotificationPermission={async () => { const p = await notifications.requestPermission(); if (p === 'granted') notifications.scheduleForToday(meds.medications, { enabled: settings.wellbeingDailyReminderEnabled, time: settings.wellbeingReminderTime, hasTodayEntry: wellbeing.todayEntries.length > 0 }); return p; }} onSync={() => setSyncModal({ open: true, connectToken: null, offerSDP: null })} initialTab={settingsInitialTab} storagePersistence={storagePersistence} onBackupSuccess={handleBackupSuccess} />}
        {status === 'EVENT_DETAIL' && <EventDetailView eventId={detailEventId} onEdit={handleEdit} onClose={() => setStatus(previousStatus)} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} />}
        {status === 'HELP'         && <HelpView onBack={() => setStatus('IDLE')} onAbout={goToAbout} />}
        {status === 'ABOUT'        && <AboutView onBack={() => setStatus(previousStatus)} />}
      </div>

      {itemToDelete && <DeleteModal onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />}
      {showManualEntry && <ManualEntrySheet onConfirm={handleManualCreate} onClose={() => setShowManualEntry(false)} />}
      <BackupReminderModal
        isOpen={shouldShowBackupReminder}
        overdueDays={settings.backupReminderIntervalDays || 7}
        onBackupNow={() => {
          setSettingsInitialTab('data');
          setStatus('SETTINGS');
        }}
        onSnooze={async () => {
          await updateSettings('lastBackupReminderDismissedAt', Date.now());
        }}
        onDisable={async () => {
          await updateSettings('backupReminderEnabled', false);
        }}
      />
      <SyncModal
        isOpen={syncModal.open}
        onClose={() => setSyncModal({ open: false, connectToken: null, offerSDP: null })}
        connectToken={syncModal.connectToken}
        offerSDP={syncModal.offerSDP}
        onBackupSuccess={handleBackupSuccess}
      />

      <MedicationConflictDialog />
      <PWAInstallBanner isVisible={pwa.isVisible} isIOS={pwa.isIOS} install={pwa.install} dismiss={pwa.dismiss} showManualInstructions={pwa.showManualInstructions} dismissManual={pwa.dismissManual} />
      {toastMsg && (
        <div
          className="fixed bottom-6 left-4 right-4 z-50 py-3 px-5 rounded-2xl text-sm font-bold text-center"
          style={{ backgroundColor: '#dc2626', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          {toastMsg}
        </div>
      )}
      {pwa.needRefresh && (
        <div
          className="fixed top-0 left-0 right-0 z-50 py-2 px-4 flex items-center justify-between text-xs font-bold"
          style={{ backgroundColor: 'var(--action-blue)', color: '#fff' }}
        >
          <span>App update available</span>
          <button onClick={() => pwa.updateServiceWorker()} className="underline">Reload</button>
        </div>
      )}
    </div>
  );
}

export default App;
