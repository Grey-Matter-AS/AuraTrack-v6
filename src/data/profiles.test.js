import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { DEFAULT_DB_NAME, createDatabase, db, openPatientDatabase } from './db';
import { addProfile, deviceDb, ensureProfiles, listProfiles, removeProfile, switchProfile } from './profiles';
import { mergeRemoteData } from '../utils/syncHelpers';

beforeEach(async () => {
  await openPatientDatabase(DEFAULT_DB_NAME);
  for (const profile of await deviceDb.profiles.toArray()) {
    if (profile.dbName !== DEFAULT_DB_NAME) await Dexie.delete(profile.dbName);
  }
  await deviceDb.delete();
  await deviceDb.open();
  await db.events.clear();
  await db.settings.clear();
});

describe('patient profiles', () => {
  it('turns the existing data into patient 1 and moves the device settings', async () => {
    await db.settings.bulkPut([{ key: 'personName', value: 'Anna' }, { key: 'theme', value: 'light' }, { key: 'neurologistName', value: 'Dr X' }]);
    const { profiles, activeId } = await ensureProfiles();
    expect(profiles).toEqual([expect.objectContaining({ name: 'Anna', dbName: DEFAULT_DB_NAME })]);
    expect(activeId).toBe(profiles[0].id);
    expect((await deviceDb.settings.get('theme')).value).toBe('light');
    expect(await deviceDb.settings.get('neurologistName')).toBeUndefined();
  });

  it('keeps each patient\'s data separate', async () => {
    await ensureProfiles();
    await db.events.add({ startTime: 1, duration: 10, type: 'Absence' });
    const ben = await addProfile('Ben');
    await switchProfile(ben.id);
    expect(db.name).toBe(ben.dbName);
    expect(await db.events.count()).toBe(0);
    expect((await db.settings.get('personName')).value).toBe('Ben');
    await db.events.add({ startTime: 2, duration: 20, type: 'Tonic-Clonic' });

    const [anna] = await listProfiles();
    await switchProfile(anna.id);
    expect((await db.events.toArray()).map(e => e.type)).toEqual(['Absence']);
    // The choice is remembered for the next launch
    expect((await ensureProfiles()).activeId).toBe(anna.id);
  });

  it('can merge into a patient that is not the active one', async () => {
    await ensureProfiles();
    const ben = await addProfile('Ben');
    const benDb = createDatabase(ben.dbName);
    await mergeRemoteData({ events: [{ uuid: 'b1', startTime: 5, duration: 3 }] }, { database: benDb, medicationResolutions: {} });
    expect(await benDb.events.count()).toBe(1);
    expect(await db.events.count()).toBe(0);
    benDb.close();
  });

  it('removes a patient from this device, but never the last one', async () => {
    const { profiles } = await ensureProfiles();
    await expect(removeProfile(profiles[0].id)).rejects.toThrow();
    const ben = await addProfile('Ben');
    await switchProfile(ben.id);
    await removeProfile(ben.id);
    expect((await listProfiles()).map(p => p.name)).toEqual([profiles[0].name]);
    expect(db.name).toBe(DEFAULT_DB_NAME);
    expect(await Dexie.exists(ben.dbName)).toBe(false);
  });
});

describe('backup of every patient', () => {
  it('restores each patient into its own data on a fresh phone, reusing its empty first patient', async () => {
    const { collectHouseholdBackup, restoreHouseholdBackup } = await import('../utils/householdBackup');
    await db.settings.put({ key: 'personName', value: 'Anna' });
    await ensureProfiles();
    await db.events.add({ uuid: 'a1', startTime: 1, duration: 10, type: 'Absence' });
    const ben = await addProfile('Ben');
    await switchProfile(ben.id);
    await db.events.add({ uuid: 'b1', startTime: 2, duration: 20, type: 'Tonic-Clonic' });
    const file = JSON.parse(JSON.stringify(await collectHouseholdBackup()));

    // A new phone: nothing but its own empty first patient
    await openPatientDatabase(DEFAULT_DB_NAME);
    await Dexie.delete(ben.dbName);
    await db.events.clear();
    await db.settings.clear();
    await deviceDb.delete();
    await deviceDb.open();
    await ensureProfiles();

    const result = await restoreHouseholdBackup(file, { settingsScope: 'all' });
    expect(result.patients).toBe(2);
    expect(result.events).toBe(2);
    const profiles = await listProfiles();
    expect(profiles.map(p => p.name).sort()).toEqual(['Anna', 'Ben']);
    for (const profile of profiles) {
      await switchProfile(profile.id);
      const types = (await db.events.toArray()).map(e => e.type);
      expect(types).toEqual(profile.name === 'Anna' ? ['Absence'] : ['Tonic-Clonic']);
    }
  });
});
