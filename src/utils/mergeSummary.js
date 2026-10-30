import i18n from '../i18n';

const ADDED = [
  ['settings', 'settings.data.import_summary_settings'],
  ['events', 'settings.data.import_summary_events'],
  ['medications', 'settings.data.import_summary_medications'],
  ['logs', 'settings.data.import_summary_logs'],
  ['medicationChanges', 'settings.data.import_summary_med_changes'],
  ['medicationsUpdated', 'settings.data.import_summary_meds_updated'],
  ['medicationsDeleted', 'settings.data.import_summary_meds_deleted'],
  ['eegSessions', 'settings.data.import_summary_eeg_sessions'],
  ['eegActivities', 'settings.data.import_summary_eeg_activities'],
  ['wellbeingEntries', 'settings.data.import_summary_wellbeing'],
];

// Records changed by a merge: added, updated from the other device, or deleted there
export function mergeTotal(r) {
  return ADDED.reduce((sum, [key]) => sum + (r[key] || 0), 0) + updatedCount(r) + (r.deleted || 0);
}

const updatedCount = (r) => (r.eventsUpdated || 0) + (r.logsUpdated || 0) + (r.eegUpdated || 0) + (r.wellbeingUpdated || 0);

// One sentence for every import, restore and sync: what was added, updated and deleted, and what
// was skipped (invalid records, or records whose medication / EEG session couldn't be identified)
export function describeMergeResult(r, t = i18n.t.bind(i18n)) {
  const parts = ADDED.filter(([key]) => r[key]).map(([key, label]) => t(label, { count: r[key] }));
  const updated = updatedCount(r);
  if (updated) parts.push(t('settings.data.import_summary_updated', { count: updated }));
  if (r.deleted) parts.push(t('settings.data.import_summary_deleted', { count: r.deleted }));
  const unmatched = (r.conflicts || []).filter(c => c.type?.startsWith('orphan_')).length;
  const kept = (r.conflicts?.length || 0) - unmatched;
  const notes = kept ? [t('settings.data.import_summary_conflicts', { count: kept })] : [];
  const skipped = describeSkipped(r, t);
  if (skipped) notes.push(skipped);
  const main = parts.length ? parts.join(', ') : t('settings.data.imported_nothing');
  return [`${main}.`, ...notes].join(' ');
}

// What was left out and why ('' when nothing was)
export function describeSkipped(r, t = i18n.t.bind(i18n)) {
  const unmatched = (r.conflicts || []).filter(c => c.type?.startsWith('orphan_')).length;
  const notes = [];
  if (unmatched) notes.push(t('settings.data.import_summary_unmatched', { count: unmatched }));
  if (r.rejected) notes.push(t('settings.data.import_summary_rejected', { count: r.rejected }));
  return notes.join(' ');
}
