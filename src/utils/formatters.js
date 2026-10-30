import i18n from '../i18n';
import { findingText, normalizePostIctal, recoveryText } from './postIctal';
import { localDateKey } from './dates';

export const formatEventDate = (startTime, dateFormat = 'locale') => {
  if (!startTime) return '—';
  const d = new Date(startTime);
  switch (dateFormat) {
    case 'ISO': return localDateKey(d);
    case 'US':  return d.toLocaleDateString('en-US');
    case 'EU':  return d.toLocaleDateString('en-GB');
    default:    return d.toLocaleDateString();
  }
};

export const formatEventTime = (startTime, timeFormat = '12h') => {
  if (!startTime) return '—';
  return new Date(startTime).toLocaleTimeString(
    timeFormat === '24h' ? 'en-GB' : 'en-US',
    { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' }
  );
};

// The one duration format: "45s", "5m 12s" ("5m" with compact, for chart labels)
export const formatDuration = (seconds, { compact = false } = {}) => {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (!m) return `${s}s`;
  return compact && !s ? `${m}m` : `${m}m ${s}s`;
};

// Reports: '-' when a phase wasn't recorded
export const formatDurationLabel = (seconds) => (Number(seconds) > 0 ? formatDuration(seconds) : '-');

// Screens: the user's duration setting ('human' → "5m 12s", 'seconds' → "312s")
export const formatDurationSetting = (seconds, durationFormat = 'seconds') =>
  (durationFormat === 'human' ? formatDuration(seconds) : `${Math.max(0, Math.round(Number(seconds) || 0))}s`);

export const formatCSVField = (value) => {
  const raw = value == null ? '' : String(value);
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
};

export const formatCSVRow = (event) => {
  const t = i18n.t.bind(i18n);
  const postIctal = normalizePostIctal(event.postIctal);
  const postIctalFindings = postIctal.findings.map(finding => findingText(finding, t)).join('|');
  // Kept as its own column for spreadsheets made with earlier versions
  const postIctalParalysisLocations = (postIctal.findings.find(f => f.key === 'paralysis')?.locations || [])
    .map((location) => [location.region, location.subRegion, location.specificPart].filter(Boolean).join(' > '))
    .join('|');

  return [
    event.id,
    event.date,
    event.time,
    event.type,
    event.duration,
    event.notes || '',
    postIctalFindings,
    postIctalParalysisLocations,
    recoveryText(postIctal, t),
  ]
    .map(formatCSVField)
    .join(',');
};
