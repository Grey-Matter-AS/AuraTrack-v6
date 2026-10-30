import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, DateInput, FieldRow, NumberInput } from './ui';
import { localDateKey } from '../utils/dates';


// ─── Min/sec duration input pair ─────────────────────────────
function DurField({ label, value, onChange, readOnly = false }) {
  const { t } = useTranslation();
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return (
    <div style={readOnly ? { opacity: 0.6 } : undefined}>
      <p className="ui-label">{label}</p>
      <div className="ui-inline">
        <NumberInput compact aria-label={`${label} ${t('manual_entry.min')}`} value={minutes} max={999} maxLength={3} readOnly={readOnly} onChange={m => onChange(m * 60 + seconds)} />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>{t('manual_entry.min')}</span>
        <NumberInput compact aria-label={`${label} ${t('manual_entry.sec')}`} value={seconds} max={59} maxLength={2} readOnly={readOnly} onChange={s => onChange(minutes * 60 + s)} />
        <span className="font-black text-xs" style={{ color: 'var(--text-dim)' }}>{t('manual_entry.sec')}</span>
      </div>
    </div>
  );
}

// ─── Log a past seizure ───────────────────────────────────────
export function ManualEntrySheet({ onConfirm, onClose }) {
  const { t } = useTranslation();
  const now = new Date();
  const today = localDateKey(now);
  const nowTime = now.toTimeString().slice(0, 5);

  const [date,        setDate]        = useState(today);
  const [time,        setTime]        = useState(nowTime);
  const [totalSec,    setTotalSec]    = useState(0);
  const [showPhases,  setShowPhases]  = useState(false);
  const [auraSec,     setAuraSec]     = useState(0);
  const [seizureSec,  setSeizureSec]  = useState(0);
  const [recoverySec, setRecoverySec] = useState(0);
  const [error,       setError]       = useState('');

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
    <BottomSheet
      title={t('manual_entry.title')}
      onClose={onClose}
      footer={(
        <>
          <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>{t('manual_entry.continue')}</Button>
          <Button variant="secondary" fullWidth onClick={onClose}>{t('manual_entry.cancel')}</Button>
        </>
      )}
    >
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('manual_entry.intro')}</p>

      <FieldRow>
        <DateInput label={t('manual_entry.date')} max={today} value={date} onChange={setDate} />
        <DateInput type="time" label={t('manual_entry.time')} value={time} onChange={setTime} />
      </FieldRow>

      <DurField label={t('manual_entry.total_duration')} value={effectiveTotal} onChange={setTotalSec} readOnly={phaseSum > 0} />

      <div>
        <Button variant="secondary" size="sm" onClick={() => setShowPhases(p => !p)} aria-expanded={showPhases}>
          <span aria-hidden="true">{showPhases ? '▾' : '▸'}</span>
          {t('manual_entry.phase_breakdown')}
        </Button>
      </div>

      {showPhases && (
        <div className="flex flex-col gap-4 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
          <DurField label={t('manual_entry.aura')} value={auraSec} onChange={setAuraSec} />
          <DurField label={t('manual_entry.ictal')} value={seizureSec} onChange={setSeizureSec} />
          <DurField label={t('manual_entry.recovery')} value={recoverySec} onChange={setRecoverySec} />
        </div>
      )}

      {error && <p className="app-alert app-alert--danger rounded-xl px-4 py-3 text-xs font-bold">{error}</p>}
    </BottomSheet>
  );
}
