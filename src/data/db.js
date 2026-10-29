import Dexie from 'dexie';
import { regimenSnapshot } from '../utils/medicationSchedule';

export const db = new Dexie('AuraTrackDB');

function makeUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

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
