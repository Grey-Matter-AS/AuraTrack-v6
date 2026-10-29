// Lets the merge (plain JS, used by file import and both sync hooks) ask the user about
// medication conflicts through a dialog mounted once in App.
let handler = null;

export function setMedicationConflictHandler(fn) {
  handler = fn;
  return () => { if (handler === fn) handler = null; };
}

// Resolves to { [medicationUuid]: 'incoming' | 'local' }, or null when no dialog is mounted
export function askMedicationConflicts(conflicts) {
  return handler ? handler(conflicts) : Promise.resolve(null);
}
