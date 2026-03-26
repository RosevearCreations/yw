// Edge Function: account-maintenance
// Purpose:
// - Account validation workflows for authenticated users
// - Supports admin-reviewed phone verification requests
// - Supports optional Twilio Verify SMS flow when provider env vars are configured
// - Supports retrying SMS verification sends
// - Supports account setup completion and richer contact/profile updates

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hasTwilioVerify() {
  return !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_VERIFY_SERVICE_SID'));
}


function maskEmail(email: string) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return '';
  const [local, domain] = clean.split('@');
  const maskedLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}`;
  const domainParts = domain.split('.');
  const main = domainParts.shift() || '';
  const maskedDomain = main.length <= 1 ? '*' : `${main[0]}${'*'.repeat(Math.max(1, main.length - 1))}`;
  return `${maskedLocal}@${maskedDomain}${domainParts.length ? '.' + domainParts.join('.') : ''}`;
}

function maskUsername(username: string) {
  const clean = String(username || '').trim();
  if (!clean) return '';
  if (clean.length <= 2) return `${clean[0] || '*'}*`;
  return `${clean.slice(0, 2)}${'*'.repeat(Math.max(1, clean.length - 2))}`;
}

function digitsOnly(value: string) {
  return String(value || '').replace(/\D+/g, '');
}

async function logRecoveryRequest(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from('account_recovery_requests').insert(payload);
  } catch (_err) {
    // ignore logging failures
  }
}

async function findRecoveryProfile(supabase: any, body: Record<string, unknown>) {
  const employeeNumber = String(body.employee_number || '').trim();
  const phoneLast4 = digitsOnly(String(body.phone_last4 || '')).slice(-4);
  const lastName = String(body.last_name || '').trim().toLowerCase();
  if (!employeeNumber || !phoneLast4 || !lastName) {
    throw new Error('Employee number, phone last 4, and last name are required.');
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,username,full_name,phone,is_active')
    .eq('employee_number', employeeNumber)
    .eq('is_active', true);
  if (error) throw error;
  const match = (data || []).find((row: any) => {
    const phone = digitsOnly(row.phone || '');
    const family = String(row.full_name || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
    return phone.slice(-4) === phoneLast4 && family === lastName;
  });
  if (!match) throw new Error('We could not confirm that recovery request. Check the employee number, phone last 4, and last name.');
  return match;
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
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim();

  if (action === 'resolve_login_identifier') {
    const login = String(body.login || '').trim().toLowerCase();
    if (!login) return Response.json({ ok: false, error: 'Login is required' }, { status: 400, headers: corsHeaders });
    const { data, error } = await supabase.from('profiles').select('email,username,is_active').or(`email.ilike.${login},username.ilike.${login}`).limit(5);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
    const match = (data || []).find((row: any) => row.is_active);
    if (!match?.email) return Response.json({ ok: false, error: 'No active account matched that email or username.' }, { status: 404, headers: corsHeaders });
    return Response.json({ ok: true, email: match.email, masked_username: maskUsername(match.username || '') }, { headers: corsHeaders });
  }

  if (action === 'lookup_account_help') {
    try {
      const profile = await findRecoveryProfile(supabase, body);
      await logRecoveryRequest(supabase, { lookup_kind: 'lookup', employee_number: body.employee_number || null, phone_last4: body.phone_last4 || null, last_name: body.last_name || null, matched_profile_id: profile.id, masked_email: maskEmail(profile.email || ''), masked_username: maskUsername(profile.username || ''), request_status: 'matched' });
      return Response.json({ ok: true, masked_email: maskEmail(profile.email || ''), masked_username: maskUsername(profile.username || '') }, { headers: corsHeaders });
    } catch (err) {
      await logRecoveryRequest(supabase, { lookup_kind: 'lookup', employee_number: body.employee_number || null, phone_last4: body.phone_last4 || null, last_name: body.last_name || null, request_status: 'failed', notes: String(err?.message || err) });
      return Response.json({ ok: false, error: err?.message || 'Account lookup failed.' }, { status: 400, headers: corsHeaders });
    }
  }

  if (action === 'send_recovery_email') {
    try {
      const profile = await findRecoveryProfile(supabase, body);
      const redirectTo = String(body.redirect_to || `${Deno.env.get('SITE_URL') || ''}`).trim() || undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, redirectTo ? { redirectTo } : undefined);
      if (error) throw error;
      await logRecoveryRequest(supabase, { lookup_kind: 'send_recovery_email', employee_number: body.employee_number || null, phone_last4: body.phone_last4 || null, last_name: body.last_name || null, matched_profile_id: profile.id, masked_email: maskEmail(profile.email || ''), masked_username: maskUsername(profile.username || ''), request_status: 'sent' });
      return Response.json({ ok: true, message: `Recovery email sent to ${maskEmail(profile.email || '')}.` }, { headers: corsHeaders });
    } catch (err) {
      await logRecoveryRequest(supabase, { lookup_kind: 'send_recovery_email', employee_number: body.employee_number || null, phone_last4: body.phone_last4 || null, last_name: body.last_name || null, request_status: 'failed', notes: String(err?.message || err) });
      return Response.json({ ok: false, error: err?.message || 'Recovery email failed.' }, { status: 400, headers: corsHeaders });
    }
  }

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok: false, error: 'Inactive profile' }, { status: 403, headers: corsHeaders });

  if (action === 'update_recovery_profile') {
    const username = String(body.username || '').trim() || null;
    const recoveryEmail = String(body.recovery_email || '').trim() || null;
    const phone = String(body.phone || actorProfile.phone || '').trim() || null;
    const patch: Record<string, unknown> = {
      username,
      recovery_email: recoveryEmail,
      phone,
      full_name: String(body.full_name || actorProfile.full_name || '').trim() || null,
      address_line1: String(body.address_line1 || actorProfile.address_line1 || '').trim() || null,
      address_line2: String(body.address_line2 || actorProfile.address_line2 || '').trim() || null,
      city: String(body.city || actorProfile.city || '').trim() || null,
      province: String(body.province || actorProfile.province || '').trim() || null,
      postal_code: String(body.postal_code || actorProfile.postal_code || '').trim() || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', actorId).select('*').single();
    if (error) return Response.json({ ok: false, error: String(error.message || error) }, { status: 500, headers: corsHeaders });
    return Response.json({ ok: true, record: data }, { headers: corsHeaders });
  }

  if (action === 'complete_account_setup') {
    const username = String(body.username || '').trim();
    const recoveryEmail = String(body.recovery_email || '').trim() || null;
    const phone = String(body.phone || actorProfile.phone || '').trim() || null;
    const fullName = String(body.full_name || actorProfile.full_name || '').trim() || null;
    if (!username) return Response.json({ ok: false, error: 'Username is required.' }, { status: 400, headers: corsHeaders });
    const patch: Record<string, unknown> = {
      username,
      recovery_email: recoveryEmail,
      phone,
      full_name: fullName,
      address_line1: String(body.address_line1 || actorProfile.address_line1 || '').trim() || null,
      address_line2: String(body.address_line2 || actorProfile.address_line2 || '').trim() || null,
      city: String(body.city || actorProfile.city || '').trim() || null,
      province: String(body.province || actorProfile.province || '').trim() || null,
      postal_code: String(body.postal_code || actorProfile.postal_code || '').trim() || null,
      password_login_ready: true,
      account_setup_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', actorId).select('*').single();
    if (error) return Response.json({ ok: false, error: String(error.message || error) }, { status: 500, headers: corsHeaders });
    return Response.json({ ok: true, record: data, message: 'Account setup completed.' }, { headers: corsHeaders });
  }

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
