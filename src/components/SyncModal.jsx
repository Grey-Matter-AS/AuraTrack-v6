import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import i18n from '../i18n';
import { useP2PSync } from '../hooks/useP2PSync';
import { useLANSync } from '../hooks/useLANSync';
import { db } from '../data/db';
import { BottomSheet, Button, Checkbox, ChoiceList } from './ui';
import {
  ActivityIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardListIcon,
  GlobeIcon,
  LoaderIcon,
  PillIcon,
  ShieldIcon,
  WarningIcon,
  WifiIcon,
} from './AppIcons';
import { describeSkipped, mergeTotal } from '../utils/mergeSummary';

function wellbeingEntriesAdded(count) {
  return i18n.t('sync.wellbeing_entries_added', { count, defaultValue: '{{count}} new wellbeing entries added' });
}

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
  const total = result ? mergeTotal(result) : 0;
  const updated = (result?.eventsUpdated || 0) + (result?.logsUpdated || 0) + (result?.eegUpdated || 0) + (result?.wellbeingUpdated || 0);
  const skipped = (result?.rejected || 0) + (result?.conflicts || []).filter(c => c.type?.startsWith('orphan_')).length;
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
            {updated > 0 && <StatusRow icon={<CheckIcon className="w-5 h-5" />} text={i18n.t('settings.data.import_summary_updated', { count: updated })} />}
            {result.deleted > 0 && <StatusRow icon={<CheckIcon className="w-5 h-5" />} text={i18n.t('settings.data.import_summary_deleted', { count: result.deleted })} />}
          </div>
      }
      {skipped > 0 && (
        <p className="app-alert app-alert--warning rounded-xl px-4 py-3 text-xs font-bold text-left">{describeSkipped(result)}</p>
      )}
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

function EasySyncPanel({ connectToken, role, onDone, onScanSenderQR, mergeOptions }) {
  const p2p = useP2PSync(mergeOptions);
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

function PrivateSyncPanel({ offerSDP, role, onDone, onScanSenderQR, mergeOptions }) {
  const lan = useLANSync(mergeOptions);
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

const MODES = [
  { id: 'easy',    labelKey: 'sync.easy_sync',    subKey: 'sync.internet' },
  { id: 'private', labelKey: 'sync.private_sync', subKey: 'sync.same_wifi' },
];

export default function SyncModal({ isOpen, onClose, connectToken, offerSDP }) {
  // If opened via URL hash, jump straight to the right mode
  const defaultMode = connectToken ? 'easy' : offerSDP ? 'private' : null;
  const defaultRole = connectToken || offerSDP ? 'receiver' : 'sender';
  const [mode, setMode] = useState(defaultMode);
  const [role, setRole] = useState(defaultRole);
  const [scanningReceiverQR, setScanningReceiverQR] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedConnectToken, setScannedConnectToken] = useState(null);
  const [scannedOfferSDP, setScannedOfferSDP] = useState(null);
  // Copy mode, language, look and reminders too: on by default only when this phone has no seizures yet
  const [copyAllSettings, setCopyAllSettings] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    db.events.count().then(n => { if (alive) setCopyAllSettings(n === 0); }).catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);
  const mergeOptions = { settingsScope: copyAllSettings ? 'all' : 'shared' };
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
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{i18n.t('sync.backup_elsewhere')}</p>
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
          {/* Two phones in use keep their own mode, language and look; a new phone usually wants a full copy */}
          <Checkbox
            checked={copyAllSettings}
            onChange={setCopyAllSettings}
            label={i18n.t('sync.copy_device_settings')}
            help={i18n.t('sync.copy_device_settings_help')}
          />
          {scanError && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-[11px] font-bold text-center">{scanError}</p>
          )}
          {mode === 'easy'    && <EasySyncPanel connectToken={effectiveConnectToken} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} mergeOptions={mergeOptions} />}
          {mode === 'private' && <PrivateSyncPanel offerSDP={effectiveOfferSDP} role={role} onDone={onClose} onScanSenderQR={startReceiverScan} mergeOptions={mergeOptions} />}
        </>
      )}
    </BottomSheet>
  );
}
