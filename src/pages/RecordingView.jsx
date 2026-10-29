import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatters';
import { CheckIcon, CloseIcon, WarningIcon } from '../components/AppIcons';
import { Button } from '../components/ui';

const ALERT_THRESHOLD = 300;  // 5 minutes
const AUTO_STOP_AT    = 720;  // 12 minutes
const stripTrailingCheck = (text) => String(text || '').replace(/\s*\u2713\s*$/u, '');

function RedAlert({ elapsed, onClose, emergencyMedications = [], neurologistName, neurologistContact, emergencyContact }) {
  const { t } = useTranslation();
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 flex flex-col items-center select-none overflow-y-auto"
      style={{
        zIndex: 'var(--z-alert)',
        backgroundColor: 'rgba(185,28,28,0.97)',
        padding: 'calc(env(safe-area-inset-top) + 1rem) calc(env(safe-area-inset-right) + 1.5rem) calc(env(safe-area-inset-bottom) + 1.5rem) calc(env(safe-area-inset-left) + 1.5rem)',
      }}
    >
      {/* Close — in the layout flow so it never sits on top of the alert text */}
      <div className="w-full flex justify-end shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="ui-icon-btn"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'transparent' }}
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      {/* my-auto centres the content when it fits and lets it scroll from the top when it doesn't */}
      <div className="my-auto w-full flex flex-col items-center py-2">
      {/* Content */}
      <p className="text-[10px] font-black tracking-[0.5em] text-red-200 uppercase mb-4">{t('alert.medical_alert')}</p>

      <WarningIcon className="w-20 h-20 mb-3 text-[#fff]" />

      <h1 className="text-4xl font-black text-[#fff] uppercase tracking-tight text-center mb-1">
        {t('alert.unresponsive')}
      </h1>
      <p className="text-xl font-black text-red-200 uppercase tracking-widest text-center mb-5">
        {t('alert.medical_emergency')}
      </p>

      <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center space-y-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <p className="text-red-100 text-sm font-bold">{t('alert.call_services')}</p>
        <p className="text-red-300 text-xs">{t('alert.dont_leave')}</p>
      </div>

      {/* Emergency medications */}
      {emergencyMedications.length > 0 && (
        <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center"
          style={{ backgroundColor: '#fff', border: '3px solid #dc2626' }}>
          <p className="text-red-700 text-[10px] font-black uppercase tracking-widest mb-2">
            {t('alert.administer_med')}
          </p>
          {emergencyMedications.map(med => (
            <p key={med.id} className="text-red-800 text-lg font-black">
              {med.name} {med.dose}{med.unit}
            </p>
          ))}
        </div>
      )}

      {/* Contact info */}
      {(neurologistName || neurologistContact || emergencyContact) && (
        <div className="w-full max-w-xs rounded-2xl p-4 mb-4 space-y-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
          {(neurologistName || neurologistContact) && (
            <div className="flex justify-between items-start gap-2">
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">{t('alert.neurologist')}</p>
              <p className="text-[#fff] text-xs font-bold text-right">
                {[neurologistName, neurologistContact].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          )}
          {emergencyContact && (
            <div className="flex justify-between items-start gap-2">
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">{t('alert.emergency_contact')}</p>
              <p className="text-[#fff] text-xs font-bold text-right">{emergencyContact}</p>
            </div>
          )}
        </div>
      )}

      {/* Live elapsed */}
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-1">{t('alert.elapsed')}</p>
      <p className="text-6xl font-mono font-black text-[#fff] tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>

      <p className="text-red-300 text-[10px] mt-3 font-bold">{t('recording.auto_stop_notice')}</p>
      </div>
    </div>
  );
}

function RecordingView({
  elapsed,
  startTime,
  laps,
  onLap,
  onStop,
  onEmergencyStop,
  onQuickNote,
  userMode,
  quickNoteLabels = ['FELL', 'RESCUE MED', 'NOT RESPONDING', 'FULL BODY', 'LEFT SIDE', 'RIGHT SIDE'],
  emergencyMedications = [],
  neurologistName,
  neurologistContact,
  emergencyContact,
  durationFormat = 'seconds',
  onStartVideo,
  onStopVideo,
  onSwitchCamera,
  videoRecording = false,
  videoSupported = false,
  videoError = '',
  previewStream = null,
  canSwitchCamera = false,
}) {
  const { t } = useTranslation();
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
  const seizureStartLabel = startTime ? new Date(startTime).toLocaleString() : '';
  const [showMarkers, setShowMarkers] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const emergencyFiredRef = useRef(false);
  const previewRef = useRef(null);

  const getDiff = (start, end) => {
    if (!start) return 0;
    if (!end) return elapsed;
    return Math.floor((end - start) / 1000);
  };

  const auraDuration     = getDiff(startTime, laps.aura);
  const seizureDuration  = laps.aura ? getDiff(laps.aura, laps.seizure) : 0;
  const recoveryDuration = laps.seizure ? getDiff(laps.seizure, null) : 0;

  const showAlert = !alertDismissed && elapsed >= ALERT_THRESHOLD;

  // Auto-stop at 12 minutes — ref guard ensures it fires exactly once
  useEffect(() => {
    if (elapsed >= AUTO_STOP_AT && !emergencyFiredRef.current) {
      emergencyFiredRef.current = true;
      onEmergencyStop?.();
    }
  }, [elapsed, onEmergencyStop]);

  const dismissAlert = () => {
    setAlertDismissed(true);
  };

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.srcObject = previewStream || null;
    if (previewStream) previewRef.current.play().catch(() => {});
  }, [previewStream]);

  return (
    <>
      {/* RED ALERT — fullscreen overlay, stays on top of everything */}
      {showAlert && <RedAlert elapsed={elapsed} onClose={dismissAlert} emergencyMedications={emergencyMedications} neurologistName={neurologistName} neurologistContact={neurologistContact} emergencyContact={emergencyContact} />}

      <div data-recording-screen className="app-page-shell flex-1 min-h-full flex flex-col items-center mx-auto py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-in fade-in gap-4">

        {/* 1. TOP: Phase Breakdown */}
        {userMode === 'CARETAKER' && (
          <div className="grid grid-cols-3 gap-3 w-full mb-2 shrink-0">
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="app-status-badge app-status-badge--warning !text-[9px] !px-2 !py-0.5 !mb-1 mx-auto">{t('recording.aura')}</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{fmtDur(auraDuration)}</p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="app-status-badge app-status-badge--danger !text-[9px] !px-2 !py-0.5 !mb-1 mx-auto">{t('recording.seizure')}</p>
              <p className="text-2xl font-mono font-bold leading-none"
                style={{ color: laps.aura && !laps.seizure && seizureDuration >= 240 ? 'var(--text-danger)' : 'var(--text-primary)' }}>
                {fmtDur(seizureDuration)}
              </p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="app-status-badge app-status-badge--info !text-[9px] !px-2 !py-0.5 !mb-1 mx-auto">{t('recording.recovery')}</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{fmtDur(recoveryDuration)}</p>
            </div>
          </div>
        )}

        {/* 2. MAIN TIMER */}
        <div className="w-full flex flex-col text-center py-2">
          <div className="flex justify-center mb-4">
            <div className="relative w-32 sm:w-36 aspect-[3/4] rounded-[1.5rem] overflow-hidden" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              {previewStream ? (
                <>
                  <video ref={previewRef} className="w-full h-full object-cover" playsInline muted />
                  <div className="absolute left-2 right-2 bottom-2 px-2 py-1 rounded-lg text-[10px] font-black"
                    style={{ backgroundColor: 'rgba(15,23,42,0.72)', color: '#fff' }}>
                    <div>{seizureStartLabel}</div>
                    <div>
                      T+{String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{ backgroundColor: 'rgba(185,28,28,0.88)', color: '#fff' }}>
                    {t('recording.video_badge', 'Video')}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center px-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('recording.optional_video', 'Optional video')}</p>
                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    {t('recording.video_hint', 'Start only if it is safe and helpful to capture the seizure.')}
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.4em] mb-2" style={{ color: 'var(--text-dim)' }}>{t('recording.total_elapsed')}</p>
          <div
            className="text-[11vh] font-mono font-black tracking-tighter tabular-nums leading-none"
            style={{ color: elapsed >= 240 && userMode !== 'CARETAKER' ? 'var(--text-danger)' : 'var(--text-primary)' }}
          >
            {fmtDur(elapsed)}
          </div>
          {/* Warning ring at 4 min (1 min before alert) */}
          {elapsed >= 240 && elapsed < ALERT_THRESHOLD && (
            <p className="app-status-badge app-status-badge--danger mt-2 animate-pulse">
              {userMode === 'CARETAKER' ? t('recording.long_seizure_warning') : t('recording.approaching_threshold')}
            </p>
          )}
          <div className="flex justify-center mt-4 gap-2 flex-wrap">
            <Button
              variant={videoRecording ? 'danger' : 'secondary'}
              size="sm"
              onClick={videoRecording ? onStopVideo : onStartVideo}
              disabled={!videoSupported && !videoRecording}
            >
              {videoRecording ? t('recording.stop_video', 'Stop Video') : t('recording.start_video', 'Start Video')}
            </Button>
            {canSwitchCamera && (
              <Button variant="secondary" size="sm" onClick={onSwitchCamera}>
                {t('recording.switch_camera', 'Switch Camera')}
              </Button>
            )}
          </div>
          {videoError && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-2 text-[11px] mt-2">{videoError}</p>
          )}
        </div>

        {/* 3. DYNAMIC ACTION AREA */}
        <div className="w-full app-surface-card p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {userMode === 'CARETAKER' && (
              <div className="app-choice-grid">
                <button
                  disabled={!!laps.aura}
                  onClick={() => onLap('aura')}
                  className="app-action-tile border-[2px] transition-all active:scale-95 disabled:active:scale-100"
                  style={laps.aura
                    ? { backgroundColor: '#334155', borderColor: '#64748b', color: '#fff' }
                    : { backgroundColor: '#d97706', borderColor: '#fbbf24', color: '#fff', boxShadow: '0 18px 34px rgba(180,83,9,0.28)' }}
                >
                  <span className="app-action-tile__eyebrow" style={{ color: laps.aura ? '#fff' : 'rgba(255,255,255,0.82)' }}>
                    {t('recording.aura')}
                  </span>
	                  <span className="app-action-tile__title inline-flex items-center justify-center gap-2">
	                    {laps.aura && <CheckIcon className="w-5 h-5" />}
	                    {laps.aura ? stripTrailingCheck(t('recording.aura_ended')) : t('recording.end_aura')}
	                  </span>
                  <span className="app-action-tile__detail" style={{ color: laps.aura ? '#fff' : 'rgba(255,255,255,0.88)' }}>
                    {fmtDur(auraDuration)}
                  </span>
                </button>

                <button
                  disabled={!laps.aura || !!laps.seizure}
                  onClick={() => onLap('seizure')}
                  className="app-action-tile border-[2px] transition-all active:scale-95 disabled:active:scale-100"
                  style={laps.seizure
                    ? { backgroundColor: '#334155', borderColor: '#64748b', color: '#fff' }
                    : (!laps.aura
                        ? { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-faint)', opacity: 0.58 }
                        : { backgroundColor: '#dc2626', borderColor: '#f87171', color: '#fff', boxShadow: '0 18px 34px rgba(127,29,29,0.3)' })}
                >
                  <span className="app-action-tile__eyebrow" style={{ color: laps.seizure ? '#fff' : (!laps.aura ? 'var(--text-faint)' : 'rgba(255,255,255,0.82)') }}>
                    {t('recording.seizure')}
                  </span>
	                  <span className="app-action-tile__title inline-flex items-center justify-center gap-2">
	                    {laps.seizure && <CheckIcon className="w-5 h-5" />}
	                    {laps.seizure ? stripTrailingCheck(t('recording.seizure_ended')) : t('recording.end_seizure')}
	                  </span>
                  <span className="app-action-tile__detail" style={{ color: laps.seizure ? '#fff' : (!laps.aura ? 'var(--text-faint)' : 'rgba(255,255,255,0.88)') }}>
                    {fmtDur(seizureDuration)}
                  </span>
                </button>
              </div>
            )}

            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className="app-action-tile app-action-tile--center border-[2px] transition-all active:scale-95"
              style={showMarkers
                ? { backgroundColor: 'var(--action-blue)', borderColor: 'var(--action-blue-border)', color: '#fff' }
                : { backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <span className="app-action-tile__eyebrow" style={{ color: showMarkers ? 'rgba(255,255,255,0.82)' : 'var(--text-faint)' }}>
                {t('recording.event_note')}
              </span>
              <span className="app-action-tile__title">{showMarkers ? t('recording.close_notes') : t('recording.event_note')}</span>
            </button>

            {showMarkers && (
              <div
                className="pt-3 border-t animate-in slide-in-from-bottom-2 fade-in duration-300"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="app-choice-grid--compact">
                  {quickNoteLabels.map(label => (
                    <button
                      key={label}
                      onClick={() => onQuickNote(label)}
                      className="app-action-tile app-action-tile--compact app-action-tile--center text-[11px] font-black tracking-tight uppercase transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                      <span className="app-chip-text">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. STOP Button */}
        <div className="w-full max-w-[24rem] shrink-0 pt-1">
          <button
            onClick={onStop}
            className="app-action-tile app-action-tile--center min-h-[5.5rem] text-3xl sm:text-4xl font-black rounded-[2rem] active:scale-95 transition-transform uppercase"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-base)', border: '8px solid var(--bg-base)', boxShadow: '0 18px 48px rgba(255,255,255,0.12)' }}
          >
            <span className="max-w-[72%] leading-[0.92] text-center">{t('recording.stop')}</span>
          </button>
          {userMode === 'PATIENT' && (
            <p className="text-center text-xs mt-4 uppercase font-black tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>
              {t('recording.self_mode')}
            </p>
          )}
        </div>

      </div>
    </>
  );
}

export default RecordingView;
