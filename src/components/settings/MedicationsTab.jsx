import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedications } from '../../hooks/useMedications';
import { defaultScheduledTimes, diffRegimen, regimenSnapshot, scheduledDaysLabel } from '../../utils/medicationSchedule';
import { describeChange, formLabel, regimenDoseSummary, regimenSummary } from '../../utils/medicationChanges';
import { MEDICATION_FORMS, COMMON_ANTISEIZURE_INGREDIENTS } from '../../data/constants';
import { MedicationChangeConfirm } from '../MedicationChangeConfirm';
import { FieldLabel, Row, Section } from './atoms';
import {
  Button,
  ButtonRow,
  ChoiceList,
  DateInput,
  DecimalInput,
  Dialog,
  FieldRow,
  Inset,
  Select,
  TextInput,
  Toggle,
} from '../ui';
import { BellIcon, BellOffIcon, CloseIcon, EditIcon, SirenIcon, TrashIcon } from '../AppIcons';

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

export function MedicationSection({ flash, notificationPermission, onRequestNotificationPermission, settings, onUpdate }) {
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

