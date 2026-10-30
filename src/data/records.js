import { db } from './db';

// Deletes a synced row and leaves a tombstone, so the deletion reaches other devices on sync
// instead of the row being sent back. Callers pass the table name and local id.
export async function deleteRecord(tableName, id) {
  const table = db.table(tableName);
  await db.transaction('rw', table, db.tombstones, async () => {
    const row = await table.get(id);
    if (!row) return;
    await table.delete(id);
    if (row.uuid) await db.tombstones.put({ uuid: row.uuid, table: tableName, deletedAt: Date.now() });
  });
}

// A seizure and the EEG diary notes that point at it go together
export async function deleteEvent(id) {
  await db.transaction('rw', db.events, db.eegActivities, db.tombstones, async () => {
    const event = await db.events.get(id);
    if (!event) return;
    const linked = await db.eegActivities.where('linkedEventId').equals(id).toArray();
    const deletedAt = Date.now();
    for (const activity of linked) {
      await db.eegActivities.delete(activity.id);
      if (activity.uuid) await db.tombstones.put({ uuid: activity.uuid, table: 'eegActivities', deletedAt });
    }
    await db.events.delete(id);
    if (event.uuid) await db.tombstones.put({ uuid: event.uuid, table: 'events', deletedAt });
  });
}

// Every table, in one transaction: either all data is removed or none of it
export async function clearAllData() {
  await db.transaction('rw', db.tables.filter(table => table.name !== 'settings'), async () => {
    for (const table of db.tables) {
      if (table.name !== 'settings') await table.clear();
    }
  });
}
