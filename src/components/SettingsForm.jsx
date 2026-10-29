import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { assertImportFileSafe } from '../utils/importSanitizer';
import { mergeRemoteData } from '../utils/syncHelpers';
import { useMedications } from '../hooks/useMedications';
import { BackupTransferModal } from './BackupTransferModal';
import { parseBackupFileText } from '../utils/backupFiles';
import { defaultScheduledTimes, diffRegimen, regimenSnapshot, scheduledDaysLabel } from '../utils/medicationSchedule';
import { describeChange, formLabel, regimenDoseSummary, regimenSummary } from '../utils/medicationChanges';
import { COMMON_ANTISEIZURE_INGREDIENTS, DEFAULT_WELLBEING_FACTORS, MEDICATION_FORMS } from '../data/constants';
import { MedicationChangeConfirm } from './MedicationChangeConfirm';
import { Button, ButtonRow, ChipGroup, ChoiceList, DateInput, DecimalInput, Dialog, FieldRow, Inset, Section as KitSection, Select, TextInput, Toggle, useToast } from './ui';
import {
  BellIcon,
  BellOffIcon,
  CloseIcon,
  DownloadIcon,
  EditIcon,
  InstallIcon,
  ResetIcon,
  SirenIcon,
  SyncIcon,
  TrashIcon,
  UploadIcon,
} from './AppIcons';
import pkg from '../../package.json';
import i18n from '../i18n';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Dansk' },
  { code: 'nb', label: 'Norsk Bokmål' },
  { code: 'nn', label: 'Nynorsk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'sv', label: 'Svenska' },
  { code: 'fi', label: 'Suomi' },
];

// ─── Atom components ─────────────────────────────────────────

// Settings atoms are thin wrappers over the shared UI kit, so every settings screen uses the
// same fields, chips, switches and containers as the rest of the app.
const Section = KitSection;

function Row({ label, help, children }) {
  return (
    <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
        {typeof help === 'string' && help && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</p>}
        {help && typeof help !== 'string' && <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{help}</div>}
      </div>
      <div className="shrink-0 max-w-full">{children}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <p className="ui-label">{children}</p>;
}

function TextField({ label, value, onChange, type = 'text', placeholder }) {
  if (type === 'date' || type === 'time') {
    return <DateInput type={type} label={label} value={value || ''} onChange={onChange} placeholder={placeholder} />;
  }
  return <TextInput type={type} label={label} value={value || ''} onChange={onChange} placeholder={placeholder} />;
}

function Segments({ options, value, onChange }) {
  return (
    <ChipGroup
      fill
      value={value}
      onChange={onChange}
      options={options.map(opt => (typeof opt === 'object' ? opt : { value: opt, label: String(opt) }))}
    />
  );
}

function ActionBtn({ label, sub, onClick, icon, variant = 'default' }) {
  const isDanger = variant === 'danger';
  const bg = isDanger ? 'var(--danger)' : 'var(--bg-raised)';
  const color = isDanger ? 'var(--on-action)' : 'var(--text-on-raised)';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-w-0 flex flex-col items-center justify-center rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${isDanger ? 'gap-2 px-4 py-6 min-h-[9rem] text-[11px]' : 'gap-1 px-3 py-5 text-[10px]'}`}
      style={{ backgroundColor: bg, color, border: isDanger ? '1px solid var(--danger-border)' : '1px solid var(--border)', overflowWrap: 'anywhere' }}
    >
      {icon && (
        <span
          className={`rounded-2xl flex items-center justify-center ${isDanger ? 'w-14 h-14' : 'w-10 h-10'}`}
          style={{ backgroundColor: isDanger ? 'rgba(255,255,255,0.14)' : 'var(--bg-card)' }}
        >
          {icon}
        </span>
      )}
      <span className={`text-center whitespace-normal ${isDanger ? 'leading-tight max-w-[18ch]' : 'leading-snug'}`}>{label}</span>
      {sub && <span className={`font-medium normal-case tracking-normal ${isDanger ? 'text-[10px] opacity-90' : 'text-[9px] opacity-60'}`}>{sub}</span>}
    </button>
  );
}

const FREQ_OPTIONS = [
  { value: 'OD',  labelKey: 'settings.medications.frequency_od' },
  { value: 'BD',  labelKey: 'settings.medications.frequency_bd' },
  { value: 'TDS', labelKey: 'settings.medications.frequency_tds' },
  { value: 'QDS', labelKey: 'settings.medications.frequency_qds' },
  { value: 'PRN', labelKey: 'settings.medications.frequency_prn' },
];
const UNIT_OPTIONS = ['mg', 'g', 'mcg', 'ml', 'IU'];
// Ingredient names are shown with an initial capital (e.g. "Levetiracetam")
const capitalise = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
const stripLeadingEmoji = (text) => String(text || '').replace(/^[^\p{Letter}\p{Number}]+/u, '').trim();
const frequencyShortLabel = (frequency, t) => t(`settings.medications.frequency_short_${String(frequency || '').toLowerCase()}`, frequency);

function getSlotLabel(index, frequency, t) {
  if (frequency === 'BD') return index === 0 ? t('settings.medications.slot_morning') : t('settings.medications.slot_evening');
  if (frequency === 'TDS') return [t('settings.medications.slot_morning'), t('settings.medications.slot_afternoon'), t('settings.medications.slot_evening')][index] || t('settings.medications.slot_dose_n', { n: index + 1 });
  if (frequency === 'QDS') return [t('settings.medications.slot_morning'), t('settings.medications.slot_midday'), t('settings.medications.slot_afternoon'), t('settings.medications.slot_evening')][index] || t('settings.medications.slot_dose_n', { n: index + 1 });
  return t('settings.medications.slot_dose_time');
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABEL_KEYS = [
  'settings.medications.day_sun',
  'settings.medications.day_mon',
  'settings.medications.day_tue',
  'settings.medications.day_wed',
  'settings.medications.day_thu',
  'settings.medications.day_fri',
  'settings.medications.day_sat',
];

const EMPTY_MED = { name: '', dose: '', unit: 'mg', frequency: 'BD', isRescue: false, scheduledTimes: ['08:00', '20:00'], scheduledDays: ALL_DAYS, reminderEnabled: false, showInEmergency: false };

// lockedName: editing an existing medication — the name can only change through "Change name"
// with a reason, so a rename can't silently turn one medicine into another.
function MedForm({ form, setForm, onSave, onCancel, saveLabel = 'Save', formTitle = null, lockedName = false, knownIngredients = [], knownForms = [], onDifferentMedicine }) {
  const { t } = useTranslation();
  const isPRN = form.frequency === 'PRN';
  const [nameUnlocked, setNameUnlocked] = useState(false);
  const [askNameReason, setAskNameReason] = useState(false);
  const [perSlot, setPerSlot] = useState(Object.keys(form.slotDoses || {}).length > 0);

  const handleFreqChange = (freq) => {
    setPerSlot(false);
    setForm(f => ({ ...f, frequency: freq, isRescue: freq === 'PRN', scheduledTimes: defaultScheduledTimes(freq), slotDoses: {} }));
  };

  const chooseNameReason = (reason) => {
    setAskNameReason(false);
    if (reason === 'different') { onDifferentMedicine?.(); return; }
    setForm(f => ({ ...f, nameReason: reason }));
    setNameUnlocked(true);
  };

  const togglePerSlot = (on) => {
    setPerSlot(on);
    setForm(f => ({
      ...f,
      slotDoses: on ? Object.fromEntries((f.scheduledTimes || []).map(time => [time, f.dose])) : {},
    }));
  };

  const setSlotDose = (time, value) => setForm(f => ({ ...f, slotDoses: { ...(f.slotDoses || {}), [time]: value } }));

  const formOptions = [...MEDICATION_FORMS, ...knownForms.filter(f => !MEDICATION_FORMS.includes(f))];

  const scheduledDays = form.scheduledDays ?? ALL_DAYS;
  const isDaily = scheduledDays.length === 7;

  const toggleDay = (day) => {
    setForm(f => {
      const days = f.scheduledDays ?? ALL_DAYS;
      const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
      return { ...f, scheduledDays: next.length > 0 ? next : days };
    });
  };

  const setDaily = () => setForm(f => ({ ...f, scheduledDays: ALL_DAYS }));

  const updateTime = (i, val) => {
    setForm(f => {
      const times = [...(f.scheduledTimes || [])];
      const previous = times[i];
      times[i] = val;
      // A per-slot dose follows its slot when the time is edited
      const slotDoses = { ...(f.slotDoses || {}) };
      if (previous in slotDoses) {
        slotDoses[val] = slotDoses[previous];
        delete slotDoses[previous];
      }
      return { ...f, scheduledTimes: times, slotDoses };
    });
  };

  const times = form.scheduledTimes || defaultScheduledTimes(form.frequency);

  return (
    <Inset className="space-y-4">
      <FieldLabel>{formTitle || t('settings.medications.add_form_title')}</FieldLabel>
      {lockedName && !nameUnlocked ? (
        <div className="space-y-2">
          <div className="ui-row ui-row--split items-center">
            <TextInput value={form.name} readOnly aria-label={t('settings.medications.name_placeholder')} />
            <Button variant="secondary" size="md" onClick={() => setAskNameReason(a => !a)} aria-expanded={askNameReason}>
              {t('medication_changes.change_name')}
            </Button>
          </div>
          {askNameReason ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold" style={{ color: 'var(--text-dim)' }}>{t('medication_changes.name_reason_prompt')}</p>
              <ChoiceList
                value={null}
                onChange={chooseNameReason}
                options={['typo', 'brand', 'different'].map(reason => ({ value: reason, label: t(`medication_changes.name_reason_${reason}`) }))}
              />
            </div>
          ) : (
            <p className="ui-help">{t('medication_changes.name_locked_help')}</p>
          )}
        </div>
      ) : (
        <TextInput
          value={form.name}
          onChange={name => setForm(f => ({ ...f, name }))}
          placeholder={t('settings.medications.name_placeholder')}
          aria-label={t('settings.medications.name_placeholder')}
        />
      )}
      <Select
        aria-label={t('settings.medications.active_ingredient')}
        placeholder={t('settings.medications.active_ingredient')}
        value={form.activeIngredient || ''}
        onChange={activeIngredient => setForm(f => ({ ...f, activeIngredient: capitalise(activeIngredient) }))}
        options={knownIngredients.map(name => ({ value: name, label: name }))}
        allowCustom
        customLabel={t('settings.medications.active_ingredient_add_new')}
        customPlaceholder={t('settings.medications.active_ingredient_placeholder')}
      />
      <Select
        aria-label={t('settings.medications.form')}
        placeholder={t('settings.medications.form')}
        value={form.form || ''}
        onChange={value => setForm(f => ({ ...f, form: value }))}
        options={formOptions.map(f => ({ value: f, label: formLabel(f, t) }))}
        allowCustom
        customLabel={t('settings.medications.form_add_new')}
        customPlaceholder={t('settings.medications.form_custom_placeholder')}
      />
      <FieldRow split>
        <DecimalInput
          value={form.dose}
          onChange={dose => setForm(f => ({ ...f, dose }))}
          placeholder={t('settings.medications.dose_placeholder')}
          aria-label={t('settings.medications.dose_placeholder')}
        />
        <Select
          aria-label={t('medication_changes.field_unit')}
          value={form.unit}
          onChange={unit => setForm(f => ({ ...f, unit }))}
          options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))}
        />
      </FieldRow>
      <Select
        aria-label={t('medication_changes.field_frequency')}
        value={form.frequency}
        onChange={handleFreqChange}
        options={FREQ_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))}
      />

      {/* Scheduled times — one per dose slot (label above; time and optional per-slot dose side by side) */}
      {!isPRN && times.length > 0 && (
        <div className="space-y-3">
          <FieldLabel>{t('settings.medications.scheduled_times')}</FieldLabel>
          {times.map((time, i) => (
            <div key={i}>
              <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-dim)' }}>{getSlotLabel(i, form.frequency, t)}</p>
              <FieldRow min="8rem">
                <DateInput type="time" value={time} onChange={value => updateTime(i, value)} aria-label={getSlotLabel(i, form.frequency, t)} />
                {perSlot && (
                  <DecimalInput
                    value={form.slotDoses?.[time] ?? ''}
                    onChange={value => setSlotDose(time, value)}
                    placeholder={`${t('settings.medications.dose_placeholder')} (${form.unit})`}
                    aria-label={t('medication_changes.field_slot_dose', { time })}
                  />
                )}
              </FieldRow>
            </div>
          ))}
          {times.length > 1 && (
            <Row label={t('settings.medications.per_slot_dose')} help={t('settings.medications.per_slot_dose_help', { unit: form.unit })}>
              <Toggle value={perSlot} onChange={togglePerSlot} label={t('settings.medications.per_slot_dose')} />
            </Row>
          )}
        </div>
      )}

      {/* Days of week */}
      {!isPRN && (
        <div className="space-y-2">
          <FieldLabel>{t('settings.medications.active_days')}</FieldLabel>
          <div className="ui-chip-group">
            <button type="button" aria-pressed={isDaily} onClick={setDaily} className="ui-chip">{t('settings.medications.daily')}</button>
            {DAY_LABEL_KEYS.map((labelKey, day) => (
              <button
                key={day}
                type="button"
                aria-pressed={!isDaily && scheduledDays.includes(day)}
                onClick={() => toggleDay(day)}
                className="ui-chip"
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reminder toggle */}
      {!isPRN && (
        <Row label={t('settings.medications.dose_reminders')} help={t('settings.medications.dose_reminders_help')}>
          <Toggle value={form.reminderEnabled ?? false} onChange={v => setForm(f => ({ ...f, reminderEnabled: v }))} label={t('settings.medications.dose_reminders')} />
        </Row>
      )}

      {/* Show in emergency toggle */}
      <Row label={t('settings.medications.show_emergency')} help={t('settings.medications.show_emergency_help')}>
        <Toggle value={form.showInEmergency ?? false} onChange={v => setForm(f => ({ ...f, showInEmergency: v }))} label={t('settings.medications.show_emergency')} />
      </Row>

      <ButtonRow>
        <Button variant="success" onClick={onSave} disabled={!form.name.trim() || !form.dose}>{saveLabel}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('settings.medications.cancel')}</Button>
      </ButtonRow>
    </Inset>
  );
}


// Form values → medication fields. Per-slot doses are kept only for the current times.
function formToFields(form) {
  const times = form.frequency === 'PRN' ? [] : (form.scheduledTimes ?? defaultScheduledTimes(form.frequency));
  const slotDoses = {};
  for (const time of times) {
    const n = parseFloat(form.slotDoses?.[time]);
    if (Number.isFinite(n)) slotDoses[time] = n;
  }
  return {
    name: form.name.trim(),
    dose: parseFloat(form.dose),
    unit: form.unit,
    frequency: form.frequency,
    isRescue: form.frequency === 'PRN',
    scheduledTimes: form.scheduledTimes ?? defaultScheduledTimes(form.frequency),
    scheduledDays: form.frequency === 'PRN' ? ALL_DAYS : (form.scheduledDays ?? ALL_DAYS),
    reminderEnabled: form.reminderEnabled ?? false,
    showInEmergency: form.showInEmergency ?? false,
    activeIngredient: (form.activeIngredient || '').trim(),
    form: (form.form || '').trim(),
    slotDoses,
  };
}

const medSlots = (med) => (med.isRescue || med.frequency === 'PRN' ? [] : (med.scheduledTimes ?? defaultScheduledTimes(med.frequency)));

function MedicationSection({ flash, notificationPermission, onRequestNotificationPermission, settings, onUpdate }) {
  const { t } = useTranslation();
  const { medications, addMedication, updateMedication, stopMedication, restartMedication, replaceMedication, deleteMedication } = useMedications();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MED);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // A change waiting for confirmation: { kind: add|change|replace|stop|restart, med?, fields?, ... }
  const [pending, setPending] = useState(null);

  const activeMeds = medications.filter(m => m.active);
  const stoppedMeds = medications.filter(m => !m.active);
  // Built-in list plus the user's own ingredients, capitalised and de-duplicated ignoring case
  const knownIngredients = [...new Map([
    ...COMMON_ANTISEIZURE_INGREDIENTS,
    ...medications.map(m => capitalise((m.activeIngredient || '').trim())).filter(Boolean),
  ].map(name => [name.toLowerCase(), name])).values()].sort((a, b) => a.localeCompare(b));
  const knownForms = [...new Set(medications.map(m => m.form).filter(Boolean))];

  const closeEdit = () => { setEditingId(null); setEditForm(null); };

  const handleAdd = () => {
    if (!form.name.trim() || !form.dose) return;
    const fields = formToFields(form);
    setPending({
      kind: 'add',
      title: t('medication_changes.title_add'),
      name: fields.name,
      lines: [regimenSummary(regimenSnapshot(fields), t)],
      slots: medSlots(fields),
      fields,
    });
  };

  const startEdit = (med) => {
    setEditingId(med.id);
    setEditForm({
      name: med.name,
      dose: String(med.dose),
      unit: med.unit,
      frequency: med.frequency,
      isRescue: med.isRescue,
      scheduledTimes: med.scheduledTimes ?? defaultScheduledTimes(med.frequency),
      scheduledDays: med.scheduledDays ?? ALL_DAYS,
      reminderEnabled: med.reminderEnabled ?? false,
      showInEmergency: med.showInEmergency ?? false,
      activeIngredient: capitalise(med.activeIngredient ?? ''),
      form: med.form ?? '',
      slotDoses: Object.fromEntries(Object.entries(med.slotDoses ?? {}).map(([time, dose]) => [time, String(dose)])),
      nameReason: null,
      replaceMode: false,
    });
  };

  const handleUpdate = async () => {
    if (!editForm.name.trim() || !editForm.dose) return;
    const med = medications.find(m => m.id === editingId);
    const fields = formToFields(editForm);
    const oldIngredient = (med.activeIngredient || '').toLowerCase();
    const ingredientChanged = oldIngredient && oldIngredient !== fields.activeIngredient.toLowerCase();

    // A different active ingredient is a different medicine: stop the old one, start the new one
    if (editForm.replaceMode || ingredientChanged) {
      setPending({
        kind: 'replace',
        title: t('medication_changes.title_replace'),
        name: med.name,
        lines: [
          ...(ingredientChanged && !editForm.replaceMode ? [t('medication_changes.ingredient_changed')] : []),
          t('medication_changes.replace_line', { old: med.name, new: fields.name }),
          regimenSummary(regimenSnapshot(fields), t),
        ],
        slots: medSlots(fields),
        med,
        fields,
      });
      return;
    }

    const from = regimenSnapshot(med);
    const to = regimenSnapshot({ ...med, ...fields });
    const changedFields = diffRegimen(from, to).map(f => (f === 'name' && editForm.nameReason === 'brand' ? 'brand' : f));
    if (!changedFields.length) {
      // Only reminder / emergency display changed — nothing clinical to record
      try {
        await updateMedication(editingId, fields);
        closeEdit();
        flash(t('settings.medications.updated'));
      } catch {
        flash(t('settings.medications.update_failed'), 'error');
      }
      return;
    }
    setPending({
      kind: 'change',
      title: t('medication_changes.title_change'),
      name: med.name,
      lines: describeChange({ type: 'changed', from, to, changedFields }, t),
      slots: medSlots({ ...med, ...fields }),
      med,
      fields,
      nameReason: editForm.nameReason,
    });
  };

  const handleStop = (med) => setPending({
    kind: 'stop',
    title: t('medication_changes.title_stop'),
    name: med.name,
    lines: [regimenSummary(regimenSnapshot(med), t)],
    slots: medSlots(med),
    med,
  });

  const handleRestart = (med) => setPending({
    kind: 'restart',
    title: t('medication_changes.title_restart'),
    name: med.name,
    lines: [regimenSummary(regimenSnapshot(med), t)],
    slots: medSlots(med),
    med,
  });

  const confirmPending = async (opts) => {
    const { kind, med, fields, nameReason } = pending;
    try {
      if (kind === 'add') {
        await addMedication(fields, opts);
        setForm(EMPTY_MED);
        setShowForm(false);
        flash(t('settings.medications.added'));
      } else if (kind === 'change') {
        await updateMedication(med.id, fields, { ...opts, nameReason });
        closeEdit();
        flash(t('settings.medications.updated'));
      } else if (kind === 'replace') {
        await replaceMedication(med.id, fields, opts);
        closeEdit();
        flash(t('medication_changes.replaced_flash'));
      } else if (kind === 'stop') {
        await stopMedication(med.id, opts);
        flash(t('medication_changes.stopped_flash'));
      } else if (kind === 'restart') {
        await restartMedication(med.id, {}, opts);
        flash(t('medication_changes.restarted_flash'));
      }
      setPending(null);
    } catch (err) {
      console.error('Failed to save medication change:', err);
      flash(t('settings.medications.update_failed'), 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMedication(id);
      setDeleteConfirm(null);
      flash(t('settings.medications.removed'));
    } catch {
      flash(t('settings.data.delete_failed'), 'error');
    }
  };

  const toggleAssumeTaken = async (value) => {
    await onUpdate?.('assumeDosesTaken', value);
    await onUpdate?.('assumeDosesTakenSince', value ? new Date().toISOString() : '');
  };

	  const reminderStatusLabel = notificationPermission === 'granted'
	    ? t('settings.medications.reminder_granted')
	    : notificationPermission === 'denied'
	    ? t('settings.medications.reminder_denied')
	    : t('settings.medications.reminder_off');
	  const ReminderStatusIcon = notificationPermission === 'granted' ? BellIcon : BellOffIcon;

	  return (
    <Section title={t('settings.medications.section')}>
      <p className="text-[11px] text-[var(--text-dim)] -mt-2">{t('settings.medications.section_desc')}</p>

      {pending && (
        <MedicationChangeConfirm
          title={pending.title}
          medicationName={pending.name}
          lines={pending.lines}
          slots={pending.slots}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        >
          {pending.kind === 'stop' && (
            <Button variant="ghost" fullWidth style={{ color: 'var(--status-missed-text)' }} onClick={() => { setDeleteConfirm(pending.med.id); setPending(null); }}>
              {t('medication_changes.delete_mistake')}
            </Button>
          )}
        </MedicationChangeConfirm>
      )}

      {deleteConfirm != null && (() => {
        const target = medications.find(m => m.id === deleteConfirm);
        return target ? (
          <Dialog
            tone="danger"
            title={t('settings.medications.remove')}
            message={t('medication_changes.delete_confirm', { name: target.name })}
            onClose={() => setDeleteConfirm(null)}
            actions={(
              <>
                <Button variant="danger" fullWidth onClick={() => handleDelete(target.id)}>{t('settings.medications.remove')}</Button>
                <Button variant="secondary" fullWidth onClick={() => setDeleteConfirm(null)}>{t('settings.medications.cancel')}</Button>
              </>
            )}
          />
        ) : null;
      })()}

      {medications.length === 0 && !showForm && (
        <p className="text-xs italic text-center py-3" style={{ color: 'var(--text-faint)' }}>{t('settings.medications.none_recorded')}</p>
      )}

      <div className="space-y-2">
        {activeMeds.map(m => (
          <div key={m.id}>
            {editingId === m.id ? (
              <MedForm
                form={editForm}
                setForm={setEditForm}
                onSave={handleUpdate}
                onCancel={closeEdit}
                saveLabel={t('settings.medications.update')}
                formTitle={editForm.replaceMode ? t('medication_changes.replace_form_title', { name: m.name }) : t('settings.medications.edit_form_title')}
                lockedName={!editForm.replaceMode}
                knownIngredients={knownIngredients}
                knownForms={knownForms}
                onDifferentMedicine={() => setEditForm(f => ({ ...f, replaceMode: true, name: '', activeIngredient: '', form: '' }))}
              />
            ) : (
              <Inset className="!p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 basis-36" style={{ overflowWrap: 'anywhere' }}>
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
	                      {m.name}
	                      {m.showInEmergency && (
	                        <span className="app-status-badge app-status-badge--danger ml-2">
	                          <SirenIcon className="w-3 h-3" /> {stripLeadingEmoji(t('settings.medications.emergency_badge'))}
	                        </span>
	                      )}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {regimenDoseSummary(regimenSnapshot(m))} · {m.frequency} — {frequencyShortLabel(m.frequency, t)}
                    </p>
                    {(m.activeIngredient || m.form) && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {[m.activeIngredient, formLabel(m.form, t)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {m.scheduledTimes && m.scheduledTimes.length > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
	                        {m.scheduledTimes.join(' · ')}
	                        {m.reminderEnabled && <BellIcon className="inline-block ml-1.5 w-3 h-3 align-[-2px]" />}
                      </p>
                    )}
                    {scheduledDaysLabel(m.scheduledDays) && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {scheduledDaysLabel(m.scheduledDays)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(m)}
                      className="ui-icon-btn ui-icon-btn--accent"
                      aria-label={t('settings.medications.edit_label', { name: m.name })}
                    ><EditIcon className="w-4 h-4" /></button>
                    <button
                      onClick={() => handleStop(m)}
                      className="ui-icon-btn ui-icon-btn--danger"
                      aria-label={t('medication_changes.stop_label', { name: m.name })}
                    ><CloseIcon className="w-4 h-4" /></button>
                  </div>
                </div>
              </Inset>
            )}
          </div>
        ))}
      </div>

      {stoppedMeds.length > 0 && (
        <div className="space-y-2">
          <FieldLabel>{t('medication_changes.stopped_list')}</FieldLabel>
          {stoppedMeds.map(m => (
            (
              <Inset key={m.id} className="!p-3 flex flex-wrap items-center justify-between gap-2" style={{ borderStyle: 'dashed', opacity: 0.8 }}>
                <div className="min-w-0">
                  <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    {regimenDoseSummary(regimenSnapshot(m))}
                    {m.stoppedAt ? ` · ${t('settings.medications.stopped_on', { date: new Date(m.stoppedAt).toLocaleDateString() })}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRestart(m)}
                    className="ui-btn ui-btn--primary ui-btn--sm"
                  >
                    {t('medication_changes.restart')}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(m.id)}
                    className="ui-icon-btn ui-icon-btn--danger"
                    aria-label={t('settings.medications.remove_label', { name: m.name })}
                  ><TrashIcon className="w-4 h-4" /></button>
                </div>
              </Inset>
            )
          ))}
        </div>
      )}

      {showForm ? (
        <MedForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => { setShowForm(false); setForm(EMPTY_MED); }} saveLabel={t('settings.medications.add')} formTitle={t('settings.medications.add_form_title')} knownIngredients={knownIngredients} knownForms={knownForms} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="ui-btn ui-btn--primary ui-btn--md ui-btn--full"
        >
          {t('settings.medications.add_btn')}
        </button>
      )}

      {/* Medication tracking start date */}
      <div className="border-t pt-4 mt-2 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <FieldLabel>{t('settings.medications.start_date')}</FieldLabel>
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {t('settings.medications.start_date_help')}
        </p>
        <DateInput
          value={settings?.medicationStartDate || ''}
          onChange={value => onUpdate?.('medicationStartDate', value)}
          aria-label={t('settings.medications.start_date')}
        />
      </div>

      {/* Assume doses taken */}
      <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <Row label={t('settings.medications.assume_taken')} help={t('settings.medications.assume_taken_help')}>
          <Toggle value={settings?.assumeDosesTaken === true} onChange={toggleAssumeTaken} label={t('settings.medications.assume_taken')} />
        </Row>
      </div>

      {/* Notification permissions */}
      <div className="border-t pt-4 mt-2 space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <FieldLabel>{t('settings.medications.reminder_section')}</FieldLabel>
        <div className="flex items-center justify-between">
          <div>
	            <p className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
	              <ReminderStatusIcon className="w-4 h-4" />
	              {stripLeadingEmoji(reminderStatusLabel)}
	            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {notificationPermission === 'granted' ? t('settings.medications.reminder_granted_help') :
               notificationPermission === 'denied'  ? t('settings.medications.reminder_denied_help') :
               t('settings.medications.reminder_off_help')}
            </p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
            <button
              onClick={onRequestNotificationPermission}
              className="ui-btn ui-btn--primary ui-btn--sm ml-3 shrink-0"
            >
              {t('settings.medications.reminder_enable')}
            </button>
          )}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {t('settings.medications.ios_reminder_note')}
        </p>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────

export function SettingsForm({ settings, onUpdate, onReset, pwa, activeTab, notificationPermission, onRequestNotificationPermission, onSync, storagePersistence, onBackupSuccess }) {
  const { t } = useTranslation();
  const fileInputRef = useRef();
  const [storageInfo, setStorageInfo] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [backupModal, setBackupModal] = useState({ mode: null, fileName: '', fileText: '' });
  const wellbeingFactors = Array.isArray(settings.wellbeingFactorDefinitions) && settings.wellbeingFactorDefinitions.length
    ? settings.wellbeingFactorDefinitions
    : DEFAULT_WELLBEING_FACTORS;

  useEffect(() => {
    if ('storage' in navigator) {
      navigator.storage.estimate().then(est => {
        const usedKB = Math.round((est.usage || 0) / 1024);
        const quotaMB = Math.round((est.quota || 0) / 1024 / 1024);
        setStorageInfo({ usedKB, quotaMB });
      });
    }
  }, []);

  // Settings messages use the app-wide toasts so they show on every settings tab
  const showToast = useToast();
  const flash = (msg, tone = 'success') => showToast(msg, tone);
  const summarizeImportResult = (result) => {
    const parts = [];
    if (result.settings) parts.push(t('settings.data.import_summary_settings', { count: result.settings }));
    if (result.events) parts.push(t('settings.data.import_summary_events', { count: result.events }));
    if (result.medications) parts.push(t('settings.data.import_summary_medications', { count: result.medications }));
    if (result.logs) parts.push(t('settings.data.import_summary_logs', { count: result.logs }));
    if (result.medicationChanges) parts.push(t('settings.data.import_summary_med_changes', { count: result.medicationChanges }));
    if (result.medicationsUpdated) parts.push(t('settings.data.import_summary_meds_updated', { count: result.medicationsUpdated }));
    if (result.medicationsDeleted) parts.push(t('settings.data.import_summary_meds_deleted', { count: result.medicationsDeleted }));
    if (result.eegSessions) parts.push(t('settings.data.import_summary_eeg_sessions', { count: result.eegSessions }));
    if (result.eegActivities) parts.push(t('settings.data.import_summary_eeg_activities', { count: result.eegActivities }));
    if (result.wellbeingEntries) parts.push(t('settings.data.import_summary_wellbeing', { count: result.wellbeingEntries, defaultValue: '{{count}} wellbeing entries' }));
    const conflicts = result.conflicts?.length
      ? ` ${t('settings.data.import_summary_conflicts', { count: result.conflicts.length })}`
      : '';
    return `${parts.join(', ') || t('settings.data.imported_nothing')}.${conflicts}`;
  };

  const handleExportBackup = () => setBackupModal({ mode: 'export', fileName: '', fileText: '' });

  const processImport = async (file) => {
    try {
      assertImportFileSafe(file);
      const text = await file.text();
      const parsed = parseBackupFileText(text);
      if (parsed.kind === 'encrypted') {
        setBackupModal({ mode: 'import', fileName: file.name, fileText: text });
        return;
      }
      const result = await mergeRemoteData(parsed.parsed);
      flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
    } catch (err) {
      console.error('Import failed:', err);
      flash(t('settings.data.import_failed'), 'error');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processImport(file);
    e.target.value = '';
  };

  const handleImportClick = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'AuraTrack Backup', accept: { 'application/json': ['.json', '.atbak'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        await processImport(file);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleClearAllData = async () => {
    try {
      await Promise.all([
        db.events.clear(),
        db.medications.clear().catch(() => {}),
        db.medicationLogs.clear().catch(() => {}),
        db.medicationChanges.clear().catch(() => {}),
        db.wellbeingEntries?.clear?.().catch(() => {}),
      ]);
      setShowClearConfirm(false);
      flash(t('settings.data.all_deleted'));
    } catch (err) {
      console.error('Failed to clear data:', err);
      flash(t('settings.data.delete_failed'), 'error');
    }
  };

  const handleResetSettings = async () => {
    await onReset?.();
    setShowResetConfirm(false);
    flash(t('settings.data.settings_reset'));
  };

  const handleEncryptedImportSuccess = (result) => {
    flash(t('settings.data.imported', { summary: summarizeImportResult(result) }));
  };

  const handleEncryptedExportSuccess = async (summary) => {
    await onBackupSuccess?.(summary);
    flash(t('settings.data.exported', { events: summary.events, meds: summary.medications }));
  };

  const updateWellbeingFactor = (index, changes) => {
    const next = wellbeingFactors.map((factor, i) => i === index ? { ...factor, ...changes } : factor);
    onUpdate('wellbeingFactorDefinitions', next);
  };

  const addWellbeingFactor = () => {
    const id = `custom-${Date.now()}`;
    onUpdate('wellbeingFactorDefinitions', [
      ...wellbeingFactors,
      { id, label: t('settings.recording.custom_factor', 'Custom factor'), type: 'boolean', unit: '', help: '', active: true },
    ]);
  };

  const removeWellbeingFactor = (index) => {
    onUpdate('wellbeingFactorDefinitions', wellbeingFactors.filter((_, i) => i !== index));
  };

  const persistenceStatusLabel = {
    checking: t('settings.data.persistence_checking', 'Checking storage protection…'),
    granted: t('settings.data.persistence_granted', 'Persistent storage enabled'),
    not_requested: t('settings.data.persistence_not_requested', 'Permission can be requested'),
    denied: t('settings.data.persistence_denied', 'Best-effort storage only'),
    unsupported: t('settings.data.persistence_unsupported', 'Persistent storage not supported'),
    error: t('settings.data.persistence_error', 'Persistent storage request failed'),
  }[storagePersistence?.status || 'checking'];

  const persistenceStatusHelp = {
    checking: t('settings.data.persistence_help_checking', 'AuraTrack is checking whether the browser will protect this PWA storage from eviction.'),
    granted: t('settings.data.persistence_help_granted', 'Browser-managed storage has been marked persistent. Data should not be evicted except by explicit user action.'),
    not_requested: t('settings.data.persistence_help_not_requested', 'This browser may show a permission prompt, so AuraTrack waits for you to request storage protection manually.'),
    denied: t('settings.data.persistence_help_denied', 'The browser did not grant persistent storage. Backups remain the main protection against data loss.'),
    unsupported: t('settings.data.persistence_help_unsupported', 'This browser does not expose persistent storage controls. Backups remain the main protection against data loss.'),
    error: t('settings.data.persistence_help_error', 'AuraTrack could not confirm persistent storage protection on this device. Backups remain the main protection against data loss.'),
  }[storagePersistence?.status || 'checking'];

  const persistenceFlowDetail = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_detail_flow_prompt', 'User-initiated request. A browser permission prompt may appear when you tap the button.')
    : t('settings.data.persistence_detail_flow_auto', 'Automatic browser decision. The browser may silently grant or deny without showing a permission popup.');

  const persistenceBrowserDetail = storagePersistence?.engine === 'webkit'
    ? t('settings.data.persistence_detail_browser_webkit', 'WebKit browsers on iPhone/iPad and Safari-class environments usually decide this silently. Installing the app can help storage quotas, but backups are still essential.')
    : storagePersistence?.engine === 'chromium'
      ? t('settings.data.persistence_detail_browser_chromium', 'Chromium browsers such as Chrome and Edge usually decide this from browser heuristics, so tapping again may recheck without showing a prompt.')
      : storagePersistence?.engine === 'gecko'
        ? t('settings.data.persistence_detail_browser_gecko', 'Firefox-class browsers may show a permission prompt when requested from this screen.')
        : t('settings.data.persistence_detail_browser_generic', 'Browser behavior varies by engine and device.');

  const persistenceReasonDetail = (storagePersistence?.status === 'denied' || storagePersistence?.status === 'not_requested')
    ? t('settings.data.persistence_detail_reason', 'Exact denial reasons are not exposed by the web API, so AuraTrack can only show the browser result, not why it decided that way.')
    : null;

  const persistenceActionLabel = storagePersistence?.promptBehavior === 'user-prompt-possible'
    ? t('settings.data.persistence_request', 'Request access')
    : t('settings.data.persistence_retry', 'Try again');

  const persistenceTechnicalDetails = storagePersistence?.supported
    ? [
        {
          label: t('settings.data.persistence_detail_browser_label', 'Browser'),
          value: `${storagePersistence.browserLabel || t('settings.data.persistence_detail_unknown', 'Unknown')} · ${storagePersistence.platformLabel || t('settings.data.persistence_detail_unknown', 'Unknown')}`,
        },
        {
          label: t('settings.data.persistence_detail_flow_label', 'Request mode'),
          value: persistenceFlowDetail,
        },
        {
          label: t('settings.data.persistence_detail_api_label', 'Web API'),
          value: 'navigator.storage.persist() / persisted()',
        },
      ]
    : [];

  const lastBackupLabel = settings.lastSuccessfulBackupAt
    ? new Date(settings.lastSuccessfulBackupAt).toLocaleString()
    : t('settings.data.backup_never', 'Never');

  const noteLabel = settings.userMode === 'CARETAKER' ? t('settings.identity.patient_name') : t('settings.identity.your_name');
  const tab = activeTab || 'identity';
  const show = (id) => !activeTab || tab === id;

  return (
    <div className="space-y-4 w-full pb-10">

      {/* ── IDENTITY / PROFILE ── */}
      {show('identity') && <Section title={t('settings.identity.section')}>
        <div>
          <FieldLabel>{t('settings.identity.mode')}</FieldLabel>
          <Segments
            options={[
              { value: 'CARETAKER', label: t('settings.identity.mode_caretaker') },
              { value: 'PATIENT',   label: t('settings.identity.mode_self') }
            ]}
            value={settings.userMode}
            onChange={v => onUpdate('userMode', v)}
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-2">
            {settings.userMode === 'CARETAKER'
              ? t('settings.identity.mode_desc_caretaker')
              : t('settings.identity.mode_desc_self')}
          </p>
        </div>
        <TextField label={noteLabel} value={settings.personName} onChange={v => onUpdate('personName', v)} placeholder={t('settings.identity.name_placeholder')} />
        {settings.userMode === 'CARETAKER' && (
          <TextField label={t('settings.identity.caretaker_name')} value={settings.caretakerName} onChange={v => onUpdate('caretakerName', v)} placeholder={t('settings.identity.caretaker_placeholder')} />
        )}
        <TextField label={t('settings.identity.dob')} value={settings.dateOfBirth} onChange={v => onUpdate('dateOfBirth', v)} type="date" />
        <TextField label={t('settings.identity.emergency_contact')} value={settings.emergencyContact} onChange={v => onUpdate('emergencyContact', v)} placeholder={t('settings.identity.emergency_placeholder')} />
      </Section>}

      {/* ── APPEARANCE + DISPLAY ── */}
      {show('appearance') && <Section title={t('settings.appearance.section')}>
        <div>
          <FieldLabel>{t('settings.appearance.theme')}</FieldLabel>
          <Segments
            options={[
              { value: 'dark',   label: t('settings.appearance.theme_dark') },
              { value: 'light',  label: t('settings.appearance.theme_light') },
              { value: 'system', label: t('settings.appearance.theme_system') }
            ]}
            value={settings.theme}
            onChange={v => onUpdate('theme', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.accent')}</FieldLabel>
          <div className="flex gap-4 flex-wrap pt-1">
            {[
              { key: 'red',    hex: '#dc2626', label: t('settings.appearance.accent_red')    },
              { key: 'blue',   hex: '#5b8def', label: t('settings.appearance.accent_blue')   },
              { key: 'green',  hex: '#16a34a', label: t('settings.appearance.accent_green')  },
              { key: 'purple', hex: '#9333ea', label: t('settings.appearance.accent_purple') },
              { key: 'amber',  hex: '#d97706', label: t('settings.appearance.accent_amber')  },
            ].map(({ key, hex, label }) => (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <button
                  title={label}
                  onClick={() => onUpdate('accentColor', key)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    settings.accentColor === key
                      ? 'ring-4 ring-offset-2 scale-110'
                      : 'opacity-50 active:opacity-100'
                  }`}
                  style={{ backgroundColor: hex, outlineColor: hex }}
                />
                <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.text_size')}</FieldLabel>
          <Segments
            options={[
              { value: 'small',  label: 'S'      },
              { value: 'normal', label: t('settings.appearance.text_size_normal', 'Normal') },
              { value: 'large',  label: 'L'      },
              { value: 'xlarge', label: 'XL'     },
            ]}
            value={settings.fontSize}
            onChange={v => onUpdate('fontSize', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.appearance.language')}</FieldLabel>
          <select
            value={settings.language || 'en'}
            onChange={e => {
              i18n.changeLanguage(e.target.value);
              onUpdate('language', e.target.value);
            }}
            className="ui-field"
          >
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </Section>}

      {show('appearance') && <Section title={t('settings.display.section')}>
        <div>
          <FieldLabel>{t('settings.display.page_size')}</FieldLabel>
          <Segments
            options={[5, 10, 25, 50].map(n => ({ value: n, label: String(n) }))}
            value={settings.historyPageSize}
            onChange={v => onUpdate('historyPageSize', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.date_format')}</FieldLabel>
          <select
            value={settings.dateFormat}
            onChange={e => onUpdate('dateFormat', e.target.value)}
            className="ui-field"
          >
            <option value="locale">{t('settings.display.date_system')}</option>
            <option value="ISO">ISO  — 2025-05-14</option>
            <option value="US">US   — 05/14/2025</option>
            <option value="EU">EU   — 14/05/2025</option>
          </select>
        </div>
        <div>
          <FieldLabel>{t('settings.display.duration_display')}</FieldLabel>
          <Segments
            options={[{ value: 'seconds', label: '123s' }, { value: 'human', label: '2m 3s' }]}
            value={settings.durationFormat}
            onChange={v => onUpdate('durationFormat', v)}
          />
        </div>
        <div>
          <FieldLabel>{t('settings.display.time_format')}</FieldLabel>
          <Segments
            options={[{ value: '12h', label: '12h' }, { value: '24h', label: '24h' }]}
            value={settings.timeFormat}
            onChange={v => onUpdate('timeFormat', v)}
          />
        </div>
      </Section>}

      {/* ── RECORDING ── */}
      {show('recording') && <Section title={t('settings.recording.section')}>
        <Row label={t('settings.recording.haptic')} help={t('settings.recording.haptic_help')}>
          <Toggle value={settings.hapticFeedback} onChange={v => onUpdate('hapticFeedback', v)} label={t('settings.recording.haptic')} />
        </Row>
        <Row label={t('settings.recording.eeg_diary')} help={t('settings.recording.eeg_diary_help')}>
          <Toggle value={settings.eegDiaryEnabled} onChange={v => onUpdate('eegDiaryEnabled', v)} label={t('settings.recording.eeg_diary')} />
        </Row>
        <Row
          label={t('settings.recording.wellbeing', 'Wellbeing tracking')}
          help={t('settings.recording.wellbeing_help', 'Optional mood and context logging for pattern spotting.')}
        >
          <Toggle value={settings.wellbeingEnabled !== false} onChange={v => onUpdate('wellbeingEnabled', v)} label={t('settings.recording.wellbeing', 'Wellbeing tracking')} />
        </Row>
        {settings.wellbeingEnabled !== false && (
          <div className="space-y-4">
            <Row
              label={t('settings.recording.wellbeing_reminder', 'Daily wellbeing reminder')}
              help={t('settings.recording.wellbeing_reminder_help', 'Optional reminder. It is skipped after a wellbeing entry is saved for the day.')}
            >
              <Toggle
                value={settings.wellbeingDailyReminderEnabled === true}
                onChange={async value => {
                  if (value && notificationPermission !== 'granted') {
                    const permission = await onRequestNotificationPermission?.();
                    if (permission !== 'granted') return;
                  }
                  onUpdate('wellbeingDailyReminderEnabled', value);
                }}
                label={t('settings.recording.wellbeing_reminder', 'Daily wellbeing reminder')}
              />
            </Row>
            {settings.wellbeingDailyReminderEnabled && (
              <TextField
                label={t('settings.recording.wellbeing_reminder_time', 'Reminder time')}
                value={settings.wellbeingReminderTime || '20:00'}
                onChange={v => onUpdate('wellbeingReminderTime', v)}
                type="time"
              />
            )}
            <div>
              <FieldLabel>{t('settings.recording.wellbeing_factors', 'Wellbeing factors')}</FieldLabel>
              <p className="text-[11px] text-[var(--text-dim)] mb-3">
                {t('settings.recording.wellbeing_factors_help', 'Choose the context fields shown in the wellbeing sheet. Existing diary entries keep their saved labels.')}
              </p>
              <div className="space-y-3">
                {wellbeingFactors.map((factor, index) => (
                  <div
                    key={factor.id || index}
                    className="rounded-2xl p-3 space-y-2"
                    style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={factor.label || ''}
                        onChange={e => updateWellbeingFactor(index, { label: e.target.value })}
                        className="ui-field"
                      />
                      <Toggle
                        value={factor.active !== false}
                        onChange={value => updateWellbeingFactor(index, { active: value })}
                        label={factor.label || t('settings.recording.factor_active', 'Factor active')}
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <select
                        value={factor.type || 'boolean'}
                        onChange={e => updateWellbeingFactor(index, { type: e.target.value })}
                        className="ui-field"
                      >
                        <option value="boolean">{t('settings.recording.factor_type_boolean', 'Present / absent')}</option>
                        <option value="scale">{t('settings.recording.factor_type_scale', 'Scale 0-3')}</option>
                        <option value="number">{t('settings.recording.factor_type_number', 'Number')}</option>
                      </select>
                      <input
                        value={factor.unit || ''}
                        onChange={e => updateWellbeingFactor(index, { unit: e.target.value })}
                        placeholder={t('settings.recording.factor_unit_placeholder', 'Unit')}
                        className="ui-field w-20"
                      />
                    </div>
                    <textarea
                      value={factor.help || ''}
                      onChange={e => updateWellbeingFactor(index, { help: e.target.value })}
                      placeholder={t('settings.recording.factor_help_placeholder', 'Tooltip/helper text')}
                      rows={2}
                      className="ui-field"
                    />
                    <button
                      onClick={() => removeWellbeingFactor(index)}
                      className="ui-btn ui-btn--danger ui-btn--sm"
                    >
                      {t('settings.recording.remove_factor', 'Remove factor')}
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={addWellbeingFactor}
                  className="ui-btn ui-btn--secondary ui-btn--md"
                >
                  {t('settings.recording.add_factor', 'Add factor')}
                </button>
                <button
                  onClick={() => onUpdate('wellbeingFactorDefinitions', DEFAULT_WELLBEING_FACTORS)}
                  className="ui-btn ui-btn--secondary ui-btn--md"
                >
                  {t('settings.recording.reset_factors', 'Reset factors')}
                </button>
              </div>
            </div>
          </div>
        )}
        <div>
          <FieldLabel>{t('settings.recording.quick_labels')}</FieldLabel>
          <p className="text-[11px] text-[var(--text-dim)] mb-3">{t('settings.recording.quick_labels_help')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(settings.quickNoteLabels || []).map((label, i) => (
              <input
                key={i}
                value={label}
                onChange={e => {
                  const updated = [...settings.quickNoteLabels];
                  updated[i] = e.target.value;
                  onUpdate('quickNoteLabels', updated);
                }}
                placeholder={t('settings.recording.button_n', { n: i + 1 })}
                className="ui-field text-center"
              />
            ))}
          </div>
        </div>
      </Section>}

      {/* ── DATA & BACKUP ── */}
      {show('data') && <Section title={t('settings.data.section')}>
        {storageInfo && (
          <Row label={t('settings.data.storage_used')} help={t('settings.data.storage_help')}>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {t('settings.data.storage_value', { kb: storageInfo.usedKB })}
              <span className="text-[var(--text-dim)] font-normal">{t('settings.data.storage_quota', { mb: storageInfo.quotaMB })}</span>
            </p>
          </Row>
        )}

        <Row
          label={t('settings.data.persistence_status', 'Storage protection')}
          help={
            <div className="space-y-2">
              <p>{persistenceStatusHelp}</p>
              <p>{persistenceBrowserDetail}</p>
              {persistenceReasonDetail && <p>{persistenceReasonDetail}</p>}
            </div>
          }
        >
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <p className="text-sm font-bold" style={{ color: storagePersistence?.persisted ? '#4ade80' : 'var(--text-primary)' }}>
              {persistenceStatusLabel}
            </p>
            {storagePersistence?.supported && !storagePersistence?.persisted && (
              <button
                onClick={() => storagePersistence.requestPersistence?.({ userInitiated: true })}
                className="ui-btn ui-btn--secondary ui-btn--sm"
              >
                {persistenceActionLabel}
              </button>
            )}
          </div>
        </Row>
        {persistenceTechnicalDetails.length > 0 && (
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {t('settings.data.persistence_details_title', 'Technical details')}
            </p>
            {persistenceTechnicalDetails.map((detail) => (
              <div key={detail.label} className="flex flex-col gap-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                  {detail.label}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <Row label={t('settings.data.last_backup', 'Last successful backup')} help={t('settings.data.last_backup_help', 'Updated when an encrypted backup file is saved successfully.')}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{lastBackupLabel}</p>
        </Row>

        <div>
          <Row label={t('settings.data.backup_reminders', 'Backup reminders')} help={t('settings.data.backup_reminders_help', 'Reminders appear when no successful backup has been created within the chosen interval.')}>
            <Toggle value={settings.backupReminderEnabled !== false} onChange={value => onUpdate('backupReminderEnabled', value)} label={t('settings.data.backup_reminders', 'Backup reminders')} />
          </Row>
          {settings.backupReminderEnabled !== false && (
            <div className="mt-3">
              <FieldLabel>{t('settings.data.backup_interval', 'Reminder interval')}</FieldLabel>
              <Segments
                options={[
                  { value: 7, label: t('settings.data.backup_interval_7', '7 days') },
                  { value: 14, label: t('settings.data.backup_interval_14', '14 days') },
                  { value: 30, label: t('settings.data.backup_interval_30', '30 days') },
                ]}
                value={settings.backupReminderIntervalDays || 7}
                onChange={value => onUpdate('backupReminderIntervalDays', value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionBtn label={t('settings.data.export_backup')} sub={t('settings.data.export_sub')} icon={<UploadIcon className="w-5 h-5" />} onClick={handleExportBackup} />
          <ActionBtn label={t('settings.data.import_data')}   sub={t('settings.data.import_sub')}    icon={<DownloadIcon className="w-5 h-5" />} onClick={handleImportClick} />
        </div>
        {onSync && (
          <ActionBtn label={t('settings.data.sync_device')} sub={t('settings.data.sync_sub')} icon={<SyncIcon className="w-5 h-5" />} onClick={onSync} />
        )}

        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            {t('settings.data.security_title')}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.data.security_current')}
          </p>
          <div className="space-y-2 pt-1">
            {['exports', 'sync', 'recommendation'].map((item) => (
              <div key={item} className="flex gap-2 items-start">
                <span className="text-xs leading-6" style={{ color: 'var(--accent-text)' }}>•</span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(`settings.data.security_${item}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".atbak,.json,application/json" className="hidden" onChange={handleImport} />



        {/* Danger Zone */}
        <div className="border-t mt-2 pt-5 space-y-3" style={{ borderColor: 'rgba(185,28,28,0.3)' }}>
          <p className="app-status-badge app-status-badge--danger">{t('settings.data.danger_zone')}</p>

          {showClearConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626' }}>
              <p className="text-white text-sm font-bold">{t('settings.data.clear_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleClearAllData} className="ui-btn ui-btn--danger ui-btn--md flex-1">
                  {t('settings.data.clear_yes')}
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="ui-btn ui-btn--secondary ui-btn--md flex-1">
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.clear_btn')} icon={<TrashIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowClearConfirm(true)} />
          )}
        </div>
      </Section>}

      {/* ── MEDICATIONS ── */}
      {show('medications') && <MedicationSection flash={flash} notificationPermission={notificationPermission} onRequestNotificationPermission={onRequestNotificationPermission} settings={settings} onUpdate={onUpdate} />}

      {/* ── REPORTS & NEUROLOGIST ── */}
      {show('clinician') && <Section title={t('settings.reports.section')}>
        <p className="text-[11px] text-[var(--text-dim)] -mt-2">{t('settings.reports.section_desc')}</p>
        <TextField label={t('settings.reports.neuro_name')} value={settings.neurologistName} onChange={v => onUpdate('neurologistName', v)} placeholder={t('settings.reports.neuro_name_placeholder')} />
        <TextField label={t('settings.reports.institution')} value={settings.neurologistInstitution} onChange={v => onUpdate('neurologistInstitution', v)} placeholder={t('settings.reports.institution_placeholder')} />
        <TextField label={t('settings.reports.contact')} value={settings.neurologistContact} onChange={v => onUpdate('neurologistContact', v)} placeholder={t('settings.reports.contact_placeholder')} />
        <Row label={t('settings.reports.include_dob')} help={t('settings.reports.include_dob_help')}>
          <Toggle value={settings.includePatientDOB !== false} onChange={v => onUpdate('includePatientDOB', v)} label={t('settings.reports.include_dob')} />
        </Row>
        <div>
          <FieldLabel>{t('settings.reports.additional_notes')}</FieldLabel>
          <textarea
            value={settings.reportNotes || ''}
            onChange={e => onUpdate('reportNotes', e.target.value)}
            placeholder={t('settings.reports.notes_placeholder')}
            rows={4}
            className="ui-field"
          />
        </div>
      </Section>}

      {/* ── ABOUT (shown in Data tab) ── */}
      {show('data') && <Section title={t('settings.about_section.section')}>
        <Row label={t('settings.about_section.version')}><p className="text-sm font-bold text-[var(--text-primary)]">AuraTrack v{pkg.version}</p></Row>
        <Row label={t('settings.about_section.schema')}><p className="text-sm font-bold text-[var(--text-primary)]">{db.name} v{db.verno}</p></Row>
        {pwa?.canInstallManually && (
          <div>
            <ActionBtn
              label={t('settings.about_section.reinstall')}
              sub={t('settings.about_section.reinstall_sub')}
              icon={<InstallIcon className="w-5 h-5" />}
              onClick={pwa.resetDismissal}
            />
          </div>
        )}
        <div className="pt-1">
          {showResetConfirm ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#7f1d1d', border: '1px solid #dc2626' }}>
              <p className="text-white text-sm font-bold">{t('settings.data.reset_confirm')}</p>
              <div className="flex gap-3">
                <button onClick={handleResetSettings} className="ui-btn ui-btn--danger ui-btn--md flex-1">
                  {t('settings.data.reset_yes')}
                </button>
                <button onClick={() => setShowResetConfirm(false)} className="ui-btn ui-btn--secondary ui-btn--md flex-1">
                  {t('settings.data.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <ActionBtn label={t('settings.data.reset_btn')} icon={<ResetIcon className="w-7 h-7" />} variant="danger" onClick={() => setShowResetConfirm(true)} />
          )}
        </div>
      </Section>}

      {backupModal.mode === 'export' && (
        <BackupTransferModal
          key="settings-backup-export"
          isOpen
          mode="export"
          settings={settings}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onExportSuccess={handleEncryptedExportSuccess}
        />
      )}

      {backupModal.mode === 'import' && (
        <BackupTransferModal
          key={`settings-backup-import-${backupModal.fileName}`}
          isOpen
          mode="import"
          fileName={backupModal.fileName}
          fileText={backupModal.fileText}
          onClose={() => setBackupModal({ mode: null, fileName: '', fileText: '' })}
          onImportSuccess={handleEncryptedImportSuccess}
        />
      )}

    </div>
  );
}
