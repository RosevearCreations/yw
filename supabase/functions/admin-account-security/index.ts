// Edge Function: admin-account-security
// Build 191 — audited admin temporary-password resets + current Admin To-Do.
// Plaintext passwords are accepted only for the immediate Supabase Auth admin update;
// they are never persisted, logged, echoed, or placed in audit metadata.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function env(name: string, fallback = "") {
  return String(Deno.env.get(name) || fallback).trim();
}

function normalizeRole(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "worker" || clean === "staff") return "employee";
  return clean || "employee";
}

function strongTemporaryPassword(value: unknown) {
  const password = String(value ?? "");
  return password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "POST required." }, 405);

  const supabaseUrl = env("SB_URL", env("SUPABASE_URL"));
  const serviceRoleKey = env("SB_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ ok: false, error: "Server account-security configuration is unavailable." }, 503);
  }

  const authorization = String(req.headers.get("Authorization") || "").trim();
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return response({ ok: false, error: "Authenticated session required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const actorId = userData?.user?.id || "";
  if (userError || !actorId) return response({ ok: false, error: "Session could not be verified." }, 401);

  const { data: actorProfile, error: actorError } = await admin
    .from("profiles")
    .select("id,full_name,email,role,is_active,password_reset_required")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError || !actorProfile || actorProfile.is_active === false) {
    return response({ ok: false, error: "An active profile is required." }, 403);
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); }
  catch { return response({ ok: false, error: "Valid JSON body required." }, 400); }
  const action = String(body.action || "overview").trim().toLowerCase();

  if (action === "confirm_password_change") {
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({
        password_reset_required: false,
        password_login_ready: true,
        password_changed_at: now,
        temporary_password_issued_at: null,
        temporary_password_issued_by_profile_id: null,
        updated_at: now,
      })
      .eq("id", actorId)
      .select("id,password_reset_required,password_login_ready,password_changed_at")
      .single();
    if (updateError) return response({ ok: false, error: updateError.message }, 500);

    const { data: latestIssued } = await admin
      .from("admin_password_resets")
      .select("id")
      .eq("target_profile_id", actorId)
      .eq("reset_status", "issued")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestIssued?.id) {
      await admin.from("admin_password_resets")
        .update({ reset_status: "completed", completed_at: now })
        .eq("id", latestIssued.id);
    }

    return response({ ok: true, record: updated, message: "Password change recorded and temporary-password gate cleared." });
  }

  const actorRole = normalizeRole(actorProfile.role);
  if (actorRole !== "admin") {
    return response({ ok: false, error: "Admin manage access is required." }, 403);
  }

  if (action === "overview" || action === "list_accounts") {
    const [{ data: accounts, error: accountsError }, { data: todo, error: todoError }, { data: todoStatus, error: statusError }] = await Promise.all([
      admin.from("v_admin_account_security_directory").select("*").order("full_name", { ascending: true }),
      admin.from("v_it_current_admin_todo").select("*").order("sort_order", { ascending: true }),
      admin.from("v_it_current_admin_todo_status").select("*").maybeSingle(),
    ]);
    if (accountsError) return response({ ok: false, error: accountsError.message }, 500);
    if (todoError) return response({ ok: false, error: todoError.message }, 500);
    if (statusError) return response({ ok: false, error: statusError.message }, 500);
    return response({
      ok: true,
      accounts: accounts || [],
      current_todo: todo || [],
      current_todo_status: todoStatus || null,
      password_policy: { min_length: 12, requires_upper: true, requires_lower: true, requires_number: true, requires_symbol: true },
      security_note: "Existing passwords cannot be viewed. Admins may replace another user's password with a temporary password that must be changed by that user.",
    });
  }

  if (action === "reset_temporary_password") {
    const targetProfileId = String(body.target_profile_id || "").trim();
    const temporaryPassword = String(body.temporary_password ?? "");
    const reason = String(body.reason || "").trim();

    if (!targetProfileId) return response({ ok: false, error: "Target profile is required." }, 400);
    if (targetProfileId === actorId) {
      return response({ ok: false, error: "Use Account & Security to change your own password." }, 400);
    }
    if (!strongTemporaryPassword(temporaryPassword)) {
      return response({ ok: false, error: "Temporary password must be at least 12 characters and include uppercase, lowercase, number, and symbol." }, 400);
    }
    if (reason.length < 5) return response({ ok: false, error: "Enter a short reset reason for the audit trail." }, 400);

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,full_name,email,username,role,is_active")
      .eq("id", targetProfileId)
      .maybeSingle();
    if (targetError || !target) return response({ ok: false, error: "Target profile was not found." }, 404);
    if (target.is_active === false) return response({ ok: false, error: "Inactive accounts must be reactivated before password reset." }, 409);

    const { data: audit, error: auditError } = await admin
      .from("admin_password_resets")
      .insert({
        target_profile_id: targetProfileId,
        reset_by_profile_id: actorId,
        reason,
        force_password_change: true,
        reset_status: "issued",
        metadata: { source: "admin_account_security", target_role: normalizeRole(target.role) },
      })
      .select("id,created_at")
      .single();
    if (auditError) return response({ ok: false, error: `Unable to create reset audit: ${auditError.message}` }, 500);

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetProfileId, { password: temporaryPassword });
    if (authUpdateError) {
      await admin.from("admin_password_resets")
        .update({ reset_status: "failed", completed_at: new Date().toISOString(), metadata: { source: "admin_account_security", target_role: normalizeRole(target.role), failure_stage: "auth_update" } })
        .eq("id", audit.id);
      return response({ ok: false, error: `Supabase Auth password reset failed: ${authUpdateError.message}` }, 400);
    }

    const now = new Date().toISOString();
    const { error: profileUpdateError } = await admin.from("profiles")
      .update({
        password_reset_required: true,
        password_login_ready: true,
        temporary_password_issued_at: now,
        temporary_password_issued_by_profile_id: actorId,
        updated_at: now,
      })
      .eq("id", targetProfileId);
    if (profileUpdateError) {
      await admin.from("admin_password_resets")
        .update({ reset_status: "failed", completed_at: now, metadata: { source: "admin_account_security", target_role: normalizeRole(target.role), failure_stage: "profile_gate" } })
        .eq("id", audit.id);
      return response({ ok: false, error: "Password changed in Auth, but the mandatory replacement gate could not be recorded. Escalate to I.T. before giving the temporary password to the user." }, 500);
    }

    return response({
      ok: true,
      reset_id: audit.id,
      target_profile_id: targetProfileId,
      target_label: target.full_name || target.username || target.email || targetProfileId,
      force_password_change: true,
      message: "Temporary password set. The user must replace it in Account & Security before normal module access resumes.",
    });
  }

  return response({ ok: false, error: "Unsupported action." }, 400);
});
