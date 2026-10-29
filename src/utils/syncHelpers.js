import { db } from '../data/db';
import {
  MAX_SYNC_PAYLOAD_CHARS,
  buildCanonicalBackupPayload,
  sanitizeImportPayload,
} from './importSanitizer';
import { askMedicationConflicts } from './medicationConflictPrompt';

const QR_SYNC_CODEC_TIMEOUT_MS = 2500;
const SETTINGS_SKIP_KEYS = new Set([
  'lastSuccessfulBackupAt',
  'lastBackupReminderDismissedAt',
]);

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const medicationIdentityKey = (med) => [
  (med.name || '').trim().toLowerCase(),
  Number(med.dose ?? 0),
  (med.unit || '').trim().toLowerCase(),
  med.frequency || '',
  (med.scheduledTimes || []).join(','),
  (med.scheduledDays || []).join(','),
].join('|');

const medicationLogExactKey = (log, medicationKey) => [
  medicationKey,
  log.scheduledTime || '',
  Number(log.takenAt || 0),
  log.status || '',
].join('|');

const medicationLogSlotKey = (log, medicationKey) => {
  if (!log.scheduledTime) return null;
  return [
    medicationKey,
    startOfDay(log.takenAt || 0),
    log.scheduledTime,
  ].join('|');
};

const medicationChangeKey = (change, medicationUuid) => [
  medicationUuid || '',
  change.type || '',
  Number(change.effectiveAt || 0),
].join('|');

// Ranks how much a dose log says: an incoming log only replaces a local placeholder it outranks
const LOG_STATUS_RANK = { missed: 0, assumed: 1, taken: 2, late: 2 };

const medicationComparable = (med) => JSON.stringify({
  name: med.name,
  activeIngredient: med.activeIngredient || '',
  form: med.form || '',
  dose: med.dose,
  unit: med.unit,
  slotDoses: med.slotDoses || {},
  frequency: med.frequency,
  scheduledTimes: med.scheduledTimes || [],
  scheduledDays: med.scheduledDays || [],
  reminderEnabled: med.reminderEnabled ?? false,
  showInEmergency: med.showInEmergency ?? false,
  active: med.active ?? true,
});

const latestChangeFor = (changes, medUuid) => changes
  .filter(change => medUuid && change.medicationUuid === medUuid)
  .reduce((latest, change) => (!latest || (change.recordedAt ?? 0) > (latest.recordedAt ?? 0) ? change : latest), null);

// Medications both sides have but with different details. Used to warn the user before a merge;
// `newer` says which side holds the most recently confirmed change (the default choice).
export async function previewMedicationConflicts(parsed) {
  const incoming = sanitizeImportPayload(parsed);
  const [localMeds, localChanges] = await Promise.all([
    db.medications.toArray().catch(() => []),
    db.medicationChanges.toArray().catch(() => []),
  ]);
  const byUuid = new Map(localMeds.filter(m => m.uuid).map(m => [m.uuid, m]));
  const conflicts = [];
  for (const med of incoming.medications) {
    const local = med.uuid ? byUuid.get(med.uuid) : null;
    if (!local || local.deletedAt || med.deletedAt) continue;
    if (medicationComparable(local) === medicationComparable(med)) continue;
    const localLatest = latestChangeFor(localChanges, local.uuid);
    const incomingLatest = latestChangeFor(incoming.medicationChanges, med.uuid);
    conflicts.push({
      uuid: med.uuid,
      name: local.name,
      local,
      incoming: med,
      localLatest,
      incomingLatest,
      newer: (incomingLatest?.recordedAt ?? 0) > (localLatest?.recordedAt ?? 0) ? 'incoming' : 'local',
    });
  }
  return conflicts;
}

const eventIdentityKey = (event) => [
  Number(event.startTime || 0),
  Number(event.duration || 0),
  event.type || '',
  event.userModeAtTime || '',
].join('|');

const eegSessionIdentityKey = (session) => [
  Number(session.startTime || 0),
  session.title || '',
  session.status || '',
].join('|');

const eegActivityIdentityKey = (activity, sessionUuid = '') => [
  sessionUuid,
  activity.kind || '',
  Number(activity.startTime || 0),
  activity.activityLabel || '',
  activity.linkedEventUuid || '',
].join('|');

const wellbeingIdentityKey = (entry) => [
  Number(entry.recordedAt || 0),
  entry.primaryMood || '',
  Number(entry.intensity || 0),
].join('|');

function describeConflict(type, message, meta = {}) {
  return { type, message, ...meta };
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? b64 + '='.repeat(4 - b64.length % 4) : b64;
  const binary = atob(pad);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

export async function exportLocalData() {
  const events = await db.events.toArray();
  const [settingsRows, medications, medicationLogs, medicationChanges, eegSessions, eegActivities, wellbeingEntries] = await Promise.all([
    db.settings.toArray().catch(() => []),
    db.medications.toArray().catch(() => []),
    db.medicationLogs.toArray().catch(() => []),
    db.medicationChanges.toArray().catch(() => []),
    db.eegSessions?.toArray?.().catch(() => []) ?? [],
    db.eegActivities?.toArray?.().catch(() => []) ?? [],
    db.wellbeingEntries?.toArray?.().catch(() => []) ?? [],
  ]);

  return buildCanonicalBackupPayload({
    settings: settingsRows,
    events,
    medications,
    medicationLogs,
    medicationChanges,
    eegSessions,
    eegActivities,
    wellbeingEntries,
  });
}

// options.medicationResolutions: { [medicationUuid]: 'incoming' | 'local' }. When not given, the user
// is asked through the conflict dialog; anything unanswered goes to the most recently confirmed change.
export async function mergeRemoteData(parsed, options = {}) {
  const incoming = sanitizeImportPayload(parsed);
  // Ask before overwriting any medication (must happen before the DB transaction opens)
  let medicationResolutions = options.medicationResolutions;
  if (!medicationResolutions) {
    const conflicts = await previewMedicationConflicts(parsed);
    medicationResolutions = conflicts.length ? (await askMedicationConflicts(conflicts)) ?? {} : {};
  }
  const results = {
    settings: 0,
    events: 0,
    medications: 0,
    medicationsUpdated: 0,
    medicationsDeleted: 0,
    medicationChanges: 0,
    logs: 0,
    eegSessions: 0,
    eegActivities: 0,
    wellbeingEntries: 0,
    conflicts: [],
    rules: [
      'Settings: incoming values replace local values except local backup reminder timestamps.',
      'Medications: match by UUID first, then by name+dose+unit+schedule fingerprint; on field conflicts the side with the most recently confirmed change wins unless you chose otherwise.',
      'Medication changes: every change record from both sides is kept, so no history is lost.',
      'Deleted medications: a deletion on either side removes the medication and its history on both.',
      'Dose logs: match by UUID first; otherwise scheduled doses reconcile by medication/day/time and prefer taken or late over assumed, and assumed over missed.',
    ],
  };

  await db.transaction(
    'rw',
    db.settings,
    db.events,
    db.medications,
    db.medicationLogs,
    db.medicationChanges,
    db.eegSessions,
    db.eegActivities,
    db.wellbeingEntries,
    async () => {
      const [
        localSettingsRows,
        localEvents,
        localMeds,
        localLogs,
        localChanges,
        localSessions,
        localActivities,
        localWellbeingEntries,
      ] = await Promise.all([
        db.settings.toArray().catch(() => []),
        db.events.toArray(),
        db.medications.toArray().catch(() => []),
        db.medicationLogs.toArray().catch(() => []),
        db.medicationChanges.toArray().catch(() => []),
        db.eegSessions?.toArray?.().catch(() => []) ?? [],
        db.eegActivities?.toArray?.().catch(() => []) ?? [],
        db.wellbeingEntries?.toArray?.().catch(() => []) ?? [],
      ]);

      const localSettings = new Map(localSettingsRows.map(row => [row.key, row.value]));
      const eventUuids = new Set(localEvents.map(event => event.uuid).filter(Boolean));
      const eventKeys = new Set(localEvents.map(eventIdentityKey));
      const medByUuid = new Map(localMeds.map(med => [med.uuid, med]).filter(([uuid]) => Boolean(uuid)));
      const medByKey = new Map(localMeds.map(med => [medicationIdentityKey(med), med]));
      const logByUuid = new Map(localLogs.map(log => [log.uuid, log]).filter(([uuid]) => Boolean(uuid)));
      const logByExactKey = new Map();
      const logBySlotKey = new Map();
      const sessionByUuid = new Map(localSessions.map(session => [session.uuid, session]).filter(([uuid]) => Boolean(uuid)));
      const sessionByKey = new Map(localSessions.map(session => [eegSessionIdentityKey(session), session]));
      const activityByUuid = new Map(localActivities.map(activity => [activity.uuid, activity]).filter(([uuid]) => Boolean(uuid)));
      const activityByKey = new Map();
      const wellbeingByUuid = new Map(localWellbeingEntries.map(entry => [entry.uuid, entry]).filter(([uuid]) => Boolean(uuid)));
      const wellbeingByKey = new Set(localWellbeingEntries.map(wellbeingIdentityKey));
      const eventIdByUuid = new Map(localEvents.map(event => [event.uuid, event.id]).filter(([uuid]) => Boolean(uuid)));

      localLogs.forEach((log) => {
        const medication = localMeds.find(med => med.id === log.medicationId || (med.uuid && med.uuid === log.medicationUuid));
        const medKey = medication ? medicationIdentityKey(medication) : (log.medicationUuid || `id:${log.medicationId}`);
        logByExactKey.set(medicationLogExactKey(log, medKey), log);
        const slotKey = medicationLogSlotKey(log, medKey);
        if (slotKey) logBySlotKey.set(slotKey, log);
      });

      localActivities.forEach((activity) => {
        const session = localSessions.find(row => row.id === activity.sessionId);
        const sessionUuid = activity.sessionUuid || session?.uuid || '';
        activityByKey.set(eegActivityIdentityKey(activity, sessionUuid), activity);
      });

      for (const [key, value] of Object.entries(incoming.settings || {})) {
        if (SETTINGS_SKIP_KEYS.has(key)) continue;
        if (JSON.stringify(localSettings.get(key)) === JSON.stringify(value)) continue;
        await db.settings.put({ key, value });
        results.settings += 1;
      }

      const eventInserts = incoming.events.filter((event) => {
        if (event.uuid && eventUuids.has(event.uuid)) return false;
        const key = eventIdentityKey(event);
        if (eventKeys.has(key)) return false;
        eventKeys.add(key);
        if (event.uuid) eventUuids.add(event.uuid);
        return true;
      });
      if (eventInserts.length) {
        const ids = await db.events.bulkAdd(eventInserts, { allKeys: true });
        ids.forEach((id, index) => {
          const event = eventInserts[index];
          if (event.uuid) eventIdByUuid.set(event.uuid, id);
        });
        results.events = eventInserts.length;
      }

      const medicationUuidToLocal = new Map();
      const medicationKeyToLocal = new Map([...medByKey.entries()]);
      for (const med of incoming.medications) {
        const key = medicationIdentityKey(med);
        const existing = (med.uuid && medByUuid.get(med.uuid)) || medicationKeyToLocal.get(key) || null;
        if (!existing) {
          const id = await db.medications.add(med);
          const inserted = { ...med, id };
          medicationKeyToLocal.set(key, inserted);
          if (med.uuid) {
            medByUuid.set(med.uuid, inserted);
            medicationUuidToLocal.set(med.uuid, inserted);
          }
          results.medications += 1;
          continue;
        }

        medicationKeyToLocal.set(key, existing);
        if (med.uuid) medicationUuidToLocal.set(med.uuid, existing);
        if (med.uuid && !existing.uuid) {
          await db.medications.update(existing.id, { uuid: med.uuid });
          existing.uuid = med.uuid;
          medByUuid.set(med.uuid, existing);
        }

        // A deletion on either side wins: the medication stays a tombstone and loses its history
        if (existing.deletedAt) continue;
        if (med.deletedAt) {
          await db.medications.update(existing.id, { active: false, deletedAt: med.deletedAt });
          await db.medicationLogs.where('medicationId').equals(existing.id).delete();
          await db.medicationChanges.where('medicationId').equals(existing.id).delete();
          if (existing.uuid) {
            await db.medicationLogs.where('medicationUuid').equals(existing.uuid).delete();
            await db.medicationChanges.where('medicationUuid').equals(existing.uuid).delete();
          }
          existing.deletedAt = med.deletedAt;
          results.medicationsDeleted += 1;
          continue;
        }

        if (medicationComparable(existing) === medicationComparable(med)) continue;

        const choice = medicationResolutions[existing.uuid]
          ?? (((latestChangeFor(incoming.medicationChanges, med.uuid)?.recordedAt ?? 0)
            > (latestChangeFor(localChanges, existing.uuid)?.recordedAt ?? 0)) ? 'incoming' : 'local');
        if (choice === 'incoming') {
          const fields = { ...med };
          delete fields.uuid;
          await db.medications.update(existing.id, fields);
          Object.assign(existing, fields);
          results.medicationsUpdated += 1;
          continue;
        }

        results.conflicts.push(describeConflict(
          'medication_conflict',
          `Kept local medication "${existing.name}" instead of overwriting it with an incoming variant.`,
          { uuid: med.uuid || existing.uuid || null }
        ));
      }

      const changeUuids = new Set(localChanges.map(change => change.uuid).filter(Boolean));
      const changeKeys = new Set(localChanges.map(change => medicationChangeKey(change, change.medicationUuid)));
      const baselineMeds = new Set(localChanges.filter(change => change.isBaseline).map(change => change.medicationUuid));
      for (const change of incoming.medicationChanges) {
        const medication = (change.medicationUuid && (medicationUuidToLocal.get(change.medicationUuid) || medByUuid.get(change.medicationUuid)))
          || null;
        if (!medication || medication.deletedAt) continue;
        if (change.uuid && changeUuids.has(change.uuid)) continue;
        const key = medicationChangeKey(change, medication.uuid);
        if (changeKeys.has(key)) continue;
        // Both devices create their own baseline 'started' record when upgrading — keep one
        if (change.isBaseline && baselineMeds.has(medication.uuid)) continue;
        await db.medicationChanges.add({ ...change, medicationId: medication.id, medicationUuid: medication.uuid });
        if (change.uuid) changeUuids.add(change.uuid);
        changeKeys.add(key);
        results.medicationChanges += 1;
      }

      const sessionUuidToLocal = new Map();
      for (const session of incoming.eegSessions) {
        const key = eegSessionIdentityKey(session);
        const existing = (session.uuid && sessionByUuid.get(session.uuid)) || sessionByKey.get(key) || null;
        if (existing) {
          if (session.uuid) sessionUuidToLocal.set(session.uuid, existing);
          continue;
        }
        const id = await db.eegSessions.add(session);
        const inserted = { ...session, id };
        sessionByKey.set(key, inserted);
        if (session.uuid) {
          sessionByUuid.set(session.uuid, inserted);
          sessionUuidToLocal.set(session.uuid, inserted);
        }
        results.eegSessions += 1;
      }

      for (const log of incoming.medicationLogs) {
        const medication = (log.medicationUuid && medicationUuidToLocal.get(log.medicationUuid))
          || (log.medicationUuid && medByUuid.get(log.medicationUuid))
          || (log.medicationId != null ? localMeds.find(med => med.id === log.medicationId) : null)
          || null;
        if (medication?.deletedAt) continue;
        if (!medication) {
          results.conflicts.push(describeConflict(
            'orphan_medication_log',
            'Skipped a dose log because no matching medication could be found locally.',
            { uuid: log.uuid || null }
          ));
          continue;
        }

        const medKey = medicationIdentityKey(medication);
        const exactKey = medicationLogExactKey(log, medKey);
        const slotKey = medicationLogSlotKey(log, medKey);
        const existingByUuid = log.uuid ? logByUuid.get(log.uuid) : null;
        const existingByExact = logByExactKey.get(exactKey) || null;
        const existingBySlot = slotKey ? logBySlotKey.get(slotKey) : null;
        const existing = existingByUuid || existingByExact || existingBySlot || null;

        if (!existing) {
          const inserted = {
            ...log,
            medicationId: medication.id,
            medicationUuid: medication.uuid ?? log.medicationUuid ?? null,
          };
          const id = await db.medicationLogs.add(inserted);
          const fullRow = { ...inserted, id };
          if (fullRow.uuid) logByUuid.set(fullRow.uuid, fullRow);
          logByExactKey.set(exactKey, fullRow);
          if (slotKey) logBySlotKey.set(slotKey, fullRow);
          results.logs += 1;
          continue;
        }

        const incomingComparable = JSON.stringify({
          scheduledTime: log.scheduledTime ?? null,
          takenAt: log.takenAt,
          status: log.status,
          note: log.note || '',
        });
        const existingComparable = JSON.stringify({
          scheduledTime: existing.scheduledTime ?? null,
          takenAt: existing.takenAt,
          status: existing.status,
          note: existing.note || '',
        });
        if (incomingComparable === existingComparable) continue;

        if ((LOG_STATUS_RANK[log.status] ?? 2) > (LOG_STATUS_RANK[existing.status] ?? 2)) {
          await db.medicationLogs.update(existing.id, {
            takenAt: log.takenAt,
            status: log.status,
            doseSnapshot: log.doseSnapshot ?? existing.doseSnapshot ?? null,
            unitSnapshot: log.unitSnapshot || existing.unitSnapshot || '',
            note: log.note || existing.note || '',
            scheduledTime: log.scheduledTime ?? existing.scheduledTime ?? null,
            medicationUuid: medication.uuid ?? existing.medicationUuid ?? null,
            lastModified: Date.now(),
            ...(log.uuid && !existing.uuid ? { uuid: log.uuid } : {}),
          });
          existing.takenAt = log.takenAt;
          existing.status = log.status;
          existing.note = log.note || existing.note || '';
          existing.scheduledTime = log.scheduledTime ?? existing.scheduledTime ?? null;
          if (log.uuid && !existing.uuid) existing.uuid = log.uuid;
          continue;
        }

        results.conflicts.push(describeConflict(
          'medication_log_conflict',
          `Kept the local dose log for ${medication.name}${log.scheduledTime ? ` at ${log.scheduledTime}` : ''}.`,
          { uuid: log.uuid || existing.uuid || null }
        ));
      }

      for (const activity of incoming.eegActivities) {
        const linkedSession = (activity.sessionUuid && sessionUuidToLocal.get(activity.sessionUuid))
          || (activity.sessionUuid && sessionByUuid.get(activity.sessionUuid))
          || (activity.sessionId != null ? localSessions.find(session => session.id === activity.sessionId) : null)
          || null;
        const sessionUuid = linkedSession?.uuid || activity.sessionUuid || '';
        const existing = (activity.uuid && activityByUuid.get(activity.uuid))
          || activityByKey.get(eegActivityIdentityKey(activity, sessionUuid))
          || null;
        if (existing) continue;

        const eventId = activity.linkedEventUuid
          ? (eventIdByUuid.get(activity.linkedEventUuid) ?? activity.linkedEventId ?? null)
          : (activity.linkedEventId ?? null);
        const inserted = {
          ...activity,
          sessionId: linkedSession?.id ?? activity.sessionId ?? null,
          sessionUuid,
          linkedEventId: eventId,
        };
        await db.eegActivities.add(inserted);
        results.eegActivities += 1;
      }

      for (const entry of incoming.wellbeingEntries) {
        const key = wellbeingIdentityKey(entry);
        if ((entry.uuid && wellbeingByUuid.has(entry.uuid)) || wellbeingByKey.has(key)) continue;
        const id = await db.wellbeingEntries.add(entry);
        const inserted = { ...entry, id };
        if (entry.uuid) wellbeingByUuid.set(entry.uuid, inserted);
        wellbeingByKey.add(key);
        results.wellbeingEntries += 1;
      }
    }
  );

  return results;
}

export async function compressSDP(sdpString) {
  const data = new TextEncoder().encode(sdpString);

  try {
    if (typeof CompressionStream !== 'function') throw new Error('CompressionStream unavailable');
    const compressed = await withTimeout((async () => {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      await writer.write(data);
      await writer.close();
      const chunks = [];
      const reader = cs.readable.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      return out;
    })(), QR_SYNC_CODEC_TIMEOUT_MS, 'SDP compression');

    return `c.${toBase64Url(compressed)}`;
  } catch {
    // Fallback for browsers where CompressionStream is missing or stalls.
    return `u.${toBase64Url(data)}`;
  }
}

export async function decompressSDP(b64url) {
  if (b64url.length > 50_000) throw new Error('SDP payload too large');
  const [codec, payload = ''] = b64url.includes('.') ? b64url.split(/\.(.+)/, 2) : ['c', b64url];

  if (codec === 'u') {
    const plain = fromBase64Url(payload);
    if (plain.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('SDP payload too large');
    return new TextDecoder().decode(plain);
  }

  const compressed = fromBase64Url(payload);
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot read compressed sync QR codes.');
  }
  const out = await withTimeout((async () => {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    await writer.write(compressed);
    await writer.close();
    const chunks = [];
    const reader = ds.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      const totalLen = chunks.reduce((n, c) => n + c.length, 0);
      if (totalLen > MAX_SYNC_PAYLOAD_CHARS) throw new Error('SDP payload too large');
    }
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return merged;
  })(), QR_SYNC_CODEC_TIMEOUT_MS, 'SDP decompression');

  return new TextDecoder().decode(out);
}
