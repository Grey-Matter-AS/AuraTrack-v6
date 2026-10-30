import { createDatabase, db } from '../data/db';
import { addProfile, listProfiles, updateProfile } from '../data/profiles';
import { collectCanonicalBackupPayload, summarizeBackupPayload } from './backupFiles';
import { mergeRemoteData } from './syncHelpers';

// ─── Backups of every patient on this device ──────────────────
// { schema, version, profiles: [{ id, name, color }], patients: { [profileId]: <one patient's backup> } }
// Each patient's part is the same full backup as a single-patient file.
export const HOUSEHOLD_BACKUP_SCHEMA = 'auratrack.household-backup';

export const isHouseholdBackup = (parsed) => parsed?.schema === HOUSEHOLD_BACKUP_SCHEMA && parsed?.patients && typeof parsed.patients === 'object';

async function withPatientDatabase(profile, work) {
  if (profile.dbName === db.name) return work(db);
  const patientDb = createDatabase(profile.dbName);
  try {
    await patientDb.open();
    return await work(patientDb);
  } finally {
    patientDb.close();
  }
}

export async function collectHouseholdBackup() {
  const profiles = await listProfiles();
  const patients = {};
  for (const profile of profiles) {
    patients[profile.id] = await withPatientDatabase(profile, database => collectCanonicalBackupPayload(null, database));
  }
  return {
    schema: HOUSEHOLD_BACKUP_SCHEMA,
    version: 1,
    exportedAt: Date.now(),
    profiles: profiles.map(({ id, name, color }) => ({ id, name, color })),
    patients,
  };
}

export function summarizeHouseholdBackup(payload) {
  const totals = {};
  for (const part of Object.values(payload.patients || {})) {
    for (const [table, count] of Object.entries(summarizeBackupPayload(part))) totals[table] = (totals[table] || 0) + count;
  }
  return { ...totals, patients: Object.keys(payload.patients || {}).length };
}

// Which patient on this device a backed-up patient belongs to: same id, else same name, else (for a
// phone that only has an empty first patient) that one; otherwise a new patient is added
async function localProfileFor(saved, used) {
  const profiles = await listProfiles();
  const free = profiles.filter(p => !used.has(p.id));
  const byId = free.find(p => p.id === saved.id);
  if (byId) return byId;
  const name = (saved.name || '').trim().toLowerCase();
  const byName = name && free.find(p => (p.name || '').trim().toLowerCase() === name);
  if (byName) return byName;
  if (profiles.length === 1 && free.length === 1) {
    const empty = await withPatientDatabase(free[0], async database => (await database.events.count()) === 0);
    // A new phone's unnamed first patient becomes this one, name and colour included
    if (empty) return free[0].name ? free[0] : updateProfile(free[0].id, { name: saved.name || '', color: saved.color || free[0].color });
  }
  return addProfile(saved.name || '', saved.color || 'green', saved.id);
}

// Restores every patient in the file into the matching patient here; results are added up
export async function restoreHouseholdBackup(payload, { settingsScope } = {}) {
  const totals = { conflicts: [], rejected: 0 };
  const used = new Set();
  for (const saved of payload.profiles || []) {
    const part = payload.patients?.[saved.id];
    if (!part) continue;
    const profile = await localProfileFor(saved, used);
    used.add(profile.id);
    const result = await withPatientDatabase(profile, database => mergeRemoteData(part, { database, settingsScope }));
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'number') totals[key] = (totals[key] || 0) + value;
      else if (key === 'conflicts') totals.conflicts.push(...value);
      else if (key === 'settingsScope') totals.settingsScope = value;
    }
  }
  totals.patients = used.size;
  return totals;
}
