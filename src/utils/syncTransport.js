import { MAX_SYNC_PAYLOAD_CHARS } from './importSanitizer';

// Shared by internet (PeerJS) and same-Wi-Fi (WebRTC) sync: the payload travels as numbered chunks,
// confirmed by a 6-digit PIN, without overfilling the data channel.
export const CHUNK_SIZE = 4000;
export const MAX_CHUNKS = Math.ceil(MAX_SYNC_PAYLOAD_CHARS / CHUNK_SIZE);
const BUFFER_HIGH_WATER = 64 * 1024;
const BUFFER_WAIT_MS = 750;

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function generatePin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

export function chunkString(str) {
  if (str.length > MAX_SYNC_PAYLOAD_CHARS) throw new Error('Sync payload is too large.');
  const out = [];
  for (let i = 0; i < str.length; i += CHUNK_SIZE) out.push(str.slice(i, i + CHUNK_SIZE));
  return out.length ? out : [''];
}

// Waits while the channel's send buffer is full (or at most a moment), so large syncs don't stall
export async function waitForWritable(channel) {
  if (!channel || typeof channel.bufferedAmount !== 'number' || channel.bufferedAmount < BUFFER_HIGH_WATER) return;
  channel.bufferedAmountLowThreshold = Math.floor(BUFFER_HIGH_WATER / 2);
  await Promise.race([
    new Promise(resolve => {
      const onLow = () => {
        channel.removeEventListener?.('bufferedamountlow', onLow);
        resolve();
      };
      channel.addEventListener?.('bufferedamountlow', onLow, { once: true });
    }),
    delay(BUFFER_WAIT_MS),
  ]);
}
