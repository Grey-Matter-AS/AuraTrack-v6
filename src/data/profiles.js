import Dexie from 'dexie';
import { DEFAULT_DB_NAME, createDatabase, db, openPatientDatabase } from './db';
import { DEVICE_STORED_KEYS } from './settingKeys';
import { makeUUID } from '../utils/ids';
import { announceDataChanged } from '../utils/dataEvents';

// ─── Patient profiles and this device's own settings ───────────
// Each patient has a separate database; this small database lists them and keeps what belongs to
// the device (mode, language, look). The first patient is the original 'AuraTrackDB'.
export const deviceDb = new Dexie('AuraTrackDevice');
deviceDb.version(1).stores({
  profiles: 'id, createdAt',   // { id, name, color, dbName, createdAt }
  settings: 'key',
  meta: 'key',                 // activeProfileId, deviceSettingsMigrated
});

export const PROFILE_COLORS = {
  blue: '#3b82f6',
  green: '#16a34a',
  purple: '#9333ea',
  amber: '#d97706',
  pink: '#db2777',
  teal: '#0d9488',
};

const ACTIVE_KEY = 'activeProfileId';
const MIGRATED_KEY = 'deviceSettingsMigrated';
const dbNameFor = (id) => `${DEFAULT_DB_NAME}-${id}`;

// First run on this device: the existing data becomes patient 1, named after the patient's name
// setting, and the device settings (mode, language, look) move to the device database
export async function ensureProfiles() {
  let profiles = await deviceDb.profiles.orderBy('createdAt').toArray();
  if (!profiles.length) {
    const nameRow = await db.settings.get('personName').catch(() => null);
    const first = { id: makeUUID(), name: nameRow?.value || '', color: 'blue', dbName: DEFAULT_DB_NAME, createdAt: Date.now() };
    await deviceDb.profiles.add(first);
    profiles = [first];
  }
  if (!(await deviceDb.meta.get(MIGRATED_KEY))) {
    const rows = await db.settings.bulkGet([...DEVICE_STORED_KEYS]).catch(() => []);
    await deviceDb.transaction('rw', deviceDb.settings, deviceDb.meta, async () => {
      for (const row of rows.filter(Boolean)) {
        if (!(await deviceDb.settings.get(row.key))) await deviceDb.settings.put(row);
      }
      await deviceDb.meta.put({ key: MIGRATED_KEY, value: true });
    });
  }
  // A recording that was interrupted reopens for the patient it was for
  let recordingFor = null;
  try { if (localStorage.getItem('aura_status') === 'RECORDING') recordingFor = localStorage.getItem('aura_patient'); } catch { /* private browsing */ }
  const active = recordingFor || (await deviceDb.meta.get(ACTIVE_KEY))?.value;
  const current = profiles.find(p => p.id === active) || profiles[0];
  if (current.id !== (await deviceDb.meta.get(ACTIVE_KEY))?.value) await deviceDb.meta.put({ key: ACTIVE_KEY, value: current.id });
  await openPatientDatabase(current.dbName);
  return { profiles, activeId: current.id };
}

export const listProfiles = () => deviceDb.profiles.orderBy('createdAt').toArray();
export const getActiveProfileId = async () => (await deviceDb.meta.get(ACTIVE_KEY))?.value ?? (await listProfiles())[0]?.id ?? null;

export async function switchProfile(id) {
  const profile = await deviceDb.profiles.get(id);
  if (!profile) throw new Error('Unknown patient');
  await openPatientDatabase(profile.dbName);
  await deviceDb.meta.put({ key: ACTIVE_KEY, value: id });
  announceDataChanged();
  return profile;
}

export async function addProfile(name, color = 'green', id = makeUUID()) {
  const profile = { id, name: name.trim(), color, dbName: dbNameFor(id), createdAt: Date.now() };
  // The new database is created and given the patient's name, so reports are right from the start
  const patientDb = createDatabase(profile.dbName);
  await patientDb.open();
  await patientDb.settings.put({ key: 'personName', value: profile.name });
  patientDb.close();
  await deviceDb.profiles.add(profile);
  announceDataChanged();
  return profile;
}

export async function updateProfile(id, fields) {
  await deviceDb.profiles.update(id, fields);
  announceDataChanged();
  return deviceDb.profiles.get(id);
}

// Deletes that patient's data from this device (other devices and backups keep theirs)
export async function removeProfile(id) {
  const profiles = await listProfiles();
  if (profiles.length <= 1) throw new Error('The last patient cannot be removed');
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;
  const active = (await deviceDb.meta.get(ACTIVE_KEY))?.value || profiles[0].id;
  if (active === id) await switchProfile(profiles.find(p => p.id !== id).id);
  await deviceDb.profiles.delete(id);
  await Dexie.delete(profile.dbName);
  announceDataChanged();
}

// Settings of this device (stored once, whichever patient is active)
export const readDeviceSettings = () => deviceDb.settings.toArray();
export const writeDeviceSetting = (key, value) => deviceDb.settings.put({ key, value });
export const clearDeviceSettings = () => deviceDb.settings.clear();

// Active medications of the patients not currently shown (their dose reminders still fire)
export async function readOtherPatientsMedications(activeId) {
  const others = (await listProfiles()).filter(p => p.id !== activeId);
  const out = [];
  for (const profile of others) {
    const patientDb = createDatabase(profile.dbName);
    try {
      await patientDb.open();
      const meds = (await patientDb.medications.toArray()).filter(m => m.active && !m.deletedAt);
      out.push({ profile, medications: meds });
    } catch { /* that patient's data couldn't be read: skip their reminders */ } finally {
      patientDb.close();
    }
  }
  return out;
}
