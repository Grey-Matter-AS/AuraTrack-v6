import { MEDICATION_FORMS } from '../data/constants';
import { scheduledDaysLabel, slotDose } from './medicationSchedule';

// Readable descriptions of medication change records, shared by Settings, History and reports.

export const formLabel = (form, t) =>
  MEDICATION_FORMS.includes(form) ? t(`medication_forms.${form}`) : (form || '');

const doseText = (dose, unit) => (dose != null && dose !== '' ? `${dose}${unit || ''}` : '—');

// "500mg" or, when slots differ, "08:00 500mg · 20:00 750mg"
export function regimenDoseSummary(regimen) {
  if (!regimen) return '';
  const times = regimen.frequency === 'PRN' ? [] : (regimen.scheduledTimes || []);
  const doses = times.map(time => slotDose(regimen, time));
  if (times.length > 1 && doses.some(d => Number(d) !== Number(doses[0]))) {
    return times.map((time, i) => `${time} ${doseText(doses[i], regimen.unit)}`).join(' · ');
  }
  return doseText(doses[0] ?? regimen.dose, regimen.unit);
}

export function regimenSummary(regimen, t) {
  if (!regimen) return '';
  const parts = [regimenDoseSummary(regimen), regimen.frequency];
  if (regimen.frequency !== 'PRN' && regimen.scheduledTimes?.length) parts.push(regimen.scheduledTimes.join(' · '));
  const days = scheduledDaysLabel(regimen.scheduledDays);
  if (days) parts.push(days);
  const extra = [regimen.activeIngredient, formLabel(regimen.form, t)].filter(Boolean).join(', ');
  return `${parts.join(' · ')}${extra ? ` (${extra})` : ''}`;
}

const daysText = (days, t) => scheduledDaysLabel(days) || t('medication_changes.daily');

function fieldLine(field, from, to, t) {
  const arrow = (a, b) => `${a || '—'} → ${b || '—'}`;
  if (field.startsWith('slotDose:')) {
    const time = field.slice('slotDose:'.length);
    return `${t('medication_changes.field_slot_dose', { time })}: ${arrow(doseText(slotDose(from, time), from.unit), doseText(slotDose(to, time), to.unit))}`;
  }
  switch (field) {
    case 'name': return `${t('medication_changes.field_name')}: ${arrow(from.name, to.name)}`;
    case 'brand': return `${t('medication_changes.field_brand')}: ${arrow(from.name, to.name)}`;
    case 'activeIngredient': return `${t('medication_changes.field_ingredient')}: ${arrow(from.activeIngredient, to.activeIngredient)}`;
    case 'form': return `${t('medication_changes.field_form')}: ${arrow(formLabel(from.form, t), formLabel(to.form, t))}`;
    case 'dose': return `${t('medication_changes.field_dose')}: ${arrow(doseText(from.dose, from.unit), doseText(to.dose, to.unit))}`;
    case 'unit': return `${t('medication_changes.field_unit')}: ${arrow(from.unit, to.unit)}`;
    case 'frequency': return `${t('medication_changes.field_frequency')}: ${arrow(from.frequency, to.frequency)}`;
    case 'scheduledTimes': return `${t('medication_changes.field_times')}: ${arrow(from.scheduledTimes.join(' · '), to.scheduledTimes.join(' · '))}`;
    case 'scheduledDays': return `${t('medication_changes.field_days')}: ${arrow(daysText(from.scheduledDays, t), daysText(to.scheduledDays, t))}`;
    default: return field;
  }
}

export const changeTypeLabel = (type, t) => t(`medication_changes.type_${type}`);

// Lines describing what a change did, e.g. ["20:00 dose: 500mg → 750mg"]
export function describeChange(change, t) {
  if (change.type === 'started') return [regimenSummary(change.to, t)];
  if (change.type === 'stopped') return [regimenSummary(change.from, t)];
  if (!change.from || !change.to) return [];
  return (change.changedFields || []).map(field => fieldLine(field, change.from, change.to, t));
}
