import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const BUILD = '2026-09-04b';
const MINIMUM_SCHEMA = 197;
const KNOWN_PRODUCTION_PROJECT_REF = 'jmqvkgiqlimdhcofwkxr';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const clean = (value: unknown, max = 2000) => String(value ?? '').trim().slice(0, max);
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value,80));
const caseKeyOk = (value: unknown) => /^[a-z0-9][a-z0-9_]{2,119}$/.test(clean(value,120));
const truthy = (value: unknown) => ['1','true','yes','enabled'].includes(clean(value,40).toLowerCase());

function projectRefFromUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

async function runtimeEnvironmentGuard(supabase: any, supabaseUrl: string) {
  const actualProjectRef = projectRefFromUrl(supabaseUrl);
  const runtimeEnvironment = clean(Deno.env.get('YWI_RUNTIME_ENVIRONMENT'),40).toLowerCase();
  const expectedStagingRef = clean(Deno.env.get('YWI_STAGING_PROJECT_REF'),80).toLowerCase();
  const configuredProductionRef = clean(Deno.env.get('YWI_PRODUCTION_PROJECT_REF') || KNOWN_PRODUCTION_PROJECT_REF,80).toLowerCase();
  const mutationFlag = truthy(Deno.env.get('YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED'));

  let registeredAuthority: any = null;
  if (actualProjectRef) {
    const { data, error } = await supabase
      .from('it_runtime_environment_authorities')
      .select('project_ref,environment_class,staging_acceptance_mutation_allowed,authority_note')
      .eq('project_ref',actualProjectRef)
      .maybeSingle();
    if (error) throw error;
    registeredAuthority = data || null;
  }

  const knownProduction = Boolean(actualProjectRef) && (
    actualProjectRef === KNOWN_PRODUCTION_PROJECT_REF ||
    actualProjectRef === configuredProductionRef ||
    registeredAuthority?.environment_class === 'production'
  );
  const explicitStaging = runtimeEnvironment === 'staging';
  const exactRefMatch = Boolean(actualProjectRef && expectedStagingRef && actualProjectRef === expectedStagingRef);
  const registryAllows = registeredAuthority == null || registeredAuthority.staging_acceptance_mutation_allowed === true;
  const mutationAllowed = explicitStaging && mutationFlag && exactRefMatch && !knownProduction && registryAllows;

  let reason = 'Dedicated staging mutation is explicitly enabled.';
  if (knownProduction) reason = 'Production project authority permanently denies staging-acceptance mutation.';
  else if (!actualProjectRef) reason = 'The current Supabase project ref could not be resolved.';
  else if (!explicitStaging) reason = 'YWI_RUNTIME_ENVIRONMENT must be exactly staging for acceptance mutation.';
  else if (!expectedStagingRef) reason = 'YWI_STAGING_PROJECT_REF is required for acceptance mutation.';
  else if (!exactRefMatch) reason = 'The runtime project ref does not match YWI_STAGING_PROJECT_REF.';
  else if (!mutationFlag) reason = 'YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED is not explicitly enabled.';
  else if (!registryAllows) reason = 'Runtime environment authority denies staging-acceptance mutation for this project.';

  return {
    runtime_environment: runtimeEnvironment || 'unconfigured',
    actual_project_ref: actualProjectRef || null,
    expected_staging_project_ref: expectedStagingRef || null,
    configured_production_project_ref: configuredProductionRef || KNOWN_PRODUCTION_PROJECT_REF,
    registered_environment_class: registeredAuthority?.environment_class || null,
    registered_mutation_allowed: registeredAuthority?.staging_acceptance_mutation_allowed ?? null,
    explicit_staging: explicitStaging,
    exact_project_ref_match: exactRefMatch,
    mutation_flag_enabled: mutationFlag,
    known_production: knownProduction,
    mutation_allowed: mutationAllowed,
    reason,
  };
}

async function runtimeSchemaAuthority(supabase:any) {
  const { data, error } = await supabase
    .from('v_schema_drift_status')
    .select('expected_schema_version,latest_applied_schema_version,drift_status,message,checked_at')
    .maybeSingle();
  if (error) throw error;
  const expectedSchema = Number(data?.expected_schema_version || 0);
  const latestSchema = Number(data?.latest_applied_schema_version || 0);
  const driftStatus = clean(data?.drift_status,40).toLowerCase();
  const exactSchemaMatch = driftStatus === 'current' && expectedSchema >= MINIMUM_SCHEMA && latestSchema === expectedSchema;
  return {
    expected_schema_version:expectedSchema || null,
    latest_applied_schema_version:latestSchema || null,
    drift_status:driftStatus || 'unknown',
    exact_schema_match:exactSchemaMatch,
    minimum_schema:MINIMUM_SCHEMA,
    message:clean(data?.message,1000) || null,
    checked_at:data?.checked_at || null,
  };
}

function assertStagingMutationAllowed(guard: any) {
  if (guard?.mutation_allowed === true) return;
  throw new HttpError(409,'Staging acceptance mutation is locked for this runtime environment.',{
    environment_guard:guard,
    required:'Set YWI_RUNTIME_ENVIRONMENT=staging, YWI_STAGING_PROJECT_REF to this exact non-production project ref, and YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED=true. Production is always denied.'
  });
}

function assertCurrentRuntimeSchema(authority:any) {
  if (authority?.exact_schema_match === true) return;
  throw new HttpError(409,'Staging acceptance mutation is locked until the staging database exactly matches the current repository schema authority.',{
    schema_authority:authority,
    required:'v_schema_drift_status must report current and latest_applied_schema_version must exactly equal expected_schema_version.'
  });
}

async function getActor(supabase: any, req: Request) {
  const token = clean((req.headers.get('authorization') || '').replace(/^Bearer\s+/i,''),5000);
  if (!token) throw new HttpError(401,'Sign in is required.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new HttpError(401,'The signed-in session could not be verified.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,full_name,email,is_active')
    .eq('id',data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.id || profile.is_active === false) throw new HttpError(403,'An active staff profile is required.');
  if (!(await hasModuleAccess(supabase,profile,'admin','manage'))) {
    throw new HttpError(403,'Admin module manage access is required for staging acceptance evidence.');
  }
  return profile;
}

async function statusPayload(supabase: any, environmentGuard: any) {
  const [
    { data: rows, error: rowsError },
    { data: securityAssertions, error: securityError },
    { data: catalogAssertions, error: catalogError },
    { data: environmentAssertions, error: environmentError },
    { data: scenarioPlan, error: scenarioError },
    { data: recentRuns, error: runsError },
    schemaAuthority,
  ] = await Promise.all([
    supabase.from('v_it_staging_acceptance_status').select('*').order('sort_order',{ ascending:true }),
    supabase.rpc('ywi_staging_acceptance_security_assertions'),
    supabase.rpc('ywi_staging_acceptance_catalog_assertions'),
    supabase.rpc('ywi_staging_environment_guard_assertions'),
    supabase.from('v_it_staging_acceptance_scenario_plan').select('*').order('rail_key',{ascending:true}).order('case_sort_order',{ascending:true}),
    supabase.from('operations_staging_test_runs')
      .select('id,run_key,target_rail_key,suite_name,run_status,source_sha,source_workflow_run_id,schema_version,fixture_set_id,human_signoff_required,human_signoff_status,human_signoff_by_profile_id,human_signoff_at,started_at,finished_at,evidence_note')
      .eq('acceptance_class','staging_acceptance')
      .order('started_at',{ ascending:false })
      .limit(20),
    runtimeSchemaAuthority(supabase),
  ]);
  if (rowsError) throw rowsError;
  if (securityError) throw securityError;
  if (catalogError) throw catalogError;
  if (environmentError) throw environmentError;
  if (scenarioError) throw scenarioError;
  if (runsError) throw runsError;

  const securityRows = securityAssertions || [];
  const catalogRows = catalogAssertions || [];
  const environmentRows = environmentAssertions || [];
  const schemaRows = [{
    assertion_key:'staging_runtime_schema_current',
    assertion_status:schemaAuthority.exact_schema_match ? 'passed' : 'failed',
    assertion_detail:schemaAuthority.exact_schema_match
      ? `Runtime schema is exactly current at ${schemaAuthority.expected_schema_version}.`
      : `Expected schema ${schemaAuthority.expected_schema_version ?? 'unknown'}; live schema ${schemaAuthority.latest_applied_schema_version ?? 'unknown'}; drift ${schemaAuthority.drift_status}.`,
  }];
  const failedAssertions = [...securityRows,...catalogRows,...environmentRows,...schemaRows]
    .filter((row:any) => String(row?.assertion_status || '').toLowerCase() !== 'passed');
  const acceptanceRows = rows || [];
  const scenarios = scenarioPlan || [];
  return {
    ok: failedAssertions.length === 0,
    build:BUILD,
    schema:schemaAuthority.expected_schema_version,
    minimum_schema:MINIMUM_SCHEMA,
    schema_authority:schemaAuthority,
    environment_guard:environmentGuard,
    summary:{
      rail_count:acceptanceRows.length,
      scenario_count:scenarios.length,
      accepted_count:acceptanceRows.filter((row:any)=>row?.acceptance_complete === true).length,
      awaiting_human_count:acceptanceRows.filter((row:any)=>row?.staging_acceptance_status === 'awaiting_human_signoff').length,
      pending_evidence_count:scenarios.filter((row:any)=>row?.evidence_status === 'pending_evidence').length,
      human_action_count:scenarios.filter((row:any)=>row?.human_action_required === true).length,
      failed_count:acceptanceRows.filter((row:any)=>['failed','rejected','stale_schema'].includes(String(row?.staging_acceptance_status || ''))).length,
      assertion_failures:failedAssertions.length,
      schema_current:schemaAuthority.exact_schema_match,
      business_rail_auto_close:false,
      staging_mutation_allowed:environmentGuard?.mutation_allowed === true && schemaAuthority.exact_schema_match === true,
      known_production_runtime:environmentGuard?.known_production === true,
    },
    staging_acceptance:acceptanceRows,
    scenario_plan:scenarios,
    security_assertions:securityRows,
    catalog_assertions:catalogRows,
    environment_assertions:environmentRows,
    schema_assertions:schemaRows,
    recent_runs:recentRuns || [],
  };
}

async function humanCase(supabase:any, runId:string, caseKey:string) {
  const { data: run, error: runError } = await supabase
    .from('operations_staging_test_runs')
    .select('id,target_rail_key,run_status,schema_version')
    .eq('id',runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run?.id || run.run_status !== 'started') throw new HttpError(409,'Human evidence can only be recorded on a started staging run.');
  const { data: scenario, error: scenarioError } = await supabase
    .from('operations_staging_acceptance_scenarios')
    .select('case_key,verification_mode,evidence_kind,is_blocking,expected_outcome')
    .eq('rail_key',run.target_rail_key)
    .eq('case_key',caseKey)
    .eq('is_enabled',true)
    .maybeSingle();
  if (scenarioError) throw scenarioError;
  if (!scenario?.case_key) throw new HttpError(404,'The requested staging scenario is not enabled for this rail.');
  if (scenario.verification_mode !== 'human') throw new HttpError(409,'Runner-controlled staging evidence cannot be marked manually.');
  return { run, scenario };
}

Deno.serve(async (req:Request) => {
  if (req.method === 'OPTIONS') return new Response('ok',{ headers:corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok:false,error:'Use POST.' },{ status:405,headers:corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) throw new HttpError(500,'admin-staging-acceptance is not configured.');
    const supabase = createClient(supabaseUrl,serviceKey,{ auth:{ persistSession:false } });
    const profile = await getActor(supabase,req);
    const environmentGuard = await runtimeEnvironmentGuard(supabase,supabaseUrl);
    const body = await req.json().catch(()=>({}));
    const action = clean(body?.action || 'status',80).toLowerCase();

    if (action === 'status') {
      return Response.json(await statusPayload(supabase,environmentGuard),{ headers:corsHeaders });
    }

    assertStagingMutationAllowed(environmentGuard);
    const schemaAuthority = await runtimeSchemaAuthority(supabase);
    assertCurrentRuntimeSchema(schemaAuthority);

    if (action === 'record_case') {
      const runId = clean(body?.run_id,80);
      const caseKey = clean(body?.case_key,120).toLowerCase();
      const decision = clean(body?.decision,40).toLowerCase();
      const note = clean(body?.note,2000);
      if (!isUuid(runId)) throw new HttpError(400,'A valid staging acceptance run ID is required.');
      if (!caseKeyOk(caseKey)) throw new HttpError(400,'A valid staging scenario case key is required.');
      if (!['passed','failed'].includes(decision)) throw new HttpError(400,'Human case decision must be passed or failed.');
      const { scenario } = await humanCase(supabase,runId,caseKey);
      const { data, error } = await supabase.rpc('ywi_rpc_record_staging_acceptance_result',{
        p_run_id:runId,
        p_actor_profile_id:profile.id,
        p_case_key:caseKey,
        p_case_status:decision,
        p_evidence_kind:scenario.evidence_kind,
        p_is_blocking:scenario.is_blocking,
        p_expected_outcome:scenario.expected_outcome,
        p_observed_outcome:note || `Human marked ${decision}.`,
        p_details:{ human_evidence:true, recorded_from:'admin-staging-acceptance', environment_guard:'staging_allowed', schema_authority:'exact_current' },
      });
      if (error) throw error;
      const status=await statusPayload(supabase,environmentGuard);
      return Response.json({ ok:true,build:BUILD,schema:status.schema,case_result:data,status },{ headers:corsHeaders });
    }

    if (action === 'finalize') {
      const runId = clean(body?.run_id,80);
      const note = clean(body?.note,2000);
      if (!isUuid(runId)) throw new HttpError(400,'A valid staging acceptance run ID is required.');
      const { data, error } = await supabase.rpc('ywi_rpc_finalize_staging_acceptance_run',{
        p_run_id:runId,
        p_actor_profile_id:profile.id,
        p_failure_reason:note || null,
      });
      if (error) throw error;
      const status=await statusPayload(supabase,environmentGuard);
      return Response.json({ ok:true,build:BUILD,schema:status.schema,finalize:data,status },{ headers:corsHeaders });
    }

    if (action === 'signoff') {
      const runId = clean(body?.run_id,80);
      const decision = clean(body?.decision,40).toLowerCase();
      const note = clean(body?.note,2000);
      if (!isUuid(runId)) throw new HttpError(400,'A valid staging acceptance run ID is required.');
      if (!['approved','rejected'].includes(decision)) throw new HttpError(400,'Decision must be approved or rejected.');
      const { data, error } = await supabase.rpc('ywi_rpc_signoff_staging_acceptance_run',{
        p_run_id:runId,
        p_actor_profile_id:profile.id,
        p_decision:decision,
        p_note:note || null,
      });
      if (error) throw error;
      const status=await statusPayload(supabase,environmentGuard);
      return Response.json({ ok:true,build:BUILD,schema:status.schema,signoff:data,status },{ headers:corsHeaders });
    }

    throw new HttpError(400,`Unsupported action: ${action || '(blank)'}.`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'admin-staging-acceptance failed.';
    return Response.json({ ok:false,error:message,details:error instanceof HttpError ? error.details : undefined,build:BUILD,minimum_schema:MINIMUM_SCHEMA },{ status,headers:corsHeaders });
  }
});
