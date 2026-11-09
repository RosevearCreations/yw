import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { quoteFor, seasonFor } from './pricing.mjs';

// Public, read-limited company catalogue and request-only submission.
// The service key never goes to the browser; direct table writes are revoked.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = 'company_id,code,item_type,name,description,unit,base_price_cents,spring_price_cents,summer_price_cents,fall_price_cents,winter_price_cents,active';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const clean = (value: unknown, length: number) => typeof value === 'string' ? value.trim().slice(0, length + 1) : '';
async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
function bad(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return bad('Use POST for a landscaping request.', 405);
  if (Number(req.headers.get('content-length') || 0) > 16384) return bad('Request exceeds the size limit.', 413);

  try {
    const raw = await req.text();
    if (raw.length > 16384) return bad('Request exceeds the size limit.', 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Invalid request.');
    const action = body.action;
    if (!['catalogue', 'preview', 'submit'].includes(action)) return bad('Unknown request action.');
    const companyId = clean(body.company_id, 40);
    if (!uuid.test(companyId)) return bad('Open a valid company booking link.');
    const { season, requestedDate } = seasonFor(body.requested_date || null);
    const url = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!url || !serviceKey) return bad('Booking requests are not configured.', 503);
    const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const [company, enabled, published, catalogue] = await Promise.all([
      sb.from('ywi_companies').select('id,name').eq('id', companyId).limit(1).maybeSingle(),
      sb.from('ywi_company_service_modules').select('company_id,module_key,enabled')
        .eq('company_id', companyId).eq('module_key', 'landscape').limit(1).maybeSingle(),
      sb.from('ywi_company_booking_public_settings_552').select('company_id,public_enabled')
        .eq('company_id',companyId).limit(1).maybeSingle(),
      sb.from('ywi_company_booking_catalogue_551').select(fields)
        .eq('company_id', companyId).eq('active', true).order('code').limit(101),
    ]);
    // No public company roster, owner identity, draft catalogue or tenant metadata.
    if (company.error || enabled.error || published.error || catalogue.error) return bad('Company catalogue is not available yet.', 503);
    if (!company.data?.id || enabled.data?.enabled !== true || enabled.data?.company_id !== companyId ||
      published.data?.company_id !== companyId || published.data?.public_enabled !== true) {
      return bad('Landscaping requests are not enabled for this company.', 404);
    }
    const rows = catalogue.data;
    if (!Array.isArray(rows) || rows.length > 100) return bad('Company catalogue is temporarily unavailable.', 503);
    const publicItems = rows.map((row: Record<string, unknown>) => ({
      code: row.code, item_type: row.item_type, name: row.name, description: row.description,
      unit: row.unit, price_cents: row[`${season}_price_cents`] ?? row.base_price_cents,
    }));
    if (action === 'catalogue') return json({ ok: true, company_name: company.data.name,
      company_id: companyId, season, items: publicItems,
      note: 'CAD, before tax. Availability and final pricing need company review. No booking is confirmed.' });

    const selections = body.selections;
    const quote = quoteFor(companyId, rows, selections, season);
    const quoteDigest = await digest({ company_id: companyId, requested_date: requestedDate, quote });
    if (action === 'preview') return json({ ok: true, quote, quote_digest: quoteDigest,
      note: 'Illustrative CAD subtotal before tax. Final service scope, disposal costs and available date require owner review.' });

    if (clean(body.website, 160)) return bad('Request could not be accepted.'); // Honeypot.
    const name = clean(body.full_name, 140);
    const contact = clean(body.contact_value, 180);
    const area = clean(body.service_area, 160);
    const method = body.preferred_contact_method;
    const message = clean(body.customer_message, 2000);
    const idempotencyKey = clean(body.idempotency_key, 40);
    if (name.length < 2 || name.length > 140 || contact.length < 3 || contact.length > 180 ||
      area.length < 2 || area.length > 160 || message.length > 2000 ||
      !['email', 'phone'].includes(method) || !uuid.test(idempotencyKey) || body.privacy_consent !== true) {
      return bad('Provide name, contact, service area, contact preference and privacy consent.');
    }
    if (body.quote_digest !== quoteDigest) return bad('Pricing or selection changed. Review the latest estimate before sending.', 409);

    // A replay with the same request key never inserts again or exposes contact data.
    const existing = await sb.from('ywi_landscape_booking_requests_552').select('id')
      .eq('company_id', companyId).eq('idempotency_key', idempotencyKey).limit(1).maybeSingle();
    if (existing.error) return bad('Booking request service is not installed.', 503);
    if (existing.data?.id) return json({ ok: true, duplicate: true,
      message: 'We already received this request. The company will review it.' });

    // Bounded company-level anti-flood control; no IP/contact data logged or sent to Comms.
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
    const recent = await sb.from('ywi_landscape_booking_requests_552').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('created_at', tenMinutesAgo);
    if (recent.error) return bad('Booking request service is unavailable.', 503);
    if ((recent.count ?? 0) >= 30) return bad('This company has reached its request intake limit. Please try again later.', 429);

    const result = await sb.from('ywi_landscape_booking_requests_552').insert({
      company_id: companyId, idempotency_key: idempotencyKey, full_name: name, contact_value: contact,
      preferred_contact_method: method, service_area: area, requested_date: requestedDate,
      customer_message: message, privacy_consent: true, notification_opt_in: body.notification_opt_in === true,
      pricing_season: season, estimated_subtotal_cents: quote.subtotal_cents,
      estimated_disposal_cents: quote.disposal_estimate_cents, quote_digest: quoteDigest,
      quotation_snapshot: quote,
    }).select('id').single();
    if (result.error) {
      if (result.error.code === '23505') return json({ ok: true, duplicate: true,
        message: 'We already received this request. The company will review it.' });
      return bad('The request was not confirmed. Please try again or contact the company.', 503);
    }
    return json({ ok: true, request_id: result.data.id, status: 'owner_review',
      message: 'Your landscaping quote request was received for owner review. No booking or payment has been made.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    return bad(/catalogue|quantity|date|season|selected|limit|service|subtotal/i.test(message) ? message : 'Request was not accepted. Check your entries.', 400);
  }
});
