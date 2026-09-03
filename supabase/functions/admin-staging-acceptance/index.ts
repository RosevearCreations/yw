import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const BUILD = '2026-09-03a';
const SCHEMA = 187;

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

async function statusPayload(supabase: any) {
  const [
    { data: rows, error: rowsError },
    { data: securityAssertions, error: securityError },
    { data: catalogAssertions, error: catalogError },
    { data: scenarioPlan, error: scenarioError },
    { data: recentRuns, error: runsError },
  ] = await Promise.all([
    supabase.from('v_it_staging_acceptance_status').select('*').order('sort_order',{ ascending:true }),
    supabase.rpc('ywi_staging_acceptance_security_assertions'),
    supabase.rpc('ywi_staging_acceptance_catalog_assertions'),
    supabase.from('v_it_staging_acceptance_scenario_plan').select('*').order('rail_key',{ascending:true}).order('case_sort_order',{ascending:true}),
    supabase.from('operations_staging_test_runs')
      .select('id,run_key,target_rail_key,suite_name,run_status,source_sha,source_workflow_run_id,schema_version,fixture_set_id,human_signoff_required,human_signoff_status,human_signoff_by_profile_id,human_signoff_at,started_at,finished_at,evidence_note')
      .eq('acceptance_class','staging_acceptance')
      .order('started_at',{ ascending:false })
      .limit(20),
  ]);
  if (rowsError) throw rowsError;
  if (securityError) throw securityError;
  if (catalogError) throw catalogError;
  if (scenarioError) throw scenarioError;
  if (runsError) throw runsError;

  const securityRows = securityAssertions || [];
  const catalogRows = catalogAssertions || [];
  const failedAssertions = [...securityRows,...catalogRows].filter((row:any) => String(row?.assertion_status || '').toLowerCase() !== 'passed');
  const acceptanceRows = rows || [];
  const scenarios = scenarioPlan || [];
  return {
    ok: failedAssertions.length === 0,
    build:BUILD,
    schema:SCHEMA,
    summary:{
      rail_count:acceptanceRows.length,
      scenario_count:scenarios.length,
      accepted_count:acceptanceRows.filter((row:any)=>row?.acceptance_complete === true).length,
      awaiting_human_count:acceptanceRows.filter((row:any)=>row?.staging_acceptance_status === 'awaiting_human_signoff').length,
      pending_evidence_count:scenarios.filter((row:any)=>row?.evidence_status === 'pending_evidence').length,
      human_action_count:scenarios.filter((row:any)=>row?.human_action_required === true).length,
      failed_count:acceptanceRows.filter((row:any)=>['failed','rejected','stale_schema'].includes(String(row?.staging_acceptance_status || ''))).length,
      assertion_failures:failedAssertions.length,
      business_rail_auto_close:false,
    },
    staging_acceptance:acceptanceRows,
    scenario_plan:scenarios,
    security_assertions:securityRows,
    catalog_assertions:catalogRows,
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
    const body = await req.json().catch(()=>({}));
    const action = clean(body?.action || 'status',80).toLowerCase();

    if (action === 'status') {
      return Response.json(await statusPayload(supabase),{ headers:corsHeaders });
    }

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
        p_details:{ human_evidence:true, recorded_from:'admin-staging-acceptance' },
      });
      if (error) throw error;
      return Response.json({ ok:true,build:BUILD,schema:SCHEMA,case_result:data,status:await statusPayload(supabase) },{ headers:corsHeaders });
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
      return Response.json({ ok:true,build:BUILD,schema:SCHEMA,finalize:data,status:await statusPayload(supabase) },{ headers:corsHeaders });
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
      return Response.json({ ok:true,build:BUILD,schema:SCHEMA,signoff:data,status:await statusPayload(supabase) },{ headers:corsHeaders });
    }

    throw new HttpError(400,`Unsupported action: ${action || '(blank)'}.`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'admin-staging-acceptance failed.';
    return Response.json({ ok:false,error:message,details:error instanceof HttpError ? error.details : undefined,build:BUILD,schema:SCHEMA },{ status,headers:corsHeaders });
  }
});
