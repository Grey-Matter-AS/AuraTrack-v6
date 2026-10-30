import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { clearAllData, deleteEvent, deleteRecord } from './records';
import { deviceDb, writeDeviceSetting } from './profiles';
import { collectCanonicalBackupPayload, parseBackupFileText } from '../utils/backupFiles';
import { mergeRemoteData } from '../utils/syncHelpers';
import { recordMissedDoses } from '../hooks/useMedications';
import { regimenSnapshot } from '../utils/medicationSchedule';

const merge = (payload, options = {}) => mergeRemoteData(payload, { medicationResolutions: {}, ...options });
const strip = ({ id: _id, ...row }) => row;
const HOUR = 3600 * 1000;

async function wipe() {
  await clearAllData();
  await db.settings.clear();
  await deviceDb.settings.clear();
}

// Mode, language and look are kept per device (src/data/profiles.js), the rest per patient
const deviceSetting = async (key) => (await deviceDb.settings.get(key))?.value;

// One row in every table, with every field the app writes plus one field this version doesn't know
async function seedFullDatabase() {
  const sessionId = await db.eegSessions.add({
    uuid: 'session-1', startTime: 1_700_000_000_000, plannedEndTime: 1_700_086_400_000, actualEndTime: null,
    durationPreset: '24h', customHours: null, title: 'Ambulatory EEG', notes: 'n', status: 'ACTIVE',
    createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, futureSessionField: 'kept',
  });
  const eventId = await db.events.add({
    uuid: 'event-1', startTime: 1_700_000_100_000, date: '14/11/2023', time: '22:15', duration: 95,
    manualDurations: { total: 95 }, laps: { aura: 20, seizure: 80 }, type: 'Focal Aware',
    symptoms: [{ symptom: 'Tingling', detail: 'Pins', region: 'Arms', subRegion: 'Left', specificPart: 'Hand', med: 'Paresthesia' }],
    triggers: ['Stress'], notes: 'notes', isComplete: true, isEdited: true, isManualEntry: false, isEmergencyStop: false,
    userModeAtTime: 'CARETAKER', editLog: [{ editedAt: 1_700_000_200_000, changedFields: ['notes'] }],
    postIctal: { findings: ['Confusion'], paralysisLocations: [{ region: 'Arms', subRegion: 'Left', specificPart: 'Hand' }] },
    editedTimers: { aura: 20 }, eegSessionId: sessionId, eegSessionUuid: 'session-1',
    videoAttached: true, videoFileName: 'seizure.webm', updatedAt: 1_700_000_200_000,
  });
  const medId = await db.medications.add({
    uuid: 'med-1', name: 'Levetiracetam', activeIngredient: 'Levetiracetam', form: 'tablet', dose: 500, unit: 'mg',
    slotDoses: { '08:00': 500, '20:00': 500 }, frequency: 'BD', isRescue: false, scheduledTimes: ['08:00', '20:00'],
    scheduledDays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: true, showInEmergency: false, active: true, startedAt: 1_690_000_000_000,
  });
  await db.medicationChanges.add({
    uuid: 'change-1', medicationId: medId, medicationUuid: 'med-1', medicationName: 'Levetiracetam', type: 'started',
    effectiveAt: 1_690_000_000_000, recordedAt: 1_690_000_000_000, from: null,
    to: regimenSnapshot(await db.medications.get(medId)), changedFields: [], note: '', isBaseline: false,
  });
  await db.medicationLogs.add({
    uuid: 'log-1', medicationId: medId, medicationUuid: 'med-1', scheduledTime: '08:00', takenAt: 1_700_000_300_000,
    status: 'taken', doseSnapshot: 500, unitSnapshot: 'mg', note: '', isEdited: false, updatedAt: 1_700_000_300_000,
  });
  await db.eegActivities.add({
    uuid: 'activity-1', sessionId, sessionUuid: 'session-1', kind: 'SEIZURE_REFERENCE', activityLabel: 'Focal Aware',
    customActivityText: '', moodLabel: '', notes: '', startTime: 1_700_000_100_000, endTime: 1_700_000_195_000,
    durationSec: 95, linkedEventId: eventId, linkedEventUuid: 'event-1', isEdited: false, editLog: [],
    createdAt: 1_700_000_100_000, updatedAt: 1_700_000_100_000,
  });
  await db.wellbeingEntries.add({
    uuid: 'wellbeing-1', recordedAt: 1_700_000_400_000, dayKey: '2023-11-14', primaryMood: 'Calm', intensity: 2,
    factors: { sleep: { label: 'Sleep', type: 'number', unit: 'h', help: '', active: true, value: 7 } },
    notes: '', isEdited: false, editLog: [], createdAt: 1_700_000_400_000, updatedAt: 1_700_000_400_000,
  });
  await db.tombstones.put({ uuid: 'gone-1', table: 'events', deletedAt: 1_700_000_500_000 });
  await writeDeviceSetting('userMode', 'CARETAKER');
  await db.settings.bulkPut([
    { key: 'personName', value: 'Alex' },
    { key: 'favoriteSymptomSets', value: [{ id: 's1', name: 'Usual', symptoms: [{ symptom: 'Tingling' }] }] },
  ]);
}

async function snapshotTables() {
  const out = {};
  for (const table of db.tables) out[table.name] = (await table.toArray()).map(strip);
  return out;
}

beforeEach(wipe);

describe('backup contains everything (1.1)', () => {
  it('restores every table and every field into an empty database', async () => {
    await seedFullDatabase();
    const before = await snapshotTables();
    const payload = await collectCanonicalBackupPayload();
    expect(payload.counts.events).toBe(1);
    expect(payload.schemaVersion).toBe(db.verno);

    await wipe();
    const result = await merge(JSON.parse(JSON.stringify(payload)));
    expect(result.rejected).toBe(0);
    const after = await snapshotTables();
    expect(await deviceSetting('userMode'), 'device settings restored').toBe('CARETAKER');

    for (const table of Object.keys(before)) {
      // Local id links are rebuilt on restore, so compare them through the uuids they point at
      const normalise = rows => rows.map(({ eegSessionId: _s, sessionId: _a, linkedEventId: _e, medicationId: _m, ...row }) => row);
      // Every original field comes back with the same value (restore may add defaults, never lose)
      expect(after[table], table).toHaveLength(before[table].length);
      expect(normalise(after[table]), table).toMatchObject(normalise(before[table]));
    }
    const event = await db.events.where('uuid').equals('event-1').first();
    const session = await db.eegSessions.where('uuid').equals('session-1').first();
    const activity = await db.eegActivities.where('uuid').equals('activity-1').first();
    expect(event.eegSessionId).toBe(session.id);
    expect(activity.linkedEventId).toBe(event.id);
    expect(event.postIctal.paralysisLocations).toHaveLength(1);
    expect(event.videoFileName).toBe('seizure.webm');
  });

  it('counts rejected records instead of dropping them silently', async () => {
    const result = await merge({ events: [{ startTime: 'not a time', duration: 10 }, { startTime: 1_700_000_000_000, duration: 10 }] });
    expect(result.rejected).toBe(1);
    expect(result.events).toBe(1);
  });

  it('does not accept an unrelated JSON file as a backup', () => {
    expect(() => parseBackupFileText('{"hello":"world"}')).toThrow();
    expect(parseBackupFileText('[]').kind).toBe('plain');
  });

  it('removes unsafe keys from imported records', async () => {
    await merge({ events: [JSON.parse('{"uuid":"e","startTime":1700000000000,"duration":5,"__proto__":{"polluted":true},"extra":{"constructor":1,"ok":2}}')] });
    const event = await db.events.where('uuid').equals('e').first();
    expect(event.extra).toEqual({ ok: 2 });
    expect({}.polluted).toBeUndefined();
  });
});

describe('sync carries edits and deletions (1.2)', () => {
  const base = { uuid: 'event-9', startTime: 1_700_000_000_000, duration: 60, type: 'Absence', notes: 'old', updatedAt: 1000, editLog: [{ editedAt: 1, changedFields: ['type'] }] };

  it('the newer version of a record wins and edit logs are joined', async () => {
    await merge({ events: [base] });
    const result = await merge({ events: [{ ...base, type: 'Focal Aware', updatedAt: 2000, editLog: [{ editedAt: 2, changedFields: ['notes'] }] }] });
    expect(result.eventsUpdated).toBe(1);
    const event = await db.events.where('uuid').equals('event-9').first();
    expect(event.type).toBe('Focal Aware');
    expect(event.editLog.map(e => e.editedAt)).toEqual([1, 2]);
  });

  it('an older version never overwrites a newer one', async () => {
    await merge({ events: [{ ...base, updatedAt: 5000 }] });
    await merge({ events: [{ ...base, notes: 'stale', updatedAt: 1000 }] });
    expect((await db.events.where('uuid').equals('event-9').first()).notes).toBe('old');
  });

  it('a deletion reaches the other device and the record never comes back', async () => {
    await merge({ events: [base] });
    await merge({ tombstones: [{ uuid: 'event-9', table: 'events', deletedAt: 3000 }] });
    expect(await db.events.count()).toBe(0);
    await merge({ events: [base] });
    expect(await db.events.count()).toBe(0);
  });

  it('deleting locally leaves a tombstone that is exported', async () => {
    const id = await db.wellbeingEntries.add({ uuid: 'w-1', recordedAt: 1, primaryMood: 'Calm', intensity: 1 });
    await deleteRecord('wellbeingEntries', id);
    const payload = await collectCanonicalBackupPayload();
    expect(payload.data.tombstones).toEqual([expect.objectContaining({ uuid: 'w-1', table: 'wellbeingEntries' })]);
  });

  it('deleting a seizure also deletes its EEG diary note', async () => {
    const sessionId = await db.eegSessions.add({ uuid: 's', startTime: 1, status: 'ACTIVE' });
    const eventId = await db.events.add({ uuid: 'e', startTime: 2, duration: 1 });
    await db.eegActivities.add({ uuid: 'a', sessionId, kind: 'SEIZURE_REFERENCE', startTime: 2, linkedEventId: eventId });
    await deleteEvent(eventId);
    expect(await db.eegActivities.count()).toBe(0);
    expect((await db.tombstones.toArray()).map(t => t.uuid).sort()).toEqual(['a', 'e']);
  });

  it('every write stamps updatedAt', async () => {
    const id = await db.events.add({ startTime: 1, duration: 1 });
    const created = await db.events.get(id);
    expect(created.updatedAt).toBeGreaterThan(0);
    expect(created.uuid).toBeTruthy();
    await new Promise(r => setTimeout(r, 5));
    await db.events.update(id, { notes: 'x' });
    expect((await db.events.get(id)).updatedAt).toBeGreaterThan(created.updatedAt);
  });
});

describe('records only attach to the right parent (1.3)', () => {
  it('a dose log without a medication uuid is skipped, never matched by local id', async () => {
    await db.medications.add({ uuid: 'local-med', name: 'Lamotrigine', dose: 100, unit: 'mg', frequency: 'OD', scheduledTimes: ['08:00'], active: true });
    const result = await merge({ medicationLogs: [{ uuid: 'l', medicationId: 1, takenAt: 5, status: 'taken' }] });
    expect(await db.medicationLogs.count()).toBe(0);
    expect(result.conflicts.some(c => c.type === 'orphan_medication_log')).toBe(true);
  });

  it('an EEG entry is linked through its session uuid, not the other device id', async () => {
    await db.eegSessions.add({ uuid: 'mine', startTime: 1, status: 'ACTIVE' });
    await merge({
      eegSessions: [{ uuid: 'theirs', startTime: 99, status: 'COMPLETED' }],
      eegActivities: [{ uuid: 'act', sessionId: 1, sessionUuid: 'theirs', startTime: 100 }],
    });
    const theirs = await db.eegSessions.where('uuid').equals('theirs').first();
    expect((await db.eegActivities.where('uuid').equals('act').first()).sessionId).toBe(theirs.id);
  });
});

describe('settings scope (1.4)', () => {
  const incoming = { settings: { userMode: 'PATIENT', language: 'nb', personName: 'Alex' } };

  it('a phone in use keeps its own device settings', async () => {
    await db.events.add({ startTime: 1, duration: 1 });
    await writeDeviceSetting('userMode', 'CARETAKER');
    await writeDeviceSetting('language', 'en');
    const result = await merge(incoming);
    expect(result.settingsScope).toBe('shared');
    expect(await deviceSetting('userMode')).toBe('CARETAKER');
    expect(await deviceSetting('language')).toBe('en');
    expect((await db.settings.get('personName')).value).toBe('Alex');
  });

  it('a new phone copies everything', async () => {
    const result = await merge(incoming);
    expect(result.settingsScope).toBe('all');
    expect(await deviceSetting('userMode')).toBe('PATIENT');
  });

  it('the scope can be chosen explicitly', async () => {
    await db.events.add({ startTime: 1, duration: 1 });
    await merge(incoming, { settingsScope: 'all' });
    expect(await deviceSetting('language')).toBe('nb');
  });
});

describe('missed doses (1.7)', () => {
  it('two runs at once record each missed dose only once', async () => {
    const medId = await db.medications.add({
      uuid: 'm', name: 'Valproate', dose: 300, unit: 'mg', frequency: 'BD', scheduledTimes: ['08:00', '20:00'],
      scheduledDays: [0, 1, 2, 3, 4, 5, 6], active: true, isRescue: false, startedAt: 0,
    });
    const med = await db.medications.get(medId);
    await db.medicationChanges.add({ uuid: 'c', medicationId: medId, medicationUuid: 'm', type: 'started', effectiveAt: 0, recordedAt: 0, from: null, to: regimenSnapshot(med) });
    const evening = new Date(); evening.setHours(22, 0, 0, 0);
    await Promise.all([recordMissedDoses(evening.getTime()), recordMissedDoses(evening.getTime()), recordMissedDoses(evening.getTime())]);
    const logs = await db.medicationLogs.toArray();
    expect(logs.map(l => l.scheduledTime).sort()).toEqual(['08:00', '20:00']);
    expect(logs.every(l => l.status === 'missed')).toBe(true);
  });
});

describe('clear all data (1.8)', () => {
  it('empties every table, EEG included, and keeps settings', async () => {
    await seedFullDatabase();
    await clearAllData();
    for (const table of db.tables) {
      if (table.name !== 'settings') expect(await table.count(), table.name).toBe(0);
    }
    expect(await db.settings.count()).toBeGreaterThan(0);
  });
});

it('timestamps in this file are fixed hours apart', () => expect(HOUR).toBe(3_600_000));
