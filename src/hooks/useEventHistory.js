import { useCallback, useState } from 'react';
import { db } from '../data/db';
import { deleteEvent as deleteEventRecord } from '../data/records';

export function useEventHistory() {
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    try {
      const events = await db.events.orderBy('startTime').reverse().limit(5).toArray();
      setHistory(events);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      return await db.events.orderBy('startTime').reverse().toArray();
    } catch (err) {
      console.error('Failed to load all events:', err);
      return [];
    }
  }, []);

  const deleteEvent = useCallback(async (id) => {
    try {
      await deleteEventRecord(id);
    } catch (err) {
      console.error('Failed to delete event:', err);
      throw err;
    }
  }, []);

  return { history, load, loadAll, deleteEvent };
}
