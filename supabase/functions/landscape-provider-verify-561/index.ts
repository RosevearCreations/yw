/* YW561 protected server-to-server receiver. No browser CORS, customer PII, or
 * self-enrollment. Provider pin and bearer credential must be pre-enrolled by
 * independent custodians; fail closed if absent. */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { canonicalReceipt, digestHex, verifyReceipt } from './verification.mjs';

const json = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" },
});
const fail = (status = 403) => json({ ok: false, status: 'HOLD_PROTECTED_PROVIDER_EVIDENCE' }, status);

async function protectedToken(given: string, expected: string): Promise<boolean> {
  if (!given || !expected || given.length > 256 || expected.length > 256) return false;
  const a = await digestHex(new TextEncoder().encode(given));
  const b = await digestHex(new TextEncoder().encode(expected));
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

serve(async req => {
  if (req.method !== 'POST') return fail(405);
  if (Number(req.headers.get('content-length') || 0) > 8192) return fail(413);
  const receiverToken = Deno.env.get('YW561_RECEIVER_TOKEN') || '';
  const endpoint = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!receiverToken || !endpoint || !serviceKey) return fail(503);
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') ||
      !await protectedToken(auth.slice(7), receiverToken)) return fail(401);
  try {
    const raw = await req.text();
    if (raw.length > 8192) return fail(413);
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object' ||
        Object.keys(body).length !== 2 ||
        !Object.hasOwn(body, 'payload') || !Object.hasOwn(body, 'signature')) return fail();
    const p = body.payload;
    canonicalReceipt(p);
    const sb = createClient(endpoint, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-YW561-Source': 'protected-provider-receiver' } },
    });
    const pin = await sb.from('ywi_landscape_provider_signer_pins_561')
      .select('issuer,key_id,public_key_b64,public_key_sha256,state,custody_evidence_ref,valid_from,valid_until')
      .eq('issuer', p.issuer).eq('key_id', p.key_id).eq('state', 'ACTIVE')
      .limit(1).maybeSingle();
    if (pin.error || !pin.data || !pin.data.custody_evidence_ref ||
        Date.parse(pin.data.valid_from) > Date.now() ||
        (pin.data.valid_until && Date.parse(pin.data.valid_until) <= Date.now())) return fail();
    const verified = await verifyReceipt(p, body.signature, pin.data.public_key_b64);
    if (verified.public_key_sha256 !== pin.data.public_key_sha256) return fail();
    // One database transaction binds the prior 560 claim to the original 559
    // intent and atomically commits the provider nonce/replay evidence.
    const result = await sb.rpc('ywi_rpc_landscape_provider_verify_561', {
      p_provider_report_id: p.provider_report_id, p_company_id: p.company_id,
      p_request_id: p.request_id, p_case_version: p.case_version,
      p_followup_intent_id: p.followup_intent_id,
      p_issuer: p.issuer, p_key_id: p.key_id, p_nonce: p.nonce,
      p_message_ref: p.provider_message_ref, p_receipt_sha256: p.provider_receipt_sha256,
      p_reported_state: p.provider_reported_state,
      p_reported_at: p.provider_reported_at, p_issued_at: p.issued_at,
      p_canonical_sha256: verified.canonical_sha256,
      p_signature_sha256: verified.signature_sha256,
    });
    if (result.error || !result.data || result.data.signature_verified !== true ||
        result.data.master_delivery_accepted !== false) return fail(409);
    return json({ ok: true, status: 'PROVIDER_SIGNATURE_VERIFIED_MASTER_HOLD',
      receipt_id: result.data.receipt_id, replayed: result.data.replayed,
      provider_signature_verified: true, master_delivery_accepted: false,
      customer_delivery_independently_verified: false });
  } catch (_) {
    return fail(); // Never log raw signed payload, customer metadata or credentials.
  }
});
