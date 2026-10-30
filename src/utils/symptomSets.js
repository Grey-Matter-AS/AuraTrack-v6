// ─── Saved symptom sets and the user's own symptoms ────────────
// Sets are stored under the settings key 'favoriteSymptomSets' (the original name, kept so existing
// data still loads): [{ id, name, seizureType, symptoms, autoName }]. A set belongs to one seizure type;
// sets saved before types existed have no seizureType and show under every type until assigned.
// The user's own symptoms ('customSymptoms') are remembered so they never have to be typed twice:
// [{ kind: 'symptom', group, label } | { kind: 'detail', group, symptom, label } | { kind: 'post_ictal', label }]
import { seizureTypeLabel } from '../data/constants';

export const SETS_KEY = 'favoriteSymptomSets';
export const CUSTOM_SYMPTOMS_KEY = 'customSymptoms';
export const MAX_SET_NAME = 60;
const MOST_USED_DAYS = 90;
const MOST_USED_LIMIT = 6;
const NO_AREA = new Set(['', 'N/A', 'Internal/General', 'General']);

export const capitalise = (text) => {
  const s = String(text ?? '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

// "Left Arm – Hand/Fingers" (empty when the symptom has no body area)
export function symptomArea(symptom) {
  return [symptom.subRegion, symptom.specificPart].filter(part => part && !NO_AREA.has(part)).join(' – ');
}

export function symptomLabel(symptom) {
  const area = symptomArea(symptom);
  const name = symptom.detail && symptom.detail !== symptom.symptom ? `${symptom.symptom}: ${symptom.detail}` : symptom.symptom;
  return area ? `${name} (${area})` : name;
}

// `<Seizure type> · <main symptom> (<main area>) + N more` — the main symptom is the first in the
// list, which the user orders by dragging in the summary
export function baseSetName(seizureType, symptoms, t) {
  const type = seizureTypeLabel(seizureType, t) || t('symptom_sets.no_type');
  const [main] = symptoms;
  if (!main) return type;
  const area = symptomArea(main);
  const more = symptoms.length > 1 ? ` ${t('symptom_sets.more', { count: symptoms.length - 1 })}` : '';
  return `${type} · ${main.symptom}${area ? ` (${area})` : ''}${more}`.slice(0, MAX_SET_NAME);
}

// Names are unique within a seizure type: a clash gets " (2)", " (3)"…
export function uniqueSetName(name, seizureType, sets, exceptId = null) {
  const taken = new Set(sets
    .filter(set => set.id !== exceptId && (set.seizureType || '') === (seizureType || ''))
    .map(set => set.name.trim().toLowerCase()));
  const base = name.trim().slice(0, MAX_SET_NAME);
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, MAX_SET_NAME - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export const suggestSetName = (seizureType, symptoms, sets, t, exceptId = null) =>
  uniqueSetName(baseSetName(seizureType, symptoms, t), seizureType, sets, exceptId);

// Sets offered for a seizure type: its own, then the ones not yet assigned to any type.
// No type chosen (skipped / Uncategorized): every set.
export function setsForType(sets, seizureType) {
  const list = Array.isArray(sets) ? sets : [];
  if (!seizureType || seizureType === 'Uncategorized') return list;
  return [...list.filter(set => set.seizureType === seizureType), ...list.filter(set => !set.seizureType)];
}

const symptomKey = (s) => [s.symptom, s.detail, s.region, s.subRegion, s.specificPart].join('|');

// The symptoms recorded most often for this type in the last 90 days (worked out from the history)
export function mostUsedSymptoms(events, seizureType, now = Date.now(), limit = MOST_USED_LIMIT) {
  if (!seizureType || seizureType === 'Uncategorized') return [];
  const since = now - MOST_USED_DAYS * 86400000;
  const counts = new Map();
  for (const event of events || []) {
    if (event.type !== seizureType || (event.startTime || 0) < since) continue;
    for (const symptom of event.symptoms || []) {
      if (!symptom?.symptom) continue;
      const key = symptomKey(symptom);
      const entry = counts.get(key) || { symptom, count: 0, last: 0 };
      entry.count += 1;
      entry.last = Math.max(entry.last, event.startTime || 0);
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map(entry => entry.symptom);
}

const sameCustom = (a, b) => a.kind === b.kind
  && (a.group || '') === (b.group || '')
  && (a.symptom || '').toLowerCase() === (b.symptom || '').toLowerCase()
  && a.label.toLowerCase() === b.label.toLowerCase();

// Adds a custom symptom to the user's list (capitalised, no duplicates ignoring case)
export function rememberCustom(list, entry) {
  const current = Array.isArray(list) ? list : [];
  const clean = { ...entry, label: capitalise(entry.label) };
  if (!clean.label) return current;
  return current.some(item => sameCustom(item, clean)) ? current : [...current, clean];
}

export const customSymptomsFor = (list, group) => (list || []).filter(item => item.kind === 'symptom' && item.group === group).map(item => item.label);
export const customDetailsFor = (list, group, symptom) => (list || [])
  .filter(item => item.kind === 'detail' && item.group === group && (item.symptom || '').toLowerCase() === String(symptom).toLowerCase())
  .map(item => item.label);
export const customPostIctal = (list) => (list || []).filter(item => item.kind === 'post_ictal').map(item => item.label);
