export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SYNC_PAYLOAD_CHARS = 5 * 1024 * 1024;
export const CANONICAL_BACKUP_SCHEMA = 'auratrack.backup';
export const CANONICAL_BACKUP_VERSION = 1;

const MAX_EVENTS = 5000;
const MAX_MEDICATIONS = 500;
const MAX_LOGS = 20000;
const MAX_MED_CHANGES = 5000;
const MAX_EEG_SESSIONS = 1000;
const MAX_EEG_ACTIVITIES = 20000;
const MAX_WELLBEING_ENTRIES = 20000;
const MAX_SETTINGS_KEYS = 200;
const MAX_TEXT = 120;
const MAX_NOTES = 5000;
const MAX_ARRAY = 200;
const MAX_JSON_DEPTH = 5;
const MAX_JSON_KEYS = 50;

const FREQS = new Set(['OD', 'BD', 'TDS', 'QDS', 'PRN']);
const LOG_STATUSES = new Set(['taken', 'missed', 'late', 'assumed']);
const MED_CHANGE_TYPES = new Set(['started', 'changed', 'stopped', 'correction']);
const EEG_SESSION_STATUSES = new Set(['ACTIVE', 'COMPLETED']);
const EEG_ACTIVITY_KINDS = new Set(['ACTIVITY', 'SEIZURE_REFERENCE']);

const asString = (value, max = MAX_TEXT) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const asBool = (value, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const asFiniteNumber = (value, fallback = null) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asNonNegativeInt = (value, fallback = 0, max = 86400) => {
  const n = asFiniteNumber(value, fallback);
  if (n == null) return fallback;
  return Math.min(max, Math.max(0, Math.floor(n)));
};

const validTime = (value) =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const sanitizeTextArray = (arr, maxItems = MAX_ARRAY) =>
  Array.isArray(arr)
    ? arr.map(v => asString(v)).filter(Boolean).slice(0, maxItems)
    : [];

const sanitizeSymptoms = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_ARRAY).map(s => {
    if (!s || typeof s !== 'object') return null;
    const out = {
      symptom: asString(s.symptom),
      detail: asString(s.detail),
      region: asString(s.region),
      subRegion: asString(s.subRegion),
      specificPart: asString(s.specificPart),
      med: asString(s.med),
    };
    return Object.values(out).some(Boolean) ? out : null;
  }).filter(Boolean);
};

const sanitizeNumberMap = (obj, keys, max = 24 * 60 * 60) => {
  if (!obj || typeof obj !== 'object') return {};
  return keys.reduce((acc, key) => {
    const n = asFiniteNumber(obj[key]);
    if (n != null && n >= 0) acc[key] = Math.min(max, n);
    return acc;
  }, {});
};

const sanitizeEditLog = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 100).map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    return {
      editedAt: asFiniteNumber(entry.editedAt, Date.now()),
      changedFields: sanitizeTextArray(entry.changedFields, 20),
    };
  }).filter(Boolean);
};

const sanitizeJsonValue = (value, depth = 0) => {
  if (depth > MAX_JSON_DEPTH) return undefined;
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, MAX_NOTES);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .map(item => sanitizeJsonValue(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).slice(0, MAX_JSON_KEYS).forEach(([key, nested]) => {
      const safeKey = asString(key, 80);
      if (!safeKey) return;
      const safeValue = sanitizeJsonValue(nested, depth + 1);
      if (safeValue !== undefined) out[safeKey] = safeValue;
    });
    return out;
  }
  return undefined;
};

const sanitizeSettingsEntries = (entries) => {
  const out = {};
  entries.slice(0, MAX_SETTINGS_KEYS).forEach(([rawKey, rawValue]) => {
    const key = asString(rawKey, 80);
    if (!key) return;
    const value = sanitizeJsonValue(rawValue);
    if (value !== undefined) out[key] = value;
  });
  return out;
};

export function sanitizeSettingsPayload(raw) {
  if (Array.isArray(raw)) {
    return sanitizeSettingsEntries(
      raw
        .filter(row => row && typeof row === 'object')
        .map(row => [row.key, row.value])
    );
  }
  if (raw && typeof raw === 'object') {
    return sanitizeSettingsEntries(Object.entries(raw));
  }
  return {};
}

export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startTime = asFiniteNumber(raw.startTime);
  const duration = asFiniteNumber(raw.duration);
  if (startTime == null || duration == null || duration < 0) return null;

  const startDate = new Date(startTime);
  const validStart = !Number.isNaN(startDate.getTime());
  if (!validStart) return null;

  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    startTime,
    date: asString(raw.date, 80) || startDate.toLocaleDateString(),
    time: asString(raw.time, 80) || startDate.toLocaleTimeString(),
    duration: asNonNegativeInt(duration),
    manualDurations: sanitizeNumberMap(raw.manualDurations, ['aura', 'seizure', 'recovery', 'total']),
    laps: sanitizeNumberMap(raw.laps, ['aura', 'seizure', 'recovery'], Number.MAX_SAFE_INTEGER),
    type: asString(raw.type) || 'Uncategorized',
    symptoms: sanitizeSymptoms(raw.symptoms),
    triggers: sanitizeTextArray(raw.triggers),
    notes: asString(raw.notes, MAX_NOTES),
    isComplete: asBool(raw.isComplete),
    isEdited: asBool(raw.isEdited),
    isManualEntry: asBool(raw.isManualEntry),
    isEmergencyStop: asBool(raw.isEmergencyStop),
    userModeAtTime: asString(raw.userModeAtTime, 20),
    deferredTagging: asBool(raw.deferredTagging),
    editLog: sanitizeEditLog(raw.editLog),
  };
}

const sanitizeSlotDoses = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.entries(raw).slice(0, 8).reduce((acc, [time, dose]) => {
    const n = asFiniteNumber(dose);
    if (validTime(time) && n != null && n >= 0) acc[time] = n;
    return acc;
  }, {});
};

const sanitizeScheduledDays = (raw) => Array.isArray(raw)
  ? [...new Set(raw.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
  : [0, 1, 2, 3, 4, 5, 6];

// The clinically relevant snapshot stored in a medication change record (from / to)
const sanitizeRegimen = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    name: asString(raw.name),
    activeIngredient: asString(raw.activeIngredient),
    form: asString(raw.form, 60),
    dose: asFiniteNumber(raw.dose, 0),
    unit: asString(raw.unit, 20) || 'mg',
    slotDoses: sanitizeSlotDoses(raw.slotDoses),
    frequency: FREQS.has(raw.frequency) ? raw.frequency : 'OD',
    scheduledTimes: Array.isArray(raw.scheduledTimes) ? raw.scheduledTimes.filter(validTime).slice(0, 8) : [],
    scheduledDays: sanitizeScheduledDays(raw.scheduledDays),
  };
};

const optionalTimestamp = (key, value) => {
  const n = asFiniteNumber(value);
  return n != null ? { [key]: n } : {};
};

export function sanitizeMedication(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = asString(raw.name);
  if (!name) return null;
  const frequency = FREQS.has(raw.frequency) ? raw.frequency : 'OD';
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    name,
    dose: asFiniteNumber(raw.dose, 0),
    unit: asString(raw.unit, 20) || 'mg',
    frequency,
    isRescue: asBool(raw.isRescue, frequency === 'PRN'),
    scheduledTimes: Array.isArray(raw.scheduledTimes)
      ? raw.scheduledTimes.filter(validTime).slice(0, 8)
      : [],
    scheduledDays: sanitizeScheduledDays(raw.scheduledDays),
    activeIngredient: asString(raw.activeIngredient),
    form: asString(raw.form, 60),
    slotDoses: sanitizeSlotDoses(raw.slotDoses),
    reminderEnabled: asBool(raw.reminderEnabled),
    showInEmergency: asBool(raw.showInEmergency),
    active: asBool(raw.active, true),
    ...optionalTimestamp('startedAt', raw.startedAt),
    ...optionalTimestamp('stoppedAt', raw.stoppedAt),
    ...optionalTimestamp('deletedAt', raw.deletedAt),
  };
}

export function sanitizeMedicationLog(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const medicationId = asFiniteNumber(raw.medicationId);
  const medicationUuid = asString(raw.medicationUuid, 100);
  const takenAt = asFiniteNumber(raw.takenAt);
  if ((medicationId == null && !medicationUuid) || takenAt == null) return null;
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    ...(medicationId != null ? { medicationId } : {}),
    ...(medicationUuid ? { medicationUuid } : {}),
    scheduledTime: validTime(raw.scheduledTime) ? raw.scheduledTime : null,
    takenAt,
    status: LOG_STATUSES.has(raw.status) ? raw.status : 'taken',
    doseSnapshot: asFiniteNumber(raw.doseSnapshot),
    unitSnapshot: asString(raw.unitSnapshot, 20),
    note: asString(raw.note, 500),
    isEdited: asBool(raw.isEdited),
    ...(asFiniteNumber(raw.lastModified) ? { lastModified: asFiniteNumber(raw.lastModified) } : {}),
  };
}

export function sanitizeMedicationChange(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const medicationId = asFiniteNumber(raw.medicationId);
  const medicationUuid = asString(raw.medicationUuid, 100);
  const effectiveAt = asFiniteNumber(raw.effectiveAt);
  if ((medicationId == null && !medicationUuid) || effectiveAt == null || !MED_CHANGE_TYPES.has(raw.type)) return null;
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    ...(medicationId != null ? { medicationId } : {}),
    ...(medicationUuid ? { medicationUuid } : {}),
    medicationName: asString(raw.medicationName),
    type: raw.type,
    effectiveAt,
    recordedAt: asFiniteNumber(raw.recordedAt, effectiveAt),
    from: sanitizeRegimen(raw.from),
    to: sanitizeRegimen(raw.to),
    changedFields: sanitizeTextArray(raw.changedFields, 20),
    note: asString(raw.note, 500),
    isBaseline: asBool(raw.isBaseline),
  };
}

export function sanitizeEegSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startTime = asFiniteNumber(raw.startTime);
  if (startTime == null) return null;
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    startTime,
    plannedEndTime: asFiniteNumber(raw.plannedEndTime),
    actualEndTime: asFiniteNumber(raw.actualEndTime),
    durationPreset: asString(raw.durationPreset, 20) || '24h',
    customHours: asFiniteNumber(raw.customHours),
    title: asString(raw.title, 200),
    notes: asString(raw.notes, MAX_NOTES),
    status: EEG_SESSION_STATUSES.has(raw.status) ? raw.status : 'COMPLETED',
    createdAt: asFiniteNumber(raw.createdAt, startTime),
    updatedAt: asFiniteNumber(raw.updatedAt, startTime),
  };
}

export function sanitizeEegActivity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startTime = asFiniteNumber(raw.startTime);
  if (startTime == null) return null;
  const kind = EEG_ACTIVITY_KINDS.has(raw.kind) ? raw.kind : 'ACTIVITY';
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    ...(asFiniteNumber(raw.sessionId) != null ? { sessionId: asFiniteNumber(raw.sessionId) } : {}),
    ...(asString(raw.sessionUuid, 100) ? { sessionUuid: asString(raw.sessionUuid, 100) } : {}),
    kind,
    activityLabel: asString(raw.activityLabel, 120),
    customActivityText: asString(raw.customActivityText, 500),
    moodLabel: asString(raw.moodLabel, 80),
    notes: asString(raw.notes, MAX_NOTES),
    startTime,
    endTime: asFiniteNumber(raw.endTime),
    durationSec: asNonNegativeInt(raw.durationSec, 0, Number.MAX_SAFE_INTEGER),
    linkedEventId: asFiniteNumber(raw.linkedEventId),
    linkedEventUuid: asString(raw.linkedEventUuid, 100),
    isEdited: asBool(raw.isEdited),
    editLog: sanitizeEditLog(raw.editLog),
    createdAt: asFiniteNumber(raw.createdAt, startTime),
    updatedAt: asFiniteNumber(raw.updatedAt, startTime),
  };
}

function sanitizeWellbeingFactors(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(raw).slice(0, MAX_JSON_KEYS).forEach(([rawKey, rawFactor]) => {
    const key = asString(rawKey, 80);
    if (!key) return;
    if (rawFactor && typeof rawFactor === 'object' && 'value' in rawFactor) {
      const type = ['boolean', 'scale', 'number'].includes(rawFactor.type) ? rawFactor.type : 'boolean';
      let value = rawFactor.value;
      if (type === 'boolean') value = value === true;
      if (type === 'scale') value = asNonNegativeInt(value, 0, 3);
      if (type === 'number') value = Math.max(0, asFiniteNumber(value, 0));
      out[key] = {
        label: asString(rawFactor.label, 120) || key,
        type,
        unit: asString(rawFactor.unit, 16),
        help: asString(rawFactor.help, 240),
        active: asBool(rawFactor.active, true),
        value,
      };
      return;
    }
    if (typeof rawFactor === 'boolean') out[key] = { label: key, type: 'boolean', unit: '', help: '', active: true, value: rawFactor };
    if (typeof rawFactor === 'number' && Number.isFinite(rawFactor)) out[key] = { label: key, type: 'number', unit: '', help: '', active: true, value: Math.max(0, rawFactor) };
  });
  return out;
}

export function sanitizeWellbeingEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const recordedAt = asFiniteNumber(raw.recordedAt);
  const primaryMood = asString(raw.primaryMood, 120);
  if (recordedAt == null || !primaryMood) return null;
  const recordedDate = new Date(recordedAt);
  if (Number.isNaN(recordedDate.getTime())) return null;
  const dayKey = asString(raw.dayKey, 20) || recordedDate.toISOString().slice(0, 10);
  return {
    ...(asString(raw.uuid, 100) ? { uuid: asString(raw.uuid, 100) } : {}),
    recordedAt,
    dayKey,
    primaryMood,
    intensity: Math.min(3, Math.max(1, asNonNegativeInt(raw.intensity, 1, 3))),
    factors: sanitizeWellbeingFactors(raw.factors),
    notes: asString(raw.notes, MAX_NOTES),
    isEdited: asBool(raw.isEdited),
    editLog: sanitizeEditLog(raw.editLog),
    createdAt: asFiniteNumber(raw.createdAt, recordedAt),
    updatedAt: asFiniteNumber(raw.updatedAt, recordedAt),
  };
}

function coercePayloadData(parsed) {
  if (Array.isArray(parsed)) return { events: parsed };
  if (parsed?.schema === CANONICAL_BACKUP_SCHEMA && parsed?.data && typeof parsed.data === 'object') {
    return parsed.data;
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function sanitizeImportPayload(parsed) {
  const data = coercePayloadData(parsed);
  const rawEvents = Array.isArray(data) ? data : (data?.events || []);
  const events = Array.isArray(rawEvents)
    ? rawEvents.map(sanitizeEvent).filter(Boolean).slice(0, MAX_EVENTS)
    : [];
  const medications = Array.isArray(data?.medications)
    ? data.medications.map(sanitizeMedication).filter(Boolean).slice(0, MAX_MEDICATIONS)
    : [];
  const medicationLogs = Array.isArray(data?.medicationLogs)
    ? data.medicationLogs.map(sanitizeMedicationLog).filter(Boolean).slice(0, MAX_LOGS)
    : [];
  const medicationChanges = Array.isArray(data?.medicationChanges)
    ? data.medicationChanges.map(sanitizeMedicationChange).filter(Boolean).slice(0, MAX_MED_CHANGES)
    : [];
  const eegSessions = Array.isArray(data?.eegSessions)
    ? data.eegSessions.map(sanitizeEegSession).filter(Boolean).slice(0, MAX_EEG_SESSIONS)
    : [];
  const eegActivities = Array.isArray(data?.eegActivities)
    ? data.eegActivities.map(sanitizeEegActivity).filter(Boolean).slice(0, MAX_EEG_ACTIVITIES)
    : [];
  const wellbeingEntries = Array.isArray(data?.wellbeingEntries)
    ? data.wellbeingEntries.map(sanitizeWellbeingEntry).filter(Boolean).slice(0, MAX_WELLBEING_ENTRIES)
    : [];
  const settings = sanitizeSettingsPayload(data?.settings);

  return { settings, events, medications, medicationLogs, medicationChanges, eegSessions, eegActivities, wellbeingEntries };
}

export function buildCanonicalBackupPayload(snapshot = {}) {
  const {
    settings = {},
    events = [],
    medications = [],
    medicationLogs = [],
    medicationChanges = [],
    eegSessions = [],
    eegActivities = [],
    wellbeingEntries = [],
  } = sanitizeImportPayload({
    schema: CANONICAL_BACKUP_SCHEMA,
    data: snapshot,
  });

  return {
    schema: CANONICAL_BACKUP_SCHEMA,
    version: CANONICAL_BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      settings,
      events,
      medications,
      medicationLogs,
      medicationChanges,
      eegSessions,
      eegActivities,
      wellbeingEntries,
    },
  };
}

export function assertImportFileSafe(file) {
  if (file?.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Backup file is too large.');
  }
}
