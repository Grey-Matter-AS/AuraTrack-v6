import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, DateInput, FieldRow, Inset, Select, TextArea } from './ui';

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

  const slotOptions = slots.length
    ? [...slots].sort().map(s => ({ value: s, label: t('medication_changes.dose_at', { time: s }) }))
    : [{ value: '', label: t('medication_changes.no_dose_time') }];

  return (
    <BottomSheet
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="primary" size="lg" fullWidth disabled={saving || !date} onClick={handleConfirm}>
            {confirmLabel || t('medication_changes.confirm')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel}>{t('medication_changes.cancel')}</Button>
        </>
      )}
    >
      <Inset className="space-y-1">
        <p className="text-sm font-black">{medicationName}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>{line}</p>
        ))}
      </Inset>

      <div>
        <p className="ui-label">{t('medication_changes.effective_from')}</p>
        <FieldRow>
          <DateInput max={maxDate} value={date} onChange={setDate} aria-label={t('medication_changes.effective_date')} />
          <Select options={slotOptions} value={slot} onChange={setSlot} aria-label={t('medication_changes.effective_dose_time')} />
        </FieldRow>
        <p className="ui-help">{t('medication_changes.effective_help')}</p>
      </div>

      <TextArea
        label={t('medication_changes.note_label')}
        value={note}
        onChange={setNote}
        maxLength={500}
        rows={2}
        placeholder={t('medication_changes.note_placeholder')}
      />

      {children}
    </BottomSheet>
  );
}
