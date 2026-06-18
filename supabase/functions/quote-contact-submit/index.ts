import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function spamScore(body: Record<string, unknown>) {
  let score = 0;
  const message = clean(body.message, 2000);
  const hp = clean(body.website, 200);
  if (hp) score += 80;
  if (/https?:\/\//i.test(message)) score += 20;
  if ((message.match(/\b(free money|crypto|casino|loan|seo package)\b/gi) || []).length) score += 30;
  return Math.min(score, 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Use POST for quote/contact intake.' }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fullName = clean(body.full_name || body.name, 140);
    const contactValue = clean(body.contact_value || body.contact, 180);
    const serviceType = clean(body.service_type, 160);
    const serviceArea = clean(body.service_area || body.location, 160);
    const message = clean(body.message, 2500);
    const preferredContactMethod = clean(body.preferred_contact_method, 80);
    const pagePath = clean(body.page_path, 260) || '/';
    const score = spamScore(body);

    const details: string[] = [];
    if (!fullName) details.push('Name is required.');
    if (!contactValue) details.push('Email or phone is required.');
    if (!message && !serviceType) details.push('Add a message or choose a service type.');
    if (score >= 80) details.push('Spam protection blocked this submission.');
    if (details.length) {
      return Response.json({ ok: false, error: 'Quote/contact intake validation failed.', details }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: 'Quote/contact intake is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
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
      privacy_consent: body.privacy_consent !== false,
      metadata: {
        build: '2026-06-14b',
        schema: 148,
        source: 'quote-contact-submit',
        referrer: clean(body.referrer, 500)
      }
    };

    const { data, error } = await supabase.from('quote_contact_requests').insert(requestRow).select('id,request_status,created_at').single();
    if (error) throw error;

    await supabase.from('quote_contact_request_events').insert({
      request_id: data.id,
      event_type: 'created',
      event_note: 'Public quote/contact intake submitted.',
      metadata: { build: '2026-06-14b', schema: 148, spam_score: score }
    });

    return Response.json({ ok: true, request_id: data.id, status: data.request_status, message: 'Thanks — your request was received.' }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Quote/contact intake failed.' }, { status: 500, headers: corsHeaders });
  }
});
