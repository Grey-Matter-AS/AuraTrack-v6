import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollFade } from './ScrollFade';
import { CloseIcon } from './AppIcons';

// ─── Min/sec duration input pair ─────────────────────────────
// ─── Single number box ────────────────────────────────────────
// Focusing starts a fresh entry (old value shown as placeholder), so the first digit typed
// always lands in the ones place regardless of where the mobile caret ends up.
// Leaving the box without typing keeps the old value.
function NumInput({ value, max, maxLength, onChange, readOnly }) {
  const [draft, setDraft] = useState(null);

  const handleChange = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, maxLength);
    const n = d === '' ? 0 : Math.min(max, parseInt(d, 10));
    setDraft(d === '' ? '' : String(n));
    onChange(n);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={maxLength}
      readOnly={readOnly}
      placeholder={value ? String(value) : '0'}
      value={draft ?? (value ? String(value) : '')}
      onFocus={() => { if (!readOnly) setDraft(''); }}
      onBlur={() => setDraft(null)}
      onChange={e => handleChange(e.target.value)}
      className="w-16 text-center rounded-xl px-2 py-2 font-mono font-black text-lg outline-none"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
    />
  );
}

function DurField({ label, value, onChange, readOnly = false }) {
  const { t } = useTranslation();
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return (
    <div style={readOnly ? { opacity: 0.6 } : undefined}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <div className="flex items-center gap-2">
        <NumInput value={minutes} max={999} maxLength={3} readOnly={readOnly} onChange={m => onChange(m * 60 + seconds)} />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>{t('manual_entry.min')}</span>
        <NumInput value={seconds} max={59} maxLength={2} readOnly={readOnly} onChange={s => onChange(minutes * 60 + s)} />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>{t('manual_entry.sec')}</span>
      </div>
    </div>
  );
}

// ─── Bottom-sheet modal ───────────────────────────────────────
export function ManualEntrySheet({ onConfirm, onClose }) {
  const { t } = useTranslation();
  const today    = new Date().toISOString().slice(0, 10);
  const nowTime  = new Date().toTimeString().slice(0, 5);

  const [date,        setDate]        = useState(today);
  const [time,        setTime]        = useState(nowTime);
  const [totalSec,    setTotalSec]    = useState(0);
  const [showPhases,  setShowPhases]  = useState(false);
  const [auraSec,     setAuraSec]     = useState(0);
  const [seizureSec,  setSeizureSec]  = useState(0);
  const [recoverySec, setRecoverySec] = useState(0);
  const [error,       setError]       = useState('');

  const inputStyle = {
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  // When any phase is filled in, the total is the sum of the phases; otherwise the manual total stands
  const phaseSum = showPhases ? auraSec + seizureSec + recoverySec : 0;
  const effectiveTotal = phaseSum > 0 ? phaseSum : totalSec;

  const handleContinue = () => {
    if (effectiveTotal <= 0) {
      setError(t('manual_entry.error_duration'));
      return;
    }
    setError('');

    const manualDurations = { total: effectiveTotal };
    if (showPhases) {
      if (auraSec     > 0) manualDurations.aura     = auraSec;
      if (seizureSec  > 0) manualDurations.seizure  = seizureSec;
      if (recoverySec > 0) manualDurations.recovery = recoverySec;
    }

    onConfirm({ date, time, durationSec: effectiveTotal, manualDurations });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] flex flex-col overflow-hidden max-h-[90dvh]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
            {t('manual_entry.title')}
          </p>
          <button
            onClick={onClose}
            className="app-icon-action app-icon-action--primary !min-w-[36px] !min-h-[36px] !p-0"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <ScrollFade className="flex-1 min-h-0 px-6 pt-4 pb-2 space-y-5" wrapperClassName="flex-1 flex flex-col" bgVar="--bg-card">

          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {t('manual_entry.intro')}
          </p>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3 date-time-row">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                {t('manual_entry.date')}
              </p>
              <input
                type="date"
                max={today}
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                {t('manual_entry.time')}
              </p>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Total duration */}
          <DurField label={t('manual_entry.total_duration')} value={effectiveTotal} onChange={setTotalSec} readOnly={phaseSum > 0} />

          {/* Phase breakdown toggle */}
          <button
            onClick={() => setShowPhases(p => !p)}
            className="app-icon-action app-icon-action--primary !min-h-[36px] !px-3"
          >
            <span>{showPhases ? '▾' : '▸'}</span>
            <span>{t('manual_entry.phase_breakdown')}</span>
          </button>

          {showPhases && (
            <div className="space-y-4 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
              <DurField label={t('manual_entry.aura')} value={auraSec} onChange={setAuraSec} />
              <DurField label={t('manual_entry.ictal')} value={seizureSec} onChange={setSeizureSec} />
              <DurField label={t('manual_entry.recovery')} value={recoverySec} onChange={setRecoverySec} />
            </div>
          )}

          {error && (
            <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-xs font-bold">{error}</p>
          )}

        </ScrollFade>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 space-y-3 shrink-0">
          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {t('manual_entry.continue')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('manual_entry.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
