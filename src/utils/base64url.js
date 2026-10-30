// URL-safe base64 without padding (backup files and sync QR codes)
export function toBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.length % 4 ? base64 + '='.repeat(4 - (base64.length % 4)) : base64;
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
