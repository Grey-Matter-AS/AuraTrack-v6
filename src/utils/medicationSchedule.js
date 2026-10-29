const DEFAULT_TIMES = {
  OD:  ['08:00'],
  BD:  ['08:00', '20:00'],
  TDS: ['08:00', '14:00', '20:00'],
  QDS: ['08:00', '12:00', '16:00', '20:00'],
  PRN: [],
};

export function defaultScheduledTimes(frequency) {
  return DEFAULT_TIMES[frequency] ?? [];
}

export function scheduledTimestampForDay(hhMM, dateMs) {
  const base = dateMs != null ? new Date(dateMs) : new Date();
  const [h, m] = hhMM.split(':').map(Number);
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return d.getTime();
}

export function scheduledTimestampForToday(hhMM) {
  return scheduledTimestampForDay(hhMM, Date.now());
}

// Returns 'taken' (within 90 min), 'late' (after 90 min), or 'missed' (no log)
export function getDoseStatus(scheduledHHMM, loggedAtMs, dayMs) {
  if (loggedAtMs == null) return 'missed';
  const scheduledTs = scheduledTimestampForDay(scheduledHHMM, dayMs ?? loggedAtMs);
  const diffMin = (loggedAtMs - scheduledTs) / 60000;
  return diffMin <= 90 ? 'taken' : 'late';
}

// Returns true if the medication is scheduled for the given day.
// scheduledDays absent or all 7 days = daily (always true).
export function isMedScheduledForDay(med, dayMs) {
  const days = med.scheduledDays;
  if (!days || days.length === 0 || days.length === 7) return true;
  return days.includes(new Date(dayMs).getDay());
}

// ─── Regimen history ─────────────────────────────────────────
// A regimen is the clinically relevant part of a medication. Every confirmed change stores the
// full regimen before (from) and after (to), so the regimen in force at any moment can be read
// straight off the change history.

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function regimenSnapshot(med) {
  return {
    name: med.name ?? '',
    activeIngredient: med.activeIngredient ?? '',
    form: med.form ?? '',
    dose: med.dose,
    unit: med.unit,
    slotDoses: { ...(med.slotDoses ?? {}) },
    frequency: med.frequency,
    scheduledTimes: [...(med.scheduledTimes ?? defaultScheduledTimes(med.frequency))],
    scheduledDays: [...(med.scheduledDays ?? ALL_DAYS)],
  };
}

// Dose for one time slot: a per-slot dose if set, otherwise the medication's default dose
export function slotDose(regimen, hhMM) {
  const perSlot = hhMM != null ? regimen?.slotDoses?.[hhMM] : undefined;
  return perSlot ?? regimen?.dose;
}

const sameList = (a = [], b = []) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

// Lists the clinically relevant fields that differ, e.g. ['name', 'slotDose:20:00', 'form']
export function diffRegimen(from, to) {
  const fields = [];
  // Ingredient spelling case doesn't make it a different medicine ("lamotrigine" = "Lamotrigine")
  const norm = (key, value) => (key === 'activeIngredient' ? String(value ?? '').toLowerCase() : (value ?? ''));
  for (const key of ['name', 'activeIngredient', 'form', 'unit', 'frequency']) {
    if (norm(key, from[key]) !== norm(key, to[key])) fields.push(key);
  }
  // Scheduled meds compare the effective dose of each slot both regimens share (new or removed
  // slots show up under scheduledTimes); as-needed meds compare the single dose
  const sharedTimes = to.frequency === 'PRN' ? [] : to.scheduledTimes.filter(t => from.scheduledTimes.includes(t));
  if (sharedTimes.length) {
    for (const hhMM of sharedTimes) {
      if (Number(slotDose(from, hhMM)) !== Number(slotDose(to, hhMM))) fields.push(`slotDose:${hhMM}`);
    }
  } else if (Number(from.dose) !== Number(to.dose)) {
    fields.push('dose');
  }
  if (!sameList(from.scheduledTimes, to.scheduledTimes)) fields.push('scheduledTimes');
  if (!sameList(from.scheduledDays, to.scheduledDays)) fields.push('scheduledDays');
  return fields;
}

export const changeBelongsTo = (change, med) =>
  change.medicationUuid && med.uuid ? change.medicationUuid === med.uuid : change.medicationId === med.id;

export function changesForMedication(med, changes = []) {
  return changes
    .filter(c => changeBelongsTo(c, med))
    .sort((a, b) => (a.effectiveAt - b.effectiveAt) || ((a.recordedAt ?? 0) - (b.recordedAt ?? 0)));
}

// The regimen in force at timestamp ts, or null when the medication was not being taken then.
// Medications without any change records (older data) fall back to their current state.
export function regimenAt(med, changes, ts) {
  const own = changesForMedication(med, changes);
  if (!own.length) {
    if (!med.active || med.deletedAt) return null;
    if (med.startedAt != null && ts < med.startedAt) return null;
    return regimenSnapshot(med);
  }
  const applicable = own.filter(c => c.effectiveAt <= ts);
  if (!applicable.length) {
    // Before the first record: if that record is a change (no 'started' on file), the medication
    // was already being taken on the change's "from" regimen
    const first = own[0];
    if (first.type === 'started' || (med.startedAt != null && ts < med.startedAt)) return null;
    return first.from ?? null;
  }
  const latest = applicable[applicable.length - 1];
  if (latest.type === 'stopped') return null;
  // The newest change is the medication's current state — read the live record so a later
  // non-clinical edit (or an edit synced from an older app version) is still reflected
  if (latest === own[own.length - 1]) return med.active && !med.deletedAt ? regimenSnapshot(med) : null;
  return latest.to ?? regimenSnapshot(med);
}

function dosesForRegimen(med, regimen, dateMs, hhMM) {
  return {
    medicationId: med.id,
    medicationUuid: med.uuid ?? null,
    medicationName: med.name,
    dose: slotDose(regimen, hhMM),
    unit: regimen.unit,
    scheduledHHMM: hhMM,
    scheduledTs: scheduledTimestampForDay(hhMM, dateMs),
  };
}

// Expand all active non-PRN meds × scheduled times for a given day.
// When `changes` is passed, each slot uses the regimen in force at that slot's time, so a
// change effective from the 20:00 dose leaves the same day's 08:00 dose on the old regimen.
export function getScheduledDosesForDay(medications, dateMs, changes = null) {
  const doses = [];
  for (const med of medications) {
    if (med.deletedAt) continue;
    if (!changes) {
      if (!med.active || med.isRescue) continue;
      if (!isMedScheduledForDay(med, dateMs)) continue;
      const regimen = regimenSnapshot(med);
      for (const hhMM of regimen.scheduledTimes) doses.push(dosesForRegimen(med, regimen, dateMs, hhMM));
      continue;
    }
    const dayStart = new Date(dateMs); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateMs); dayEnd.setHours(23, 59, 59, 999);
    const candidates = new Set();
    for (const ts of [dayStart.getTime(), dayEnd.getTime()]) {
      regimenAt(med, changes, ts)?.scheduledTimes.forEach(t => candidates.add(t));
    }
    changesForMedication(med, changes)
      .filter(c => c.effectiveAt >= dayStart.getTime() && c.effectiveAt <= dayEnd.getTime())
      .forEach(c => c.to?.scheduledTimes?.forEach(t => candidates.add(t)));
    for (const hhMM of candidates) {
      const ts = scheduledTimestampForDay(hhMM, dateMs);
      const regimen = regimenAt(med, changes, ts);
      if (!regimen || regimen.frequency === 'PRN' || med.isRescue) continue;
      if (!regimen.scheduledTimes.includes(hhMM) || !isMedScheduledForDay(regimen, dateMs)) continue;
      doses.push(dosesForRegimen(med, regimen, dateMs, hhMM));
    }
  }
  doses.sort((a, b) => a.scheduledTs - b.scheduledTs);
  return doses;
}

// Returns groups for the dose panel: only upcoming slots + past slots that are unlogged (missed).
// Taken/late doses disappear from the panel once logged.
export function getVisibleDosesForPanel(medications, todayLogs, nowMs = Date.now()) {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const groups = {};
  for (const med of medications) {
    if (!med.active || med.isRescue) continue;
    if (!isMedScheduledForDay(med, todayMs)) continue;
    const times = med.scheduledTimes ?? defaultScheduledTimes(med.frequency);
    for (const hhMM of times) {
      const scheduledTs = scheduledTimestampForDay(hhMM, todayMs);
      if (scheduledTs <= nowMs) {
        // Past slot — hide if already successfully logged
        const logged = todayLogs.some(
          l => l.medicationId === med.id &&
               l.scheduledTime === hhMM &&
               l.status !== 'missed'
        );
        if (logged) continue;
      }
      if (!groups[hhMM]) groups[hhMM] = [];
      groups[hhMM].push(med);
    }
  }
  const sorted = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = groups[key];
  return sorted;
}

export function slotLabel(hhMM) {
  const [h] = hhMM.split(':').map(Number);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns a short display string for scheduledDays, e.g. "Mon · Wed · Fri"
// Returns null when all 7 days are selected (daily — no need to display).
export function scheduledDaysLabel(scheduledDays) {
  if (!scheduledDays || scheduledDays.length === 0 || scheduledDays.length === 7) return null;
  return [...scheduledDays].sort((a, b) => a - b).map(d => DAY_ABBR[d]).join(' · ');
}
