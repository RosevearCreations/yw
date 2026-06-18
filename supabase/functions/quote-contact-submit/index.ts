import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-06-17a';
const SCHEMA = 149;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function spamScore(body: Record<string, unknown>) {
  let score = 0;
  const message = clean(body.message, 2500);
  if (clean(body.website, 200)) score += 80;
  if (/https?:\/\//i.test(message)) score += 20;
  if ((message.match(/\b(free money|crypto|casino|loan|seo package)\b/gi) || []).length) score += 30;
  if (message && message.length < 5) score += 10;
  return Math.min(score, 100);
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Use POST for quote/contact intake.' }, { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const fullName = clean(body.full_name || body.name, 140);
    const contactValue = clean(body.contact_value || body.contact, 180);
    const serviceType = clean(body.service_type, 160);
    const serviceArea = clean(body.service_area || body.location, 160);
    const message = clean(body.message, 2500);
    const preferredContactMethod = clean(body.preferred_contact_method, 80);
    const pagePath = clean(body.page_path, 260) || '/';
    const privacyConsent = body.privacy_consent === true;
    const score = spamScore(body);

    const details: string[] = [];
    if (!fullName) details.push('Name is required.');
    if (!contactValue) details.push('Email or phone is required.');
    if (!message && !serviceType) details.push('Add a message or choose a service type.');
    if (!privacyConsent) details.push('Consent is required before we can contact you.');
    if (score >= 80) details.push('Spam protection blocked this submission.');
    if (details.length) return Response.json({ ok: false, error: 'Quote/contact intake validation failed.', details }, { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) return Response.json({ ok: false, error: 'Quote/contact intake is not configured.' }, { status: 500, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const fingerprint = await sha256(`${contactValue.toLowerCase()}|${serviceType.toLowerCase()}|${message.toLowerCase().replace(/\s+/g, ' ').slice(0, 400)}`);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: duplicate } = await supabase
      .from('quote_contact_requests')
      .select('id,request_status,created_at')
      .eq('duplicate_fingerprint', fingerprint)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) {
      await supabase.from('quote_contact_request_events').insert({
        request_id: duplicate.id,
        event_type: 'duplicate_suppressed',
        event_note: 'A duplicate public request was suppressed within the ten-minute window.',
        metadata: { build: BUILD, schema: SCHEMA, spam_score: score }
      });
      return Response.json({ ok: true, duplicate: true, request_id: duplicate.id, status: duplicate.request_status, message: 'Thanks — we already received this request.' }, { headers: corsHeaders });
    }

    const requestRow = {
      request_status: score >= 40 ? 'review' : 'new',
      request_source: 'public_website',
      full_name: fullName,
      contact_value: contactValue,
      service_type: serviceType || null,
      service_area: serviceArea || null,
      message: message || null,
      preferred_contact_method: preferredContactMethod || null,
      page_path: pagePath,
      user_agent: req.headers.get('user-agent') || '',
      ip_hint: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '',
      spam_score: score,
      privacy_consent: true,
      duplicate_fingerprint: fingerprint,
      followup_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      last_event_at: new Date().toISOString(),
      metadata: { build: BUILD, schema: SCHEMA, source: 'quote-contact-submit', referrer: clean(body.referrer, 500) }
    };

    const { data, error } = await supabase.from('quote_contact_requests').insert(requestRow).select('id,request_status,created_at,followup_due_at').single();
    if (error) throw error;

    await supabase.from('quote_contact_request_events').insert({
      request_id: data.id,
      event_type: 'created',
      event_note: 'Public quote/contact intake submitted with a 24-hour follow-up target.',
      metadata: { build: BUILD, schema: SCHEMA, spam_score: score }
    });

    return Response.json({ ok: true, request_id: data.id, status: data.request_status, followup_due_at: data.followup_due_at, message: 'Thanks — your request was received.' }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Quote/contact intake failed.' }, { status: 500, headers: corsHeaders });
  }
});
