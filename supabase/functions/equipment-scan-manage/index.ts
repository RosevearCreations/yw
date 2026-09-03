import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";
import { boundaryAuditFields, resolveModuleWriteBoundary } from "../_shared/module-write-boundaries.ts";

const BUILD = '2026-09-02q';
const SCHEMA = 185;
const ACTION = 'equipment_scan_event';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
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

const clean = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const money = (value: unknown) => {
  const n = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value, 80));
const normalize = (value: unknown) => clean(value, 500).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function getActor(supabase: any, req: Request) {
  const token = clean((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), 5000);
  if (!token) throw new HttpError(401, 'Sign in is required.');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new HttpError(401, 'The signed-in session could not be verified.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,full_name,email,is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.id || profile.is_active === false) throw new HttpError(403, 'An active staff profile is required.');
  return profile;
}

async function audit(supabase: any, profile: any, status: string, requestPayload: Record<string, unknown>, responsePayload: Record<string, unknown> = {}, errorMessage = '') {
  try {
    const boundary = resolveModuleWriteBoundary(ACTION);
    await supabase.from('operation_write_audit_events').insert({
      operation_action: ACTION,
      operation_status: clean(status, 80) || 'captured',
      entity_type: 'equipment_scan_event',
      entity_id: isUuid(responsePayload.scan_id) ? responsePayload.scan_id : null,
      actor_profile_id: profile?.id || null,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: clean(errorMessage, 2000) || null,
      ...boundaryAuditFields(boundary),
    });
  } catch {
    // Audit failure must not replace the primary response, matching operations-manage policy.
  }
}

async function loadItem(supabase: any, itemId: unknown) {
  if (!itemId) return null;
  const { data, error } = await supabase.from('equipment_items')
    .select('id,equipment_master_id,equipment_code,equipment_name,status,condition_status,is_locked_out,asset_tag,serial_number,qr_code_value,barcode_value,current_job_id,current_site_id')
    .eq('id', itemId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadMaster(supabase: any, masterId: unknown) {
  if (!isUuid(masterId)) return null;
  const { data, error } = await supabase.from('equipment_master')
    .select('id,equipment_code,item_name,is_active,equipment_category,manufacturer,model')
    .eq('id', masterId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function resolveEquipmentExact(supabase: any, rawCode: string) {
  const code = clean(rawCode, 180);
  const { data: registryRows, error: registryError } = await supabase.from('equipment_identifier_registry')
    .select('identifier_value,identifier_kind,equipment_item_id,equipment_master_id')
    .eq('identifier_value', code)
    .limit(2);
  if (registryError) throw registryError;

  const { data: masterRows, error: masterError } = await supabase.from('equipment_master')
    .select('id,equipment_code,item_name,is_active,equipment_category,manufacturer,model')
    .eq('equipment_code', code)
    .limit(2);
  if (masterError) throw masterError;

  const registry = registryRows || [];
  const masters = masterRows || [];
  if (registry.length > 1 || masters.length > 1) {
    return { status:'ambiguous', item:null, master:null, identifierKind:null, candidateCount:registry.length + masters.length };
  }

  if (registry.length === 1) {
    const registryRow = registry[0];
    const item = await loadItem(supabase, registryRow.equipment_item_id);
    const master = await loadMaster(supabase, registryRow.equipment_master_id);
    if (!item || !master || item.equipment_master_id !== master.id) {
      return { status:'inconsistent', item:null, master:null, identifierKind:registryRow.identifier_kind, candidateCount:1 };
    }
    const conflictingMaster = masters.find((row: any) => row.id !== master.id);
    if (conflictingMaster) {
      return { status:'ambiguous', item:null, master:null, identifierKind:registryRow.identifier_kind, candidateCount:2 };
    }
    return { status:'resolved', item, master, identifierKind:registryRow.identifier_kind, candidateCount:1 };
  }

  if (masters.length === 1) {
    return { status:'master_only', item:null, master:masters[0], identifierKind:'equipment_code', candidateCount:1 };
  }

  return { status:'unresolved', item:null, master:null, identifierKind:null, candidateCount:0 };
}

async function resolveJob(supabase: any, rawReference: unknown) {
  const reference = clean(rawReference, 180);
  if (!reference) return null;
  if (/^\d+$/.test(reference)) {
    const { data, error } = await supabase.from('jobs').select('id,job_code,job_name,status').eq('id', Number(reference)).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const { data, error } = await supabase.from('jobs').select('id,job_code,job_name,status').eq('job_code', reference).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

function resolutionPayload(scan: any, resolution: any, job: any, replayed = false) {
  return {
    status: scan.resolution_status,
    replayed,
    identifier_kind: resolution?.identifierKind || scan?.metadata?.identifier_kind || null,
    candidate_count: resolution?.candidateCount ?? scan?.metadata?.candidate_count ?? null,
    equipment_item_id: scan.equipment_item_id || null,
    equipment_master_id: scan.equipment_master_id || null,
    equipment_code: resolution?.item?.equipment_code || resolution?.master?.equipment_code || scan.equipment_reference || null,
    equipment_name: resolution?.item?.equipment_name || resolution?.master?.item_name || scan.resolved_equipment_name || null,
    equipment_status: resolution?.item?.status || (resolution?.master ? (resolution.master.is_active ? 'active' : 'inactive') : scan.resolved_equipment_status || null),
    job: job?.job_code || scan.job_reference || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok:false, error:'Use POST.' }, { status:405, headers:corsHeaders });

  let supabase: any = null;
  let profile: any = null;
  let body: Record<string, unknown> = {};
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, 'equipment-scan-manage is not configured.');
    supabase = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false } });
    body = await req.json().catch(() => ({}));

    const action = clean(body.action || ACTION, 80);
    if (action !== ACTION) throw new HttpError(400, `Unsupported action: ${action || '(blank)'}.`);

    profile = await getActor(supabase, req);
    const boundary = resolveModuleWriteBoundary(ACTION);
    if (!boundary || boundary.ownerModule !== 'jobs' || boundary.minimum !== 'create' || boundary.mode !== 'write') {
      throw new HttpError(500, 'The equipment scan write-boundary contract is not available.');
    }
    if (!(await hasModuleAccess(supabase, profile, boundary.ownerModule, boundary.minimum))) {
      throw new HttpError(403, 'Jobs module create access is required for equipment scanning.', {
        module_key:'jobs', required_access:'create'
      });
    }

    const scanCode = clean(body.scan_code || body.equipment_reference, 180);
    if (!scanCode) throw new HttpError(400, 'Scan code or equipment reference is required.');

    const idempotencyKey = clean(req.headers.get('x-idempotency-key') || body.idempotency_key, 180) || `equipment-scan-${crypto.randomUUID()}`;
    const job = await resolveJob(supabase, body.job_reference);
    let resolution: any = null;
    let scan: any = null;
    let replayed = false;

    const { data: existingScan, error: existingError } = await supabase.from('equipment_scan_events')
      .select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existingError) throw existingError;

    if (existingScan) {
      scan = existingScan;
      replayed = true;
      const item = await loadItem(supabase, scan.equipment_item_id);
      const master = await loadMaster(supabase, scan.equipment_master_id);
      resolution = {
        status:scan.resolution_status,
        item,
        master,
        identifierKind:scan?.metadata?.identifier_kind || null,
        candidateCount:scan?.metadata?.candidate_count ?? null,
      };
    } else {
      resolution = await resolveEquipmentExact(supabase, scanCode);
      const resolved = resolution.status === 'resolved';
      const masterOnly = resolution.status === 'master_only';
      const scanStatus = resolved ? 'captured' : 'needs_review';
      const resolvedName = resolution.item?.equipment_name || resolution.master?.item_name || null;
      const resolvedStatus = resolution.item?.status || (resolution.master ? (resolution.master.is_active ? 'active' : 'inactive') : null);
      const scanRow = {
        scan_code:scanCode,
        scan_source:clean(body.scan_source || 'manual', 80) || 'manual',
        scan_stage:clean(body.scan_stage || 'field_check', 80) || 'field_check',
        scan_status:scanStatus,
        equipment_reference:resolution.item?.equipment_code || resolution.master?.equipment_code || scanCode,
        equipment_item_id:resolved ? resolution.item.id : null,
        equipment_master_id:(resolved || masterOnly) ? resolution.master?.id || null : null,
        resolution_status:resolution.status,
        resolved_equipment_name:resolvedName,
        resolved_equipment_status:resolvedStatus,
        job_reference:job?.job_code || clean(body.job_reference,180) || null,
        actor_profile_id:profile.id,
        location_hint:clean(body.location_hint,240) || null,
        notes:clean(body.notes,1000) || null,
        idempotency_key:idempotencyKey,
        metadata:{
          build:BUILD, schema:SCHEMA, source:'equipment-scan-manage',
          identifier_kind:resolution.identifierKind,
          candidate_count:resolution.candidateCount,
          raw_input_trusted:false,
          exact_server_resolution:true,
        },
      };
      const { data, error } = await supabase.from('equipment_scan_events').insert(scanRow).select('*').single();
      if (error) {
        if (error.code === '23505') {
          const { data: raced } = await supabase.from('equipment_scan_events').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
          if (!raced) throw error;
          scan = raced;
          replayed = true;
        } else {
          throw error;
        }
      } else {
        scan = data;
      }
    }

    const conditionSummary = clean(body.condition_summary, 1000);
    const serviceRequired = body.service_required === true || ['failed','damaged','service required','repair'].some((word) => normalize(conditionSummary).includes(word));
    const costRecoveryRequired = body.cost_recovery_required === true;
    const custodyStatus = scan.resolution_status === 'resolved' ? 'captured' : 'needs_review';

    let { data: custody, error: custodyReadError } = await supabase.from('equipment_custody_timeline_events')
      .select('*').eq('scan_event_id', scan.id).maybeSingle();
    if (custodyReadError) throw custodyReadError;

    if (!custody) {
      const custodyRow = {
        equipment_reference:scan.equipment_reference || scan.scan_code,
        equipment_item_id:scan.equipment_item_id || null,
        equipment_master_id:scan.equipment_master_id || null,
        job_id:job?.id || null,
        custody_stage:clean(body.custody_stage || body.scan_stage || 'field_check',80) || 'field_check',
        custody_status:custodyStatus,
        job_reference:job?.job_code || scan.job_reference || null,
        condition_summary:conditionSummary || null,
        accessory_summary:clean(body.accessory_summary,1000) || null,
        signer_name:clean(body.signer_name,180) || null,
        actor_profile_id:profile.id,
        scan_event_id:scan.id,
        service_required:serviceRequired,
        cost_recovery_required:costRecoveryRequired,
        notes:clean(body.notes,1000) || null,
        idempotency_key:idempotencyKey,
        metadata:{
          build:BUILD, schema:SCHEMA, source:'equipment-scan-manage',
          scan_source:scan.scan_source,
          resolution_status:scan.resolution_status,
          raw_input_trusted:false,
        },
      };
      const inserted = await supabase.from('equipment_custody_timeline_events').insert(custodyRow).select('*').single();
      if (inserted.error) {
        if (inserted.error.code !== '23505') throw inserted.error;
        const { data: racedCustody, error: racedError } = await supabase.from('equipment_custody_timeline_events').select('*').eq('scan_event_id',scan.id).maybeSingle();
        if (racedError || !racedCustody) throw inserted.error;
        custody = racedCustody;
      } else {
        custody = inserted.data;
      }
    }

    let serviceTask: any = null;
    if (serviceRequired && scan.equipment_item_id) {
      if (custody.service_task_id) {
        const existingTask = await supabase.from('equipment_service_tasks').select('*').eq('id',custody.service_task_id).maybeSingle();
        if (existingTask.error) throw existingTask.error;
        serviceTask = existingTask.data || null;
      }
      if (!serviceTask) {
        const taskTypeInput = clean(body.task_type || (clean(body.scan_stage) === 'site_arrival' ? 'arrival_test_followup' : 'return_test_followup'),80);
        const allowedTaskTypes = ['arrival_test_followup','return_test_followup','repair','cleaning','inspection','replacement','accessory_missing','custom'];
        const taskType = allowedTaskTypes.includes(taskTypeInput) ? taskTypeInput : 'return_test_followup';
        const { data, error } = await supabase.from('equipment_service_tasks').insert({
          equipment_item_id:scan.equipment_item_id,
          job_id:job?.id || null,
          task_type:taskType,
          task_status:'open',
          priority:clean(body.priority || 'high',40) || 'high',
          failure_reason:conditionSummary || clean(body.notes,1000) || 'Failed custody/return inspection.',
          estimated_cost:money(body.estimated_cost),
          assigned_to_profile_id:isUuid(body.assigned_to_profile_id) ? body.assigned_to_profile_id : null,
          due_at:clean(body.service_due_at,80) || null,
          notes:`Created from equipment scan ${scan.id}. ${clean(body.notes,700)}`.trim(),
          created_by_profile_id:profile.id,
        }).select('*').single();
        if (error) throw error;
        serviceTask = data;
        await supabase.from('equipment_custody_timeline_events').update({ service_task_id:serviceTask.id }).eq('id',custody.id);
        custody.service_task_id = serviceTask.id;
      }
      await supabase.from('equipment_items').update({
        status:'maintenance', defect_status:'open', defect_notes:conditionSummary || clean(body.notes,1000),
        is_locked_out:true, locked_out_at:nowIso(), locked_out_by_profile_id:profile.id,
        lockout_reason:'Failed custody/return inspection', updated_at:nowIso()
      }).eq('id',scan.equipment_item_id);
    }

    let recovery: any = null;
    if (costRecoveryRequired || serviceTask) {
      const existingRecovery = await supabase.from('equipment_cost_recovery_actions').select('*').eq('custody_event_id',custody.id).limit(1).maybeSingle();
      if (existingRecovery.error) throw existingRecovery.error;
      recovery = existingRecovery.data || null;
      if (!recovery) {
        const estimatedCost = money(body.estimated_cost || serviceTask?.estimated_cost);
        const created = await supabase.from('equipment_cost_recovery_actions').insert({
          custody_event_id:custody.id,
          service_task_id:serviceTask?.id || null,
          equipment_item_id:scan.equipment_item_id || null,
          equipment_master_id:scan.equipment_master_id || null,
          job_id:job?.id || null,
          action_status:'review', recovery_decision:'pending',
          estimated_cost:estimatedCost,
          recoverable_amount:body.customer_billable === true ? estimatedCost : 0,
          customer_billable:body.customer_billable === true,
          created_by_profile_id:profile.id,
        }).select('*').single();
        if (created.error) throw created.error;
        recovery = created.data;
        await supabase.from('equipment_custody_timeline_events').update({ cost_recovery_action_id:recovery.id }).eq('id',custody.id);
        custody.cost_recovery_action_id = recovery.id;
      }
    }

    const resolutionOut = resolutionPayload(scan,resolution,job,replayed);
    await audit(supabase,profile,replayed ? 'replayed' : scan.resolution_status,{
      action:ACTION, scan_source:scan.scan_source, scan_stage:scan.scan_stage,
      idempotency_key:idempotencyKey, raw_code_length:scanCode.length,
    },{
      scan_id:scan.id, custody_id:custody.id, resolution_status:scan.resolution_status,
      service_task_id:serviceTask?.id || null, cost_recovery_action_id:recovery?.id || null,
      replayed,
    });

    return Response.json({
      ok:true, build:BUILD, schema:SCHEMA, idempotency_key:idempotencyKey, replayed,
      scan, custody, resolution:resolutionOut, service_task:serviceTask, cost_recovery:recovery,
    }, { headers:corsHeaders });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'equipment-scan-manage failed.';
    if (supabase) await audit(supabase,profile,'error',{
      action:ACTION,
      scan_source:clean(body.scan_source,80) || null,
      raw_code_length:clean(body.scan_code || body.equipment_reference,180).length,
    },{},message);
    return Response.json({
      ok:false, error:message, details:error instanceof HttpError ? error.details : undefined,
      build:BUILD, schema:SCHEMA,
    }, { status, headers:corsHeaders });
  }
});
