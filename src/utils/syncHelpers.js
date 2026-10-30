import { db } from '../data/db';
import {
  MAX_SYNC_PAYLOAD_CHARS,
  sanitizeImportPayload,
} from './importSanitizer';
import { collectCanonicalBackupPayload } from './backupFiles';
import { askMedicationConflicts } from './medicationConflictPrompt';
import { startOfLocalDay as startOfDay } from './dates';
import { announceDataChanged } from './dataEvents';
import { fromBase64Url, toBase64Url } from './base64url';

const QR_SYNC_CODEC_TIMEOUT_MS = 2500;
// Never copied from another device: when this device last backed up is its own fact
const SETTINGS_SKIP_KEYS = new Set([
  'lastSuccessfulBackupAt',
  'lastBackupReminderDismissedAt',
]);
// Belong to one device (who uses it, how it looks, its reminders). Ongoing sync between two phones
// in use leaves them alone; restoring or setting up a new phone copies them too (scope 'all').
export const DEVICE_SETTING_KEYS = new Set([
  'userMode',
  'language',
  'theme',
  'accentColor',
  'fontSize',
  'historyPageSize',
  'dateFormat',
  'durationFormat',
  'timeFormat',
  'hapticFeedback',
  'wellbeingDailyReminderEnabled',
  'wellbeingReminderTime',
  'backupReminderEnabled',
  'backupReminderIntervalDays',
  'assumeDosesTaken',
  'assumeDosesTakenSince',
]);

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

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

// Same backup payload the backup file uses: every table, every field
export async function exportLocalData() {
  return collectCanonicalBackupPayload();
}

const newer = (incoming, local) => (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0);

// Audit trails from both devices are joined, never replaced
function mergeEditLogs(local = [], incoming = []) {
  const seen = new Map();
  for (const entry of [...(local || []), ...(incoming || [])]) {
    seen.set(JSON.stringify([entry.editedAt, entry.changedFields]), entry);
  }
  return [...seen.values()].sort((a, b) => (a.editedAt ?? 0) - (b.editedAt ?? 0));
}

const withoutUuid = ({ uuid: _uuid, ...fields }) => fields;

// options.medicationResolutions: { [medicationUuid]: 'incoming' | 'local' }. When not given, the user
// is asked through the conflict dialog; anything unanswered goes to the most recently confirmed change.
// options.settingsScope: 'shared' (only settings both phones share) | 'all' (an exact copy, for a new
// phone). Default: 'all' when this device has no seizures recorded yet, otherwise 'shared'.
export async function mergeRemoteData(parsed, options = {}) {
  const incoming = sanitizeImportPayload(parsed);
  // Ask before overwriting any medication (must happen before the DB transaction opens)
  let medicationResolutions = options.medicationResolutions;
  if (!medicationResolutions) {
    const conflicts = await previewMedicationConflicts(parsed);
    medicationResolutions = conflicts.length ? (await askMedicationConflicts(conflicts)) ?? {} : {};
  }
  const settingsScope = options.settingsScope ?? ((await db.events.count()) === 0 ? 'all' : 'shared');
  const rejected = Object.values(incoming.report?.rejected || {}).reduce((sum, n) => sum + n, 0);
  const results = {
    settings: 0,
    settingsScope,
    events: 0,
    eventsUpdated: 0,
    medications: 0,
    medicationsUpdated: 0,
    medicationsDeleted: 0,
    medicationChanges: 0,
    logs: 0,
    logsUpdated: 0,
    eegSessions: 0,
    eegActivities: 0,
    eegUpdated: 0,
    wellbeingEntries: 0,
    wellbeingUpdated: 0,
    deleted: 0,
    rejected,
    report: incoming.report,
    conflicts: [],
    rules: [
      'Settings: shared settings are copied; display, mode and reminder settings stay as they are on each phone unless everything is copied (new phone or restore).',
      'Records: matched by their id across devices; the most recently saved version wins and edit histories are joined.',
      'Deletions: a record deleted on either device is deleted on both.',
      'Medications: match by UUID first, then by name+dose+unit+schedule fingerprint; on field conflicts the side with the most recently confirmed change wins unless you chose otherwise.',
      'Medication changes: every change record from both sides is kept, so no history is lost.',
      'Dose logs: a logged dose outranks an assumed one, and assumed outranks missed; a deliberate correction wins when it is newer. Logs whose medication cannot be identified are skipped, never guessed.',
    ],
  };

  await db.transaction('rw', db.tables, async () => {
      const [
        localSettingsRows,
        localEvents,
        localMeds,
        localLogs,
        localChanges,
        localSessions,
        localActivities,
        localWellbeingEntries,
        localTombstones,
      ] = await Promise.all([
        db.settings.toArray(),
        db.events.toArray(),
        db.medications.toArray(),
        db.medicationLogs.toArray(),
        db.medicationChanges.toArray(),
        db.eegSessions.toArray(),
        db.eegActivities.toArray(),
        db.wellbeingEntries.toArray(),
        db.tombstones.toArray(),
      ]);

      // ── Deletions first: a deleted record is removed here and never re-added ──
      const deadUuids = new Set(localTombstones.map(row => row.uuid));
      const tables = { events: localEvents, medicationLogs: localLogs, eegSessions: localSessions, eegActivities: localActivities, wellbeingEntries: localWellbeingEntries };
      for (const tomb of incoming.tombstones) {
        if (!deadUuids.has(tomb.uuid)) await db.tombstones.put(tomb);
        deadUuids.add(tomb.uuid);
        const rows = tables[tomb.table];
        const index = rows.findIndex(row => row.uuid === tomb.uuid);
        if (index === -1) continue;
        await db.table(tomb.table).delete(rows[index].id);
        rows.splice(index, 1);
        results.deleted += 1;
      }
      const alive = (row) => !row.uuid || !deadUuids.has(row.uuid);

      const localSettings = new Map(localSettingsRows.map(row => [row.key, row.value]));
      const eventByUuid = new Map(localEvents.map(event => [event.uuid, event]).filter(([uuid]) => Boolean(uuid)));
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
        if (settingsScope !== 'all' && DEVICE_SETTING_KEYS.has(key)) continue;
        if (JSON.stringify(localSettings.get(key)) === JSON.stringify(value)) continue;
        await db.settings.put({ key, value });
        results.settings += 1;
      }

      // ── EEG sessions (before seizures, which point at them) ──
      const sessionUuidToLocal = new Map(sessionByUuid);
      for (const session of incoming.eegSessions) {
        if (!alive(session)) continue;
        const key = eegSessionIdentityKey(session);
        const existing = (session.uuid && sessionByUuid.get(session.uuid)) || (!session.uuid && sessionByKey.get(key)) || null;
        if (existing) {
          if (session.uuid) sessionUuidToLocal.set(session.uuid, existing);
          if (session.uuid && newer(session, existing)) {
            const fields = withoutUuid(session);
            await db.eegSessions.update(existing.id, fields);
            Object.assign(existing, fields);
            results.eegUpdated += 1;
          }
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
      // Another device's local ids mean nothing here: links are rebuilt from uuids only
      const localSessionId = (uuid) => (uuid && sessionUuidToLocal.get(uuid)?.id) ?? null;

      // ── Seizures ──
      for (const event of incoming.events) {
        if (!alive(event)) continue;
        const linked = { ...event, eegSessionId: localSessionId(event.eegSessionUuid) };
        const existing = event.uuid ? eventByUuid.get(event.uuid) : null;
        if (existing) {
          if (newer(event, existing)) {
            const fields = { ...withoutUuid(linked), editLog: mergeEditLogs(existing.editLog, event.editLog) };
            await db.events.update(existing.id, fields);
            Object.assign(existing, fields);
            results.eventsUpdated += 1;
          }
          continue;
        }
        const key = eventIdentityKey(event);
        if (eventKeys.has(key)) continue;
        eventKeys.add(key);
        const id = await db.events.add(linked);
        const inserted = { ...linked, id };
        if (event.uuid) {
          eventByUuid.set(event.uuid, inserted);
          eventIdByUuid.set(event.uuid, id);
        }
        results.events += 1;
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
          const fields = withoutUuid(med);
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

      for (const log of incoming.medicationLogs) {
        if (!alive(log)) continue;
        // Matched by medication uuid only: another device's medication numbers mean nothing here
        const medication = (log.medicationUuid && (medicationUuidToLocal.get(log.medicationUuid) || medByUuid.get(log.medicationUuid))) || null;
        if (medication?.deletedAt) continue;
        if (!medication) {
          results.conflicts.push(describeConflict(
            'orphan_medication_log',
            'Skipped a dose log because its medication could not be identified on this device.',
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

        const comparable = (row) => JSON.stringify({
          scheduledTime: row.scheduledTime ?? null,
          takenAt: row.takenAt,
          status: row.status,
          note: row.note || '',
        });
        if (comparable(log) === comparable(existing)) continue;

        const outranks = (LOG_STATUS_RANK[log.status] ?? 2) > (LOG_STATUS_RANK[existing.status] ?? 2);
        const correction = log.isEdited && newer(log, existing);
        if (outranks || correction) {
          const fields = {
            takenAt: log.takenAt,
            status: log.status,
            doseSnapshot: log.doseSnapshot ?? existing.doseSnapshot ?? null,
            unitSnapshot: log.unitSnapshot || existing.unitSnapshot || '',
            note: log.note || existing.note || '',
            scheduledTime: log.scheduledTime ?? existing.scheduledTime ?? null,
            medicationUuid: medication.uuid ?? existing.medicationUuid ?? null,
            isEdited: Boolean(log.isEdited || existing.isEdited),
            updatedAt: Math.max(log.updatedAt ?? 0, Date.now()),
          };
          await db.medicationLogs.update(existing.id, fields);
          Object.assign(existing, fields);
          results.logsUpdated += 1;
          continue;
        }

        results.conflicts.push(describeConflict(
          'medication_log_conflict',
          `Kept the local dose log for ${medication.name}${log.scheduledTime ? ` at ${log.scheduledTime}` : ''}.`,
          { uuid: log.uuid || existing.uuid || null }
        ));
      }

      for (const activity of incoming.eegActivities) {
        if (!alive(activity)) continue;
        const linkedSession = (activity.sessionUuid && sessionUuidToLocal.get(activity.sessionUuid)) || null;
        if (!linkedSession) {
          results.conflicts.push(describeConflict(
            'orphan_eeg_activity',
            'Skipped an EEG diary entry because its EEG session could not be identified on this device.',
            { uuid: activity.uuid || null }
          ));
          continue;
        }
        const linked = {
          ...activity,
          sessionId: linkedSession.id,
          sessionUuid: linkedSession.uuid,
          linkedEventId: (activity.linkedEventUuid && eventIdByUuid.get(activity.linkedEventUuid)) ?? null,
        };
        const existing = (activity.uuid && activityByUuid.get(activity.uuid))
          || (!activity.uuid && activityByKey.get(eegActivityIdentityKey(activity, linkedSession.uuid)))
          || null;
        if (existing) {
          if (activity.uuid && newer(activity, existing)) {
            const fields = { ...withoutUuid(linked), editLog: mergeEditLogs(existing.editLog, activity.editLog) };
            await db.eegActivities.update(existing.id, fields);
            Object.assign(existing, fields);
            results.eegUpdated += 1;
          }
          continue;
        }
        const id = await db.eegActivities.add(linked);
        if (activity.uuid) activityByUuid.set(activity.uuid, { ...linked, id });
        results.eegActivities += 1;
      }

      for (const entry of incoming.wellbeingEntries) {
        if (!alive(entry)) continue;
        const existing = entry.uuid ? wellbeingByUuid.get(entry.uuid) : null;
        if (existing) {
          if (newer(entry, existing)) {
            const fields = { ...withoutUuid(entry), editLog: mergeEditLogs(existing.editLog, entry.editLog) };
            await db.wellbeingEntries.update(existing.id, fields);
            Object.assign(existing, fields);
            results.wellbeingUpdated += 1;
          }
          continue;
        }
        const key = wellbeingIdentityKey(entry);
        if (wellbeingByKey.has(key)) continue;
        const id = await db.wellbeingEntries.add(entry);
        if (entry.uuid) wellbeingByUuid.set(entry.uuid, { ...entry, id });
        wellbeingByKey.add(key);
        results.wellbeingEntries += 1;
      }
  });

  // Open screens (settings, lists) reload what changed
  announceDataChanged();
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
