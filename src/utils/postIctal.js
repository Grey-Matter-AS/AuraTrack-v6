// ─── After-seizure (post-ictal) findings ───────────────────────
// Grouped so each finding means one thing to a neurologist. Findings marked `location` record the
// body areas affected (paralysis, weakness, numbness… are different findings, not one "weakness").
// Labels come from the locale files: post_ictal.group.<group> and post_ictal.finding.<key>.
export const POST_ICTAL_GROUPS = [
  { key: 'responsiveness', open: true, findings: ['not_responding', 'confused', 'drowsy', 'agitated', 'no_memory'] },
  { key: 'movement', open: true, findings: ['paralysis', 'weakness', 'heaviness', 'clumsiness'] },
  { key: 'sensation', findings: ['numbness', 'tingling', 'pain'] },
  { key: 'speech', open: true, findings: ['unable_to_speak', 'slurred_speech', 'word_finding'] },
  { key: 'head', findings: ['headache', 'vision_changes'] },
  { key: 'body', findings: ['nausea', 'incontinence', 'tongue_bite', 'injury', 'exhaustion'] },
  { key: 'mood', findings: ['anxious', 'low_mood', 'unusual_behaviour'] },
];

export const LOCATION_FINDINGS = new Set(['paralysis', 'weakness', 'heaviness', 'clumsiness', 'numbness', 'tingling', 'pain', 'injury']);
export const CUSTOM_FINDING = 'custom';

const KNOWN = new Set(POST_ICTAL_GROUPS.flatMap(group => group.findings));

// The four findings of the first version (plain strings) → their key now. "Speech difficulty" didn't
// say which kind, so it is kept as written rather than guessed.
const LEGACY = { Confusion: 'confused', Sleepiness: 'drowsy', Weakness: 'weakness' };

export const EMPTY_POST_ICTAL = { findings: [], recoveryMinutes: null, recoveryOngoing: false };

const sameLocation = (a, b) => a.region === b.region && a.subRegion === b.subRegion && a.specificPart === b.specificPart;

// Any stored shape (first version: strings + paralysisLocations) → { findings: [{ key, label?, locations }], … }
export function normalizePostIctal(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_POST_ICTAL, findings: [] };
  const findings = [];
  const add = (finding) => {
    const existing = findings.find(f => f.key === finding.key && (f.key !== CUSTOM_FINDING || f.label === finding.label));
    if (!existing) { findings.push({ ...finding, locations: [...(finding.locations || [])] }); return; }
    for (const location of finding.locations || []) {
      if (!existing.locations.some(l => sameLocation(l, location))) existing.locations.push(location);
    }
  };
  for (const item of Array.isArray(raw.findings) ? raw.findings : []) {
    if (typeof item === 'string') {
      const key = LEGACY[item] ?? (KNOWN.has(item) ? item : null);
      add(key ? { key } : { key: CUSTOM_FINDING, label: item });
    } else if (item && typeof item === 'object' && typeof item.key === 'string') {
      const locations = Array.isArray(item.locations) ? item.locations.filter(l => l && typeof l === 'object') : [];
      if (item.key === CUSTOM_FINDING) { if (item.label) add({ key: CUSTOM_FINDING, label: String(item.label), locations }); }
      else add({ key: item.key, locations });
    }
  }
  const paralysis = Array.isArray(raw.paralysisLocations) ? raw.paralysisLocations.filter(l => l && typeof l === 'object') : [];
  if (paralysis.length) {
    add({ key: 'paralysis', locations: paralysis.map(({ region, subRegion, specificPart }) => ({ region, subRegion, specificPart })) });
  }
  const minutes = Number(raw.recoveryMinutes);
  return {
    findings,
    recoveryMinutes: raw.recoveryMinutes != null && Number.isFinite(minutes) && minutes >= 0 ? minutes : null,
    recoveryOngoing: raw.recoveryOngoing === true,
  };
}

export const hasPostIctal = (raw) => {
  const p = normalizePostIctal(raw);
  return p.findings.length > 0 || p.recoveryMinutes != null || p.recoveryOngoing;
};

export const locationLabel = (location) => [location.region, location.subRegion, location.specificPart].filter(Boolean).join(' › ');

export function findingLabel(finding, t) {
  if (finding.key === CUSTOM_FINDING) return finding.label;
  return t(`post_ictal.finding.${finding.key}`, finding.key.replace(/_/g, ' '));
}

// "Numbness (Arms › Left › Hand)" — a finding with the areas it affected
export function findingText(finding, t) {
  const label = findingLabel(finding, t);
  return finding.locations?.length ? `${label} (${finding.locations.map(locationLabel).join('; ')})` : label;
}

// "Back to normal after 45 min" / "after 2 h 30 min" / "Not back to normal when recorded"
export function recoveryText(raw, t) {
  const p = normalizePostIctal(raw);
  if (p.recoveryOngoing) return t('post_ictal.recovery_ongoing_text');
  if (p.recoveryMinutes == null) return '';
  const h = Math.floor(p.recoveryMinutes / 60);
  const m = p.recoveryMinutes % 60;
  const time = h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  return t('post_ictal.recovery_after_text', { time });
}
