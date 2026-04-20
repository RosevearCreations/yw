// Edge Function: account-maintenance
// Purpose:
// - Public account lookup and password recovery helpers
// - Authenticated account/profile maintenance and onboarding helpers
// - Admin-reviewed / SMS phone verification workflows
// - Username/email change request workflows with validation

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sbUrl() {
  return Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL") || "";
}

function sbServiceRoleKey() {
  return Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function hasTwilioVerify() {
  return !!(
    Deno.env.get("TWILIO_ACCOUNT_SID") &&
    Deno.env.get("TWILIO_AUTH_TOKEN") &&
    Deno.env.get("TWILIO_VERIFY_SERVICE_SID")
  );
}

function maskEmail(email: string) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return "";
  const [local, domain] = clean.split("@");
  const maskedLocal =
    local.length <= 2
      ? `${local[0] || "*"}*`
      : `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}`;
  const domainParts = domain.split(".");
  const main = domainParts.shift() || "";
  const maskedDomain =
    main.length <= 1 ? "*" : `${main[0]}${"*".repeat(Math.max(1, main.length - 1))}`;
  return `${maskedLocal}@${maskedDomain}${domainParts.length ? "." + domainParts.join(".") : ""}`;
}

function maskUsername(username: string) {
  const clean = String(username || "").trim();
  if (!clean) return "";
  if (clean.length <= 2) return `${clean[0] || "*"}*`;
  return `${clean.slice(0, 2)}${"*".repeat(Math.max(1, clean.length - 2))}`;
}

function digitsOnly(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPostalCode(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return true;
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(clean);
}

function isValidProvince(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return true;
  return /^[A-Za-z][A-Za-z ]{1,30}$/.test(clean);
}

function pickRecoveryEmail(profile: Record<string, unknown> | null | undefined) {
  const recoveryEmail = String(profile?.recovery_email || "").trim().toLowerCase();
  const primaryEmail = String(profile?.email || "").trim().toLowerCase();
  if (recoveryEmail && isValidEmail(recoveryEmail)) return recoveryEmail;
  if (primaryEmail && isValidEmail(primaryEmail)) return primaryEmail;
  return "";
}

function isLikelyAddress(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return true;
  return clean.length >= 4;
}


async function logLoginEvent(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from("account_login_events").insert(payload);
    await supabase.from("site_activity_events").insert({
      event_type: 'account_login',
      entity_type: 'profile',
      entity_id: payload.profile_id ? String(payload.profile_id) : null,
      severity: payload.success === false ? 'warning' : 'info',
      title: payload.success === false ? 'Account access failed' : 'Account access recorded',
      summary: payload.success === false ? 'A login-related access failure was recorded.' : 'A login or session restore event was recorded.',
      metadata: { auth_source: payload.auth_source || null, route_fragment: payload.route_fragment || null, success: !!payload.success },
      related_profile_id: payload.profile_id || null,
      created_by_profile_id: payload.profile_id || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
    });
  } catch {
    // ignore login audit failures
  }
}


async function logSiteActivity(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from("site_activity_events").insert({
      event_type: payload.event_type || 'account_login',
      entity_type: payload.entity_type || 'profile',
      entity_id: payload.entity_id != null ? String(payload.entity_id) : null,
      severity: payload.severity || 'info',
      title: payload.title || 'Activity recorded',
      summary: payload.summary || null,
      metadata: payload.metadata || {},
      related_job_id: payload.related_job_id || null,
      related_profile_id: payload.related_profile_id || null,
      created_by_profile_id: payload.created_by_profile_id || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
    });
  } catch {
    // ignore activity log failures
  }
}

async function getWorkerCrewIds(supabase: any, profileId: string) {
  const { data } = await supabase.from('crew_members').select('crew_id').eq('profile_id', profileId);
  return (data || []).map((row: any) => row.crew_id).filter(Boolean);
}

async function getClockContext(supabase: any, actorId: string, actorProfile: any) {
  const crewIds = await getWorkerCrewIds(supabase, actorId);
  let jobsQuery = supabase.from('v_jobs_directory').select('*').in('status', ['pending','approved','scheduled','in_progress','active','completed','done','closed']);
  if (crewIds.length) {
    jobsQuery = jobsQuery.in('crew_id', crewIds);
  } else {
    jobsQuery = jobsQuery.or(`assigned_supervisor_profile_id.eq.${actorId},site_supervisor_profile_id.eq.${actorId},signing_supervisor_profile_id.eq.${actorId},admin_profile_id.eq.${actorId},created_by_profile_id.eq.${actorId}`);
  }
  const { data: jobs } = await jobsQuery.order('start_date', { ascending: false }).limit(50);
  const { data: activeEntry } = await supabase.from('v_employee_time_clock_current').select('*').eq('profile_id', actorId).limit(1).maybeSingle();
  const { data: recentEntries } = await supabase.from('v_employee_time_clock_entries').select('*').eq('profile_id', actorId).order('signed_in_at', { ascending: false }).limit(20);
  return {
    active_entry: activeEntry || null,
    recent_entries: recentEntries || [],
    available_jobs: jobs || [],
    crew_ids: crewIds,
    profile: {
      id: actorProfile.id,
      full_name: actorProfile.full_name || null,
      employee_number: actorProfile.employee_number || null,
      role: actorProfile.role || null,
    }
  };
}

async function ensureClockJobSession(supabase: any, actorId: string, actorProfile: any, jobId: number, nowIso: string) {
  const today = nowIso.slice(0, 10);
  const { data: existing } = await supabase
    .from('job_sessions')
    .select('*')
    .eq('job_id', jobId)
    .eq('session_date', today)
    .in('session_status', ['planned','in_progress','paused','delayed'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing;
  const { data: job } = await supabase.from('jobs').select('id,site_id,site_supervisor_profile_id,crew_id,job_type,recurrence_summary').eq('id', jobId).maybeSingle();
  const { data: created, error } = await supabase.from('job_sessions').insert({
    job_id: jobId,
    session_date: today,
    session_kind: 'field_service',
    session_status: 'in_progress',
    service_frequency_label: job?.recurrence_summary || job?.job_type || 'site_visit',
    started_at: nowIso,
    site_supervisor_profile_id: job?.site_supervisor_profile_id || null,
    created_by_profile_id: actorId,
    created_at: nowIso,
    updated_at: nowIso,
  }).select('*').single();
  if (error) throw error;
  await supabase.from('jobs').update({ last_activity_at: nowIso, updated_at: nowIso }).eq('id', jobId);
  await logSiteActivity(supabase, {
    event_type: 'job_session_created',
    entity_type: 'job_session',
    entity_id: created?.id || null,
    title: `Job session started for ${job?.job_type || 'field work'}`,
    summary: 'A time clock sign-in created a working job session.',
    related_job_id: jobId,
    related_profile_id: actorId,
    created_by_profile_id: actorId,
    metadata: { source: 'employee_time_clock' },
    occurred_at: nowIso,
  });
  return { ...created, site_id: job?.site_id || null, crew_id: job?.crew_id || null };
}

function roundTwo(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

type ClockInGeoPayload = {
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_accuracy_m: number | null;
  clock_in_geo_source: string;
  clock_in_photo_note: string | null;
};

type ClockOutGeoPayload = {
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_out_accuracy_m: number | null;
  clock_out_geo_source: string;
  clock_out_photo_note: string | null;
};

function getClockInGeoPayload(body: any): ClockInGeoPayload {
  const lat = body?.latitude == null || String(body.latitude).trim() === '' ? null : Number(body.latitude);
  const lng = body?.longitude == null || String(body.longitude).trim() === '' ? null : Number(body.longitude);
  const acc = body?.accuracy_m == null || String(body.accuracy_m).trim() === '' ? null : Number(body.accuracy_m);
  const source = String(body?.geo_source || '').trim() || 'manual';
  const photoNote = String(body?.photo_note || '').trim() || null;
  return {
    clock_in_latitude: Number.isFinite(lat) ? lat : null,
    clock_in_longitude: Number.isFinite(lng) ? lng : null,
    clock_in_accuracy_m: Number.isFinite(acc) ? acc : null,
    clock_in_geo_source: source,
    clock_in_photo_note: photoNote,
  };
}

function getClockOutGeoPayload(body: any): ClockOutGeoPayload {
  const lat = body?.latitude == null || String(body.latitude).trim() === '' ? null : Number(body.latitude);
  const lng = body?.longitude == null || String(body.longitude).trim() === '' ? null : Number(body.longitude);
  const acc = body?.accuracy_m == null || String(body.accuracy_m).trim() === '' ? null : Number(body.accuracy_m);
  const source = String(body?.geo_source || '').trim() || 'manual';
  const photoNote = String(body?.photo_note || '').trim() || null;
  return {
    clock_out_latitude: Number.isFinite(lat) ? lat : null,
    clock_out_longitude: Number.isFinite(lng) ? lng : null,
    clock_out_accuracy_m: Number.isFinite(acc) ? acc : null,
    clock_out_geo_source: source,
    clock_out_photo_note: photoNote,
  };
}

async function syncCrewHoursFromTimeEntry(supabase: any, entry: any, actorProfile: any, nowIso: string) {
  if (!entry?.id || !entry?.profile_id || !entry?.job_id) return null;
  const totalHours = roundTwo(Number(entry.paid_work_minutes || 0) / 60);
  const overtimeHours = totalHours > 8 ? roundTwo(totalHours - 8) : 0;
  const regularHours = roundTwo(totalHours - overtimeHours);
  const payload = {
    time_entry_id: entry.id,
    job_session_id: entry.job_session_id || null,
    job_id: entry.job_id,
    crew_id: entry.crew_id || null,
    profile_id: entry.profile_id,
    worker_name: actorProfile?.full_name || actorProfile?.email || 'Worker',
    started_at: entry.signed_in_at || nowIso,
    ended_at: entry.signed_out_at || nowIso,
    hours_worked: totalHours,
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    break_minutes: Number(entry.unpaid_break_minutes || 0),
    pay_code: overtimeHours > 0 ? 'mixed' : 'regular',
    notes: entry.notes || null,
    created_by_profile_id: entry.profile_id,
    updated_at: nowIso,
  };
  const { data: existing } = await supabase.from('job_session_crew_hours').select('id').eq('time_entry_id', entry.id).maybeSingle();
  if (existing?.id) {
    const { data, error } = await supabase.from('job_session_crew_hours').update(payload).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('job_session_crew_hours').insert({ ...payload, created_at: nowIso }).select('*').single();
  if (error) throw error;
  return data;
}

async function logRecoveryRequest(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from("account_recovery_requests").insert(payload);
  } catch {
    // ignore logging failures
  }
}

async function findRecoveryProfile(supabase: any, body: Record<string, unknown>) {
  const employeeNumber = String(body.employee_number || "").trim();
  const phoneLast4 = digitsOnly(String(body.phone_last4 || "")).slice(-4);
  const lastName = String(body.last_name || "").trim().toLowerCase();

  if (!employeeNumber || !phoneLast4 || !lastName) {
    throw new Error("Employee number, phone last 4, and last name are required.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,recovery_email,username,full_name,phone,is_active")
    .eq("employee_number", employeeNumber)
    .eq("is_active", true);

  if (error) throw error;

  const match = (data || []).find((row: any) => {
    const phone = digitsOnly(row.phone || "");
    const family = String(row.full_name || "")
      .trim()
      .split(/\s+/)
      .pop()
      ?.toLowerCase() || "";
    return phone.slice(-4) === phoneLast4 && family === lastName;
  });

  if (!match) {
    throw new Error(
      "We could not confirm that recovery request. Check the employee number, phone last 4, and last name.",
    );
  }

  return match;
}

async function usernameExists(supabase: any, username: string, excludeId?: string | null) {
  const clean = normalizeUsername(username);
  if (!clean) return false;

  let query = supabase
    .from("profiles")
    .select("id,username")
    .ilike("username", clean)
    .limit(10);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).some(
    (row: any) => normalizeUsername(row.username || "") === clean,
  );
}

async function emailExistsInProfiles(supabase: any, email: string, excludeId?: string | null) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return false;

  let query = supabase
    .from("profiles")
    .select("id,email,recovery_email")
    .or(`email.ilike.${clean},recovery_email.ilike.${clean}`)
    .limit(10);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).some(
    (row: any) =>
      String(row.email || "").trim().toLowerCase() === clean ||
      String(row.recovery_email || "").trim().toLowerCase() === clean,
  );
}

async function validateProfilePatch(
  supabase: any,
  patch: Record<string, unknown>,
  actorId?: string | null,
) {
  const errors: string[] = [];
  const username = normalizeUsername(String(patch.username || ""));
  const recoveryEmail = String(patch.recovery_email || "").trim().toLowerCase();
  const pendingEmail = String(patch.pending_email || "").trim().toLowerCase();
  const address1 = String(patch.address_line1 || "").trim();
  const province = String(patch.province || "").trim();
  const postalCode = String(patch.postal_code || "").trim();

  if ("username" in patch) {
    if (!username) {
      errors.push("Username is required.");
    } else if (!/^[a-z0-9._-]{3,32}$/i.test(username)) {
      errors.push(
        "Username must be 3-32 characters and use only letters, numbers, dot, underscore, or dash.",
      );
    } else if (await usernameExists(supabase, username, actorId)) {
      errors.push("That username is already in use.");
    }
  }

  if (recoveryEmail) {
    if (!isValidEmail(recoveryEmail)) {
      errors.push("Recovery email format is invalid.");
    }
  }

  if (pendingEmail) {
    if (!isValidEmail(pendingEmail)) {
      errors.push("New account email format is invalid.");
    } else if (await emailExistsInProfiles(supabase, pendingEmail, actorId)) {
      errors.push("That email is already attached to another profile.");
    }
  }

  if (!isLikelyAddress(address1)) errors.push("Address line 1 looks incomplete.");
  if (!isValidProvince(province)) errors.push("Province format is invalid.");
  if (!isValidPostalCode(postalCode)) {
    errors.push("Postal code must use a valid Canadian format like N0N 0N0.");
  }

  return errors;
}

async function twilioVerify(path: string, payload: URLSearchParams) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${Deno.env.get("TWILIO_VERIFY_SERVICE_SID")}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, raw: text };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    sbUrl(),
    sbServiceRoleKey(),
  );

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action === "resolve_login_identifier") {
    const login = String(body.login || "").trim().toLowerCase();
    if (!login) {
      return Response.json(
        { ok: false, error: "Login is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("email,username,is_active")
      .or(`email.ilike.${login},username.ilike.${login}`)
      .limit(5);

    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    const match = (data || []).find((row: any) => row.is_active);
    if (!match?.email) {
      return Response.json(
        { ok: false, error: "No active account matched that email or username." },
        { status: 404, headers: corsHeaders },
      );
    }

    return Response.json(
      { ok: true, email: match.email, masked_username: maskUsername(match.username || "") },
      { headers: corsHeaders },
    );
  }

  if (action === "lookup_account_help" || action === "find_login") {
    try {
      const profile = await findRecoveryProfile(supabase, body);
      const recoveryTarget = pickRecoveryEmail(profile);
      await logRecoveryRequest(supabase, {
        lookup_kind: "lookup",
        employee_number: body.employee_number || null,
        phone_last4: body.phone_last4 || null,
        last_name: body.last_name || null,
        matched_profile_id: profile.id,
        masked_email: maskEmail(recoveryTarget || String(profile.email || "")),
        masked_username: maskUsername(profile.username || ""),
        request_status: "matched",
      });
      return Response.json(
        {
          ok: true,
          masked_email: maskEmail(recoveryTarget || String(profile.email || "")),
          masked_username: maskUsername(profile.username || ""),
        },
        { headers: corsHeaders },
      );
    } catch (err: any) {
      await logRecoveryRequest(supabase, {
        lookup_kind: "lookup",
        employee_number: body.employee_number || null,
        phone_last4: body.phone_last4 || null,
        last_name: body.last_name || null,
        request_status: "failed",
        notes: String(err?.message || err),
      });
      return Response.json(
        { ok: false, error: err?.message || "Account lookup failed." },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  if (action === "send_recovery_email") {
    try {
      const profile = await findRecoveryProfile(supabase, body);
      const targetEmail = pickRecoveryEmail(profile);

      if (!targetEmail) {
        throw new Error("No valid recovery email is available for this account.");
      }

      const redirectTo =
        String(body.redirect_to || `${Deno.env.get("SITE_URL") || ""}`).trim() || undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        targetEmail,
        redirectTo ? { redirectTo } : undefined,
      );
      if (error) throw error;

      await logRecoveryRequest(supabase, {
        lookup_kind: "send_recovery_email",
        employee_number: body.employee_number || null,
        phone_last4: body.phone_last4 || null,
        last_name: body.last_name || null,
        matched_profile_id: profile.id,
        masked_email: maskEmail(targetEmail),
        masked_username: maskUsername(profile.username || ""),
        request_status: "sent",
      });

      return Response.json(
        { ok: true, message: `Recovery email sent to ${maskEmail(targetEmail)}.` },
        { headers: corsHeaders },
      );
    } catch (err: any) {
      await logRecoveryRequest(supabase, {
        lookup_kind: "send_recovery_email",
        employee_number: body.employee_number || null,
        phone_last4: body.phone_last4 || null,
        last_name: body.last_name || null,
        request_status: "failed",
        notes: String(err?.message || err),
      });
      return Response.json(
        { ok: false, error: err?.message || "Recovery email failed." },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return Response.json(
      { ok: false, error: "Unauthorized", details: ["Missing bearer token"] },
      { status: 401, headers: corsHeaders },
    );
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const { data: authUserData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !authUserData.user) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
        details: [userError?.message || "Token verification failed"],
      },
      { status: 401, headers: corsHeaders },
    );
  }

  const actorId = authUserData.user.id;

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", actorId)
    .single();

  if (!actorProfile?.is_active) {
    return Response.json(
      { ok: false, error: "Inactive profile" },
      { status: 403, headers: corsHeaders },
    );
  }

  if (action === "record_login_event") {
    const occurredAt = String(body.occurred_at || new Date().toISOString()).trim() || new Date().toISOString();
    const routeFragment = String(body.route_fragment || body.route || "").trim() || null;
    const authSource = String(body.auth_source || "session_restore").trim() || "session_restore";
    const sessionFingerprint = String(body.session_fingerprint || "").trim() || null;
    const ipAddress = String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").trim() || null;
    const userAgent = String(req.headers.get("user-agent") || "").trim() || null;

    await logLoginEvent(supabase, {
      profile_id: actorId,
      event_type: String(body.event_type || "login").trim() || "login",
      auth_source: authSource,
      success: body.success !== false,
      route_fragment: routeFragment,
      session_fingerprint: sessionFingerprint,
      ip_address: ipAddress,
      user_agent: userAgent,
      occurred_at: occurredAt,
    });

    await supabase
      .from("profiles")
      .update({ last_login_at: occurredAt, updated_at: new Date().toISOString() })
      .eq("id", actorId);

    return Response.json(
      { ok: true, last_login_at: occurredAt },
      { headers: corsHeaders },
    );
  }

  if (action === "session_health") {
    return Response.json(
      {
        ok: true,
        user: {
          id: authUserData.user.id,
          email: authUserData.user.email || null,
          email_confirmed_at: authUserData.user.email_confirmed_at || authUserData.user.confirmed_at || null,
        },
        profile: {
          id: actorProfile.id,
          email: actorProfile.email || null,
          recovery_email: actorProfile.recovery_email || null,
          username: actorProfile.username || null,
          role: actorProfile.role || null,
          is_active: actorProfile.is_active ?? null,
          password_login_ready: actorProfile.password_login_ready ?? null,
          onboarding_completed_at: actorProfile.onboarding_completed_at || null,
          account_setup_completed_at: actorProfile.account_setup_completed_at || null,
        },
        warnings: [
          actorProfile.email !== authUserData.user.email ? "Profile email does not match Auth email." : null,
          !actorProfile.password_login_ready ? "Password login is not marked ready." : null,
          !actorProfile.onboarding_completed_at ? "Onboarding is not marked complete." : null,
          !actorProfile.username ? "Username is not set." : null,
        ].filter(Boolean),
      },
      { headers: corsHeaders },
    );
  }


  if (action === "list_my_time_clock_context") {
    const context = await getClockContext(supabase, actorId, actorProfile);
    return Response.json({ ok: true, ...context }, { headers: corsHeaders });
  }

  if (action === "employee_clock_in") {
    const nowIso = new Date().toISOString();
    const jobId = Number(body.job_id || 0);
    if (!jobId) {
      return Response.json({ ok: false, error: "job_id is required." }, { status: 400, headers: corsHeaders });
    }
    const { data: existingOpen } = await supabase
      .from('employee_time_entries')
      .select('*')
      .eq('profile_id', actorId)
      .is('signed_out_at', null)
      .in('clock_status', ['active','paused'])
      .maybeSingle();
    if (existingOpen?.id) {
      return Response.json({ ok: false, error: 'You already have an active site time entry. Sign out before starting another one.' }, { status: 400, headers: corsHeaders });
    }
    const { data: job } = await supabase.from('jobs').select('id,job_code,job_name,site_id,crew_id,status').eq('id', jobId).maybeSingle();
    if (!job?.id) {
      return Response.json({ ok: false, error: 'Selected job was not found.' }, { status: 404, headers: corsHeaders });
    }
    const session = await ensureClockJobSession(supabase, actorId, actorProfile, jobId, nowIso);
    const { data: entry, error } = await supabase.from('employee_time_entries').insert({
      profile_id: actorId,
      crew_id: job.crew_id || null,
      job_id: job.id,
      job_session_id: session?.id || null,
      site_id: job.site_id || null,
      clock_status: 'active',
      signed_in_at: nowIso,
      last_status_at: nowIso,
      notes: String(body.notes || '').trim() || null,
      ...getClockInGeoPayload(body),
      created_by_profile_id: actorId,
      created_at: nowIso,
      updated_at: nowIso,
    }).select('*').single();
    if (error) {
      return Response.json({ ok: false, error: String(error.message || error) }, { status: 500, headers: corsHeaders });
    }
    await supabase.from('jobs').update({ last_activity_at: nowIso, updated_at: nowIso }).eq('id', job.id);
    await logSiteActivity(supabase, {
      event_type: 'employee_clock_in',
      entity_type: 'employee_time_entry',
      entity_id: entry.id,
      severity: 'info',
      title: `${actorProfile.full_name || 'Worker'} signed in`,
      summary: `Started work on ${job.job_code || ''} ${job.job_name || ''}`.trim(),
      related_job_id: job.id,
      related_profile_id: actorId,
      created_by_profile_id: actorId,
      metadata: { job_code: job.job_code || null, job_name: job.job_name || null, clock_in_geo_source: String(body.geo_source || '') || null, clock_in_photo_note: String(body.photo_note || '').trim() || null },
      occurred_at: nowIso,
    });
    const context = await getClockContext(supabase, actorId, actorProfile);
    return Response.json({ ok: true, entry, ...context }, { headers: corsHeaders });
  }

  if (action === "employee_start_break") {
    const nowIso = new Date().toISOString();
    const { data: entry } = await supabase.from('employee_time_entries').select('*').eq('profile_id', actorId).is('signed_out_at', null).eq('clock_status', 'active').maybeSingle();
    if (!entry?.id) {
      return Response.json({ ok: false, error: 'You do not have an active time entry to pause.' }, { status: 400, headers: corsHeaders });
    }
    const { data: openBreak } = await supabase.from('employee_time_entry_breaks').select('id').eq('time_entry_id', entry.id).is('ended_at', null).maybeSingle();
    if (openBreak?.id) {
      return Response.json({ ok: false, error: 'An unpaid break is already running.' }, { status: 400, headers: corsHeaders });
    }
    const { error: breakErr } = await supabase.from('employee_time_entry_breaks').insert({
      time_entry_id: entry.id,
      started_at: nowIso,
      unpaid: true,
      notes: String(body.notes || '').trim() || null,
      created_by_profile_id: actorId,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (breakErr) {
      return Response.json({ ok: false, error: String(breakErr.message || breakErr) }, { status: 500, headers: corsHeaders });
    }
    await supabase.from('employee_time_entries').update({ clock_status: 'paused', last_status_at: nowIso, updated_at: nowIso }).eq('id', entry.id);
    await logSiteActivity(supabase, {
      event_type: 'employee_break_started',
      entity_type: 'employee_time_entry',
      entity_id: entry.id,
      title: `${actorProfile.full_name || 'Worker'} started an unpaid break`,
      summary: 'Employee paused paid site time.',
      related_job_id: entry.job_id,
      related_profile_id: actorId,
      created_by_profile_id: actorId,
      occurred_at: nowIso,
    });
    const context = await getClockContext(supabase, actorId, actorProfile);
    return Response.json({ ok: true, ...context }, { headers: corsHeaders });
  }

  if (action === "employee_end_break") {
    const nowIso = new Date().toISOString();
    const { data: entry } = await supabase.from('employee_time_entries').select('*').eq('profile_id', actorId).is('signed_out_at', null).eq('clock_status', 'paused').maybeSingle();
    if (!entry?.id) {
      return Response.json({ ok: false, error: 'You do not have a paused time entry.' }, { status: 400, headers: corsHeaders });
    }
    const { data: openBreak } = await supabase.from('employee_time_entry_breaks').select('*').eq('time_entry_id', entry.id).is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (!openBreak?.id) {
      return Response.json({ ok: false, error: 'No open unpaid break was found.' }, { status: 400, headers: corsHeaders });
    }
    const durationMinutes = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(openBreak.started_at).getTime()) / 60000));
    const { error: breakErr } = await supabase.from('employee_time_entry_breaks').update({ ended_at: nowIso, duration_minutes: durationMinutes, updated_at: nowIso }).eq('id', openBreak.id);
    if (breakErr) {
      return Response.json({ ok: false, error: String(breakErr.message || breakErr) }, { status: 500, headers: corsHeaders });
    }
    await supabase.from('employee_time_entries').update({
      clock_status: 'active',
      last_status_at: nowIso,
      unpaid_break_minutes: Number(entry.unpaid_break_minutes || 0) + durationMinutes,
      updated_at: nowIso,
    }).eq('id', entry.id);
    await logSiteActivity(supabase, {
      event_type: 'employee_break_ended',
      entity_type: 'employee_time_entry',
      entity_id: entry.id,
      title: `${actorProfile.full_name || 'Worker'} ended an unpaid break`,
      summary: `Break duration ${durationMinutes} minute(s).`,
      related_job_id: entry.job_id,
      related_profile_id: actorId,
      created_by_profile_id: actorId,
      occurred_at: nowIso,
    });
    const context = await getClockContext(supabase, actorId, actorProfile);
    return Response.json({ ok: true, ...context }, { headers: corsHeaders });
  }

  if (action === "employee_clock_out") {
    const nowIso = new Date().toISOString();
    const { data: entry } = await supabase.from('employee_time_entries').select('*').eq('profile_id', actorId).is('signed_out_at', null).in('clock_status', ['active','paused']).maybeSingle();
    if (!entry?.id) {
      return Response.json({ ok: false, error: 'You do not have an active site time entry to sign out from.' }, { status: 400, headers: corsHeaders });
    }
    let unpaidBreakMinutes = Number(entry.unpaid_break_minutes || 0);
    if (String(entry.clock_status || '') === 'paused') {
      const { data: openBreak } = await supabase.from('employee_time_entry_breaks').select('*').eq('time_entry_id', entry.id).is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (openBreak?.id) {
        const extraMinutes = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(openBreak.started_at).getTime()) / 60000));
        unpaidBreakMinutes += extraMinutes;
        await supabase.from('employee_time_entry_breaks').update({ ended_at: nowIso, duration_minutes: extraMinutes, updated_at: nowIso }).eq('id', openBreak.id);
      }
    }
    const totalElapsedMinutes = Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(entry.signed_in_at).getTime()) / 60000));
    const paidWorkMinutes = Math.max(0, totalElapsedMinutes - unpaidBreakMinutes);
    const { data: updated, error } = await supabase.from('employee_time_entries').update({
      clock_status: 'signed_out',
      signed_out_at: nowIso,
      last_status_at: nowIso,
      total_elapsed_minutes: totalElapsedMinutes,
      unpaid_break_minutes: unpaidBreakMinutes,
      paid_work_minutes: paidWorkMinutes,
      notes: String(body.notes || entry.notes || '').trim() || null,
      ...getClockOutGeoPayload(body),
      updated_at: nowIso,
    }).eq('id', entry.id).select('*').single();
    if (error) {
      return Response.json({ ok: false, error: String(error.message || error) }, { status: 500, headers: corsHeaders });
    }
    const syncedHours = await syncCrewHoursFromTimeEntry(supabase, updated, actorProfile, nowIso);
    if (updated?.job_session_id) {
      await supabase.from('job_sessions').update({
        session_status: 'completed',
        ended_at: nowIso,
        duration_minutes: totalElapsedMinutes,
        updated_at: nowIso,
      }).eq('id', updated.job_session_id).eq('created_by_profile_id', actorId);
    }
    await supabase.from('jobs').update({ last_activity_at: nowIso, updated_at: nowIso }).eq('id', updated.job_id);
    await logSiteActivity(supabase, {
      event_type: 'employee_clock_out',
      entity_type: 'employee_time_entry',
      entity_id: updated.id,
      title: `${actorProfile.full_name || 'Worker'} signed out`,
      summary: `Worked ${paidWorkMinutes} paid minute(s) with ${unpaidBreakMinutes} unpaid break minute(s).`,
      related_job_id: updated.job_id,
      related_profile_id: actorId,
      created_by_profile_id: actorId,
      metadata: { paid_work_minutes: paidWorkMinutes, unpaid_break_minutes: unpaidBreakMinutes, crew_hours_id: syncedHours?.id || null, clock_out_geo_source: String(body.geo_source || '') || null, clock_out_photo_note: String(body.photo_note || '').trim() || null },
      occurred_at: nowIso,
    });
    const context = await getClockContext(supabase, actorId, actorProfile);
    return Response.json({ ok: true, entry: updated, crew_hours: syncedHours || null, ...context }, { headers: corsHeaders });
  }

  if (action === "update_recovery_profile") {
    const patch: Record<string, unknown> = {
      username: String(body.username || actorProfile.username || "").trim() || null,
      recovery_email: String(body.recovery_email || actorProfile.recovery_email || "").trim() || null,
      phone: String(body.phone || actorProfile.phone || "").trim() || null,
      full_name: String(body.full_name || actorProfile.full_name || "").trim() || null,
      address_line1: String(body.address_line1 || actorProfile.address_line1 || "").trim() || null,
      address_line2: String(body.address_line2 || actorProfile.address_line2 || "").trim() || null,
      city: String(body.city || actorProfile.city || "").trim() || null,
      province: String(body.province || actorProfile.province || "").trim() || null,
      postal_code: String(body.postal_code || actorProfile.postal_code || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const errors = await validateProfilePatch(supabase, patch, actorId);
    if (errors.length) {
      return Response.json(
        { ok: false, error: errors.join(" "), details: errors },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", actorId)
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json({ ok: true, record: data }, { headers: corsHeaders });
  }

  if (action === "complete_account_setup") {
    const patch: Record<string, unknown> = {
      username: String(body.username || "").trim(),
      recovery_email: String(body.recovery_email || "").trim() || null,
      phone: String(body.phone || actorProfile.phone || "").trim() || null,
      full_name: String(body.full_name || actorProfile.full_name || "").trim() || null,
      address_line1: String(body.address_line1 || actorProfile.address_line1 || "").trim() || null,
      address_line2: String(body.address_line2 || actorProfile.address_line2 || "").trim() || null,
      city: String(body.city || actorProfile.city || "").trim() || null,
      province: String(body.province || actorProfile.province || "").trim() || null,
      postal_code: String(body.postal_code || actorProfile.postal_code || "").trim() || null,
      password_login_ready: true,
      account_setup_completed_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const errors = await validateProfilePatch(supabase, patch, actorId);
    if (errors.length) {
      return Response.json(
        { ok: false, error: errors.join(" "), details: errors },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", actorId)
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json(
      { ok: true, record: data, message: "Account setup completed." },
      { headers: corsHeaders },
    );
  }

  if (action === "complete_onboarding") {
    const now = new Date().toISOString();
    const usernameReady = !!String(actorProfile.username || body.username || "").trim();
    const passwordReady = actorProfile.password_login_ready === true;
    const patch: Record<string, unknown> = {
      onboarding_completed_at: now,
      account_setup_completed_at: actorProfile.account_setup_completed_at || now,
      updated_at: now,
    };

    if (usernameReady && passwordReady) {
      patch.password_login_ready = true;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", actorId)
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json(
      { ok: true, record: data, message: "Onboarding completed." },
      { headers: corsHeaders },
    );
  }

  if (action === "list_my_notifications") {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("id,notification_type,title,body,message,status,decision_status,decision_notes,created_at,read_at,decided_at,email_status,target_table,target_id,payload")
      .or(`target_profile_id.eq.${actorId},created_by_profile_id.eq.${actorId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json({ ok: true, records: data || [] }, { headers: corsHeaders });
  }

  if (action === "list_identity_change_requests") {
    const { data, error } = await supabase
      .from("account_identity_change_requests")
      .select("*")
      .eq("profile_id", actorId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json({ ok: true, records: data || [] }, { headers: corsHeaders });
  }

  if (action === "request_identity_change") {
    const requestedUsername = normalizeUsername(String(body.requested_username || "").trim());
    const requestedEmail = String(body.requested_email || "").trim().toLowerCase();

    if (!requestedUsername && !requestedEmail) {
      return Response.json(
        { ok: false, error: "Enter a new username, a new email, or both." },
        { status: 400, headers: corsHeaders },
      );
    }

    const patch: Record<string, unknown> = {
      username: requestedUsername || actorProfile.username || "",
      pending_email: requestedEmail || null,
      address_line1: actorProfile.address_line1 || "",
      province: actorProfile.province || "",
      postal_code: actorProfile.postal_code || "",
    };

    const errors = await validateProfilePatch(supabase, patch, actorId);
    if (errors.length) {
      return Response.json(
        { ok: false, error: errors.join(" "), details: errors },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: changeRequest, error: reqError } = await supabase
      .from("account_identity_change_requests")
      .insert({
        profile_id: actorId,
        current_email: actorProfile.email || null,
        current_username: actorProfile.username || null,
        requested_email: requestedEmail || null,
        requested_username: requestedUsername || null,
        request_status: "pending",
        created_by_profile_id: actorId,
      })
      .select("*")
      .single();

    if (reqError) {
      return Response.json(
        { ok: false, error: String(reqError.message || reqError) },
        { status: 500, headers: corsHeaders },
      );
    }

    await supabase
      .from("profiles")
      .update({
        pending_email: requestedEmail || null,
        pending_username: requestedUsername || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", actorId);

    await supabase.from("admin_notifications").insert({
      notification_type: "account_identity_change_requested",
      recipient_role: "admin",
      target_table: "account_identity_change_requests",
      target_id: String(changeRequest.id),
      target_profile_id: actorId,
      title: `Identity change requested for ${actorProfile.full_name || actorProfile.email || actorId}`,
      body: JSON.stringify({
        requested_username: requestedUsername || null,
        requested_email: requestedEmail || null,
      }),
      payload: {
        request_id: changeRequest.id,
        profile_id: actorId,
        requested_username: requestedUsername || null,
        requested_email: requestedEmail || null,
      },
      status: "queued",
      email_subject: `YWI HSE identity change requested: ${actorProfile.full_name || actorProfile.email || actorId}`,
      created_by_profile_id: actorId,
    });

    return Response.json(
      {
        ok: true,
        record: changeRequest,
        message: "Identity change request submitted for confirmation.",
      },
      { headers: corsHeaders },
    );
  }

  if (action === "request_phone_verification") {
    const phone = String(body.phone || actorProfile.phone || "").trim();
    if (!phone) {
      return Response.json(
        { ok: false, error: "Phone number required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data, error } = await supabase
      .from("admin_notifications")
      .insert({
        notification_type: "phone_verification_request",
        target_table: "profiles",
        target_id: actorId,
        recipient_role: "admin",
        title: `Phone verification requested for ${actorProfile.full_name || actorProfile.email}`,
        body: JSON.stringify({ profile_id: actorId, email: actorProfile.email, phone }),
        payload: { profile_id: actorId, email: actorProfile.email, phone },
        status: "queued",
        email_subject: `Phone verification requested for ${actorProfile.full_name || actorProfile.email}`,
        created_by_profile_id: actorId,
      })
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: String(error.message || error) },
        { status: 500, headers: corsHeaders },
      );
    }

    await supabase
      .from("profiles")
      .update({
        phone,
        phone_validation_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", actorId);

    return Response.json(
      { ok: true, record: data, mode: hasTwilioVerify() ? "admin_or_sms" : "admin_review" },
      { headers: corsHeaders },
    );
  }

  if (action === "send_phone_verification_code" || action === "retry_phone_verification_code") {
    if (!hasTwilioVerify()) {
      return Response.json(
        { ok: false, error: "SMS provider not configured. Use admin-reviewed verification instead." },
        { status: 400, headers: corsHeaders },
      );
    }

    const phone = String(body.phone || actorProfile.phone || "").trim();
    if (!phone) {
      return Response.json(
        { ok: false, error: "Phone number required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const verify = await twilioVerify(
      "Verifications",
      new URLSearchParams({ To: phone, Channel: "sms" }),
    );

    await supabase
      .from("profiles")
      .update({
        phone,
        phone_verification_provider: "twilio_verify",
        phone_verification_sid: verify.sid || null,
        phone_validation_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", actorId);

    await supabase.from("admin_notifications").insert({
      notification_type: "phone_verification_sms_attempt",
      recipient_role: "admin",
      target_table: "profiles",
      target_id: actorId,
      title: `SMS verification sent for ${actorProfile.full_name || actorProfile.email}`,
      body: JSON.stringify({ profile_id: actorId, phone, provider: "twilio_verify" }),
      payload: { profile_id: actorId, phone, provider: "twilio_verify" },
      sms_provider: "twilio_verify",
      sms_attempt_count: 1,
      sms_last_attempt_at: new Date().toISOString(),
      status: "queued",
      created_by_profile_id: actorId,
    });

    return Response.json(
      {
        ok: true,
        status: verify.status || "pending",
        provider: "twilio_verify",
        retry: action === "retry_phone_verification_code",
      },
      { headers: corsHeaders },
    );
  }

  if (action === "verify_phone_code") {
    if (!hasTwilioVerify()) {
      return Response.json(
        { ok: false, error: "SMS provider not configured." },
        { status: 400, headers: corsHeaders },
      );
    }

    const phone = String(body.phone || actorProfile.phone || "").trim();
    const code = String(body.code || "").trim();

    if (!phone || !code) {
      return Response.json(
        { ok: false, error: "Phone number and code are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const check = await twilioVerify(
      "VerificationCheck",
      new URLSearchParams({ To: phone, Code: code }),
    );

    if (String(check.status || "").toLowerCase() !== "approved") {
      await supabase.from("admin_notifications").insert({
        notification_type: "phone_verification_sms_failed",
        recipient_role: "admin",
        target_table: "profiles",
        target_id: actorId,
        title: `SMS verification failed for ${actorProfile.full_name || actorProfile.email}`,
        body: JSON.stringify({ profile_id: actorId, phone, provider: "twilio_verify" }),
        payload: { profile_id: actorId, phone, provider: "twilio_verify" },
        sms_provider: "twilio_verify",
        sms_attempt_count: 1,
        sms_last_attempt_at: new Date().toISOString(),
        sms_dead_lettered_at: new Date().toISOString(),
        sms_dead_letter_reason: "sms:verification_not_approved",
        status: "dead_letter",
        created_by_profile_id: actorId,
      });

      return Response.json(
        { ok: false, error: "Verification code was not approved" },
        { status: 400, headers: corsHeaders },
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        phone,
        phone_verified: true,
        phone_verified_at: now,
        phone_verification_provider: "twilio_verify",
        phone_validation_requested_at: null,
        updated_at: now,
      })
      .eq("id", actorId)
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json(
      { ok: true, record: data, provider: "twilio_verify" },
      { headers: corsHeaders },
    );
  }

  return Response.json(
    { ok: false, error: "Unsupported action" },
    { status: 400, headers: corsHeaders },
  );
});
