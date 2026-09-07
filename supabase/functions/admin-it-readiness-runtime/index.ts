import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GITHUB_COMPARE_URL = "https://api.github.com/repos/RosevearCreations/yw/compare/main...dev";

type Section = {
  rows: any[];
  error: string | null;
  deferred?: boolean;
  summary: { status: string; total: number; blocking: number; warning: number; error: string | null };
};

type ReleaseDivergence = {
  available: boolean;
  comparison_status: string;
  divergence_status: string;
  development_sha: string | null;
  production_sha: string | null;
  development_tree_sha: string | null;
  production_tree_sha: string | null;
  development_commits_pending: number;
  production_only_commits: number;
  error: string | null;
};

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRole(value: unknown) {
  const clean = String(value || "employee").trim().toLowerCase() || "employee";
  return clean === "worker" || clean === "staff" ? "employee" : clean;
}

function rowStatus(row: any) {
  if (!row || typeof row !== "object") return "unknown";
  for (const key of [
    "status", "check_status", "readiness_status", "gate_status", "drift_status",
    "health_status", "severity", "release_authority_status", "source_gate_status",
    "repository_enforcement_status", "scorecard_truth_status", "technical_readiness_status",
  ]) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim().toLowerCase();
  }
  for (const key of ["ok", "passed", "ready", "is_ready", "is_current", "healthy"]) {
    if (typeof row[key] === "boolean") return row[key] ? "passed" : "failed";
  }
  return "unknown";
}

function summarize(rows: any[] = [], error: string | null = null) {
  if (error) return { status: "error", total: 0, blocking: 1, warning: 0, error };
  const failure = /^(failed|failure|error|critical|blocked|behind|missing|not_ready|not ready|unhealthy|red|no)$/;
  const warning = /^(warning|warn|amber|review|pending|unknown|attention)$/;
  let blocking = 0;
  let warnings = 0;
  for (const row of rows) {
    const status = rowStatus(row);
    if (failure.test(status)) blocking += 1;
    else if (warning.test(status) || status.endsWith("_pending")) warnings += 1;
  }
  return { status: blocking ? "error" : warnings ? "warning" : "passed", total: rows.length, blocking, warning: warnings, error: null };
}

async function listRows(supabase: any, table: string, options: { order?: string; ascending?: boolean; limit?: number; columns?: string } = {}): Promise<Section> {
  try {
    let query = supabase.from(table).select(options.columns || "*").limit(options.limit || 100);
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false });
    const { data, error } = await query;
    const message = error?.message || null;
    const rows = data || [];
    return { rows, error: message, summary: summarize(rows, message) };
  } catch (err) {
    const message = String((err as Error)?.message || err || `Unable to load ${table}.`);
    return { rows: [], error: message, summary: summarize([], message) };
  }
}

function deferredSection(): Section {
  return {
    rows: [],
    error: null,
    deferred: true,
    summary: { status: "deferred", total: 0, blocking: 0, warning: 0, error: null },
  };
}

async function loadReleaseDivergence(): Promise<ReleaseDivergence> {
  const fallback: ReleaseDivergence = {
    available: false,
    comparison_status: "unavailable",
    divergence_status: "evidence_unavailable",
    development_sha: null,
    production_sha: null,
    development_tree_sha: null,
    production_tree_sha: null,
    development_commits_pending: 0,
    production_only_commits: 0,
    error: null,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const githubResponse = await fetch(GITHUB_COMPARE_URL, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "ywi-admin-it-readiness",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: controller.signal,
    });
    if (!githubResponse.ok) throw new Error(`GitHub compare returned HTTP ${githubResponse.status}.`);
    const payload = await githubResponse.json();
    const developmentSha = String(payload?.head_commit?.sha || "").trim() || null;
    const productionSha = String(payload?.base_commit?.sha || "").trim() || null;
    const developmentTree = String(payload?.head_commit?.commit?.tree?.sha || "").trim() || null;
    const productionTree = String(payload?.base_commit?.commit?.tree?.sha || "").trim() || null;
    const aheadBy = Math.max(0, Number(payload?.ahead_by || 0));
    const behindBy = Math.max(0, Number(payload?.behind_by || 0));
    const comparisonStatus = String(payload?.status || "unknown").trim().toLowerCase() || "unknown";
    let divergenceStatus = "review_required";
    if (developmentTree && productionTree && developmentTree === productionTree) divergenceStatus = "content_current";
    else if (aheadBy > 0) divergenceStatus = "development_changes_pending";
    else if (behindBy > 0) divergenceStatus = "production_only_drift";
    else if (comparisonStatus === "identical") divergenceStatus = "content_current";
    return {
      available: Boolean(developmentSha && productionSha),
      comparison_status: comparisonStatus,
      divergence_status: divergenceStatus,
      development_sha: developmentSha,
      production_sha: productionSha,
      development_tree_sha: developmentTree,
      production_tree_sha: productionTree,
      development_commits_pending: aheadBy,
      production_only_commits: behindBy,
      error: null,
    };
  } catch (err) {
    return {
      ...fallback,
      error: String((err as Error)?.message || err || "Live GitHub comparison could not be loaded."),
    };
  } finally {
    clearTimeout(timer);
  }
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
    .select("id,role,is_active")
    .eq("id", actorId)
    .maybeSingle();
  if (profileError || !actorProfile || actorProfile.is_active === false || normalizeRole(actorProfile.role) !== "admin") {
    return response({ ok: false, error: "Active Admin role is required for I.T. Readiness." }, 403);
  }

  const [sources, releaseDivergence] = await Promise.all([
    Promise.all([
      listRows(supabase, "v_schema_drift_status", { limit: 2 }),
      listRows(supabase, "v_it_release_authority_status", { limit: 2 }),
      listRows(supabase, "v_it_release_source_evidence_current", { limit: 2 }),
      listRows(supabase, "v_it_scorecard_progress_truth_status", { limit: 2 }),
      listRows(supabase, "v_it_open_rail_acceptance_readiness", { order: "sort_order", limit: 80 }),
      listRows(supabase, "v_admin_module_access_integrity", { order: "profile_label", limit: 100 }),
      listRows(supabase, "v_admin_error_health_center", { order: "severity_rank", limit: 80 }),
      listRows(supabase, "v_admin_function_readiness_checks", { order: "sort_order", limit: 80 }),
      listRows(supabase, "it_readiness_check_registry", { order: "sort_order", limit: 160 }),
      listRows(supabase, "v_it_current_admin_todo", { order: "sort_order", limit: 80 }),
    ]),
    loadReleaseDivergence(),
  ]);

  const [schemaDrift, releaseAuthority, releaseEvidence, scorecardTruthStatus, openRails, adminIntegrity, runtimeHealth, functionReadiness, readinessRegistry, currentTodo] = sources;
  const required = [schemaDrift, releaseAuthority, scorecardTruthStatus, openRails, adminIntegrity, runtimeHealth, functionReadiness, currentTodo];
  const sourceErrors = required.map((section) => section.error).filter(Boolean) as string[];

  const schemaRow = schemaDrift.rows[0] || {};
  const releaseRow = releaseAuthority.rows[0] || {};
  const scorecardRow = scorecardTruthStatus.rows[0] || {};
  const expectedSchema = Number(schemaRow.expected_schema_version || 0);
  const appliedSchema = Number(schemaRow.latest_applied_schema_version || 0);
  const schemaCurrent = expectedSchema > 0 && appliedSchema === expectedSchema && String(schemaRow.drift_status || "") === "current";
  const adminRows = adminIntegrity.rows.filter((row: any) => normalizeRole(row?.role) === "admin");
  const adminBlockers = adminRows.filter((row: any) => row?.all_modules_manage !== true).length;
  const repositoryStatus = String(releaseRow.repository_enforcement_status || "unknown").toLowerCase();
  const runtimeBlocking = Number(runtimeHealth.summary.blocking || 0);
  const sourceBlocking = sourceErrors.length;
  const criticalBlocking = sourceBlocking + (schemaCurrent ? 0 : 1) + adminBlockers + runtimeBlocking;
  const overallStatus = criticalBlocking > 0 ? "red" : repositoryStatus === "green" ? "green" : "amber";

  const deferredKeys = [
    "scorecard_truth", "cross_module_consumer_health", "finance_operational", "finance_reconciliation",
    "finance_release_hardening", "finance_account_mapping_review", "finance_account_mapping_observability",
    "finance_account_mapping_decision_support", "schema_preflight", "deployment_checklist", "production_readiness",
    "deployment_gate", "backup_restore", "admin_tasks", "public_seo", "panel_diagnostics", "action_permissions", "retry_policy",
  ];
  const sections: Record<string, Section> = {
    readiness_registry: readinessRegistry,
    schema_drift: schemaDrift,
    release_authority: releaseAuthority,
    release_source_evidence: releaseEvidence,
    scorecard_truth_status: scorecardTruthStatus,
    open_rail_acceptance_readiness: openRails,
    admin_access_integrity: adminIntegrity,
    runtime_health: runtimeHealth,
    function_readiness: functionReadiness,
    current_admin_todo: currentTodo,
  };
  for (const key of deferredKeys) sections[key] = deferredSection();

  return response({
    ok: overallStatus !== "red",
    scope: "it_readiness_runtime",
    generated_at: new Date().toISOString(),
    interactive_mode: "bounded_runtime",
    deep_verification_deferred: true,
    source_errors: sourceErrors,
    summary: {
      overall_status: overallStatus,
      schema_current: schemaCurrent,
      expected_schema_version: expectedSchema,
      latest_applied_schema_version: appliedSchema,
      release_authority_status: releaseRow.release_authority_status || "unknown",
      source_gate_status: releaseRow.source_gate_status || "unknown",
      repository_enforcement_status: repositoryStatus,
      branch_protection_reported: releaseRow.branch_protection_reported ?? null,
      branch_policy_verified: releaseRow.branch_policy_verified === true,
      source_sha: releaseRow.source_sha || null,
      workflow_run_id: releaseRow.workflow_run_id || null,
      production_promotion_mode: releaseRow.production_promotion_mode || "manual_human_promotion_required",
      github_divergence_evidence_available: releaseDivergence.available,
      github_compare_status: releaseDivergence.comparison_status,
      release_divergence_status: releaseDivergence.divergence_status,
      development_sha: releaseDivergence.development_sha,
      production_sha: releaseDivergence.production_sha,
      development_tree_sha: releaseDivergence.development_tree_sha,
      production_tree_sha: releaseDivergence.production_tree_sha,
      development_commits_pending: releaseDivergence.development_commits_pending,
      production_only_commits: releaseDivergence.production_only_commits,
      release_divergence_error: releaseDivergence.error,
      scorecard_truth_status: scorecardRow.scorecard_truth_status || "unknown",
      scorecard_open_count: Number(scorecardRow.open_count || 0),
      scorecard_unclassified_open_count: Number(scorecardRow.unclassified_open_count || 0),
      scorecard_human_pending_count: Number(scorecardRow.human_pending_count || 0),
      scorecard_external_pending_count: Number(scorecardRow.external_pending_count || 0),
      open_rail_acceptance_count: openRails.rows.length,
      active_admin_count: adminRows.length,
      admin_access_integrity_blockers: adminBlockers,
      readiness_blockers: sourceBlocking + runtimeBlocking,
      assertion_blockers: 0,
      deep_assertions_deferred: true,
      current_todo_count: currentTodo.rows.length,
    },
    security_assertions: {
      deferred: true,
      mode: "explicit_deep_verification_only",
      errors: [],
      module: [], it: [], release_authority: [], scorecard_truth: [], open_rail_acceptance_readiness: [],
      consumer_observability: [], finance_operational: [], finance_release_hardening: [], finance_account_mapping_review: [],
      finance_account_mapping_observability: [], finance_account_mapping_decision_support: [],
    },
    sections,
    actor_role: "admin",
    actor_profile_id: actorId,
  });
});
