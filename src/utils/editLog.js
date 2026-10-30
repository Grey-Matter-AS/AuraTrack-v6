// Appends one entry to a record's audit trail (only when something changed)
export function buildEditLog(existing, changedFields) {
  const log = existing?.editLog ? [...existing.editLog] : [];
  if (changedFields.length) log.push({ editedAt: Date.now(), changedFields });
  return log;
}
