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
      updated_at: now,
    };

    if (usernameReady && passwordReady && !actorProfile.account_setup_completed_at) {
      patch.account_setup_completed_at = now;
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
