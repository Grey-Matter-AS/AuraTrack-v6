import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../data/db';
import { makeUUID } from '../utils/ids';
import { DATA_CHANGED_EVENT } from '../utils/dataEvents';
import { diffRegimen, getScheduledDosesForDay, regimenSnapshot, slotDose } from '../utils/medicationSchedule';

const ASSUME_GRACE_MS = 90 * 60 * 1000; // same threshold the app uses for 'late'
const ASSUME_BACKFILL_DAYS = 31;

// Next local midnight (DST-safe, unlike adding 24h)
function nextDay(dayStartMs) {
  const d = new Date(dayStartMs);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Idempotent: fills in a record for every scheduled dose that passed without a log.
// Default: today only, as 'missed'. With assume on: 'assumed' once 90 min have passed, and
// back-filled for days the app was not opened (from when the setting was turned on, max 31 days).
// The setting is read from the DB (not React state) so a call made before settings finish
// loading on launch still uses the right mode. The check and the write run in one transaction,
// so two runs at once (fast navigation, StrictMode) can't both add the same missed dose.
export function recordMissedDoses(now = Date.now()) {
  return db.transaction('rw', db.settings, db.medications, db.medicationChanges, db.medicationLogs, async () => {
    const [assumeRow, sinceRow] = await Promise.all([
      db.settings.get('assumeDosesTaken'),
      db.settings.get('assumeDosesTakenSince'),
    ]);
    const assume = assumeRow?.value === true;
    const assumeSince = sinceRow?.value || null;
    const meds = (await db.medications.toArray()).filter(m => !m.deletedAt);
    const allChanges = await db.medicationChanges.toArray();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    let firstDay = todayStart.getTime();
    if (assume) {
      const since = assumeSince ? new Date(assumeSince) : new Date(todayStart);
      since.setHours(0, 0, 0, 0);
      const backfillLimit = todayStart.getTime() - ASSUME_BACKFILL_DAYS * 86400000;
      firstDay = Math.min(todayStart.getTime(), Math.max(since.getTime(), backfillLimit));
    }

    const logs = await db.medicationLogs
      .where('takenAt').between(firstDay, todayEnd.getTime(), true, true)
      .toArray();
    const dayKey = (ms) => new Date(ms).toDateString();
    const cutoff = assume ? now - ASSUME_GRACE_MS : now;

    for (let day = firstDay; day <= todayStart.getTime(); day = nextDay(day)) {
      const doses = getScheduledDosesForDay(meds, day, allChanges);
      for (const dose of doses) {
        if (dose.scheduledTs > cutoff) continue; // not yet due (or still inside the grace period)
        const existing = logs.find((log) => {
          const matchesMedication = log.medicationUuid && dose.medicationUuid
            ? log.medicationUuid === dose.medicationUuid
            : log.medicationId === dose.medicationId;
          return matchesMedication && log.scheduledTime === dose.scheduledHHMM
            && dayKey(log.takenAt) === dayKey(dose.scheduledTs);
        });
        if (!existing) {
          await db.medicationLogs.add({
            uuid: makeUUID(),
            medicationId: dose.medicationId,
            medicationUuid: dose.medicationUuid ?? null,
            scheduledTime: dose.scheduledHHMM,
            takenAt: dose.scheduledTs,
            status: assume ? 'assumed' : 'missed',
            doseSnapshot: dose.dose ?? null,
            unitSnapshot: dose.unit ?? '',
          });
        }
      }
    }
  });
}

// One medication store for the whole app (App owns it, every screen reads it through the context),
// so a medicine added in Settings reaches the reminders and the home screen at once.
export const MedicationsContext = createContext(null);

export function useMedications() {
  const store = useContext(MedicationsContext);
  if (!store) throw new Error('useMedications must be used inside MedicationsContext');
  return store;
}

export function useMedicationsStore() {
  const [medications, setMedications] = useState([]);
  const [changes, setChanges] = useState([]);
  const [lastError, setLastError] = useState(null);

  const load = async () => {
    try {
      // Deleted medications stay as tombstones (deletedAt) so the deletion can sync
      const meds = (await db.medications.orderBy('id').toArray()).filter(m => !m.deletedAt);
      setMedications(meds);
      setChanges(await db.medicationChanges.orderBy('effectiveAt').toArray());
      setLastError(null);
      return meds;
    } catch (err) {
      console.error('Failed to load medications:', err);
      setLastError({ scope: 'load_medications', message: 'Failed to load medications.' });
      throw err;
    }
  };

  const recordChange = (med, type, from, to, { effectiveAt, note = '', changedFields = [] } = {}) =>
    db.medicationChanges.add({
      uuid: makeUUID(),
      medicationId: med.id,
      medicationUuid: med.uuid ?? null,
      medicationName: to?.name ?? med.name,
      type,
      effectiveAt: effectiveAt ?? Date.now(),
      recordedAt: Date.now(),
      from,
      to,
      changedFields,
      note: typeof note === 'string' ? note.slice(0, 500) : '',
    });

  // Every add / change / stop / restart writes the medication and its change record together
  const addMedication = async (med, opts = {}) => {
    const effectiveAt = opts.effectiveAt ?? Date.now();
    await db.transaction('rw', db.medications, db.medicationChanges, async () => {
      const record = { ...med, uuid: med.uuid || makeUUID(), active: true, startedAt: effectiveAt, stoppedAt: null };
      record.id = await db.medications.add(record);
      await recordChange(record, 'started', null, regimenSnapshot(record), { ...opts, effectiveAt });
    });
    setLastError(null);
    await load();
  };

  // Non-clinical fields (reminder, emergency display) update silently. Clinical fields need a
  // confirmed change; nameReason 'typo' with only the name changed is stored as a correction.
  const updateMedication = async (id, fields, opts = {}) => {
    await db.transaction('rw', db.medications, db.medicationChanges, async () => {
      const med = await db.medications.get(id);
      const from = regimenSnapshot(med);
      const to = regimenSnapshot({ ...med, ...fields });
      const changedFields = diffRegimen(from, to)
        .map(f => (f === 'name' && opts.nameReason === 'brand' ? 'brand' : f));
      await db.medications.update(id, fields);
      if (!changedFields.length) return;
      const type = changedFields.length === 1 && changedFields[0] === 'name' ? 'correction' : 'changed';
      await recordChange(med, type, from, to, { ...opts, changedFields });
    });
    await load();
  };

  const stopMedication = async (id, opts = {}) => {
    const effectiveAt = opts.effectiveAt ?? Date.now();
    await db.transaction('rw', db.medications, db.medicationChanges, async () => {
      const med = await db.medications.get(id);
      await db.medications.update(id, { active: false, stoppedAt: effectiveAt });
      await recordChange(med, 'stopped', regimenSnapshot(med), null, { ...opts, effectiveAt });
    });
    await load();
  };

  const restartMedication = async (id, fields = {}, opts = {}) => {
    await db.transaction('rw', db.medications, db.medicationChanges, async () => {
      const med = { ...(await db.medications.get(id)), ...fields };
      await db.medications.update(id, { ...fields, active: true, stoppedAt: null });
      await recordChange(med, 'started', null, regimenSnapshot(med), opts);
    });
    await load();
  };

  // A different active ingredient is a different medicine: stop the old one, add the new one
  const replaceMedication = async (oldId, newMed, opts = {}) => {
    const effectiveAt = opts.effectiveAt ?? Date.now();
    await db.transaction('rw', db.medications, db.medicationChanges, async () => {
      const old = await db.medications.get(oldId);
      await db.medications.update(oldId, { active: false, stoppedAt: effectiveAt });
      await recordChange(old, 'stopped', regimenSnapshot(old), null, { ...opts, effectiveAt });
      const record = { ...newMed, uuid: makeUUID(), active: true, startedAt: effectiveAt, stoppedAt: null };
      record.id = await db.medications.add(record);
      await recordChange(record, 'started', null, regimenSnapshot(record), { ...opts, effectiveAt });
    });
    await load();
  };

  // Only for entries made by mistake. The medication becomes a tombstone (deletedAt) so the
  // deletion reaches other devices on sync; its logs and change records are removed.
  const deleteMedication = async (id) => {
    const med = await db.medications.get(id).catch(() => null);
    await db.transaction('rw', db.medications, db.medicationLogs, db.medicationChanges, async () => {
      await db.medications.update(id, { active: false, deletedAt: Date.now() });
      await db.medicationLogs.where('medicationId').equals(id).delete();
      await db.medicationChanges.where('medicationId').equals(id).delete();
      if (med?.uuid) {
        await db.medicationLogs.where('medicationUuid').equals(med.uuid).delete();
        await db.medicationChanges.where('medicationUuid').equals(med.uuid).delete();
      }
    });
    await load();
  };

  const logDoseWithStatus = async (medicationId, scheduledHHMM, takenAt, status, note = '') => {
    const med = await db.medications.get(medicationId).catch(() => null);
    await db.medicationLogs.add({
      uuid: makeUUID(),
      medicationId,
      medicationUuid: med?.uuid ?? null,
      scheduledTime: scheduledHHMM ?? null,
      takenAt: takenAt ?? Date.now(),
      status: status ?? 'taken',
      doseSnapshot: med ? slotDose(regimenSnapshot(med), scheduledHHMM) ?? null : null,
      unitSnapshot: med?.unit ?? '',
      note: typeof note === 'string' ? note.slice(0, 500) : '',
    });
  };

  const getLogsForDay = async (dateMs) => {
    try {
      const start = new Date(dateMs);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateMs);
      end.setHours(23, 59, 59, 999);
      return await db.medicationLogs.where('takenAt').between(start.getTime(), end.getTime(), true, true).toArray();
    } catch (err) {
      console.error('Failed to load medication logs for day:', err);
      setLastError({ scope: 'load_logs_day', message: 'Failed to load medication logs.' });
      throw err;
    }
  };

  const getLogsForPeriod = async (fromMs, toMs) => {
    try {
      return await db.medicationLogs.where('takenAt').between(fromMs, toMs, true, true).toArray();
    } catch (err) {
      console.error('Failed to load medication logs for period:', err);
      setLastError({ scope: 'load_logs_period', message: 'Failed to load medication logs.' });
      throw err;
    }
  };

  const updateLog = async (id, changes) => {
    await db.medicationLogs.update(id, {
      ...changes,
      isEdited: true,
    });
  };

  const markMissedDoses = async () => {
    try {
      await recordMissedDoses();
      setLastError(null);
    } catch (err) {
      console.error('Failed to mark missed doses:', err);
      setLastError({ scope: 'mark_missed', message: 'Failed to record missed doses.' });
      throw err;
    }
  };

  // Loaded once, and again after a sync or restore changed the data
  useEffect(() => {
    const id = setTimeout(load, 0);
    const reload = () => { load().catch(() => {}); };
    window.addEventListener(DATA_CHANGED_EVENT, reload);
    return () => {
      clearTimeout(id);
      window.removeEventListener(DATA_CHANGED_EVENT, reload);
    };
  }, []);

  return {
    medications,
    changes,
    load,
    addMedication,
    updateMedication,
    stopMedication,
    restartMedication,
    replaceMedication,
    deleteMedication,
    logDoseWithStatus,
    getLogsForDay,
    getLogsForPeriod,
    updateLog,
    markMissedDoses,
    lastError,
    clearLastError: () => setLastError(null),
  };
}
