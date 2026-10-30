// Fired on window after a sync or restore changed stored data, so open screens reload it
export const DATA_CHANGED_EVENT = 'auratrack:data-changed';

export function announceDataChanged() {
  globalThis.dispatchEvent?.(new Event(DATA_CHANGED_EVENT));
}
