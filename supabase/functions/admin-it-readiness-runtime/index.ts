import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRuntimeReleaseChangePolicy, RUNTIME_POLICY_MODE, RUNTIME_POLICY_SOURCE_AUTHORITY } from "../_shared/release-change-policy-runtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GITHUB_COMPARE_URL = "https://api.github.com/repos/RosevearCreations/yw/compare/main...dev";
const GITHUB_ACTIONS_RUNS_URL = "https://api.github.com/repos/RosevearCreations/yw/actions/runs";
const GITHUB_WORKFLOW_NAME = "YWI source and staging checks";
const GITHUB_WORKFLOW_PATH = ".github/workflows/staging-browser-integration.yml";
const GITHUB_COMPARE_FILE_CAP = 300;
const RELEASE_GATE_EVIDENCE_FRESH_HOURS = 24;

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
  policy_available: boolean;
  policy_status: string;
  policy: any | null;
  policy_error: string | null;
  comparison_files_truncated: boolean;
  error: string | null;
};

type ReleaseGateChecklistItem = {
  gate: string;
  status: "proven" | "missing" | "stale" | "not_applicable";
  step_name: string | null;
  step_number: number | null;
  step_conclusion: string | null;
  detail: string;
};

type ReleaseGateChecklist = {
  available: boolean;
  status: "proven" | "missing" | "stale" | "not_applicable" | "evidence_unavailable";
  candidate_sha: string | null;
  workflow_run_id: number | null;
  workflow_run_number: number | null;
  workflow_run_attempt: number | null;
  workflow_status: string | null;
  workflow_conclusion: string | null;
  workflow_completed_at: string | null;
  evidence_age_hours: number | null;
  fresh_hours: number;
  counts: { proven: number; missing: number; stale: number; not_applicable: number };
  items: ReleaseGateChecklistItem[];
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

function githubHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "User-Agent": "ywi-admin-it-readiness",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchGithubJson(url: string, timeoutMs = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fetch(url, { headers: githubHeaders(), signal: controller.signal });
    if (!result.ok) throw new Error(`GitHub evidence read returned HTTP ${result.status}.`);
    return await result.json();
  } finally {
    clearTimeout(timer);
  }
}

function emptyGateChecklist(status: ReleaseGateChecklist["status"], candidateSha: string | null, error: string | null = null): ReleaseGateChecklist {
  return {
    available: status !== "evidence_unavailable",
    status,
    candidate_sha: candidateSha,
    workflow_run_id: null,
    workflow_run_number: null,
    workflow_run_attempt: null,
    workflow_status: null,
    workflow_conclusion: null,
    workflow_completed_at: null,
    evidence_age_hours: null,
    fresh_hours: RELEASE_GATE_EVIDENCE_FRESH_HOURS,
    counts: { proven: 0, missing: 0, stale: 0, not_applicable: 0 },
    items: [],
    error,
  };
}

function gateStep(steps: any[], gate: string) {
  const expected = `Run npm run ${gate}`;
  return steps.find((step: any) => {
    const name = String(step?.name || "").trim();
    return name === expected || name.includes(`npm run ${gate}`);
  }) || null;
}

async function loadReleaseGateChecklist(release: ReleaseDivergence): Promise<ReleaseGateChecklist> {
  const candidateSha = String(release.development_sha || "").trim() || null;
  if (release.divergence_status === "content_current") return emptyGateChecklist("not_applicable", candidateSha);
  if (release.divergence_status !== "development_changes_pending" || !candidateSha) {
    return emptyGateChecklist("evidence_unavailable", candidateSha, "A Development promotion candidate is not available for exact-SHA gate evidence.");
  }
  const requiredGates = Array.isArray(release.policy?.required_gate_scripts)
    ? release.policy.required_gate_scripts.map((gate: unknown) => String(gate || "").trim()).filter(Boolean)
    : [];
  if (!release.policy_available || !requiredGates.length) {
    return emptyGateChecklist("evidence_unavailable", candidateSha, "Build 246 release classification must be complete before required-gate workflow evidence can be evaluated.");
  }

  try {
    const query = `${GITHUB_ACTIONS_RUNS_URL}?head_sha=${encodeURIComponent(candidateSha)}&event=pull_request&per_page=10`;
    const runsPayload = await fetchGithubJson(query);
    const runs = (Array.isArray(runsPayload?.workflow_runs) ? runsPayload.workflow_runs : [])
      .filter((run: any) => String(run?.head_sha || "").trim().toLowerCase() === candidateSha.toLowerCase())
      .filter((run: any) => String(run?.name || "").trim() === GITHUB_WORKFLOW_NAME)
      .filter((run: any) => String(run?.path || "").trim() === GITHUB_WORKFLOW_PATH);
    const run = runs.find((row: any) => row?.status === "completed" && row?.conclusion === "success")
      || runs.find((row: any) => row?.status === "completed")
      || runs[0]
      || null;

    if (!run) {
      const checklist = emptyGateChecklist("missing", candidateSha);
      checklist.counts.missing = requiredGates.length;
      checklist.items = requiredGates.map((gate: string) => ({
        gate,
        status: "missing",
        step_name: null,
        step_number: null,
        step_conclusion: null,
        detail: "No canonical pull-request workflow run is recorded on this exact Development SHA.",
      }));
      return checklist;
    }

    const runId = Number(run?.id || 0) || null;
    const jobsPayload = runId
      ? await fetchGithubJson(`${GITHUB_ACTIONS_RUNS_URL}/${runId}/jobs?filter=latest&per_page=100`)
      : { jobs: [] };
    const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
    const sourceJob = jobs.find((job: any) => String(job?.name || "").trim() === "source-checks") || null;
    const steps = Array.isArray(sourceJob?.steps) ? sourceJob.steps : [];
    const evidenceAt = String(run?.completed_at || run?.updated_at || run?.run_started_at || run?.created_at || "").trim() || null;
    const evidenceMs = evidenceAt ? Date.parse(evidenceAt) : Number.NaN;
    const ageHours = Number.isFinite(evidenceMs) ? Math.max(0, (Date.now() - evidenceMs) / 3600000) : null;
    const staleRun = ageHours !== null && ageHours > RELEASE_GATE_EVIDENCE_FRESH_HOURS;

    const items: ReleaseGateChecklistItem[] = requiredGates.map((gate: string) => {
      const step = gateStep(steps, gate);
      const conclusion = String(step?.conclusion || "").trim().toLowerCase() || null;
      if (!step || conclusion !== "success") {
        return {
          gate,
          status: "missing",
          step_name: step?.name ? String(step.name) : null,
          step_number: Number.isFinite(Number(step?.number)) ? Number(step.number) : null,
          step_conclusion: conclusion,
          detail: step
            ? `Required workflow step is ${conclusion || String(step?.status || "not proven")}; success on the exact candidate SHA is required.`
            : "Required gate step is not present in the selected canonical workflow evidence.",
        };
      }
      if (staleRun) {
        return {
          gate,
          status: "stale",
          step_name: String(step.name || ""),
          step_number: Number.isFinite(Number(step?.number)) ? Number(step.number) : null,
          step_conclusion: conclusion,
          detail: `Gate passed on the exact candidate SHA, but the workflow evidence is older than ${RELEASE_GATE_EVIDENCE_FRESH_HOURS} hours.`,
        };
      }
      return {
        gate,
        status: "proven",
        step_name: String(step.name || ""),
        step_number: Number.isFinite(Number(step?.number)) ? Number(step.number) : null,
        step_conclusion: conclusion,
        detail: "Gate step completed successfully on the exact current Development SHA within the evidence freshness window.",
      };
    });

    const counts = {
      proven: items.filter((item) => item.status === "proven").length,
      missing: items.filter((item) => item.status === "missing").length,
      stale: items.filter((item) => item.status === "stale").length,
      not_applicable: items.filter((item) => item.status === "not_applicable").length,
    };
    const status: ReleaseGateChecklist["status"] = counts.missing > 0 ? "missing" : counts.stale > 0 ? "stale" : "proven";
    return {
      available: true,
      status,
      candidate_sha: candidateSha,
      workflow_run_id: runId,
      workflow_run_number: Number(run?.run_number || 0) || null,
      workflow_run_attempt: Number(run?.run_attempt || 0) || null,
      workflow_status: String(run?.status || "").trim() || null,
      workflow_conclusion: String(run?.conclusion || "").trim() || null,
      workflow_completed_at: String(run?.completed_at || "").trim() || null,
      evidence_age_hours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      fresh_hours: RELEASE_GATE_EVIDENCE_FRESH_HOURS,
      counts,
      items,
      error: null,
    };
  } catch (err) {
    return emptyGateChecklist(
      "evidence_unavailable",
      candidateSha,
      String((err as Error)?.message || err || "Canonical workflow evidence could not be loaded."),
    );
  }
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
    policy_available: false,
    policy_status: "evidence_unavailable",
    policy: null,
    policy_error: null,
    comparison_files_truncated: false,
    error: null,
  };
  try {
    const payload = await fetchGithubJson(GITHUB_COMPARE_URL, 2500);
    const developmentSha = String(payload?.head_commit?.sha || "").trim() || null;
    const productionSha = String(payload?.base_commit?.sha || "").trim() || null;
    const developmentTree = String(payload?.head_commit?.commit?.tree?.sha || "").trim() || null;
    const productionTree = String(payload?.base_commit?.commit?.tree?.sha || "").trim() || null;
    const aheadBy = Math.max(0, Number(payload?.ahead_by || 0));
    const behindBy = Math.max(0, Number(payload?.behind_by || 0));
    const comparisonStatus = String(payload?.status || "unknown").trim().toLowerCase() || "unknown";
    const changedFiles = Array.isArray(payload?.files)
      ? payload.files.map((row: any) => String(row?.filename || "").trim()).filter(Boolean)
      : [];
    const filesTruncated = changedFiles.length >= GITHUB_COMPARE_FILE_CAP;
    let divergenceStatus = "review_required";
    if (developmentTree && productionTree && developmentTree === productionTree) divergenceStatus = "content_current";
    else if (aheadBy > 0) divergenceStatus = "development_changes_pending";
    else if (behindBy > 0) divergenceStatus = "production_only_drift";
    else if (comparisonStatus === "identical") divergenceStatus = "content_current";

    let policy: any | null = null;
    let policyStatus = "not_applicable";
    let policyError: string | null = null;
    if (aheadBy > 0) {
      if (filesTruncated) {
        policyStatus = "classification_incomplete";
        policyError = `GitHub compare returned ${GITHUB_COMPARE_FILE_CAP} files; release classification refuses to infer complete coverage at the compare file cap.`;
      } else if (!changedFiles.length) {
        policyStatus = "changed_file_evidence_unavailable";
        policyError = "Development commits are pending but GitHub returned no changed-file evidence; release classification cannot infer a safe class.";
      } else {
        policy = buildRuntimeReleaseChangePolicy(changedFiles);
        policyStatus = "classified";
      }
    } else if (divergenceStatus === "content_current") {
      policyStatus = "no_pending_candidate";
    } else if (divergenceStatus === "production_only_drift") {
      policyStatus = "production_only_drift";
    }

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
      policy_available: Boolean(policy),
      policy_status: policyStatus,
      policy,
      policy_error: policyError,
      comparison_files_truncated: filesTruncated,
      error: null,
    };
  } catch (err) {
    return {
      ...fallback,
      policy_error: "Live GitHub comparison is unavailable; release classification is unavailable by design.",
      error: String((err as Error)?.message || err || "Live GitHub comparison could not be loaded."),
    };
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

  const releaseDivergencePromise = loadReleaseDivergence();
  const sources = await Promise.all([
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
  ]);
  const releaseDivergence = await releaseDivergencePromise;
  const releaseGateChecklist = await loadReleaseGateChecklist(releaseDivergence);

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

  const policy = releaseDivergence.policy || {};
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
      release_policy_available: releaseDivergence.policy_available,
      release_policy_status: releaseDivergence.policy_status,
      release_policy_source_authority: policy.source_authority || RUNTIME_POLICY_SOURCE_AUTHORITY,
      release_policy_runtime_mode: policy.runtime_mode || RUNTIME_POLICY_MODE,
      release_policy_primary_class: policy.primary_class || null,
      release_policy_classes: policy.classes || [],
      release_policy_risk_level: policy.risk_level || null,
      release_policy_evidence_profile: policy.evidence_profile || null,
      release_policy_manual_review_required: policy.manual_review_required === true,
      release_policy_required_gates: policy.required_gate_scripts || [],
      release_policy_changed_file_count: Number(policy.changed_file_count || 0),
      release_policy_changed_files: policy.changed_files || [],
      release_policy_changed_migrations: policy.changed_migrations || [],
      release_policy_comparison_files_truncated: releaseDivergence.comparison_files_truncated,
      release_policy_error: releaseDivergence.policy_error,
      release_evidence_checklist_available: releaseGateChecklist.available,
      release_evidence_checklist_status: releaseGateChecklist.status,
      release_evidence_checklist_candidate_sha: releaseGateChecklist.candidate_sha,
      release_evidence_checklist_workflow_run_id: releaseGateChecklist.workflow_run_id,
      release_evidence_checklist_workflow_run_number: releaseGateChecklist.workflow_run_number,
      release_evidence_checklist_workflow_run_attempt: releaseGateChecklist.workflow_run_attempt,
      release_evidence_checklist_workflow_status: releaseGateChecklist.workflow_status,
      release_evidence_checklist_workflow_conclusion: releaseGateChecklist.workflow_conclusion,
      release_evidence_checklist_workflow_completed_at: releaseGateChecklist.workflow_completed_at,
      release_evidence_checklist_age_hours: releaseGateChecklist.evidence_age_hours,
      release_evidence_checklist_fresh_hours: releaseGateChecklist.fresh_hours,
      release_evidence_checklist_counts: releaseGateChecklist.counts,
      release_evidence_checklist_items: releaseGateChecklist.items,
      release_evidence_checklist_error: releaseGateChecklist.error,
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
