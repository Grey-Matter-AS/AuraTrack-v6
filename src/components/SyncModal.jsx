import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import i18n from '../i18n';
import { useP2PSync } from '../hooks/useP2PSync';
import { useLANSync } from '../hooks/useLANSync';
import { BackupTransferModal } from './BackupTransferModal';
import { BottomSheet, Button, ChoiceList } from './ui';
import {
  ActivityIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardListIcon,
  DownloadIcon,
  GlobeIcon,
  LoaderIcon,
  PillIcon,
  ShieldIcon,
  UploadIcon,
  WarningIcon,
  WifiIcon,
} from './AppIcons';
import { assertImportFileSafe } from '../utils/importSanitizer';
import { parseBackupFileText } from '../utils/backupFiles';

function wellbeingEntriesAdded(count) {
  return i18n.t('sync.wellbeing_entries_added', { count, defaultValue: '{{count}} new wellbeing entries added' });
}

function syncImportSummary(r) {
  return i18n.t('sync.import_summary_with_wellbeing', {
    events: r.events,
    medications: r.medications,
    logs: r.logs,
    eegSessions: r.eegSessions,
    eegActivities: r.eegActivities,
    wellbeingEntries: r.wellbeingEntries || 0,
    conflicts: r.conflicts?.length || 0,
    defaultValue: 'Added {{events}} event(s), {{medications}} medication(s), {{logs}} dose log(s), {{eegSessions}} EEG session(s), {{eegActivities}} EEG activity record(s), and {{wellbeingEntries}} wellbeing entries.',
  }) + (r.medicationChanges || r.medicationsUpdated || r.medicationsDeleted
    ? ` ${i18n.t('sync.medication_history_summary', {
      changes: r.medicationChanges || 0,
      updated: r.medicationsUpdated || 0,
      deleted: r.medicationsDeleted || 0,
    })}`
    : '');
}

const mergeTotal = (r) => r.settings + r.events + r.medications + r.logs + r.eegSessions + r.eegActivities
  + (r.wellbeingEntries || 0) + (r.medicationChanges || 0) + (r.medicationsUpdated || 0) + (r.medicationsDeleted || 0);

// ─── Shared sub-components ───────────────────────────────────

function QRImg({ dataUrl, label }) {
  if (!dataUrl) return (
    <div className="w-[280px] h-[280px] rounded-2xl flex items-center justify-center mx-auto"
      style={{ backgroundColor: 'var(--bg-raised)' }}>
      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse"
        style={{ color: 'var(--text-on-raised-muted)' }}>{i18n.t('sync.generating')}</span>
    </div>
  );
  return (
    <div className="mx-auto w-fit">
      <img src={dataUrl} alt={i18n.t('sync.qr_code_alt')} className="rounded-2xl w-[280px] h-[280px] max-w-full" />
      {label && (
        <p className="text-center text-[9px] font-black uppercase tracking-widest mt-2"
          style={{ color: 'var(--text-dim)' }}>{label}</p>
      )}
    </div>
  );
}

function PinDisplay({ pin, label }) {
  return (
    <div className="rounded-2xl px-6 py-3 mx-auto w-fit text-center"
      style={{ backgroundColor: 'var(--bg-raised)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1"
        style={{ color: 'var(--text-on-raised-muted)' }}>{label || i18n.t('sync.security_pin')}</p>
      <p className="text-4xl font-black tracking-[0.25em]" style={{ color: 'var(--text-on-raised)' }}>
        {pin}
      </p>
    </div>
  );
}

function StatusRow({ icon, text }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="shrink-0 inline-flex items-center justify-center w-5 h-5">{icon}</span>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <div className="app-status-badge app-status-badge--info">
      <span>
        {role === 'sender' ? i18n.t('sync.sender_profile') : i18n.t('sync.receiver_profile')}
      </span>
    </div>
  );
}

function RoleSelector({ role, onChange, locked = false }) {
  const options = [
    { id: 'sender', label: i18n.t('sync.sender'), sub: i18n.t('sync.sender_sub') },
    { id: 'receiver', label: i18n.t('sync.receiver'), sub: i18n.t('sync.receiver_sub') },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
        {i18n.t('sync.device_role')}
      </p>
      <div className="ui-row">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            aria-pressed={role === option.id}
            onClick={() => !locked && onChange(option.id)}
            disabled={locked}
            className="ui-choice disabled:opacity-90"
          >
            <span className="block text-[11px] font-black uppercase tracking-widest">{option.label}</span>
            <span className="ui-choice__detail">{option.sub}</span>
          </button>
        ))}
      </div>
      {locked && (
        <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {i18n.t('sync.role_locked')}
        </p>
      )}
    </div>
  );
}

function DonePanel({ result, onClose }) {
  const medicationHistoryCount = (result?.medicationChanges || 0) + (result?.medicationsUpdated || 0) + (result?.medicationsDeleted || 0);
  const total = (result?.events || 0) + (result?.medications || 0) + (result?.logs || 0) + (result?.eegSessions || 0) + (result?.eegActivities || 0) + (result?.wellbeingEntries || 0) + medicationHistoryCount;
  return (
    <div className="space-y-4 text-center">
      <span className="app-status-badge app-status-badge--success mx-auto mb-2 !h-12 !w-12 !rounded-full !p-0"><CheckIcon className="w-6 h-6" /></span>
      <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{i18n.t('sync.complete')}</p>
      {total === 0
        ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{i18n.t('sync.already_up_to_date')}</p>
        : <div className="space-y-1">
            {result.events > 0 && <StatusRow icon={<ClipboardListIcon className="w-5 h-5" />} text={i18n.t('sync.events_added', { count: result.events })} />}
            {result.medications > 0 && <StatusRow icon={<PillIcon className="w-5 h-5" />} text={i18n.t('sync.medications_added', { count: result.medications })} />}
            {result.logs > 0 && <StatusRow icon={<CalendarIcon className="w-5 h-5" />} text={i18n.t('sync.logs_added', { count: result.logs })} />}
            {medicationHistoryCount > 0 && <StatusRow icon={<PillIcon className="w-5 h-5" />} text={i18n.t('sync.medication_history_summary', { changes: result.medicationChanges || 0, updated: result.medicationsUpdated || 0, deleted: result.medicationsDeleted || 0 })} />}
            {result.eegSessions > 0 && <StatusRow icon={<ActivityIcon className="w-5 h-5" />} text={i18n.t('sync.eeg_sessions_added', { count: result.eegSessions })} />}
            {result.eegActivities > 0 && <StatusRow icon={<ActivityIcon className="w-5 h-5" />} text={i18n.t('sync.eeg_activities_added', { count: result.eegActivities })} />}
            {result.wellbeingEntries > 0 && <StatusRow icon={<ActivityIcon className="w-5 h-5" />} text={wellbeingEntriesAdded(result.wellbeingEntries)} />}
          </div>
      }
      <button onClick={onClose}
        className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
       >
        {i18n.t('backup.modal.close')}
      </button>
    </div>
  );
}

function ErrorPanel({ error, onRetry, onClose }) {
  return (
    <div className="space-y-4 text-center">
      <span className="app-status-badge app-status-badge--danger mx-auto mb-2 !h-10 !w-10 !rounded-full !p-0"><WarningIcon className="w-5 h-5" /></span>
      <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-sm font-bold">{error}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button onClick={onRetry}
            className="ui-btn ui-btn--primary ui-btn--md flex-1"
           >
            {i18n.t('settings.data.persistence_retry')}
          </button>
        )}
        <button onClick={onClose}
          className="ui-btn ui-btn--secondary ui-btn--md flex-1"
         >
          {i18n.t('backup.modal.close')}
        </button>
      </div>
    </div>
  );
}

// ─── In-app QR scanner (for Phase 3 answer scan) ─────────────

function QRScanner({ onScan, onCancel, prompt = i18n.t('sync.scan_qr_prompt') }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [camError, setCamError] = useState(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const scan = () => {
          if (!mounted || !videoRef.current) return;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            stopCamera();
            onScan(code.data);
          } else {
            rafRef.current = requestAnimationFrame(scan);
          }
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        if (mounted) setCamError(e.name === 'NotAllowedError'
          ? i18n.t('sync.camera_denied')
          : i18n.t('sync.camera_error', { message: e.message }));
      }
    })();
    return () => { mounted = false; stopCamera(); };
  }, [onScan, stopCamera]);

  if (camError) return (
    <div className="space-y-4 text-center">
      <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-sm">{camError}</p>
      <button onClick={onCancel}
        className="ui-btn ui-btn--secondary ui-btn--md ui-btn--full"
       >
        {i18n.t('nav.back').replace(/^[^\p{Letter}\p{Number}]+/u, '').trim()}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-center"
        style={{ color: 'var(--text-dim)' }}>{prompt}</p>
      <div className="relative rounded-2xl overflow-hidden aspect-square w-full max-w-[240px] mx-auto"
        style={{ backgroundColor: '#000' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border-[3px] rounded-2xl pointer-events-none"
          style={{ borderColor: 'var(--accent)' }} />
      </div>
      <button onClick={onCancel}
        className="ui-btn ui-btn--secondary ui-btn--sm ui-btn--full"
       >
        {i18n.t('backup.modal.cancel')}
      </button>
    </div>
  );
}

// ─── Easy Sync (PeerJS) panel ─────────────────────────────────

function EasySyncPanel({ connectToken, role, onDone, onScanSenderQR }) {
  const p2p = useP2PSync();
  const [qrUrl, setQrUrl] = useState(null);

  // Guest: auto-connect when opened with a token from scanned QR
  useEffect(() => {
    if (connectToken && p2p.phase === 'idle') p2p.connectToPeer(connectToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectToken, p2p.phase]);

  // Host: generate QR once peer ID is known
  useEffect(() => {
    if (p2p.peerId) {
      const url = `${window.location.origin}${window.location.pathname}#sync=${p2p.peerId}`;
      QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: 'L' })
        .then(setQrUrl);
    }
  }, [p2p.peerId]);

  const phase = p2p.phase;
  const retry = connectToken
    ? () => p2p.reset()
    : () => { p2p.reset(); setTimeout(() => p2p.startAsHost(), 0); };

  if (phase === 'done') return <DonePanel result={p2p.result} onClose={onDone} />;
  if (phase === 'error' || phase === 'timeout') return (
    <ErrorPanel error={p2p.error} onRetry={retry} onClose={onDone} />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? i18n.t('sync.easy_sender_intro')
          : i18n.t('sync.easy_receiver_intro')}
      </p>
      <StatusRow icon={<ShieldIcon className="w-5 h-5" />} text={i18n.t('sync.easy_security')} />
      <StatusRow icon={<GlobeIcon className="w-5 h-5" />} text={i18n.t('sync.easy_metadata')} />
      {role === 'sender' ? (
        <button onClick={p2p.startAsHost}
          className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
         >
          {i18n.t('sync.start_sender_setup')}
        </button>
      ) : (
        <>
          <button onClick={onScanSenderQR}
            className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
           >
            {i18n.t('sync.scan_sender_qr')}
          </button>
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {i18n.t('sync.receiver_steps')}
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.easy_step_1')}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.easy_step_2')}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.easy_step_3')}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (phase === 'generating') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.connecting_relay')} />
    </div>
  );

  if (phase === 'waiting') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <QRImg dataUrl={qrUrl} label={i18n.t('sync.receiver_scan_qr')} />
      <PinDisplay pin={p2p.pin} label={i18n.t('sync.verify_pin_both')} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.waiting_receiver_connect')} />
    </div>
  );

  if (phase === 'connecting') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.connecting_sender')} />
    </div>
  );

  if (phase === 'pin_confirm') {
    const isGuest = !!connectToken;
    if (isGuest) return (
      <div className="space-y-4">
        <RoleBadge role="receiver" />
        <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
          {i18n.t('sync.pin_match_question')}
        </p>
        <PinDisplay pin={p2p.remotePin} />
        <button onClick={p2p.confirmPin}
          className="ui-btn ui-btn--success ui-btn--md ui-btn--full"
         >
          <CheckIcon className="w-4 h-4 inline-block mr-2 align-[-2px]" /> {i18n.t('sync.pins_match_start')}
        </button>
        <button onClick={p2p.reset}
          className="ui-btn ui-btn--warning ui-btn--md ui-btn--full"
         >
          {i18n.t('sync.pins_no_match_cancel')}
        </button>
      </div>
    );
    // Host: waiting for guest to confirm
    return (
      <div className="space-y-4">
        <RoleBadge role="sender" />
        <PinDisplay pin={p2p.pin} label={i18n.t('sync.verify_pin_receiver')} />
        <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.waiting_receiver_confirm')} />
      </div>
    );
  }

  if (phase === 'transferring' || phase === 'merging') return (
    <div className="space-y-3">
      <RoleBadge role={role} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={phase === 'merging' ? i18n.t('sync.merging_records') : i18n.t('sync.transferring_data')} />
    </div>
  );

  return null;
}

// ─── Private Sync (LAN) panel ─────────────────────────────────

function PrivateSyncPanel({ offerSDP, role, onDone, onScanSenderQR }) {
  const lan = useLANSync();
  const [scanning, setScanning] = useState(false);

  // Guest: auto-process offer when opened with encoded SDP
  useEffect(() => {
    if (offerSDP && lan.phase === 'idle') lan.startAsGuest(offerSDP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerSDP, lan.phase]);

  const handleAnswerScanned = useCallback((url) => {
    setScanning(false);
    const match = url.match(/#sdp-answer=(.+)/);
    if (match) {
      lan.applyAnswer(match[1]);
    } else {
      // Not an answer QR — ignore and let user try again
    }
  }, [lan]);

  const phase = lan.phase;
  const retry = offerSDP
    ? () => lan.reset()
    : () => { lan.reset(); setTimeout(() => lan.startAsHost(), 0); };

  if (phase === 'done') return <DonePanel result={lan.result} onClose={onDone} />;
  if (phase === 'error') return <ErrorPanel error={lan.error} onRetry={retry} onClose={onDone} />;

  if (scanning) return (
    <QRScanner
      onScan={handleAnswerScanned}
      onCancel={() => setScanning(false)}
    />
  );

  if (phase === 'idle') return (
    <div className="space-y-4">
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? i18n.t('sync.private_sender_intro')
          : i18n.t('sync.private_receiver_intro')}
      </p>
      <StatusRow icon={<ShieldIcon className="w-5 h-5" />} text={i18n.t('sync.private_security')} />
      <StatusRow icon={<WifiIcon className="w-5 h-5" />} text={i18n.t('sync.private_scans')} />
      {role === 'sender' ? (
        <button onClick={lan.startAsHost}
          className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
         >
          {i18n.t('sync.start_sender_setup')}
        </button>
      ) : (
        <>
          <button onClick={onScanSenderQR}
            className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
           >
            {i18n.t('sync.scan_sender_qr')}
          </button>
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {i18n.t('sync.receiver_steps')}
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.private_step_1')}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.private_step_2')}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {i18n.t('sync.private_step_3')}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (phase === 'generating_offer') return <div className="space-y-3"><RoleBadge role="sender" /><StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.generating_connection_code')} /></div>;
  if (phase === 'generating_answer') return <div className="space-y-3"><RoleBadge role="receiver" /><StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.processing_connection_code')} /></div>;

  if (phase === 'waiting_scan') return (
    <div className="space-y-4">
      <RoleBadge role="sender" />
      <QRImg dataUrl={lan.offerQR} label={i18n.t('sync.step1_receiver_scans')} />
      <PinDisplay pin={lan.pin} label={i18n.t('sync.verify_pin_both')} />
      <p className="text-[10px] text-center" style={{ color: 'var(--text-dim)' }}>
        {i18n.t('sync.after_receiver_scan')}
      </p>
      <button onClick={() => setScanning(true)}
        className="ui-btn ui-btn--secondary ui-btn--md ui-btn--full"
       >
        {i18n.t('sync.scan_receiver_answer_qr')}
      </button>
    </div>
  );

  if (phase === 'waiting_answer') return (
    <div className="space-y-4">
      <RoleBadge role="receiver" />
      <QRImg dataUrl={lan.answerQR} label={i18n.t('sync.show_to_sender')} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.waiting_sender_scan')} />
    </div>
  );

  if (phase === 'connecting') return <div className="space-y-3"><RoleBadge role={lan.isHost ? 'sender' : 'receiver'} /><StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.establishing_direct')} /></div>;

  if (phase === 'pin_confirm') return (
    <div className="space-y-4">
      <RoleBadge role={lan.isHost ? 'sender' : 'receiver'} />
      <p className="text-sm font-black text-center" style={{ color: 'var(--text-primary)' }}>
        {lan.isHost ? i18n.t('sync.verify_pin_receiver') : i18n.t('sync.pin_match_question')}
      </p>
      <PinDisplay pin={lan.isHost ? lan.pin : lan.remotePin} />
      {!lan.isHost && (
        <>
          <button onClick={lan.confirmPin}
            className="ui-btn ui-btn--success ui-btn--md ui-btn--full"
           >
            <CheckIcon className="w-4 h-4 inline-block mr-2 align-[-2px]" /> {i18n.t('sync.pins_match_start')}
          </button>
          <button onClick={lan.reset}
            className="ui-btn ui-btn--warning ui-btn--md ui-btn--full"
           >
            {i18n.t('sync.pins_no_match_cancel')}
          </button>
        </>
      )}
      {lan.isHost && <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={i18n.t('sync.waiting_receiver_confirm')} />}
    </div>
  );

  if (phase === 'transferring' || phase === 'merging') return (
    <div className="space-y-3">
      <RoleBadge role={lan.isHost ? 'sender' : 'receiver'} />
      <StatusRow icon={<LoaderIcon className="w-5 h-5 animate-spin" />} text={phase === 'merging' ? i18n.t('sync.merging_records') : i18n.t('sync.transferring_data')} />
    </div>
  );

  return null;
}

// ─── Manual File panel ────────────────────────────────────────

function ManualFilePanel({ role, onDone, onBackupSuccess }) {
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);
  const [backupModal, setBackupModal] = useState({ mode: null, fileName: '', fileText: '' });

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertImportFileSafe(file);
      const { mergeRemoteData } = await import('../utils/syncHelpers');
      const text = await file.text();
      const parsed = parseBackupFileText(text);
      if (parsed.kind === 'encrypted') {
        setBackupModal({ mode: 'import', fileName: file.name, fileText: text });
        e.target.value = '';
        return;
      }
      const r = await mergeRemoteData(parsed.parsed);
      const total = mergeTotal(r);
      setStatus(total
        ? `${syncImportSummary(r)}${r.conflicts?.length ? ` ${i18n.t('sync.conflicts_kept_local', { count: r.conflicts.length, defaultValue: '{{count}} conflict(s) kept local records.' })}` : ''}`
        : i18n.t('sync.already_up_to_date_short'));
    } catch { setStatus(i18n.t('settings.data.import_failed')); }
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [h] = await window.showOpenFilePicker({
          types: [{ description: 'AuraTrack Backup', accept: { 'application/json': ['.json', '.atbak'] } }],
          multiple: false,
        });
        const file = await h.getFile();
        const fakeEvent = { target: { files: [file], value: '' } };
        await handleImport(fakeEvent);
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    fileRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {backupModal.mode === 'export' && (
        <BackupTransferModal
          key="sync-backup-export"
          isOpen
          mode="export"
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onExportSuccess={async (summary) => {
            await onBackupSuccess?.(summary);
            setStatus(i18n.t('sync.exported_events', { count: summary.events }));
          }}
        />
      )}
      {backupModal.mode === 'import' && (
        <BackupTransferModal
          key={`sync-backup-import-${backupModal.fileName}`}
          isOpen
          mode="import"
          fileName={backupModal.fileName}
          fileText={backupModal.fileText}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onImportSuccess={(r) => {
            const total = mergeTotal(r);
            setStatus(total
              ? `${syncImportSummary(r)}${r.conflicts?.length ? ` ${i18n.t('sync.conflicts_kept_local', { count: r.conflicts.length, defaultValue: '{{count}} conflict(s) kept local records.' })}` : ''}`
              : i18n.t('sync.already_up_to_date_short'));
          }}
        />
      )}
      <RoleBadge role={role} />
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {role === 'sender'
          ? i18n.t('sync.manual_sender_intro')
          : i18n.t('sync.manual_receiver_intro')}
      </p>
      <div className="space-y-2">
        <Button variant={role === 'sender' ? 'primary' : 'secondary'} fullWidth icon={<DownloadIcon className="w-4 h-4" />}
          onClick={() => setBackupModal({ mode: 'export', fileName: '', fileText: '' })}>
          {i18n.t('backup.modal.export_cta')}
        </Button>
        <Button variant={role === 'receiver' ? 'primary' : 'secondary'} fullWidth icon={<UploadIcon className="w-4 h-4" />} onClick={handleImportClick}>
          {i18n.t('sync.import_backup_file')}
        </Button>
        {/* Hidden native file picker opened by the Import button — not a visible field */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input ref={fileRef} type="file" accept=".atbak,.json,application/json" className="hidden" onChange={handleImport} />
      </div>
      {status && (
        <p className="text-[11px] font-bold text-center py-1" style={{ color: 'var(--text-secondary)' }}>
          {status}
        </p>
      )}
      <button onClick={onDone}
        className="ui-btn ui-btn--secondary ui-btn--md ui-btn--full"
       >
        {i18n.t('sync.done')}
      </button>
    </div>
  );
}

// ─── Root SyncModal ───────────────────────────────────────────

const MODES = [
  { id: 'easy',    labelKey: 'sync.easy_sync',    subKey: 'sync.internet' },
  { id: 'private', labelKey: 'sync.private_sync', subKey: 'sync.same_wifi' },
  { id: 'manual',  labelKey: 'sync.manual_file',  subKey: 'sync.export_import' },
];

export default function SyncModal({ isOpen, onClose, connectToken, offerSDP, onBackupSuccess }) {
  // If opened via URL hash, jump straight to the right mode
  const defaultMode = connectToken ? 'easy' : offerSDP ? 'private' : null;
  const defaultRole = connectToken || offerSDP ? 'receiver' : 'sender';
  const [mode, setMode] = useState(defaultMode);
  const [role, setRole] = useState(defaultRole);
  const [scanningReceiverQR, setScanningReceiverQR] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedConnectToken, setScannedConnectToken] = useState(null);
  const [scannedOfferSDP, setScannedOfferSDP] = useState(null);
  const effectiveConnectToken = connectToken ?? scannedConnectToken;
  const effectiveOfferSDP = offerSDP ?? scannedOfferSDP;
  const isLinked = !!(connectToken || offerSDP); // came from external QR/app link — lock the mode
  const isReceiverLocked = isLinked || !!(scannedConnectToken || scannedOfferSDP);

  const clearScannedRouting = useCallback(() => {
    setScannedConnectToken(null);
    setScannedOfferSDP(null);
    setScanError('');
  }, []);

  // Reset mode when opened fresh (no link)
  useEffect(() => {
    if (!isOpen || connectToken || offerSDP) return;
    const id = setTimeout(() => {
      setMode(null);
      setRole('sender');
      setScanningReceiverQR(false);
      clearScannedRouting();
    }, 0);
    return () => clearTimeout(id);
  }, [isOpen, connectToken, offerSDP, clearScannedRouting]);

  useEffect(() => {
    if (!isOpen) return;
    if (!(connectToken || offerSDP)) return;
    const id = setTimeout(() => setRole('receiver'), 0);
    return () => clearTimeout(id);
  }, [isOpen, connectToken, offerSDP]);

  const startReceiverScan = useCallback(() => {
    setScanError('');
    setScanningReceiverQR(true);
  }, []);

  const handleReceiverScan = useCallback((rawValue) => {
    setScanningReceiverQR(false);
    setScanError('');

    const value = String(rawValue || '').trim();
    const syncMatch = value.match(/#sync=([^&]+)/);
    const offerMatch = value.match(/#sdp=([^&]+)/);

    if (syncMatch) {
      clearScannedRouting();
      setScannedConnectToken(syncMatch[1]);
      setRole('receiver');
      setMode('easy');
      return;
    }

    if (offerMatch) {
      clearScannedRouting();
      setScannedOfferSDP(offerMatch[1]);
      setRole('receiver');
      setMode('private');
      return;
    }

    setScanError(i18n.t('sync.invalid_qr'));
  }, [clearScannedRouting]);

  if (!isOpen) return null;

  return (
    <BottomSheet title={i18n.t('sync.title')} onClose={onClose}>
      {mode && !isLinked && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => {
            setMode(null);
            setScanningReceiverQR(false);
            clearScannedRouting();
          }}>
            {i18n.t('nav.back')}
          </Button>
        </div>
      )}

      {/* Mode selector */}
      {!mode && !scanningReceiverQR && (
        <>
          <RoleSelector role={role} onChange={setRole} locked={false} />
          {role === 'receiver' && (
            <Button variant="primary" fullWidth onClick={startReceiverScan}>{i18n.t('sync.scan_sender_qr')}</Button>
          )}
          {scanError && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-[11px] font-bold text-center">{scanError}</p>
          )}
          <ChoiceList
            value={null}
            onChange={setMode}
            options={MODES.map(m => ({ value: m.id, label: `${i18n.t(m.labelKey)} ›`, detail: i18n.t(m.subKey) }))}
          />
        </>
      )}

      {/* Mode content */}
      {scanningReceiverQR && (
        <QRScanner
          onScan={handleReceiverScan}
          onCancel={() => setScanningReceiverQR(false)}
          prompt={i18n.t('sync.scan_sender_prompt')}
        />
      )}
      {mode && !scanningReceiverQR && (
        <>
          <RoleSelector role={role} onChange={(nextRole) => {
            setRole(nextRole);
            if (nextRole !== 'receiver') clearScannedRouting();
          }} locked={isReceiverLocked} />
          {scanError && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-[11px] font-bold text-center">{scanError}</p>
          )}
          {mode === 'easy'    && <EasySyncPanel connectToken={effectiveConnectToken} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} />}
          {mode === 'private' && <PrivateSyncPanel offerSDP={effectiveOfferSDP} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} />}
          {mode === 'manual'  && <ManualFilePanel role={role} onDone={onClose} onBackupSuccess={onBackupSuccess} />}
        </>
      )}
    </BottomSheet>
  );
}
