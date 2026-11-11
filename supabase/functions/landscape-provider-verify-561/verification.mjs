/* YW561: independently authenticate a provider-signed, source-bound receipt.
 * Pure Web Crypto module shared by the protected Edge receiver and Node tests.
 * No customer fields, bearer tokens, signer private keys, or tenant exports. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex64 = /^[0-9a-f]{64}$/;
const keyId = /^[A-Za-z0-9_.:-]{6,96}$/;
const reference = /^[A-Za-z0-9_./:-]{6,160}$/;
const states = new Set(['queued', 'sent', 'delivered', 'failed', 'recalled']);
const fields = [
  'schema', 'issuer', 'audience', 'source_id', 'tenant_boundary', 'key_id',
  'company_id', 'request_id', 'case_version', 'followup_intent_id',
  'provider_report_id', 'provider_message_ref', 'provider_receipt_sha256',
  'provider_reported_state', 'provider_reported_at', 'issued_at', 'nonce',
];
const enc = new TextEncoder();

export function canonicalReceipt(payload, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).length !== fields.length ||
      Object.keys(payload).some(k => !fields.includes(k))) throw Error('receipt schema mismatch');
  const p = {};
  for (const field of fields) {
    if (payload[field] === undefined) throw Error('required receipt field missing');
    p[field] = payload[field];
  }
  if (p.schema !== 'rosevear.yw.provider-delivery-receipt.v1' ||
      p.issuer !== 'rosevear-comms-hub' ||
      p.audience !== 'yw-landscape-provider-receiver-561' ||
      p.source_id !== 'yw' || p.tenant_boundary !== 'company' ||
      !keyId.test(p.key_id) || !uuid.test(p.company_id) ||
      !uuid.test(p.request_id) || !uuid.test(p.followup_intent_id) ||
      !uuid.test(p.provider_report_id) || !uuid.test(p.nonce) ||
      !Number.isSafeInteger(p.case_version) || p.case_version < 2 || p.case_version > 10000 ||
      !reference.test(p.provider_message_ref) ||
      !hex64.test(p.provider_receipt_sha256) || !states.has(p.provider_reported_state))
    throw Error('receipt identity or source binding invalid');
  const issued = Date.parse(p.issued_at), reported = Date.parse(p.provider_reported_at);
  if (!Number.isFinite(issued) || !Number.isFinite(reported) ||
      new Date(issued).toISOString() !== p.issued_at ||
      new Date(reported).toISOString() !== p.provider_reported_at ||
      issued > now + 120_000 || issued < now - 600_000 ||
      reported > issued + 120_000 || reported < issued - 86_400_000)
    throw Error('receipt timestamp outside authorized freshness window');
  return JSON.stringify(p);
}

export function base64Bytes(encoded, exactLength) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
      encoded.length > 256 || encoded.length % 4 !== 0) throw Error('invalid base64 encoding');
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (bytes.length !== exactLength || btoa(binary) !== encoded)
    throw Error('invalid binary evidence length');
  return bytes;
}

export async function digestHex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function verifyReceipt(payload, signatureB64, publicKeyB64, now = Date.now()) {
  const canonical = canonicalReceipt(payload, now);
  const signature = base64Bytes(signatureB64, 64);
  const publicKey = base64Bytes(publicKeyB64, 32);
  const imported = await crypto.subtle.importKey('raw', publicKey, 'Ed25519', false, ['verify']);
  const verified = await crypto.subtle.verify('Ed25519', imported, signature, enc.encode(canonical));
  if (!verified) throw Error('independent Ed25519 provider signature invalid');
  return {
    canonical_sha256: await digestHex(enc.encode(canonical)),
    signature_sha256: await digestHex(signature),
    public_key_sha256: await digestHex(publicKey),
  };
}
