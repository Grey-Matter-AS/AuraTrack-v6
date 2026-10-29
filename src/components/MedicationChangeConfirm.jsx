import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './AppIcons';

const localDateKey = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Default to the next dose still due today, otherwise tomorrow's first dose
function defaultEffective(slots) {
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const sorted = [...slots].sort();
  const nextToday = sorted.find(slot => slot >= nowHHMM);
  if (nextToday || !sorted.length) return { date: localDateKey(now), slot: nextToday ?? '' };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { date: localDateKey(tomorrow), slot: sorted[0] };
}

// ─── Confirm a medication change ──────────────────────────────
// Every add / change / stop / restart passes through here so it is recorded with the date and
// the dose time it takes effect from.
export function MedicationChangeConfirm({ title, medicationName, lines = [], slots = [], confirmLabel, onConfirm, onCancel, children }) {
  const { t } = useTranslation();
  const initial = defaultEffective(slots);
  const [date, setDate] = useState(initial.date);
  const [slot, setSlot] = useState(initial.slot);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = localDateKey(tomorrow);

  const effectiveAt = () => {
    if (slot) return new Date(`${date}T${slot}:00`).getTime();
    return date === localDateKey(today) ? Date.now() : new Date(`${date}T00:00:00`).getTime();
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({ effectiveAt: effectiveAt(), note: note.trim() });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] flex flex-col overflow-hidden max-h-[90dvh]"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-6 pt-6 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>{title}</p>
          <button onClick={onCancel} className="app-icon-action app-icon-action--primary !min-w-[36px] !min-h-[36px] !p-0">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-2 space-y-4">
          <div className="rounded-2xl p-4 space-y-1" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{medicationName}</p>
            {lines.map((line, i) => (
              <p key={i} className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{line}</p>
            ))}
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {t('medication_changes.effective_from')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                max={maxDate}
                value={date}
                onChange={e => setDate(e.target.value)}
                aria-label={t('medication_changes.effective_date')}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              />
              <select
                value={slot}
                onChange={e => setSlot(e.target.value)}
                aria-label={t('medication_changes.effective_dose_time')}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                style={inputStyle}
              >
                {!slots.length && <option value="">{t('medication_changes.no_dose_time')}</option>}
                {[...slots].sort().map(s => (
                  <option key={s} value={s}>{t('medication_changes.dose_at', { time: s })}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>{t('medication_changes.effective_help')}</p>
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {t('medication_changes.note_label')}
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t('medication_changes.note_placeholder')}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={inputStyle}
            />
          </div>

          {children}
        </div>

        <div className="px-6 pb-6 pt-2 space-y-3 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={saving || !date}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg disabled:opacity-40"
            style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
          >
            {confirmLabel || t('medication_changes.confirm')}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          >
            {t('medication_changes.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
