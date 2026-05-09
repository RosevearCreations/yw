export function normalizeText(value) {
  return String(value || '').trim();
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input) {
  const encoded = new TextEncoder().encode(String(input || ''));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

export async function verifyStoredPasswordHash(password, storedHash) {
  const normalizedStoredHash = normalizeText(storedHash);
  if (!normalizedStoredHash) return false;
  if (normalizedStoredHash.startsWith('sha256$')) {
    return (await sha256Hex(password)) === normalizedStoredHash.slice('sha256$'.length);
  }
  return false;
}

export async function formatStoredPasswordHashFromPlaintext(password) {
  return `sha256$${await sha256Hex(password)}`;
}
