// Random record id shared across devices (sync and backup match records by it)
export function makeUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
