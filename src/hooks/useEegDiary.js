import { useCallback, useEffect, useState } from 'react';
import { db } from '../data/db';
import { makeUUID } from '../utils/ids';
import { buildEditLog } from '../utils/editLog';
import { deleteRecord } from '../data/records';

function deriveDuration(startTime, endTime) {
  if (!startTime || !endTime || endTime < startTime) return 0;
  return Math.floor((endTime - startTime) / 1000);
}

async function getRunningActivity(sessionId) {
  if (!sessionId) return null;
  const rows = await db.eegActivities
    .where('sessionId')
    .equals(sessionId)
    .sortBy('startTime');
  return rows.find(activity => activity.endTime == null) || null;
}

export function useEegDiary() {
  const [activeSession, setActiveSession] = useState(null);
  const [currentActivity, setCurrentActivity] = useState(null);
  const [activities, setActivities] = useState([]);

  const load = useCallback(async () => {
    try {
      const session = await db.eegSessions.where('status').equals('ACTIVE').last();
      setActiveSession(session || null);
      if (session) {
        const [activeActivity, sessionActivities] = await Promise.all([
          getRunningActivity(session.id),
          db.eegActivities
            .where('sessionId')
            .equals(session.id)
            .sortBy('startTime'),
        ]);
        setCurrentActivity(activeActivity || null);
        setActivities(sessionActivities.reverse());
      } else {
        setCurrentActivity(null);
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to load EEG diary state:', err);
      setActiveSession(null);
      setCurrentActivity(null);
      setActivities([]);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const loadActivitiesForSession = useCallback(async (sessionId) => {
    if (!sessionId) return [];
    const sessionActivities = await db.eegActivities
      .where('sessionId')
      .equals(sessionId)
      .sortBy('startTime');
    return sessionActivities.reverse();
  }, []);

  const refreshActiveSession = useCallback(async () => {
    const session = await db.eegSessions.where('status').equals('ACTIVE').last();
    setActiveSession(session || null);
    if (session) {
      const [activeActivity, sessionActivities] = await Promise.all([
        getRunningActivity(session.id),
        loadActivitiesForSession(session.id),
      ]);
      setCurrentActivity(activeActivity || null);
      setActivities(sessionActivities);
    } else {
      setCurrentActivity(null);
      setActivities([]);
    }
  }, [loadActivitiesForSession]);

  const startSession = useCallback(async ({ durationPreset = '24h', customHours = '', title = '', notes = '' } = {}) => {
    const existing = await db.eegSessions.where('status').equals('ACTIVE').last();
    if (existing) return existing;
    const now = Date.now();
    const presetHours = durationPreset === '72h' ? 72 : durationPreset === 'custom' ? Number(customHours || 0) : 24;
    const plannedEndTime = presetHours > 0 ? now + presetHours * 60 * 60 * 1000 : null;
    const id = await db.eegSessions.add({
      uuid: makeUUID(),
      startTime: now,
      plannedEndTime,
      actualEndTime: null,
      durationPreset,
      customHours: durationPreset === 'custom' ? Number(customHours || 0) : null,
      title: title.trim(),
      notes: notes.trim(),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    await refreshActiveSession();
    return db.eegSessions.get(id);
  }, [refreshActiveSession]);

  const endSession = useCallback(async (sessionId = activeSession?.id) => {
    if (!sessionId) return;
    const now = Date.now();
    const running = await getRunningActivity(sessionId);
    if (running) {
      await db.eegActivities.update(running.id, {
        endTime: now,
        durationSec: deriveDuration(running.startTime, now),
        updatedAt: now,
      });
    }
    await db.eegSessions.update(sessionId, {
      status: 'COMPLETED',
      actualEndTime: now,
      updatedAt: now,
    });
    await refreshActiveSession();
  }, [activeSession, refreshActiveSession]);

  const startActivity = useCallback(async ({ activityLabel, customActivityText = '', moodLabel = '', notes = '' }) => {
    if (!activeSession?.id || !activityLabel?.trim()) return null;
    const now = Date.now();
    const running = await getRunningActivity(activeSession.id);
    if (running) {
      await db.eegActivities.update(running.id, {
        endTime: now,
        durationSec: deriveDuration(running.startTime, now),
        updatedAt: now,
      });
    }
    const id = await db.eegActivities.add({
      uuid: makeUUID(),
      sessionId: activeSession.id,
      sessionUuid: activeSession.uuid || '',
      kind: 'ACTIVITY',
      activityLabel: activityLabel.trim(),
      customActivityText: customActivityText.trim(),
      moodLabel: moodLabel.trim(),
      notes: notes.trim(),
      startTime: now,
      endTime: null,
      durationSec: 0,
      linkedEventId: null,
      linkedEventUuid: '',
      isEdited: false,
      editLog: [],
      createdAt: now,
      updatedAt: now,
    });
    await refreshActiveSession();
    return db.eegActivities.get(id);
  }, [activeSession, refreshActiveSession]);

  const stopActivity = useCallback(async (activityId = currentActivity?.id, stopTime = Date.now()) => {
    if (!activityId) return;
    const existing = await db.eegActivities.get(activityId);
    if (!existing) return;
    await db.eegActivities.update(activityId, {
      endTime: stopTime,
      durationSec: deriveDuration(existing.startTime, stopTime),
      updatedAt: Date.now(),
    });
    await refreshActiveSession();
  }, [currentActivity, refreshActiveSession]);

  const updateActivity = useCallback(async (activityId, updates) => {
    const existing = await db.eegActivities.get(activityId);
    if (!existing) return;
    const next = {
      ...existing,
      ...updates,
    };
    if (updates.durationSec != null && updates.endTime == null) {
      next.endTime = next.startTime + Math.max(0, Number(updates.durationSec) || 0) * 1000;
    }
    const startTime = next.startTime;
    const endTime = next.endTime;
    const durationSec = deriveDuration(startTime, endTime);
    const changedFields = [];
    ['activityLabel', 'customActivityText', 'moodLabel', 'notes', 'startTime', 'endTime'].forEach(field => {
      if ((next[field] ?? '') !== (existing[field] ?? '')) changedFields.push(field);
    });
    if (durationSec !== (existing.durationSec || 0)) changedFields.push('duration');
    await db.eegActivities.update(activityId, {
      ...updates,
      endTime,
      durationSec,
      isEdited: true,
      editLog: buildEditLog(existing, changedFields),
      updatedAt: Date.now(),
    });
    await refreshActiveSession();
  }, [refreshActiveSession]);

  const deleteActivity = useCallback(async (activityId) => {
    await deleteRecord('eegActivities', activityId);
    await refreshActiveSession();
  }, [refreshActiveSession]);

  const stopForSeizureStart = useCallback(async (seizureStartTime) => {
    if (!activeSession?.id || !currentActivity?.id) return;
    await stopActivity(currentActivity.id, seizureStartTime);
  }, [activeSession, currentActivity, stopActivity]);

  // The reference goes in the seizure's own EEG session (an edited old seizure never moves into
  // today's session); a new seizure without one joins the session running now.
  const addSeizureReference = useCallback(async (event) => {
    const sessionId = event?.eegSessionId ?? activeSession?.id;
    if (!sessionId || !event?.id) return null;
    const now = Date.now();
    const existing = await db.eegActivities
      .where('linkedEventId')
      .equals(event.id)
      .first();
    const session = await db.eegSessions.get(sessionId);
    const payload = {
      sessionId,
      sessionUuid: session?.uuid || '',
      kind: 'SEIZURE_REFERENCE',
      activityLabel: event.type && event.type !== 'Uncategorized' ? event.type : 'Seizure recorded',
      customActivityText: '',
      moodLabel: '',
      notes: event.notes || '',
      startTime: event.startTime,
      endTime: event.endTime || (event.startTime + (event.duration || 0) * 1000),
      durationSec: event.duration || 0,
      linkedEventId: event.id,
      linkedEventUuid: event.uuid || '',
      updatedAt: now,
    };
    if (existing) {
      await db.eegActivities.update(existing.id, {
        ...payload,
        isEdited: existing.isEdited || false,
      });
    } else {
      await db.eegActivities.add({
        uuid: makeUUID(),
        ...payload,
        isEdited: false,
        editLog: [],
        createdAt: now,
      });
    }
    await refreshActiveSession();
  }, [activeSession, refreshActiveSession]);

  const getSessions = useCallback(async () => {
    return db.eegSessions.orderBy('startTime').reverse().toArray();
  }, []);

  const getActivitiesForSession = useCallback(async (sessionId) => {
    return loadActivitiesForSession(sessionId);
  }, [loadActivitiesForSession]);

  return {
    activeSession,
    currentActivity,
    activities,
    load,
    startSession,
    endSession,
    startActivity,
    stopActivity,
    updateActivity,
    deleteActivity,
    stopForSeizureStart,
    addSeizureReference,
    getSessions,
    getActivitiesForSession,
  };
}
