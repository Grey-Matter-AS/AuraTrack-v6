// ─── Emergency plan ────────────────────────────────────────────
// The alert time and the cluster rule come from Settings → Recording → Emergency plan, so the live
// alert, History, event detail and every report use the same values.
export const AUTO_STOP_AT_S = 720; // 12 minutes: status epilepticus, the recording ends

export const EMERGENCY_PLAN_DEFAULTS = {
  emergencyAlertMinutes: 5,
  clusterMinCount: 3,
  clusterWindowMinutes: 8,
};

export const EMERGENCY_PLAN_LIMITS = {
  emergencyAlertMinutes: [1, 11],       // must stay below the 12-minute auto-stop
  clusterMinCount: [2, 20],
  clusterWindowMinutes: [1, 7 * 24 * 60],
};

const clampSetting = (key, value) => {
  const [min, max] = EMERGENCY_PLAN_LIMITS[key];
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : EMERGENCY_PLAN_DEFAULTS[key];
};

// { alertSec, warnSec, clusterMinCount, clusterWindowMs, clusterWindowMinutes, alertMinutes } from settings
export function emergencyPlan(settings = {}) {
  const alertMinutes = clampSetting('emergencyAlertMinutes', settings.emergencyAlertMinutes ?? EMERGENCY_PLAN_DEFAULTS.emergencyAlertMinutes);
  const clusterMinCount = clampSetting('clusterMinCount', settings.clusterMinCount ?? EMERGENCY_PLAN_DEFAULTS.clusterMinCount);
  const clusterWindowMinutes = clampSetting('clusterWindowMinutes', settings.clusterWindowMinutes ?? EMERGENCY_PLAN_DEFAULTS.clusterWindowMinutes);
  const alertSec = alertMinutes * 60;
  return {
    alertMinutes,
    alertSec,
    warnSec: Math.max(0, alertSec - 60), // the one-minute-earlier warning
    clusterMinCount,
    clusterWindowMinutes,
    clusterWindowMs: clusterWindowMinutes * 60 * 1000,
  };
}

// "8 min" / "24 h": short units read correctly inside every translated sentence
export const clusterWindowLabel = (minutes) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

// Seconds of seizure activity: the seizure phase when phases were marked (an aura before it, or a long
// recovery after it, is not counted), otherwise the whole recording
export function seizureSeconds(event) {
  const manual = event.manualDurations || {};
  if (manual.seizure != null) return manual.seizure;
  const laps = event.laps || {};
  if (laps.aura && event.startTime) {
    const end = laps.seizure || laps.recovery || event.startTime + (event.duration || 0) * 1000;
    return Math.max(0, Math.round((end - laps.aura) / 1000));
  }
  return event.duration || 0;
}

export const isLongSeizure = (event, plan = emergencyPlan()) => seizureSeconds(event) >= plan.alertSec;

// ─── Clusters ─────────────────────────────────────────────────
// For each event: how many events (itself included) fall within the window either side of it.
// Sorted sliding window, O(n·k). Returns Map(event → count).
export function clusterCounts(events, plan = emergencyPlan()) {
  const sorted = [...events].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const counts = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i].startTime || 0;
    let count = 1;
    for (let j = i - 1; j >= 0 && t - (sorted[j].startTime || 0) <= plan.clusterWindowMs; j--) count++;
    for (let j = i + 1; j < sorted.length && (sorted[j].startTime || 0) - t <= plan.clusterWindowMs; j++) count++;
    counts.set(sorted[i], count);
  }
  return counts;
}

function flagsFor(event, count, plan) {
  const flags = [];
  if (isLongSeizure(event, plan)) flags.push('long_duration');
  const isCluster = count >= plan.clusterMinCount;
  if (isCluster) flags.push('cluster');
  // The rule used travels with the flags, so every message states the user's own thresholds
  return { flags, clusterCount: isCluster ? count : 0, alertMinutes: plan.alertMinutes, clusterWindow: clusterWindowLabel(plan.clusterWindowMinutes) };
}

/**
 * { flags, clusterCount } for one event, judged against the events around it.
 * The event itself always counts, whether or not allEvents includes it.
 */
export function computeDangerFlags(event, allEvents = [], plan = emergencyPlan()) {
  const others = allEvents.filter(e => e !== event && !(event.id != null && e.id === event.id));
  const counts = clusterCounts([event, ...others], plan);
  return flagsFor(event, counts.get(event), plan);
}

// { id → { flags, clusterCount } } for a whole list
export function buildDangerMap(allEvents, plan = emergencyPlan()) {
  const map = {};
  for (const [event, count] of clusterCounts(allEvents, plan)) map[event.id] = flagsFor(event, count, plan);
  return map;
}
