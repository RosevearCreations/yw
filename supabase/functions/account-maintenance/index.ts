// Edge Function: account-maintenance
// Purpose:
// - Account validation workflows for authenticated users
// - Supports admin-reviewed phone verification requests
// - Supports optional Twilio Verify SMS flow when provider env vars are configured
// - Supports retrying SMS verification sends

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hasTwilioVerify() {
  return !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_VERIFY_SERVICE_SID'));
}

async function twilioVerify(path: string, payload: URLSearchParams) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')!;
  const res = await fetch(`https://verify.twilio.com/v2/Services/${Deno.env.get('TWILIO_VERIFY_SERVICE_SID')}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString()
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok: false, error: 'Inactive profile' }, { status: 403, headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim();

  if (action === 'request_phone_verification') {
    const phone = String(body.phone || actorProfile.phone || '').trim();
    if (!phone) return Response.json({ ok: false, error: 'Phone number required' }, { status: 400, headers: corsHeaders });

    const { data, error } = await supabase.from('admin_notifications').insert({
      notification_type: 'phone_verification_request',
      target_table: 'profiles',
      target_id: actorId,
      recipient_role: 'admin',
      title: `Phone verification requested for ${actorProfile.full_name || actorProfile.email}`,
      body: JSON.stringify({ profile_id: actorId, email: actorProfile.email, phone }),
      payload: { profile_id: actorId, email: actorProfile.email, phone },
      status: 'queued',
      email_subject: `Phone verification requested for ${actorProfile.full_name || actorProfile.email}`,
      created_by_profile_id: actorId,
    }).select('*').single();

    if (error) return Response.json({ ok: false, error: String(error.message || error) }, { status: 500, headers: corsHeaders });
    await supabase.from('profiles').update({ phone, phone_validation_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', actorId);
    return Response.json({ ok: true, record: data, mode: hasTwilioVerify() ? 'admin_or_sms' : 'admin_review' }, { headers: corsHeaders });
  }

  if (action === 'send_phone_verification_code' || action === 'retry_phone_verification_code') {
    if (!hasTwilioVerify()) return Response.json({ ok: false, error: 'SMS provider not configured. Use admin-reviewed verification instead.' }, { status: 400, headers: corsHeaders });
    const phone = String(body.phone || actorProfile.phone || '').trim();
    if (!phone) return Response.json({ ok: false, error: 'Phone number required' }, { status: 400, headers: corsHeaders });
    const verify = await twilioVerify('Verifications', new URLSearchParams({ To: phone, Channel: 'sms' }));
    await supabase.from('profiles').update({ phone, phone_verification_provider: 'twilio_verify', phone_verification_sid: verify.sid || null, phone_validation_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', actorId);
    await supabase.from('admin_notifications').insert({ notification_type: 'phone_verification_sms_attempt', recipient_role: 'admin', target_table: 'profiles', target_id: actorId, title: `SMS verification sent for ${actorProfile.full_name || actorProfile.email}`, body: JSON.stringify({ profile_id: actorId, phone, provider: 'twilio_verify' }), payload: { profile_id: actorId, phone, provider: 'twilio_verify' }, sms_provider: 'twilio_verify', sms_attempt_count: 1, sms_last_attempt_at: new Date().toISOString(), status: 'queued', created_by_profile_id: actorId });
    return Response.json({ ok: true, status: verify.status || 'pending', provider: 'twilio_verify', retry: action === 'retry_phone_verification_code' }, { headers: corsHeaders });
  }

  if (action === 'verify_phone_code') {
    if (!hasTwilioVerify()) return Response.json({ ok: false, error: 'SMS provider not configured.' }, { status: 400, headers: corsHeaders });
    const phone = String(body.phone || actorProfile.phone || '').trim();
    const code = String(body.code || '').trim();
    if (!phone || !code) return Response.json({ ok: false, error: 'Phone number and code are required' }, { status: 400, headers: corsHeaders });
    const check = await twilioVerify('VerificationCheck', new URLSearchParams({ To: phone, Code: code }));
    if (String(check.status || '').toLowerCase() !== 'approved') {
      await supabase.from('admin_notifications').insert({ notification_type: 'phone_verification_sms_failed', recipient_role: 'admin', target_table: 'profiles', target_id: actorId, title: `SMS verification failed for ${actorProfile.full_name || actorProfile.email}`, body: JSON.stringify({ profile_id: actorId, phone, provider: 'twilio_verify' }), payload: { profile_id: actorId, phone, provider: 'twilio_verify' }, sms_provider: 'twilio_verify', sms_attempt_count: 1, sms_last_attempt_at: new Date().toISOString(), dead_lettered_at: new Date().toISOString(), dead_letter_reason: 'sms:verification_not_approved', status: 'dead_letter', created_by_profile_id: actorId });
      return Response.json({ ok: false, error: 'Verification code was not approved' }, { status: 400, headers: corsHeaders });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('profiles').update({ phone, phone_verified: true, phone_verified_at: now, phone_verification_provider: 'twilio_verify', phone_validation_requested_at: null, updated_at: now }).eq('id', actorId).select('*').single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
    return Response.json({ ok: true, record: data, provider: 'twilio_verify' }, { headers: corsHeaders });
  }

  return Response.json({ ok: false, error: 'Unsupported action' }, { status: 400, headers: corsHeaders });
});
