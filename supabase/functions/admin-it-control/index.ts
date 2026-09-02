import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, unknown>;

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizedRole(value: unknown) {
  const clean = String(value || "employee").trim().toLowerCase() || "employee";
  if (clean === "worker" || clean === "staff") return "employee";
  return clean;
}

async function listRows(
  supabase: any,
  table: string,
  options: { order?: string; ascending?: boolean; limit?: number; columns?: string } = {},
) {
  try {
    let q = supabase.from(table).select(options.columns || "*").limit(options.limit || 250);
    if (options.order) q = q.order(options.order, { ascending: options.ascending !== false });
    const { data, error } = await q;
    if (error) return { rows: [], error: error.message || `Unable to load ${table}.` };
    return { rows: data || [], error: null };
  } catch (err) {
    return { rows: [], error: String((err as Error)?.message || err || `Unable to load ${table}.`) };
  }
}

async function assertionRows(supabase: any, rpcName: string, fallback: string) {
  try {
    const { data, error } = await supabase.rpc(rpcName);
    return { rows: data || [], error: error?.message || null };
  } catch (err) {
    return { rows: [], error: String((err as Error)?.message || err || fallback) };
  }
}

function rowStatus(row: any) {
  if (!row || typeof row !== "object") return "unknown";
  for (const key of [
    "status", "check_status", "readiness_status", "gate_status", "drift_status",
    "assertion_status", "health_status", "pipeline_status", "severity", "result", "state", "release_authority_status",
    "source_gate_status", "repository_enforcement_status",
  ]) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim().toLowerCase();
  }
  for (const key of ["ok", "passed", "ready", "is_ready", "is_current", "healthy"]) {
    if (typeof row[key] === "boolean") return row[key] ? "passed" : "failed";
  }
  return "unknown";
}

function summarizeRows(rows: any[] = [], error: string | null = null) {
  if (error) return { status: "error", total: 0, blocking: 1, warning: 0, error };
  const failureWords = /^(failed|failure|error|critical|blocked|behind|missing|not_ready|not ready|unhealthy|red|no)$/;
  const warningWords = /^(warning|warn|amber|review|pending|unknown|attention)$/;
  let blocking = 0;
  let warning = 0;
  for (const row of rows) {
    const status = rowStatus(row);
    if (failureWords.test(status)) blocking += 1;
    else if (warningWords.test(status)) warning += 1;
  }
  return {
    status: blocking ? "error" : warning ? "warning" : "passed",
    total: rows.length,
    blocking,
    warning,
    error: null,
  };
}

async function modulePermissionPayload(supabase: any) {
  const [modules, profiles, roleDefaults, overrides, audit, integrity] = await Promise.all([
    listRows(supabase, "app_modules", { order: "sort_order", limit: 20 }),
    listRows(supabase, "profiles", {
      columns: "id,full_name,email,username,role,is_active,employment_status,staff_tier,updated_at",
      order: "full_name",
      limit: 500,
    }),
    listRows(supabase, "app_role_module_permissions", { order: "role", limit: 100 }),
    listRows(supabase, "app_profile_module_permissions", { order: "updated_at", ascending: false, limit: 1000 }),
    listRows(supabase, "app_module_permission_audit", { order: "created_at", ascending: false, limit: 250 }),
    listRows(supabase, "v_admin_module_access_integrity", { order: "profile_label", limit: 500 }),
  ]);

  const sourceErrors = [modules, profiles, roleDefaults, overrides, audit, integrity]
    .map((item) => item.error)
    .filter(Boolean);

  return {
    ok: sourceErrors.length === 0,
    scope: "module_permissions",
    app_modules: modules.rows,
    module_permission_profiles: profiles.rows.filter((row: any) => row?.is_active !== false),
    module_role_defaults: roleDefaults.rows,
    module_permission_overrides: overrides.rows,
    module_permission_audit: audit.rows,
    admin_module_access_integrity: integrity.rows,
    source_errors: sourceErrors,
  };
}

async function readinessPayload(supabase: any) {
  const sources = {
    readiness_registry: ["it_readiness_check_registry", "sort_order", true, 120],
    schema_drift: ["v_schema_drift_status", null, true, 10],
    release_authority: ["v_it_release_authority_status", null, true, 10],
    release_source_evidence: ["v_it_release_source_evidence_current", null, true, 10],
    cross_module_consumer_health: ["v_it_cross_module_consumer_health", "check_key", true, 20],
    finance_operational: ["v_it_finance_completion_pipeline_status", null, true, 10],
    finance_reconciliation: ["v_finance_job_completion_reconciliation_issues", "detected_at", false, 160],
    admin_access_integrity: ["v_admin_module_access_integrity", "profile_label", true, 500],
    schema_preflight: ["v_admin_schema_preflight_checks", "sort_order", true, 160],
    deployment_checklist: ["v_admin_deployment_checklist", "sort_order", true, 160],
    function_readiness: ["v_admin_function_readiness_checks", "sort_order", true, 160],
    production_readiness: ["v_production_readiness_checklist", "sort_order", true, 160],
    deployment_gate: ["v_admin_deployment_gate_status", "sort_order", true, 160],
    backup_restore: ["v_admin_backup_restore_rehearsal_directory", "updated_at", false, 80],
    runtime_health: ["v_admin_error_health_center", "severity_rank", true, 160],
    admin_tasks: ["v_admin_task_inbox", "priority_rank", true, 160],
    public_seo: ["v_public_seo_smoke_check", "page_path", true, 160],
    panel_diagnostics: ["v_admin_panel_load_diagnostics", "captured_at", false, 80],
    action_permissions: ["v_admin_action_permission_registry", "sort_order", true, 160],
    retry_policy: ["v_admin_panel_retry_policy", "sort_order", true, 100],
  } as const;

  const entries = await Promise.all(Object.entries(sources).map(async ([key, cfg]) => {
    const [table, order, ascending, limit] = cfg;
    return [key, await listRows(supabase, table, { order: order || undefined, ascending, limit })] as const;
  }));
  const data = Object.fromEntries(entries) as Record<string, { rows: any[]; error: string | null }>;

  const [moduleAssertions, itAssertions, releaseAssertions, consumerObservabilityAssertions, financeOperationalAssertions] = await Promise.all([
    assertionRows(supabase, "ywi_module_security_assertions", "Module assertions failed."),
    assertionRows(supabase, "ywi_it_readiness_security_assertions", "I.T. assertions failed."),
    assertionRows(supabase, "ywi_it_release_authority_assertions", "Release-authority assertions failed."),
    assertionRows(supabase, "ywi_it_cross_module_consumer_observability_assertions", "Cross-module consumer observability assertions failed."),
    assertionRows(supabase, "ywi_finance_operational_control_plane_assertions", "Finance operational assertions failed."),
  ]);

  const profilesResult = await listRows(supabase, "profiles", {
    columns: "id,role,is_active",
    limit: 1000,
  });
  const activeProfiles = profilesResult.rows.filter((row: any) => row?.is_active !== false);

  let authUserCount: number | null = null;
  let authAlignmentError: string | null = null;
  try {
    const { data: authData, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    authUserCount = Array.isArray(authData?.users) ? authData.users.length : 0;
  } catch (err) {
    authAlignmentError = String((err as Error)?.message || err || "Auth alignment check failed.");
  }

  const adminIntegrityRows = data.admin_access_integrity.rows.filter((row: any) => normalizedRole(row?.role) === "admin");
  const adminIntegrityBlocking = adminIntegrityRows.filter((row: any) => row?.all_modules_manage !== true).length;
  const schemaRow = data.schema_drift.rows[0] || null;
  const releaseAuthorityRow = data.release_authority.rows[0] || null;
  const expectedSchemaVersion = Number(schemaRow?.expected_schema_version || releaseAuthorityRow?.release_schema_version || 0);
  const latestAppliedSchemaVersion = Number(schemaRow?.latest_applied_schema_version || 0);
  const schemaCurrent = expectedSchemaVersion > 0
    && schemaRow?.drift_status === "current"
    && latestAppliedSchemaVersion >= expectedSchemaVersion;

  const assertionRowsCombined = [
    ...moduleAssertions.rows,
    ...itAssertions.rows,
    ...releaseAssertions.rows,
    ...consumerObservabilityAssertions.rows,
    ...financeOperationalAssertions.rows,
  ];
  const assertionErrors = [
    moduleAssertions.error,
    itAssertions.error,
    releaseAssertions.error,
    consumerObservabilityAssertions.error,
    financeOperationalAssertions.error,
  ].filter(Boolean);
  const assertionBlocking = assertionRowsCombined.filter((row: any) => String(row?.assertion_status || "").toLowerCase() !== "passed").length
    + assertionErrors.length;

  const sections = Object.fromEntries(Object.entries(data).map(([key, item]) => [key, summarizeRows(item.rows, item.error)]));
  const knownBlocking = Object.entries(sections)
    .filter(([key]) => !["admin_access_integrity", "schema_drift", "readiness_registry", "release_source_evidence"].includes(key))
    .reduce((sum, [, summary]: any) => sum + Number(summary.blocking || 0), 0);

  const repositoryEnforcementStatus = String(releaseAuthorityRow?.repository_enforcement_status || "unknown").toLowerCase();
  const repositoryPolicyWarning = repositoryEnforcementStatus === "green" ? 0 : 1;
  const criticalBlocking = (schemaCurrent ? 0 : 1) + adminIntegrityBlocking + assertionBlocking;
  const overallStatus = criticalBlocking > 0
    ? "red"
    : knownBlocking > 0 || repositoryPolicyWarning > 0
      ? "amber"
      : "green";

  return {
    ok: overallStatus !== "red",
    scope: "it_readiness",
    generated_at: new Date().toISOString(),
    summary: {
      overall_status: overallStatus,
      schema_current: schemaCurrent,
      expected_schema_version: expectedSchemaVersion,
      latest_applied_schema_version: latestAppliedSchemaVersion,
      release_authority_status: releaseAuthorityRow?.release_authority_status || "unknown",
      source_gate_status: releaseAuthorityRow?.source_gate_status || "unknown",
      repository_enforcement_status: repositoryEnforcementStatus,
      branch_protection_reported: releaseAuthorityRow?.branch_protection_reported ?? null,
      branch_policy_verified: releaseAuthorityRow?.branch_policy_verified === true,
      source_sha: releaseAuthorityRow?.source_sha || null,
      workflow_run_id: releaseAuthorityRow?.workflow_run_id || null,
      production_promotion_mode: releaseAuthorityRow?.production_promotion_mode || "manual_human_promotion_required",
      active_profile_count: activeProfiles.length,
      auth_user_count: authUserCount,
      auth_profile_count_match: authUserCount === null ? null : authUserCount === activeProfiles.length,
      auth_alignment_error: authAlignmentError,
      active_admin_count: adminIntegrityRows.length,
      admin_access_integrity_blockers: adminIntegrityBlocking,
      assertion_blockers: assertionBlocking,
      readiness_blockers: knownBlocking,
    },
    security_assertions: {
      module: moduleAssertions.rows,
      it: itAssertions.rows,
      release_authority: releaseAssertions.rows,
      consumer_observability: consumerObservabilityAssertions.rows,
      finance_operational: financeOperationalAssertions.rows,
      errors: assertionErrors,
    },
    sections: Object.fromEntries(Object.entries(data).map(([key, item]) => [key, {
      rows: item.rows,
      error: item.error,
      summary: summarizeRows(item.rows, item.error),
    }])),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "POST required." }, 405);

  const url = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ ok: false, error: "Server Supabase configuration is missing." }, 503);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = String(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return response({ ok: false, error: "Unauthorized." }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) return response({ ok: false, error: "Unauthorized." }, 401);

  const actorId = userData.user.id;
  const { data: actorProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_active,full_name,email")
    .eq("id", actorId)
    .maybeSingle();

  if (profileError || !actorProfile || actorProfile.is_active === false) {
    return response({ ok: false, error: "Active admin profile is required." }, 403);
  }
  // Authorization comes only from the server-owned profile row. User-editable metadata is not used.
  if (normalizedRole(actorProfile.role) !== "admin") {
    return response({ ok: false, error: "Admin role is required for I.T. controls." }, 403);
  }

  const body = await req.json().catch(() => ({} as Json));
  const action = String((body as any)?.action || "it_readiness").trim().toLowerCase();

  if (action === "module_permissions") {
    return response({ ...(await modulePermissionPayload(supabase)), actor_role: "admin", actor_profile_id: actorId });
  }

  if (action === "save_module_permissions" || action === "preset_module_permissions") {
    const targetProfileId = String((body as any)?.profile_id || "").trim();
    if (!targetProfileId) return response({ ok: false, error: "profile_id is required." }, 400);

    let changes = Array.isArray((body as any)?.changes) ? (body as any).changes : [];
    if (action === "preset_module_permissions") {
      const preset = String((body as any)?.preset || "").trim().toLowerCase();
      if (preset === "safety_only") {
        changes = [
          { module_key: "safety", access_level: "create" },
          { module_key: "finance", access_level: "hidden" },
          { module_key: "jobs", access_level: "hidden" },
          { module_key: "admin", access_level: "hidden" },
        ];
      } else if (preset === "reset_all") {
        changes = ["safety", "finance", "jobs", "admin"].map((module_key) => ({ module_key, access_level: "inherit" }));
      } else {
        return response({ ok: false, error: "Unknown module permission preset." }, 400);
      }
    }

    const { data, error } = await supabase.rpc("ywi_admin_set_profile_module_permissions", {
      p_actor_profile_id: actorId,
      p_target_profile_id: targetProfileId,
      p_changes: changes,
      p_reason: String((body as any)?.permission_reason || "Updated from Admin module permissions.").slice(0, 300),
    });
    if (error) return response({ ok: false, error: error.message || "Module permissions could not be saved." }, 400);

    return response({
      ...(await modulePermissionPayload(supabase)),
      actor_role: "admin",
      actor_profile_id: actorId,
      updated_profile_id: targetProfileId,
      effective_permissions: data || [],
    });
  }

  if (action === "it_readiness") {
    return response({ ...(await readinessPayload(supabase)), actor_role: "admin", actor_profile_id: actorId });
  }

  return response({ ok: false, error: "Unknown admin I.T. action." }, 400);
});
