import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const EXPECTED_REPOSITORY = 'RosevearCreations/yw';
const EXPECTED_REPOSITORY_ID = '1148400822';
const EXPECTED_OWNER = 'RosevearCreations';
const EXPECTED_REF = 'refs/heads/main';
const EXPECTED_RECORDER_WORKFLOW_REF = 'RosevearCreations/yw/.github/workflows/repository-policy-evidence-record.yml@refs/heads/main';
const EXPECTED_SOURCE_WORKFLOW = 'YWI source and staging checks';
const EXPECTED_SOURCE_WORKFLOW_PATH = '.github/workflows/staging-browser-integration.yml';
const EXPECTED_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr';
const EXPECTED_AUDIENCE = 'ywi-repository-policy-evidence';
const EXPECTED_RULESET_NAME = 'main protection';
const EXPECTED_REQUIRED_STATUS = 'source-checks';
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_JWKS = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const SHA_RE = /^[0-9a-f]{40}$/;

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const clean = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max);
const positiveInteger = (value: unknown) => {
  const parsed = Number.parseInt(clean(value, 40), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const fullSha = (value: unknown) => {
  const sha = clean(value, 80).toLowerCase();
  return SHA_RE.test(sha) ? sha : null;
};
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
    return out;
  }
  return value;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bearer(req: Request) {
  const header = clean(req.headers.get('authorization'), 12000);
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new HttpError(401, 'GitHub OIDC bearer token is required.');
  return match[1];
}

async function verifyGitHubOidc(req: Request) {
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(bearer(req), GITHUB_JWKS, {
      issuer: GITHUB_ISSUER,
      audience: EXPECTED_AUDIENCE,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (error) {
    throw new HttpError(401, 'GitHub OIDC token could not be verified.', error instanceof Error ? error.message : String(error));
  }

  const errors: string[] = [];
  if (payload.repository !== EXPECTED_REPOSITORY) errors.push('repository claim is not the YardWeasels repository');
  if (clean(payload.repository_id, 80) !== EXPECTED_REPOSITORY_ID) errors.push('repository_id claim does not match the registered repository');
  if (payload.repository_owner !== EXPECTED_OWNER) errors.push('repository_owner claim does not match');
  if (payload.ref !== EXPECTED_REF) errors.push('ref claim must be refs/heads/main');
  if (payload.workflow_ref !== EXPECTED_RECORDER_WORKFLOW_REF) errors.push('workflow_ref claim is not the authorized repository-policy recorder workflow on main');
  if (!['workflow_run', 'workflow_dispatch'].includes(clean(payload.event_name, 80))) errors.push('event_name claim is not an authorized recorder event');
  if (!fullSha(payload.sha)) errors.push('sha claim is not a full commit SHA');
  if (errors.length) throw new HttpError(403, 'GitHub OIDC identity is not authorized for repository-policy evidence recording.', errors);
  return payload;
}

async function githubJson(path: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ywi-repository-policy-evidence-recorder',
    },
  });
  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new HttpError(502, `GitHub verification failed with HTTP ${response.status}.`, typeof data === 'string' ? data.slice(0, 300) : data);
  return data as Record<string, any>;
}

function validateVerifiedEvidence(
  verified: Record<string, any>,
  runId: number,
  runAttempt: number,
  oidc: Record<string, unknown>,
  schema: Record<string, any>,
) {
  const errors: string[] = [];
  const sourceSha = fullSha(verified.source_sha);
  const verifiedRunId = positiveInteger(verified.source_workflow_run_id);
  const verifiedRunAttempt = positiveInteger(verified.source_workflow_run_attempt);
  const rulesetId = positiveInteger(verified.ruleset_id);
  const requiredStatuses = Array.isArray(verified.required_status_contexts)
    ? [...new Set(verified.required_status_contexts.map((value: unknown) => clean(value, 200)).filter(Boolean))].sort()
    : [];
  const verifiedAtMs = Date.parse(clean(verified.verified_at, 100));
  const rulesetUpdatedAtMs = Date.parse(clean(verified.ruleset_updated_at, 100));
  const nowMs = Date.now();
  const expectedSchema = Number(schema?.expected_schema_version || 0);
  const liveSchema = Number(schema?.latest_applied_schema_version || 0);

  if (verified.evidence_format_version !== 1) errors.push('evidence_format_version must equal 1');
  if (verified.evidence_kind !== 'ywi_repository_policy_verified') errors.push('evidence_kind is not verified repository-policy evidence');
  if (verified.verification_result !== 'passed') errors.push('verification_result must be passed');
  if (verified.policy_contract_version !== 1) errors.push('policy_contract_version must equal 1');
  if (verified.repository !== EXPECTED_REPOSITORY || verified.branch_name !== 'main') errors.push('verified repository/branch identity is invalid');
  if (!sourceSha) errors.push('verified source SHA is invalid');
  if (sourceSha && fullSha(oidc.sha) !== sourceSha) errors.push('GitHub OIDC sha claim does not match verified source SHA');
  if (verifiedRunId !== runId || verifiedRunAttempt !== runAttempt) errors.push('verified source workflow run identity does not match request');
  if (verified.source_workflow_name !== EXPECTED_SOURCE_WORKFLOW) errors.push('verified source workflow name is not canonical');
  if (verified.branch_protection_reported !== true || verified.branch_policy_verified !== true) errors.push('verified branch protection and detailed policy must both be true');
  if (!rulesetId) errors.push('verified ruleset id must be positive');
  if (verified.ruleset_name !== EXPECTED_RULESET_NAME || verified.ruleset_target !== 'branch' || verified.ruleset_enforcement !== 'active') errors.push('verified main ruleset identity is invalid');
  if (verified.default_branch_targeted !== true || verified.pull_request_required !== true) errors.push('verified main target / pull-request policy is incomplete');
  if (verified.source_checks_required !== true || !requiredStatuses.includes(EXPECTED_REQUIRED_STATUS)) errors.push('canonical source-checks must be required');
  if (verified.force_push_blocked !== true || verified.deletion_blocked !== true) errors.push('force pushes and deletion must be blocked');
  if (Number(verified.bypass_actor_count) !== 0 || verified.current_user_can_bypass !== 'never') errors.push('repository policy bypass state is not locked');
  if (!Number.isFinite(verifiedAtMs)) errors.push('verified_at is invalid');
  if (!Number.isFinite(rulesetUpdatedAtMs)) errors.push('ruleset_updated_at is invalid');
  if (Number.isFinite(verifiedAtMs) && verifiedAtMs > nowMs + FUTURE_SKEW_MS) errors.push('verified_at is materially future-dated');
  if (Number.isFinite(verifiedAtMs) && nowMs - verifiedAtMs > MAX_VERIFICATION_AGE_MS) errors.push('repository-policy evidence is older than 24 hours');
  if (Number.isFinite(rulesetUpdatedAtMs) && Number.isFinite(verifiedAtMs) && rulesetUpdatedAtMs > verifiedAtMs + FUTURE_SKEW_MS) errors.push('ruleset evidence is materially future-dated relative to verification');
  if (schema?.drift_status !== 'current' || expectedSchema !== liveSchema || expectedSchema < 208) errors.push('Production schema authority is not exactly current at Schema 208 or newer');

  const boundaries = verified.boundaries;
  if (!isObject(boundaries)) errors.push('verified safety boundaries are required');
  else {
    if (boundaries.verification_only !== true) errors.push('repository-policy evidence must remain verification_only before recording');
    for (const key of ['release_source_evidence_mutated', 'production_promotion_performed', 'business_data_mutated', 'finance_provider_mutation_performed']) {
      if (boundaries[key] !== false) errors.push(`verified boundary ${key} must be false before recording`);
    }
  }

  if (errors.length) throw new HttpError(409, 'Verified repository-policy evidence failed recorder validation.', errors);
  return {
    sourceSha: sourceSha!,
    rulesetId: rulesetId!,
    requiredStatuses,
    rulesetUpdatedAt: new Date(rulesetUpdatedAtMs).toISOString(),
    verifiedAt: new Date(verifiedAtMs).toISOString(),
  };
}

function validateFreshGitHub(run: Record<string, any>, main: Record<string, any>, runId: number, runAttempt: number, sourceSha: string) {
  const errors: string[] = [];
  if (Number(run.id) !== runId || Number(run.run_attempt) !== runAttempt) errors.push('fresh workflow run identity does not match');
  if (run.name !== EXPECTED_SOURCE_WORKFLOW || run.path !== EXPECTED_SOURCE_WORKFLOW_PATH) errors.push('fresh workflow identity is not canonical');
  if (run.event !== 'push' || run.head_branch !== 'main') errors.push('fresh workflow must remain a main push');
  if (fullSha(run.head_sha) !== sourceSha) errors.push('fresh workflow head SHA does not match');
  if (run.status !== 'completed' || run.conclusion !== 'success') errors.push('fresh workflow must remain completed/success');
  if (run.repository?.full_name !== EXPECTED_REPOSITORY) errors.push('fresh workflow repository does not match');
  if (main.name !== 'main' || fullSha(main?.commit?.sha) !== sourceSha) errors.push('current main moved after policy verification');
  if (main.protected !== true) errors.push('current main is no longer protected');
  if (errors.length) throw new HttpError(409, 'Fresh GitHub release authority failed repository-policy recorder validation.', errors);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Use POST.' }, { status: 405 });

  try {
    const oidc = await verifyGitHubOidc(req);
    const body = await req.json().catch(() => ({}));
    const verified = isObject(body?.verified) ? body.verified as Record<string, any> : null;
    const runId = positiveInteger(body?.source_run_id);
    const runAttempt = positiveInteger(body?.source_run_attempt);
    if (!verified || !runId || !runAttempt) throw new HttpError(400, 'verified evidence, source_run_id and source_run_attempt are required.');

    const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'), 500).replace(/\/$/, '');
    const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), 12000);
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, 'Repository-policy evidence recorder is not configured in Supabase.');
    const actualProjectRef = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i.exec(supabaseUrl)?.[1]?.toLowerCase() || '';
    if (actualProjectRef !== EXPECTED_PROJECT_REF) throw new HttpError(500, 'Repository-policy recorder is not running in the registered YardWeasels Production project.');

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: schema, error: schemaError } = await supabase
      .from('v_schema_drift_status')
      .select('expected_schema_version,latest_applied_schema_version,drift_status')
      .maybeSingle();
    if (schemaError) throw schemaError;

    const shape = validateVerifiedEvidence(verified, runId, runAttempt, oidc, schema || {});
    const [run, main] = await Promise.all([
      githubJson(`/repos/${EXPECTED_REPOSITORY}/actions/runs/${runId}`),
      githubJson(`/repos/${EXPECTED_REPOSITORY}/branches/main`),
    ]);
    validateFreshGitHub(run, main, runId, runAttempt, shape.sourceSha);

    const digest = await sha256(verified);
    const { data: recordData, error: recordError } = await supabase.rpc('ywi_record_verified_repository_policy_evidence', {
      p_project_ref: EXPECTED_PROJECT_REF,
      p_repository: EXPECTED_REPOSITORY,
      p_branch_name: 'main',
      p_source_sha: shape.sourceSha,
      p_source_workflow_run_id: runId,
      p_source_workflow_run_attempt: runAttempt,
      p_branch_protection_reported: true,
      p_ruleset_id: shape.rulesetId,
      p_ruleset_name: EXPECTED_RULESET_NAME,
      p_ruleset_target: 'branch',
      p_ruleset_enforcement: 'active',
      p_default_branch_targeted: true,
      p_pull_request_required: true,
      p_required_status_contexts: shape.requiredStatuses,
      p_source_checks_required: true,
      p_force_push_blocked: true,
      p_deletion_blocked: true,
      p_bypass_actor_count: 0,
      p_current_user_can_bypass: 'never',
      p_policy_contract_version: 1,
      p_ruleset_updated_at: shape.rulesetUpdatedAt,
      p_verified_payload_sha256: digest,
      p_verified_at: shape.verifiedAt,
      p_evidence_note: 'Recorded from GitHub OIDC-authenticated, independently verified current main ruleset evidence.',
    });
    if (recordError) throw recordError;
    const rawId = Array.isArray(recordData) ? recordData[0] : recordData;
    const evidenceId = Number.parseInt(String(rawId), 10);
    if (!Number.isInteger(evidenceId) || evidenceId <= 0) throw new HttpError(500, 'Repository-policy evidence RPC returned an invalid evidence id.');

    const { data: recorded, error: recordedError } = await supabase
      .from('it_repository_policy_evidence')
      .select('id,repository,branch_name,source_sha,source_workflow_run_id,source_workflow_run_attempt,branch_protection_reported,ruleset_id,ruleset_name,ruleset_target,ruleset_enforcement,default_branch_targeted,pull_request_required,required_status_contexts,source_checks_required,force_push_blocked,deletion_blocked,bypass_actor_count,current_user_can_bypass,policy_contract_version,verified_payload_sha256,verified_at')
      .eq('id', evidenceId)
      .maybeSingle();
    if (recordedError) throw recordedError;
    if (!recorded || recorded.source_sha !== shape.sourceSha || Number(recorded.source_workflow_run_id) !== runId || Number(recorded.ruleset_id) !== shape.rulesetId) {
      throw new HttpError(500, 'Recorded repository-policy evidence could not be re-read with matching identity.');
    }
    if (recorded.branch_protection_reported !== true || recorded.ruleset_enforcement !== 'active' || recorded.source_checks_required !== true || recorded.force_push_blocked !== true || recorded.deletion_blocked !== true || Number(recorded.bypass_actor_count) !== 0 || recorded.current_user_can_bypass !== 'never') {
      throw new HttpError(500, 'Recorded repository-policy evidence did not preserve the verified policy boundary.', recorded);
    }

    const { data: current, error: currentError } = await supabase
      .from('v_it_repository_policy_evidence_current')
      .select('id,source_sha,ruleset_id,branch_policy_verified,repository_enforcement_status')
      .limit(1)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current || Number(current.id) !== evidenceId) {
      throw new HttpError(500, 'Current repository-policy authority could not be re-read after recording.');
    }

    return Response.json({
      ok: true,
      evidence_id: evidenceId,
      source_sha: shape.sourceSha,
      workflow_run_id: runId,
      workflow_run_attempt: runAttempt,
      ruleset_id: shape.rulesetId,
      branch_policy_evidence_recorded: true,
      branch_policy_verified: current.branch_policy_verified === true,
      repository_enforcement_status: current.repository_enforcement_status || 'amber',
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Repository-policy evidence recorder failed.';
    const details = error instanceof HttpError ? error.details : undefined;
    console.error('repository-policy-evidence-record:', message);
    return Response.json({ ok: false, error: message, details }, { status });
  }
});
