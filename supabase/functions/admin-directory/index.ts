// Detailed Edge Function: admin-directory
// Purpose:
// - self scope: current employee profile only
// - crew scope: direct reports based on profile hierarchy and assignment reporting lines
// - all/users/sites/assignments/notifications scopes for admin/senior directory
// - operation/accounting backbone lists for admin managers

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeRole(role?: string | null) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'worker' || clean === 'staff') return 'employee';
  return clean || 'employee';
}

function roleRank(role: string) {
  return { employee:10, worker:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[normalizeRole(role)] ?? 0;
}

function effectiveRole(profile: any, user: any) {
  const direct = normalizeRole(profile?.role);
  const tier = normalizeRole(profile?.staff_tier || user?.user_metadata?.staff_tier);
  const meta = normalizeRole(user?.user_metadata?.role || user?.app_metadata?.role);
  if (direct === 'admin' || tier === 'admin' || meta === 'admin') return 'admin';
  if (direct === 'supervisor' || tier === 'supervisor' || meta === 'supervisor') return 'supervisor';
  return direct || tier || meta || 'employee';
}

function moduleRequirementForScope(scope: string): { moduleKey: 'safety'|'finance'|'jobs'|'admin'; minimum: 'view'|'create'|'approve'|'manage' } | null {
  const key = String(scope || '').trim().toLowerCase();
  if (['reporting','evidence'].includes(key)) return { moduleKey: 'safety', minimum: key === 'evidence' ? 'approve' : 'view' };
  if (['accounting','accounting_close','banking','tax_payroll','orders','accounting_backbone'].includes(key)) return { moduleKey: 'finance', minimum: 'view' };
  if (['crew','change_orders_extras','quality_control','seasonal_operations'].includes(key)) return { moduleKey: 'jobs', minimum: 'view' };
  if (key === 'owner_management_command') return { moduleKey: 'admin', minimum: 'manage' };
  if (['module_permissions','workforce','timekeeping','performance','onboarding'].includes(key)) return { moduleKey: 'admin', minimum: 'manage' };
  if (['all','users','people','sites','assignments','notifications','operations','crm','routing','workability','material_estimator','command_center','saved_views_search','health'].includes(key)) return { moduleKey: 'admin', minimum: 'view' };
  return null;
}

async function safeList(supabase: any, table: string, columns = '*', orderColumn?: string, limit = 200, ascending = true) {
  try {
    let q = supabase.from(table).select(columns).limit(limit);
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

type SourceReadEvidence = {
  rows:any[];
  query_ok:boolean;
  retrieved_at:string;
  row_count:number;
  limit:number;
};

async function safeListEvidence(supabase: any, table: string, columns = '*', orderColumn?: string, limit = 200, ascending = true): Promise<SourceReadEvidence> {
  const retrieved_at = new Date().toISOString();
  try {
    let q = supabase.from(table).select(columns).limit(limit);
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error } = await q;
    if (error) return { rows:[], query_ok:false, retrieved_at, row_count:0, limit };
    const rows = data || [];
    return { rows, query_ok:true, retrieved_at, row_count:rows.length, limit };
  } catch {
    return { rows:[], query_ok:false, retrieved_at, row_count:0, limit };
  }
}

function latestAuthoritativeUpdate(rows:any[]) {
  const fields = ['updated_at','checked_at','observed_at','recorded_at','changed_at','verified_at','captured_at','created_at'];
  let best = 0;
  let value:string|null = null;
  for (const row of rows || []) {
    for (const field of fields) {
      const raw = row?.[field];
      if (!raw) continue;
      const ms = Date.parse(String(raw));
      if (Number.isFinite(ms) && ms > best) { best = ms; value = new Date(ms).toISOString(); }
    }
  }
  return value;
}

function buildManagementSourceFreshness(
  read:SourceReadEvidence,
  config:{ key:string; module:string; view:string; visible:boolean; stale_after_hours:number }
) {
  const base:any = {
    source_key:config.key,
    source_module:config.module,
    source_view:config.view,
    retrieved_at:read.retrieved_at,
    row_count:read.row_count,
    query_limit:read.limit,
    last_authoritative_update:null,
    stale_after_hours:config.stale_after_hours,
    coverage_state:'unknown',
    freshness_state:'unknown',
    confidence:'unavailable',
    coverage_gap:false,
    reason:''
  };
  if (!config.visible) return { ...base, coverage_state:'hidden', freshness_state:'hidden', reason:'Source module is not visible to this profile.' };
  if (!read.query_ok) return { ...base, coverage_state:'query_failed', freshness_state:'source_error', reason:'Authoritative source query did not complete.' };
  if (!read.row_count) return { ...base, coverage_state:'no_rows', freshness_state:'missing', confidence:'low', reason:'No authoritative source rows were returned; zero is not inferred.' };
  const latest = latestAuthoritativeUpdate(read.rows);
  const capped = read.row_count >= read.limit;
  if (!latest) return {
    ...base,last_authoritative_update:null,coverage_state:capped?'possibly_capped':'within_query_limit',
    coverage_gap:capped,freshness_state:'timestamp_unavailable',confidence:'medium',
    reason:capped?'Rows were returned at the query limit, but no authoritative freshness timestamp is exposed.':'Rows were returned, but no authoritative freshness timestamp is exposed.'
  };
  const ageHours = Math.max(0,(Date.now()-Date.parse(latest))/3600000);
  const stale = ageHours > config.stale_after_hours;
  return {
    ...base,last_authoritative_update:latest,age_hours:Number(ageHours.toFixed(1)),
    coverage_state:capped?'possibly_capped':'within_query_limit',coverage_gap:capped,
    freshness_state:stale?'stale':'current',
    confidence:(stale||capped)?'medium':'high',
    reason:stale
      ? `Latest authoritative update is older than the ${config.stale_after_hours}h freshness window.`
      : capped
        ? 'Source is current but the returned rows reached the query limit; coverage may be partial.'
        : 'Source is current and within the configured query limit.'
  };
}

function buildManagementMetricConfidence(sourceFreshness:Record<string,any>, sourceKeys:string[]) {
  const sources = sourceKeys.map((key)=>sourceFreshness[key]).filter(Boolean);
  const blocking = sources.find((s)=>['hidden','source_error'].includes(String(s?.freshness_state||'')));
  const missing = sources.find((s)=>String(s?.freshness_state||'')==='missing');
  const uncertain = sources.find((s)=>['stale','timestamp_unavailable'].includes(String(s?.freshness_state||'')) || s?.coverage_gap===true);
  const latest = sources.map((s)=>s?.last_authoritative_update).filter(Boolean).sort().at(-1) || null;
  if (blocking) return { source_keys:sourceKeys, state:'unavailable', confidence:'unavailable', last_authoritative_update:latest, reason:blocking.reason };
  if (missing) return { source_keys:sourceKeys, state:'missing', confidence:'low', last_authoritative_update:latest, reason:missing.reason };
  if (uncertain) return { source_keys:sourceKeys, state:String(uncertain.freshness_state||'uncertain'), confidence:'medium', last_authoritative_update:latest, reason:uncertain.reason };
  return { source_keys:sourceKeys, state:'current', confidence:'high', last_authoritative_update:latest, reason:'All required authoritative sources are current and within their configured query limits.' };
}

function ontarioDateKey(value:unknown) {
  if (!value) return null;
  const raw=String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date=new Date(raw);
  if (!Number.isFinite(date.valueOf())) return null;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(type:string)=>parts.find((part)=>part.type===type)?.value;
  const year=get('year'),month=get('month'),day=get('day');
  return year&&month&&day ? `${year}-${month}-${day}` : date.toISOString().slice(0,10);
}

function addCalendarDays(dateKey:string, days:number) {
  const [y,m,d]=dateKey.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d+days,12,0,0));
  return date.toISOString().slice(0,10);
}

function minutesBetween(start:unknown,end:unknown) {
  const a=new Date(String(start||'')).valueOf(),b=new Date(String(end||'')).valueOf();
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a) return 0;
  return Math.max(0,Math.round((b-a)/60000));
}

function forecastSeason(row:any) {
  const explicit=String(row?.season_context||row?.season||'').toLowerCase();
  if(['spring_summer','fall','winter','four_season'].includes(explicit)) return explicit;
  const source=[row?.service_program_type,row?.service_name,row?.work_type,row?.job_name,row?.route_name,row?.label,row?.category,row?.detail].filter(Boolean).join(' ').toLowerCase();
  if(/snow|storm|ice|winter/.test(source)) return 'winter';
  if(/fall|leaf|autumn/.test(source)) return 'fall';
  if(/mow|lawn|landscap|garden|hedge|shrub|spring|aerat|fertiliz/.test(source)) return 'spring_summer';
  return 'four_season';
}

function buildFourSeasonCapacityForecast(input:{
  dispatch:any[];visits:any[];crews:any[];equipment:any[];workability:any[];storms:any[];stormRoutes:any[];seasonalWork:any[];
}) {
  const today=ontarioDateKey(new Date())!;
  const crews=(input.crews||[]).filter((row)=>!['inactive','ended','archived'].includes(String(row?.crew_status||'').toLowerCase()));
  const readyEquipment=(input.equipment||[]).filter((row)=>String(row?.registry_readiness_status||'ready').toLowerCase()==='ready' && row?.is_locked_out!==true);
  const equipmentAttention=(input.equipment||[]).filter((row)=>String(row?.registry_readiness_status||'ready').toLowerCase()!=='ready' || row?.is_locked_out===true);
  const days:any[]=[];
  for(let offset=0;offset<14;offset++){
    const date=addCalendarDays(today,offset);
    const dispatch=(input.dispatch||[]).filter((row)=>ontarioDateKey(row?.scheduled_start||row?.service_date)===date && !['cancelled','superseded','completed'].includes(String(row?.schedule_status||'').toLowerCase()));
    const visits=(input.visits||[]).filter((row)=>String(row?.service_date||'').slice(0,10)===date && !['skipped','cancelled','held','completed'].includes(String(row?.visit_status||'').toLowerCase()));
    const workability=(input.workability||[]).filter((row)=>String(row?.service_date||ontarioDateKey(row?.scheduled_start)||'').slice(0,10)===date);
    const storms=(input.storms||[]).filter((row)=>ontarioDateKey(row?.planned_start)===date || ontarioDateKey(row?.planned_end)===date);
    const stormRoutes=(input.stormRoutes||[]).filter((row)=>{
      const start=ontarioDateKey(row?.planned_start),end=ontarioDateKey(row?.planned_end);
      return (start&&start<=date)&&(!end||end>=date) && !['completed','cancelled','closed'].includes(String(row?.activation_status||row?.route_status||'').toLowerCase());
    });
    const seasonalDue=(input.seasonalWork||[]).filter((row)=>String(row?.due_date||'').slice(0,10)===date);
    const activeCrews=crews.filter((row)=>{
      const start=String(row?.active_from||'').slice(0,10),end=String(row?.active_until||'').slice(0,10);
      const seasonal=String(row?.seasonal_status||'').toLowerCase();
      return (!start||start<=date)&&(!end||end>=date)&&!['inactive','unavailable','ended'].includes(seasonal);
    });
    const scheduledCrewIds=new Set(dispatch.map((row)=>row?.crew_id).filter(Boolean).map(String));
    const requiredEquipmentIds=new Set<string>();
    for(const row of dispatch){
      for(const value of [row?.assigned_truck_equipment_item_id,row?.assigned_trailer_equipment_item_id]) if(value!=null&&String(value)) requiredEquipmentIds.add(String(value));
      const extra=Array.isArray(row?.assigned_equipment_item_ids) ? row.assigned_equipment_item_ids : [];
      for(const value of extra) if(value!=null&&String(value)) requiredEquipmentIds.add(String(value));
    }
    const requiredEquipment=(input.equipment||[]).filter((row)=>requiredEquipmentIds.has(String(row?.id)));
    const requiredEquipmentAttention=requiredEquipment.filter((row)=>String(row?.registry_readiness_status||'ready').toLowerCase()!=='ready' || row?.is_locked_out===true);
    const requiredEquipmentReady=requiredEquipment.filter((row)=>String(row?.registry_readiness_status||'ready').toLowerCase()==='ready' && row?.is_locked_out!==true);
    const unassignedDispatch=dispatch.filter((row)=>!row?.crew_id);
    const dispatchMinutes=dispatch.reduce((sum,row)=>sum+Math.max(0,Number(row?.estimated_duration_minutes||0)||minutesBetween(row?.scheduled_start,row?.scheduled_end))+Math.max(0,Number(row?.travel_allowance_minutes||0)),0);
    const recurringMinutes=visits.reduce((sum,row)=>sum+Math.max(0,Number(row?.visit_estimated_minutes||0))+Math.max(0,Number(row?.default_travel_allowance_minutes||0)),0);
    const conflicts=dispatch.filter((row)=>Number(row?.conflict_count||0)>0 && !String(row?.conflict_override_note||'').trim());
    const blocked=workability.filter((row)=>['blocked','postpone','reschedule'].includes(String(row?.decision_workability_state||row?.workability_state||row?.decision_state||'').toLowerCase()) || String(row?.workability_queue_status||'').toLowerCase()==='decision_required' && Number(row?.restriction_guidance_count||0)>0);
    const review=workability.filter((row)=>!blocked.includes(row) && (['caution','delayed','review'].includes(String(row?.decision_workability_state||row?.workability_state||'').toLowerCase()) || ['decision_required','notification_review','operator_dispatch_required'].includes(String(row?.workability_queue_status||'').toLowerCase())));
    const seasons={spring_summer:0,fall:0,winter:0,four_season:0};
    for(const row of [...dispatch,...visits,...seasonalDue,...storms,...stormRoutes]) seasons[forecastSeason(row)]++;
    const readiness=blocked.length?'blocked':conflicts.length||unassignedDispatch.length||requiredEquipmentAttention.length?'attention':review.length?'review':'ready';
    const reasons:string[]=[];
    if(blocked.length) reasons.push(`${blocked.length} workability restriction/block signal(s)`);
    if(review.length) reasons.push(`${review.length} workability review signal(s)`);
    if(conflicts.length) reasons.push(`${conflicts.length} unresolved dispatch conflict(s)`);
    if(unassignedDispatch.length) reasons.push(`${unassignedDispatch.length} unassigned dispatch item(s)`);
    if(requiredEquipmentAttention.length) reasons.push(`${requiredEquipmentAttention.length} assigned equipment readiness attention item(s)`);
    if(!reasons.length) reasons.push('No loaded blocker signal for this date');
    days.push({
      date,horizon_day:offset+1,readiness_state:readiness,readiness_reason:reasons.join(' · '),
      dispatch_count:dispatch.length,recurring_visit_count:visits.length,total_planned_items:dispatch.length+visits.length,
      recorded_demand_minutes:dispatchMinutes+recurringMinutes,
      active_crew_count:activeCrews.length,scheduled_crew_count:scheduledCrewIds.size,unassigned_dispatch_count:unassignedDispatch.length,
      unresolved_dispatch_conflict_count:conflicts.length,required_equipment_count:requiredEquipment.length,ready_equipment_count:requiredEquipmentReady.length,equipment_attention_count:requiredEquipmentAttention.length,fleet_ready_equipment_count:readyEquipment.length,fleet_equipment_attention_count:equipmentAttention.length,
      workability_blocked_count:blocked.length,workability_review_count:review.length,storm_event_count:storms.length,storm_route_count:stormRoutes.length,
      seasonal_due_count:seasonalDue.length,season_load:seasons
    });
  }
  const summarize=(windowDays:number)=>{
    const slice=days.slice(0,windowDays);
    const demand=slice.reduce((sum,row)=>sum+Number(row.recorded_demand_minutes||0),0);
    const planned=slice.reduce((sum,row)=>sum+Number(row.total_planned_items||0),0);
    const blocked=slice.filter((row)=>row.readiness_state==='blocked').length;
    const attention=slice.filter((row)=>row.readiness_state==='attention').length;
    const review=slice.filter((row)=>row.readiness_state==='review').length;
    const peak=[...slice].sort((a,b)=>Number(b.recorded_demand_minutes||0)-Number(a.recorded_demand_minutes||0)||Number(b.total_planned_items||0)-Number(a.total_planned_items||0))[0]||null;
    return {days:windowDays,planned_items:planned,recorded_demand_minutes:demand,blocked_days:blocked,attention_days:attention,review_days:review,ready_days:windowDays-blocked-attention-review,peak_date:peak?.date||null,peak_recorded_demand_minutes:Number(peak?.recorded_demand_minutes||0)};
  };
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',days,
    windows:{seven_day:summarize(7),fourteen_day:summarize(14)},
    capacity_method:'Evidence-only forecast: planned work, assigned crews, recorded durations, equipment readiness, stored workability evidence and seasonal operations. No jobs-per-crew target or external weather forecast is assumed.',
    weather_boundary:'Uses stored YW workability observations/rules and seasonal evidence only; no external weather provider is queried.',
    authority_boundary:'Advisory only. Forecasting does not dispatch crews, rewrite routes, change workability decisions, unlock equipment, send messages or mutate provider state.'
  };
}

async function safeListWhere(supabase: any, table: string, columns = '*', filters: Array<[string, any]> = [], orderColumn?: string, limit = 200, ascending = true) {
  try {
    let q = supabase.from(table).select(columns).limit(limit);
    for (const [column, value] of filters) q = q.eq(column, value);
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function clampInt(value: unknown, fallback: number, min = 1, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function sanitizeIlikeTerm(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[%,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function allowSort(value: unknown, fallback: string, allowed: string[]) {
  const clean = String(value || '').trim().toLowerCase();
  return allowed.includes(clean) ? clean : fallback;
}

function normalizeDirection(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
}

function compareNullable(a: any, b: any, direction = 'asc') {
  const left = a == null ? '' : String(a).toLowerCase();
  const right = b == null ? '' : String(b).toLowerCase();
  const result = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

async function safeListPaged(supabase: any, table: string, options: Record<string, any> = {}) {
  const columns = options.columns || '*';
  const orderColumn = options.orderColumn;
  const ascending = options.ascending !== false;
  const page = clampInt(options.page, 1, 1, 10000);
  const pageSize = clampInt(options.pageSize, 25, 1, 200);
  const offset = (page - 1) * pageSize;
  const searchTerm = sanitizeIlikeTerm(options.search);
  const searchColumns = Array.isArray(options.searchColumns) ? options.searchColumns.filter(Boolean) : [];
  try {
    let q = supabase.from(table).select(columns, { count: 'exact' });
    if (searchTerm && searchColumns.length) {
      const pattern = `*${searchTerm}*`;
      q = q.or(searchColumns.map((column: string) => `${column}.ilike.${pattern}`).join(','));
    }
    if (orderColumn) q = q.order(orderColumn, { ascending });
    const { data, error, count } = await q.range(offset, offset + pageSize - 1);
    if (error) {
      return { rows: [], meta: { page, page_size: pageSize, total: 0, total_pages: 1, loaded: 0, error: error.message || 'Query failed.' } };
    }
    const total = Number.isFinite(Number(count)) ? Number(count) : (Array.isArray(data) ? data.length : 0);
    return {
      rows: data || [],
      meta: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
        loaded: Array.isArray(data) ? data.length : 0,
        search: searchTerm,
        order_column: orderColumn || null,
        ascending
      }
    };
  } catch (err) {
    return { rows: [], meta: { page, page_size: pageSize, total: 0, total_pages: 1, loaded: 0, error: String((err as any)?.message || err || 'Query failed.') } };
  }
}

function mergeRowsById(baseRows: any[], extraRows: any[]) {
  const map = new Map<string, any>();
  for (const row of Array.isArray(baseRows) ? baseRows : []) {
    if (!row?.id) continue;
    map.set(String(row.id), { ...row });
  }
  for (const row of Array.isArray(extraRows) ? extraRows : []) {
    if (!row?.id) continue;
    const key = String(row.id);
    map.set(key, { ...(map.get(key) || {}), ...row });
  }
  return Array.from(map.values());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  const actorRole = effectiveRole(actorProfile, userData.user);
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  const scope = body.scope || body.mode || 'all';
  const search = String(body.search || '').trim().toLowerCase();
  const peopleSearch = String(body.people_search ?? body.search ?? '').trim().toLowerCase();
  const roleFilter = String(body.role_filter || body.profile_role || '').trim().toLowerCase();
  const peopleSort = allowSort(body.people_sort, 'full_name', ['full_name','email','role','employment_status','last_login_at','created_at','updated_at']);
  const peopleSortDir = normalizeDirection(body.people_sort_dir);
  const jobsSort = allowSort(body.jobs_sort, 'job_code', ['job_code','job_name','status','priority','start_date','end_date','updated_at','created_at']);
  const jobsSortDir = normalizeDirection(body.jobs_sort_dir);
  const limit = clampInt(body.limit, 200, 1, 500);
  const peoplePage = clampInt(body.people_page ?? body.page, 1, 1, 10000);
  const peoplePageSize = clampInt(body.people_page_size ?? body.page_size, Math.min(limit, 50), 1, 200);
  const jobsPage = clampInt(body.jobs_page, 1, 1, 10000);
  const jobsPageSize = clampInt(body.jobs_page_size, Math.min(limit, 50), 1, 200);
  const jobsSearch = String(body.jobs_search || '').trim().toLowerCase();


  const moduleRequirement = moduleRequirementForScope(scope);
  if (moduleRequirement && !(await hasModuleAccess(supabase, actorProfile, moduleRequirement.moduleKey, moduleRequirement.minimum))) {
    return Response.json({
      ok:false,
      error:`${moduleRequirement.moduleKey} module ${moduleRequirement.minimum} access is required.`,
      module_key:moduleRequirement.moduleKey,
      required_access:moduleRequirement.minimum
    }, { status:403, headers:corsHeaders });
  }

  if (scope === 'activity_timeline') {
    const [timeline, canSafety, canFinance, canJobs, canAdmin] = await Promise.all([
      safeList(supabase, 'v_universal_activity_audit_timeline', '*', 'occurred_at', limit, false),
      hasModuleAccess(supabase, actorProfile, 'safety', 'view'),
      hasModuleAccess(supabase, actorProfile, 'finance', 'view'),
      hasModuleAccess(supabase, actorProfile, 'jobs', 'view'),
      hasModuleAccess(supabase, actorProfile, 'admin', 'view'),
    ]);
    const sourceVisibility: Record<string, boolean> = { safety:canSafety, finance:canFinance, jobs:canJobs, admin:canAdmin };
    if (!Object.values(sourceVisibility).some(Boolean)) {
      return Response.json({ ok:false, error:'At least one module view permission is required for the activity timeline.' }, { status:403, headers:corsHeaders });
    }
    const visibleTimeline = (timeline || []).filter((row:any) => sourceVisibility[String(row?.source_module || 'admin')] === true);
    return Response.json({
      ok:true, scope:'activity_timeline', actor_role:actorRole,
      activity_timeline:visibleTimeline,
      source_visibility:sourceVisibility,
      authority_boundary:'Read-only evidence timeline. Source modules remain authoritative; raw request and response payloads are intentionally not exposed.'
    }, { headers:corsHeaders });
  }

  if (scope === 'module_permissions') {
    if (normalizeRole(actorRole) !== 'admin') {
      return Response.json({ ok:false, error:'Admin role is required to manage module permissions.' }, { status:403, headers:corsHeaders });
    }
    const [modules, profiles, roleDefaults, overrides, audit] = await Promise.all([
      safeList(supabase, 'app_modules', '*', 'sort_order', 20, true),
      safeList(supabase, 'profiles', 'id,full_name,email,role,is_active,employment_status,updated_at', 'full_name', 500, true),
      safeList(supabase, 'app_role_module_permissions', '*', 'role', 100, true),
      safeList(supabase, 'app_profile_module_permissions', '*', 'updated_at', 1000, false),
      safeList(supabase, 'app_module_permission_audit', '*', 'created_at', 250, false),
    ]);
    return Response.json({
      ok:true, scope:'module_permissions', actor_role:actorRole,
      app_modules:modules,
      module_permission_profiles:(profiles || []).filter((row:any) => row?.is_active !== false),
      module_role_defaults:roleDefaults,
      module_permission_overrides:overrides,
      module_permission_audit:audit
    }, { headers:corsHeaders });
  }

function buildRouteCrewEfficiencyEvidence(input:{
  dispatch:any[];production:any[];timekeeping:any[];workability:any[];routes:any[];
}) {
  const today=ontarioDateKey(new Date())!;
  const cutoff=addCalendarDays(today,-90);
  const routeById=new Map<string,any>();
  for(const row of input.routes||[]) if(row?.route_id) routeById.set(String(row.route_id),row);

  const productionByDispatch=new Map<string,any[]>();
  for(const row of input.production||[]){
    const id=row?.dispatch_schedule_item_id;
    if(!id) continue;
    const key=String(id),list=productionByDispatch.get(key)||[];
    list.push(row);productionByDispatch.set(key,list);
  }

  const timeBySession=new Map<string,any[]>();
  for(const row of input.timekeeping||[]){
    const id=row?.job_session_id;
    if(!id) continue;
    const key=String(id),list=timeBySession.get(key)||[];
    list.push(row);timeBySession.set(key,list);
  }

  const workabilityByDispatch=new Map<string,any[]>();
  for(const row of input.workability||[]){
    const id=row?.dispatch_schedule_item_id;
    if(!id) continue;
    const key=String(id),list=workabilityByDispatch.get(key)||[];
    list.push(row);workabilityByDispatch.set(key,list);
  }

  const evidenceRows=(input.dispatch||[])
    .filter((row)=>{
      const date=ontarioDateKey(row?.scheduled_start||row?.service_date);
      return !!date && date>=cutoff && date<=today && !['cancelled','superseded'].includes(String(row?.schedule_status||'').toLowerCase());
    })
    .map((row)=>{
      const dispatchId=String(row?.id||'');
      const sessions=productionByDispatch.get(dispatchId)||[];
      const sessionIds=new Set(sessions.map((s)=>s?.job_session_id).filter(Boolean).map(String));
      const timeEntries=[...sessionIds].flatMap((id)=>timeBySession.get(id)||[]);
      const workability=workabilityByDispatch.get(dispatchId)||[];
      const plannedEstimated=Math.max(0,Number(row?.estimated_duration_minutes||0));
      const scheduledWindow=minutesBetween(row?.scheduled_start,row?.scheduled_end);
      const plannedService=plannedEstimated||scheduledWindow||null;
      const actualDurations=sessions.map((s)=>Number(s?.duration_minutes)).filter((n)=>Number.isFinite(n)&&n>=0);
      const actualService=actualDurations.length ? actualDurations.reduce((sum,n)=>sum+n,0) : null;
      const actualCrewHours=sessions.reduce((sum,s)=>sum+Math.max(0,Number(s?.total_labour_hours||0)),0);
      const travelEntries=timeEntries.map((t)=>Number(t?.travel_minutes)).filter((n)=>Number.isFinite(n)&&n>=0);
      const crewTravelMinutes=travelEntries.length ? travelEntries.reduce((sum,n)=>sum+n,0) : null;
      const delayMinutes=sessions.reduce((sum,s)=>sum+Math.max(0,Number(s?.delay_minutes||0)),0);
      const returnVisit=sessions.some((s)=>s?.return_visit_required===true || String(s?.completion_state||'').toLowerCase()==='return_required');
      const workabilityEffects=workability.filter((w)=>{
        const state=String(w?.decision_workability_state||w?.workability_state||w?.dispatch_workability_state||'').toLowerCase();
        const queue=String(w?.workability_queue_status||'').toLowerCase();
        return ['blocked','postpone','reschedule','caution','delayed','stopped'].includes(state) || ['decision_required','notification_review','operator_dispatch_required'].includes(queue);
      });
      const productionWorkability=sessions.filter((s)=>['blocked','delayed','stopped','caution'].includes(String(s?.workability_status||'').toLowerCase()));
      const actualStarts=sessions.map((s)=>s?.started_at).filter(Boolean).map((v)=>new Date(String(v))).filter((d)=>Number.isFinite(d.valueOf())).sort((a,b)=>a.valueOf()-b.valueOf());
      const actualStartAt=actualStarts[0]?.toISOString()||null;
      const durationVariance=(plannedService!=null&&actualService!=null)?actualService-plannedService:null;
      const frictionReasons:string[]=[];
      if(durationVariance!=null&&durationVariance>0) frictionReasons.push('service duration over planned evidence');
      if(delayMinutes>0) frictionReasons.push('recorded delay');
      if(returnVisit) frictionReasons.push('return visit required');
      if(workabilityEffects.length||productionWorkability.length) frictionReasons.push('workability effect');
      return {
        dispatch_id:row?.id||null,work_order_id:row?.work_order_id||null,job_id:row?.job_id||null,
        service_date:ontarioDateKey(row?.scheduled_start||row?.service_date),
        route_id:row?.route_id||null,route_name:row?.route_name||routeById.get(String(row?.route_id||''))?.route_name||null,
        route_order:Number.isFinite(Number(row?.route_order))&&Number(row.route_order)>0?Number(row.route_order):null,
        actual_route_order:null,
        crew_id:row?.crew_id||null,crew_name:row?.crew_name||null,
        site_name:row?.site_name||null,site_city:row?.site_city||null,season_context:forecastSeason(row),
        planned_service_minutes:plannedService,planned_duration_source:plannedEstimated?'estimated_duration_minutes':scheduledWindow?'scheduled_window':'missing',
        actual_service_minutes:actualService,service_duration_variance_minutes:durationVariance,
        planned_travel_allowance_minutes:Math.max(0,Number(row?.travel_allowance_minutes||0)),
        recorded_crew_travel_minutes:crewTravelMinutes,
        travel_evidence_state:crewTravelMinutes==null?'not_recorded_for_linked_sessions':'recorded_crew_time_not_vehicle_elapsed_time',
        actual_crew_hours:Number(actualCrewHours.toFixed(2)),
        production_session_count:sessions.length,delay_minutes:delayMinutes,return_visit_required:returnVisit,
        workability_effect_count:workabilityEffects.length+productionWorkability.length,
        actual_start_at:actualStartAt,friction_reasons:frictionReasons,friction_signal_count:frictionReasons.length
      };
    });

  const routeDayGroups=new Map<string,any[]>();
  for(const row of evidenceRows){
    if(!row.route_id||!row.service_date) continue;
    const key=String(row.route_id)+'|'+row.service_date,list=routeDayGroups.get(key)||[];
    list.push(row);routeDayGroups.set(key,list);
  }
  for(const rows of routeDayGroups.values()){
    const actual=[...rows].filter((r)=>r.actual_start_at).sort((a,b)=>String(a.actual_start_at).localeCompare(String(b.actual_start_at))||String(a.dispatch_id).localeCompare(String(b.dispatch_id)));
    actual.forEach((row,index)=>{
      row.actual_route_order=index+1;
      if(row.route_order!=null&&row.route_order!==row.actual_route_order){
        row.friction_reasons=[...row.friction_reasons,'route order differed from recorded production sequence'];
        row.friction_signal_count=row.friction_reasons.length;
      }
    });
  }

  const routeDays=[...routeDayGroups.entries()].map(([key,rows])=>{
    const [routeId,date]=key.split('|');
    const route=routeById.get(routeId)||{};
    const plannedService=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.planned_service_minutes||0)),0);
    const plannedTravel=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.planned_travel_allowance_minutes||0)),0);
    const plannedDemand=plannedService+plannedTravel;
    const configuredCapacity=Math.max(0,Number(route?.daily_capacity_minutes||0));
    const capacityHeadroom=configuredCapacity>0?Math.max(0,configuredCapacity-plannedDemand):null;
    const overCapacity=configuredCapacity>0?Math.max(0,plannedDemand-configuredCapacity):null;
    return {
      route_id:routeId,route_name:rows[0]?.route_name||route?.route_name||'Unnamed route',service_date:date,
      season_context:route?.season_context||rows[0]?.season_context||'four_season',
      planned_item_count:rows.length,planned_service_minutes:plannedService,planned_travel_allowance_minutes:plannedTravel,
      planned_demand_minutes:plannedDemand,configured_daily_capacity_minutes:configuredCapacity||null,
      configured_capacity_headroom_minutes:capacityHeadroom,over_configured_capacity_minutes:overCapacity,
      actual_service_minutes:rows.some((r)=>r.actual_service_minutes!=null)?rows.reduce((sum,r)=>sum+Math.max(0,Number(r.actual_service_minutes||0)),0):null,
      actual_crew_hours:Number(rows.reduce((sum,r)=>sum+Math.max(0,Number(r.actual_crew_hours||0)),0).toFixed(2)),
      delay_minutes:rows.reduce((sum,r)=>sum+Math.max(0,Number(r.delay_minutes||0)),0),
      return_visit_count:rows.filter((r)=>r.return_visit_required).length,
      route_order_deviation_count:rows.filter((r)=>r.route_order!=null&&r.actual_route_order!=null&&r.route_order!==r.actual_route_order).length,
      workability_effect_count:rows.reduce((sum,r)=>sum+Number(r.workability_effect_count||0),0),
      friction_item_count:rows.filter((r)=>Number(r.friction_signal_count||0)>0).length
    };
  });

  const routeSummaryMap=new Map<string,any>();
  for(const day of routeDays){
    const key=String(day.route_id),s=routeSummaryMap.get(key)||{
      route_id:day.route_id,route_name:day.route_name,service_days:0,friction_service_dates:new Set<string>(),
      planned_demand_minutes:0,actual_service_minutes:0,actual_service_evidence_days:0,delay_minutes:0,return_visit_count:0,
      route_order_deviation_count:0,workability_effect_count:0,configured_capacity_headroom_minutes:0,capacity_evidence_days:0
    };
    s.service_days++;
    s.planned_demand_minutes+=Number(day.planned_demand_minutes||0);
    if(day.actual_service_minutes!=null){s.actual_service_minutes+=Number(day.actual_service_minutes||0);s.actual_service_evidence_days++}
    s.delay_minutes+=Number(day.delay_minutes||0);s.return_visit_count+=Number(day.return_visit_count||0);
    s.route_order_deviation_count+=Number(day.route_order_deviation_count||0);s.workability_effect_count+=Number(day.workability_effect_count||0);
    if(day.configured_capacity_headroom_minutes!=null){s.configured_capacity_headroom_minutes+=Number(day.configured_capacity_headroom_minutes||0);s.capacity_evidence_days++}
    if(Number(day.friction_item_count||0)>0) s.friction_service_dates.add(String(day.service_date));
    routeSummaryMap.set(key,s);
  }
  const routeSummaries=[...routeSummaryMap.values()].map((s)=>({
    ...s,
    friction_service_date_count:s.friction_service_dates.size,
    repeated_friction:s.friction_service_dates.size>=2,
    friction_service_dates:[...s.friction_service_dates].sort(),
    configured_capacity_headroom_minutes:s.capacity_evidence_days?Number(s.configured_capacity_headroom_minutes):null
  })).map(({friction_service_dates,...s})=>({...s,friction_service_dates})).sort((a,b)=>b.friction_service_date_count-a.friction_service_date_count||String(a.route_name).localeCompare(String(b.route_name)));

  const cityGroups=new Map<string,any[]>();
  for(const row of evidenceRows){
    const city=String(row.site_city||'').trim();
    if(!city||!row.service_date||!row.route_id) continue;
    const key=row.service_date+'|'+city.toLowerCase(),list=cityGroups.get(key)||[];
    list.push(row);cityGroups.set(key,list);
  }
  const clusteringOpportunities=[...cityGroups.entries()].map(([key,rows])=>{
    const routeIds=[...new Set(rows.map((r)=>String(r.route_id)).filter(Boolean))];
    if(routeIds.length<2||rows.length<2) return null;
    const routeNames=[...new Set(rows.map((r)=>String(r.route_name||'Unnamed route')))].sort();
    return {
      service_date:key.split('|')[0],city:rows[0].site_city,planned_item_count:rows.length,route_count:routeIds.length,route_names:routeNames,
      advisory_reason:'Multiple planned stops in the same city are split across routes; review clustering only if service windows, equipment and dispatch authority allow it.'
    };
  }).filter(Boolean).sort((a:any,b:any)=>Number(b.planned_item_count)-Number(a.planned_item_count)||String(a.city).localeCompare(String(b.city)));

  const repeatedRouteFriction=routeSummaries.filter((r)=>r.repeated_friction).slice(0,20);
  const matched=evidenceRows.filter((r)=>r.actual_service_minutes!=null).length;
  const travelCoverage=evidenceRows.filter((r)=>r.recorded_crew_travel_minutes!=null).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',lookback_days:90,
    summary:{
      planned_items:evidenceRows.length,items_with_actual_service_evidence:matched,
      service_duration_overrun_items:evidenceRows.filter((r)=>Number(r.service_duration_variance_minutes||0)>0).length,
      route_order_deviation_items:evidenceRows.filter((r)=>r.route_order!=null&&r.actual_route_order!=null&&r.route_order!==r.actual_route_order).length,
      return_visit_items:evidenceRows.filter((r)=>r.return_visit_required).length,
      recorded_delay_minutes:evidenceRows.reduce((sum,r)=>sum+Number(r.delay_minutes||0),0),
      workability_effect_items:evidenceRows.filter((r)=>Number(r.workability_effect_count||0)>0).length,
      recorded_crew_travel_coverage_items:travelCoverage,
      repeated_route_friction_count:repeatedRouteFriction.length,
      clustering_opportunity_count:clusteringOpportunities.length,
      route_days_with_configured_capacity_headroom:routeDays.filter((r)=>Number(r.configured_capacity_headroom_minutes||0)>0).length
    },
    route_days:routeDays.sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||String(a.route_name).localeCompare(String(b.route_name))).slice(0,60),
    route_summaries:routeSummaries.slice(0,30),
    repeated_route_friction:repeatedRouteFriction,
    clustering_opportunities:clusteringOpportunities.slice(0,20),
    item_evidence:evidenceRows.sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||Number(a.route_order||999)-Number(b.route_order||999)).slice(0,100),
    comparison_boundary:'Service-duration variance uses recorded planned duration versus recorded production duration. Planned travel allowance is shown beside linked crew travel minutes, but no direct travel variance is inferred because crew-time travel is not the same measure as vehicle elapsed travel.',
    clustering_boundary:'Clustering is advisory evidence only. It identifies same-day city overlap across existing routes and never rewrites route membership or stop order.',
    performance_boundary:'Crew and route evidence is operational context only. It does not score, rank or infer individual employee performance.',
    authority_boundary:'Read-only evidence. Routing and dispatch remain the existing operator authorities; Build 354 does not mutate schedules, routes, workability decisions or source records.'
  };
}


function buildRecurringRenewalRetentionWorkbench(input:{
  programs:any[];events:any[];renewals:any[];interactions:any[];profitability:any[];rollovers:any[];financeVisible:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const eventCutoff=addCalendarDays(today,-180);
  const renewalByAgreement=new Map((input.renewals||[]).map((r)=>[String(r?.agreement_id||r?.id||''),r]));
  const profitByAgreement=new Map((input.profitability||[]).map((r)=>[String(r?.id||r?.agreement_id||''),r]));
  const eventMap=new Map<string,any[]>();
  for(const row of input.events||[]){
    const id=String(row?.agreement_id||''); if(!id) continue;
    const date=String(row?.original_service_date||row?.effective_service_date||row?.created_at||'').slice(0,10);
    if(date&&date<eventCutoff) continue;
    const list=eventMap.get(id)||[]; list.push(row); eventMap.set(id,list);
  }
  const interactionMap=new Map<string,any[]>();
  for(const row of input.interactions||[]){
    const id=String(row?.recurring_service_agreement_id||''); if(!id) continue;
    const list=interactionMap.get(id)||[]; list.push(row); interactionMap.set(id,list);
  }
  const rolloverMap=new Map<string,any[]>();
  for(const row of input.rollovers||[]){
    const id=String(row?.recurring_service_agreement_id||''); if(!id) continue;
    const list=rolloverMap.get(id)||[]; list.push(row); rolloverMap.set(id,list);
  }
  const rows=(input.programs||[]).map((p)=>{
    const id=String(p?.id||p?.agreement_id||'');
    const renewal=renewalByAgreement.get(id)||{};
    const events=eventMap.get(id)||[];
    const interactions=interactionMap.get(id)||[];
    const rollovers=rolloverMap.get(id)||[];
    const skipCount=events.filter((e)=>['skip','cancel_visit'].includes(String(e?.event_type||'').toLowerCase())).length;
    const delayCount=events.filter((e)=>String(e?.event_type||'').toLowerCase()==='weather_delay').length;
    const repeatedServiceFriction=(skipCount+delayCount)>=2;
    const openIssues=interactions.filter((i)=>{
      const status=String(i?.interaction_status||'').toLowerCase();
      const complaint=String(i?.complaint_status||'').toLowerCase();
      const type=String(i?.interaction_type||'').toLowerCase();
      return ['open','investigating'].includes(complaint) || (['complaint','service_review'].includes(type) && status==='open');
    });
    const agreementStatus=String(p?.agreement_status||'').toLowerCase();
    const holdUntil=String(p?.customer_hold_until||'').slice(0,10);
    const onHold=agreementStatus==='paused' || (!!p?.customer_hold_reason && (!holdUntil||holdUntil>=today));
    const endDate=String(p?.end_date||'').slice(0,10);
    let renewalStatus=String(renewal?.renewal_status||'');
    if(!renewalStatus){
      if(p?.open_end_date||!endDate) renewalStatus='open_ended';
      else if(endDate<today) renewalStatus='overdue';
      else if(endDate<=addCalendarDays(today,30)) renewalStatus='due_30_days';
      else if(endDate<=addCalendarDays(today,90)) renewalStatus='due_90_days';
      else renewalStatus='future';
    }
    const rolloverOpen=rollovers.filter((r)=>['review','hold','renewal_contact_needed'].includes(String(r?.rollover_state||'').toLowerCase()));
    const profit=input.financeVisible ? profitByAgreement.get(id)||null : null;
    const actualProfit=profit==null?null:Number(profit?.actual_profit_rollup_total);
    const actualMargin=profit==null?null:Number(profit?.actual_margin_percent);
    const plannedCost=Number(p?.visit_cost_total);
    const plannedCharge=Number(p?.visit_charge_total);
    const lossMaking=profit!=null && Number.isFinite(actualProfit) && actualProfit<0;
    const nonPositivePlannedContribution=Number.isFinite(plannedCost)&&Number.isFinite(plannedCharge)&&plannedCharge>0&&plannedCharge<=plannedCost;
    const reasons:string[]=[];
    if(['overdue','due_30_days','due_90_days'].includes(renewalStatus)) reasons.push('renewal window '+renewalStatus.replaceAll('_',' '));
    if(onHold) reasons.push('customer/service hold');
    if(repeatedServiceFriction) reasons.push(skipCount+' skip/cancel + '+delayCount+' delay event(s) in 180d');
    if(openIssues.length) reasons.push(openIssues.length+' unresolved CRM service/complaint issue(s)');
    if(rolloverOpen.length) reasons.push(rolloverOpen.length+' seasonal rollover review item(s)');
    if(lossMaking) reasons.push('recorded agreement profit is negative');
    if(nonPositivePlannedContribution) reasons.push('planned visit charge does not exceed planned visit cost');
    const renewalCandidate=['overdue','due_30_days','due_90_days'].includes(renewalStatus)||rolloverOpen.some((r)=>String(r?.rollover_state||'').toLowerCase()==='renewal_contact_needed');
    const retentionAttention=onHold||repeatedServiceFriction||openIssues.length>0||rolloverOpen.some((r)=>['review','hold'].includes(String(r?.rollover_state||'').toLowerCase()));
    const priceReviewCandidate=lossMaking||nonPositivePlannedContribution;
    const attention=renewalCandidate||retentionAttention||priceReviewCandidate;
    return {
      agreement_id:p?.id||p?.agreement_id||null,agreement_code:p?.agreement_code||null,
      client_name:p?.client_name||null,site_name:p?.site_name||p?.client_site_name||null,site_city:p?.site_city||null,
      service_name:p?.service_name||null,service_program_type:p?.service_program_type||null,
      season_context:forecastSeason(p),agreement_status:p?.agreement_status||null,start_date:p?.start_date||null,end_date:p?.end_date||null,
      open_end_date:p?.open_end_date===true,renewal_status:renewalStatus,next_service_date:p?.next_service_date||null,
      customer_hold_until:p?.customer_hold_until||null,customer_hold_reason:p?.customer_hold_reason||p?.pause_reason||null,
      skip_cancel_180d:skipCount,weather_delay_180d:delayCount,repeated_service_friction:repeatedServiceFriction,
      unresolved_service_issue_count:openIssues.length,seasonal_rollover_review_count:rolloverOpen.length,
      actual_profit_total:profit==null?null:(Number.isFinite(actualProfit)?actualProfit:null),
      actual_margin_percent:profit==null?null:(Number.isFinite(actualMargin)?actualMargin:null),
      finance_evidence_state:input.financeVisible?(profit?'available':'not_recorded'):'not_visible',
      renewal_candidate:renewalCandidate,retention_attention:retentionAttention,price_review_candidate:priceReviewCandidate,
      attention_required:attention,attention_reasons:reasons,
      suggested_next_action:renewalCandidate?'Review renewal context':priceReviewCandidate?'Review pricing and cost evidence':retentionAttention?'Review customer/service history':'No renewal or retention action indicated by loaded evidence',
      action_boundary:'review_only'
    };
  });
  const attention=rows.filter((r)=>r.attention_required).sort((a,b)=>{
    const score=(r:any)=>(r.renewal_status==='overdue'?50:r.renewal_status==='due_30_days'?40:r.renewal_status==='due_90_days'?30:0)+(r.unresolved_service_issue_count>0?20:0)+(r.repeated_service_friction?15:0)+(r.retention_attention?10:0)+(r.price_review_candidate?5:0);
    return score(b)-score(a)||String(a.client_name||a.agreement_code||'').localeCompare(String(b.client_name||b.agreement_code||''));
  });
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',event_lookback_days:180,
    summary:{
      loaded_agreements:rows.length,attention_agreements:attention.length,
      renewal_candidates:rows.filter((r)=>r.renewal_candidate).length,
      retention_attention:rows.filter((r)=>r.retention_attention).length,
      repeated_service_friction:rows.filter((r)=>r.repeated_service_friction).length,
      unresolved_service_issues:rows.reduce((sum,r)=>sum+Number(r.unresolved_service_issue_count||0),0),
      customer_holds:rows.filter((r)=>r.customer_hold_reason||String(r.agreement_status||'').toLowerCase()==='paused').length,
      price_review_candidates:rows.filter((r)=>r.price_review_candidate).length,
      finance_evidence_visible:input.financeVisible
    },
    attention_queue:attention.slice(0,100),agreements:rows.slice(0,250),
    margin_boundary:'Price-review candidates use only negative recorded agreement profit or a planned visit charge that does not exceed the recorded planned visit cost. No target margin or automatic price change is invented.',
    retention_boundary:'Repeated service friction means two or more recorded skip/cancel/weather-delay events in the loaded 180-day history; unresolved issues come from open CRM complaint/service-review evidence linked to the agreement.',
    communication_boundary:'Renewal/contact suggestions are preparation context only. No customer message is sent and no renewal is accepted automatically.',
    pricing_boundary:'Pricing review is advisory only. No agreement price, estimate, invoice or customer commitment is changed.',
    authority_boundary:'Recurring agreements, CRM interactions, seasonal rollover and Finance profitability remain their existing authorities; this workbench is read-only decision support.'
  };
}


function buildEstimateToCashLeakageWorkbench(input:{
  workflows:any[];dispatch:any[];production:any[];changeOrders:any[];receivables:any[];paymentApplications:any[];
  profitability:any[];jobs:any[];jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const activeDispatchByWorkOrder=new Map<string,any[]>();
  for(const row of input.dispatch||[]){
    const id=String(row?.work_order_id||''); if(!id) continue;
    const status=String(row?.schedule_status||row?.dispatch_status||'').toLowerCase();
    if(['cancelled','superseded'].includes(status)) continue;
    const list=activeDispatchByWorkOrder.get(id)||[]; list.push(row); activeDispatchByWorkOrder.set(id,list);
  }
  const productionByWorkOrder=new Map<string,any[]>();
  for(const row of input.production||[]){
    const id=String(row?.work_order_id||''); if(!id) continue;
    const list=productionByWorkOrder.get(id)||[]; list.push(row); productionByWorkOrder.set(id,list);
  }
  const changeByWorkOrder=new Map<string,any[]>();
  const changeByEstimate=new Map<string,any[]>();
  for(const row of input.changeOrders||[]){
    const wid=String(row?.work_order_id||''); if(wid){const list=changeByWorkOrder.get(wid)||[];list.push(row);changeByWorkOrder.set(wid,list);}
    const eid=String(row?.estimate_id||''); if(eid){const list=changeByEstimate.get(eid)||[];list.push(row);changeByEstimate.set(eid,list);}
  }
  const receivableByInvoice=new Map((input.receivables||[]).map((r)=>[String(r?.id||''),r]));
  const paymentsByInvoice=new Map<string,any[]>();
  for(const row of input.paymentApplications||[]){
    const id=String(row?.invoice_id||''); if(!id) continue;
    const list=paymentsByInvoice.get(id)||[]; list.push(row); paymentsByInvoice.set(id,list);
  }
  const jobById=new Map((input.jobs||[]).map((r)=>[String(r?.id||''),r]));
  const profitByJobCode=new Map((input.profitability||[]).filter((r)=>String(r?.group_type||'').toLowerCase()==='job').map((r)=>[String(r?.group_key||''),r]));
  const queue:any[]=[];
  const lifecycle:any[]=[];

  for(const w of input.workflows||[]){
    const accepted=w?.customer_approval_ready===true || String(w?.estimate_status||'').toLowerCase()==='accepted' || !!w?.quote_accepted_at;
    if(!accepted) continue;
    const estimateId=String(w?.estimate_id||'');
    const workOrderId=String(w?.work_order_id||'');
    const invoiceId=String(w?.ar_invoice_id||'');
    const dispatchRows=workOrderId?(activeDispatchByWorkOrder.get(workOrderId)||[]):[];
    const productionRows=workOrderId?(productionByWorkOrder.get(workOrderId)||[]):[];
    const relatedChanges=[...(workOrderId?(changeByWorkOrder.get(workOrderId)||[]):[]),...(estimateId?(changeByEstimate.get(estimateId)||[]):[])]
      .filter((row,index,all)=>all.findIndex((x)=>String(x?.id||'')===String(row?.id||''))===index);
    const completed=w?.completion_ready_for_accounting===true || productionRows.some((r)=>['complete','completed_with_evidence','completed_missing_evidence'].includes(String(r?.completion_state||r?.production_state||r?.session_status||'').toLowerCase()));
    const acceptedNotScheduled=dispatchRows.length===0;
    const completedNotInvoiced=completed && !invoiceId;
    const receivable=invoiceId?receivableByInvoice.get(invoiceId)||null:null;
    const paymentRows=invoiceId?(paymentsByInvoice.get(invoiceId)||[]):[];
    const invoiceBalance=receivable==null?null:Number(receivable?.balance_due);
    const invoicedNotCollected=!!invoiceId && receivable!=null && Number.isFinite(invoiceBalance) && invoiceBalance>0;
    const legacyJob=workOrderId?jobById.get(String(w?.legacy_job_id||''))||null:null;
    const jobCode=String(legacyJob?.job_code||'');
    const profit=jobCode?profitByJobCode.get(jobCode)||null:null;
    const actualProfit=profit==null?null:Number(profit?.actual_profit_total);
    const revenueVariance=profit==null?null:Number(profit?.revenue_variance_total);
    const costVariance=profit==null?null:Number(profit?.cost_variance_total);
    const materialMarginLeakage=profit!=null && (
      (Number.isFinite(actualProfit)&&actualProfit<0) ||
      (Number.isFinite(revenueVariance)&&revenueVariance<0&&Number.isFinite(costVariance)&&costVariance>0)
    );
    const approvedExtraNotBilled=relatedChanges.filter((ch)=>{
      const authorized=String(ch?.customer_authorization_status||'').toLowerCase()==='authorized' || String(ch?.status||'').toLowerCase()==='approved';
      const applied=String(ch?.scope_application_status||'').toLowerCase()==='applied' || !!ch?.budget_application_id;
      const invoiceEvidence=String(ch?.invoice_evidence_status||'').toLowerCase();
      return authorized&&applied&&invoiceEvidence!=='linked';
    });
    const line={
      estimate_id:w?.estimate_id||null,estimate_number:w?.estimate_number||null,client_name:w?.client_name||null,site_name:w?.site_name||null,
      estimate_total_amount:w?.estimate_total_amount??null,estimate_total_cost:w?.estimate_total_cost??null,estimate_margin_amount:w?.estimate_margin_amount??null,estimate_margin_percent:w?.estimate_margin_percent??null,
      work_order_id:w?.work_order_id||null,work_order_number:w?.work_order_number||null,work_order_status:w?.work_order_status||null,
      active_dispatch_count:dispatchRows.length,production_session_count:productionRows.length,completion_ready_for_accounting:w?.completion_ready_for_accounting===true,
      invoice_id:w?.ar_invoice_id||null,invoice_number:w?.ar_invoice_number||null,invoice_status:w?.ar_invoice_status||null,
      invoice_balance_due:invoiceBalance,payment_application_count:paymentRows.length,
      payment_applied_total:paymentRows.reduce((sum,r)=>sum+Number(r?.applied_amount||0),0),
      accepted_not_scheduled:acceptedNotScheduled,completed_not_invoiced:completedNotInvoiced,
      approved_extra_not_billed_count:approvedExtraNotBilled.length,invoiced_not_collected:invoicedNotCollected,
      material_margin_leakage:materialMarginLeakage,
      actual_profit_total:profit==null?null:(Number.isFinite(actualProfit)?actualProfit:null),
      revenue_variance_total:profit==null?null:(Number.isFinite(revenueVariance)?revenueVariance:null),
      cost_variance_total:profit==null?null:(Number.isFinite(costVariance)?costVariance:null),
      finance_evidence_state:input.financeVisible?'available':'not_visible',
      workflow_stage:w?.workflow_stage||null
    };
    lifecycle.push(line);
    if(acceptedNotScheduled) queue.push({
      signal_type:'accepted_not_scheduled',source_module:'jobs',source_record_id:w?.work_order_id||w?.estimate_id||null,
      source_reference:w?.work_order_number||w?.estimate_number||'Accepted estimate',client_name:w?.client_name||null,site_name:w?.site_name||null,
      amount:w?.estimate_total_amount??null,detail:w?.work_order_id?'Accepted/converted work has no active dispatch evidence.':'Accepted estimate has not yet produced a work order/dispatch.',
      suggested_next_action:'Review scheduling / dispatch readiness',navigation_target:'jobs'
    });
    if(completedNotInvoiced) queue.push({
      signal_type:'completed_not_invoiced',source_module:'finance',source_record_id:w?.work_order_id||w?.estimate_id||null,
      source_reference:w?.work_order_number||w?.estimate_number||'Completed work',client_name:w?.client_name||null,site_name:w?.site_name||null,
      amount:w?.current_work_order_charge_total??w?.estimate_total_amount??null,detail:'Completion/accounting-ready evidence exists without an A/R invoice.',
      suggested_next_action:'Review invoice readiness and Finance handoff',navigation_target:'finance'
    });
    for(const ch of approvedExtraNotBilled) queue.push({
      signal_type:'approved_extra_not_billed',source_module:'jobs',source_record_id:ch?.id||null,
      source_reference:ch?.change_order_number||'Approved extra',client_name:w?.client_name||null,site_name:w?.site_name||ch?.site_name||null,
      amount:ch?.estimated_charge_delta??null,detail:'Authorized/applied change-order scope is not linked to invoice evidence.',
      suggested_next_action:'Review change-order invoice evidence',navigation_target:'jobs'
    });
    if(invoicedNotCollected) queue.push({
      signal_type:'invoiced_not_collected',source_module:'finance',source_record_id:w?.ar_invoice_id||null,
      source_reference:w?.ar_invoice_number||'A/R invoice',client_name:w?.client_name||receivable?.client_name||null,site_name:w?.site_name||null,
      amount:invoiceBalance,detail:'Invoice has a remaining recorded balance after '+paymentRows.length+' payment application record(s).',
      suggested_next_action:'Review receivable and payment application evidence',navigation_target:'finance'
    });
    if(materialMarginLeakage) queue.push({
      signal_type:'material_margin_leakage',source_module:'finance',source_record_id:w?.legacy_job_id||w?.work_order_id||null,
      source_reference:jobCode||w?.work_order_number||w?.estimate_number||'Job profitability',client_name:w?.client_name||null,site_name:w?.site_name||null,
      amount:actualProfit,detail:Number.isFinite(actualProfit)&&actualProfit<0?'Recorded actual job profit is negative.':'Recorded cost variance is adverse while recorded revenue variance is also adverse.',
      suggested_next_action:'Review estimate assumptions, approved extras, actual cost and billed revenue',navigation_target:'finance'
    });
  }

  const seenStandaloneChange=new Set(queue.filter((r)=>r.signal_type==='approved_extra_not_billed').map((r)=>String(r.source_record_id||'')));
  for(const ch of input.changeOrders||[]){
    const id=String(ch?.id||''); if(!id||seenStandaloneChange.has(id)) continue;
    const authorized=String(ch?.customer_authorization_status||'').toLowerCase()==='authorized' || String(ch?.status||'').toLowerCase()==='approved';
    const applied=String(ch?.scope_application_status||'').toLowerCase()==='applied' || !!ch?.budget_application_id;
    if(authorized&&applied&&String(ch?.invoice_evidence_status||'').toLowerCase()!=='linked'){
      queue.push({signal_type:'approved_extra_not_billed',source_module:'jobs',source_record_id:ch?.id||null,source_reference:ch?.change_order_number||'Approved extra',
        client_name:null,site_name:ch?.site_name||null,amount:ch?.estimated_charge_delta??null,
        detail:'Authorized/applied change-order scope is not linked to invoice evidence.',suggested_next_action:'Review change-order invoice evidence',navigation_target:'jobs'});
    }
  }
  const seenInvoice=new Set(queue.filter((r)=>r.signal_type==='invoiced_not_collected').map((r)=>String(r.source_record_id||'')));
  for(const ar of input.receivables||[]){
    const id=String(ar?.id||''); const balance=Number(ar?.balance_due);
    if(!id||seenInvoice.has(id)||!Number.isFinite(balance)||balance<=0) continue;
    const apps=paymentsByInvoice.get(id)||[];
    queue.push({signal_type:'invoiced_not_collected',source_module:'finance',source_record_id:ar?.id||null,source_reference:ar?.invoice_number||'A/R invoice',
      client_name:ar?.client_name||null,site_name:null,amount:balance,
      detail:'Invoice has a remaining recorded balance after '+apps.length+' payment application record(s).',
      suggested_next_action:'Review receivable and payment application evidence',navigation_target:'finance'});
  }

  const order:Record<string,number>={completed_not_invoiced:10,approved_extra_not_billed:20,invoiced_not_collected:30,material_margin_leakage:40,accepted_not_scheduled:50};
  queue.sort((a,b)=>(order[a.signal_type]||99)-(order[b.signal_type]||99)||String(a.source_reference||'').localeCompare(String(b.source_reference||'')));
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk,
    summary:{
      accepted_estimate_lifecycles:lifecycle.length,
      accepted_not_scheduled:queue.filter((r)=>r.signal_type==='accepted_not_scheduled').length,
      completed_not_invoiced:queue.filter((r)=>r.signal_type==='completed_not_invoiced').length,
      approved_extra_not_billed:queue.filter((r)=>r.signal_type==='approved_extra_not_billed').length,
      invoiced_not_collected:queue.filter((r)=>r.signal_type==='invoiced_not_collected').length,
      material_margin_leakage:queue.filter((r)=>r.signal_type==='material_margin_leakage').length,
      total_open_leakage_signals:queue.length,
      jobs_evidence_visible:input.jobsVisible,finance_evidence_visible:input.financeVisible
    },
    attention_queue:queue.slice(0,150),lifecycles:lifecycle.slice(0,250),
    margin_boundary:'Material margin leakage is flagged only from strong recorded evidence: negative actual job profit, or simultaneous adverse recorded revenue and cost variance. No dollar or percentage threshold is invented.',
    scheduling_boundary:'Accepted-not-scheduled means accepted customer evidence exists and no active dispatch record is loaded for the resulting work order; an accepted estimate without a work order is also surfaced.',
    billing_boundary:'Completed-not-invoiced uses completion/accounting-ready evidence without an A/R invoice. Approved-extra-not-billed requires authorized/applied change-order scope without linked invoice evidence.',
    collection_boundary:'Invoiced-not-collected uses the recorded A/R balance due and payment-application evidence; it does not initiate reminders, collect payment or mutate provider state.',
    authority_boundary:'Estimate, Jobs/dispatch/production, change-order and Finance records remain their existing authorities. This workbench is analytical only and cannot post accounting, create invoices, apply payments or charge customers.'
  };
}



function buildLabourEquipmentFleetUtilizationDecisionSupport(input:{
  timekeeping:any[];production:any[];dispatch:any[];equipment:any[];equipmentUse:any[];maintenance:any[];fleet:any[];
  jobsVisible:boolean;adminVisible:boolean;sourceQueriesOk:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const cutoff=addCalendarDays(today,-30);
  const inWindow=(value:any)=>{
    const d=ontarioDateKey(value);
    return !!d&&d>=cutoff&&d<=today;
  };
  const timeRows=(input.timekeeping||[]).filter((r)=>inWindow(r?.signed_in_at||r?.updated_at));
  const productionRows=(input.production||[]).filter((r)=>inWindow(r?.session_date||r?.started_at));
  const dispatchRows=(input.dispatch||[]).filter((r)=>{
    const d=ontarioDateKey(r?.scheduled_start||r?.service_date);
    return !!d&&d>=cutoff&&d<=today&&!['cancelled','superseded'].includes(String(r?.schedule_status||r?.status||'').toLowerCase());
  });
  const dispatchById=new Map<string,any>();
  for(const row of dispatchRows) if(row?.id) dispatchById.set(String(row.id),row);

  const crewMap=new Map<string,any>();
  const crewRow=(id:any,name:any)=>{
    const key=String(id||name||'unassigned');
    const current=crewMap.get(key)||{
      crew_id:id||null,crew_name:name||'Unassigned / not recorded',paid_minutes:0,job_linked_paid_minutes:0,
      travel_minutes:0,paid_minutes_without_job_link:0,production_labour_hours:0,dispatch_item_count:0,production_session_count:0
    };
    crewMap.set(key,current);return current;
  };
  for(const row of timeRows){
    const s=crewRow(row?.crew_id,row?.crew_name);
    const paid=Math.max(0,Number(row?.paid_minutes||0)),travel=Math.max(0,Number(row?.travel_minutes||0));
    s.paid_minutes+=paid;s.travel_minutes+=travel;
    if(row?.job_id||row?.job_session_id) s.job_linked_paid_minutes+=paid;
    else s.paid_minutes_without_job_link+=paid;
  }
  for(const row of dispatchRows){
    const s=crewRow(row?.crew_id,row?.crew_name);
    s.dispatch_item_count++;
  }
  for(const row of productionRows){
    const dispatch=dispatchById.get(String(row?.dispatch_schedule_item_id||''))||{};
    const s=crewRow(dispatch?.crew_id,dispatch?.crew_name);
    s.production_labour_hours+=Math.max(0,Number(row?.total_labour_hours||0));
    s.production_session_count++;
  }
  const crewUtilization=[...crewMap.values()].map((s)=>({
    ...s,
    paid_hours:Number((s.paid_minutes/60).toFixed(2)),
    job_linked_paid_hours:Number((s.job_linked_paid_minutes/60).toFixed(2)),
    travel_hours:Number((s.travel_minutes/60).toFixed(2)),
    paid_hours_without_job_link:Number((s.paid_minutes_without_job_link/60).toFixed(2)),
    production_labour_hours:Number(Number(s.production_labour_hours||0).toFixed(2)),
    job_link_coverage_percent:s.paid_minutes>0?Number(((s.job_linked_paid_minutes/s.paid_minutes)*100).toFixed(1)):null
  })).sort((a,b)=>String(a.crew_name).localeCompare(String(b.crew_name)));

  const useByAsset=new Map<string,any[]>();
  for(const row of input.equipmentUse||[]){
    const id=row?.equipment_item_id;if(!id) continue;
    const key=String(id),list=useByAsset.get(key)||[];list.push(row);useByAsset.set(key,list);
  }
  const maintenanceByAsset=new Map<string,any[]>();
  for(const row of input.maintenance||[]){
    const id=row?.equipment_item_id;if(!id) continue;
    const key=String(id),list=maintenanceByAsset.get(key)||[];list.push(row);maintenanceByAsset.set(key,list);
  }
  const fleetByAsset=new Map<string,any>();
  for(const row of input.fleet||[]) if(row?.equipment_item_id) fleetByAsset.set(String(row.equipment_item_id),row);

  const assetUtilization=(input.equipment||[]).map((asset)=>{
    const key=String(asset?.id||asset?.equipment_item_id||'');
    const allUse=(useByAsset.get(key)||[]).sort((a,b)=>String(b?.checked_out_at||'').localeCompare(String(a?.checked_out_at||'')));
    const recentUse=allUse.filter((r)=>inWindow(r?.checked_out_at));
    const activeUse=allUse.filter((r)=>!r?.returned_at);
    const maintenance=maintenanceByAsset.get(key)||[];
    const overdue=maintenance.filter((m)=>String(m?.due_status||'').toLowerCase()==='overdue');
    const due=maintenance.filter((m)=>['due','due_soon'].includes(String(m?.due_status||'').toLowerCase()));
    const fleet=fleetByAsset.get(key)||null;
    const status=String(asset?.status||asset?.equipment_status||'').toLowerCase();
    const activeAsset=!['retired','disposed','inactive','lost'].includes(status)&&String(asset?.replacement_state||'').toLowerCase()!=='retired';
    const locked=asset?.is_locked_out===true||String(asset?.registry_readiness_status||'').toLowerCase()==='locked_out';
    const fleetDowntime=!!fleet&&(String(fleet?.operational_status||'').toLowerCase()==='downtime'||Number(fleet?.open_downtime_count||0)>0);
    const fleetReadiness=String(fleet?.latest_readiness_status||'').toLowerCase();
    const fleetReadinessAttention=!!fleet&&!!fleetReadiness&&!['ready','passed','available','clear'].includes(fleetReadiness);
    const replacementState=String(asset?.replacement_state||'retain').toLowerCase();
    const replacementAttention=['plan_replacement','replace','retired'].includes(replacementState);
    const noRecentRecordedUse=activeAsset&&recentUse.length===0;
    const reasons:string[]=[];
    if(locked) reasons.push('equipment locked out');
    if(fleetDowntime) reasons.push('fleet downtime');
    if(overdue.length) reasons.push('preventive maintenance overdue');
    else if(due.length) reasons.push('preventive maintenance due / due soon');
    if(fleetReadinessAttention) reasons.push('fleet readiness attention');
    if(replacementAttention) reasons.push('recorded replacement state '+replacementState);
    if(noRecentRecordedUse) reasons.push('no recorded equipment signout in the 30-day window');
    return {
      equipment_item_id:asset?.id||asset?.equipment_item_id||null,equipment_code:asset?.equipment_code||null,
      equipment_name:asset?.equipment_name||null,category:asset?.category||null,assigned_crew_id:asset?.assigned_crew_id||null,
      assigned_crew_name:asset?.assigned_crew_name||null,status:asset?.status||asset?.equipment_status||null,
      registry_readiness_status:asset?.registry_readiness_status||null,replacement_state:asset?.replacement_state||null,
      recent_signout_count:recentUse.length,active_signout_count:activeUse.length,last_recorded_use_at:allUse[0]?.checked_out_at||null,
      locked_out:locked,no_recent_recorded_use:noRecentRecordedUse,
      maintenance_overdue_count:overdue.length,maintenance_due_count:due.length,
      fleet_asset:!!fleet,fleet_asset_class:fleet?.asset_class||null,fleet_operational_status:fleet?.operational_status||null,
      fleet_readiness_status:fleet?.latest_readiness_status||null,fleet_downtime:fleetDowntime,
      fleet_downtime_reason:fleet?.downtime_reason||null,open_downtime_count:Number(fleet?.open_downtime_count||0),
      replacement_attention:replacementAttention,attention_reasons:reasons,
      utilization_evidence_state:recentUse.length?'recorded_use':noRecentRecordedUse?'no_recent_recorded_use':'not_applicable'
    };
  }).sort((a,b)=>String(a.equipment_code||a.equipment_name||'').localeCompare(String(b.equipment_code||b.equipment_name||'')));

  const fleetRows=assetUtilization.filter((a)=>a.fleet_asset);
  const knownFleetAvailable=fleetRows.filter((a)=>{
    const op=String(a.fleet_operational_status||'').toLowerCase(),ready=String(a.fleet_readiness_status||'').toLowerCase();
    return !a.locked_out&&!a.fleet_downtime&&['ready','available','active'].includes(op)&&(!ready||['ready','passed','available','clear'].includes(ready));
  }).length;
  const fleetUnknown=fleetRows.filter((a)=>{
    const op=String(a.fleet_operational_status||'').toLowerCase();
    return !a.locked_out&&!a.fleet_downtime&&!['ready','available','active'].includes(op);
  }).length;

  const attentionQueue=assetUtilization.filter((a)=>a.attention_reasons.length).map((a)=>{
    const blocking=a.locked_out||a.fleet_downtime;
    const maintenance=a.maintenance_overdue_count>0||a.maintenance_due_count>0;
    return {
      signal_type:blocking?'downtime_or_lockout':maintenance?'maintenance_attention':a.replacement_attention?'replacement_review':'utilization_evidence_review',
      equipment_item_id:a.equipment_item_id,equipment_code:a.equipment_code,equipment_name:a.equipment_name,
      assigned_crew_name:a.assigned_crew_name||null,attention_reasons:a.attention_reasons,
      detail:a.attention_reasons.join(' · '),
      suggested_next_action:blocking?'Review the existing lockout / fleet downtime authority before assignment.':
        maintenance?'Review the existing preventive-maintenance plan and service-task authority.':
        a.replacement_attention?'Review the recorded replacement plan and lifecycle evidence.':
        'Review whether the asset is intentionally spare/seasonal or whether usage evidence is missing.',
      navigation_target:'operations'
    };
  }).sort((a,b)=>{
    const order:Record<string,number>={downtime_or_lockout:10,maintenance_attention:20,replacement_review:30,utilization_evidence_review:40};
    return (order[a.signal_type]||99)-(order[b.signal_type]||99)||String(a.equipment_code||'').localeCompare(String(b.equipment_code||''));
  });

  const totalPaid=timeRows.reduce((sum,r)=>sum+Math.max(0,Number(r?.paid_minutes||0)),0);
  const linkedPaid=timeRows.filter((r)=>r?.job_id||r?.job_session_id).reduce((sum,r)=>sum+Math.max(0,Number(r?.paid_minutes||0)),0);
  const unlinkedPaid=Math.max(0,totalPaid-linkedPaid);
  const productionHours=productionRows.reduce((sum,r)=>sum+Math.max(0,Number(r?.total_labour_hours||0)),0);
  const assignedDispatch=dispatchRows.filter((r)=>r?.crew_id||r?.crew_name).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',lookback_days:30,source_queries_ok:input.sourceQueriesOk,
    summary:{
      paid_hours:Number((totalPaid/60).toFixed(2)),job_linked_paid_hours:Number((linkedPaid/60).toFixed(2)),
      paid_hours_without_job_link:Number((unlinkedPaid/60).toFixed(2)),production_labour_hours:Number(productionHours.toFixed(2)),
      dispatch_items:dispatchRows.length,dispatch_items_with_crew_assignment:assignedDispatch,
      crew_assignment_coverage_percent:dispatchRows.length?Number(((assignedDispatch/dispatchRows.length)*100).toFixed(1)):null,
      equipment_asset_count:assetUtilization.length,equipment_with_recent_recorded_use:assetUtilization.filter((a)=>a.recent_signout_count>0).length,
      equipment_no_recent_recorded_use:assetUtilization.filter((a)=>a.no_recent_recorded_use).length,
      active_equipment_signouts:assetUtilization.reduce((sum,a)=>sum+Number(a.active_signout_count||0),0),
      locked_out_assets:assetUtilization.filter((a)=>a.locked_out).length,
      maintenance_attention_assets:assetUtilization.filter((a)=>a.maintenance_overdue_count>0||a.maintenance_due_count>0).length,
      replacement_attention_assets:assetUtilization.filter((a)=>a.replacement_attention).length,
      fleet_asset_count:fleetRows.length,fleet_known_available:knownFleetAvailable,
      fleet_downtime_assets:fleetRows.filter((a)=>a.fleet_downtime).length,fleet_availability_unknown:fleetUnknown,
      attention_asset_count:attentionQueue.length
    },
    crew_utilization:crewUtilization,
    asset_utilization:assetUtilization.slice(0,150),
    fleet_availability:fleetRows.slice(0,100),
    attention_queue:attentionQueue.slice(0,100),
    labour_boundary:'Labour utilization is crew/business-level recording context only: paid time, job-linked paid time, travel, dispatch assignment coverage and recorded production labour. It does not score, rank or infer individual employee performance.',
    equipment_boundary:'Equipment utilization is based on existing signout evidence. No recorded signout in the 30-day window is an evidence signal only and is not treated as proof that an asset was idle or unnecessary.',
    safety_boundary:'Equipment lockout, fleet downtime and readiness restrictions are operating constraints from their existing authorities. They are never converted into employee performance judgments or used to clear a Safety restriction.',
    maintenance_boundary:'Maintenance and replacement signals reuse recorded preventive-maintenance due states and equipment replacement states. This layer does not complete maintenance, clear lockouts, replace assets, purchase equipment or create vendor commitments.',
    privacy_boundary:'Returned utilization evidence is aggregated by crew and asset. Individual employee names, employee numbers, explanations and other private timekeeping details are not returned by this decision-support layer.',
    authority_boundary:'Read-only management evidence. Timekeeping, dispatch, production, equipment signout, lockout/return-to-service, maintenance and fleet workflows remain the existing mutation authorities.'
  };
}

  if (scope === 'owner_management_command') {
    const [canJobsView,canFinanceView,canSafetyView,canAdminManage] = await Promise.all([
      hasModuleAccess(supabase, actorProfile, 'jobs', 'view'),
      hasModuleAccess(supabase, actorProfile, 'finance', 'view'),
      hasModuleAccess(supabase, actorProfile, 'safety', 'view'),
      hasModuleAccess(supabase, actorProfile, 'admin', 'manage')
    ]);
    const [
      jobsRead,dispatchRead,productionRead,profitabilityRead,timekeepingRead,recurringRead,recurringVisitsRead,crewsRead,stormsRead,stormRoutesRead,seasonalWorkRead,
      safetyRead,equipmentRead,maintenanceRead,trainingSummaryRead,workforceSummaryRead,receivablesRead,bankRead,financeExceptionsRead,closeDashboardRead,workabilityRead,
      routesRead,timekeepingDetailRead,recurringEventsRead,crmRenewalsRead,crmInteractionsRead,agreementProfitabilityRead,seasonalRolloverRead,
      estimateWorkflowRead,changeOrdersRead,paymentApplicationsRead,equipmentUseRead,fleetRead
    ] = await Promise.all([
      canJobsView ? safeListEvidence(supabase,'v_jobs_directory','*','updated_at',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_crew_dispatch_schedule','*','scheduled_start',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_landscape_production_session_directory','*','session_date',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canFinanceView ? safeListEvidence(supabase,'v_job_profitability_variance_directory','*','group_type',1500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canAdminManage ? safeListEvidence(supabase,'v_timekeeping_attendance_summary','*',undefined,200,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:200}),
      canJobsView ? safeListEvidence(supabase,'v_recurring_service_program_directory','*','next_service_date',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_recurring_service_visit_schedule','*','service_date',1000,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_workforce_crew_directory','*','crew_name',250,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:250}),
      canJobsView ? safeListEvidence(supabase,'seasonal_storm_events','*','planned_start',250,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:250}),
      canJobsView ? safeListEvidence(supabase,'v_seasonal_storm_route_directory','*','updated_at',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_seasonal_operations_outstanding_work','*','due_date',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canSafetyView ? safeListEvidence(supabase,'v_supervisor_safety_queue','*','sort_at',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_equipment_registry_v2','*','equipment_code',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_preventive_maintenance_workbench','*','due_date',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canSafetyView ? safeListEvidence(supabase,'v_training_certification_matrix_summary','*',undefined,200,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:200}),
      canAdminManage ? safeListEvidence(supabase,'v_workforce_summary','*',undefined,200,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:200}),
      canFinanceView ? safeListEvidence(supabase,'v_ar_invoice_aging_detail','*','due_date',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canFinanceView ? safeListEvidence(supabase,'v_bank_reconciliation_summary','*','period_end',120,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:120}),
      canFinanceView ? safeListEvidence(supabase,'v_accounting_reconciliation_manual_review_queue','*','review_priority',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canFinanceView ? safeListEvidence(supabase,'v_accounting_close_dashboard','*',undefined,200,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:200}),
      canJobsView ? safeListEvidence(supabase,'v_weather_workability_queue','*','observed_at',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_route_planning_directory','*','route_code',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canAdminManage ? safeListEvidence(supabase,'v_timekeeping_payroll_evidence','*','updated_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'recurring_service_visit_events','*','created_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_crm_renewal_queue','*','end_date',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canJobsView ? safeListEvidence(supabase,'v_crm_interaction_timeline','*','occurred_at',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canFinanceView ? safeListEvidence(supabase,'v_service_agreement_profitability_summary','*','agreement_code',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canJobsView ? safeListEvidence(supabase,'v_seasonal_operations_rollover_directory','*','updated_at',750,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      (canJobsView&&canFinanceView) ? safeListEvidence(supabase,'v_estimate_job_invoice_workflow','*','estimate_number',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canJobsView ? safeListEvidence(supabase,'v_change_order_extras_directory','*','updated_at',750,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canFinanceView ? safeListEvidence(supabase,'v_ar_payment_application_directory','*','application_date',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_equipment_signout_history','*','checked_out_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_fleet_vehicle_operations','*','equipment_code',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500})
    ]);
    const jobs=jobsRead.rows,dispatch=dispatchRead.rows,production=productionRead.rows,profitability=profitabilityRead.rows,
      timekeeping=timekeepingRead.rows,recurring=recurringRead.rows,recurringVisits=recurringVisitsRead.rows,crews=crewsRead.rows,storms=stormsRead.rows,
      stormRoutes=stormRoutesRead.rows,seasonalWork=seasonalWorkRead.rows,safety=safetyRead.rows,equipment=equipmentRead.rows,
      maintenance=maintenanceRead.rows,trainingSummary=trainingSummaryRead.rows,workforceSummary=workforceSummaryRead.rows,
      receivables=receivablesRead.rows,bank=bankRead.rows,financeExceptions=financeExceptionsRead.rows,
      closeDashboard=closeDashboardRead.rows,workability=workabilityRead.rows,routes=routesRead.rows,timekeepingDetail=timekeepingDetailRead.rows,
      recurringEvents=recurringEventsRead.rows,crmRenewals=crmRenewalsRead.rows,crmInteractions=crmInteractionsRead.rows,
      agreementProfitability=agreementProfitabilityRead.rows,seasonalRollover=seasonalRolloverRead.rows,
      estimateWorkflow=estimateWorkflowRead.rows,changeOrders=changeOrdersRead.rows,paymentApplications=paymentApplicationsRead.rows,
      equipmentUse=equipmentUseRead.rows,fleet=fleetRead.rows;
    const sourceFreshness:Record<string,any> = {};
    const addFresh=(read:SourceReadEvidence,key:string,module:string,view:string,visible:boolean,stale_after_hours:number)=>{
      sourceFreshness[key]=buildManagementSourceFreshness(read,{key,module,view,visible,stale_after_hours});
    };
    addFresh(jobsRead,'jobs','jobs','v_jobs_directory',canJobsView,72);
    addFresh(dispatchRead,'dispatch','jobs','v_crew_dispatch_schedule',canJobsView,72);
    addFresh(productionRead,'production','jobs','v_landscape_production_session_directory',canJobsView,72);
    addFresh(profitabilityRead,'profitability','finance','v_job_profitability_variance_directory',canFinanceView,168);
    addFresh(timekeepingRead,'timekeeping','admin','v_timekeeping_attendance_summary',canAdminManage,168);
    addFresh(recurringRead,'recurring','jobs','v_recurring_service_program_directory',canJobsView,168);
    addFresh(recurringVisitsRead,'recurring_visits','jobs','v_recurring_service_visit_schedule',canJobsView,72);
    addFresh(crewsRead,'crews','jobs','v_workforce_crew_directory',canJobsView,168);
    addFresh(stormsRead,'storms','jobs','seasonal_storm_events',canJobsView,72);
    addFresh(stormRoutesRead,'storm_routes','jobs','v_seasonal_storm_route_directory',canJobsView,72);
    addFresh(seasonalWorkRead,'seasonal_work','jobs','v_seasonal_operations_outstanding_work',canJobsView,168);
    addFresh(safetyRead,'safety','safety','v_supervisor_safety_queue',canSafetyView,72);
    addFresh(equipmentRead,'equipment','jobs','v_equipment_registry_v2',canJobsView,168);
    addFresh(maintenanceRead,'maintenance','jobs','v_preventive_maintenance_workbench',canJobsView,168);
    addFresh(trainingSummaryRead,'training','safety','v_training_certification_matrix_summary',canSafetyView,336);
    addFresh(workforceSummaryRead,'workforce','admin','v_workforce_summary',canAdminManage,336);
    addFresh(receivablesRead,'receivables','finance','v_ar_invoice_aging_detail',canFinanceView,168);
    addFresh(bankRead,'bank','finance','v_bank_reconciliation_summary',canFinanceView,336);
    addFresh(financeExceptionsRead,'finance_exceptions','finance','v_accounting_reconciliation_manual_review_queue',canFinanceView,168);
    addFresh(closeDashboardRead,'close_dashboard','finance','v_accounting_close_dashboard',canFinanceView,168);
    addFresh(workabilityRead,'workability','jobs','v_weather_workability_queue',canJobsView,72);
    addFresh(routesRead,'routes','jobs','v_route_planning_directory',canJobsView,168);
    addFresh(timekeepingDetailRead,'timekeeping_detail','admin','v_timekeeping_payroll_evidence',canAdminManage,168);
    addFresh(recurringEventsRead,'recurring_events','jobs','recurring_service_visit_events',canJobsView,168);
    addFresh(crmRenewalsRead,'crm_renewals','jobs','v_crm_renewal_queue',canJobsView,168);
    addFresh(crmInteractionsRead,'crm_interactions','jobs','v_crm_interaction_timeline',canJobsView,168);
    addFresh(agreementProfitabilityRead,'agreement_profitability','finance','v_service_agreement_profitability_summary',canFinanceView,168);
    addFresh(seasonalRolloverRead,'seasonal_rollover','jobs','v_seasonal_operations_rollover_directory',canJobsView,168);
    addFresh(estimateWorkflowRead,'estimate_workflow','jobs+finance','v_estimate_job_invoice_workflow',canJobsView&&canFinanceView,168);
    addFresh(changeOrdersRead,'change_orders','jobs','v_change_order_extras_directory',canJobsView,168);
    addFresh(paymentApplicationsRead,'payment_applications','finance','v_ar_payment_application_directory',canFinanceView,168);
    addFresh(equipmentUseRead,'equipment_use','jobs','v_equipment_signout_history',canJobsView,168);
    addFresh(fleetRead,'fleet','jobs','v_fleet_vehicle_operations',canJobsView,168);
    const metricConfidence = {
      crews_today:buildManagementMetricConfidence(sourceFreshness,['dispatch']),
      completion_today:buildManagementMetricConfidence(sourceFreshness,['dispatch','production']),
      schedule_risk:buildManagementMetricConfidence(sourceFreshness,['dispatch','workability']),
      revenue:buildManagementMetricConfidence(sourceFreshness,['profitability']),
      gross_margin:buildManagementMetricConfidence(sourceFreshness,['profitability']),
      labour_utilization:buildManagementMetricConfidence(sourceFreshness,['production','timekeeping']),
      receivables:buildManagementMetricConfidence(sourceFreshness,['receivables']),
      cash_bank:buildManagementMetricConfidence(sourceFreshness,['bank']),
      recurring_completion:buildManagementMetricConfidence(sourceFreshness,['recurring_visits']),
      winter_operations:buildManagementMetricConfidence(sourceFreshness,['storms','storm_routes']),
      fall_cleanup:buildManagementMetricConfidence(sourceFreshness,['seasonal_work','recurring_visits']),
      safety_blockers:buildManagementMetricConfidence(sourceFreshness,['safety']),
      equipment_blockers:buildManagementMetricConfidence(sourceFreshness,['equipment','maintenance']),
      workforce_blockers:buildManagementMetricConfidence(sourceFreshness,['training','workforce']),
      finance_readiness:buildManagementMetricConfidence(sourceFreshness,['finance_exceptions','close_dashboard']),
      capacity_forecast:buildManagementMetricConfidence(sourceFreshness,['dispatch','recurring_visits','crews','equipment','workability','storms','storm_routes','seasonal_work']),
      route_efficiency:buildManagementMetricConfidence(sourceFreshness,['dispatch','production','routes','workability']),
      recurring_retention:buildManagementMetricConfidence(sourceFreshness,['recurring','recurring_events','crm_renewals','crm_interactions','seasonal_rollover']),
      estimate_to_cash:buildManagementMetricConfidence(sourceFreshness,['estimate_workflow','dispatch','production','change_orders','receivables','payment_applications','profitability']),
      utilization_support:buildManagementMetricConfidence(sourceFreshness,['timekeeping_detail','production','dispatch','equipment','equipment_use','maintenance','fleet'])
    };
    const fourSeasonCapacityForecast=buildFourSeasonCapacityForecast({
      dispatch,visits:recurringVisits,crews,equipment,workability,storms,stormRoutes,seasonalWork
    });
    const routeCrewEfficiencyEvidence=buildRouteCrewEfficiencyEvidence({
      dispatch,production,timekeeping:timekeepingDetail,workability,routes
    });
    const recurringRenewalRetentionWorkbench=buildRecurringRenewalRetentionWorkbench({
      programs:recurring,events:recurringEvents,renewals:crmRenewals,interactions:crmInteractions,
      profitability:agreementProfitability,rollovers:seasonalRollover,financeVisible:canFinanceView
    });
    const estimateToCashLeakageWorkbench=buildEstimateToCashLeakageWorkbench({
      workflows:estimateWorkflow,dispatch,production,changeOrders,receivables,paymentApplications,
      profitability,jobs,jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[estimateWorkflowRead,dispatchRead,productionRead,changeOrdersRead,receivablesRead,paymentApplicationsRead,profitabilityRead].every((r)=>r.query_ok!==false)
    });
    const labourEquipmentFleetUtilizationSupport=buildLabourEquipmentFleetUtilizationDecisionSupport({
      timekeeping:timekeepingDetail,production,dispatch,equipment,equipmentUse,maintenance,fleet,
      jobsVisible:canJobsView,adminVisible:canAdminManage,
      sourceQueriesOk:[timekeepingDetailRead,productionRead,dispatchRead,equipmentRead,equipmentUseRead,maintenanceRead,fleetRead].every((r)=>r.query_ok!==false)
    });
    return Response.json({
      ok:true,scope:'owner_management_command',actor_role:actorRole,actor_profile_id:actorId,
      evidence_generated_at:new Date().toISOString(),
      owner_jobs:jobs,owner_dispatch:dispatch,owner_production:production,owner_profitability:profitability,
      owner_timekeeping_summary:timekeeping,owner_recurring:recurring,owner_recurring_visits:recurringVisits,owner_crews:crews,
      owner_storms:storms,owner_storm_routes:stormRoutes,owner_seasonal_work:seasonalWork,owner_safety:safety,
      owner_equipment:equipment,owner_maintenance:maintenance,owner_training_summary:trainingSummary,
      owner_workforce_summary:workforceSummary,owner_receivables:receivables,owner_bank:bank,
      owner_finance_exceptions:financeExceptions,owner_close_dashboard:closeDashboard,owner_workability:workability,
      owner_equipment_use:equipmentUse,owner_fleet:fleet,
      source_visibility:{jobs:canJobsView,finance:canFinanceView,safety:canSafetyView,admin:canAdminManage},
      source_freshness:sourceFreshness,
      management_metric_confidence:metricConfidence,
      four_season_capacity_forecast:fourSeasonCapacityForecast,
      route_crew_efficiency_evidence:routeCrewEfficiencyEvidence,
      recurring_renewal_retention_workbench:recurringRenewalRetentionWorkbench,
      estimate_to_cash_leakage_workbench:estimateToCashLeakageWorkbench,
      labour_equipment_fleet_utilization_support:labourEquipmentFleetUtilizationSupport,
      freshness_boundary:'Freshness and confidence describe source evidence quality only. Missing, hidden or failed sources do not become zero-valued business facts.',
      seasonal_boundary:'Spring/summer landscaping, fall cleanup/leaf collection and winter snow/storm operations are first-class management contexts.',
      authority_boundary:'Management metrics are read-only aggregates of canonical source workflows; this scope does not mutate Jobs, Safety, Workforce, Equipment or Finance.'
    }, { headers:corsHeaders });
  }

  if (scope === 'saved_views_search') {
    const [canAdminManage,canJobsView,canFinanceView,canSafetyView] = await Promise.all([
      hasModuleAccess(supabase, actorProfile, 'admin', 'manage'),
      hasModuleAccess(supabase, actorProfile, 'jobs', 'view'),
      hasModuleAccess(supabase, actorProfile, 'finance', 'view'),
      hasModuleAccess(supabase, actorProfile, 'safety', 'view')
    ]);
    const [
      customers,properties,jobs,employees,equipment,routes,schedule,seasonalWork,storms,
      maintenance,safetyActions,training,receivables,payments,financeExceptions
    ] = await Promise.all([
      safeList(supabase,'v_crm_customer_directory','*','client_name',300,true),
      safeList(supabase,'v_crm_property_directory','*','site_name',300,true),
      canJobsView ? safeList(supabase,'v_jobs_directory','*','updated_at',300,false) : Promise.resolve([]),
      canAdminManage ? safeList(supabase,'v_workforce_employee_directory','*','full_name',300,true) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'v_equipment_registry_v2','*','equipment_code',300,true) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'v_route_planning_directory','*','route_name',300,true) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'v_crew_dispatch_schedule','*','scheduled_start',300,true) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'v_seasonal_operations_outstanding_work','*','due_date',300,true) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'seasonal_storm_events','*','planned_start',200,false) : Promise.resolve([]),
      canJobsView ? safeList(supabase,'v_preventive_maintenance_workbench','*','due_date',300,true) : Promise.resolve([]),
      canSafetyView ? safeList(supabase,'v_supervisor_safety_queue','*','sort_at',300,false) : Promise.resolve([]),
      canSafetyView ? safeList(supabase,'v_training_certification_matrix','*','expires_at',300,true) : Promise.resolve([]),
      canFinanceView ? safeList(supabase,'v_ar_invoice_aging_detail','*','due_date',300,true) : Promise.resolve([]),
      canFinanceView ? safeList(supabase,'v_accounting_payment_application_dashboard','*',undefined,300,true) : Promise.resolve([]),
      canFinanceView ? safeList(supabase,'v_accounting_reconciliation_manual_review_queue','*','review_priority',300,true) : Promise.resolve([])
    ]);
    return Response.json({
      ok:true,scope:'saved_views_search',actor_role:actorRole,actor_profile_id:actorId,
      command_customers:customers,command_properties:properties,command_jobs:jobs,command_employees:employees,
      command_equipment:equipment,command_routes:routes,command_schedule:schedule,command_seasonal_work:seasonalWork,
      command_storms:storms,command_maintenance:maintenance,command_safety:safetyActions,command_training:training,
      command_receivables:receivables,command_payments:payments,command_finance_exceptions:financeExceptions,
      source_visibility:{
        customer:true,property:true,job:canJobsView,employee:canAdminManage,equipment:canJobsView,route:canJobsView,
        schedule:canJobsView,seasonal:canJobsView,storm:canJobsView,maintenance:canJobsView,safety:canSafetyView,
        training:canSafetyView,invoice:canFinanceView,payment:canFinanceView,finance_exception:canFinanceView
      },
      seasonal_boundary:'Spring/summer, fall, winter and four-season service contexts remain explicit search/filter dimensions.',
      authority_boundary:'This scope is read-only and permission-aware. Saving a view is a browser preference and does not mutate operational, Safety or Finance authority.'
    }, { headers:corsHeaders });
  }

  if (scope === 'workforce') {
    const [
      workforceProfiles,workforceCrews,workforceSkills,profileSkills,availabilityWindows,workforceSummary,
      privateContacts,trainingReadiness
    ] = await Promise.all([
      safeList(supabase,'v_workforce_employee_directory','*','full_name',500,true),
      safeList(supabase,'v_workforce_crew_directory','*','crew_name',250,true),
      safeList(supabase,'v_workforce_skill_directory','*','skill_name',250,true),
      safeList(supabase,'workforce_profile_skills','id,profile_id,skill_id,proficiency_level,evidence_note,verified_by_profile_id,verified_at,active_from,active_until,is_active,updated_at','updated_at',1000,false),
      safeList(supabase,'workforce_availability_windows','id,profile_id,availability_status,day_of_week,start_time,end_time,effective_from,effective_until,availability_note,is_active,updated_at','updated_at',1000,false),
      safeList(supabase,'v_workforce_summary','*',undefined,5,true),
      safeList(supabase,'profiles','id,phone,address_line1,address_line2,city,province,postal_code,emergency_contact_name,emergency_contact_phone','full_name',500,true),
      safeList(supabase,'v_training_certification_matrix','profile_id,requirement_code,requirement_name,equipment_category,equipment_item_id,equipment_code,equipment_name,assignment_due_date,expires_at,readiness_status,internal_authorization_required,internal_authorization_status,internal_authorization_expires_at,updated_at','updated_at',1500,false)
    ]);
    return Response.json({
      ok:true,
      scope:'workforce',
      actor_role:actorRole,
      actor_profile_id:actorId,
      workforce_profiles:workforceProfiles,
      workforce_crews:workforceCrews,
      workforce_skills:workforceSkills,
      workforce_profile_skills:profileSkills,
      workforce_availability_windows:availabilityWindows,
      workforce_summary:workforceSummary,
      workforce_private_contacts:privateContacts,
      workforce_training_readiness:trainingReadiness,
      privacy_boundary:'Home address and emergency-contact fields are returned only by this Admin-manage workforce scope. Operational workforce views omit them.'
    }, { headers:corsHeaders });
  }

  if (scope === 'onboarding') {
    const [overview,items,events,profiles,crews,training] = await Promise.all([
      safeList(supabase,'v_workforce_hiring_onboarding_overview','*','updated_at',1000,false),
      safeList(supabase,'workforce_candidate_onboarding_items','*','updated_at',2500,false),
      safeList(supabase,'workforce_candidate_stage_events','*','changed_at',2500,false),
      safeList(supabase,'v_workforce_employee_directory','*','full_name',1000,true),
      safeList(supabase,'v_workforce_crew_directory','*','crew_name',500,true),
      safeList(supabase,'v_training_certification_matrix','profile_id,requirement_code,requirement_name,readiness_status,internal_authorization_required,internal_authorization_status,updated_at','updated_at',2500,false)
    ]);
    return Response.json({
      ok:true,
      scope:'onboarding',
      actor_role:actorRole,
      actor_profile_id:actorId,
      onboarding_overview:overview,
      onboarding_items:items,
      onboarding_stage_events:events,
      onboarding_profiles:profiles,
      onboarding_crews:crews,
      onboarding_training:training,
      seasonal_boundary:'YW is a four-season Ontario operation: spring/summer mowing and landscaping, fall cleanup and leaf collection, and winter snow clearing/removal are first-class operating contexts.',
      authority_boundary:'Hiring records link into canonical profiles, training/certification, internal equipment/task authorization and crew_members. This scope does not create duplicate employee, training, Safety or crew authority.'
    }, { headers:corsHeaders });
  }

  if (scope === 'performance') {
    const [overview,expectations,coaching,plans,reviews,actions,attendancePatterns,skills,trainingReadiness] = await Promise.all([
      safeList(supabase,'v_workforce_performance_development_overview','*','full_name',500,true),
      safeList(supabase,'workforce_role_expectations','*','sort_order',500,true),
      safeList(supabase,'workforce_coaching_records','*','observed_on',1500,false),
      safeList(supabase,'workforce_development_plans','*','target_date',1000,false),
      safeList(supabase,'workforce_performance_reviews','*','review_period_end',1000,false),
      safeList(supabase,'workforce_improvement_actions','*','due_date',1000,false),
      safeList(supabase,'v_workforce_attendance_patterns','*','last_shift_at',500,false),
      safeList(supabase,'workforce_skills','id,skill_code,skill_name,skill_category,is_active','skill_name',500,true),
      safeList(supabase,'v_training_certification_matrix','profile_id,requirement_code,requirement_name,assignment_due_date,expires_at,readiness_status,internal_authorization_status,updated_at','updated_at',1500,false)
    ]);
    return Response.json({
      ok:true,
      scope:'performance',
      actor_role:actorRole,
      actor_profile_id:actorId,
      performance_overview:overview,
      performance_expectations:expectations,
      performance_coaching:coaching,
      performance_development_plans:plans,
      performance_reviews:reviews,
      performance_improvement_actions:actions,
      attendance_patterns:attendancePatterns,
      performance_skills:skills,
      training_readiness:trainingReadiness,
      safety_boundary:'Safety incident and near-miss truth is intentionally not returned by this performance scope.',
      authority_boundary:'Attendance context is derived from Build 337 timekeeping evidence; training and authorization truth remains with Build 330.'
    }, { headers:corsHeaders });
  }

  if (scope === 'timekeeping') {
    const [evidence,corrections,summary,attendanceReviewQueue] = await Promise.all([
      safeList(supabase,'v_timekeeping_payroll_evidence','*','signed_in_at',1000,false),
      safeList(supabase,'v_timekeeping_correction_audit','*','requested_at',1000,false),
      safeList(supabase,'v_timekeeping_attendance_summary','*',undefined,5,true),
      safeList(supabase,'v_employee_time_review_queue','*','signed_in_at',1000,false)
    ]);
    return Response.json({
      ok:true,
      scope:'timekeeping',
      actor_role:actorRole,
      actor_profile_id:actorId,
      timekeeping_evidence:evidence,
      timekeeping_corrections:corrections,
      timekeeping_summary:summary,
      attendance_review_queue:attendanceReviewQueue,
      finance_boundary:{
        payroll_export_authority:'payroll_export_runs',
        payroll_provider_actions:'Finance module only'
      },
      authority_boundary:'Payroll provider export, delivery and close controls remain in Finance.'
    }, { headers:corsHeaders });
  }

  // Reporting can be a heavy screen. Return it through a narrow fast path so
  // Admin boot does not need to load people/site/assignment directories first.
  if (scope === 'reporting' && roleRank(actorRole) >= roleRank('supervisor')) {
    const reporting: Record<string, unknown> = { ok: true, reporting_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId };
    const [
      hseSubmissionHistoryReport, hseFormDailyRollup, hseFormSiteRollup, workflowHistoryReport,
      incidentNearMissHistory, monthlyTrends, workerRollup, contextRollup, reportPresetDirectory,
      correctiveDirectory, correctiveSummary, trainingCourses, trainingRecords, trainingSummary,
      sdsAcknowledgements, supervisorQueue, siteScorecards, supervisorScorecards, overdueAlerts,
      reportSubscriptions, reportDeliveryCandidates, equipmentJsaLinks, deliveryRunHistory, schedulerStatus
    ] = await Promise.all([
      safeList(supabase, 'v_hse_submission_history_report', '*', 'submission_date', limit, false),
      safeList(supabase, 'v_hse_form_daily_rollup', '*', 'report_date', limit, false),
      safeList(supabase, 'v_hse_form_site_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_workflow_history_report', '*', 'occurred_at', limit, false),
      safeList(supabase, 'v_incident_near_miss_history', '*', 'submission_date', limit, false),
      safeList(supabase, 'v_hse_reporting_monthly_trends', '*', 'month_start', limit, false),
      safeList(supabase, 'v_hse_reporting_worker_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_hse_reporting_context_rollup', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_report_preset_directory', '*', 'updated_at', limit, false),
      safeList(supabase, 'v_corrective_action_task_directory', '*', 'due_date', limit, true),
      safeList(supabase, 'v_corrective_action_task_summary'),
      safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true),
      safeList(supabase, 'v_training_record_directory', '*', 'expires_at', limit, true),
      safeList(supabase, 'v_training_expiry_summary'),
      safeList(supabase, 'v_sds_acknowledgement_directory', '*', 'expires_at', limit, true),
      safeList(supabase, 'v_supervisor_safety_queue', '*', 'sort_at', limit, false),
      safeList(supabase, 'v_site_safety_scorecards', '*', 'last_submission_date', limit, false),
      safeList(supabase, 'v_supervisor_scorecards', '*', 'last_activity_at', limit, false),
      safeList(supabase, 'v_overdue_action_alerts', '*', 'sort_at', limit, false),
      safeList(supabase, 'v_report_subscription_directory', '*', 'next_send_at', limit, false),
      safeList(supabase, 'v_report_delivery_candidates', '*', 'next_send_at', limit, false),
      safeList(supabase, 'v_equipment_jsa_hazard_link_directory', '*', 'review_due_date', limit, false),
      safeList(supabase, 'v_report_delivery_run_history', '*', 'started_at', limit, false),
      safeList(supabase, 'v_report_delivery_scheduler_status', '*', 'setting_code', 5, true),
    ]);

    Object.assign(reporting, {
      hse_submission_history_report: hseSubmissionHistoryReport,
      hse_form_daily_rollup: hseFormDailyRollup,
      hse_form_site_rollup: hseFormSiteRollup,
      workflow_history_report: workflowHistoryReport,
      incident_near_miss_history: incidentNearMissHistory,
      hse_reporting_monthly_trends: monthlyTrends,
      hse_reporting_worker_rollup: workerRollup,
      hse_reporting_context_rollup: contextRollup,
      report_preset_directory: reportPresetDirectory,
      corrective_action_task_directory: correctiveDirectory,
      corrective_action_task_summary: correctiveSummary,
      training_course_directory: trainingCourses,
      training_record_directory: trainingRecords,
      training_expiry_summary: trainingSummary,
      sds_acknowledgement_directory: sdsAcknowledgements,
      supervisor_safety_queue: supervisorQueue,
      site_safety_scorecards: siteScorecards,
      supervisor_scorecards: supervisorScorecards,
      overdue_action_alerts: overdueAlerts,
      report_subscription_directory: reportSubscriptions,
      report_delivery_candidates: reportDeliveryCandidates,
      equipment_jsa_hazard_link_directory: equipmentJsaLinks,
      report_delivery_run_history: deliveryRunHistory,
      report_delivery_scheduler_status: schedulerStatus,
    });
    return Response.json(reporting, { headers: corsHeaders });
  }


  if (scope === 'crm' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [customers,properties,leads,plans,history,interactions,followups,opportunities,renewals,candidates,profiles] = await Promise.all([
      safeList(supabase,'v_crm_customer_directory','*','client_name',1000,true),
      safeList(supabase,'v_crm_property_directory','*','site_name',1500,true),
      safeList(supabase,'v_quote_contact_followup_queue','*','created_at',500,false),
      safeList(supabase,'v_crm_service_plan_directory','*','updated_at',1500,false),
      safeList(supabase,'v_crm_service_history','*','occurred_at',2500,false),
      safeList(supabase,'v_crm_interaction_timeline','*','occurred_at',1500,false),
      safeList(supabase,'v_crm_followup_queue','*','due_at',1500,true),
      safeList(supabase,'v_crm_opportunity_directory','*','created_at',1500,false),
      safeList(supabase,'v_crm_renewal_queue','*','end_date',1500,true),
      safeList(supabase,'v_crm_cross_service_candidates','*','client_name',1500,true),
      safeList(supabase,'profiles','id,full_name,email,role,is_active','full_name',500,true)
    ]);
    return Response.json({
      ok:true,scope:'crm',actor_role:actorRole,actor_profile_id:actorId,
      crm_customers:customers,crm_properties:properties,crm_leads:leads,crm_service_plans:plans,
      crm_service_history:history,crm_interactions:interactions,crm_followups:followups,
      crm_opportunities:opportunities,crm_renewals:renewals,crm_cross_service_candidates:candidates,crm_profiles:profiles,
      seasonal_boundary:'YW is a four-season Ontario operation: spring/summer mowing and landscaping, fall cleanup and leaf collection, and winter snow clearing/removal remain one customer/property relationship history.',
      authority_boundary:'Build 340 reuses canonical clients, client_sites, quote_contact_requests, recurring_service_agreements, estimates and work_orders.'
    }, { headers:corsHeaders });
  }

  if (scope === 'routing' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [territories,territorySites,routes,runs,stops,areas,sites,crews,profiles] = await Promise.all([
      safeList(supabase,'v_route_territory_directory','*','territory_name',500,true),
      safeList(supabase,'v_route_territory_site_directory','*','territory_name',1500,true),
      safeList(supabase,'v_route_planning_directory','*','route_name',1000,true),
      safeList(supabase,'v_route_optimization_run_directory','*','created_at',1000,false),
      safeList(supabase,'v_route_optimization_stop_directory','*','proposed_order',3000,true),
      safeList(supabase,'service_areas','*','name',500,true),
      safeList(supabase,'v_property_site_intelligence','*','site_name',1500,true),
      safeList(supabase,'v_crew_directory','*','crew_name',500,true),
      safeList(supabase,'profiles','id,full_name,email,role,is_active','full_name',500,true)
    ]);
    return Response.json({
      ok:true,scope:'routing',actor_role:actorRole,actor_profile_id:actorId,
      route_territories:territories,route_territory_sites:territorySites,route_planning:routes,
      route_optimization_runs:runs,route_optimization_stops:stops,service_areas:areas,
      route_properties:sites,route_crews:crews,route_profiles:profiles,
      seasonal_boundary:'Four-season Ontario routing covers spring/summer mowing and landscaping, fall cleanup/leaf collection, and winter snow clearing/removal with explicit storm-event activation.',
      authority_boundary:'Optimization is advisory only. public.dispatch_schedule_items remains the scheduling/dispatch authority and public.routes/public.route_stops remain canonical route structure.'
    }, { headers:corsHeaders });
  }

  if (scope === 'workability' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [rules,queue,guidance,decisions,dispatch,properties,agreements,routes,hsePackets] = await Promise.all([
      safeList(supabase,'v_workability_rule_directory','*','sort_order',500,true),
      safeList(supabase,'v_weather_workability_queue','*','observed_at',1500,false),
      safeList(supabase,'v_workability_observation_rule_guidance','*','rule_name',2500,true),
      safeList(supabase,'v_workability_decision_directory','*','decision_at',1500,false),
      safeList(supabase,'v_crew_dispatch_schedule','*','scheduled_start',1500,true),
      safeList(supabase,'v_property_site_intelligence','*','site_name',1500,true),
      safeList(supabase,'v_crm_service_plan_directory','*','updated_at',1500,false),
      safeList(supabase,'v_route_planning_directory','*','route_name',1000,true),
      safeList(supabase,'linked_hse_packets','id,packet_number,packet_status,weather_monitoring_required,weather_monitoring_completed,heat_monitoring_required,heat_monitoring_completed,work_order_id,dispatch_schedule_item_id,route_id,site_id','created_at',800,false)
    ]);
    return Response.json({
      ok:true,scope:'workability',actor_role:actorRole,actor_profile_id:actorId,
      workability_rules:rules,workability_queue:queue,workability_guidance:guidance,
      workability_decisions:decisions,workability_dispatch:dispatch,workability_properties:properties,
      workability_agreements:agreements,workability_routes:routes,workability_hse_packets:hsePackets,
      seasonal_boundary:'Four-season Ontario workability covers mowing/landscaping, fall cleanup/leaf collection and winter snow clearing/removal, including snowfall, freezing rain/ice and cold exposure context.',
      decision_boundary:'Guidance never makes an automatic safety decision. Supervisors record the decision; existing dispatch and recurring-service actions apply schedule changes; customer-notification readiness is evidence only.'
    }, { headers:corsHeaders });
  }

  if (scope === 'material_estimator' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [plans,lines,actualUse,materials,properties,estimates,workOrders] = await Promise.all([
      safeList(supabase,'v_landscape_material_estimate_directory','*','updated_at',1500,false),
      safeList(supabase,'v_landscape_material_line_directory','*','updated_at',3000,false),
      safeList(supabase,'v_landscape_material_actual_use_directory','*','recorded_at',3000,false),
      safeList(supabase,'v_material_stock_control','*','item_name',1500,true),
      safeList(supabase,'v_property_site_intelligence','*','site_name',1500,true),
      safeList(supabase,'estimates','id,estimate_number,status,quote_title,client_site_id','updated_at',1500,false),
      safeList(supabase,'work_orders','id,work_order_number,status,estimate_id,client_site_id,scheduled_start','updated_at',1500,false)
    ]);
    return Response.json({
      ok:true,scope:'material_estimator',actor_role:actorRole,actor_profile_id:actorId,
      material_estimator_plans:plans,material_estimator_lines:lines,material_estimator_actual_use:actualUse,
      material_estimator_materials:materials,material_estimator_properties:properties,
      material_estimator_estimates:estimates,material_estimator_work_orders:workOrders,
      seasonal_boundary:'Four-season estimator coverage includes landscaping/fall work plus winter salt/de-icer and traction materials.',
      authority_boundary:'Build 343 is planning/evidence only. Existing materials catalog/receipts/issues/adjustments, estimates, work orders and property records remain canonical inventory/commercial/site authority.'
    }, { headers:corsHeaders });
  }


  if (scope === 'change_orders_extras' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [changeOrders,evidence,applications,workOrders,invoiceCandidates] = await Promise.all([
      safeList(supabase,'v_change_order_extras_directory','*','updated_at',1500,false),
      safeList(supabase,'v_change_order_evidence_directory','*','captured_at',3000,false),
      safeList(supabase,'v_change_order_budget_application_directory','*','applied_at',1500,false),
      safeList(supabase,'work_orders','id,work_order_number,status,estimate_id,client_id,client_site_id,work_type,scheduled_start,total_cost,total_amount','updated_at',1500,false),
      safeList(supabase,'job_invoice_candidates','id,candidate_number,candidate_status,work_order_id,estimate_id,total_amount,created_at','created_at',1500,false)
    ]);
    return Response.json({
      ok:true,scope:'change_orders_extras',actor_role:actorRole,actor_profile_id:actorId,
      change_order_extras:changeOrders,change_order_evidence:evidence,
      change_order_budget_applications:applications,change_order_work_orders:workOrders,
      change_order_invoice_candidates:invoiceCandidates,
      seasonal_boundary:'Four-season change-order context covers mowing/landscaping, landscape installation, fall cleanup and winter snow clearing/removal.',
      authority_boundary:'Build 344 extends canonical change_orders/work_orders/work_order_lines. Crew discovery/evidence cannot price work; supervisor review and customer authorization gate one budget application; Finance invoice creation/posting remains separate.'
    }, { headers:corsHeaders });
  }


  if (scope === 'quality_control' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [templates,templateItems,runs,items,evidence,deficiencies,workOrders,proofs,sessions,closeouts] = await Promise.all([
      safeList(supabase,'v_quality_control_template_directory','*','template_name',500,true),
      safeList(supabase,'quality_control_template_items','id,template_id,item_code,item_prompt,evidence_requirement,is_required,sort_order,is_active','sort_order',2500,true),
      safeList(supabase,'v_quality_control_run_directory','*','updated_at',1500,false),
      safeList(supabase,'v_quality_control_item_directory','*','sort_order',4000,true),
      safeList(supabase,'v_quality_control_evidence_directory','*','linked_at',4000,false),
      safeList(supabase,'v_quality_control_deficiency_directory','*','updated_at',3000,false),
      safeList(supabase,'work_orders','id,work_order_number,status,work_type,client_id,client_site_id,scheduled_start,scheduled_end','updated_at',2000,false),
      safeList(supabase,'work_order_execution_proofs','id,work_order_id,proof_type,proof_status,customer_visible,title,customer_summary,occurred_at','occurred_at',4000,false),
      safeList(supabase,'job_sessions','id,work_order_id,session_date,session_status,completion_state,started_at,ended_at','session_date',2500,false),
      safeList(supabase,'work_order_closeout_packages','id,work_order_id,closeout_status,customer_signoff_required,customer_signoff_status,customer_summary,signed_off_by_name,signed_off_at,invoice_readiness_status','updated_at',2000,false)
    ]);
    return Response.json({
      ok:true,scope:'quality_control',actor_role:actorRole,actor_profile_id:actorId,
      quality_control_templates:templates,quality_control_template_items:templateItems,quality_control_runs:runs,quality_control_items:items,
      quality_control_evidence:evidence,quality_control_deficiencies:deficiencies,
      quality_control_work_orders:workOrders,quality_control_execution_proofs:proofs,
      quality_control_sessions:sessions,quality_control_closeouts:closeouts,
      seasonal_boundary:'Four-season QC covers mowing/landscaping, landscape installation, fall cleanup/leaf collection and winter snow clearing/removal using one shared quality model.',
      authority_boundary:'Build 345 links canonical work_order_execution_proofs and reads canonical work_order_closeout_packages/customer signoff. Staff QC cannot create customer signoff; the existing customer portal remains authoritative.'
    }, { headers:corsHeaders });
  }


  if (scope === 'seasonal_operations' && roleRank(actorRole) >= roleRank('supervisor')) {
    const [
      cycles,templates,items,readiness,rollovers,storms,stormRoutes,outstanding,
      recurringPrograms,crewSchedule,crews,maintenance,materialStock,routePlanning,workability,routes
    ] = await Promise.all([
      safeList(supabase,'v_seasonal_operations_cycle_directory','*','season_year',500,false),
      safeList(supabase,'seasonal_operations_checklist_templates','*','sort_order',500,true),
      safeList(supabase,'seasonal_operations_checklist_items','*','updated_at',3000,false),
      safeList(supabase,'v_seasonal_operations_readiness_directory','*','reviewed_at',3000,false),
      safeList(supabase,'v_seasonal_operations_rollover_directory','*','decided_at',3000,false),
      safeList(supabase,'seasonal_storm_events','*','planned_start',1000,false),
      safeList(supabase,'v_seasonal_storm_route_directory','*','updated_at',3000,false),
      safeList(supabase,'v_seasonal_operations_outstanding_work','*','due_date',4000,true),
      safeList(supabase,'v_recurring_service_program_directory','*','next_service_date',2500,true),
      safeList(supabase,'v_crew_dispatch_schedule','*','scheduled_start',2500,true),
      safeList(supabase,'v_workforce_crew_directory','*','crew_name',500,true),
      safeList(supabase,'v_preventive_maintenance_workbench','*','due_date',2500,true),
      safeList(supabase,'v_material_stock_control','*','item_name',2500,true),
      safeList(supabase,'v_route_planning_directory','*','route_name',1000,true),
      safeList(supabase,'v_weather_workability_queue','*','observed_at',2000,false),
      safeList(supabase,'routes','id,route_code,name,season_context,default_crew_id,service_priority,storm_event_capable,is_active,default_equipment_requirements','name',1000,true)
    ]);
    return Response.json({
      ok:true,scope:'seasonal_operations',actor_role:actorRole,actor_profile_id:actorId,
      seasonal_operations_cycles:cycles,
      seasonal_operations_checklist_templates:templates,
      seasonal_operations_checklist_items:items,
      seasonal_operations_readiness:readiness,
      seasonal_operations_rollovers:rollovers,
      seasonal_storm_events:storms,
      seasonal_storm_routes:stormRoutes,
      seasonal_operations_outstanding_work:outstanding,
      canonical_recurring_programs:recurringPrograms,
      canonical_crew_schedule:crewSchedule,
      canonical_crews:crews,
      canonical_preventive_maintenance:maintenance,
      canonical_material_stock:materialStock,
      canonical_route_planning:routePlanning,
      canonical_workability:workability,
      canonical_routes:routes,
      winter_boundary:'Winter snow-clearing/removal is a core operating season. Storm activation is available only inside a winter cycle.',
      authority_boundary:'Build 346 coordinates recurring-customer rollover, staffing, equipment, materials, routes and workability without replacing their canonical modules. Storm activation never makes a route storm-capable; route planning must do that first.'
    }, { headers:corsHeaders });
  }

  // Narrow Admin panel fast paths. These avoid loading the full people/site/accounting directory
  // when the UI only needs one panel refresh on slower mobile connections.
  if (scope === 'operations' && roleRank(actorRole) >= roleRank('supervisor')) {
    const operations: Record<string, unknown> = { ok: true, operations_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole, supports_server_paging: true, supports_sorting: true } };
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    operations.jobs = jobsPaged.rows;
    operations.pagination_meta = { ...(operations.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    operations.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    operations.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    operations.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    operations.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    operations.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    return Response.json(operations, { headers: corsHeaders });
  }

  if (scope === 'command_center' && roleRank(actorRole) >= roleRank('supervisor')) {
    const commandCenter: Record<string, unknown> = { ok: true, command_center_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    commandCenter.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    commandCenter.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 80, true);
    commandCenter.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 20, false);
    commandCenter.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    commandCenter.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    commandCenter.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    commandCenter.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    commandCenter.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    commandCenter.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    commandCenter.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    commandCenter.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    commandCenter.app_deployment_bundle_checks = await safeList(supabase, 'v_app_deployment_bundle_checks', '*', 'sort_order', 80, true);
    commandCenter.app_public_seo_checks = await safeList(supabase, 'v_app_public_seo_checks', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_checks = await safeList(supabase, 'v_app_runtime_fallback_checks', '*', 'sort_order', 80, true);
    commandCenter.app_roadmap_action_steps = await safeList(supabase, 'v_app_roadmap_action_steps', '*', 'sort_order', 140, true);
    commandCenter.app_depth_review_queue = await safeList(supabase, 'v_app_depth_review_queue', '*', 'sort_order', 80, true);
    commandCenter.app_data_migration_candidates = await safeList(supabase, 'v_app_data_migration_candidates', '*', 'sort_order', 80, true);
    commandCenter.app_schema_documentation_sync_checks = await safeList(supabase, 'v_app_schema_documentation_sync_checks', '*', 'sort_order', 80, true);
    commandCenter.app_public_route_seo_registry = await safeList(supabase, 'v_app_public_route_seo_registry', '*', 'sort_order', 80, true);
    commandCenter.app_internal_link_suggestion_queue = await safeList(supabase, 'v_app_internal_link_suggestion_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_component_token_inventory = await safeList(supabase, 'v_app_css_component_token_inventory', '*', 'sort_order', 80, true);
    commandCenter.app_mobile_field_action_queue = await safeList(supabase, 'v_app_mobile_field_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_manifest_checks = await safeList(supabase, 'v_app_release_manifest_checks', '*', 'sort_order', 80, true);
    commandCenter.app_payment_application_action_registry = await safeList(supabase, 'v_app_payment_application_action_registry', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_close_control_queue = await safeList(supabase, 'v_app_accounting_close_control_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_accountability_action_queue = await safeList(supabase, 'v_app_equipment_accountability_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_public_seo_publication_queue = await safeList(supabase, 'v_app_public_seo_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_fallback_observability_matrix = await safeList(supabase, 'v_app_fallback_observability_matrix', '*', 'sort_order', 80, true);
    commandCenter.app_schema_migration_compatibility_checks = await safeList(supabase, 'v_app_schema_migration_compatibility_checks', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_evidence_package_queue = await safeList(supabase, 'v_app_accounting_evidence_package_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_return_to_service_rules = await safeList(supabase, 'v_app_equipment_return_to_service_rules', '*', 'sort_order', 80, true);
    commandCenter.app_public_asset_smoke_checks = await safeList(supabase, 'v_app_public_asset_smoke_checks', '*', 'sort_order', 80, true);
    commandCenter.app_error_recovery_playbook = await safeList(supabase, 'v_app_error_recovery_playbook', '*', 'sort_order', 80, true);
    commandCenter.app_payment_execution_queue = await safeList(supabase, 'v_app_payment_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_bank_reconciliation_execution_queue = await safeList(supabase, 'v_app_bank_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_template_registry = await safeList(supabase, 'v_app_equipment_scan_template_registry', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_execution_queue = await safeList(supabase, 'v_app_local_seo_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_fallback_drill_queue = await safeList(supabase, 'v_app_fallback_drill_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_application_ui_queue = await safeList(supabase, 'v_app_payment_application_ui_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_import_validation_queue = await safeList(supabase, 'v_app_reconciliation_import_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_service_closeout_queue = await safeList(supabase, 'v_app_equipment_service_closeout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_seo_asset_publication_queue = await safeList(supabase, 'v_app_seo_asset_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_recovery_telemetry_queue = await safeList(supabase, 'v_app_runtime_recovery_telemetry_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_match_workbench_queue = await safeList(supabase, 'v_app_reconciliation_match_workbench_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_verification_queue = await safeList(supabase, 'v_app_equipment_scan_verification_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_asset_smoke_queue = await safeList(supabase, 'v_app_local_seo_asset_smoke_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_drill_history_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_history_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_write_path_queue = await safeList(supabase, 'v_app_payment_write_path_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_scoring_rule_queue = await safeList(supabase, 'v_app_reconciliation_scoring_rule_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_accessory_template_queue = await safeList(supabase, 'v_app_equipment_accessory_template_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_generation_queue = await safeList(supabase, 'v_app_local_seo_generation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_mobile_offline_conflict_resolution_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_resolution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_adjustment_workflow_queue = await safeList(supabase, 'v_app_payment_adjustment_workflow_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_exception_resolution_queue = await safeList(supabase, 'v_app_reconciliation_exception_resolution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_rollout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_content_depth_queue = await safeList(supabase, 'v_app_local_seo_content_depth_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_error_message_catalog = await safeList(supabase, 'v_app_runtime_error_message_catalog', '*', 'sort_order', 80, true);
    commandCenter.app_release_validation_queue = await safeList(supabase, 'v_app_release_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_reconciliation_execution_queue = await safeList(supabase, 'v_app_payment_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_mobile_scan_validation_queue = await safeList(supabase, 'v_app_equipment_mobile_scan_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_release_validation_queue = await safeList(supabase, 'v_app_local_seo_release_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_message_queue = await safeList(supabase, 'v_app_runtime_fallback_message_queue', '*', 'sort_order', 80, true);
    commandCenter.app_json_db_migration_execution_queue = await safeList(supabase, 'v_app_json_db_migration_execution_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_cutover_checklist = await safeList(supabase, 'v_app_release_cutover_checklist', '*', 'sort_order', 80, true);
    commandCenter.app_payment_exception_decision_queue = await safeList(supabase, 'v_app_payment_exception_decision_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_return_to_service_gate_queue = await safeList(supabase, 'v_app_equipment_return_to_service_gate_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_search_evidence_queue = await safeList(supabase, 'v_app_local_search_evidence_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_drift_watchlist = await safeList(supabase, 'v_app_css_drift_watchlist', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_test_plan = await safeList(supabase, 'v_app_runtime_fallback_test_plan', '*', 'sort_order', 80, true);
    commandCenter.app_json_db_source_of_truth_queue = await safeList(supabase, 'v_app_json_db_source_of_truth_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_reconciliation_cutover_drill_queue = await safeList(supabase, 'v_app_payment_reconciliation_cutover_drill_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_service_cost_recovery_queue = await safeList(supabase, 'v_app_equipment_service_cost_recovery_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_prominence_action_queue = await safeList(supabase, 'v_app_local_seo_prominence_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_accessibility_fallback_queue = await safeList(supabase, 'v_app_css_accessibility_fallback_queue', '*', 'sort_order', 80, true);
    commandCenter.app_data_migration_validation_queue = await safeList(supabase, 'v_app_data_migration_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_release_message_queue = await safeList(supabase, 'v_app_runtime_release_message_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_readiness_signoff_queue = await safeList(supabase, 'v_app_release_readiness_signoff_queue', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_exception_closure_queue = await safeList(supabase, 'v_app_accounting_exception_closure_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_service_verification_queue = await safeList(supabase, 'v_app_equipment_service_verification_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_refresh_queue = await safeList(supabase, 'v_app_local_seo_refresh_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_mobile_regression_queue = await safeList(supabase, 'v_app_css_mobile_regression_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_observability_release_queue = await safeList(supabase, 'v_app_runtime_observability_release_queue', '*', 'sort_order', 80, true);
    commandCenter.app_accounting_cutover_trial_balance_queue = await safeList(supabase, 'v_app_accounting_cutover_trial_balance_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_asset_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_asset_rollout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_prominence_publication_queue = await safeList(supabase, 'v_app_local_seo_prominence_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_mobile_release_guard_queue = await safeList(supabase, 'v_app_css_mobile_release_guard_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_support_playbook_queue = await safeList(supabase, 'v_app_runtime_support_playbook_queue', '*', 'sort_order', 80, true);
    commandCenter.app_data_source_migration_lock_queue = await safeList(supabase, 'v_app_data_source_migration_lock_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_exit_criteria_queue = await safeList(supabase, 'v_app_release_exit_criteria_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_closeout_action_queue = await safeList(supabase, 'v_app_payment_closeout_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_exception_workflow_queue = await safeList(supabase, 'v_app_reconciliation_exception_workflow_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_chain_of_custody_queue = await safeList(supabase, 'v_app_equipment_chain_of_custody_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_conversion_queue = await safeList(supabase, 'v_app_local_seo_conversion_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_escalation_queue = await safeList(supabase, 'v_app_runtime_fallback_escalation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_release_handoff_queue = await safeList(supabase, 'v_app_release_handoff_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_custody_evidence_queue = await safeList(supabase, 'v_app_equipment_custody_evidence_queue', '*', 'sort_order', 80, true);
    commandCenter.app_seo_conversion_evidence_queue = await safeList(supabase, 'v_app_seo_conversion_evidence_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_event_log_queue = await safeList(supabase, 'v_app_runtime_fallback_event_log_queue', '*', 'sort_order', 80, true);
    commandCenter.app_schema_deploy_repair_queue = await safeList(supabase, 'v_app_schema_deploy_repair_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_reconciliation_proof_closeout_queue = await safeList(supabase, 'v_app_payment_reconciliation_proof_closeout_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_return_exception_action_queue = await safeList(supabase, 'v_app_equipment_return_exception_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_search_prominence_evidence_queue = await safeList(supabase, 'v_app_local_search_prominence_evidence_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_observability_queue = await safeList(supabase, 'v_app_runtime_fallback_observability_queue', '*', 'sort_order', 80, true);
    commandCenter.app_json_db_source_migration_queue = await safeList(supabase, 'v_app_json_db_source_migration_queue', '*', 'sort_order', 80, true);
    commandCenter.app_desktop_mobile_surface_parity_queue = await safeList(supabase, 'v_app_desktop_mobile_surface_parity_queue', '*', 'sort_order', 80, true);
    commandCenter.app_visual_professional_enrichment_queue = await safeList(supabase, 'v_app_visual_professional_enrichment_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_search_content_depth_queue = await safeList(supabase, 'v_app_local_search_content_depth_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_motion_image_guard_queue = await safeList(supabase, 'v_app_css_motion_image_guard_queue', '*', 'sort_order', 80, true);
    commandCenter.app_schema_deploy_validation_queue = await safeList(supabase, 'v_app_schema_deploy_validation_queue', '*', 'sort_order', 80, true);
    commandCenter.app_source_consolidation_decision_queue = await safeList(supabase, 'v_app_source_consolidation_decision_queue', '*', 'sort_order', 80, true);
    commandCenter.app_visual_asset_publication_queue = await safeList(supabase, 'v_app_visual_asset_publication_queue', '*', 'sort_order', 80, true);
    commandCenter.app_desktop_mobile_release_polish_queue = await safeList(supabase, 'v_app_desktop_mobile_release_polish_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_seo_trust_signal_queue = await safeList(supabase, 'v_app_local_seo_trust_signal_queue', '*', 'sort_order', 80, true);
    commandCenter.app_css_visual_regression_queue = await safeList(supabase, 'v_app_css_visual_regression_queue', '*', 'sort_order', 80, true);
    commandCenter.app_runtime_fallback_drill_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_queue', '*', 'sort_order', 80, true);
    commandCenter.app_db_source_registry_candidate_queue = await safeList(supabase, 'v_app_db_source_registry_candidate_queue', '*', 'sort_order', 80, true);
    commandCenter.app_sanity_check_snapshot_queue = await safeList(supabase, 'v_app_sanity_check_snapshot_queue', '*', 'sort_order', 80, true);
    commandCenter.app_value_added_modification_queue = await safeList(supabase, 'v_app_value_added_modification_queue', '*', 'sort_order', 80, true);
    commandCenter.app_desktop_mobile_value_gap_queue = await safeList(supabase, 'v_app_desktop_mobile_value_gap_queue', '*', 'sort_order', 80, true);
    commandCenter.app_visual_professional_backlog_queue = await safeList(supabase, 'v_app_visual_professional_backlog_queue', '*', 'sort_order', 80, true);
    commandCenter.app_local_search_value_queue = await safeList(supabase, 'v_app_local_search_value_queue', '*', 'sort_order', 80, true);
    commandCenter.app_source_of_truth_migration_value_queue = await safeList(supabase, 'v_app_source_of_truth_migration_value_queue', '*', 'sort_order', 80, true);
    commandCenter.app_payment_action_workbench_queue = await safeList(supabase, 'v_app_payment_action_workbench_queue', '*', 'sort_order', 80, true);
    commandCenter.app_bank_csv_import_preview_queue = await safeList(supabase, 'v_app_bank_csv_import_preview_queue', '*', 'sort_order', 80, true);
    commandCenter.app_reconciliation_match_action_queue = await safeList(supabase, 'v_app_reconciliation_match_action_queue', '*', 'sort_order', 80, true);
    commandCenter.app_equipment_scan_custody_workbench_queue = await safeList(supabase, 'v_app_equipment_scan_custody_workbench_queue', '*', 'sort_order', 80, true);
    commandCenter.app_visual_asset_approval_registry = await safeList(supabase, 'v_app_visual_asset_approval_registry', '*', 'sort_order', 80, true);
    commandCenter.app_public_route_publication_registry = await safeList(supabase, 'v_app_public_route_publication_registry', '*', 'sort_order', 80, true);
    commandCenter.app_quote_contact_intake_registry = await safeList(supabase, 'v_app_quote_contact_intake_registry', '*', 'sort_order', 80, true);
    commandCenter.app_mobile_offline_conflict_card_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_card_queue', '*', 'sort_order', 80, true);
    commandCenter.app_admin_scorecard_progress_rail_queue = await safeList(supabase, 'v_app_admin_scorecard_progress_rail_queue', '*', 'sort_order', 80, true);
    commandCenter.app_markdown_consolidation_registry = await safeList(supabase, 'v_app_markdown_consolidation_registry', '*', 'sort_order', 80, true);
    commandCenter.app_visual_placeholder_registry = await safeList(supabase, 'v_app_visual_placeholder_registry', '*', 'sort_order', 80, true);
    commandCenter.app_competitive_seo_enhancement_queue = await safeList(supabase, 'v_app_competitive_seo_enhancement_queue', '*', 'sort_order', 80, true);
    commandCenter.app_desktop_mobile_polish_queue = await safeList(supabase, 'v_app_desktop_mobile_polish_queue', '*', 'sort_order', 80, true);
    commandCenter.app_next_step_sanity_queue = await safeList(supabase, 'v_app_next_step_sanity_queue', '*', 'sort_order', 80, true);
    commandCenter.quote_contact_requests = await safeList(supabase, 'v_quote_contact_requests', '*', 'created_at', 80, false);
    commandCenter.payment_action_requests = await safeList(supabase, 'v_payment_action_requests', '*', 'created_at', 80, false);
    commandCenter.bank_csv_import_previews = await safeList(supabase, 'v_bank_csv_import_previews', '*', 'created_at', 80, false);
    commandCenter.bank_csv_import_preview_rows = await safeList(supabase, 'v_bank_csv_import_preview_rows', '*', 'row_number', 200, true);
    commandCenter.reconciliation_action_requests = await safeList(supabase, 'v_reconciliation_action_requests', '*', 'created_at', 80, false);
    commandCenter.equipment_scan_events = await safeList(supabase, 'v_equipment_scan_events', '*', 'created_at', 80, false);
    commandCenter.equipment_custody_timeline_events = await safeList(supabase, 'v_equipment_custody_timeline_events', '*', 'created_at', 80, false);
    commandCenter.visual_asset_approval_items = await safeList(supabase, 'v_visual_asset_approval_items', '*', 'created_at', 80, false);
    commandCenter.public_route_approval_items = await safeList(supabase, 'v_public_route_approval_items', '*', 'created_at', 80, false);
    commandCenter.mobile_offline_conflict_cards = await safeList(supabase, 'v_mobile_offline_conflict_cards', '*', 'created_at', 80, false);
    commandCenter.admin_scorecard_progress_rails = await safeList(supabase, 'v_admin_scorecard_progress_rails', '*', 'sort_order', 80, true);
    commandCenter.operation_write_audit_events = await safeList(supabase, 'v_operation_write_audit_events', '*', 'created_at', 100, false);
    commandCenter.quote_contact_followup_queue = await safeList(supabase, 'v_quote_contact_followup_queue', '*', 'followup_due_at', 100, true);
    commandCenter.payment_action_workbench = await safeList(supabase, 'v_payment_action_workbench', '*', 'created_at', 100, false);
    commandCenter.bank_csv_import_workbench = await safeList(supabase, 'v_bank_csv_import_workbench', '*', 'created_at', 100, false);
    commandCenter.visual_asset_publication_readiness = await safeList(supabase, 'v_visual_asset_publication_readiness', '*', 'updated_at', 100, false);
    commandCenter.public_route_publication_readiness = await safeList(supabase, 'v_public_route_publication_readiness', '*', 'updated_at', 100, false);
    commandCenter.admin_operations_cockpit_scorecards = await safeList(supabase, 'v_admin_operations_cockpit_scorecards', '*', 'metric_key', 50, true);

    commandCenter.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    commandCenter.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    commandCenter.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    commandCenter.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    return Response.json(commandCenter, { headers: corsHeaders });
  }

  if (scope === 'health' && roleRank(actorRole) >= roleRank('supervisor')) {
    const health: Record<string, unknown> = { ok: true, health_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    health.admin_error_health_center = await safeList(supabase, 'v_admin_error_health_center', '*', 'severity_rank', 100, true);
    health.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 120, true);
    health.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 122, false);
    health.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    health.production_readiness_checklist = await safeList(supabase, 'v_production_readiness_checklist', '*', 'sort_order', 80, true);
    health.role_permission_matrix = await safeList(supabase, 'v_role_permission_matrix', '*', 'sort_order', 120, true);
    health.admin_health_resolution_queue = await safeList(supabase, 'v_admin_health_resolution_queue', '*', 'updated_at', 80, false);
    health.admin_deployment_gate_status = await safeList(supabase, 'v_admin_deployment_gate_status', '*', 'sort_order', 80, true);
    health.public_seo_smoke_check = await safeList(supabase, 'v_public_seo_smoke_check', '*', 'page_path', 80, true);
    health.admin_audit_event_directory = await safeList(supabase, 'v_admin_audit_event_directory', '*', 'occurred_at', 80, false);
    health.admin_panel_load_diagnostics = await safeList(supabase, 'v_admin_panel_load_diagnostics', '*', 'captured_at', 80, false);
    health.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    health.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    health.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    health.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    health.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    health.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    health.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    health.app_deployment_bundle_checks = await safeList(supabase, 'v_app_deployment_bundle_checks', '*', 'sort_order', 80, true);
    health.app_public_seo_checks = await safeList(supabase, 'v_app_public_seo_checks', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_checks = await safeList(supabase, 'v_app_runtime_fallback_checks', '*', 'sort_order', 80, true);
    health.app_roadmap_action_steps = await safeList(supabase, 'v_app_roadmap_action_steps', '*', 'sort_order', 140, true);
    health.app_depth_review_queue = await safeList(supabase, 'v_app_depth_review_queue', '*', 'sort_order', 80, true);
    health.app_data_migration_candidates = await safeList(supabase, 'v_app_data_migration_candidates', '*', 'sort_order', 80, true);
    health.app_schema_documentation_sync_checks = await safeList(supabase, 'v_app_schema_documentation_sync_checks', '*', 'sort_order', 80, true);
    health.app_public_route_seo_registry = await safeList(supabase, 'v_app_public_route_seo_registry', '*', 'sort_order', 80, true);
    health.app_internal_link_suggestion_queue = await safeList(supabase, 'v_app_internal_link_suggestion_queue', '*', 'sort_order', 80, true);
    health.app_css_component_token_inventory = await safeList(supabase, 'v_app_css_component_token_inventory', '*', 'sort_order', 80, true);
    health.app_mobile_field_action_queue = await safeList(supabase, 'v_app_mobile_field_action_queue', '*', 'sort_order', 80, true);
    health.app_release_manifest_checks = await safeList(supabase, 'v_app_release_manifest_checks', '*', 'sort_order', 80, true);
    health.app_payment_application_action_registry = await safeList(supabase, 'v_app_payment_application_action_registry', '*', 'sort_order', 80, true);
    health.app_accounting_close_control_queue = await safeList(supabase, 'v_app_accounting_close_control_queue', '*', 'sort_order', 80, true);
    health.app_equipment_accountability_action_queue = await safeList(supabase, 'v_app_equipment_accountability_action_queue', '*', 'sort_order', 80, true);
    health.app_public_seo_publication_queue = await safeList(supabase, 'v_app_public_seo_publication_queue', '*', 'sort_order', 80, true);
    health.app_fallback_observability_matrix = await safeList(supabase, 'v_app_fallback_observability_matrix', '*', 'sort_order', 80, true);
    health.app_schema_migration_compatibility_checks = await safeList(supabase, 'v_app_schema_migration_compatibility_checks', '*', 'sort_order', 80, true);
    health.app_accounting_evidence_package_queue = await safeList(supabase, 'v_app_accounting_evidence_package_queue', '*', 'sort_order', 80, true);
    health.app_equipment_return_to_service_rules = await safeList(supabase, 'v_app_equipment_return_to_service_rules', '*', 'sort_order', 80, true);
    health.app_public_asset_smoke_checks = await safeList(supabase, 'v_app_public_asset_smoke_checks', '*', 'sort_order', 80, true);
    health.app_error_recovery_playbook = await safeList(supabase, 'v_app_error_recovery_playbook', '*', 'sort_order', 80, true);
    health.app_payment_execution_queue = await safeList(supabase, 'v_app_payment_execution_queue', '*', 'sort_order', 80, true);
    health.app_bank_reconciliation_execution_queue = await safeList(supabase, 'v_app_bank_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_template_registry = await safeList(supabase, 'v_app_equipment_scan_template_registry', '*', 'sort_order', 80, true);
    health.app_local_seo_execution_queue = await safeList(supabase, 'v_app_local_seo_execution_queue', '*', 'sort_order', 80, true);
    health.app_fallback_drill_queue = await safeList(supabase, 'v_app_fallback_drill_queue', '*', 'sort_order', 80, true);
    health.app_payment_application_ui_queue = await safeList(supabase, 'v_app_payment_application_ui_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_import_validation_queue = await safeList(supabase, 'v_app_reconciliation_import_validation_queue', '*', 'sort_order', 80, true);
    health.app_equipment_service_closeout_queue = await safeList(supabase, 'v_app_equipment_service_closeout_queue', '*', 'sort_order', 80, true);
    health.app_seo_asset_publication_queue = await safeList(supabase, 'v_app_seo_asset_publication_queue', '*', 'sort_order', 80, true);
    health.app_runtime_recovery_telemetry_queue = await safeList(supabase, 'v_app_runtime_recovery_telemetry_queue', '*', 'sort_order', 80, true);
    health.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_match_workbench_queue = await safeList(supabase, 'v_app_reconciliation_match_workbench_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_verification_queue = await safeList(supabase, 'v_app_equipment_scan_verification_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_asset_smoke_queue = await safeList(supabase, 'v_app_local_seo_asset_smoke_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_drill_history_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_history_queue', '*', 'sort_order', 80, true);
    health.app_payment_write_path_queue = await safeList(supabase, 'v_app_payment_write_path_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_scoring_rule_queue = await safeList(supabase, 'v_app_reconciliation_scoring_rule_queue', '*', 'sort_order', 80, true);
    health.app_equipment_accessory_template_queue = await safeList(supabase, 'v_app_equipment_accessory_template_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_generation_queue = await safeList(supabase, 'v_app_local_seo_generation_queue', '*', 'sort_order', 80, true);
    health.app_mobile_offline_conflict_resolution_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_resolution_queue', '*', 'sort_order', 80, true);
    health.app_payment_adjustment_workflow_queue = await safeList(supabase, 'v_app_payment_adjustment_workflow_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_exception_resolution_queue = await safeList(supabase, 'v_app_reconciliation_exception_resolution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_rollout_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_content_depth_queue = await safeList(supabase, 'v_app_local_seo_content_depth_queue', '*', 'sort_order', 80, true);
    health.app_runtime_error_message_catalog = await safeList(supabase, 'v_app_runtime_error_message_catalog', '*', 'sort_order', 80, true);
    health.app_release_validation_queue = await safeList(supabase, 'v_app_release_validation_queue', '*', 'sort_order', 80, true);
    health.app_payment_reconciliation_execution_queue = await safeList(supabase, 'v_app_payment_reconciliation_execution_queue', '*', 'sort_order', 80, true);
    health.app_equipment_mobile_scan_validation_queue = await safeList(supabase, 'v_app_equipment_mobile_scan_validation_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_release_validation_queue = await safeList(supabase, 'v_app_local_seo_release_validation_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_message_queue = await safeList(supabase, 'v_app_runtime_fallback_message_queue', '*', 'sort_order', 80, true);
    health.app_json_db_migration_execution_queue = await safeList(supabase, 'v_app_json_db_migration_execution_queue', '*', 'sort_order', 80, true);
    health.app_release_cutover_checklist = await safeList(supabase, 'v_app_release_cutover_checklist', '*', 'sort_order', 80, true);
    health.app_payment_exception_decision_queue = await safeList(supabase, 'v_app_payment_exception_decision_queue', '*', 'sort_order', 80, true);
    health.app_equipment_return_to_service_gate_queue = await safeList(supabase, 'v_app_equipment_return_to_service_gate_queue', '*', 'sort_order', 80, true);
    health.app_local_search_evidence_queue = await safeList(supabase, 'v_app_local_search_evidence_queue', '*', 'sort_order', 80, true);
    health.app_css_drift_watchlist = await safeList(supabase, 'v_app_css_drift_watchlist', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_test_plan = await safeList(supabase, 'v_app_runtime_fallback_test_plan', '*', 'sort_order', 80, true);
    health.app_json_db_source_of_truth_queue = await safeList(supabase, 'v_app_json_db_source_of_truth_queue', '*', 'sort_order', 80, true);
    health.app_payment_reconciliation_cutover_drill_queue = await safeList(supabase, 'v_app_payment_reconciliation_cutover_drill_queue', '*', 'sort_order', 80, true);
    health.app_equipment_service_cost_recovery_queue = await safeList(supabase, 'v_app_equipment_service_cost_recovery_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_prominence_action_queue = await safeList(supabase, 'v_app_local_seo_prominence_action_queue', '*', 'sort_order', 80, true);
    health.app_css_accessibility_fallback_queue = await safeList(supabase, 'v_app_css_accessibility_fallback_queue', '*', 'sort_order', 80, true);
    health.app_data_migration_validation_queue = await safeList(supabase, 'v_app_data_migration_validation_queue', '*', 'sort_order', 80, true);
    health.app_runtime_release_message_queue = await safeList(supabase, 'v_app_runtime_release_message_queue', '*', 'sort_order', 80, true);
    health.app_release_readiness_signoff_queue = await safeList(supabase, 'v_app_release_readiness_signoff_queue', '*', 'sort_order', 80, true);
    health.app_accounting_exception_closure_queue = await safeList(supabase, 'v_app_accounting_exception_closure_queue', '*', 'sort_order', 80, true);
    health.app_equipment_service_verification_queue = await safeList(supabase, 'v_app_equipment_service_verification_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_refresh_queue = await safeList(supabase, 'v_app_local_seo_refresh_queue', '*', 'sort_order', 80, true);
    health.app_css_mobile_regression_queue = await safeList(supabase, 'v_app_css_mobile_regression_queue', '*', 'sort_order', 80, true);
    health.app_runtime_observability_release_queue = await safeList(supabase, 'v_app_runtime_observability_release_queue', '*', 'sort_order', 80, true);
    health.app_accounting_cutover_trial_balance_queue = await safeList(supabase, 'v_app_accounting_cutover_trial_balance_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_asset_rollout_queue = await safeList(supabase, 'v_app_equipment_scan_asset_rollout_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_prominence_publication_queue = await safeList(supabase, 'v_app_local_seo_prominence_publication_queue', '*', 'sort_order', 80, true);
    health.app_css_mobile_release_guard_queue = await safeList(supabase, 'v_app_css_mobile_release_guard_queue', '*', 'sort_order', 80, true);
    health.app_runtime_support_playbook_queue = await safeList(supabase, 'v_app_runtime_support_playbook_queue', '*', 'sort_order', 80, true);
    health.app_data_source_migration_lock_queue = await safeList(supabase, 'v_app_data_source_migration_lock_queue', '*', 'sort_order', 80, true);
    health.app_release_exit_criteria_queue = await safeList(supabase, 'v_app_release_exit_criteria_queue', '*', 'sort_order', 80, true);
    health.app_payment_closeout_action_queue = await safeList(supabase, 'v_app_payment_closeout_action_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_exception_workflow_queue = await safeList(supabase, 'v_app_reconciliation_exception_workflow_queue', '*', 'sort_order', 80, true);
    health.app_equipment_chain_of_custody_queue = await safeList(supabase, 'v_app_equipment_chain_of_custody_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_conversion_queue = await safeList(supabase, 'v_app_local_seo_conversion_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_escalation_queue = await safeList(supabase, 'v_app_runtime_fallback_escalation_queue', '*', 'sort_order', 80, true);
    health.app_release_handoff_queue = await safeList(supabase, 'v_app_release_handoff_queue', '*', 'sort_order', 80, true);
    health.app_payment_posting_proof_queue = await safeList(supabase, 'v_app_payment_posting_proof_queue', '*', 'sort_order', 80, true);
    health.app_equipment_custody_evidence_queue = await safeList(supabase, 'v_app_equipment_custody_evidence_queue', '*', 'sort_order', 80, true);
    health.app_seo_conversion_evidence_queue = await safeList(supabase, 'v_app_seo_conversion_evidence_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_event_log_queue = await safeList(supabase, 'v_app_runtime_fallback_event_log_queue', '*', 'sort_order', 80, true);
    health.app_schema_deploy_repair_queue = await safeList(supabase, 'v_app_schema_deploy_repair_queue', '*', 'sort_order', 80, true);
    health.app_payment_reconciliation_proof_closeout_queue = await safeList(supabase, 'v_app_payment_reconciliation_proof_closeout_queue', '*', 'sort_order', 80, true);
    health.app_equipment_return_exception_action_queue = await safeList(supabase, 'v_app_equipment_return_exception_action_queue', '*', 'sort_order', 80, true);
    health.app_local_search_prominence_evidence_queue = await safeList(supabase, 'v_app_local_search_prominence_evidence_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_observability_queue = await safeList(supabase, 'v_app_runtime_fallback_observability_queue', '*', 'sort_order', 80, true);
    health.app_json_db_source_migration_queue = await safeList(supabase, 'v_app_json_db_source_migration_queue', '*', 'sort_order', 80, true);
    health.app_desktop_mobile_surface_parity_queue = await safeList(supabase, 'v_app_desktop_mobile_surface_parity_queue', '*', 'sort_order', 80, true);
    health.app_visual_professional_enrichment_queue = await safeList(supabase, 'v_app_visual_professional_enrichment_queue', '*', 'sort_order', 80, true);
    health.app_local_search_content_depth_queue = await safeList(supabase, 'v_app_local_search_content_depth_queue', '*', 'sort_order', 80, true);
    health.app_css_motion_image_guard_queue = await safeList(supabase, 'v_app_css_motion_image_guard_queue', '*', 'sort_order', 80, true);
    health.app_schema_deploy_validation_queue = await safeList(supabase, 'v_app_schema_deploy_validation_queue', '*', 'sort_order', 80, true);
    health.app_source_consolidation_decision_queue = await safeList(supabase, 'v_app_source_consolidation_decision_queue', '*', 'sort_order', 80, true);
    health.app_visual_asset_publication_queue = await safeList(supabase, 'v_app_visual_asset_publication_queue', '*', 'sort_order', 80, true);
    health.app_desktop_mobile_release_polish_queue = await safeList(supabase, 'v_app_desktop_mobile_release_polish_queue', '*', 'sort_order', 80, true);
    health.app_local_seo_trust_signal_queue = await safeList(supabase, 'v_app_local_seo_trust_signal_queue', '*', 'sort_order', 80, true);
    health.app_css_visual_regression_queue = await safeList(supabase, 'v_app_css_visual_regression_queue', '*', 'sort_order', 80, true);
    health.app_runtime_fallback_drill_queue = await safeList(supabase, 'v_app_runtime_fallback_drill_queue', '*', 'sort_order', 80, true);
    health.app_db_source_registry_candidate_queue = await safeList(supabase, 'v_app_db_source_registry_candidate_queue', '*', 'sort_order', 80, true);
    health.app_sanity_check_snapshot_queue = await safeList(supabase, 'v_app_sanity_check_snapshot_queue', '*', 'sort_order', 80, true);
    health.app_value_added_modification_queue = await safeList(supabase, 'v_app_value_added_modification_queue', '*', 'sort_order', 80, true);
    health.app_desktop_mobile_value_gap_queue = await safeList(supabase, 'v_app_desktop_mobile_value_gap_queue', '*', 'sort_order', 80, true);
    health.app_visual_professional_backlog_queue = await safeList(supabase, 'v_app_visual_professional_backlog_queue', '*', 'sort_order', 80, true);
    health.app_local_search_value_queue = await safeList(supabase, 'v_app_local_search_value_queue', '*', 'sort_order', 80, true);
    health.app_source_of_truth_migration_value_queue = await safeList(supabase, 'v_app_source_of_truth_migration_value_queue', '*', 'sort_order', 80, true);
    health.app_payment_action_workbench_queue = await safeList(supabase, 'v_app_payment_action_workbench_queue', '*', 'sort_order', 80, true);
    health.app_bank_csv_import_preview_queue = await safeList(supabase, 'v_app_bank_csv_import_preview_queue', '*', 'sort_order', 80, true);
    health.app_reconciliation_match_action_queue = await safeList(supabase, 'v_app_reconciliation_match_action_queue', '*', 'sort_order', 80, true);
    health.app_equipment_scan_custody_workbench_queue = await safeList(supabase, 'v_app_equipment_scan_custody_workbench_queue', '*', 'sort_order', 80, true);
    health.app_visual_asset_approval_registry = await safeList(supabase, 'v_app_visual_asset_approval_registry', '*', 'sort_order', 80, true);
    health.app_public_route_publication_registry = await safeList(supabase, 'v_app_public_route_publication_registry', '*', 'sort_order', 80, true);
    health.app_quote_contact_intake_registry = await safeList(supabase, 'v_app_quote_contact_intake_registry', '*', 'sort_order', 80, true);
    health.app_mobile_offline_conflict_card_queue = await safeList(supabase, 'v_app_mobile_offline_conflict_card_queue', '*', 'sort_order', 80, true);
    health.app_admin_scorecard_progress_rail_queue = await safeList(supabase, 'v_app_admin_scorecard_progress_rail_queue', '*', 'sort_order', 80, true);
    health.app_markdown_consolidation_registry = await safeList(supabase, 'v_app_markdown_consolidation_registry', '*', 'sort_order', 80, true);
    health.app_visual_placeholder_registry = await safeList(supabase, 'v_app_visual_placeholder_registry', '*', 'sort_order', 80, true);
    health.app_competitive_seo_enhancement_queue = await safeList(supabase, 'v_app_competitive_seo_enhancement_queue', '*', 'sort_order', 80, true);
    health.app_desktop_mobile_polish_queue = await safeList(supabase, 'v_app_desktop_mobile_polish_queue', '*', 'sort_order', 80, true);
    health.app_next_step_sanity_queue = await safeList(supabase, 'v_app_next_step_sanity_queue', '*', 'sort_order', 80, true);
    health.quote_contact_requests = await safeList(supabase, 'v_quote_contact_requests', '*', 'created_at', 80, false);
    health.payment_action_requests = await safeList(supabase, 'v_payment_action_requests', '*', 'created_at', 80, false);
    health.bank_csv_import_previews = await safeList(supabase, 'v_bank_csv_import_previews', '*', 'created_at', 80, false);
    health.bank_csv_import_preview_rows = await safeList(supabase, 'v_bank_csv_import_preview_rows', '*', 'row_number', 200, true);
    health.reconciliation_action_requests = await safeList(supabase, 'v_reconciliation_action_requests', '*', 'created_at', 80, false);
    health.equipment_scan_events = await safeList(supabase, 'v_equipment_scan_events', '*', 'created_at', 80, false);
    health.equipment_custody_timeline_events = await safeList(supabase, 'v_equipment_custody_timeline_events', '*', 'created_at', 80, false);
    health.visual_asset_approval_items = await safeList(supabase, 'v_visual_asset_approval_items', '*', 'created_at', 80, false);
    health.public_route_approval_items = await safeList(supabase, 'v_public_route_approval_items', '*', 'created_at', 80, false);
    health.mobile_offline_conflict_cards = await safeList(supabase, 'v_mobile_offline_conflict_cards', '*', 'created_at', 80, false);
    health.admin_scorecard_progress_rails = await safeList(supabase, 'v_admin_scorecard_progress_rails', '*', 'sort_order', 80, true);
    health.operation_write_audit_events = await safeList(supabase, 'v_operation_write_audit_events', '*', 'created_at', 100, false);
    health.quote_contact_followup_queue = await safeList(supabase, 'v_quote_contact_followup_queue', '*', 'followup_due_at', 100, true);
    health.payment_action_workbench = await safeList(supabase, 'v_payment_action_workbench', '*', 'created_at', 100, false);
    health.bank_csv_import_workbench = await safeList(supabase, 'v_bank_csv_import_workbench', '*', 'created_at', 100, false);
    health.visual_asset_publication_readiness = await safeList(supabase, 'v_visual_asset_publication_readiness', '*', 'updated_at', 100, false);
    health.public_route_publication_readiness = await safeList(supabase, 'v_public_route_publication_readiness', '*', 'updated_at', 100, false);
    health.admin_operations_cockpit_scorecards = await safeList(supabase, 'v_admin_operations_cockpit_scorecards', '*', 'metric_key', 50, true);

    health.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    health.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    health.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    health.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    return Response.json(health, { headers: corsHeaders });
  }



  if (scope === 'accounting_close' && roleRank(actorRole) >= roleRank('supervisor')) {
    const accountingClose: Record<string, unknown> = { ok: true, accounting_close_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    accountingClose.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    accountingClose.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    accountingClose.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    accountingClose.accounting_close_dashboard = await safeList(supabase, 'v_accounting_close_dashboard');
    accountingClose.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    accountingClose.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    accountingClose.accountant_handoff_bundles = await safeList(supabase, 'v_accountant_handoff_bundle_directory', '*', 'updated_at', limit, false);
    accountingClose.accountant_handoff_packages = await safeList(supabase, 'v_accountant_handoff_package_directory', '*', 'updated_at', limit, false);
    return Response.json(accountingClose, { headers: corsHeaders });
  }

  if (scope === 'banking' && roleRank(actorRole) >= roleRank('supervisor')) {
    const banking: Record<string, unknown> = { ok: true, banking_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    banking.bank_reconciliation_sessions = await safeList(supabase, 'v_bank_reconciliation_summary', '*', 'period_end', limit, false);
    banking.bank_reconciliation_items = await safeList(supabase, 'bank_reconciliation_items', '*', 'item_date', limit, false);
    banking.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    banking.bank_reconciliation_match_candidates = await safeList(supabase, 'v_bank_reconciliation_match_candidate_directory', '*', 'reconciliation_session_id', limit, false);
    banking.bank_reconciliation_match_scored = await safeList(supabase, 'v_bank_reconciliation_match_scored_directory', '*', 'match_score', limit, false);
    banking.bank_csv_import_session_directory = await safeList(supabase, 'v_bank_csv_import_session_directory', '*', 'updated_at', 80, false);
    return Response.json(banking, { headers: corsHeaders });
  }

  if (scope === 'tax_payroll' && roleRank(actorRole) >= roleRank('supervisor')) {
    const taxPayroll: Record<string, unknown> = { ok: true, tax_payroll_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    taxPayroll.sales_tax_prep = await safeList(supabase, 'v_sales_tax_prep_directory', '*', 'period_end', limit, false);
    taxPayroll.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    taxPayroll.payroll_remittance_prep = await safeList(supabase, 'v_payroll_remittance_prep_directory', '*', 'period_end', limit, false);
    taxPayroll.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    taxPayroll.accounting_payment_application_dashboard = await safeList(supabase, 'v_accounting_payment_application_dashboard');
    taxPayroll.ar_payment_applications = await safeList(supabase, 'v_ar_payment_application_directory', '*', 'application_date', limit, true);
    taxPayroll.ap_payment_applications = await safeList(supabase, 'v_ap_payment_application_directory', '*', 'application_date', limit, true);
    return Response.json(taxPayroll, { headers: corsHeaders });
  }

  if (scope === 'evidence' && roleRank(actorRole) >= roleRank('supervisor')) {
    const evidence: Record<string, unknown> = { ok: true, evidence_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    evidence.evidence_manager_directory = await safeList(supabase, 'v_evidence_manager_directory', '*', 'last_seen_at', 120, false);
    evidence.admin_evidence_action_queue = await safeList(supabase, 'v_admin_evidence_action_queue', '*', 'updated_at', 80, false);
    evidence.attendance_photo_review = await safeList(supabase, 'v_attendance_photo_review', '*', 'uploaded_at', 120, false);
    evidence.hse_evidence_review = await safeList(supabase, 'v_hse_evidence_review', '*', 'created_at', 120, false);
    evidence.hse_packet_action_items = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', 80, true);
    evidence.hse_dashboard_summary = await safeList(supabase, 'v_hse_dashboard_summary');
    return Response.json(evidence, { headers: corsHeaders });
  }

  if (scope === 'accounting' && roleRank(actorRole) >= roleRank('supervisor')) {
    const accounting: Record<string, unknown> = { ok: true, accounting_scope: 'fast_path', actor_role: actorRole, actor_profile_id: actorId, pagination_meta: { scope, limit, actor_role: actorRole } };
    accounting.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    accounting.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    accounting.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    accounting.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    accounting.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    accounting.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    accounting.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    accounting.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    accounting.bank_reconciliation_sessions = await safeList(supabase, 'v_bank_reconciliation_summary', '*', 'period_end', limit, false);
    accounting.ar_invoice_aging_detail = await safeList(supabase, 'v_ar_invoice_aging_detail', '*', 'due_date', 120, true);
    accounting.ap_bill_aging_detail = await safeList(supabase, 'v_ap_bill_aging_detail', '*', 'due_date', 120, true);
    accounting.accounting_payment_application_dashboard = await safeList(supabase, 'v_accounting_payment_application_dashboard');
    accounting.bank_accounts = await safeList(supabase, 'bank_accounts', 'id,account_name,institution_name,currency_code,account_mask,account_status,is_default', 'account_name', 40, false);
    return Response.json(accounting, { headers: corsHeaders });
  }

  const { data: peopleRaw } = await supabase.from('v_people_directory').select('*');
  const { data: profileAccessRaw } = await supabase.from('v_profile_access_rollups').select('*');
  const { data: assignmentsRaw } = await supabase.from('v_assignments_directory').select('*');
  const people = mergeRowsById(peopleRaw || [], profileAccessRaw || []);
  const assignments = assignmentsRaw || [];

  const directReportIds = new Set<string>();
  for (const row of people) {
    if (row.id === actorId) continue;
    if (row.default_supervisor_profile_id === actorId || row.override_supervisor_profile_id === actorId) directReportIds.add(String(row.id));
    if ((['admin','job_admin','hse'].includes(actorRole)) && (row.default_admin_profile_id === actorId || row.override_admin_profile_id === actorId)) {
      directReportIds.add(String(row.id));
    }
  }
  for (const a of assignments) {
    if (String(a.reports_to_supervisor_profile_id || '') === actorId || String(a.reports_to_admin_profile_id || '') === actorId) {
      directReportIds.add(String(a.profile_id));
    }
  }

  const filteredPeople = people.filter((row: any) => {
    if (scope === 'self') return row.id === actorId;
    if (scope === 'crew') {
      if (actorRole === 'admin') return true;
      if (roleRank(actorRole) >= roleRank('supervisor')) return row.id === actorId || directReportIds.has(String(row.id));
      return row.id === actorId;
    }
    if (scope === 'all' || scope === 'users') return roleRank(actorRole) >= roleRank('supervisor');
    return true;
  }).filter((row: any) => {
    if (roleFilter && normalizeRole(row.role) !== roleFilter) return false;
    if (!peopleSearch) return true;
    return [row.full_name, row.email, row.current_position, row.trade_specialty, row.phone, row.default_supervisor_name, row.default_admin_name]
      .some((v) => String(v || '').toLowerCase().includes(peopleSearch));
  });

  const sortedPeople = [...filteredPeople].sort((a: any, b: any) => compareNullable(a?.[peopleSort], b?.[peopleSort], peopleSortDir));
  const peopleOffset = (peoplePage - 1) * peoplePageSize;
  const pagedPeople = sortedPeople.slice(peopleOffset, peopleOffset + peoplePageSize);
  const peopleMeta = {
    page: peoplePage,
    page_size: peoplePageSize,
    total: filteredPeople.length,
    total_pages: Math.max(1, Math.ceil(filteredPeople.length / peoplePageSize)),
    loaded: pagedPeople.length,
    search: peopleSearch,
    role_filter: roleFilter,
    sort: peopleSort,
    direction: peopleSortDir
  };

  const response: Record<string, unknown> = {
    ok:true,
    actor_role: actorRole,
    actor_profile_id: actorId,
    profiles: pagedPeople,
    users: pagedPeople,
    pagination_meta: { scope, limit, search, actor_role: actorRole, people: peopleMeta, supports_server_paging: true, supports_sorting: true }
  };

  if (scope === 'people' && roleRank(actorRole) >= roleRank('supervisor')) {
    return Response.json(response, { headers: corsHeaders });
  }

  if (scope === 'operations' && roleRank(actorRole) >= roleRank('supervisor')) {
    response.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    response.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    response.jobs = jobsPaged.rows;
    response.pagination_meta = { ...(response.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    response.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    response.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    response.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    return Response.json(response, { headers: corsHeaders });
  }

  if ((scope === 'all' || scope === 'health' || scope === 'command_center') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.admin_home_command_center = await safeList(supabase, 'v_admin_home_command_center');
    response.admin_error_health_center = await safeList(supabase, 'v_admin_error_health_center', '*', 'severity_rank', 100, true);
    response.admin_task_inbox = await safeList(supabase, 'v_admin_task_inbox', '*', 'priority_rank', 120, true);
    response.app_schema_version_status = await safeList(supabase, 'v_app_schema_version_status', '*', 'schema_version', 122, false);
    response.role_dashboard_presets = await safeList(supabase, 'v_role_dashboard_presets', '*', 'sort_order', 40, true);
    response.schema_drift_status = await safeList(supabase, 'v_schema_drift_status');
    response.production_readiness_checklist = await safeList(supabase, 'v_production_readiness_checklist', '*', 'sort_order', 80, true);
    response.role_permission_matrix = await safeList(supabase, 'v_role_permission_matrix', '*', 'sort_order', 120, true);
    response.admin_saved_filter_directory = await safeList(supabase, 'v_admin_saved_filter_directory', '*', 'updated_at', 80, false);
    response.admin_saved_filter_scope_summary = await safeList(supabase, 'v_admin_saved_filter_scope_summary', '*', 'filter_scope', 80, true);
    response.admin_close_center_overview = await safeList(supabase, 'v_admin_close_center_overview');
    response.admin_close_wizard_steps = await safeList(supabase, 'v_admin_close_wizard_steps', '*', 'sort_order', 80, true);
    response.admin_health_resolution_queue = await safeList(supabase, 'v_admin_health_resolution_queue', '*', 'updated_at', 80, false);
    response.admin_deployment_gate_status = await safeList(supabase, 'v_admin_deployment_gate_status', '*', 'sort_order', 80, true);
    response.public_seo_smoke_check = await safeList(supabase, 'v_public_seo_smoke_check', '*', 'page_path', 80, true);
    response.admin_audit_event_directory = await safeList(supabase, 'v_admin_audit_event_directory', '*', 'occurred_at', 80, false);
    response.admin_panel_load_diagnostics = await safeList(supabase, 'v_admin_panel_load_diagnostics', '*', 'captured_at', 80, false);
    response.admin_fast_path_scope_registry = await safeList(supabase, 'v_admin_fast_path_scope_registry', '*', 'scope_key', 40, true);
    response.admin_action_confirmation_rules = await safeList(supabase, 'v_admin_action_confirmation_rules', '*', 'action_area', 80, true);
    response.admin_action_permission_registry = await safeList(supabase, 'v_admin_action_permission_registry', '*', 'sort_order', 120, true);
    response.admin_panel_retry_policy = await safeList(supabase, 'v_admin_panel_retry_policy', '*', 'sort_order', 80, true);
    response.admin_schema_preflight_checks = await safeList(supabase, 'v_admin_schema_preflight_checks', '*', 'sort_order', 120, true);
    response.admin_deployment_checklist = await safeList(supabase, 'v_admin_deployment_checklist', '*', 'sort_order', 80, true);
    response.admin_function_readiness_checks = await safeList(supabase, 'v_admin_function_readiness_checks', '*', 'sort_order', 80, true);
    response.admin_backup_restore_rehearsal_directory = await safeList(supabase, 'v_admin_backup_restore_rehearsal_directory', '*', 'updated_at', 40, false);
    response.bank_csv_import_session_directory = await safeList(supabase, 'v_bank_csv_import_session_directory', '*', 'updated_at', 40, false);
    response.admin_evidence_action_queue = await safeList(supabase, 'v_admin_evidence_action_queue', '*', 'updated_at', 80, false);
    response.admin_mobile_action_card_directory = await safeList(supabase, 'v_admin_mobile_action_card_directory', '*', 'sort_order', 80, true);
    response.admin_list_pagination_settings = await safeList(supabase, 'v_admin_list_pagination_settings', '*', 'list_key', 80, true);
    response.mobile_navigation_quality_gates = await safeList(supabase, 'v_mobile_navigation_quality_gates', '*', 'sort_order', 20, true);
    response.mobile_first_quality_gates = await safeList(supabase, 'v_app_mobile_first_quality_gates', '*', 'sort_order', 80, true);
    response.jurisdiction_wording_gates = await safeList(supabase, 'v_app_jurisdiction_wording_gates', '*', 'sort_order', 40, true);
    response.mobile_today_action_registry = await safeList(supabase, 'v_mobile_today_action_registry', '*', 'priority_rank', 80, true);
    response.mobile_pwa_install_quality_gates = await safeList(supabase, 'v_mobile_pwa_install_quality_gates', '*', 'sort_order', 40, true);
    response.mobile_form_stepper_registry = await safeList(supabase, 'v_mobile_form_stepper_registry', '*', 'sort_order', 80, true);
    response.mobile_form_quality_gates = await safeList(supabase, 'v_mobile_form_quality_gates', '*', 'sort_order', 80, true);
    response.evidence_manager_directory = await safeList(supabase, 'v_evidence_manager_directory', '*', 'last_seen_at', 120, false);
  }
  if ((scope === 'all' || scope === 'sites') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.sites = await safeList(supabase, 'sites', '*', 'site_code', limit);
  }
  if ((scope === 'all' || scope === 'assignments') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.assignments = assignments;
  }
  if ((scope === 'all' || scope === 'notifications') && roleRank(actorRole) >= roleRank('supervisor')) {
    let q = supabase.from('v_admin_notifications').select('*').order('created_at', { ascending:false }).limit(limit);
    if (actorRole !== 'admin') q = q.or(`recipient_role.eq.admin,target_profile_id.eq.${actorId}`);
    const { data: notifications } = await q;
    response.notifications = (notifications || []).filter((row: any) => {
      if (!search) return true;
      return [row.notification_type, row.title, row.message, row.status, row.decision_status, row.created_by_name].some((v) => String(v || '').toLowerCase().includes(search));
    });
  }
  if ((scope === 'all' || scope === 'accounting' || scope === 'orders') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.sales_orders = await safeList(supabase, 'sales_orders', '*', 'created_at', limit);
    response.accounting_entries = await safeList(supabase, 'accounting_entries', '*', 'created_at', limit);
    response.site_activity_events = await safeList(supabase, 'v_site_activity_recent', '*', 'occurred_at', limit, false);
    response.site_activity_summary = await safeList(supabase, 'v_site_activity_summary', '*', undefined, 5, false);
    response.site_activity_type_rollups = await safeList(supabase, 'v_site_activity_type_rollups', '*', 'last_24h_event_count', 100, false);
    response.site_activity_entity_rollups = await safeList(supabase, 'v_site_activity_entity_rollups', '*', 'last_24h_event_count', 100, false);
    response.attendance_photo_review = await safeList(supabase, 'v_attendance_photo_review', '*', 'uploaded_at', 120, false);
    response.hse_evidence_review = await safeList(supabase, 'v_hse_evidence_review', '*', 'created_at', 120, false);
  }
  if ((scope === 'all' || scope === 'operations' || scope === 'accounting_backbone') && roleRank(actorRole) >= roleRank('supervisor')) {
    response.service_areas = await safeList(supabase, 'service_areas', '*', 'name', limit);
    response.routes = await safeList(supabase, 'routes', '*', 'name', limit);
    const jobsPaged = await safeListPaged(supabase, 'jobs', {
      orderColumn: jobsSort,
      ascending: jobsSortDir !== 'desc',
      page: jobsPage,
      pageSize: jobsPageSize,
      search: jobsSearch,
      searchColumns: ['job_code', 'job_name', 'status', 'priority']
    });
    response.jobs = jobsPaged.rows;
    response.pagination_meta = { ...(response.pagination_meta as Record<string, unknown>), jobs: { ...jobsPaged.meta, sort: jobsSort, direction: jobsSortDir } };
    response.clients = await safeList(supabase, 'clients', '*', 'legal_name', limit);
    response.client_sites = await safeList(supabase, 'client_sites', '*', 'site_name', limit);
    response.units_of_measure = await safeList(supabase, 'units_of_measure', '*', 'sort_order', limit);
    response.cost_codes = await safeList(supabase, 'cost_codes', '*', 'code', limit);
    response.materials_catalog = await safeList(supabase, 'materials_catalog', '*', 'item_name', limit);
    response.service_pricing_templates = await safeList(supabase, 'service_pricing_templates', '*', 'template_name', limit);
    response.tax_codes = await safeList(supabase, 'tax_codes', '*', 'code', limit);
    response.business_tax_settings = await safeList(supabase, 'business_tax_settings', '*', 'profile_name', limit);
    response.recurring_service_agreements = await safeList(supabase, 'recurring_service_agreements', '*', 'agreement_code', limit);
    response.snow_event_triggers = await safeList(supabase, 'snow_event_triggers', '*', 'event_date', limit, false);
    response.change_orders = await safeList(supabase, 'change_orders', '*', 'requested_at', limit, false);
    response.customer_assets = await safeList(supabase, 'customer_assets', '*', 'asset_name', limit);
    response.customer_asset_job_links = await safeList(supabase, 'v_customer_asset_history', '*', 'service_date', limit, false);
    response.warranty_callback_events = await safeList(supabase, 'warranty_callback_events', '*', 'opened_at', limit, false);
    response.callback_warranty_dashboard_summary = await safeList(supabase, 'v_callback_warranty_dashboard_summary', '*', undefined, 5, false);
    response.payroll_export_runs = await safeList(supabase, 'payroll_export_runs', '*', 'period_start', limit, false);
    response.payroll_review_summary = await safeList(supabase, 'v_payroll_review_summary', '*', 'week_start', limit, false);
    response.payroll_review_detail = await safeList(supabase, 'v_payroll_review_detail', '*', 'created_at', limit, false);
    response.payroll_close_review_summary = await safeList(supabase, 'v_payroll_close_review_summary');
    response.route_profitability_summary = await safeList(supabase, 'v_route_profitability_summary', '*', 'route_name', limit);
    response.service_contract_documents = await safeList(supabase, 'service_contract_documents', '*', 'created_at', limit, false);
    response.service_agreement_profitability_summary = await safeList(supabase, 'v_service_agreement_profitability_summary', '*', 'agreement_code', limit);
    response.snow_event_invoice_candidates = await safeList(supabase, 'v_snow_event_invoice_candidates', '*', 'event_date', limit, false);
    response.estimate_conversion_candidates = await safeList(supabase, 'v_estimate_conversion_candidates', '*', 'estimate_number', limit, false);
    response.signed_contract_invoice_candidates = await safeList(supabase, 'v_signed_contract_invoice_candidates', '*', 'signed_at', limit, false);
    response.signed_contract_job_kickoff_candidates = await safeList(supabase, 'v_signed_contract_job_kickoff_candidates', '*', 'signed_at', limit, false);
    response.service_execution_scheduler_candidates = await safeList(supabase, 'v_service_execution_scheduler_candidates', '*', 'candidate_date', limit, false);
    response.service_execution_scheduler_summary = await safeList(supabase, 'v_service_execution_scheduler_summary');
    response.service_execution_scheduler_runs = await safeList(supabase, 'service_execution_scheduler_runs', '*', 'created_at', limit, false);
    response.service_execution_scheduler_settings = await safeList(supabase, 'service_execution_scheduler_settings', '*', 'setting_code', limit);
    response.service_execution_scheduler_status = await safeList(supabase, 'v_service_execution_scheduler_status');
    response.equipment_master = await safeList(supabase, 'equipment_master', '*', 'item_name', limit);
    response.estimates = await safeList(supabase, 'estimates', '*', 'estimate_number', limit);
    response.estimate_lines = await safeList(supabase, 'estimate_lines', '*', 'line_order', limit);
    response.work_orders = mergeRowsById(
      await safeList(supabase, 'work_orders', '*', 'work_order_number', limit),
      await safeList(supabase, 'v_work_order_rollups', '*', 'work_order_number', limit)
    );
    response.work_order_lines = await safeList(supabase, 'work_order_lines', '*', 'line_order', limit);
    response.route_stops = await safeList(supabase, 'route_stops', '*', 'stop_order', limit);
    response.route_stop_executions = await safeList(supabase, 'v_route_stop_execution_rollups', '*', 'execution_date', limit);
    response.route_stop_execution_attachments = await safeList(supabase, 'route_stop_execution_attachments', '*', 'created_at', limit);
    response.gl_journal_batches = await safeList(supabase, 'v_gl_journal_batch_rollups', '*', 'batch_number', limit);
    response.gl_journal_sync_exceptions = await safeList(supabase, 'v_gl_journal_sync_exceptions', '*', 'last_seen_at', limit);
    response.gl_journal_entries = await safeList(supabase, 'gl_journal_entries', '*', 'line_number', limit);
    response.subcontract_clients = await safeList(supabase, 'subcontract_clients', '*', 'company_name', limit);
    response.subcontract_dispatches = await safeList(supabase, 'subcontract_dispatches', '*', 'dispatch_number', limit);
    response.linked_hse_packets = mergeRowsById(
      await safeList(supabase, 'linked_hse_packets', '*', 'packet_number', limit),
      await safeList(supabase, 'v_hse_packet_progress', '*', 'packet_number', limit)
    );
    response.hse_packet_events = await safeList(supabase, 'hse_packet_events', '*', 'event_at', limit);
    response.hse_packet_proofs = await safeList(supabase, 'hse_packet_proofs', '*', 'created_at', limit);
    response.chart_of_accounts = await safeList(supabase, 'chart_of_accounts', '*', 'account_number', limit);
    response.bank_accounts = await safeList(supabase, 'bank_accounts', '*', 'account_name', limit);
    response.accounting_period_closes = await safeList(supabase, 'v_accounting_period_close_directory', '*', 'period_end', limit, false);
    response.sales_tax_filings = await safeList(supabase, 'v_sales_tax_filing_summary', '*', 'filing_period_end', limit, false);
    response.payroll_remittance_runs = await safeList(supabase, 'v_payroll_remittance_summary', '*', 'remittance_period_end', limit, false);
    response.bank_statement_imports = await safeList(supabase, 'bank_statement_imports', '*', 'statement_end', limit, false);
    response.bank_reconciliation_sessions = await safeList(supabase, 'v_bank_reconciliation_summary', '*', 'period_end', limit, false);
    response.bank_reconciliation_items = await safeList(supabase, 'bank_reconciliation_items', '*', 'item_date', limit, false);
    response.ar_invoice_aging_detail = await safeList(supabase, 'v_ar_invoice_aging_detail', '*', 'due_date', limit, true);
    response.ap_bill_aging_detail = await safeList(supabase, 'v_ap_bill_aging_detail', '*', 'due_date', limit, true);
    response.gl_trial_balance_summary = await safeList(supabase, 'v_gl_trial_balance_summary', '*', 'account_number', limit);
    response.accounting_close_dashboard = await safeList(supabase, 'v_accounting_close_dashboard');
    response.accounting_close_admin_control_dashboard = await safeList(supabase, 'v_accounting_close_admin_control_dashboard', '*', 'period_end', limit, false);
    response.accounting_reconciliation_manual_review_queue = await safeList(supabase, 'v_accounting_reconciliation_manual_review_queue', '*', 'review_priority', limit, true);
    response.accounting_close_package_delivery_queue = await safeList(supabase, 'v_accounting_close_package_delivery_queue', '*', 'updated_at', limit, false);
    response.sales_tax_prep = await safeList(supabase, 'v_sales_tax_prep_directory', '*', 'period_end', limit, false);
    response.sales_tax_filing_review = await safeList(supabase, 'v_sales_tax_filing_review_directory', '*', 'filing_period_end', limit, false);
    response.payroll_remittance_prep = await safeList(supabase, 'v_payroll_remittance_prep_directory', '*', 'period_end', limit, false);
    response.payroll_remittance_review = await safeList(supabase, 'v_payroll_remittance_review_directory', '*', 'remittance_period_end', limit, false);
    response.bank_reconciliation_match_candidates = await safeList(supabase, 'v_bank_reconciliation_match_candidate_directory', '*', 'reconciliation_session_id', limit, false);
    response.bank_reconciliation_match_scored = await safeList(supabase, 'v_bank_reconciliation_match_scored_directory', '*', 'match_score', limit, false);
    response.job_invoice_posting_automation = await safeList(supabase, 'v_job_invoice_posting_automation_directory', '*', 'updated_at', limit, false);
    response.job_journal_posting_automation = await safeList(supabase, 'v_job_journal_posting_automation_directory', '*', 'updated_at', limit, false);
    response.job_journal_generated_lines = await safeList(supabase, 'v_gl_journal_generated_line_directory', '*', 'line_sort', limit, false);
    response.accountant_handoff_bundles = await safeList(supabase, 'v_accountant_handoff_bundle_directory', '*', 'updated_at', limit, false);
    response.accountant_handoff_packages = await safeList(supabase, 'v_accountant_handoff_package_directory', '*', 'updated_at', limit, false);
    response.accountant_handoff_exports = await safeList(supabase, 'accountant_handoff_exports', '*', 'updated_at', limit, false);
    response.ap_vendors = await safeList(supabase, 'ap_vendors', '*', 'legal_name', limit);
    response.ar_invoices = mergeRowsById(
      await safeList(supabase, 'ar_invoices', '*', 'invoice_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ar_invoice')
    );
    response.ar_payments = await safeList(supabase, 'ar_payments', '*', 'payment_number', limit);
    response.ar_payment_applications = await safeList(supabase, 'v_ar_payment_application_directory', '*', 'application_date', limit, true);
    response.ap_bills = mergeRowsById(
      await safeList(supabase, 'ap_bills', '*', 'bill_number', limit),
      (await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number', limit)).filter((row: any) => row?.record_type === 'ap_bill')
    );
    response.ap_payments = await safeList(supabase, 'ap_payments', '*', 'payment_number', limit);
    response.ap_payment_applications = await safeList(supabase, 'v_ap_payment_application_directory', '*', 'application_date', limit, true);
    response.accounting_payment_application_dashboard = await safeList(supabase, 'v_accounting_payment_application_dashboard');
    response.material_receipts = mergeRowsById(
      await safeList(supabase, 'material_receipts', '*', 'receipt_number', limit),
      await safeList(supabase, 'v_material_receipt_rollups', '*', 'receipt_number', limit)
    );
    response.material_receipt_lines = await safeList(supabase, 'material_receipt_lines', '*', 'line_order', limit);
    response.material_issues = mergeRowsById(
      await safeList(supabase, 'material_issues', '*', 'issue_number', limit),
      await safeList(supabase, 'v_material_issue_rollups', '*', 'issue_number', limit)
    );
    response.material_issue_lines = await safeList(supabase, 'material_issue_lines', '*', 'line_order', limit);
    response.field_upload_failures = await safeList(supabase, 'v_field_upload_failure_rollups', '*', 'created_at', limit, false);
    response.app_traffic_events = await safeList(supabase, 'v_app_traffic_recent', '*', 'created_at', limit, false);
    response.backend_monitor_events = await safeList(supabase, 'v_backend_monitor_recent', '*', 'created_at', limit, false);
    response.app_traffic_daily_summary = await safeList(supabase, 'v_app_traffic_daily_summary', '*', 'event_date', 60, false);
    response.monitor_threshold_alerts = await safeList(supabase, 'v_monitor_threshold_alerts', '*', 'alert_key', limit);
    response.hse_packet_action_items = await safeList(supabase, 'v_hse_packet_action_items', '*', 'action_priority', limit, true);
    response.hse_dashboard_summary = await safeList(supabase, 'v_hse_dashboard_summary');
    response.accounting_review_summary = await safeList(supabase, 'v_accounting_review_summary');
    response.job_financial_events = await safeList(supabase, 'v_job_financial_event_directory', '*', 'event_date', limit, false);
    response.job_financial_rollups = await safeList(supabase, 'v_job_financial_rollups', '*', 'job_id', limit);
    response.account_login_events = await safeList(supabase, 'account_login_events', '*', 'occurred_at', limit, false);
    response.employee_time_clock_entries = await safeList(supabase, 'v_employee_time_clock_entries', '*', 'signed_in_at', limit, false);
    response.employee_time_clock_current = await safeList(supabase, 'v_employee_time_clock_current', '*', 'signed_in_at', limit, false);
    response.employee_time_clock_summary = await safeList(supabase, 'v_employee_time_clock_summary');
    response.employee_time_attendance_exceptions = await safeList(supabase, 'v_employee_time_attendance_exceptions', '*', 'signed_in_at', limit, false);
    response.employee_time_entry_reviews = await safeList(supabase, 'employee_time_entry_reviews', '*', 'created_at', limit, false);
    response.employee_time_review_queue = await safeList(supabase, 'v_employee_time_review_queue', '*', 'signed_in_at', limit, false);
    response.employee_time_review_summary = await safeList(supabase, 'v_employee_time_review_summary');
    response.operations_dashboard_summary = await safeList(supabase, 'v_operations_dashboard_summary');
    response.service_agreement_execution_candidates = await safeList(supabase, 'v_service_agreement_execution_candidates', '*', 'candidate_date', limit, false);
    response.hse_link_context_summary = await safeList(supabase, 'v_hse_link_context_summary', '*', 'sort_order', limit);
    response.monitor_review_summary = await safeList(supabase, 'v_monitor_review_summary', '*', 'sort_order', limit);
  }

if ((scope === 'all' || scope === 'reporting') && roleRank(actorRole) >= roleRank('supervisor')) {
  response.hse_submission_history_report = await safeList(supabase, 'v_hse_submission_history_report', '*', 'submission_date', limit, false);
  response.hse_form_daily_rollup = await safeList(supabase, 'v_hse_form_daily_rollup', '*', 'report_date', limit, false);
  response.hse_form_site_rollup = await safeList(supabase, 'v_hse_form_site_rollup', '*', 'last_submission_date', limit, false);
  response.workflow_history_report = await safeList(supabase, 'v_workflow_history_report', '*', 'occurred_at', limit, false);
  response.incident_near_miss_history = await safeList(supabase, 'v_incident_near_miss_history', '*', 'submission_date', limit, false);
  response.hse_reporting_monthly_trends = await safeList(supabase, 'v_hse_reporting_monthly_trends', '*', 'month_start', limit, false);
  response.hse_reporting_worker_rollup = await safeList(supabase, 'v_hse_reporting_worker_rollup', '*', 'last_submission_date', limit, false);
  response.hse_reporting_context_rollup = await safeList(supabase, 'v_hse_reporting_context_rollup', '*', 'last_submission_date', limit, false);
  response.report_preset_directory = await safeList(supabase, 'v_report_preset_directory', '*', 'updated_at', limit, false);
  response.corrective_action_task_directory = await safeList(supabase, 'v_corrective_action_task_directory', '*', 'due_date', limit, true);
  response.corrective_action_task_summary = await safeList(supabase, 'v_corrective_action_task_summary');
  response.training_course_directory = await safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true);
  response.training_record_directory = await safeList(supabase, 'v_training_record_directory', '*', 'expires_at', limit, true);
  response.training_expiry_summary = await safeList(supabase, 'v_training_expiry_summary');
  response.sds_acknowledgement_directory = await safeList(supabase, 'v_sds_acknowledgement_directory', '*', 'expires_at', limit, true);
  response.supervisor_safety_queue = await safeList(supabase, 'v_supervisor_safety_queue', '*', 'sort_at', limit, false);
  response.site_safety_scorecards = await safeList(supabase, 'v_site_safety_scorecards', '*', 'last_submission_date', limit, false);
  response.supervisor_scorecards = await safeList(supabase, 'v_supervisor_scorecards', '*', 'last_activity_at', limit, false);
  response.overdue_action_alerts = await safeList(supabase, 'v_overdue_action_alerts', '*', 'sort_at', limit, false);
  response.report_subscription_directory = await safeList(supabase, 'v_report_subscription_directory', '*', 'next_send_at', limit, false);
  response.report_delivery_candidates = await safeList(supabase, 'v_report_delivery_candidates', '*', 'next_send_at', limit, false);
  response.equipment_jsa_hazard_link_directory = await safeList(supabase, 'v_equipment_jsa_hazard_link_directory', '*', 'review_due_date', limit, false);
  response.report_delivery_run_history = await safeList(supabase, 'v_report_delivery_run_history', '*', 'started_at', limit, false);
  response.report_delivery_scheduler_status = await safeList(supabase, 'v_report_delivery_scheduler_status', '*', 'setting_code', 5, true);
}
  if (scope === 'self') {
    response.profile = filteredPeople[0] || null;
    response.self_training_available_courses = (await safeList(supabase, 'v_training_course_directory', '*', 'course_name', limit, true)).filter((row: any) => row?.self_service_enabled !== false);
    response.self_training_records = await safeListWhere(supabase, 'v_training_record_directory', '*', [['profile_id', actorId]], 'expires_at', limit, true);
    response.self_sds_acknowledgements = await safeListWhere(supabase, 'v_sds_acknowledgement_directory', '*', [['profile_id', actorId]], 'expires_at', limit, true);
    response.self_sds_prompts = await safeListWhere(supabase, 'v_worker_sds_prompt_queue', '*', [['profile_id', actorId]], 'acknowledged_at', limit, false);
  }
  return Response.json(response, { headers: corsHeaders });
});
