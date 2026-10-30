import Dexie from 'dexie';
import { regimenSnapshot } from '../utils/medicationSchedule';
import { makeUUID } from '../utils/ids';

// One database per patient. The first patient keeps the original name, so existing installs need no
// migration; others are 'AuraTrackDB-<patientId>' (see src/data/profiles.js). `db` is a live binding:
// every module that imports it uses whichever patient is active.
export const DEFAULT_DB_NAME = 'AuraTrackDB';

// Tables whose rows sync record by record: each row has a uuid and an updatedAt, and a deletion
// leaves a tombstone (uuid + table) so it reaches other devices instead of being sent back.
export const SYNCED_TABLES = ['events', 'medicationLogs', 'eegSessions', 'eegActivities', 'wellbeingEntries'];

export function createDatabase(name = DEFAULT_DB_NAME) {
  const db = new Dexie(name);

  db.version(3).stores({
    events: '++id, startTime, date, type, isComplete, isEdited, notes'
  });

  db.version(4).stores({
    events: '++id, startTime, date, type, isComplete, isEdited, notes',
    settings: 'key'
  });

  db.version(5).stores({
    events: '++id, startTime, date, type, isComplete, isEdited, notes',
    settings: 'key',
    medications: '++id',
    medicationLogs: '++id, medicationId, takenAt'
  });

  db.version(6).stores({
    events: '++id, startTime, date, type, isComplete, isEdited, notes',
    settings: 'key',
    medications: '++id',
    medicationLogs: '++id, medicationId, takenAt, scheduledTime'
  });

  db.version(7).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes',
    settings: 'key',
    medications: '++id',
    medicationLogs: '++id, medicationId, takenAt, scheduledTime'
  });

  db.version(8).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime'
  }).upgrade(async tx => {
    const medsTable = tx.table('medications');
    const logsTable = tx.table('medicationLogs');
    const meds = await medsTable.toArray();
    const medUuidById = new Map();

    for (const med of meds) {
      const uuid = med.uuid || makeUUID();
      medUuidById.set(med.id, uuid);
      if (med.uuid !== uuid) await medsTable.update(med.id, { uuid });
    }

    const logs = await logsTable.toArray();
    for (const log of logs) {
      const updates = {};
      if (!log.uuid) updates.uuid = makeUUID();
      if (!log.medicationUuid && medUuidById.has(log.medicationId)) {
        updates.medicationUuid = medUuidById.get(log.medicationId);
      }
      if (Object.keys(updates).length) await logsTable.update(log.id, updates);
    }
  });

  db.version(9).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes, eegSessionId, videoAttached',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime',
    eegSessions: '++id, uuid, startTime, status, actualEndTime',
    eegActivities: '++id, uuid, sessionId, kind, startTime, endTime, linkedEventId, isEdited'
  }).upgrade(async tx => {
    const eventTable = tx.table('events');
    const events = await eventTable.toArray();
    for (const event of events) {
      const updates = {};
      if (!event.uuid) updates.uuid = makeUUID();
      if (event.videoAttached == null) updates.videoAttached = false;
      if (Object.keys(updates).length) await eventTable.update(event.id, updates);
    }
  });

  db.version(10).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes, eegSessionId, videoAttached',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime',
    eegSessions: '++id, uuid, startTime, status, actualEndTime',
    eegActivities: '++id, uuid, sessionId, kind, startTime, endTime, linkedEventId, isEdited',
    wellbeingEntries: '++id, uuid, recordedAt, dayKey, primaryMood, intensity, isEdited'
  });

  // v11: medication change history. Every existing medication gets a baseline 'started' record
  // so reports have a start point; the date comes from the medicationStartDate setting, else the
  // earliest dose log, else now.
  db.version(11).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes, eegSessionId, videoAttached',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime',
    medicationChanges: '++id, uuid, medicationId, medicationUuid, effectiveAt, type',
    eegSessions: '++id, uuid, startTime, status, actualEndTime',
    eegActivities: '++id, uuid, sessionId, kind, startTime, endTime, linkedEventId, isEdited',
    wellbeingEntries: '++id, uuid, recordedAt, dayKey, primaryMood, intensity, isEdited'
  }).upgrade(async tx => {
    const medsTable = tx.table('medications');
    const logsTable = tx.table('medicationLogs');
    const changesTable = tx.table('medicationChanges');
    const startSetting = await tx.table('settings').get('medicationStartDate').catch(() => null);
    const settingStart = startSetting?.value ? new Date(`${startSetting.value}T00:00:00`).getTime() : NaN;
    const now = Date.now();

    for (const med of await medsTable.toArray()) {
      const logs = await logsTable.where('medicationId').equals(med.id).toArray();
      const earliestLog = logs.reduce((min, log) => Math.min(min, log.takenAt ?? Infinity), Infinity);
      const startedAt = Number.isFinite(settingStart)
        ? settingStart
        : Number.isFinite(earliestLog) ? earliestLog : now;
      await medsTable.update(med.id, { startedAt: med.startedAt ?? startedAt });
      await changesTable.add({
        uuid: makeUUID(),
        medicationId: med.id,
        medicationUuid: med.uuid ?? null,
        medicationName: med.name,
        type: 'started',
        effectiveAt: med.startedAt ?? startedAt,
        recordedAt: now,
        from: null,
        to: regimenSnapshot(med),
        changedFields: [],
        note: '',
        isBaseline: true,
      });
    }
  });

  // v12: tombstones, updatedAt on every synced row, uuids on rows that never got one, and removal of
  // duplicate auto-generated missed/assumed dose logs (two runs of the missed-dose check at once).
  db.version(12).stores({
    events: '++id, uuid, startTime, date, type, isComplete, isEdited, notes, eegSessionId, videoAttached',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt, scheduledTime',
    medicationChanges: '++id, uuid, medicationId, medicationUuid, effectiveAt, type',
    eegSessions: '++id, uuid, startTime, status, actualEndTime',
    eegActivities: '++id, uuid, sessionId, kind, startTime, endTime, linkedEventId, isEdited',
    wellbeingEntries: '++id, uuid, recordedAt, dayKey, primaryMood, intensity, isEdited',
    tombstones: '&uuid, table, deletedAt',
  }).upgrade(async tx => {
    const now = Date.now();
    for (const name of SYNCED_TABLES) {
      const table = tx.table(name);
      await table.toCollection().modify(row => {
        if (!row.uuid) row.uuid = makeUUID();
        if (row.updatedAt == null) {
          row.updatedAt = row.lastModified ?? row.createdAt ?? row.recordedAt ?? row.takenAt ?? row.startTime ?? now;
        }
      });
    }

    const rank = { missed: 0, assumed: 1, taken: 2, late: 2 };
    const logs = await tx.table('medicationLogs').toArray();
    const slots = new Map();
    for (const log of logs) {
      if (!log.scheduledTime) continue;
      const day = new Date(log.takenAt || 0).toDateString();
      const key = `${log.medicationUuid || `id:${log.medicationId}`}|${day}|${log.scheduledTime}`;
      slots.set(key, [...(slots.get(key) || []), log]);
    }
    const redundant = [];
    for (const group of slots.values()) {
      if (group.length < 2) continue;
      const best = group.reduce((a, b) => ((rank[b.status] ?? 2) > (rank[a.status] ?? 2) ? b : a));
      // Only auto-generated placeholders are removed; a logged dose (taken/late) is never deleted
      group.filter(log => log !== best && (log.status === 'missed' || log.status === 'assumed') && !log.isEdited)
        .forEach(log => redundant.push(log.id));
    }
    if (redundant.length) await tx.table('medicationLogs').bulkDelete(redundant);
  });

  // v13: only the indexes queries use. Dropped indexes (free-text notes, type, flags…) cost space and
  // slowed every save; Dexie removes them without touching the stored data.
  db.version(13).stores({
    events: '++id, uuid, startTime',
    settings: 'key',
    medications: '++id, uuid',
    medicationLogs: '++id, uuid, medicationId, medicationUuid, takenAt',
    medicationChanges: '++id, uuid, medicationId, medicationUuid, effectiveAt',
    eegSessions: '++id, uuid, startTime, status',
    eegActivities: '++id, uuid, sessionId, startTime, linkedEventId',
    wellbeingEntries: '++id, uuid, recordedAt',
    tombstones: '&uuid, table, deletedAt',
  });

  // Every write stamps updatedAt, unless the caller sets it (sync keeps the other device's time)
  for (const name of SYNCED_TABLES) {
    db.table(name).hook('creating', (_key, obj) => {
      if (obj.updatedAt == null) obj.updatedAt = Date.now();
      if (!obj.uuid) obj.uuid = makeUUID();
    });
    db.table(name).hook('updating', (mods) => ('updatedAt' in mods ? undefined : { updatedAt: Date.now() }));
  }
  return db;
}

export let db = createDatabase(DEFAULT_DB_NAME);

// Makes another patient's database the active one (all screens then reload via announceDataChanged)
export async function openPatientDatabase(name) {
  if (db.name === name) return db;
  db.close();
  db = createDatabase(name);
  await db.open();
  return db;
}
