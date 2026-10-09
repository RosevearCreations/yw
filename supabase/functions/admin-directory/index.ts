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


function buildManagementOutcomeConfidenceCohortTrend(rows:any[], evidence:any, adminVisible:boolean, nowValue=Date.now()) {
  // Build 377: source-key-level counts, never people, notes or business payloads.
  const foundation = {
    source_key:'management_decision_outcomes',
    observation_window_days:90,
    source_coverage_state:String(evidence?.coverage_state||'unknown'),
    source_freshness_state:String(evidence?.freshness_state||'unknown'),
    source_row_count:Number(evidence?.row_count||0),
    query_limit:Number(evidence?.query_limit||0),
    cohort_basis:'Most recent decision for each canonical source key within each non-overlapping decision_at window',
    privacy_boundary:'Aggregate source-key outcomes only; no employee ratings, customer names, decision notes or raw source records.',
    authority_boundary:'Read-only advisory learning; no source mutation, Finance posting, provider delivery, employee evaluation or automatic commitments.'
  };
  if(!adminVisible || String(evidence?.freshness_state||'')==='hidden') {
    return {...foundation,state:'permission_hidden',trend_state:'withheld',reason:'Admin manage permission is required.',cohorts:[]};
  }
  if(['source_error','unknown'].includes(String(evidence?.freshness_state||'')) || !evidence) {
    return {...foundation,state:'source_unavailable',trend_state:'withheld',reason:'Canonical outcome source evidence is unavailable or failed.',cohorts:[]};
  }
  if(evidence.coverage_gap===true || Number(evidence.row_count||0)>=Number(evidence.query_limit||Infinity)) {
    return {...foundation,state:'partial_coverage',trend_state:'withheld',reason:'The journal read reached its query limit; cohort denominators would be incomplete.',cohorts:[]};
  }
  if(['stale','timestamp_unavailable'].includes(String(evidence.freshness_state||''))) {
    return {...foundation,state:'stale_evidence',trend_state:'withheld',reason:'Recorded outcome updates are stale or lack a reliable timestamp.',cohorts:[]};
  }
  const now=Number(nowValue);
  const windows=[
    {key:'latest_30_days',minDaysAgo:0,maxDaysAgo:30},
    {key:'prior_60_days',minDaysAgo:30,maxDaysAgo:90}
  ];
  const cohorts=windows.map(window=>{
    const bySource=new Map<string,any>();
    for(const row of Array.isArray(rows)?rows:[]) {
      const key=String(row?.source_key||'');
      const date=Date.parse(String(row?.decision_at||''));
      const age=(now-date)/86400000;
      if(!key || !Number.isFinite(date) || age<window.minDaysAgo || age>=window.maxDaysAgo)continue;
      const prior=bySource.get(key);
      if(!prior || date>Date.parse(String(prior.decision_at||''))) bySource.set(key,row);
    }
    const entries=[...bySource.values()];
    const counts={pending:0,resolved:0,improved:0,recurring:0,no_change:0,superseded:0,unknown:0};
    let explicitRecurrence=0,followupOverdue=0,followupScheduled=0;
    for(const row of entries) {
      const status=String(row.outcome_status||'unknown');
      if(Object.prototype.hasOwnProperty.call(counts,status)) counts[status as keyof typeof counts]++;
      else counts.unknown++;
      if(row.recurrence_signal===true)explicitRecurrence++;
      if(status==='pending' && row.followup_due_at) {
        const due=Date.parse(String(row.followup_due_at));
        if(Number.isFinite(due)){followupScheduled++;if(due<now)followupOverdue++;}
      }
    }
    const denominator=entries.length;
    const recorded=denominator-counts.pending-counts.unknown;
    return {
      ...window,source_key_denominator:denominator,recorded_outcomes:recorded,
      ...counts,explicit_recurrence_sources:explicitRecurrence,
      open_followups_with_due_date:followupScheduled,open_followups_overdue:followupOverdue,
      resolved_or_improved_percent:denominator>=5?Number(((counts.resolved+counts.improved)*100/denominator).toFixed(1)):null,
      sufficient_sample:denominator>=5,
      denominator_note:'Distinct canonical source keys with a decision in this cohort; the most recent decision status is counted once.'
    };
  });
  const [recent,previous]=cohorts;
  const comparable=recent.sufficient_sample&&previous.sufficient_sample && recent.unknown===0 && previous.unknown===0;
  const direction=comparable
    ? (recent.resolved_or_improved_percent! > previous.resolved_or_improved_percent! ? 'higher'
      : recent.resolved_or_improved_percent! < previous.resolved_or_improved_percent! ? 'lower':'unchanged')
    : 'withheld';
  return {...foundation,state:cohorts.every(c=>c.source_key_denominator===0)?'no_recorded_decisions':'current',
    trend_state:comparable?'comparable':'insufficient_sample',
    trend_direction:direction,
    trend_change_percentage_points:comparable?Number((recent.resolved_or_improved_percent!-previous.resolved_or_improved_percent!).toFixed(1)):null,
    reason:comparable?'Comparable non-overlapping decision cohorts with complete authoritative source coverage.':'No improvement claim: both cohorts need at least five unique source keys, recognized statuses and complete fresh coverage.',
    cohorts};
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


function buildFourSeasonCapacityProfitabilityScenarioEvidence(input:{
  dispatch:any[];recurringVisits:any[];profitability:any[];
  capacityForecast:any;routeEfficiency:any;workabilityRecovery:any;stockReadiness:any;recurringWorkbench:any;
  jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;coverageComplete:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const horizon=addCalendarDays(today,13);
  const seasons=['spring_summer','fall','winter','four_season'];
  const label=(season:string)=>({
    spring_summer:'Spring / summer landscaping & lawn',
    fall:'Fall cleanup & leaf',
    winter:'Winter snow / storm / ice',
    four_season:'General four-season operations'
  } as Record<string,string>)[season]||season;
  const activeDispatch=(input.dispatch||[]).filter((row)=>{
    const date=ontarioDateKey(row?.scheduled_start||row?.service_date);
    return !!date&&date>=today&&date<=horizon&&!['cancelled','canceled','superseded','completed'].includes(String(row?.schedule_status||'').toLowerCase());
  });
  const activeVisits=(input.recurringVisits||[]).filter((row)=>{
    const date=String(row?.service_date||'').slice(0,10);
    return !!date&&date>=today&&date<=horizon&&!['cancelled','canceled','skipped','held','completed'].includes(String(row?.visit_status||'').toLowerCase());
  });
  const jobProfitRows=(input.profitability||[]).filter((row)=>String(row?.group_type||'').toLowerCase()==='job_family');
  const recurringAgreements=input.recurringWorkbench?.agreements||[];
  const capacityDays=input.capacityForecast?.days||[];
  const routeDays=input.routeEfficiency?.route_days||[];
  const recoveryBySeason=new Map((input.workabilityRecovery?.season_outcomes||[]).map((row:any)=>[String(row?.season_context||'four_season'),row]));
  const stockBySeason=new Map((input.stockReadiness?.seasonal_summary||[]).map((row:any)=>[String(row?.season||'four_season'),row]));
  const recurringMaterialCoverage=input.stockReadiness?.recurring_demand_coverage||[];

  const plannedMinutes=(row:any)=>{
    const estimated=Math.max(0,Number(row?.estimated_duration_minutes||0));
    const windowMinutes=minutesBetween(row?.scheduled_start,row?.scheduled_end);
    return (estimated||windowMinutes)+Math.max(0,Number(row?.travel_allowance_minutes||0));
  };
  const recurringMinutes=(row:any)=>Math.max(0,Number(row?.visit_estimated_minutes||0))+Math.max(0,Number(row?.default_travel_allowance_minutes||0));

  const base=seasons.map((season)=>{
    const dispatchRows=activeDispatch.filter((row)=>forecastSeason(row)===season);
    const visitRows=activeVisits.filter((row)=>forecastSeason(row)===season);
    const plannedItems=dispatchRows.length+visitRows.length;
    const demandMinutes=dispatchRows.reduce((sum,row)=>sum+plannedMinutes(row),0)+visitRows.reduce((sum,row)=>sum+recurringMinutes(row),0);

    const seasonDays=capacityDays.filter((row:any)=>Number(row?.season_load?.[season]||0)>0);
    const sharedActiveCrewDays=seasonDays.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row?.active_crew_count||0)),0);
    const sharedScheduledCrewDays=seasonDays.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row?.scheduled_crew_count||0)),0);
    const constrainedForecastDays=seasonDays.filter((row:any)=>['blocked','attention','review'].includes(String(row?.readiness_state||''))).length;

    const seasonRouteDays=routeDays.filter((row:any)=>String(row?.season_context||'four_season')===season);
    const routeCapacityRows=seasonRouteDays.filter((row:any)=>row?.configured_capacity_headroom_minutes!=null);
    const routeCapacityHeadroom=routeCapacityRows.length
      ? routeCapacityRows.reduce((sum:number,row:any)=>sum+Number(row?.configured_capacity_headroom_minutes||0),0)
      : null;
    const overConfiguredMinutes=seasonRouteDays.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row?.over_configured_capacity_minutes||0)),0);

    const recovery:any=recoveryBySeason.get(season)||null;
    const stock:any=stockBySeason.get(season)||null;
    const unquantifiedRecurringMaterials=recurringMaterialCoverage.filter((row:any)=>
      row?.material_plan_coverage!=='quantified'&&forecastSeason({service_name:row?.service_name,service_program_type:row?.service_program_type})===season
    ).length;

    const seasonJobProfit=jobProfitRows.filter((row)=>forecastSeason({job_name:row?.group_label||row?.group_key})===season);
    const jobRevenue=seasonJobProfit.reduce((sum,row)=>sum+Number(row?.actual_revenue_total||0),0);
    const jobCost=seasonJobProfit.reduce((sum,row)=>sum+Number(row?.actual_cost_total||0),0);
    const jobProfit=seasonJobProfit.reduce((sum,row)=>sum+Number(row?.actual_profit_total||0),0);
    const jobMargin=jobRevenue>0?Number(((jobProfit/jobRevenue)*100).toFixed(1)):null;

    const seasonAgreements=recurringAgreements.filter((row:any)=>String(row?.season_context||'four_season')===season);
    const recurringProfitRows=seasonAgreements.filter((row:any)=>row?.actual_profit_total!=null&&Number.isFinite(Number(row.actual_profit_total)));
    const recurringProfit=recurringProfitRows.reduce((sum:number,row:any)=>sum+Number(row.actual_profit_total||0),0);

    const missing:string[]=[];
    if(!input.coverageComplete) missing.push('One or more source reads reached a configured query limit; seasonal evidence may be partial.');
    if(plannedItems===0) missing.push('No scheduled dispatch or recurring-visit demand is recorded in the current 14-day horizon; demand is not invented.');
    if(routeCapacityRows.length===0) missing.push('No configured route daily-capacity headroom evidence is recorded for this season; capacity headroom is not assumed.');
    if(!recovery||Number(recovery?.constraint_episodes||0)===0) missing.push('No recorded workability constraint/recovery history is available for this season; recovery performance is not assumed.');
    if(!stock||Number(stock?.material_count||0)===0) missing.push('No season-classified material readiness evidence is recorded; stock requirements are not invented.');
    if(unquantifiedRecurringMaterials>0) missing.push(unquantifiedRecurringMaterials+' upcoming recurring visit(s) lack a linked quantified material plan.');
    if(!input.financeVisible) missing.push('Finance profitability evidence is hidden by permission; no margin or profit assumption is substituted.');
    else if(seasonJobProfit.length===0&&recurringProfitRows.length===0) missing.push('No recorded job-family or recurring-agreement profitability evidence is available for this season.');

    return {
      scenario_key:season,scenario_label:label(season),scenario_state:missing.length?'partial_recorded_evidence':'recorded_evidence_complete',
      horizon_start:today,horizon_end:horizon,planned_dispatch_count:dispatchRows.length,planned_recurring_visit_count:visitRows.length,
      planned_item_count:plannedItems,recorded_demand_minutes:demandMinutes,
      forecast_days_with_season_load:seasonDays.length,shared_active_crew_day_evidence:sharedActiveCrewDays,
      shared_scheduled_crew_day_evidence:sharedScheduledCrewDays,constrained_forecast_day_count:constrainedForecastDays,
      configured_route_capacity_day_count:routeCapacityRows.length,configured_route_capacity_headroom_minutes:routeCapacityHeadroom,
      over_configured_capacity_minutes:overConfiguredMinutes,
      workability_constraint_episodes:Number(recovery?.constraint_episodes||0),
      workability_full_completion_recovery_count:Number(recovery?.full_completion_recovery_count||0),
      workability_recovery_rate_percent:recovery?.recovery_rate_percent??null,
      material_count:Number(stock?.material_count||0),material_attention_count:Number(stock?.attention_count||0),
      material_shortage_count:Number(stock?.shortage_count||0),material_reorder_review_count:Number(stock?.reorder_review_count||0),
      recurring_visits_without_quantified_material_plan:unquantifiedRecurringMaterials,
      finance_evidence_state:input.financeVisible?'visible':'not_visible',
      recorded_job_profitability_group_count:seasonJobProfit.length,recorded_job_revenue_total:input.financeVisible?Number(jobRevenue.toFixed(2)):null,
      recorded_job_cost_total:input.financeVisible?Number(jobCost.toFixed(2)):null,recorded_job_profit_total:input.financeVisible?Number(jobProfit.toFixed(2)):null,
      recorded_job_margin_percent:input.financeVisible?jobMargin:null,
      recorded_recurring_profit_agreement_count:input.financeVisible?recurringProfitRows.length:0,
      recorded_recurring_profit_total:input.financeVisible?Number(recurringProfit.toFixed(2)):null,
      missing_assumptions:missing,
      review_note:'Compare recorded seasonal demand, shared crew-day evidence, configured route capacity, workability recovery, materials and permission-scoped profitability before making an operator decision.'
    };
  });

  const totalPlanned=base.reduce((sum,row)=>sum+Number(row.planned_item_count||0),0);
  const scenarios=base.map((row)=>({
    ...row,
    planned_mix_share_percent:totalPlanned?Number(((Number(row.planned_item_count||0)/totalPlanned)*100).toFixed(1)):null
  }));
  const financeScenarioCount=scenarios.filter((row)=>Number(row.recorded_job_profitability_group_count||0)>0||Number(row.recorded_recurring_profit_agreement_count||0)>0).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk,coverage_complete:input.coverageComplete,
    jobs_visible:input.jobsVisible,finance_visible:input.financeVisible,horizon_start:today,horizon_end:horizon,
    summary:{
      planned_items_14_days:totalPlanned,
      recorded_demand_minutes_14_days:scenarios.reduce((sum,row)=>sum+Number(row.recorded_demand_minutes||0),0),
      seasons_with_planned_work:scenarios.filter((row)=>Number(row.planned_item_count||0)>0).length,
      seasons_with_configured_route_capacity:scenarios.filter((row)=>Number(row.configured_route_capacity_day_count||0)>0).length,
      seasons_with_material_attention:scenarios.filter((row)=>Number(row.material_attention_count||0)>0).length,
      seasons_with_recorded_profitability:input.financeVisible?financeScenarioCount:0,
      scenarios_with_missing_assumptions:scenarios.filter((row)=>row.missing_assumptions.length>0).length
    },
    scenarios,
    mix_boundary:'Seasonal mix share is the share of recorded dispatch plus recurring-visit items inside the current 14-day horizon. No sales target, jobs-per-crew target, growth rate or missing workload is invented.',
    capacity_boundary:'Crew counts are shared crew-day evidence on dates carrying that season, not dedicated seasonal capacity. Route headroom is shown only where a configured daily route capacity exists; missing headroom is never inferred.',
    profitability_boundary:'Job-family profitability and recurring-agreement profitability are displayed as separate recorded sources and are not added together because their populations can overlap. No target margin, price, wage, utilization rate or revenue assumption is invented.',
    materials_boundary:'Material readiness reuses current stock and quantified planned demand. Missing units or recurring material plans remain explicit gaps; no unit conversion, reorder quantity or purchase requirement is invented.',
    scenario_boundary:'These are evidence scenarios for comparing current recorded seasonal mix and constraints, not forecasts of customer demand or committed operating plans.',
    authority_boundary:'Read-only decision support only. This layer cannot auto-price, dispatch, hire, schedule, purchase, contact suppliers/customers, create estimates/invoices, or commit customer/vendor work.'
  };
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
    route_days:routeDays.sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||String(a.route_name).localeCompare(String(b.route_name))).slice(0,180),
    route_summaries:routeSummaries.slice(0,30),
    repeated_route_friction:repeatedRouteFriction,
    clustering_opportunities:clusteringOpportunities.slice(0,20),
    item_evidence:evidenceRows.sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||Number(a.route_order||999)-Number(b.route_order||999)).slice(0,300),
    comparison_boundary:'Service-duration variance uses recorded planned duration versus recorded production duration. Planned travel allowance is shown beside linked crew travel minutes, but no direct travel variance is inferred because crew-time travel is not the same measure as vehicle elapsed travel.',
    clustering_boundary:'Clustering is advisory evidence only. It identifies same-day city overlap across existing routes and never rewrites route membership or stop order.',
    performance_boundary:'Crew and route evidence is operational context only. It does not score, rank or infer individual employee performance.',
    authority_boundary:'Read-only evidence. Routing and dispatch remain the existing operator authorities; Build 354 does not mutate schedules, routes, workability decisions or source records.'
  };
}



function buildRoutePlanActualStopSequenceLearning(routeEvidence:any) {
  const items=Array.isArray(routeEvidence?.item_evidence)?routeEvidence.item_evidence:[];
  const byRouteDay=new Map<string,any[]>();
  for(const row of items){
    if(!row?.route_id||!row?.service_date) continue;
    const key=String(row.route_id)+'|'+String(row.service_date);
    const list=byRouteDay.get(key)||[];
    list.push(row);byRouteDay.set(key,list);
  }

  const dayComparisons=[...byRouteDay.entries()].map(([key,rows])=>{
    const [routeId,serviceDate]=key.split('|');
    const planned=[...rows].filter(r=>r.route_order!=null).sort((a,b)=>Number(a.route_order)-Number(b.route_order)||String(a.dispatch_id||'').localeCompare(String(b.dispatch_id||'')));
    const actual=[...rows].filter(r=>r.actual_route_order!=null).sort((a,b)=>Number(a.actual_route_order)-Number(b.actual_route_order)||String(a.dispatch_id||'').localeCompare(String(b.dispatch_id||'')));
    const comparable=rows.filter(r=>r.route_order!=null&&r.actual_route_order!=null);
    const deviations=comparable.filter(r=>Number(r.route_order)!==Number(r.actual_route_order));
    const durationOverruns=rows.filter(r=>r.service_duration_variance_minutes!=null&&Number(r.service_duration_variance_minutes)>0);
    const delayMinutes=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.delay_minutes||0)),0);
    const returnVisits=rows.filter(r=>r.return_visit_required===true);
    const workabilityItems=rows.filter(r=>Number(r.workability_effect_count||0)>0);
    const plannedTravel=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.planned_travel_allowance_minutes||0)),0);
    const recordedTravelRows=rows.filter(r=>r.recorded_crew_travel_minutes!=null);
    const recordedTravel=recordedTravelRows.length?recordedTravelRows.reduce((sum,r)=>sum+Math.max(0,Number(r.recorded_crew_travel_minutes||0)),0):null;
    const frictionTypes:string[]=[];
    if(deviations.length) frictionTypes.push('recorded stop order differed');
    if(durationOverruns.length) frictionTypes.push('recorded service duration over plan');
    if(delayMinutes>0) frictionTypes.push('recorded delay');
    if(returnVisits.length) frictionTypes.push('return visit required');
    if(workabilityItems.length) frictionTypes.push('workability effect');
    return {
      route_id:routeId,route_name:rows[0]?.route_name||'Unnamed route',service_date:serviceDate,
      season_context:rows[0]?.season_context||'four_season',
      stop_count:rows.length,comparable_stop_count:comparable.length,
      exact_sequence:comparable.length>0&&deviations.length===0&&planned.length===actual.length,
      order_deviation_count:deviations.length,
      planned_sequence:planned.map(r=>({dispatch_id:r.dispatch_id||null,position:r.route_order,site_name:r.site_name||null})),
      recorded_start_sequence:actual.map(r=>({dispatch_id:r.dispatch_id||null,position:r.actual_route_order,site_name:r.site_name||null,actual_start_at:r.actual_start_at||null})),
      service_duration_overrun_count:durationOverruns.length,recorded_delay_minutes:delayMinutes,
      return_visit_count:returnVisits.length,workability_effect_count:workabilityItems.length,
      planned_travel_allowance_minutes:plannedTravel,
      recorded_crew_travel_minutes:recordedTravel,
      recorded_crew_travel_coverage_count:recordedTravelRows.length,
      friction_types:frictionTypes
    };
  }).sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||String(a.route_name).localeCompare(String(b.route_name)));

  const patternByRoute=new Map<string,any>();
  for(const day of dayComparisons){
    const key=String(day.route_id);
    const p=patternByRoute.get(key)||{
      route_id:day.route_id,route_name:day.route_name,service_days:0,
      order_deviation_dates:new Set<string>(),duration_overrun_dates:new Set<string>(),delay_dates:new Set<string>(),
      return_visit_dates:new Set<string>(),workability_dates:new Set<string>()
    };
    p.service_days++;
    if(day.order_deviation_count>0) p.order_deviation_dates.add(day.service_date);
    if(day.service_duration_overrun_count>0) p.duration_overrun_dates.add(day.service_date);
    if(day.recorded_delay_minutes>0) p.delay_dates.add(day.service_date);
    if(day.return_visit_count>0) p.return_visit_dates.add(day.service_date);
    if(day.workability_effect_count>0) p.workability_dates.add(day.service_date);
    patternByRoute.set(key,p);
  }

  const stablePatterns=[...patternByRoute.values()].map(p=>{
    const repeated:string[]=[];
    if(p.order_deviation_dates.size>=2) repeated.push('stop order differed on multiple service dates');
    if(p.duration_overrun_dates.size>=2) repeated.push('service duration over plan on multiple service dates');
    if(p.delay_dates.size>=2) repeated.push('recorded delay on multiple service dates');
    if(p.return_visit_dates.size>=2) repeated.push('return visits on multiple service dates');
    if(p.workability_dates.size>=2) repeated.push('workability effects on multiple service dates');
    return {
      route_id:p.route_id,route_name:p.route_name,service_days:p.service_days,
      order_deviation_service_days:p.order_deviation_dates.size,
      duration_overrun_service_days:p.duration_overrun_dates.size,
      delay_service_days:p.delay_dates.size,
      return_visit_service_days:p.return_visit_dates.size,
      workability_effect_service_days:p.workability_dates.size,
      repeated_friction_types:repeated
    };
  }).filter(p=>p.repeated_friction_types.length>0)
    .sort((a,b)=>b.repeated_friction_types.length-a.repeated_friction_types.length||String(a.route_name).localeCompare(String(b.route_name)));

  const positionPatterns=new Map<string,any>();
  for(const row of items){
    if(!row?.route_id||!row?.service_date||row.route_order==null||row.actual_route_order==null) continue;
    if(Number(row.route_order)===Number(row.actual_route_order)) continue;
    const key=[row.route_id,row.route_order,row.actual_route_order].join('|');
    const p=positionPatterns.get(key)||{
      route_id:row.route_id,route_name:row.route_name||'Unnamed route',
      planned_position:Number(row.route_order),recorded_start_position:Number(row.actual_route_order),
      service_dates:new Set<string>(),sample_sites:new Set<string>()
    };
    p.service_dates.add(String(row.service_date));
    if(row.site_name) p.sample_sites.add(String(row.site_name));
    positionPatterns.set(key,p);
  }

  const candidateSequenceReviews=[...positionPatterns.values()]
    .filter(p=>p.service_dates.size>=2)
    .map(p=>({
      route_id:p.route_id,route_name:p.route_name,planned_position:p.planned_position,recorded_start_position:p.recorded_start_position,
      repeat_service_date_count:p.service_dates.size,service_dates:[...p.service_dates].sort().slice(-12),
      sample_sites:[...p.sample_sites].slice(0,6),
      review_reason:'The same planned position and recorded production-start position differed on multiple service dates. Review sequencing context only; do not auto-reorder.'
    }))
    .sort((a,b)=>b.repeat_service_date_count-a.repeat_service_date_count||String(a.route_name).localeCompare(String(b.route_name)));

  const comparableItems=items.filter(r=>r.route_order!=null&&r.actual_route_order!=null);
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',lookback_days:Number(routeEvidence?.lookback_days||90),
    summary:{
      loaded_item_evidence:items.length,route_days_reviewed:dayComparisons.length,comparable_sequence_items:comparableItems.length,
      route_days_with_sequence_deviation:dayComparisons.filter(d=>d.order_deviation_count>0).length,
      exact_sequence_route_days:dayComparisons.filter(d=>d.exact_sequence).length,
      stable_friction_pattern_routes:stablePatterns.length,candidate_sequence_review_count:candidateSequenceReviews.length,
      service_duration_overrun_items:items.filter(r=>r.service_duration_variance_minutes!=null&&Number(r.service_duration_variance_minutes)>0).length,
      recorded_delay_minutes:items.reduce((sum,r)=>sum+Math.max(0,Number(r.delay_minutes||0)),0),
      return_visit_items:items.filter(r=>r.return_visit_required===true).length,
      planned_travel_allowance_minutes:items.reduce((sum,r)=>sum+Math.max(0,Number(r.planned_travel_allowance_minutes||0)),0),
      recorded_crew_travel_minutes:items.some(r=>r.recorded_crew_travel_minutes!=null)?items.reduce((sum,r)=>sum+Math.max(0,Number(r.recorded_crew_travel_minutes||0)),0):null
    },
    route_day_comparisons:dayComparisons.slice(0,120),
    stable_friction_patterns:stablePatterns.slice(0,40),
    candidate_sequence_reviews:candidateSequenceReviews.slice(0,40),
    source_scope_boundary:'Learning is derived only from the bounded Build 354 route evidence already loaded from Dispatch, Production, Timekeeping, Workability and Route sources. Missing production start, duration or travel evidence stays missing.',
    travel_boundary:'Planned travel allowance and recorded crew travel minutes are shown side by side only. YW does not treat crew travel time as vehicle elapsed time and does not invent GPS or travel facts.',
    learning_boundary:'A stable pattern means the same recorded friction type occurred on at least two service dates for a route. A sequencing review candidate requires the same planned-position to recorded-start-position difference on at least two dates; it is not a routing recommendation.',
    performance_boundary:'Plan-versus-actual learning is route-day operational evidence only. It does not score, rank or infer individual employee performance.',
    authority_boundary:'Read-only learning only. Routing and Dispatch remain operator authorities; this layer cannot rewrite routes, reorder stops, dispatch work, change Workability decisions or mutate source records.'
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



function buildRecurringRenewalConversionChurnOutcomes(input:{
  programs:any[];renewals:any[];interactions:any[];rollovers:any[];profitability:any[];
  financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const renewalByAgreement=new Map((input.renewals||[]).map((r)=>[String(r?.agreement_id||''),r]));
  const interactionMap=new Map<string,any[]>();
  for(const row of input.interactions||[]){
    const id=String(row?.recurring_service_agreement_id||''); if(!id) continue;
    const list=interactionMap.get(id)||[];list.push(row);interactionMap.set(id,list);
  }
  const rolloverMap=new Map<string,any[]>();
  for(const row of input.rollovers||[]){
    const id=String(row?.recurring_service_agreement_id||''); if(!id) continue;
    const list=rolloverMap.get(id)||[];list.push(row);rolloverMap.set(id,list);
  }
  const profitByAgreement=new Map((input.profitability||[]).map((r)=>[String(r?.id||r?.agreement_id||''),r]));

  const eventTime=(row:any)=>String(row?.occurred_at||row?.decided_at||row?.updated_at||row?.created_at||'');
  const evidenceText=(row:any)=>[
    row?.outcome,row?.interaction_status,row?.complaint_status,row?.subject,row?.summary,row?.rollover_state,row?.decision_note
  ].filter(Boolean).join(' ').toLowerCase();
  const renewedPattern=/(^|\b)(renewed|renewal accepted|accepted renewal|will continue|continue service|continued service)(\b|$)/i;
  const declinedPattern=/(^|\b)(declined|decline renewal|not renew|do not renew|will not renew|won't renew|non-renewal|renewal cancelled)(\b|$)/i;
  const holdPattern=/(^|\b)(hold|held|paused|defer|deferred|decision pending)(\b|$)/i;

  const rows=(input.programs||[]).map((p)=>{
    const id=String(p?.id||p?.agreement_id||'');
    const renewal=renewalByAgreement.get(id)||{};
    const interactions=[...(interactionMap.get(id)||[])].sort((a,b)=>eventTime(b).localeCompare(eventTime(a)));
    const rollovers=[...(rolloverMap.get(id)||[])].sort((a,b)=>eventTime(b).localeCompare(eventTime(a)));
    const explicitRenewed=interactions.find((r)=>renewedPattern.test(evidenceText(r)))||rollovers.find((r)=>renewedPattern.test(evidenceText(r)));
    const explicitDeclined=interactions.find((r)=>declinedPattern.test(evidenceText(r)))||rollovers.find((r)=>declinedPattern.test(evidenceText(r)));
    const explicitHeld=interactions.find((r)=>holdPattern.test(evidenceText(r)))||rollovers.find((r)=>holdPattern.test(evidenceText(r)));
    const agreementStatus=String(p?.agreement_status||renewal?.agreement_status||'').toLowerCase();
    const endDate=String(p?.end_date||renewal?.end_date||'').slice(0,10);
    const holdUntil=String(p?.customer_hold_until||renewal?.customer_hold_until||'').slice(0,10);
    const holdReason=p?.customer_hold_reason||p?.pause_reason||renewal?.customer_hold_reason||renewal?.pause_reason||null;
    const cancellationReason=p?.cancellation_reason||renewal?.cancellation_reason||null;
    const cancellationText=String(cancellationReason||'').toLowerCase();
    const cancellationIsRenewalDecline=!!cancellationReason&&declinedPattern.test(cancellationText);
    const lifecycleExpired=['expired','ended','closed'].includes(agreementStatus) || (!!endDate&&endDate<today&&!['active','paused','draft'].includes(agreementStatus));
    const recordedHold=agreementStatus==='paused'||!!holdReason&&(!holdUntil||holdUntil>=today);
    const reasonEvidence:any[]=[];
    const pushEvidence=(source:string,type:string,text:any,at:any)=>{
      if(!text)return;
      reasonEvidence.push({source,type,text:String(text),recorded_at:at||null});
    };
    if(explicitRenewed) pushEvidence(interactions.includes(explicitRenewed)?'crm_interaction':'seasonal_rollover','renewal_decision',explicitRenewed.outcome||explicitRenewed.decision_note||explicitRenewed.summary||explicitRenewed.rollover_state,eventTime(explicitRenewed));
    if(explicitDeclined) pushEvidence(interactions.includes(explicitDeclined)?'crm_interaction':'seasonal_rollover','renewal_decision',explicitDeclined.outcome||explicitDeclined.decision_note||explicitDeclined.summary||explicitDeclined.rollover_state,eventTime(explicitDeclined));
    if(explicitHeld) pushEvidence(interactions.includes(explicitHeld)?'crm_interaction':'seasonal_rollover','hold_decision',explicitHeld.outcome||explicitHeld.decision_note||explicitHeld.summary||explicitHeld.rollover_state,eventTime(explicitHeld));
    if(holdReason) pushEvidence('agreement','hold_reason',holdReason,p?.paused_at||renewal?.updated_at||null);
    if(cancellationReason) pushEvidence('agreement','cancellation_reason',cancellationReason,p?.cancelled_at||renewal?.updated_at||null);
    if(lifecycleExpired&&endDate) pushEvidence('agreement','end_date','Recorded lifecycle ended '+endDate,endDate);

    let outcomeState='unresolved',outcomeDate:any=null,outcomeSource='current_review_state';
    if(explicitRenewed){
      outcomeState='renewed';outcomeDate=eventTime(explicitRenewed)||null;outcomeSource=interactions.includes(explicitRenewed)?'crm_interaction':'seasonal_rollover';
    } else if(explicitDeclined||cancellationIsRenewalDecline){
      outcomeState='declined';
      outcomeDate=explicitDeclined?eventTime(explicitDeclined):(p?.cancelled_at||renewal?.updated_at||null);
      outcomeSource=explicitDeclined?(interactions.includes(explicitDeclined)?'crm_interaction':'seasonal_rollover'):'agreement_cancellation_reason';
    } else if(recordedHold||explicitHeld){
      outcomeState='held';
      outcomeDate=explicitHeld?eventTime(explicitHeld):(p?.paused_at||renewal?.updated_at||null);
      outcomeSource=explicitHeld?(interactions.includes(explicitHeld)?'crm_interaction':'seasonal_rollover'):'agreement_hold';
    } else if(lifecycleExpired){
      outcomeState='expired';outcomeDate=endDate||p?.updated_at||null;outcomeSource='agreement_lifecycle';
    }

    const openIssues=interactions.filter((r)=>{
      const type=String(r?.interaction_type||'').toLowerCase();
      const status=String(r?.interaction_status||'').toLowerCase();
      const complaint=String(r?.complaint_status||'').toLowerCase();
      return ['open','investigating'].includes(complaint)||(['complaint','service_review'].includes(type)&&status==='open');
    });
    const profit=input.financeVisible?profitByAgreement.get(id)||null:null;
    const actualProfit=profit==null?null:Number(profit?.actual_profit_rollup_total);
    const actualMargin=profit==null?null:Number(profit?.actual_margin_percent);
    return {
      agreement_id:p?.id||p?.agreement_id||null,agreement_code:p?.agreement_code||renewal?.agreement_code||null,
      client_name:p?.client_name||renewal?.client_name||null,site_name:p?.site_name||p?.client_site_name||renewal?.site_name||null,
      service_name:p?.service_name||renewal?.service_name||null,season_context:p?.season_context||renewal?.season_context||forecastSeason(p),
      agreement_status:p?.agreement_status||renewal?.agreement_status||null,renewal_status:renewal?.renewal_status||null,
      end_date:endDate||null,outcome_state:outcomeState,outcome_date:outcomeDate,outcome_source:outcomeSource,
      reason_evidence:reasonEvidence.slice(0,8),unresolved_service_issue_count:openIssues.length,
      customer_hold_reason:holdReason,cancellation_reason:cancellationReason,
      finance_evidence_state:input.financeVisible?(profit?'available':'not_recorded'):'not_visible',
      actual_profit_total:profit!=null&&Number.isFinite(actualProfit)?actualProfit:null,
      actual_margin_percent:profit!=null&&Number.isFinite(actualMargin)?actualMargin:null
    };
  });

  const counts=(state:string)=>rows.filter((r)=>r.outcome_state===state).length;
  const renewed=counts('renewed'),declined=counts('declined'),held=counts('held'),expired=counts('expired'),unresolved=counts('unresolved');
  const explicitDecisionCount=renewed+declined;
  const outcomeOrder={declined:0,expired:1,held:2,unresolved:3,renewed:4} as Record<string,number>;
  const sorted=[...rows].sort((a,b)=>(outcomeOrder[a.outcome_state]??9)-(outcomeOrder[b.outcome_state]??9)||String(b.outcome_date||'').localeCompare(String(a.outcome_date||''))||String(a.client_name||a.agreement_code||'').localeCompare(String(b.client_name||b.agreement_code||'')));
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk!==false,
    summary:{
      loaded_agreements:rows.length,renewed_count:renewed,declined_count:declined,held_count:held,expired_count:expired,unresolved_count:unresolved,
      explicit_renewal_decision_count:explicitDecisionCount,
      recorded_renewal_conversion_rate_percent:explicitDecisionCount?Math.round((renewed/explicitDecisionCount)*1000)/10:null,
      recorded_churn_outcome_count:declined+expired,
      outcomes_with_unresolved_service_issues:rows.filter((r)=>r.unresolved_service_issue_count>0).length,
      finance_evidence_visible:input.financeVisible
    },
    outcome_groups:['renewed','declined','held','expired','unresolved'].map((state)=>({
      outcome_state:state,count:counts(state),
      recorded_profit_total:input.financeVisible?Number(rows.filter((r)=>r.outcome_state===state&&r.actual_profit_total!=null).reduce((sum,r)=>sum+Number(r.actual_profit_total||0),0).toFixed(2)):null
    })),
    outcomes:sorted.slice(0,250),
    classification_boundary:'Renewed and declined require explicit CRM/seasonal renewal-decision evidence or an explicitly renewal-related cancellation reason. Active, overdue, cancelled or future status alone is not converted into a renewal decision. Held uses recorded pause/hold evidence. Expired requires recorded ended/expired lifecycle evidence or an end date already passed on a non-active lifecycle.',
    conversion_boundary:'Recorded renewal conversion rate is renewed divided by explicit renewed plus declined decisions only. Held, expired and unresolved agreements are excluded from that rate rather than being guessed.',
    churn_boundary:'Recorded churn outcomes are explicit declined plus expired outcomes only. Ambiguous cancellation or missing renewal evidence remains unresolved.',
    finance_boundary:'Profit and margin are shown only when Finance evidence is visible and recorded. No target profitability, renewal price or retention value is invented.',
    authority_boundary:'Read-only outcome learning only. This layer cannot renew or cancel an agreement, change pricing, send customer contact, resolve a complaint, or mutate CRM, recurring-service, seasonal-rollover or Finance records.'
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




function buildEstimateAccuracyChangeOrderCalibration(input:{
  workflows:any[];assumptions:any[];assumptionVariance:any[];production:any[];changeOrders:any[];jobCosts:any[];jobs:any[];
  jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const numberOrNull=(value:any)=>{
    if(value===null||value===undefined||value==='') return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const round2=(value:number)=>Math.round(value*100)/100;
  const normalizeType=(value:any)=>{
    const v=String(value||'').trim().toLowerCase();
    if(/labou?r|crew|wage|time/.test(v)) return 'labour';
    if(/material|supply|consumable/.test(v)) return 'material';
    if(/equipment|machine|tool|vehicle/.test(v)) return 'equipment';
    return v||'other';
  };
  const isAccepted=(w:any)=>w?.customer_approval_ready===true||String(w?.estimate_status||'').toLowerCase()==='accepted'||!!w?.quote_accepted_at;
  const isApprovedChange=(ch:any)=>String(ch?.customer_authorization_status||'').toLowerCase()==='authorized'||String(ch?.status||'').toLowerCase()==='approved'||!!ch?.customer_approved_at;
  const isAppliedChange=(ch:any)=>String(ch?.scope_application_status||'').toLowerCase()==='applied'||!!ch?.budget_application_id||!!ch?.applied_work_order_line_id;

  const varianceByWorkOrder=new Map((input.assumptionVariance||[]).map((r)=>[String(r?.work_order_id||''),r]));
  const jobById=new Map((input.jobs||[]).map((r)=>[String(r?.id||''),r]));
  const jobCostById=new Map((input.jobCosts||[]).map((r)=>[String(r?.job_id||''),r]));
  const assumptionsByEstimate=new Map<string,any[]>();
  for(const row of input.assumptions||[]){
    const id=String(row?.estimate_id||'');if(!id)continue;
    if(row?.is_active===false||row?.selected===false) continue;
    const list=assumptionsByEstimate.get(id)||[];list.push(row);assumptionsByEstimate.set(id,list);
  }
  const productionByWorkOrder=new Map<string,any[]>();
  for(const row of input.production||[]){
    const id=String(row?.work_order_id||'');if(!id)continue;
    const list=productionByWorkOrder.get(id)||[];list.push(row);productionByWorkOrder.set(id,list);
  }
  const changesByWorkOrder=new Map<string,any[]>();
  const changesByEstimate=new Map<string,any[]>();
  for(const row of input.changeOrders||[]){
    const wid=String(row?.work_order_id||'');if(wid){const list=changesByWorkOrder.get(wid)||[];list.push(row);changesByWorkOrder.set(wid,list);}
    const eid=String(row?.estimate_id||'');if(eid){const list=changesByEstimate.get(eid)||[];list.push(row);changesByEstimate.set(eid,list);}
  }

  const records=(input.workflows||[]).filter(isAccepted).map((w)=>{
    const estimateId=String(w?.estimate_id||'');
    const workOrderId=String(w?.work_order_id||'');
    const legacyJobId=String(w?.legacy_job_id||'');
    const variance=workOrderId?varianceByWorkOrder.get(workOrderId)||null:null;
    const job=legacyJobId?jobById.get(legacyJobId)||null:null;
    const jobCost=legacyJobId?jobCostById.get(legacyJobId)||null:null;
    const productionRows=workOrderId?(productionByWorkOrder.get(workOrderId)||[]):[];
    const assumptionRows=estimateId?(assumptionsByEstimate.get(estimateId)||[]):[];
    const relatedChanges=[...(workOrderId?(changesByWorkOrder.get(workOrderId)||[]):[]),...(estimateId?(changesByEstimate.get(estimateId)||[]):[])]
      .filter((row,index,all)=>all.findIndex((x)=>String(x?.id||'')===String(row?.id||''))===index);
    const approvedChanges=relatedChanges.filter(isApprovedChange);
    const appliedApprovedChanges=approvedChanges.filter(isAppliedChange);

    const baselineByType:any=variance?.baseline_by_type&&typeof variance.baseline_by_type==='object'?variance.baseline_by_type:{};
    const plannedCostByType:{[key:string]:number}={};
    for(const [rawType,bucket] of Object.entries(baselineByType)){
      const type=normalizeType(rawType);
      const cost=numberOrNull((bucket as any)?.baseline_cost);
      if(cost!==null) plannedCostByType[type]=round2((plannedCostByType[type]||0)+cost);
    }
    if(Object.keys(plannedCostByType).length===0){
      for(const row of assumptionRows){
        const type=normalizeType(row?.assumption_type);
        const cost=numberOrNull(row?.estimated_cost);
        if(cost!==null) plannedCostByType[type]=round2((plannedCostByType[type]||0)+cost);
      }
    }

    const unitEvidence=['labour','material','equipment'].map((type)=>{
      const rows=assumptionRows.filter((r)=>normalizeType(r?.assumption_type)===type);
      const units=[...new Set(rows.map((r)=>String(r?.unit_label||'').trim()).filter(Boolean))];
      const quantities=rows.map((r)=>numberOrNull(r?.quantity)).filter((v)=>v!==null) as number[];
      return {
        assumption_type:type,source_unit_labels:units,
        source_quantity_total:units.length===1&&quantities.length===rows.length?round2(quantities.reduce((sum,v)=>sum+v,0)):null,
        quantity_aggregation_state:units.length===1&&quantities.length===rows.length?'same_recorded_unit':'not_aggregated_due_to_missing_or_mixed_units'
      };
    });

    const productionLabourRows=productionRows.map((r)=>numberOrNull(r?.total_labour_hours)).filter((v)=>v!==null) as number[];
    const productionLabourHours=productionLabourRows.length?round2(productionLabourRows.reduce((sum,v)=>sum+v,0)):null;
    const estimatedLabourHours=numberOrNull(w?.estimated_labour_hours);
    const jobLabourCost=job&&((Number(job?.labor_entry_count||0)>0)||numberOrNull(job?.actual_labor_cost_total)!==null)?numberOrNull(job?.actual_labor_cost_total):null;

    const productionMaterialCostRows=productionRows.map((r)=>numberOrNull(r?.material_cost_total)).filter((v)=>v!==null) as number[];
    const productionMaterialIssueCount=productionRows.reduce((sum,r)=>sum+Math.max(0,Number(r?.material_issue_count||0)),0);
    const jobMaterialCost=jobCost&&((Number(jobCost?.material_cost_total||0)!==0)||productionMaterialIssueCount>0)
      ?numberOrNull(jobCost?.material_cost_total)
      :(productionMaterialCostRows.length?round2(productionMaterialCostRows.reduce((sum,v)=>sum+v,0)):null);

    const productionEquipmentEvidenceCount=productionRows.reduce((sum,r)=>sum+Math.max(0,Number(r?.equipment_signout_count||0)),0);
    const jobEquipmentCost=jobCost&&((Number(jobCost?.equipment_usage_cost_total||0)!==0)||productionEquipmentEvidenceCount>0)
      ?numberOrNull(jobCost?.equipment_usage_cost_total):null;

    const components=[
      {component:'labour',estimated_cost:numberOrNull(plannedCostByType.labour),actual_cost:jobLabourCost},
      {component:'material',estimated_cost:numberOrNull(plannedCostByType.material),actual_cost:jobMaterialCost},
      {component:'equipment',estimated_cost:numberOrNull(plannedCostByType.equipment),actual_cost:jobEquipmentCost}
    ].map((row)=>{
      const comparable=row.estimated_cost!==null&&row.actual_cost!==null;
      const varianceCost=comparable?round2(Number(row.actual_cost)-Number(row.estimated_cost)):null;
      const variancePercent=comparable&&Number(row.estimated_cost)!==0?round2((Number(varianceCost)/Math.abs(Number(row.estimated_cost)))*100):null;
      return {...row,comparable,cost_variance:varianceCost,cost_variance_percent:variancePercent};
    });

    const approvedEstimatedCostDelta=round2(appliedApprovedChanges.reduce((sum,ch)=>sum+Number(ch?.estimated_cost_delta||0),0));
    const approvedEstimatedChargeDelta=round2(appliedApprovedChanges.reduce((sum,ch)=>sum+Number(ch?.estimated_charge_delta||0),0));
    const actualChangeCostValues=appliedApprovedChanges.map((ch)=>numberOrNull(ch?.actual_cost_delta)).filter((v)=>v!==null) as number[];
    const actualChangeChargeValues=appliedApprovedChanges.map((ch)=>numberOrNull(ch?.actual_charge_delta)).filter((v)=>v!==null) as number[];

    const baselineCost=numberOrNull(variance?.baseline_assumption_cost_total??w?.estimate_baseline_cost_total??w?.estimate_total_cost);
    const adjustedBaselineCost=baselineCost===null?null:round2(baselineCost+approvedEstimatedCostDelta);
    const jobCostEvidence=jobCost&&(
      Number(jobCost?.cost_event_count||0)>0||
      Number(jobCost?.actual_cost_total||0)!==0||
      Number(jobCost?.material_cost_total||0)!==0||
      Number(jobCost?.equipment_usage_cost_total||0)!==0||
      (job&&Number(job?.labor_entry_count||0)>0)
    );
    const actualKnownCost=jobCostEvidence?numberOrNull(jobCost?.total_known_cost):null;
    const totalCostVariance=adjustedBaselineCost!==null&&actualKnownCost!==null?round2(actualKnownCost-adjustedBaselineCost):null;

    const estimatedMargin=numberOrNull(w?.estimate_margin_percent);
    const actualMargin=numberOrNull(job?.actual_margin_rollup_percent??job?.actual_margin_percent);
    const marginVariancePp=estimatedMargin!==null&&actualMargin!==null?round2(actualMargin-estimatedMargin):null;
    const labourHourVariance=estimatedLabourHours!==null&&productionLabourHours!==null?round2(productionLabourHours-estimatedLabourHours):null;
    const templateKey=String(w?.template_code||w?.template_name||w?.quote_title||'Unclassified estimate');
    const completed=productionRows.some((r)=>/(^complete$|completed)/i.test(String(r?.completion_state||r?.production_state||r?.session_status||'')))||w?.completion_ready_for_accounting===true;

    return {
      estimate_id:w?.estimate_id||null,estimate_number:w?.estimate_number||null,work_order_id:w?.work_order_id||null,work_order_number:w?.work_order_number||null,
      legacy_job_id:w?.legacy_job_id||null,client_name:w?.client_name||null,site_name:w?.site_name||null,
      template_key:templateKey,template_code:w?.template_code||null,template_name:w?.template_name||null,
      baseline_snapshot_version:variance?.estimate_assumption_snapshot_version??w?.estimate_assumption_snapshot_version??null,
      baseline_source:variance?'accepted_work_order_assumption_snapshot':assumptionRows.length?'current_estimate_assumption_directory':'estimate_total_fallback',
      baseline_cost_total:baselineCost,approved_applied_change_order_count:appliedApprovedChanges.length,approved_change_order_count:approvedChanges.length,
      approved_applied_estimated_cost_delta:approvedEstimatedCostDelta,approved_applied_estimated_charge_delta:approvedEstimatedChargeDelta,
      approved_applied_actual_cost_delta:actualChangeCostValues.length?round2(actualChangeCostValues.reduce((sum,v)=>sum+v,0)):null,
      approved_applied_actual_charge_delta:actualChangeChargeValues.length?round2(actualChangeChargeValues.reduce((sum,v)=>sum+v,0)):null,
      adjusted_baseline_cost_total:adjustedBaselineCost,actual_known_cost_total:actualKnownCost,total_cost_variance:totalCostVariance,
      estimated_margin_percent:estimatedMargin,actual_margin_percent:actualMargin,margin_variance_percentage_points:marginVariancePp,
      estimated_labour_hours:estimatedLabourHours,recorded_production_labour_hours:productionLabourHours,labour_hours_variance:labourHourVariance,
      component_cost_variance:components,assumption_unit_evidence:unitEvidence,
      production_session_count:productionRows.length,completion_evidence_recorded:completed,
      production_material_issue_count:productionMaterialIssueCount,production_equipment_signout_count:productionEquipmentEvidenceCount,
      finance_cost_event_count:Number(jobCost?.cost_event_count||0),comparison_ready:adjustedBaselineCost!==null&&actualKnownCost!==null
    };
  });

  const componentSummary=['labour','material','equipment'].map((component)=>{
    const rows=records.map((r)=>r.component_cost_variance.find((c:any)=>c.component===component)).filter((c)=>c?.comparable);
    return {
      component,comparable_jobs:rows.length,
      estimated_cost_total:round2(rows.reduce((sum,c)=>sum+Number(c.estimated_cost||0),0)),
      actual_cost_total:round2(rows.reduce((sum,c)=>sum+Number(c.actual_cost||0),0)),
      cost_variance_total:round2(rows.reduce((sum,c)=>sum+Number(c.cost_variance||0),0)),
      adverse_jobs:rows.filter((c)=>Number(c.cost_variance)>0).length,
      favorable_jobs:rows.filter((c)=>Number(c.cost_variance)<0).length,
      exact_jobs:rows.filter((c)=>Number(c.cost_variance)===0).length
    };
  });

  const byTemplate=new Map<string,any[]>();
  for(const row of records){
    const list=byTemplate.get(row.template_key)||[];list.push(row);byTemplate.set(row.template_key,list);
  }
  const recurringPatterns:any[]=[];
  for(const [templateKey,rows] of byTemplate.entries()){
    if(rows.length<2) continue;
    for(const component of ['labour','material','equipment']){
      const values=rows.map((r)=>r.component_cost_variance.find((c:any)=>c.component===component)).filter((c)=>c?.comparable);
      const adverse=values.filter((c)=>Number(c.cost_variance)>0);
      const favorable=values.filter((c)=>Number(c.cost_variance)<0);
      if(adverse.length>=2||favorable.length>=2){
        const selected=adverse.length>=2?adverse:favorable;
        recurringPatterns.push({
          template_key:templateKey,pattern_type:'component_cost_variance',component,
          direction:adverse.length>=2?'actual_cost_above_estimate':'actual_cost_below_estimate',
          occurrence_count:selected.length,comparable_count:values.length,
          recorded_variance_total:round2(selected.reduce((sum,c)=>sum+Number(c.cost_variance||0),0)),
          review_note:'Repeated recorded variance is a calibration review signal only; estimate assumptions are not changed automatically.'
        });
      }
    }
    const marginRows=rows.filter((r)=>r.margin_variance_percentage_points!==null);
    const lower=marginRows.filter((r)=>Number(r.margin_variance_percentage_points)<0);
    const higher=marginRows.filter((r)=>Number(r.margin_variance_percentage_points)>0);
    if(lower.length>=2||higher.length>=2){
      const selected=lower.length>=2?lower:higher;
      recurringPatterns.push({
        template_key:templateKey,pattern_type:'recorded_margin_variance',component:'margin',
        direction:lower.length>=2?'actual_margin_below_recorded_estimate_margin':'actual_margin_above_recorded_estimate_margin',
        occurrence_count:selected.length,comparable_count:marginRows.length,
        recorded_variance_total:round2(selected.reduce((sum,r)=>sum+Number(r.margin_variance_percentage_points||0),0)),
        review_note:'This compares recorded estimate margin with recorded actual margin; it is not a target-margin recommendation.'
      });
    }
    const totalRows=rows.filter((r)=>r.total_cost_variance!==null);
    const adverseTotal=totalRows.filter((r)=>Number(r.total_cost_variance)>0);
    const favorableTotal=totalRows.filter((r)=>Number(r.total_cost_variance)<0);
    if(adverseTotal.length>=2||favorableTotal.length>=2){
      const selected=adverseTotal.length>=2?adverseTotal:favorableTotal;
      recurringPatterns.push({
        template_key:templateKey,pattern_type:'adjusted_total_cost_variance',component:'total_cost',
        direction:adverseTotal.length>=2?'actual_known_cost_above_adjusted_baseline':'actual_known_cost_below_adjusted_baseline',
        occurrence_count:selected.length,comparable_count:totalRows.length,
        recorded_variance_total:round2(selected.reduce((sum,r)=>sum+Number(r.total_cost_variance||0),0)),
        review_note:'Adjusted baseline includes only recorded approved/applied estimated change-order cost deltas.'
      });
    }
  }
  recurringPatterns.sort((a,b)=>b.occurrence_count-a.occurrence_count||String(a.template_key).localeCompare(String(b.template_key)));

  const comparisonReady=records.filter((r)=>r.comparison_ready);
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk!==false,
    jobs_visible:input.jobsVisible,finance_visible:input.financeVisible,
    summary:{
      accepted_estimates_reviewed:records.length,
      work_orders_with_accepted_baseline_snapshot:records.filter((r)=>r.baseline_source==='accepted_work_order_assumption_snapshot').length,
      comparison_ready_jobs:comparisonReady.length,
      approved_change_orders:records.reduce((sum,r)=>sum+Number(r.approved_change_order_count||0),0),
      approved_applied_change_orders:records.reduce((sum,r)=>sum+Number(r.approved_applied_change_order_count||0),0),
      comparable_labour_cost_jobs:componentSummary.find((r)=>r.component==='labour')?.comparable_jobs||0,
      comparable_material_cost_jobs:componentSummary.find((r)=>r.component==='material')?.comparable_jobs||0,
      comparable_equipment_cost_jobs:componentSummary.find((r)=>r.component==='equipment')?.comparable_jobs||0,
      labour_hours_comparable_jobs:records.filter((r)=>r.labour_hours_variance!==null).length,
      margin_comparable_jobs:records.filter((r)=>r.margin_variance_percentage_points!==null).length,
      recurring_calibration_pattern_count:recurringPatterns.length
    },
    component_summary:componentSummary,
    recurring_calibration_patterns:recurringPatterns.slice(0,60),
    calibration_records:records.sort((a,b)=>Math.abs(Number(b.total_cost_variance||0))-Math.abs(Number(a.total_cost_variance||0))||String(a.estimate_number||'').localeCompare(String(b.estimate_number||''))).slice(0,250),
    baseline_boundary:'Accepted work-order assumption snapshots are preferred for baseline cost by type. Current estimate assumptions are only a fallback when no accepted snapshot exists, and the source is disclosed on each record.',
    unit_boundary:'Recorded assumption unit labels are preserved exactly. Labour quantity variance is calculated only between recorded estimate labour hours and recorded Production labour hours; material and equipment quantities are not converted or compared across mixed or missing units.',
    change_order_boundary:'Adjusted baseline cost includes only recorded customer-approved and applied change-order estimated cost deltas. Approved but unapplied changes remain visible in counts and do not silently alter the baseline.',
    margin_boundary:'Margin calibration compares recorded estimate margin percent with recorded actual job margin percent only. It does not invent a target margin, required markup, price change or profitability threshold.',
    actuals_boundary:'Actual labour, material and equipment comparisons use recorded job/Production cost evidence. Missing cost evidence remains unavailable; zero is not inferred from a missing source.',
    authority_boundary:'Read-only calibration only. Estimate assumptions, customer approvals, change-order approvals/application, job-cost closeout and Finance posting remain under their existing source authorities; this layer cannot edit estimates, approve extras, change pricing or post accounting.'
  };
}


function buildCompletedToInvoicedCashConversion(input:{
  workflows:any[];production:any[];closeouts:any[];invoiceCandidates:any[];receivables:any[];paymentApplications:any[];
  jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const now=new Date();
  const stamp=(value:any)=>{
    if(!value) return null;
    const d=new Date(value);return Number.isFinite(d.getTime())?d:null;
  };
  const iso=(value:any)=>{const d=stamp(value);return d?d.toISOString():null;};
  const round1=(value:number)=>Math.round(value*10)/10;
  const hoursBetween=(a:any,b:any)=>{
    const start=stamp(a),end=stamp(b);if(!start||!end||end.getTime()<start.getTime())return null;
    return round1((end.getTime()-start.getTime())/3600000);
  };
  const daysBetween=(a:any,b:any)=>{
    const h=hoursBetween(a,b);return h===null?null:round1(h/24);
  };
  const ageDays=(a:any)=>daysBetween(a,now.toISOString());
  const average=(values:any[])=>{
    const nums=values.filter((v)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
    return nums.length?round1(nums.reduce((sum,v)=>sum+v,0)/nums.length):null;
  };
  const bucket=(days:any)=>{
    if(days===null||days===undefined||!Number.isFinite(Number(days))) return 'age_unavailable';
    const n=Number(days);if(n<2)return '0_1_days';if(n<4)return '2_3_days';if(n<8)return '4_7_days';return '8_plus_days';
  };
  const completedState=(r:any)=>/(^complete$|completed)/i.test(String(r?.completion_state||r?.production_state||r?.session_status||''));

  const workflowsByWorkOrder=new Map((input.workflows||[]).filter((r)=>r?.work_order_id).map((r)=>[String(r.work_order_id),r]));
  const productionByWorkOrder=new Map<string,any[]>();
  for(const r of input.production||[]){
    const id=String(r?.work_order_id||'');if(!id)continue;
    const list=productionByWorkOrder.get(id)||[];list.push(r);productionByWorkOrder.set(id,list);
  }
  const closeoutByWorkOrder=new Map<string,any>();
  for(const r of input.closeouts||[]){
    const id=String(r?.work_order_id||'');if(!id)continue;
    const prev=closeoutByWorkOrder.get(id);
    const t=stamp(r?.approved_at||r?.submitted_at||r?.created_at)?.getTime()||0;
    const pt=stamp(prev?.approved_at||prev?.submitted_at||prev?.created_at)?.getTime()||0;
    if(!prev||t>=pt)closeoutByWorkOrder.set(id,r);
  }
  const candidatesByWorkOrder=new Map<string,any[]>();
  for(const r of input.invoiceCandidates||[]){
    const id=String(r?.work_order_id||'');if(!id)continue;
    const list=candidatesByWorkOrder.get(id)||[];list.push(r);candidatesByWorkOrder.set(id,list);
  }
  const receivablesByWorkOrder=new Map<string,any[]>();
  const receivableById=new Map<string,any>();
  for(const r of input.receivables||[]){
    const id=String(r?.id||'');if(id)receivableById.set(id,r);
    const wid=String(r?.work_order_id||'');if(!wid)continue;
    const list=receivablesByWorkOrder.get(wid)||[];list.push(r);receivablesByWorkOrder.set(wid,list);
  }
  const paymentsByInvoice=new Map<string,any[]>();
  for(const r of input.paymentApplications||[]){
    const id=String(r?.invoice_id||'');if(!id)continue;
    const list=paymentsByInvoice.get(id)||[];list.push(r);paymentsByInvoice.set(id,list);
  }

  const workOrderIds=new Set<string>();
  for(const [id,rows] of productionByWorkOrder.entries())if(rows.some(completedState))workOrderIds.add(id);
  for(const [id,r] of closeoutByWorkOrder.entries())if(r?.approved_at||String(r?.closeout_status||'').toLowerCase()==='approved')workOrderIds.add(id);
  for(const [id,w] of workflowsByWorkOrder.entries())if(w?.completion_ready_for_accounting===true)workOrderIds.add(id);

  const records=[...workOrderIds].map((workOrderId)=>{
    const workflow=workflowsByWorkOrder.get(workOrderId)||null;
    const productionRows=productionByWorkOrder.get(workOrderId)||[];
    const completedRows=productionRows.filter(completedState);
    const completionTimes=completedRows.map((r)=>r?.ended_at||r?.site_supervisor_signed_off_at||r?.production_recorded_at)
      .map(stamp).filter(Boolean) as Date[];
    const completionAt=completionTimes.length?new Date(Math.max(...completionTimes.map((d)=>d.getTime()))).toISOString():null;
    const closeout=closeoutByWorkOrder.get(workOrderId)||null;
    const closeoutApprovedAt=iso(closeout?.approved_at);
    const candidates=(candidatesByWorkOrder.get(workOrderId)||[]).slice().sort((a,b)=>(stamp(a?.created_at)?.getTime()||0)-(stamp(b?.created_at)?.getTime()||0));
    const candidate=candidates[0]||null;
    const invoiceReadyAt=iso(candidate?.created_at);

    const workflowInvoiceId=String(workflow?.ar_invoice_id||'');
    const linkedReceivables=(receivablesByWorkOrder.get(workOrderId)||[]).slice().sort((a,b)=>(stamp(a?.created_at)?.getTime()||0)-(stamp(b?.created_at)?.getTime()||0));
    const invoice=(workflowInvoiceId&&receivableById.get(workflowInvoiceId))||linkedReceivables[0]||null;
    const invoiceCreatedAt=iso(invoice?.created_at||invoice?.invoice_date);
    const invoiceId=String(invoice?.id||workflow?.ar_invoice_id||'');
    const payments=invoiceId?(paymentsByInvoice.get(invoiceId)||[]):[];
    const sortedPayments=payments.slice().sort((a,b)=>(stamp(a?.application_date||a?.created_at)?.getTime()||0)-(stamp(b?.application_date||b?.created_at)?.getTime()||0));
    const firstPayment=sortedPayments[0]||null;
    const latestPayment=sortedPayments[sortedPayments.length-1]||null;
    const firstPaymentAt=iso(firstPayment?.application_date||firstPayment?.created_at);
    const latestPaymentAt=iso(latestPayment?.application_date||latestPayment?.created_at);
    const appliedTotal=round1(payments.reduce((sum,r)=>sum+Number(r?.applied_amount||0),0));
    const invoiceTotal=invoice?.total_amount==null?null:Number(invoice.total_amount);
    const balanceDue=invoice?.balance_due==null?null:Number(invoice.balance_due);
    const fullyCollected=Boolean(invoice&&latestPaymentAt&&Number.isFinite(balanceDue)&&balanceDue<=0&&appliedTotal>0);
    const collectionAt=fullyCollected?latestPaymentAt:null;

    const anchorAt=closeoutApprovedAt||completionAt;
    let currentStage='completion_or_closeout_only';
    let stageStartedAt=anchorAt;
    if(invoiceReadyAt&&!invoiceCreatedAt){currentStage='invoice_ready_not_invoiced';stageStartedAt=invoiceReadyAt;}
    else if(invoiceCreatedAt&&!fullyCollected){currentStage='invoiced_open';stageStartedAt=invoiceCreatedAt;}
    else if(fullyCollected){currentStage='collected';stageStartedAt=collectionAt;}
    else if(anchorAt&&!invoiceReadyAt){currentStage='completed_not_invoice_ready';}
    const currentAgeDays=currentStage==='collected'?0:ageDays(stageStartedAt);

    return {
      work_order_id:workOrderId,
      work_order_number:workflow?.work_order_number||closeout?.work_order_number||completedRows[0]?.work_order_number||null,
      estimate_number:workflow?.estimate_number||null,
      client_name:workflow?.client_name||closeout?.client_name||completedRows[0]?.client_name||invoice?.client_name||null,
      site_name:workflow?.site_name||completedRows[0]?.site_name||null,
      completion_at:completionAt,completion_source:completionAt?'latest_recorded_completed_production_session':null,
      closeout_approved_at:closeoutApprovedAt,closeout_status:closeout?.closeout_status||null,
      invoice_readiness_status:closeout?.invoice_readiness_status||null,
      invoice_candidate_id:candidate?.id||workflow?.invoice_candidate_id||null,
      invoice_candidate_number:candidate?.candidate_number||workflow?.invoice_candidate_number||null,
      invoice_ready_at:invoiceReadyAt,invoice_ready_source:invoiceReadyAt?'job_invoice_candidates.created_at':null,
      invoice_id:invoice?.id||workflow?.ar_invoice_id||null,invoice_number:invoice?.invoice_number||workflow?.ar_invoice_number||null,
      invoice_status:invoice?.invoice_status||workflow?.ar_invoice_status||null,invoice_created_at:invoiceCreatedAt,
      invoice_total_amount:Number.isFinite(invoiceTotal)?invoiceTotal:null,invoice_balance_due:Number.isFinite(balanceDue)?balanceDue:null,
      payment_application_count:payments.length,payment_applied_total:appliedTotal,first_payment_at:firstPaymentAt,latest_payment_at:latestPaymentAt,
      collection_at:collectionAt,fully_collected_with_payment_evidence:fullyCollected,
      completion_to_closeout_hours:hoursBetween(completionAt,closeoutApprovedAt),
      completion_to_invoice_ready_hours:hoursBetween(completionAt,invoiceReadyAt),
      closeout_to_invoice_ready_hours:hoursBetween(closeoutApprovedAt,invoiceReadyAt),
      invoice_ready_to_invoice_hours:hoursBetween(invoiceReadyAt,invoiceCreatedAt),
      completion_to_invoice_hours:hoursBetween(completionAt,invoiceCreatedAt),
      closeout_to_invoice_hours:hoursBetween(closeoutApprovedAt,invoiceCreatedAt),
      invoice_to_first_payment_days:daysBetween(invoiceCreatedAt,firstPaymentAt),
      invoice_to_collection_days:daysBetween(invoiceCreatedAt,collectionAt),
      completion_to_collection_days:daysBetween(completionAt,collectionAt),
      current_stage:currentStage,current_stage_age_days:currentAgeDays,current_stage_age_bucket:bucket(currentAgeDays)
    };
  }).sort((a,b)=>{
    const av=Number(a.current_stage_age_days??-1),bv=Number(b.current_stage_age_days??-1);
    return bv-av||String(a.work_order_number||'').localeCompare(String(b.work_order_number||''));
  });

  const agingStages=['completed_not_invoice_ready','invoice_ready_not_invoiced','invoiced_open'];
  const agingCohorts=agingStages.flatMap((stage)=>['0_1_days','2_3_days','4_7_days','8_plus_days'].map((ageBucket)=>{
    const rows=records.filter((r)=>r.current_stage===stage&&r.current_stage_age_bucket===ageBucket);
    return {
      stage,age_bucket:ageBucket,count:rows.length,
      invoice_value_total:round1(rows.reduce((sum,r)=>sum+Number(r.invoice_total_amount||0),0)),
      open_balance_total:round1(rows.reduce((sum,r)=>sum+Number(r.invoice_balance_due||0),0))
    };
  }));

  const invoiced=records.filter((r)=>r.invoice_created_at);
  const collected=records.filter((r)=>r.fully_collected_with_payment_evidence);
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk!==false,
    jobs_visible:input.jobsVisible,finance_visible:input.financeVisible,
    summary:{
      completed_or_approved_closeouts:records.length,
      invoice_ready_count:records.filter((r)=>r.invoice_ready_at).length,
      invoiced_count:invoiced.length,
      fully_collected_with_payment_evidence_count:collected.length,
      completed_not_invoice_ready_count:records.filter((r)=>r.current_stage==='completed_not_invoice_ready').length,
      invoice_ready_not_invoiced_count:records.filter((r)=>r.current_stage==='invoice_ready_not_invoiced').length,
      invoiced_open_count:records.filter((r)=>r.current_stage==='invoiced_open').length,
      average_completion_to_invoice_hours:average(records.map((r)=>r.completion_to_invoice_hours)),
      average_closeout_to_invoice_hours:average(records.map((r)=>r.closeout_to_invoice_hours)),
      average_invoice_to_first_payment_days:average(records.map((r)=>r.invoice_to_first_payment_days)),
      average_invoice_to_collection_days:average(records.map((r)=>r.invoice_to_collection_days)),
      average_completion_to_collection_days:average(records.map((r)=>r.completion_to_collection_days)),
      recorded_invoiced_value_total:round1(invoiced.reduce((sum,r)=>sum+Number(r.invoice_total_amount||0),0)),
      recorded_open_balance_total:round1(invoiced.reduce((sum,r)=>sum+Math.max(0,Number(r.invoice_balance_due||0)),0)),
      recorded_fully_collected_invoice_value_total:round1(collected.reduce((sum,r)=>sum+Number(r.invoice_total_amount||0),0))
    },
    aging_cohorts:agingCohorts,
    cycle_records:records.slice(0,250),
    completion_boundary:'Completion time uses the latest recorded Production session explicitly carrying completed evidence. Completion is not inferred from a work-order status alone.',
    closeout_boundary:'Approved closeout time uses recorded closeout approved_at only. Generic closeout updated_at is not treated as approval or invoice-readiness time.',
    invoice_readiness_boundary:'Invoice readiness time uses the recorded job_invoice_candidates created_at event. A readiness status without a candidate timestamp is not assigned a synthetic time.',
    invoice_boundary:'Invoice creation time uses recorded A/R invoice created_at, with invoice_date only as a source fallback when creation time is absent.',
    payment_boundary:'Payment timing uses recorded payment-application evidence. Full collection requires an A/R balance at or below zero plus at least one recorded applied payment; a paid-looking status alone is not treated as cash collection.',
    aging_boundary:'Aging buckets are descriptive elapsed-time cohorts (0–1, 2–3, 4–7 and 8+ days), not service-level targets or collection thresholds.',
    authority_boundary:'Read-only cash-conversion evidence only. This layer cannot create invoices, apply payments, send collection messages, post journals, alter closeout approvals or mutate payment/provider state.'
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




function buildEquipmentDowntimeCostReplacementReadiness(input:{
  equipment:any[];maintenance:any[];maintenanceHistory:any[];serviceTasks:any[];equipmentUse:any[];fleet:any[];downtimeEvents:any[];jobCosts:any[];
  jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const now=new Date();
  const today=ontarioDateKey(now)!;
  const lookbackDays=365;
  const lookbackStart=addCalendarDays(today,-lookbackDays);
  const dateKey=(value:any)=>ontarioDateKey(value);
  const inWindow=(value:any)=>{
    const d=dateKey(value);return !!d&&d>=lookbackStart&&d<=today;
  };
  const round2=(value:number)=>Math.round(value*100)/100;
  const numberOrNull=(value:any)=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };
  const stamp=(value:any)=>{
    if(!value)return null;
    const d=new Date(value);return Number.isFinite(d.getTime())?d:null;
  };
  const hoursBetween=(start:any,end:any)=>{
    const a=stamp(start),b=stamp(end);if(!a||!b||b.getTime()<a.getTime())return null;
    return round2((b.getTime()-a.getTime())/3600000);
  };
  const ageDays=(value:any)=>{
    const d=stamp(value);if(!d)return null;
    return round2(Math.max(0,(now.getTime()-d.getTime())/86400000));
  };
  const activeStatus=(value:any)=>!['resolved','closed','cancelled','complete','completed'].includes(String(value||'').toLowerCase());

  const historyByAsset=new Map<string,any[]>();
  for(const row of input.maintenanceHistory||[]){
    const id=String(row?.equipment_item_id||'');if(!id)continue;
    const list=historyByAsset.get(id)||[];list.push(row);historyByAsset.set(id,list);
  }
  const tasksByAsset=new Map<string,any[]>();
  for(const row of input.serviceTasks||[]){
    const id=String(row?.equipment_item_id||'');if(!id)continue;
    const list=tasksByAsset.get(id)||[];list.push(row);tasksByAsset.set(id,list);
  }
  const downtimeByAsset=new Map<string,any[]>();
  for(const row of input.downtimeEvents||[]){
    const id=String(row?.equipment_item_id||'');if(!id)continue;
    const list=downtimeByAsset.get(id)||[];list.push(row);downtimeByAsset.set(id,list);
  }
  const useByAsset=new Map<string,any[]>();
  for(const row of input.equipmentUse||[]){
    const id=String(row?.equipment_item_id||'');if(!id)continue;
    const list=useByAsset.get(id)||[];list.push(row);useByAsset.set(id,list);
  }
  const preventiveByAsset=new Map<string,any[]>();
  for(const row of input.maintenance||[]){
    const id=String(row?.equipment_item_id||'');if(!id)continue;
    const list=preventiveByAsset.get(id)||[];list.push(row);preventiveByAsset.set(id,list);
  }
  const fleetByAsset=new Map<string,any>();
  for(const row of input.fleet||[])if(row?.equipment_item_id)fleetByAsset.set(String(row.equipment_item_id),row);
  const jobCostById=new Map((input.jobCosts||[]).map((row)=>[String(row?.job_id||''),row]));

  const assets=(input.equipment||[]).map((asset)=>{
    const id=String(asset?.id||asset?.equipment_item_id||'');
    const history=(historyByAsset.get(id)||[]).filter((r)=>inWindow(r?.performed_at));
    const tasks=(tasksByAsset.get(id)||[]).filter((r)=>inWindow(r?.created_at||r?.updated_at||r?.resolved_at));
    const downtime=(downtimeByAsset.get(id)||[]).filter((r)=>inWindow(r?.started_at||r?.created_at));
    const uses=(useByAsset.get(id)||[]).filter((r)=>inWindow(r?.checked_out_at));
    const preventive=preventiveByAsset.get(id)||[];
    const fleet=fleetByAsset.get(id)||null;

    const downtimeHours=downtime.map((r)=>{
      const end=r?.ended_at||now.toISOString();
      return hoursBetween(r?.started_at,end);
    }).filter((v)=>v!==null) as number[];
    const openDowntime=downtime.filter((r)=>!r?.ended_at);
    const historyCosts=history.map((r)=>numberOrNull(r?.cost_amount)).filter((v)=>v!==null) as number[];
    const taskActualCosts=tasks.map((r)=>numberOrNull(r?.actual_cost)).filter((v)=>v!==null) as number[];
    const taskEstimatedCosts=tasks.filter((r)=>activeStatus(r?.task_status)).map((r)=>numberOrNull(r?.estimated_cost)).filter((v)=>v!==null) as number[];
    const openTasks=tasks.filter((r)=>activeStatus(r?.task_status));
    const overduePlans=preventive.filter((r)=>String(r?.due_status||'').toLowerCase()==='overdue');
    const duePlans=preventive.filter((r)=>['due','due_soon'].includes(String(r?.due_status||'').toLowerCase()));
    const damageUses=uses.filter((r)=>r?.damage_reported===true);
    const recentUse=uses.slice().sort((a,b)=>String(b?.checked_out_at||'').localeCompare(String(a?.checked_out_at||'')))[0]||null;

    const locked=asset?.is_locked_out===true||String(asset?.registry_readiness_status||'').toLowerCase()==='locked_out';
    const fleetDowntime=!!fleet&&(String(fleet?.operational_status||'').toLowerCase()==='downtime'||Number(fleet?.open_downtime_count||0)>0);
    const replacementState=String(asset?.replacement_state||'').toLowerCase();
    const replacementAttention=['plan_replacement','replace','retired'].includes(replacementState);
    const repeatedDowntime=downtime.length>=2;
    const repeatedMaintenance=history.length>=2||tasks.length>=2;
    const acquisitionCost=numberOrNull(asset?.acquisition_cost??asset?.purchase_price);
    const recordedServiceCost=numberOrNull(asset?.recorded_service_cost_total);
    const recordedLifecycleCost=numberOrNull(asset?.recorded_lifecycle_cost_total);
    const serviceCostToAcquisitionPercent=acquisitionCost!==null&&acquisitionCost>0&&recordedServiceCost!==null
      ?round2((recordedServiceCost/acquisitionCost)*100):null;

    const linkedJobIds=[...new Set([
      ...downtime.map((r)=>r?.job_id),
      ...tasks.map((r)=>r?.job_id),
      ...uses.map((r)=>r?.job_id)
    ].filter(Boolean).map(String))];
    const linkedJobCostContext=linkedJobIds.map((jobId)=>{
      const row=jobCostById.get(jobId);if(!row)return null;
      return {
        job_id:row?.job_id||null,job_code:row?.job_code||null,job_name:row?.job_name||null,
        job_equipment_repair_cost_total:numberOrNull(row?.job_equipment_repair_cost_total),
        equipment_repair_event_cost_total:numberOrNull(row?.equipment_repair_event_cost_total),
        equipment_replacement_cost_total:numberOrNull(row?.equipment_replacement_cost_total),
        job_delay_cost_total:numberOrNull(row?.job_delay_cost_total),
        cost_context_boundary:'Job-level cost context only; these amounts are not attributed to this asset unless the underlying Finance source explicitly does so.'
      };
    }).filter(Boolean);

    const signals:string[]=[];
    if(locked)signals.push('current equipment lockout');
    if(fleetDowntime)signals.push('current fleet downtime');
    if(repeatedDowntime)signals.push('repeated recorded downtime in 365 days');
    if(repeatedMaintenance)signals.push('repeated recorded maintenance/service activity in 365 days');
    if(overduePlans.length)signals.push('preventive maintenance overdue');
    else if(duePlans.length)signals.push('preventive maintenance due / due soon');
    if(openTasks.length)signals.push('open service task');
    if(damageUses.length)signals.push('recorded signout damage report');
    if(replacementAttention)signals.push('recorded replacement state '+replacementState);

    let reviewState='recorded_no_lifecycle_attention';
    if(['replace','retired'].includes(replacementState))reviewState='recorded_replacement_hold';
    else if(replacementState==='plan_replacement')reviewState='recorded_replacement_plan';
    else if(repeatedDowntime||repeatedMaintenance)reviewState='lifecycle_burden_review';
    else if(locked||fleetDowntime||overduePlans.length||openTasks.length)reviewState='operational_attention';

    return {
      equipment_item_id:asset?.id||asset?.equipment_item_id||null,equipment_code:asset?.equipment_code||null,
      equipment_name:asset?.equipment_name||null,category:asset?.category||null,status:asset?.status||null,
      condition_status:asset?.condition_status||null,registry_readiness_status:asset?.registry_readiness_status||null,
      purchase_year:asset?.purchase_year||null,purchase_date:asset?.purchase_date||null,year_of_manufacture:asset?.year_of_manufacture||null,
      acquisition_cost:acquisitionCost,warranty_expiry_date:asset?.warranty_expiry_date||null,
      locked_out:locked,locked_out_at:asset?.locked_out_at||null,lockout_age_days:locked?ageDays(asset?.locked_out_at):null,
      fleet_asset:!!fleet,fleet_operational_status:fleet?.operational_status||null,fleet_readiness_status:fleet?.latest_readiness_status||null,
      fleet_downtime:fleetDowntime,current_fleet_downtime_started_at:fleet?.downtime_started_at||null,
      current_fleet_downtime_hours:fleetDowntime?hoursBetween(fleet?.downtime_started_at,now.toISOString()):null,
      downtime_event_count_365:downtime.length,open_downtime_event_count:openDowntime.length,
      recorded_downtime_hours_365:round2(downtimeHours.reduce((sum,v)=>sum+v,0)),
      repeated_downtime:repeatedDowntime,
      maintenance_history_count_365:history.length,maintenance_history_cost_365:round2(historyCosts.reduce((sum,v)=>sum+v,0)),
      service_task_count_365:tasks.length,open_service_task_count_365:openTasks.length,
      service_task_actual_cost_365:round2(taskActualCosts.reduce((sum,v)=>sum+v,0)),
      open_service_estimated_cost_365:round2(taskEstimatedCosts.reduce((sum,v)=>sum+v,0)),
      repeated_maintenance_or_service:repeatedMaintenance,
      preventive_overdue_count:overduePlans.length,preventive_due_count:duePlans.length,
      signout_count_365:uses.length,damage_report_count_365:damageUses.length,last_recorded_use_at:recentUse?.checked_out_at||null,
      recorded_service_event_count_all_time:Number(asset?.recorded_service_event_count||0),
      recorded_service_cost_total_all_time:recordedServiceCost,
      service_task_actual_cost_total_all_time:numberOrNull(asset?.service_task_actual_cost_total),
      recorded_lifecycle_cost_total:recordedLifecycleCost,
      service_cost_to_acquisition_percent:serviceCostToAcquisitionPercent,
      replacement_state:asset?.replacement_state||null,replacement_target_date:asset?.replacement_target_date||null,
      replacement_reason:asset?.replacement_reason||null,replacement_estimated_cost:numberOrNull(asset?.replacement_estimated_cost),
      lifecycle_review_state:reviewState,lifecycle_review_signals:signals,
      linked_job_cost_context:input.financeVisible?linkedJobCostContext:[],
      linked_job_cost_context_count:input.financeVisible?linkedJobCostContext.length:0
    };
  }).sort((a,b)=>{
    const priority:Record<string,number>={recorded_replacement_hold:10,recorded_replacement_plan:20,lifecycle_burden_review:30,operational_attention:40,recorded_no_lifecycle_attention:50};
    return (priority[a.lifecycle_review_state]||99)-(priority[b.lifecycle_review_state]||99)||String(a.equipment_code||a.equipment_name||'').localeCompare(String(b.equipment_code||b.equipment_name||''));
  });

  const attention=assets.filter((a)=>a.lifecycle_review_state!=='recorded_no_lifecycle_attention');
  const knownServiceCosts=assets.map((a)=>a.recorded_service_cost_total_all_time).filter((v)=>v!==null) as number[];
  const knownLifecycleCosts=assets.map((a)=>a.recorded_lifecycle_cost_total).filter((v)=>v!==null) as number[];
  const replacementCosts=assets.filter((a)=>a.replacement_estimated_cost!==null&&['plan_replacement','replace'].includes(String(a.replacement_state||'').toLowerCase()))
    .map((a)=>Number(a.replacement_estimated_cost));
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',lookback_days:lookbackDays,lookback_start:lookbackStart,lookback_end:today,
    source_queries_ok:input.sourceQueriesOk!==false,jobs_visible:input.jobsVisible,finance_visible:input.financeVisible,
    summary:{
      equipment_assets:assets.length,locked_out_assets:assets.filter((a)=>a.locked_out).length,
      current_fleet_downtime_assets:assets.filter((a)=>a.fleet_downtime).length,
      assets_with_downtime_history_365:assets.filter((a)=>a.downtime_event_count_365>0).length,
      repeated_downtime_assets:assets.filter((a)=>a.repeated_downtime).length,
      recorded_downtime_hours_365:round2(assets.reduce((sum,a)=>sum+Number(a.recorded_downtime_hours_365||0),0)),
      repeated_maintenance_assets:assets.filter((a)=>a.repeated_maintenance_or_service).length,
      open_service_task_assets:assets.filter((a)=>a.open_service_task_count_365>0).length,
      preventive_overdue_assets:assets.filter((a)=>a.preventive_overdue_count>0).length,
      recorded_replacement_plan_assets:assets.filter((a)=>String(a.replacement_state||'').toLowerCase()==='plan_replacement').length,
      recorded_replacement_hold_assets:assets.filter((a)=>['replace','retired'].includes(String(a.replacement_state||'').toLowerCase())).length,
      lifecycle_attention_assets:attention.length,
      recorded_service_cost_total_all_time:round2(knownServiceCosts.reduce((sum,v)=>sum+v,0)),
      recorded_lifecycle_cost_total:round2(knownLifecycleCosts.reduce((sum,v)=>sum+v,0)),
      recorded_replacement_estimated_cost_total:round2(replacementCosts.reduce((sum,v)=>sum+v,0)),
      assets_with_finance_job_cost_context:input.financeVisible?assets.filter((a)=>a.linked_job_cost_context_count>0).length:0
    },
    lifecycle_attention:attention.slice(0,150),
    asset_evidence:assets.slice(0,300),
    downtime_boundary:'Downtime exposure uses recorded fleet_downtime_events started_at/ended_at. Open events are measured only from their recorded start through the evidence-generation time; no downtime before the recorded start is inferred.',
    maintenance_boundary:'Maintenance burden uses recorded maintenance history and service-task events. Registry all-time cost rollups are shown separately and are not added again to 365-day history/task costs, avoiding double counting.',
    cost_boundary:'Equipment-specific recorded service/lifecycle costs remain separate from linked job-level Finance context. Job repair, replacement or delay totals are shown as context only and are never attributed to an asset unless the Finance source already provides that attribution.',
    replacement_boundary:'Replacement readiness reports the existing replacement_state, target date, reason and estimated cost plus recorded lifecycle signals. Repeated downtime means at least two recorded downtime events; repeated maintenance means at least two recorded maintenance/service events. These are review signals, not replacement recommendations or cost thresholds.',
    safety_boundary:'Lockout and return-to-service remain controlled Equipment/Safety authorities. This layer cannot clear a lockout, mark an asset ready or override an inspection/readiness restriction.',
    authority_boundary:'Read-only lifecycle evidence. This layer cannot create/complete service tasks, purchase or replace equipment, create vendor commitments, alter fleet downtime, post Finance, or mutate equipment assignments.'
  };
}

function buildLabourCapturePayrollExceptionReduction(input:{
  timekeeping:any[];dispatch:any[];production:any[];jobsVisible:boolean;adminVisible:boolean;sourceQueriesOk:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const endDate=addCalendarDays(today,-1);
  const startDate=addCalendarDays(endDate,-29);
  const recentStart=addCalendarDays(endDate,-13);
  const priorEnd=addCalendarDays(recentStart,-1);
  const priorStart=addCalendarDays(priorEnd,-13);
  const inRange=(value:any,start=startDate,end=endDate)=>{
    const d=ontarioDateKey(value);return !!d&&d>=start&&d<=end;
  };
  const normalizeCrew=(id:any,name:any)=>String(id||name||'unassigned');
  const jobKey=(jobId:any,jobCode:any)=>String(jobId||jobCode||'unlinked');
  const workUnitKey=(jobId:any,jobCode:any,date:any,crewId:any,crewName:any)=>[jobKey(jobId,jobCode),String(date||''),normalizeCrew(crewId,crewName)].join('|');
  const completionLike=(r:any)=>/(complete|completed|done|closed|finished)/i.test(String(r?.completion_state||r?.production_state||r?.session_status||''));
  const cancelled=(r:any)=>/(cancel|supersed)/i.test(String(r?.schedule_status||r?.status||''));
  const lateCoded=(r:any)=>/(late|missed|untimely)/i.test([r?.open_review_codes,r?.exception_status,r?.payroll_readiness_status].filter(Boolean).join(' '));

  const dispatchRows=(input.dispatch||[]).filter((r)=>inRange(r?.scheduled_start)&&!cancelled(r)&&r?.job_id);
  const productionRows=(input.production||[]).filter((r)=>inRange(r?.session_date||r?.started_at)&&r?.job_id&&(completionLike(r)||Number(r?.duration_minutes||0)>0||Number(r?.total_labour_hours||0)>0));
  const timeRows=(input.timekeeping||[]).filter((r)=>inRange(r?.signed_in_at||r?.signed_out_at||r?.updated_at)&&r?.job_id);

  const units=new Map<string,any>();
  const ensureUnit=(source:any,date:any,crewId:any,crewName:any,jobId:any,jobCode:any,jobName:any)=>{
    const key=workUnitKey(jobId,jobCode,date,crewId,crewName);
    const current=units.get(key)||{
      key,service_date:date,crew_id:crewId||null,crew_name:crewName||'Unassigned / not recorded',
      job_id:jobId||null,job_code:jobCode||null,job_name:jobName||null,
      dispatch_count:0,production_session_count:0,production_labour_hours:0,production_duration_minutes:0
    };
    units.set(key,current);return current;
  };
  for(const r of dispatchRows){
    const date=ontarioDateKey(r?.scheduled_start);
    if(!date)continue;
    const u=ensureUnit(r,date,r?.crew_id,r?.crew_name,r?.job_id,r?.job_code,r?.job_name);
    u.dispatch_count++;
  }
  for(const r of productionRows){
    const date=ontarioDateKey(r?.session_date||r?.started_at);
    if(!date)continue;
    const dispatch=dispatchRows.find((d)=>String(d?.id||'')===String(r?.dispatch_schedule_item_id||''))||null;
    const u=ensureUnit(r,date,dispatch?.crew_id,dispatch?.crew_name,r?.job_id,dispatch?.job_code||null,dispatch?.job_name||null);
    u.production_session_count++;
    u.production_labour_hours+=Math.max(0,Number(r?.total_labour_hours||0));
    u.production_duration_minutes+=Math.max(0,Number(r?.duration_minutes||0));
  }

  const rows=[...units.values()].map((u)=>{
    const matching=timeRows.filter((r)=>{
      const date=ontarioDateKey(r?.signed_in_at||r?.signed_out_at||r?.updated_at);
      if(date!==u.service_date||String(r?.job_id||'')!==String(u.job_id||''))return false;
      if(u.crew_id&&r?.crew_id&&String(r.crew_id)!==String(u.crew_id))return false;
      return true;
    });
    const signedOut=matching.filter((r)=>!!r?.signed_out_at).length;
    const ready=matching.filter((r)=>r?.payroll_ready===true||String(r?.payroll_readiness_status||'').toLowerCase()==='ready').length;
    const openShift=matching.filter((r)=>String(r?.payroll_readiness_status||'').toLowerCase()==='open_shift'||!r?.signed_out_at).length;
    const correctionPending=matching.filter((r)=>String(r?.payroll_readiness_status||'').toLowerCase()==='correction_pending'||Number(r?.pending_correction_count||0)>0).length;
    const attendanceReview=matching.filter((r)=>String(r?.payroll_readiness_status||'').toLowerCase()==='attendance_review'||Number(r?.open_review_count||0)>0).length;
    const supervisorApproval=matching.filter((r)=>String(r?.payroll_readiness_status||'').toLowerCase()==='supervisor_approval').length;
    const lateExplicit=matching.filter(lateCoded).length;
    const paidMinutes=matching.reduce((sum,r)=>sum+Math.max(0,Number(r?.paid_minutes||0)),0);
    const jobWorkMinutes=matching.reduce((sum,r)=>sum+Math.max(0,Number(r?.job_work_minutes||0)),0);
    const openReviewCount=matching.reduce((sum,r)=>sum+Math.max(0,Number(r?.open_review_count||0)),0);
    const pendingCorrectionCount=matching.reduce((sum,r)=>sum+Math.max(0,Number(r?.pending_correction_count||0)),0);
    const statuses=[...new Set(matching.map((r)=>String(r?.payroll_readiness_status||'').trim()).filter(Boolean))].sort();
    const reviewCodes=[...new Set(matching.flatMap((r)=>String(r?.open_review_codes||'').split(',').map((x)=>x.trim()).filter(Boolean)))].sort();

    let captureState='payroll_ready';
    if(matching.length===0)captureState='missing_time_capture';
    else if(ready<matching.length){
      if(openShift>0)captureState='open_shift';
      else if(correctionPending>0)captureState='correction_pending';
      else if(attendanceReview>0)captureState='attendance_review';
      else if(supervisorApproval>0)captureState='supervisor_approval';
      else captureState='other_unready';
    }
    return {
      service_date:u.service_date,crew_id:u.crew_id,crew_name:u.crew_name,job_id:u.job_id,job_code:u.job_code,job_name:u.job_name,
      dispatch_count:u.dispatch_count,production_session_count:u.production_session_count,
      production_labour_hours:Number(Number(u.production_labour_hours||0).toFixed(2)),
      production_duration_minutes:Number(u.production_duration_minutes||0),
      time_entry_count:matching.length,signed_out_time_entry_count:signedOut,payroll_ready_time_entry_count:ready,
      paid_hours:Number((paidMinutes/60).toFixed(2)),job_work_hours:Number((jobWorkMinutes/60).toFixed(2)),
      open_review_count:openReviewCount,pending_correction_count:pendingCorrectionCount,
      explicit_late_exception_count:lateExplicit,payroll_readiness_statuses:statuses,open_review_codes:reviewCodes,
      capture_state:captureState,capture_complete:matching.length>0&&ready===matching.length
    };
  }).sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date))||String(a.crew_name).localeCompare(String(b.crew_name))||String(a.job_code||'').localeCompare(String(b.job_code||'')));

  const issueRows=rows.filter((r)=>!r.capture_complete);
  const summarizeWindow=(start:string,end:string)=>{
    const windowRows=rows.filter((r)=>r.service_date>=start&&r.service_date<=end);
    const issue=windowRows.filter((r)=>!r.capture_complete);
    return {
      start_date:start,end_date:end,work_units:windowRows.length,complete_work_units:windowRows.length-issue.length,
      exception_work_units:issue.length,
      completion_rate_percent:windowRows.length?Number((((windowRows.length-issue.length)/windowRows.length)*100).toFixed(1)):null,
      exception_rate_percent:windowRows.length?Number(((issue.length/windowRows.length)*100).toFixed(1)):null
    };
  };
  const recent=summarizeWindow(recentStart,endDate),prior=summarizeWindow(priorStart,priorEnd);
  const exceptionRateChangePp=recent.exception_rate_percent!==null&&prior.exception_rate_percent!==null
    ?Number((recent.exception_rate_percent-prior.exception_rate_percent).toFixed(1)):null;

  const patternMap=new Map<string,any>();
  for(const r of issueRows){
    const patternKey=[normalizeCrew(r.crew_id,r.crew_name),jobKey(r.job_id,r.job_code),r.capture_state].join('|');
    const p=patternMap.get(patternKey)||{
      crew_id:r.crew_id,crew_name:r.crew_name,job_id:r.job_id,job_code:r.job_code,job_name:r.job_name,
      capture_state:r.capture_state,occurrence_count:0,first_service_date:r.service_date,last_service_date:r.service_date,
      open_review_count:0,pending_correction_count:0,explicit_late_exception_count:0
    };
    p.occurrence_count++;
    if(r.service_date<p.first_service_date)p.first_service_date=r.service_date;
    if(r.service_date>p.last_service_date)p.last_service_date=r.service_date;
    p.open_review_count+=Number(r.open_review_count||0);
    p.pending_correction_count+=Number(r.pending_correction_count||0);
    p.explicit_late_exception_count+=Number(r.explicit_late_exception_count||0);
    patternMap.set(patternKey,p);
  }
  const repeatedPatterns=[...patternMap.values()].filter((p)=>p.occurrence_count>=2)
    .sort((a,b)=>b.occurrence_count-a.occurrence_count||String(a.crew_name).localeCompare(String(b.crew_name))||String(a.job_code||'').localeCompare(String(b.job_code||'')));

  const stateCounts=(name:string)=>rows.filter((r)=>r.capture_state===name).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',lookback_days:30,lookback_start:startDate,lookback_end:endDate,
    source_queries_ok:input.sourceQueriesOk!==false,jobs_visible:input.jobsVisible,admin_visible:input.adminVisible,
    summary:{
      work_units:rows.length,complete_payroll_evidence_work_units:rows.filter((r)=>r.capture_complete).length,
      payroll_evidence_completion_rate_percent:rows.length?Number(((rows.filter((r)=>r.capture_complete).length/rows.length)*100).toFixed(1)):null,
      missing_time_capture_work_units:stateCounts('missing_time_capture'),
      open_shift_work_units:stateCounts('open_shift'),
      correction_pending_work_units:stateCounts('correction_pending'),
      attendance_review_work_units:stateCounts('attendance_review'),
      supervisor_approval_work_units:stateCounts('supervisor_approval'),
      other_unready_work_units:stateCounts('other_unready'),
      explicit_late_exception_work_units:rows.filter((r)=>r.explicit_late_exception_count>0).length,
      repeated_pattern_count:repeatedPatterns.length,
      recent_exception_rate_percent:recent.exception_rate_percent,prior_exception_rate_percent:prior.exception_rate_percent,
      exception_rate_change_percentage_points:exceptionRateChangePp
    },
    recent_period:recent,prior_period:prior,
    exception_reduction_state:exceptionRateChangePp===null?'not_comparable':exceptionRateChangePp<0?'recorded_exception_rate_lower':exceptionRateChangePp>0?'recorded_exception_rate_higher':'recorded_exception_rate_unchanged',
    repeated_patterns:repeatedPatterns.slice(0,80),
    work_unit_evidence:rows.slice(0,300),
    matching_boundary:'Coverage is evaluated at recorded job/service-date and crew context where available. A scheduled or Production work unit is complete only when matching time entries exist and every matched entry is payroll-ready.',
    late_boundary:'Late capture is counted only when the canonical payroll evidence explicitly carries a late, missed or untimely exception/review code. No arbitrary lateness threshold is invented.',
    reduction_boundary:'Exception reduction compares the most recent 14 completed calendar days with the preceding 14 completed calendar days. It describes recorded exception-rate movement only and is not an employee-performance target.',
    privacy_boundary:'Returned evidence is aggregated to crew/job/service-date. Individual employee names, employee numbers, explanations, supervisor notes and approver identities are not returned.',
    safety_boundary:'Safety restrictions and fitness-for-work decisions remain under existing Safety authority and are not inferred from attendance, payroll readiness or missing time evidence.',
    authority_boundary:'Read-only management evidence. This layer cannot edit time entries, approve payroll, approve corrections, change pay codes, rank employees, make employment decisions or override Safety restrictions.'
  };
}

function buildMaterialsConsumablesSeasonalStockReadiness(input:{
  materials:any[];materialPlans:any[];dispatch:any[];recurringVisits:any[];seasonalWork:any[];
  jobsVisible:boolean;sourceQueriesOk:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const horizon7=addCalendarDays(today,7);
  const horizon14=addCalendarDays(today,14);
  const norm=(v:any)=>String(v??'').trim().toLowerCase().replace(/\s+/g,'_');
  const activeDispatch=(input.dispatch||[]).filter((r)=>{
    const d=ontarioDateKey(r?.scheduled_start||r?.service_date);
    return !!d&&d>=today&&d<=horizon14&&!['cancelled','superseded','completed'].includes(norm(r?.schedule_status||r?.status));
  });
  const dispatchByWorkOrder=new Map<string,any[]>();
  const dispatchByRecurringKey=new Map<string,any>();
  for(const row of activeDispatch){
    const wid=String(row?.work_order_id||'');
    if(wid){const list=dispatchByWorkOrder.get(wid)||[];list.push(row);dispatchByWorkOrder.set(wid,list);}
    const rk=String(row?.recurring_visit_key||'');
    if(rk&&!dispatchByRecurringKey.has(rk)) dispatchByRecurringKey.set(rk,row);
  }
  for(const list of dispatchByWorkOrder.values()) list.sort((a,b)=>String(a?.scheduled_start||'').localeCompare(String(b?.scheduled_start||'')));

  const activePlans=(input.materialPlans||[]).filter((r)=>norm(r?.plan_status)==='planned'&&Number(r?.planned_quantity||0)>0);
  const plansByWorkOrder=new Map<string,any[]>();
  for(const row of activePlans){
    const wid=String(row?.work_order_id||'');
    if(wid){const list=plansByWorkOrder.get(wid)||[];list.push(row);plansByWorkOrder.set(wid,list);}
  }

  const demandEvents:any[]=[];
  const unscheduledPlanLines:any[]=[];
  const uncataloguedPlanLines:any[]=[];
  for(const row of activePlans){
    const wid=String(row?.work_order_id||'');
    const scheduled=(wid?(dispatchByWorkOrder.get(wid)||[]):[])[0]||null;
    if(!scheduled){
      unscheduledPlanLines.push({
        estimator_code:row?.estimator_code||null,work_order_id:row?.work_order_id||null,
        material_id:row?.material_id||null,material_label:row?.material_label||row?.catalog_material_name||null,
        planned_quantity:Number(row?.planned_quantity||0),planned_unit:row?.planned_unit||null,
        service_context:row?.service_context||null,season_context:row?.season_context||null
      });
      continue;
    }
    if(!row?.material_id){
      uncataloguedPlanLines.push({
        estimator_code:row?.estimator_code||null,work_order_id:row?.work_order_id||null,
        scheduled_date:ontarioDateKey(scheduled?.scheduled_start),material_label:row?.material_label||null,
        planned_quantity:Number(row?.planned_quantity||0),planned_unit:row?.planned_unit||null,
        service_context:row?.service_context||null,season_context:row?.season_context||null
      });
      continue;
    }
    demandEvents.push({
      material_id:String(row.material_id),scheduled_date:ontarioDateKey(scheduled?.scheduled_start),
      planned_quantity:Number(row?.planned_quantity||0),planned_unit:row?.planned_unit||null,
      estimator_code:row?.estimator_code||null,work_order_id:row?.work_order_id||null,
      work_order_number:scheduled?.work_order_number||null,recurring_visit_key:scheduled?.recurring_visit_key||null,
      service_context:row?.service_context||null,season_context:row?.season_context||null
    });
  }

  const eventsByMaterial=new Map<string,any[]>();
  for(const e of demandEvents){
    const list=eventsByMaterial.get(e.material_id)||[];list.push(e);eventsByMaterial.set(e.material_id,list);
  }
  for(const list of eventsByMaterial.values()) list.sort((a,b)=>String(a.scheduled_date||'').localeCompare(String(b.scheduled_date||'')));

  const seasonalBucket=(row:any)=>{
    const text=norm([row?.material_category,row?.sku,row?.item_name].filter(Boolean).join(' '));
    if(/salt|de_?icer|de-?icer|ice_?melt|traction|winter|road_?sand/.test(text)) return 'winter';
    if(/leaf|yard_?waste|bag|fall|disposal/.test(text)) return 'fall';
    if(/mulch|soil|sod|seed|fertiliz|grass|lawn|landscap|plant|stone|gravel|compost/.test(text)) return 'spring_summer';
    return 'four_season';
  };

  const stockReadiness=(input.materials||[]).filter((m)=>m?.is_active!==false).map((m)=>{
    const id=String(m?.id||'');
    const unit=norm(m?.unit_code);
    const events=eventsByMaterial.get(id)||[];
    const comparable=events.filter((e)=>unit&&norm(e?.planned_unit)===unit);
    const mismatched=events.filter((e)=>!unit||norm(e?.planned_unit)!==unit);
    const demand7=comparable.filter((e)=>e.scheduled_date&&e.scheduled_date<=horizon7).reduce((s,e)=>s+Math.max(0,Number(e.planned_quantity||0)),0);
    const demand14=comparable.reduce((s,e)=>s+Math.max(0,Number(e.planned_quantity||0)),0);
    const stock=Number(m?.stock_on_hand||0);
    const tracked=m?.inventory_tracked!==false;
    let running=0,shortageDate:string|null=null;
    if(tracked){
      for(const e of comparable){running+=Math.max(0,Number(e.planned_quantity||0));if(running>stock){shortageDate=e.scheduled_date||null;break;}}
    }
    const projectionComplete=mismatched.length===0;
    const projected7=tracked&&projectionComplete?Number((stock-demand7).toFixed(2)):null;
    const projected14=tracked&&projectionComplete?Number((stock-demand14).toFixed(2)):null;
    const definiteShortage7=tracked&&demand7>stock;
    const definiteShortage14=tracked&&demand14>stock;
    const reorderPoint=m?.reorder_point==null?null:Number(m.reorder_point);
    const projectedReorder=tracked&&projectionComplete&&reorderPoint!=null&&projected14!=null&&projected14<=reorderPoint;
    const risk=definiteShortage7?'shortage_within_7_days':
      definiteShortage14?'shortage_within_14_days':
      mismatched.length?'unit_comparison_required':
      (m?.reorder_required===true||projectedReorder)?'reorder_risk':
      norm(m?.stock_status)==='below_target'?'below_target':'ready';
    return {
      material_id:m?.id||null,sku:m?.sku||null,item_name:m?.item_name||null,material_category:m?.material_category||null,
      stock_unit:m?.unit_code||null,stock_on_hand:tracked?stock:null,inventory_tracked:tracked,
      reorder_point:m?.reorder_point??null,reorder_quantity:m?.reorder_quantity??null,target_stock_quantity:m?.target_stock_quantity??null,
      stock_status:m?.stock_status||null,preferred_vendor_name:m?.preferred_vendor_name||m?.last_vendor_name||null,storage_location:m?.storage_location||null,
      seasonal_bucket:seasonalBucket(m),planned_demand_7:tracked?Number(demand7.toFixed(2)):null,planned_demand_14:tracked?Number(demand14.toFixed(2)):null,
      projected_on_hand_7:projected7,projected_on_hand_14:projected14,projection_complete:projectionComplete,
      unit_mismatch_event_count:mismatched.length,comparable_demand_event_count:comparable.length,shortage_date:shortageDate,
      readiness_state:risk,reorder_review:m?.reorder_required===true||projectedReorder,
      recorded_reorder_quantity:m?.reorder_quantity??null
    };
  }).sort((a,b)=>{
    const order:Record<string,number>={shortage_within_7_days:10,shortage_within_14_days:20,unit_comparison_required:30,reorder_risk:40,below_target:50,ready:90};
    return (order[a.readiness_state]||99)-(order[b.readiness_state]||99)||String(a.sku||a.item_name||'').localeCompare(String(b.sku||b.item_name||''));
  });

  const upcomingVisits=(input.recurringVisits||[]).filter((v)=>{
    const d=ontarioDateKey(v?.service_date);
    return !!d&&d>=today&&d<=horizon14&&!['skipped','cancelled','held'].includes(norm(v?.visit_status));
  });
  const recurringCoverage=upcomingVisits.map((v)=>{
    const dispatch=dispatchByRecurringKey.get(String(v?.occurrence_key||''))||null;
    const wid=String(dispatch?.work_order_id||'');
    const quantified=!!wid&&(plansByWorkOrder.get(wid)||[]).some((p)=>!!p?.material_id&&Number(p?.planned_quantity||0)>0);
    return {
      occurrence_key:v?.occurrence_key||null,agreement_code:v?.agreement_code||null,service_name:v?.service_name||null,
      service_program_type:v?.service_program_type||null,service_date:v?.service_date||null,
      dispatch_work_order_id:dispatch?.work_order_id||null,work_order_number:dispatch?.work_order_number||null,
      material_plan_coverage:quantified?'quantified':'unquantified'
    };
  });

  const materialReadinessTasks=(input.seasonalWork||[]).filter((r)=>{
    const type=norm(r?.readiness_type||r?.work_type||r?.category||r?.item_type);
    const text=norm([type,r?.title,r?.readiness_title,r?.description].filter(Boolean).join(' '));
    return type==='material'||type==='materials'||/material|consumable|salt|de_?icer|traction|bag/.test(text);
  }).slice(0,100);

  const bySeason=['spring_summer','fall','winter','four_season'].map((season)=>{
    const rows=stockReadiness.filter((r)=>r.seasonal_bucket===season);
    return {
      season,material_count:rows.length,attention_count:rows.filter((r)=>r.readiness_state!=='ready').length,
      shortage_count:rows.filter((r)=>String(r.readiness_state).startsWith('shortage_')).length,
      reorder_review_count:rows.filter((r)=>r.reorder_review).length,
      unit_comparison_required_count:rows.filter((r)=>r.readiness_state==='unit_comparison_required').length
    };
  });

  const attentionQueue=stockReadiness.filter((r)=>r.readiness_state!=='ready').map((r)=>({
    signal_type:r.readiness_state,material_id:r.material_id,sku:r.sku,item_name:r.item_name,seasonal_bucket:r.seasonal_bucket,
    stock_on_hand:r.stock_on_hand,stock_unit:r.stock_unit,planned_demand_7:r.planned_demand_7,planned_demand_14:r.planned_demand_14,
    projected_on_hand_14:r.projected_on_hand_14,shortage_date:r.shortage_date,recorded_reorder_quantity:r.recorded_reorder_quantity,
    preferred_vendor_name:r.preferred_vendor_name,
    detail:r.readiness_state==='unit_comparison_required'
      ? 'One or more scheduled material plans use a unit that does not match the catalog stock unit; projected stock is withheld.'
      : r.shortage_date
        ? 'Recorded planned demand exceeds current on-hand stock by '+r.shortage_date+'.'
        : r.reorder_review
          ? 'Current or projected on-hand evidence reaches the recorded reorder point.'
          : 'Current stock is below the recorded target stock quantity.',
    suggested_next_action:'Review the canonical Materials Control stock, planned work and recorded reorder settings before purchasing.',
    navigation_target:'jobs'
  }));

  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',forecast_start:today,forecast_end:horizon14,source_queries_ok:input.sourceQueriesOk,
    summary:{
      active_material_count:stockReadiness.length,tracked_material_count:stockReadiness.filter((r)=>r.inventory_tracked).length,
      materials_with_quantified_14_day_demand:stockReadiness.filter((r)=>Number(r.comparable_demand_event_count||0)>0).length,
      shortage_within_7_days:stockReadiness.filter((r)=>r.readiness_state==='shortage_within_7_days').length,
      shortage_within_14_days:stockReadiness.filter((r)=>r.readiness_state==='shortage_within_14_days').length,
      reorder_review_count:stockReadiness.filter((r)=>r.reorder_review).length,
      unit_comparison_required_count:stockReadiness.filter((r)=>r.readiness_state==='unit_comparison_required').length,
      unscheduled_material_plan_line_count:unscheduledPlanLines.length,
      uncatalogued_scheduled_plan_line_count:uncataloguedPlanLines.length,
      recurring_visit_count_14_days:recurringCoverage.length,
      recurring_visits_with_quantified_material_plan:recurringCoverage.filter((r)=>r.material_plan_coverage==='quantified').length,
      recurring_visits_without_quantified_material_plan:recurringCoverage.filter((r)=>r.material_plan_coverage==='unquantified').length,
      seasonal_material_readiness_task_count:materialReadinessTasks.length
    },
    stock_readiness:stockReadiness.slice(0,250),
    seasonal_summary:bySeason,
    attention_queue:attentionQueue.slice(0,150),
    recurring_demand_coverage:recurringCoverage.slice(0,250),
    unscheduled_material_plan_lines:unscheduledPlanLines.slice(0,100),
    uncatalogued_scheduled_plan_lines:uncataloguedPlanLines.slice(0,100),
    seasonal_material_readiness_tasks:materialReadinessTasks,
    demand_boundary:'Quantified demand comes only from planned Landscape Material Estimator lines whose work order has an active dispatch inside the 14-day window. The same plan is scheduled once at its earliest active dispatch and is not multiplied across repeated dispatch rows.',
    recurring_boundary:'Upcoming recurring visits are checked for a linked dispatch/work order with a quantified material plan. Visits without that chain are shown as unquantified demand coverage; no per-visit material amount is invented.',
    unit_boundary:'Projected on-hand and shortage timing are calculated only when the planned material unit exactly matches the canonical catalog stock unit after simple text normalization. No hidden unit conversion is performed.',
    seasonal_boundary:'Stock context distinguishes spring/summer landscaping and lawn materials, fall cleanup supplies, winter salt/de-icer/traction materials, and general four-season stock using recorded catalog names/categories. Classification is advisory and does not rewrite catalog data.',
    purchasing_boundary:'Reorder signals reuse current stock, planned demand and recorded reorder/target settings. They do not create purchase orders, contact suppliers, reserve stock, or create vendor commitments.',
    authority_boundary:'Read-only management evidence. Materials catalog, receipts, issues, adjustments, Landscape Material Estimator plans, recurring service and dispatch remain their existing authorities.'
  };
}



function buildMaterialUsageVarianceReorderCalibration(input:{
  materialPlans:any[];actualUse:any[];materials:any[];jobsVisible:boolean;sourceQueriesOk:boolean;
}) {
  const norm=(v:any)=>String(v??'').trim().toLowerCase().replace(/\s+/g,'_');
  const round4=(v:number)=>Math.round(v*10000)/10000;
  const numberOrNull=(v:any)=>{
    if(v===null||v===undefined||v==='')return null;
    const n=Number(v);return Number.isFinite(n)?n:null;
  };
  const materialsById=new Map<string,any>();
  for(const row of input.materials||[])if(row?.id)materialsById.set(String(row.id),row);

  const actualByLine=new Map<string,any[]>();
  for(const event of input.actualUse||[]){
    const lineId=String(event?.material_estimate_line_id||'');if(!lineId)continue;
    const list=actualByLine.get(lineId)||[];list.push(event);actualByLine.set(lineId,list);
  }

  const lineEvidence=(input.materialPlans||[]).filter((row)=>Number(row?.planned_quantity||0)>0).map((row)=>{
    const lineId=String(row?.id||'');
    const events=actualByLine.get(lineId)||[];
    const plannedQuantity=Number(row?.planned_quantity||0);
    const plannedUnit=norm(row?.planned_unit);
    const compatible:any[]=[];
    const mismatched:any[]=[];
    for(const event of events){
      const actualUnit=norm(event?.actual_unit);
      const factor=numberOrNull(event?.conversion_factor_to_planned);
      const exactUnit=!!plannedUnit&&!!actualUnit&&plannedUnit===actualUnit;
      const explicitConversion=!!plannedUnit&&!!actualUnit&&plannedUnit!==actualUnit&&factor!==null&&factor>0&&Math.abs(factor-1)>0.000000001;
      (exactUnit||explicitConversion?compatible:mismatched).push(event);
    }
    const comparisonComplete=events.length>0&&mismatched.length===0&&compatible.length===events.length;
    const actualPlannedUnit=comparisonComplete
      ?round4(compatible.reduce((sum,event)=>sum+Number(event?.actual_quantity_planned_unit??event?.actual_quantity??0),0))
      :null;
    const varianceQuantity=comparisonComplete&&actualPlannedUnit!==null?round4(actualPlannedUnit-plannedQuantity):null;
    const variancePercent=varianceQuantity===null||plannedQuantity<=0?null:round4((varianceQuantity/plannedQuantity)*100);
    const varianceDirection=varianceQuantity===null?'not_comparable':varianceQuantity>0?'over_use':varianceQuantity<0?'under_use':'on_plan';
    const materialId=String(row?.material_id||'');
    const material=materialId?materialsById.get(materialId)||null:null;
    const tracked=material?.inventory_tracked!==false;
    const stockOnHand=tracked?numberOrNull(material?.stock_on_hand):null;
    const reorderPoint=numberOrNull(material?.reorder_point);
    const stockoutEvidence=tracked&&stockOnHand!==null&&stockOnHand<=0;
    const reorderEvidence=tracked&&(
      material?.reorder_required===true||
      norm(material?.stock_status)==='reorder'||
      (stockOnHand!==null&&reorderPoint!==null&&stockOnHand<=reorderPoint)
    );
    return {
      material_estimate_line_id:row?.id||null,material_estimate_id:row?.material_estimate_id||row?.estimate_id||null,
      estimator_code:row?.estimator_code||null,work_order_id:row?.work_order_id||null,
      material_id:row?.material_id||null,material_sku:row?.material_sku||material?.sku||null,
      material_label:row?.material_label||row?.catalog_material_name||material?.item_name||null,
      material_category:row?.material_category||material?.material_category||null,
      service_context:row?.service_context||'unspecified',season_context:row?.season_context||'four_season',
      planned_quantity:plannedQuantity,planned_unit:row?.planned_unit||null,
      recorded_actual_event_count:events.length,compatible_actual_event_count:compatible.length,
      unit_mismatch_event_count:mismatched.length,comparison_complete:comparisonComplete,
      actual_quantity_planned_unit:actualPlannedUnit,variance_quantity:varianceQuantity,
      variance_percent:variancePercent,variance_direction:varianceDirection,
      issue_linked_event_count:events.filter((event)=>!!event?.material_issue_id).length,
      production_actual_event_count:events.filter((event)=>!event?.material_issue_id).length,
      stock_on_hand:stockOnHand,stock_unit:material?.unit_code||null,reorder_point:material?.reorder_point??null,
      reorder_quantity:material?.reorder_quantity??null,target_stock_quantity:material?.target_stock_quantity??null,
      stock_status:material?.stock_status||null,stockout_evidence:stockoutEvidence,reorder_evidence:reorderEvidence
    };
  });

  const withActual=lineEvidence.filter((row)=>row.recorded_actual_event_count>0);
  const comparable=withActual.filter((row)=>row.comparison_complete);
  const patterns=new Map<string,any>();
  for(const row of comparable){
    const materialKey=String(row.material_id||row.material_label||'uncatalogued');
    const key=[norm(row.service_context),norm(row.season_context),materialKey].join('|');
    let group=patterns.get(key);
    if(!group){
      group={
        service_context:row.service_context,season_context:row.season_context,material_id:row.material_id,
        material_sku:row.material_sku,material_label:row.material_label,material_category:row.material_category,
        compared_line_count:0,planned_quantity_total:0,actual_quantity_total:0,
        over_use_line_count:0,under_use_line_count:0,on_plan_line_count:0,
        issue_linked_event_count:0,production_actual_event_count:0,
        stock_on_hand:row.stock_on_hand,stock_unit:row.stock_unit,reorder_point:row.reorder_point,
        reorder_quantity:row.reorder_quantity,target_stock_quantity:row.target_stock_quantity,
        stock_status:row.stock_status,stockout_evidence:row.stockout_evidence,reorder_evidence:row.reorder_evidence
      };
      patterns.set(key,group);
    }
    group.compared_line_count+=1;
    group.planned_quantity_total+=Number(row.planned_quantity||0);
    group.actual_quantity_total+=Number(row.actual_quantity_planned_unit||0);
    group.issue_linked_event_count+=Number(row.issue_linked_event_count||0);
    group.production_actual_event_count+=Number(row.production_actual_event_count||0);
    if(row.variance_direction==='over_use')group.over_use_line_count+=1;
    else if(row.variance_direction==='under_use')group.under_use_line_count+=1;
    else group.on_plan_line_count+=1;
  }

  const calibrationPatterns=[...patterns.values()].map((group)=>{
    group.planned_quantity_total=round4(group.planned_quantity_total);
    group.actual_quantity_total=round4(group.actual_quantity_total);
    group.variance_quantity_total=round4(group.actual_quantity_total-group.planned_quantity_total);
    group.variance_percent=group.planned_quantity_total>0?round4((group.variance_quantity_total/group.planned_quantity_total)*100):null;
    group.repeated_over_use=group.over_use_line_count>=2;
    group.repeated_under_use=group.under_use_line_count>=2;
    group.review_state=group.repeated_over_use&&(group.stockout_evidence||group.reorder_evidence)?'repeated_over_use_with_stock_pressure':
      group.repeated_under_use&&group.reorder_evidence?'repeated_under_use_with_reorder_review':
      group.repeated_over_use?'repeated_over_use':
      group.repeated_under_use?'repeated_under_use':
      group.stockout_evidence?'stockout_evidence':
      group.reorder_evidence?'reorder_review':'recorded_variance';
    group.suggested_next_action='Review the recorded estimator assumptions, actual-use evidence and current Materials Control reorder/target settings. No setting is changed by this evidence layer.';
    return group;
  }).sort((a,b)=>{
    const rank:Record<string,number>={repeated_over_use_with_stock_pressure:10,repeated_under_use_with_reorder_review:20,repeated_over_use:30,repeated_under_use:40,stockout_evidence:50,reorder_review:60,recorded_variance:90};
    return (rank[a.review_state]||99)-(rank[b.review_state]||99)||String(a.material_sku||a.material_label||'').localeCompare(String(b.material_sku||b.material_label||''));
  });

  const serviceSeason=new Map<string,any>();
  for(const row of withActual){
    const key=[norm(row.service_context),norm(row.season_context)].join('|');
    let group=serviceSeason.get(key);
    if(!group){
      group={service_context:row.service_context,season_context:row.season_context,lines_with_actual_evidence:0,comparable_lines:0,unit_mismatch_lines:0,over_use_lines:0,under_use_lines:0,on_plan_lines:0};
      serviceSeason.set(key,group);
    }
    group.lines_with_actual_evidence+=1;
    if(!row.comparison_complete)group.unit_mismatch_lines+=1;
    else{
      group.comparable_lines+=1;
      if(row.variance_direction==='over_use')group.over_use_lines+=1;
      else if(row.variance_direction==='under_use')group.under_use_lines+=1;
      else group.on_plan_lines+=1;
    }
  }

  const uniqueMaterialCount=(predicate:(row:any)=>boolean)=>new Set(withActual.filter(predicate).map((row)=>String(row.material_id||row.material_label||''))).size;
  return {
    generated_at:new Date().toISOString(),source_queries_ok:input.sourceQueriesOk,jobs_visible:input.jobsVisible,
    summary:{
      planned_lines_with_actual_evidence:withActual.length,comparable_lines:comparable.length,
      unit_mismatch_lines:withActual.filter((row)=>!row.comparison_complete).length,
      over_use_lines:comparable.filter((row)=>row.variance_direction==='over_use').length,
      under_use_lines:comparable.filter((row)=>row.variance_direction==='under_use').length,
      on_plan_lines:comparable.filter((row)=>row.variance_direction==='on_plan').length,
      repeated_over_use_patterns:calibrationPatterns.filter((row)=>row.repeated_over_use).length,
      repeated_under_use_patterns:calibrationPatterns.filter((row)=>row.repeated_under_use).length,
      stockout_materials:uniqueMaterialCount((row)=>row.stockout_evidence),
      reorder_review_materials:uniqueMaterialCount((row)=>row.reorder_evidence),
      issue_linked_actual_events:withActual.reduce((sum,row)=>sum+Number(row.issue_linked_event_count||0),0),
      production_actual_events:withActual.reduce((sum,row)=>sum+Number(row.production_actual_event_count||0),0)
    },
    service_season_summary:[...serviceSeason.values()].sort((a,b)=>String(a.season_context||'').localeCompare(String(b.season_context||''))||String(a.service_context||'').localeCompare(String(b.service_context||''))),
    calibration_attention:calibrationPatterns.filter((row)=>row.review_state!=='recorded_variance').slice(0,100),
    pattern_evidence:calibrationPatterns.slice(0,150),
    line_variance_evidence:withActual.slice(0,200),
    comparison_boundary:'Planned quantity comes from canonical Landscape Material Estimator lines. Actual use comes only from recorded actual-use events; variance is calculated only when every recorded event on the line uses the planned unit or carries a non-default explicit conversion factor to the planned unit. Any unresolved unit mismatch withholds that line variance.',
    repeat_boundary:'Repeated over-use or under-use means at least two comparable estimator lines for the same material, service context and season with the same variance direction. No hidden percentage threshold or target usage rate is invented.',
    stock_boundary:'Stockout and reorder evidence reuses current canonical Materials Control stock_on_hand, reorder_required, reorder_point, reorder_quantity and target_stock_quantity. Missing settings stay missing and no replacement reorder value is calculated.',
    source_boundary:'Issue-linked actual-use events are counted separately from production actual-use events that have no material_issue_id so recorded inventory issues and production consumption evidence remain distinguishable.',
    authority_boundary:'Read-only calibration evidence. This layer cannot edit estimator assumptions, actual-use events, inventory quantities, reorder points, reorder quantities or target stock; it cannot create purchase orders, contact suppliers, reserve stock or create vendor commitments.'
  };
}

function buildCustomerCommunicationReadinessQueue(input:{
  workability:any[];dispatch:any[];recurringVisits:any[];closeouts:any[];crmFollowups:any[];crmInteractions:any[];
  customerDirectory:any[];notificationQueue:any[];receivables:any[];jobsVisible:boolean;financeVisible:boolean;sourceQueriesOk:boolean;
}) {
  const today=ontarioDateKey(new Date())!;
  const horizon14=addCalendarDays(today,14);
  const norm=(v:any)=>String(v??'').trim().toLowerCase();
  const customerById=new Map<string,any>();
  for(const r of input.customerDirectory||[]) if(r?.client_id) customerById.set(String(r.client_id),r);
  const dispatchById=new Map<string,any>();
  const dispatchByRecurringKey=new Map<string,any>();
  for(const r of input.dispatch||[]){
    if(r?.id) dispatchById.set(String(r.id),r);
    if(r?.recurring_visit_key&&!['cancelled','superseded','completed'].includes(norm(r?.schedule_status))){
      const key=String(r.recurring_visit_key),old=dispatchByRecurringKey.get(key);
      if(!old||String(r?.scheduled_start||'')>String(old?.scheduled_start||'')) dispatchByRecurringKey.set(key,r);
    }
  }
  const interactionsByWorkOrder=new Map<string,any[]>();
  for(const r of input.crmInteractions||[]){
    const id=String(r?.work_order_id||''); if(!id) continue;
    const list=interactionsByWorkOrder.get(id)||[]; list.push(r); interactionsByWorkOrder.set(id,list);
  }
  const candidates=new Map<string,any>();
  const add=(row:any)=>{
    const key=String(row.dedupe_key||''); if(!key) return;
    const existing=candidates.get(key);
    if(!existing){candidates.set(key,{...row,source_links:Array.isArray(row.source_links)?row.source_links:[]});return;}
    const links=[...(existing.source_links||[]),...(row.source_links||[])];
    const seen=new Set<string>(); existing.source_links=links.filter((x:any)=>{const k=String(x?.source_type||'')+':'+String(x?.source_id||'');if(seen.has(k))return false;seen.add(k);return true;});
    existing.signal_types=Array.from(new Set([...(existing.signal_types||[existing.signal_type]),...(row.signal_types||[row.signal_type])]));
    existing.detail=[existing.detail,row.detail].filter(Boolean).join(' · ');
    if(!existing.scheduled_at&&row.scheduled_at) existing.scheduled_at=row.scheduled_at;
    if(!existing.reason&&row.reason) existing.reason=row.reason;
    if(!existing.client_id&&row.client_id) existing.client_id=row.client_id;
    if(!existing.client_name&&row.client_name) existing.client_name=row.client_name;
    if(!existing.work_order_id&&row.work_order_id) existing.work_order_id=row.work_order_id;
    if(!existing.work_order_number&&row.work_order_number) existing.work_order_number=row.work_order_number;
  };
  const withCustomer=(row:any)=>{
    const customer=row?.client_id?customerById.get(String(row.client_id)):null;
    return {
      client_id:row?.client_id||null,client_name:row?.client_name||customer?.client_name||null,
      preferred_contact_method:customer?.crm_preferred_contact_method||null,
      preferred_contact_window:customer?.crm_preferred_contact_window||null
    };
  };

  for(const r of input.workability||[]){
    const state=norm(r?.decision_state),ready=norm(r?.latest_readiness_state||r?.customer_notification_readiness);
    if(!['postpone','reschedule','blocked'].includes(state)) continue;
    if(ready==='notified'||ready==='not_needed') continue;
    const wo=String(r?.work_order_id||'');
    const key=wo?'schedule:'+wo:'workability:'+String(r?.latest_decision_id||r?.observation_id||'');
    add({
      dedupe_key:key,signal_type:'weather_workability_change',signal_types:['weather_workability_change'],
      ...withCustomer(r),work_order_id:r?.work_order_id||null,work_order_number:r?.work_order_number||null,
      site_name:r?.site_name||null,service_context:r?.service_context||r?.work_type||null,season_context:r?.season_context||null,
      scheduled_at:r?.proposed_reschedule_start||r?.scheduled_start||null,reason:r?.decision_reason||r?.service_restriction_summary||null,
      detail:'Recorded workability decision '+state+'; customer-notification readiness is '+(ready||'not recorded')+'.',
      readiness_state:ready||'not_recorded',navigation_target:'operations',
      source_links:[{source_type:'workability_decision',source_id:r?.latest_decision_id||r?.observation_id||null,reference:r?.observation_code||r?.work_order_number||null}]
    });
  }

  for(const r of input.dispatch||[]){
    if(norm(r?.schedule_status)!=='rescheduled'&&!r?.supersedes_dispatch_id) continue;
    if(['sent','notified','complete','completed'].includes(norm(r?.customer_notification_status))) continue;
    const prior=r?.supersedes_dispatch_id?dispatchById.get(String(r.supersedes_dispatch_id)):null;
    const changed=!!prior&&String(prior?.scheduled_start||'')!==String(r?.scheduled_start||'');
    const wo=String(r?.work_order_id||''); if(!wo) continue;
    add({
      dedupe_key:'schedule:'+wo,signal_type:changed?'eta_change':'reschedule_notice',signal_types:[changed?'eta_change':'reschedule_notice'],
      ...withCustomer(r),work_order_id:r?.work_order_id||null,work_order_number:r?.work_order_number||null,
      site_name:r?.site_name||null,service_context:r?.work_type||null,season_context:null,
      scheduled_at:r?.scheduled_start||null,reason:r?.reschedule_reason||r?.schedule_reason||null,
      detail:changed
        ? 'Dispatch start changed from '+String(prior?.scheduled_start||'unknown')+' to '+String(r?.scheduled_start||'unknown')+'.'
        : 'Dispatch is recorded as rescheduled and customer notification is not recorded complete.',
      readiness_state:'review_ready',navigation_target:'jobs',
      source_links:[
        {source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null},
        ...(prior?[{source_type:'superseded_dispatch',source_id:prior.id||null,reference:prior?.work_order_number||null}]:[])
      ]
    });
  }

  for(const r of input.closeouts||[]){
    if(!['approved','invoice_ready'].includes(norm(r?.closeout_status))) continue;
    const base=r?.signed_off_at||r?.approved_at; if(!base) continue;
    const interactions=interactionsByWorkOrder.get(String(r?.work_order_id||''))||[];
    const outboundAfter=interactions.some((i)=>['outbound'].includes(norm(i?.direction))&&String(i?.occurred_at||'')>=String(base));
    if(outboundAfter) continue;
    add({
      dedupe_key:'completion:'+String(r?.work_order_id||r?.id),signal_type:'completion_followup',signal_types:['completion_followup'],
      ...withCustomer(r),work_order_id:r?.work_order_id||null,work_order_number:r?.work_order_number||null,
      service_context:'completed_work',scheduled_at:base,reason:r?.review_request_requested?'review request is recorded':'completion follow-up has no later outbound CRM interaction',
      detail:'Approved/completed closeout has no later outbound CRM interaction recorded.',
      readiness_state:'review_ready',navigation_target:'jobs',
      source_links:[{source_type:'closeout',source_id:r?.id||null,reference:r?.work_order_number||null}]
    });
  }

  for(const r of input.recurringVisits||[]){
    const d=ontarioDateKey(r?.service_date); if(!d||d<today||d>horizon14) continue;
    if(['skipped','cancelled','held'].includes(norm(r?.visit_status))) continue;
    const dispatch=dispatchByRecurringKey.get(String(r?.occurrence_key||''))||null;
    if(dispatch&&['sent','notified','complete','completed'].includes(norm(dispatch?.customer_notification_status))) continue;
    add({
      dedupe_key:'recurring:'+String(r?.occurrence_key||r?.agreement_id||d),signal_type:'recurring_service_notice',signal_types:['recurring_service_notice'],
      ...withCustomer(r),work_order_id:dispatch?.work_order_id||null,work_order_number:dispatch?.work_order_number||null,
      service_context:r?.service_name||r?.service_program_type||null,season_context:r?.season_context||null,
      scheduled_at:r?.service_date||null,reason:'upcoming recurring service visit',
      detail:'Upcoming recurring visit is in the 14-day operating window; no completed dispatch customer-notification state is recorded for this occurrence.',
      readiness_state:'review_ready',navigation_target:'jobs',
      source_links:[{source_type:'recurring_visit',source_id:r?.occurrence_key||r?.agreement_id||null,reference:r?.agreement_code||null},...(dispatch?[{source_type:'dispatch',source_id:dispatch.id||null,reference:dispatch?.work_order_number||null}]:[])]
    });
  }

  for(const r of input.crmFollowups||[]){
    if(!r?.overdue||!['pending','in_progress','deferred'].includes(norm(r?.followup_status))) continue;
    add({
      dedupe_key:'crm_followup:'+String(r?.id||''),signal_type:'overdue_customer_followup',signal_types:['overdue_customer_followup'],
      ...withCustomer(r),service_context:r?.service_type||r?.followup_type||null,season_context:r?.season_context||null,
      scheduled_at:r?.due_at||null,reason:r?.summary||null,
      detail:'CRM follow-up is overdue and remains '+norm(r?.followup_status)+'.',
      readiness_state:'overdue',navigation_target:'jobs',
      source_links:[{source_type:'crm_followup',source_id:r?.id||null,reference:r?.followup_type||null}]
    });
  }

  if(input.financeVisible){
    for(const r of input.receivables||[]){
      if(Number(r?.balance_due||0)<=0||Number(r?.days_past_due||0)<=0) continue;
      add({
        dedupe_key:'invoice:'+String(r?.id||r?.invoice_number||''),signal_type:'invoice_reminder_candidate',signal_types:['invoice_reminder_candidate'],
        ...withCustomer(r),work_order_id:r?.work_order_id||null,service_context:'accounts_receivable',
        scheduled_at:r?.due_date||null,reason:'invoice is '+Number(r?.days_past_due||0)+' day(s) past due',
        detail:'Invoice '+String(r?.invoice_number||'')+' has recorded balance due '+Number(r?.balance_due||0).toFixed(2)+'.',
        readiness_state:'finance_review',navigation_target:'finance',amount:Number(r?.balance_due||0),
        source_links:[{source_type:'ar_invoice',source_id:r?.id||null,reference:r?.invoice_number||null}]
      });
    }
  }

  const deliveryAttention=(input.notificationQueue||[]).filter((r)=>['manual_review','failed','retry_scheduled'].includes(norm(r?.delivery_status))).map((r)=>({
    outbox_id:r?.id||null,delivery_status:r?.delivery_status||null,work_order_id:r?.work_order_id||null,
    work_order_number:r?.work_order_number||null,client_name:r?.client_name||null,live_update_title:r?.live_update_title||null,
    attempt_count:Number(r?.attempt_count||0),next_attempt_at:r?.next_attempt_at||null,last_attempt_at:r?.last_attempt_at||null,
    consent_status:r?.consent_status||null,
    detail:'Existing protected customer-notification delivery requires operational review.'
  }));

  const queue=[...candidates.values()].map((r:any)=>({
    ...r,signal_types:r.signal_types||[r.signal_type],
    source_link_count:(r.source_links||[]).length,
    message_context:[
      r.client_name?'Customer: '+r.client_name:null,
      r.site_name?'Site: '+r.site_name:null,
      r.work_order_number?'Work order: '+r.work_order_number:null,
      r.service_context?'Service: '+r.service_context:null,
      r.scheduled_at?'Timing: '+r.scheduled_at:null,
      r.reason?'Reason: '+r.reason:null,
      r.preferred_contact_method?'Preferred contact: '+r.preferred_contact_method:null,
      r.preferred_contact_window?'Preferred window: '+r.preferred_contact_window:null
    ].filter(Boolean)
  })).sort((a:any,b:any)=>{
    const order:Record<string,number>={overdue_customer_followup:10,weather_workability_change:20,eta_change:25,reschedule_notice:30,invoice_reminder_candidate:40,completion_followup:50,recurring_service_notice:60};
    return (order[a.signal_type]||99)-(order[b.signal_type]||99)||String(a.scheduled_at||'9999').localeCompare(String(b.scheduled_at||'9999'))||String(a.dedupe_key).localeCompare(String(b.dedupe_key));
  });
  const count=(type:string)=>queue.filter((r:any)=>(r.signal_types||[]).includes(type)).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',horizon_end:horizon14,source_queries_ok:input.sourceQueriesOk,
    summary:{
      queue_count:queue.length,weather_workability_changes:count('weather_workability_change'),reschedule_notices:count('reschedule_notice'),
      eta_changes:count('eta_change'),completion_followups:count('completion_followup'),recurring_service_notices:count('recurring_service_notice'),
      overdue_customer_followups:count('overdue_customer_followup'),invoice_reminder_candidates:count('invoice_reminder_candidate'),
      delivery_attention_count:deliveryAttention.length,merged_multi_source_count:queue.filter((r:any)=>Number(r.source_link_count||0)>1).length
    },
    readiness_queue:queue.slice(0,250),delivery_attention:deliveryAttention.slice(0,100),
    duplicate_boundary:'Queue identity is deterministic. Workability and dispatch schedule-change evidence collapse to one work-order communication candidate while retaining every source link; other candidates use their canonical source identity.',
    context_boundary:'Message context is assembled from source references, service/timing/reason, and CRM preferred contact method/window only. Customer email addresses, phone numbers and portal tokens are not returned by this management queue.',
    completion_boundary:'A completion follow-up is suppressed when an outbound CRM interaction linked to the same work order is recorded at or after the closeout approval/signoff evidence.',
    recurring_boundary:'Recurring-service notices are readiness candidates only. The recurring occurrence key is retained for duplicate suppression; no message is sent and no customer preference is inferred.',
    finance_boundary:'Invoice-reminder candidates appear only with Finance visibility and are based on recorded positive balance plus days-past-due evidence. This layer cannot send reminders, collect payment or mutate A/R.',
    delivery_boundary:'Existing notification outbox state is review evidence only. Protected consent, enqueue, claim, retry and provider delivery remain the existing customer-notification authority.',
    authority_boundary:'Read-only readiness and queue-quality evidence. This scope does not send email/text, publish live updates, reschedule work, change workability decisions, create CRM interactions/follow-ups, retry delivery, mutate invoices or contact a provider.'
  };
}


function buildCustomerCommunicationOutcomeFollowUpEffectiveness(input:{
  interactions:any[];followups:any[];notificationQueue:any[];closeouts:any[];jobsVisible:boolean;sourceQueriesOk:boolean;
}) {
  const norm=(v:any)=>String(v??'').trim().toLowerCase();
  const ts=(v:any)=>{const n=new Date(String(v||'')).getTime();return Number.isFinite(n)?n:null;};
  const workOrderById=new Map<string,any>();
  for(const r of input.closeouts||[]) if(r?.work_order_id) workOrderById.set(String(r.work_order_id),r);
  const inbound=(input.interactions||[]).filter((r)=>norm(r?.direction)==='inbound').sort((a,b)=>(ts(a?.occurred_at)||0)-(ts(b?.occurred_at)||0));
  const outbound=(input.interactions||[]).filter((r)=>norm(r?.direction)==='outbound').sort((a,b)=>(ts(a?.occurred_at)||0)-(ts(b?.occurred_at)||0));
  const followupsByInteraction=new Map<string,any[]>();
  for(const r of input.followups||[]){
    const id=String(r?.interaction_id||''); if(!id) continue;
    const rows=followupsByInteraction.get(id)||[]; rows.push(r); followupsByInteraction.set(id,rows);
  }
  const responseAfter=(row:any)=>{
    const workOrderId=String(row?.work_order_id||''); const occurred=ts(row?.occurred_at);
    if(!workOrderId||occurred===null) return null;
    return inbound.find((candidate:any)=>String(candidate?.work_order_id||'')===workOrderId&&(ts(candidate?.occurred_at)||0)>=occurred)||null;
  };
  const outreachEvidence=outbound.map((r:any)=>{
    const response=responseAfter(r),linked=followupsByInteraction.get(String(r?.id||''))||[];
    const completed=linked.filter((f:any)=>norm(f?.followup_status)==='completed');
    const unresolved=linked.filter((f:any)=>['pending','in_progress','deferred'].includes(norm(f?.followup_status)));
    const overdue=unresolved.filter((f:any)=>f?.overdue===true);
    const closeout=r?.work_order_id?workOrderById.get(String(r.work_order_id)):null;
    return {
      interaction_id:r?.id||null,client_id:r?.client_id||null,client_name:r?.client_name||null,
      work_order_id:r?.work_order_id||null,work_order_number:closeout?.work_order_number||null,
      channel:r?.channel||null,interaction_type:r?.interaction_type||null,interaction_status:r?.interaction_status||null,
      season_context:r?.season_context||null,service_type:r?.service_type||null,occurred_at:r?.occurred_at||null,
      outcome_recorded:!!String(r?.outcome||'').trim()||['resolved','closed'].includes(norm(r?.interaction_status)),
      recorded_outcome:String(r?.outcome||'').trim()||null,
      response_state:response?'recorded_inbound_response':r?.work_order_id?'no_recorded_inbound_response':'not_linkable_without_work_order',
      response_at:response?.occurred_at||null,response_channel:response?.channel||null,
      linked_followup_count:linked.length,completed_followup_count:completed.length,
      unresolved_followup_count:unresolved.length,overdue_followup_count:overdue.length
    };
  });
  const interactionById=new Map<string,any>();
  for(const r of input.interactions||[]) if(r?.id) interactionById.set(String(r.id),r);
  const followupEvidence=(input.followups||[]).map((r:any)=>{
    const status=norm(r?.followup_status),completedAt=ts(r?.completed_at),dueAt=ts(r?.due_at);
    const completed=status==='completed';
    const timeliness=completed
      ?(completedAt!==null&&dueAt!==null?(completedAt<=dueAt?'completed_on_time':'completed_late'):'completed_timing_unavailable')
      :(status==='cancelled'?'cancelled':r?.overdue===true?'open_overdue':'open_not_overdue');
    const source=r?.interaction_id?interactionById.get(String(r.interaction_id)):null;
    return {
      followup_id:r?.id||null,client_id:r?.client_id||null,client_name:r?.client_name||null,
      interaction_id:r?.interaction_id||null,source_direction:source?.direction||null,source_channel:source?.channel||null,
      followup_type:r?.followup_type||null,followup_status:r?.followup_status||null,priority:r?.priority||null,
      season_context:r?.season_context||null,service_type:r?.service_type||null,due_at:r?.due_at||null,
      completed_at:r?.completed_at||null,timeliness,resolution_recorded:!!String(r?.resolution_note||'').trim()
    };
  });
  const completionFollowupOutcomes=(input.closeouts||[]).filter((r:any)=>['approved','invoice_ready'].includes(norm(r?.closeout_status))&&(r?.signed_off_at||r?.approved_at)).map((r:any)=>{
    const base=r?.signed_off_at||r?.approved_at; const baseTs=ts(base)||0;
    const workOrderId=String(r?.work_order_id||'');
    const after=outbound.filter((i:any)=>workOrderId&&String(i?.work_order_id||'')===workOrderId&&(ts(i?.occurred_at)||0)>=baseTs);
    const first=after[0]||null; const response=first?responseAfter(first):null;
    return {
      closeout_id:r?.id||null,work_order_id:r?.work_order_id||null,work_order_number:r?.work_order_number||null,
      client_id:r?.client_id||null,client_name:r?.client_name||null,closeout_at:base,
      outbound_count_after_closeout:after.length,first_outbound_at:first?.occurred_at||null,
      response_at:response?.occurred_at||null,
      outcome_state:!first?'no_recorded_outbound_followup':response?'recorded_inbound_response':'outbound_without_recorded_response'
    };
  });
  const workOrderGroups=new Map<string,any[]>();
  for(const r of outreachEvidence){
    const id=String(r?.work_order_id||''); if(!id) continue;
    const rows=workOrderGroups.get(id)||[]; rows.push(r); workOrderGroups.set(id,rows);
  }
  const repeatedUnresolvedOutreach=[...workOrderGroups.entries()].map(([workOrderId,rows])=>{
    const ordered=[...rows].sort((a:any,b:any)=>(ts(a?.occurred_at)||0)-(ts(b?.occurred_at)||0));
    const first=ordered[0],last=ordered[ordered.length-1];
    const firstTs=ts(first?.occurred_at)||0;
    const response=inbound.find((i:any)=>String(i?.work_order_id||'')===workOrderId&&(ts(i?.occurred_at)||0)>=firstTs)||null;
    return {
      work_order_id:workOrderId,work_order_number:first?.work_order_number||last?.work_order_number||null,
      client_id:first?.client_id||last?.client_id||null,client_name:first?.client_name||last?.client_name||null,
      outbound_count:ordered.length,first_outbound_at:first?.occurred_at||null,last_outbound_at:last?.occurred_at||null,
      response_at:response?.occurred_at||null
    };
  }).filter((r:any)=>r.outbound_count>=2&&!r.response_at);
  const aggregate=(field:string,rows:any[])=>{
    const groups=new Map<string,any>();
    for(const r of rows){
      const key=String(r?.[field]||'other');
      const g=groups.get(key)||{key,outbound_count:0,response_recorded_count:0,outcome_recorded_count:0};
      g.outbound_count++; if(r?.response_state==='recorded_inbound_response') g.response_recorded_count++;
      if(r?.outcome_recorded) g.outcome_recorded_count++; groups.set(key,g);
    }
    return [...groups.values()].sort((a,b)=>b.outbound_count-a.outbound_count||String(a.key).localeCompare(String(b.key)));
  };
  const completedFollowups=followupEvidence.filter((r:any)=>r.followup_status&&norm(r.followup_status)==='completed');
  const openFollowups=followupEvidence.filter((r:any)=>['pending','in_progress','deferred'].includes(norm(r?.followup_status)));
  const delivery=(input.notificationQueue||[]).map((r:any)=>({
    outbox_id:r?.id||null,work_order_id:r?.work_order_id||null,work_order_number:r?.work_order_number||null,
    client_id:r?.client_id||null,client_name:r?.client_name||null,delivery_status:r?.delivery_status||null,
    sent_at:r?.sent_at||null,attempt_count:Number(r?.attempt_count||0),last_attempt_at:r?.last_attempt_at||null,
    live_update_title:r?.live_update_title||null
  }));
  const deliveryAttention=delivery.filter((r:any)=>['manual_review','failed','retry_scheduled','blocked'].includes(norm(r?.delivery_status)));
  return {
    generated_at:new Date().toISOString(),source_queries_ok:input.sourceQueriesOk,jobs_visible:input.jobsVisible,
    summary:{
      outbound_interactions:outreachEvidence.length,
      recorded_inbound_responses:outreachEvidence.filter((r:any)=>r.response_state==='recorded_inbound_response').length,
      outbound_outcomes_recorded:outreachEvidence.filter((r:any)=>r.outcome_recorded).length,
      followups_total:followupEvidence.length,followups_completed:completedFollowups.length,
      followups_completed_on_time:completedFollowups.filter((r:any)=>r.timeliness==='completed_on_time').length,
      followups_completed_late:completedFollowups.filter((r:any)=>r.timeliness==='completed_late').length,
      followups_open:openFollowups.length,followups_overdue:openFollowups.filter((r:any)=>r.timeliness==='open_overdue').length,
      repeated_unresolved_work_orders:repeatedUnresolvedOutreach.length,
      notification_sent:delivery.filter((r:any)=>norm(r?.delivery_status)==='sent').length,
      notification_delivery_attention:deliveryAttention.length,
      completion_followups_with_outbound:completionFollowupOutcomes.filter((r:any)=>r.outbound_count_after_closeout>0).length,
      completion_followups_with_recorded_response:completionFollowupOutcomes.filter((r:any)=>r.outcome_state==='recorded_inbound_response').length
    },
    outreach_evidence:outreachEvidence.slice(0,250),
    followup_evidence:followupEvidence.sort((a:any,b:any)=>String(a?.due_at||'').localeCompare(String(b?.due_at||''))).slice(0,250),
    completion_followup_outcomes:completionFollowupOutcomes.slice(0,150),
    repeated_unresolved_outreach:repeatedUnresolvedOutreach.slice(0,100),
    delivery_outcomes:delivery.slice(0,150),delivery_attention:deliveryAttention.slice(0,100),
    channel_summary:aggregate('channel',outreachEvidence),season_summary:aggregate('season_context',outreachEvidence),
    response_boundary:'A recorded customer response requires a later inbound CRM interaction linked to the same work order as the outbound CRM interaction. Customer silence is not inferred when that linkage is unavailable.',
    outcome_boundary:'CRM interaction outcome/status is reported separately from response evidence. A resolved/closed interaction or recorded outcome text is not treated as proof that the customer replied.',
    followup_boundary:'Follow-up timeliness compares canonical completed_at with due_at. Cancelled follow-ups are not counted as completed; open overdue evidence remains open until CRM authority records completion or cancellation.',
    delivery_boundary:'Notification status sent is provider delivery evidence only. It is not proof that a customer read, understood or replied to the message; retry/failed/manual-review/blocked states remain provider-authority evidence.',
    recurrence_boundary:'Repeated unresolved outreach means at least two recorded outbound CRM interactions for the same work order with no later recorded inbound interaction after the first outbound. It is a review signal, not a customer-quality or staff-performance score.',
    coverage_boundary:'This view is bounded by the loaded canonical CRM interaction, follow-up, closeout and protected notification-delivery evidence. Missing or failed source reads are never converted into successful outcomes.',
    authority_boundary:'Read-only communication-outcome evidence. This layer cannot send email/text, retry providers, create or close CRM follow-ups/interactions, change consent/preferences, reschedule work, publish customer updates, collect payment or contact a provider.'
  };
}


function buildDataQualityDuplicateOrphanReconciliation(input:{
  customers:any[];properties:any[];jobs:any[];dispatch:any[];recurring:any[];crews:any[];equipment:any[];routes:any[];
  workability:any[];materialPlans:any[];jobsVisible:boolean;sourceQueriesOk:boolean;referenceCoverageComplete:boolean;
}) {
  const norm=(v:any)=>String(v??'').trim().toLowerCase();
  const compact=(v:any)=>norm(v).replace(/[^a-z0-9]+/g,'');
  const phoneKey=(v:any)=>String(v??'').replace(/\D+/g,'').slice(-10);
  const postalKey=(v:any)=>String(v??'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
  const today=ontarioDateKey(new Date())!;
  const activeStatus=(v:any)=>!['inactive','archived','retired','cancelled','completed','closed','superseded'].includes(norm(v));
  const signalOrder:Record<string,number>={
    broken_canonical_reference:10,cross_module_link_mismatch:20,stale_assignment:30,conflicting_season_service_tag:40,
    duplicate_customer_candidate:50,duplicate_property_candidate:60
  };
  const customerById=new Map<string,any>((input.customers||[]).filter(r=>r?.client_id).map(r=>[String(r.client_id),r]));
  const propertyById=new Map<string,any>((input.properties||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
  const crewById=new Map<string,any>((input.crews||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
  const equipmentById=new Map<string,any>((input.equipment||[]).filter(r=>r?.id!=null).map(r=>[String(r.id),r]));
  const routeById=new Map<string,any>((input.routes||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
  const jobById=new Map<string,any>((input.jobs||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
  const signals:any[]=[];
  const add=(r:any)=>{
    const entityIdentity=String(r.entity_id||r.reference||'unknown').trim();
    const sourceId=[String(r.signal_type||'quality_signal'),String(r.entity_type||'entity'),entityIdentity].join(':').slice(0,180);
    signals.push({
      severity:r.severity||'review',signal_type:r.signal_type,entity_type:r.entity_type||null,entity_id:r.entity_id||null,
      reference:r.reference||null,title:r.title||null,detail:r.detail||null,match_basis:r.match_basis||[],
      related_entities:r.related_entities||[],source_links:r.source_links||[],suggested_action:r.suggested_action||'Review the canonical source records before making any correction.',
      navigation_target:r.navigation_target||'jobs',destructive_action_allowed:false,
      source_module:'admin',source_type:'data_quality_signal',source_id:sourceId,source_key:'admin:data_quality_signal:'+sourceId
    });
  };

  const pairMap=new Map<string,any>();
  const customerRows=(input.customers||[]).filter(r=>r?.client_id&&r?.is_active!==false);
  const addCustomerPair=(a:any,b:any,basis:string)=>{
    const ids=[String(a.client_id),String(b.client_id)].sort(),key=ids.join('|');
    const row=pairMap.get(key)||{a,b,basis:new Set<string>()}; row.basis.add(basis); pairMap.set(key,row);
  };
  for(let i=0;i<customerRows.length;i++) for(let j=i+1;j<customerRows.length;j++){
    const a=customerRows[i],b=customerRows[j];
    const ae=norm(a?.billing_email),be=norm(b?.billing_email),ap=phoneKey(a?.phone),bp=phoneKey(b?.phone);
    const an=compact(a?.client_name||a?.legal_name||a?.display_name),bn=compact(b?.client_name||b?.legal_name||b?.display_name);
    const az=postalKey(a?.postal_code),bz=postalKey(b?.postal_code);
    if(ae&&ae===be) addCustomerPair(a,b,'same_email');
    if(ap.length>=7&&ap===bp) addCustomerPair(a,b,'same_phone');
    if(an&&an===bn&&az&&az===bz) addCustomerPair(a,b,'same_normalized_name_and_postal');
  }
  for(const {a,b,basis} of pairMap.values()){
    const matchBasis=[...basis].sort();
    add({
      signal_type:'duplicate_customer_candidate',severity:matchBasis.includes('same_email')||matchBasis.includes('same_phone')?'high_review':'review',
      entity_type:'customer_pair',entity_id:[a.client_id,b.client_id].sort().join('|'),
      reference:[a.client_code,b.client_code].filter(Boolean).sort().join(' ↔ '),
      title:(a.client_name||a.client_code||'Customer')+' ↔ '+(b.client_name||b.client_code||'Customer'),
      detail:'Two active canonical customer records share '+matchBasis.map(x=>x.replaceAll('_',' ')).join(', ')+'. Contact values are used only for matching and are not returned in this workbench.',
      match_basis:matchBasis,
      related_entities:[
        {type:'customer',id:a.client_id,reference:a.client_code||null,name:a.client_name||null},
        {type:'customer',id:b.client_id,reference:b.client_code||null,name:b.client_name||null}
      ],
      source_links:[{source_type:'crm_customer',source_id:a.client_id,reference:a.client_code||null},{source_type:'crm_customer',source_id:b.client_id,reference:b.client_code||null}],
      suggested_action:'Open CRM, compare service/property/history evidence, and decide manually whether records represent the same customer. Preserve both source IDs and audit history until an explicit reconciliation workflow exists.',
      navigation_target:'crm'
    });
  }

  const propertyGroups=new Map<string,any[]>();
  for(const p of (input.properties||[]).filter(r=>r?.id&&r?.is_active!==false)){
    const address=compact([p?.service_address,p?.city,p?.province].filter(Boolean).join(' ')),postal=postalKey(p?.postal_code);
    const lat=Number(p?.latitude),lng=Number(p?.longitude);
    const geo=Number.isFinite(lat)&&Number.isFinite(lng)?lat.toFixed(5)+','+lng.toFixed(5):'';
    const keys=[address&&postal?'addr:'+address+'|'+postal:'',geo?'geo:'+geo:''].filter(Boolean);
    for(const key of keys){const list=propertyGroups.get(key)||[];list.push(p);propertyGroups.set(key,list);}
  }
  const propertyPairs=new Map<string,any>();
  for(const [key,rows] of propertyGroups.entries()){
    if(rows.length<2) continue;
    for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++){
      const a=rows[i],b=rows[j],ids=[String(a.id),String(b.id)].sort(),pk=ids.join('|');
      const row=propertyPairs.get(pk)||{a,b,basis:new Set<string>()}; row.basis.add(key.startsWith('addr:')?'same_normalized_service_address':'same_rounded_coordinates'); propertyPairs.set(pk,row);
    }
  }
  for(const {a,b,basis} of propertyPairs.values()){
    const matchBasis=[...basis].sort();
    add({
      signal_type:'duplicate_property_candidate',severity:'review',entity_type:'property_pair',entity_id:[a.id,b.id].sort().join('|'),
      reference:[a.site_code,b.site_code].filter(Boolean).sort().join(' ↔ '),
      title:(a.site_name||a.site_code||'Property')+' ↔ '+(b.site_name||b.site_code||'Property'),
      detail:'Two active property records share '+matchBasis.map(x=>x.replaceAll('_',' ')).join(', ')+'. Address/coordinate values are used for matching; source property IDs remain distinct.',
      match_basis:matchBasis,
      related_entities:[
        {type:'property',id:a.id,reference:a.site_code||null,name:a.site_name||null,client_id:a.client_id||null},
        {type:'property',id:b.id,reference:b.site_code||null,name:b.site_name||null,client_id:b.client_id||null}
      ],
      source_links:[{source_type:'crm_property',source_id:a.id,reference:a.site_code||null},{source_type:'crm_property',source_id:b.id,reference:b.site_code||null}],
      suggested_action:'Open Property / CRM, compare ownership, service history, zones and access data. Do not merge or delete automatically; preserve both property identities until reviewed.',
      navigation_target:'crm'
    });
  }

  if(input.referenceCoverageComplete){
    for(const r of input.recurring||[]){
      if(!['draft','active','paused'].includes(norm(r?.agreement_status))) continue;
      const refs=[
        ['customer',r?.client_id,customerById,'CRM customer'],
        ['property',r?.client_site_id,propertyById,'CRM property'],
        ['crew',r?.crew_id,crewById,'crew'],
        ['route',r?.route_id,routeById,'route']
      ] as any[];
      for(const [kind,id,map,label] of refs){
        if(id&&!map.has(String(id))) add({
          signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'recurring_service',entity_id:r?.id||null,reference:r?.agreement_code||null,
          title:'Recurring service references an unavailable '+label,
          detail:'Agreement '+String(r?.agreement_code||r?.id||'')+' records '+kind+' id '+String(id)+' but that id is absent from the complete loaded canonical '+label+' source.',
          related_entities:[{type:'recurring_service',id:r?.id||null,reference:r?.agreement_code||null},{type:kind,id}],
          source_links:[{source_type:'recurring_service',source_id:r?.id||null,reference:r?.agreement_code||null}],
          suggested_action:'Open the recurring-service program and the referenced source. Repair the link deliberately; do not synthesize a replacement record.',
          navigation_target:'operations'
        });
      }
      const property=r?.client_site_id?propertyById.get(String(r.client_site_id)):null;
      if(property&&r?.client_id&&String(property.client_id||'')!==String(r.client_id)) add({
        signal_type:'cross_module_link_mismatch',severity:'high_review',entity_type:'recurring_service',entity_id:r?.id||null,reference:r?.agreement_code||null,
        title:'Recurring service customer/property ownership mismatch',
        detail:'The agreement customer id and the selected property customer id do not match.',
        related_entities:[{type:'recurring_service',id:r?.id||null,reference:r?.agreement_code||null},{type:'customer',id:r?.client_id},{type:'property',id:r?.client_site_id,client_id:property.client_id}],
        source_links:[{source_type:'recurring_service',source_id:r?.id||null,reference:r?.agreement_code||null},{source_type:'crm_property',source_id:r?.client_site_id,reference:property?.site_code||null}],
        suggested_action:'Open CRM and the recurring-service program, determine the correct canonical customer/property pair, and update through the existing program authority.',
        navigation_target:'crm'
      });
    }

    for(const r of input.jobs||[]){
      const status=norm(r?.status||r?.job_status);
      if(!activeStatus(status)) continue;
      if(r?.client_id&&!customerById.has(String(r.client_id))) add({
        signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'job',entity_id:r?.id||null,reference:r?.job_code||null,
        title:'Active job references an unavailable customer',detail:'The active job customer id is absent from the complete loaded CRM customer source.',
        related_entities:[{type:'job',id:r?.id||null,reference:r?.job_code||null},{type:'customer',id:r?.client_id}],
        source_links:[{source_type:'job',source_id:r?.id||null,reference:r?.job_code||null}],suggested_action:'Open Jobs and CRM and repair the customer link through the authoritative job/customer workflow.',navigation_target:'jobs'
      });
      if(r?.client_site_id&&!propertyById.has(String(r.client_site_id))) add({
        signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'job',entity_id:r?.id||null,reference:r?.job_code||null,
        title:'Active job references an unavailable property',detail:'The active job property id is absent from the complete loaded CRM property source.',
        related_entities:[{type:'job',id:r?.id||null,reference:r?.job_code||null},{type:'property',id:r?.client_site_id}],
        source_links:[{source_type:'job',source_id:r?.id||null,reference:r?.job_code||null}],suggested_action:'Open Jobs and Property / CRM and repair the property link deliberately.',navigation_target:'jobs'
      });
      const property=r?.client_site_id?propertyById.get(String(r.client_site_id)):null;
      if(property&&r?.client_id&&String(property.client_id||'')!==String(r.client_id)) add({
        signal_type:'cross_module_link_mismatch',severity:'high_review',entity_type:'job',entity_id:r?.id||null,reference:r?.job_code||null,
        title:'Job customer/property ownership mismatch',detail:'The active job customer id differs from the customer that owns its canonical property.',
        related_entities:[{type:'job',id:r?.id||null,reference:r?.job_code||null},{type:'customer',id:r?.client_id},{type:'property',id:r?.client_site_id,client_id:property.client_id}],
        source_links:[{source_type:'job',source_id:r?.id||null,reference:r?.job_code||null},{source_type:'crm_property',source_id:r?.client_site_id,reference:property?.site_code||null}],
        suggested_action:'Review Jobs and CRM together and correct the canonical ownership link without replacing or deleting source history.',navigation_target:'jobs'
      });
    }

    for(const r of input.dispatch||[]){
      if(!activeStatus(r?.schedule_status)) continue;
      const effectiveJob=r?.job_id||r?.legacy_job_id;
      const siteId=r?.effective_client_site_id||r?.client_site_id;
      if(!r?.work_order_id) add({
        signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
        title:'Active dispatch has no work-order identity',detail:'This active dispatch row does not expose a canonical work_order_id.',
        source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null}],suggested_action:'Open Dispatch and locate the source schedule record; repair through the scheduling authority rather than creating a parallel work order.',navigation_target:'jobs'
      });
      if(effectiveJob&&!jobById.has(String(effectiveJob))) add({
        signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
        title:'Active dispatch references an unavailable job',detail:'The dispatch job identity is absent from the complete loaded canonical jobs source.',
        related_entities:[{type:'dispatch',id:r?.id||null},{type:'job',id:effectiveJob}],source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null}],
        suggested_action:'Open Dispatch and Jobs, verify the work-order/job chain, and repair only through the existing scheduling/job authority.',navigation_target:'jobs'
      });
      if(siteId&&!propertyById.has(String(siteId))) add({
        signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
        title:'Active dispatch references an unavailable property',detail:'The dispatch property identity is absent from the complete loaded CRM property source.',
        related_entities:[{type:'dispatch',id:r?.id||null},{type:'property',id:siteId}],source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null}],
        suggested_action:'Review Dispatch and Property / CRM and correct the source link deliberately.',navigation_target:'jobs'
      });
      const crew=r?.crew_id?crewById.get(String(r.crew_id)):null;
      if(r?.crew_id&&(!crew||!activeStatus(crew?.crew_status))) add({
        signal_type:'stale_assignment',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
        title:'Active dispatch is assigned to an inactive/unavailable crew',detail:'The current dispatch crew assignment is not backed by an active canonical crew record.',
        related_entities:[{type:'dispatch',id:r?.id||null},{type:'crew',id:r?.crew_id,reference:crew?.crew_code||null}],source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null}],
        suggested_action:'Open Dispatch and Crew Management. Reassign only through the scheduling authority after confirming the correct active crew.',navigation_target:'jobs'
      });
      const equipmentIds=[
        r?.assigned_truck_equipment_item_id,r?.assigned_trailer_equipment_item_id,
        ...(Array.isArray(r?.assigned_equipment_item_ids)?r.assigned_equipment_item_ids:[])
      ].filter((x:any)=>x!=null).map((x:any)=>String(x));
      for(const id of [...new Set(equipmentIds)]){
        const eq=equipmentById.get(id);
        if(!eq) add({
          signal_type:'broken_canonical_reference',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
          title:'Active dispatch references unavailable equipment',detail:'Assigned equipment id '+id+' is absent from the complete loaded equipment registry.',
          related_entities:[{type:'dispatch',id:r?.id||null},{type:'equipment',id}],source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null}],
          suggested_action:'Open Dispatch and Equipment Registry and repair the assignment through the authoritative scheduling/equipment workflow.',navigation_target:'jobs'
        });
        else if(eq?.is_locked_out===true||['inactive','retired','disposed'].includes(norm(eq?.status))||['locked_out','replacement_hold'].includes(norm(eq?.registry_readiness_status))) add({
          signal_type:'stale_assignment',severity:'high_review',entity_type:'dispatch',entity_id:r?.id||null,reference:r?.work_order_number||null,
          title:'Active dispatch includes unavailable equipment',detail:'Assigned equipment '+String(eq?.equipment_code||id)+' is locked out, retired/inactive, or on replacement hold.',
          related_entities:[{type:'dispatch',id:r?.id||null},{type:'equipment',id,reference:eq?.equipment_code||null}],source_links:[{source_type:'dispatch',source_id:r?.id||null,reference:r?.work_order_number||null},{source_type:'equipment',source_id:id,reference:eq?.equipment_code||null}],
          suggested_action:'Open Dispatch and Equipment Registry. Preserve the lockout/retirement authority and reassign equipment deliberately if required.',navigation_target:'jobs'
        });
      }
    }

    for(const eq of input.equipment||[]){
      if(!eq?.assigned_crew_id) continue;
      const crew=crewById.get(String(eq.assigned_crew_id));
      if(!crew||!activeStatus(crew?.crew_status)) add({
        signal_type:'stale_assignment',severity:'review',entity_type:'equipment',entity_id:eq?.id||null,reference:eq?.equipment_code||null,
        title:'Equipment is assigned to an inactive/unavailable crew',detail:'Equipment '+String(eq?.equipment_code||eq?.equipment_name||eq?.id||'')+' retains a crew assignment that is not backed by an active canonical crew.',
        related_entities:[{type:'equipment',id:eq?.id||null,reference:eq?.equipment_code||null},{type:'crew',id:eq?.assigned_crew_id,reference:crew?.crew_code||null}],
        source_links:[{source_type:'equipment',source_id:eq?.id||null,reference:eq?.equipment_code||null}],
        suggested_action:'Open Equipment Registry and Crew Management and correct the recorded crew assignment without bypassing equipment/crew authority.',navigation_target:'jobs'
      });
    }
  }

  for(const crew of input.crews||[]){
    const members=Array.isArray(crew?.members_json)?crew.members_json:[];
    for(const m of members){
      if(norm(m?.membership_status)==='active'&&m?.active_until&&String(m.active_until)<today) add({
        signal_type:'stale_assignment',severity:'review',entity_type:'crew_membership',entity_id:String(crew?.id||'')+':'+String(m?.profile_id||''),
        reference:crew?.crew_code||null,title:'Crew membership is marked active after its recorded end date',
        detail:String(m?.full_name||m?.employee_number||'Crew member')+' remains active in '+String(crew?.crew_name||crew?.crew_code||'crew')+' although active_until is '+String(m.active_until)+'.',
        related_entities:[{type:'crew',id:crew?.id||null,reference:crew?.crew_code||null},{type:'profile',id:m?.profile_id||null,reference:m?.employee_number||null}],
        source_links:[{source_type:'crew',source_id:crew?.id||null,reference:crew?.crew_code||null}],
        suggested_action:'Open Crew Management and close or extend the membership deliberately. Do not infer employee status from this signal.',navigation_target:'workforce'
      });
    }
  }

  const expectedSeason=(v:any)=>{
    const t=norm(v).replace(/[_-]+/g,' ');
    if(/\b(snow|winter|ice|salting|salt|de icer|deicer)\b/.test(t)) return 'winter';
    if(/\b(fall|autumn|leaf|leaves)\b/.test(t)) return 'fall';
    if(/\b(mow|mowing|lawn|landscap|garden|hedge|shrub|spring|aerat|fertiliz|sod|mulch|soil|gravel|stone)\b/.test(t)) return 'spring_summer';
    return null;
  };
  const checkSeason=(row:any,sourceType:string,id:any,reference:any,service:any,season:any,target:string)=>{
    const expected=expectedSeason(service),actual=norm(season);
    if(!expected||!actual||actual==='four_season'||actual==='other'||actual===expected) return;
    add({
      signal_type:'conflicting_season_service_tag',severity:'review',entity_type:sourceType,entity_id:id||null,reference:reference||null,
      title:'Season/service tags conflict',detail:'Recorded service context "'+String(service||'')+'" maps to '+expected.replace('_',' / ')+' while the source records season_context "'+String(season||'')+'".',
      related_entities:[{type:sourceType,id:id||null,reference:reference||null}],source_links:[{source_type:sourceType,source_id:id||null,reference:reference||null}],
      suggested_action:'Open the source record and confirm whether the service label or season tag is wrong. Correct only the authoritative source; do not rewrite related records automatically.',navigation_target:target
    });
  };
  for(const r of input.workability||[]) checkSeason(r,'workability',r?.observation_id||r?.id,r?.observation_code||r?.work_order_number,r?.service_context||r?.work_type,r?.season_context,'operations');
  for(const r of input.materialPlans||[]) checkSeason(r,'material_plan',r?.id||r?.line_id,r?.estimator_code,r?.service_context||r?.material_category,r?.season_context,'jobs');

  const sorted=signals.sort((a,b)=>(signalOrder[a.signal_type]||99)-(signalOrder[b.signal_type]||99)||String(a.reference||a.entity_id||'').localeCompare(String(b.reference||b.entity_id||'')));
  const count=(t:string)=>sorted.filter(r=>r.signal_type===t).length;
  return {
    generated_at:new Date().toISOString(),timezone:'America/Toronto',source_queries_ok:input.sourceQueriesOk,reference_coverage_complete:input.referenceCoverageComplete,
    summary:{
      total_signals:sorted.length,duplicate_customer_candidates:count('duplicate_customer_candidate'),duplicate_property_candidates:count('duplicate_property_candidate'),
      broken_canonical_references:count('broken_canonical_reference'),cross_module_link_mismatches:count('cross_module_link_mismatch'),
      stale_assignments:count('stale_assignment'),conflicting_season_service_tags:count('conflicting_season_service_tag')
    },
    reconciliation_queue:sorted.slice(0,300),
    duplicate_customer_pairs:sorted.filter(r=>r.signal_type==='duplicate_customer_candidate').slice(0,100),
    duplicate_property_pairs:sorted.filter(r=>r.signal_type==='duplicate_property_candidate').slice(0,100),
    reference_and_assignment_issues:sorted.filter(r=>['broken_canonical_reference','cross_module_link_mismatch','stale_assignment'].includes(r.signal_type)).slice(0,200),
    season_tag_conflicts:sorted.filter(r=>r.signal_type==='conflicting_season_service_tag').slice(0,150),
    duplicate_boundary:'Duplicate signals are candidates, not identity decisions. Customer matching uses exact normalized email/phone or normalized name plus postal evidence; property matching uses normalized service address/postal or rounded coordinates. Contact values are never returned by this workbench.',
    reference_boundary:'Broken-reference checks are emitted only when all required canonical reference sources are successfully loaded below their configured row caps. If coverage is partial, reference-gap findings are withheld rather than treating missing rows as missing business records.',
    assignment_boundary:'Stale crew/equipment signals describe recorded assignment inconsistencies only. They do not infer employee performance and cannot clear equipment lockouts or reassign crews/equipment.',
    season_boundary:'Season/service conflicts use the existing four-season Ontario taxonomy as a review heuristic: spring/summer landscaping and lawn work, fall cleanup/leaf work, and winter snow/ice service. Four-season/other tags are not treated as conflicts.',
    destructive_boundary:'This workbench cannot merge or delete customers/properties, delete history, rewrite foreign keys, reassign crews/equipment, clear lockouts, or mutate Jobs/CRM/Finance/Safety records. Every correction remains a deliberate action in the canonical source workflow.',
    audit_boundary:'Source IDs and references are retained on every reconciliation candidate so audit and historical identity remain visible during review.',
    authority_boundary:'Read-only data-quality evidence assembled from canonical CRM, Jobs, Dispatch, Recurring Service, Crew, Equipment, Route, Workability and Material Estimator sources.'
  };
}


function buildDataQualityRemediationOutcomeRecurrence(input:{
  reconciliation:any;journal:any[];sourceQueriesOk:boolean;coverageComplete:boolean;adminVisible:boolean;
}) {
  const norm=(v:any)=>String(v??'').trim().toLowerCase();
  const ts=(v:any)=>{const n=Date.parse(String(v||''));return Number.isFinite(n)?n:0;};
  const currentSignals=Array.isArray(input.reconciliation?.reconciliation_queue)?input.reconciliation.reconciliation_queue:[];
  const journalRows=(input.journal||[]).filter((r:any)=>norm(r?.source_module)==='admin'&&norm(r?.source_type)==='data_quality_signal');
  const byKey=new Map<string,any[]>();
  for(const row of journalRows){
    const key=String(row?.source_key||''); if(!key) continue;
    const rows=byKey.get(key)||[]; rows.push(row); byKey.set(key,rows);
  }
  for(const rows of byKey.values()) rows.sort((a:any,b:any)=>ts(b?.decision_at||b?.updated_at)-ts(a?.decision_at||a?.updated_at));
  const currentKeys=new Set(currentSignals.map((r:any)=>String(r?.source_key||'')).filter(Boolean));
  const current_outcomes=currentSignals.map((signal:any)=>{
    const key=String(signal?.source_key||'');
    const history=byKey.get(key)||[];
    const latest=history[0]||null;
    const priorResolved=history.some((r:any)=>['resolved','improved'].includes(norm(r?.outcome_status)));
    const explicitRecurring=history.some((r:any)=>r?.recurrence_signal===true||norm(r?.outcome_status)==='recurring');
    const recurring=explicitRecurring||priorResolved;
    const outcome_state=recurring?'recurring':latest?'still_open_tracked':'still_open_untracked';
    return {
      source_key:key,source_id:signal?.source_id||null,signal_type:signal?.signal_type||null,entity_type:signal?.entity_type||null,
      entity_id:signal?.entity_id||null,reference:signal?.reference||null,title:signal?.title||null,severity:signal?.severity||null,
      navigation_target:signal?.navigation_target||'operations',outcome_state,
      decision_count:history.length,recurrence_count:history.filter((r:any)=>r?.recurrence_signal===true||norm(r?.outcome_status)==='recurring').length,
      latest_outcome_status:latest?.outcome_status||null,latest_decision_at:latest?.decision_at||null,latest_outcome_recorded_at:latest?.outcome_recorded_at||null,
      latest_followup_due_at:latest?.followup_due_at||null,latest_followup_evidence_reference:latest?.followup_evidence_reference||null,
      recurrence_basis:recurring?(explicitRecurring?'recorded_recurrence_signal':'current_signal_after_recorded_resolution'):null,
      suggested_action:signal?.suggested_action||'Review the canonical source record deliberately.'
    };
  });
  const historical_outcomes=[...byKey.entries()].filter(([key])=>!currentKeys.has(key)).map(([key,history])=>{
    const latest=history[0]||null;
    const status=norm(latest?.outcome_status);
    const confirmedResolved=input.coverageComplete&&['resolved','improved'].includes(status);
    return {
      source_key:key,source_id:latest?.source_id||null,latest_outcome_status:latest?.outcome_status||null,
      latest_decision_at:latest?.decision_at||null,latest_outcome_recorded_at:latest?.outcome_recorded_at||null,
      decision_count:history.length,recurrence_count:history.filter((r:any)=>r?.recurrence_signal===true||norm(r?.outcome_status)==='recurring').length,
      outcome_state:confirmedResolved?'resolved':input.coverageComplete?'not_currently_detected_unresolved_history':'coverage_withheld',
      outcome_note:latest?.outcome_note||null,followup_evidence_reference:latest?.followup_evidence_reference||null
    };
  });
  const confirmed_resolved=historical_outcomes.filter((r:any)=>r.outcome_state==='resolved');
  const recurrenceRows=current_outcomes.filter((r:any)=>r.outcome_state==='recurring');
  const preventionMap=new Map<string,any>();
  const preventionInstruction=(signalType:string)=>{
    if(signalType==='duplicate_customer_candidate'||signalType==='duplicate_property_candidate') return 'Review the upstream identity-entry and duplicate-detection workflow before future record creation; do not auto-merge existing identities.';
    if(signalType==='broken_canonical_reference'||signalType==='cross_module_link_mismatch') return 'Review source-selection and reference-validation steps at the owning workflow before future saves; do not rewrite foreign keys automatically.';
    if(signalType==='stale_assignment') return 'Review assignment validation against current crew/equipment availability before future scheduling; do not clear lockouts or reassign automatically.';
    if(signalType==='conflicting_season_service_tag') return 'Review service/season selection guidance at the authoritative source workflow before future saves; do not rewrite historical tags automatically.';
    return 'Review the repeated source condition and strengthen the authoritative workflow without destructive automatic reconciliation.';
  };
  for(const row of recurrenceRows){
    const key=String(row.signal_type||'other');
    const group=preventionMap.get(key)||{signal_type:key,recurring_source_count:0,source_keys:[],preventive_review:preventionInstruction(key)};
    group.recurring_source_count++; group.source_keys.push(row.source_key); preventionMap.set(key,group);
  }
  const signalTypes=[...new Set(current_outcomes.map((r:any)=>String(r.signal_type||'other')))];
  const signal_type_summary=signalTypes.map((signal_type)=>({
    signal_type,
    current_count:current_outcomes.filter((r:any)=>String(r.signal_type||'other')===signal_type).length,
    tracked_count:current_outcomes.filter((r:any)=>String(r.signal_type||'other')===signal_type&&r.decision_count>0).length,
    recurring_count:current_outcomes.filter((r:any)=>String(r.signal_type||'other')===signal_type&&r.outcome_state==='recurring').length
  }));
  return {
    generated_at:new Date().toISOString(),source_queries_ok:input.sourceQueriesOk,coverage_complete:input.coverageComplete,admin_visible:input.adminVisible,
    summary:{
      current_signals:current_outcomes.length,
      still_open_tracked:current_outcomes.filter((r:any)=>r.outcome_state==='still_open_tracked').length,
      still_open_untracked:current_outcomes.filter((r:any)=>r.outcome_state==='still_open_untracked').length,
      recurring_current:recurrenceRows.length,
      confirmed_resolved:confirmed_resolved.length,
      historical_not_currently_detected:historical_outcomes.filter((r:any)=>r.outcome_state==='not_currently_detected_unresolved_history').length,
      coverage_withheld_history:historical_outcomes.filter((r:any)=>r.outcome_state==='coverage_withheld').length,
      journal_rows:journalRows.length
    },
    current_outcomes:current_outcomes.slice(0,300),
    confirmed_resolved:confirmed_resolved.slice(0,200),
    historical_outcomes:historical_outcomes.slice(0,250),
    recurrence_prevention_candidates:[...preventionMap.values()].sort((a:any,b:any)=>b.recurring_source_count-a.recurring_source_count||String(a.signal_type).localeCompare(String(b.signal_type))),
    signal_type_summary,
    source_key_boundary:'Each Build 360 signal uses a stable admin:data_quality_signal source key built from signal type, entity type and retained source identity so journal history can follow the same defect without replacing canonical record IDs.',
    resolution_boundary:'A journal row is shown as confirmed resolved by absence only when every source required by the data-quality scan completed successfully and remained below its configured row cap. Partial/capped coverage never proves resolution.',
    recurrence_boundary:'A currently detected signal is recurring when the same source key has recorded recurrence evidence or reappears after a recorded resolved/improved outcome. Recurrence is a data-quality pattern, not an employee or customer score.',
    prevention_boundary:'Recurrence-prevention guidance is advisory root-cause review only. It does not auto-merge/delete identities, rewrite foreign keys, reassign crews/equipment, clear lockouts or rewrite season/service history.',
    journal_boundary:'The existing private Management Decision Outcome Journal stores bounded decision/outcome metadata only. Build 373 reads that journal but does not create, update or close journal rows automatically.',
    authority_boundary:'Read-only remediation outcome evidence. Canonical CRM, Jobs, Dispatch, Recurring Service, Crew, Equipment, Route, Workability and Material Estimator workflows remain the only source-mutation authorities.'
  };
}


function buildWorkabilityScheduleRecoveryOutcomes(input:{
  workability:any[];dispatch:any[];production:any[];jobsVisible:boolean;sourceQueriesOk:boolean;
}) {
  const lookbackDays=90;
  const today=ontarioDateKey(new Date())!;
  const lookbackStart=addCalendarDays(today,-lookbackDays);
  const dateDistance=(from:string|null,to:string|null)=>{
    if(!from||!to) return null;
    const a=Date.parse(from+'T12:00:00Z'),b=Date.parse(to+'T12:00:00Z');
    return Number.isFinite(a)&&Number.isFinite(b) ? Math.max(0,Math.round((b-a)/86400000)) : null;
  };
  const eventTime=(row:any)=>Date.parse(String(row?.decision_at||row?.observed_at||row?.updated_at||row?.created_at||0))||0;
  const isConstraint=(row:any)=>{
    const decision=String(row?.decision_state||'').toLowerCase();
    const state=String(row?.decision_workability_state||row?.dispatch_workability_state||row?.workability_state||'').toLowerCase();
    return ['postpone','reschedule','blocked'].includes(decision) || ['delayed','blocked'].includes(state) || String(row?.dispatch_application_status||'').toLowerCase()==='pending_operator_dispatch';
  };
  const episodesByKey=new Map<string,any>();
  for(const row of input.workability||[]){
    const serviceDate=String(row?.service_date||ontarioDateKey(row?.scheduled_start)||'').slice(0,10);
    if(!serviceDate||serviceDate<lookbackStart||serviceDate>today||!isConstraint(row)) continue;
    const key=String(row?.dispatch_schedule_item_id||'') || (row?.work_order_id ? 'work_order:'+String(row.work_order_id)+':'+serviceDate : 'observation:'+String(row?.id||row?.observation_code||serviceDate));
    const previous=episodesByKey.get(key);
    if(!previous||eventTime(row)>=eventTime(previous)) episodesByKey.set(key,row);
  }
  const dispatchRows=input.dispatch||[],productionRows=input.production||[];
  const outcomes=[...episodesByKey.values()].map((row:any)=>{
    const originalDate=String(row?.service_date||ontarioDateKey(row?.scheduled_start)||'').slice(0,10);
    const dispatchId=String(row?.dispatch_schedule_item_id||'');
    const workOrderId=String(row?.work_order_id||'');
    let dispatch=dispatchId ? dispatchRows.find((item:any)=>String(item?.id||'')===dispatchId) : null;
    if(!dispatch&&workOrderId){
      dispatch=[...dispatchRows].filter((item:any)=>String(item?.work_order_id||'')===workOrderId)
        .sort((a:any,b:any)=>String(ontarioDateKey(a?.scheduled_start)||'').localeCompare(String(ontarioDateKey(b?.scheduled_start)||'')))
        .find((item:any)=>String(ontarioDateKey(item?.scheduled_start)||'')>=originalDate) || null;
    }
    const linkedProduction=productionRows.filter((item:any)=>{
      if(dispatchId&&String(item?.dispatch_schedule_item_id||'')===dispatchId) return true;
      return Boolean(workOrderId)&&String(item?.work_order_id||'')===workOrderId;
    }).filter((item:any)=>{
      const date=String(ontarioDateKey(item?.session_date||item?.ended_at||item?.started_at)||'');
      return date&&date>=originalDate;
    }).sort((a:any,b:any)=>String(ontarioDateKey(a?.session_date||a?.ended_at||a?.started_at)||'').localeCompare(String(ontarioDateKey(b?.session_date||b?.ended_at||b?.started_at)||'')));
    const full=linkedProduction.find((item:any)=>/(^complete$|completed)/i.test(String(item?.completion_state||item?.production_state||item?.session_status||'')))||null;
    const partial=!full ? linkedProduction.find((item:any)=>/(partial|return_visit_required)/i.test(String(item?.completion_state||item?.production_state||''))||item?.return_visit_required===true)||null : null;
    const completionDate=full ? String(ontarioDateKey(full?.session_date||full?.ended_at||full?.started_at)||'') : null;
    const partialDate=partial ? String(ontarioDateKey(partial?.session_date||partial?.ended_at||partial?.started_at)||'') : null;
    const dispatchDate=dispatch ? String(ontarioDateKey(dispatch?.scheduled_start)||'') : null;
    const proposedDate=String(ontarioDateKey(row?.proposed_reschedule_start)||'')||null;
    let outcomeState='blocked_unresolved',outcomeDate:string|null=null;
    if(completionDate){
      outcomeState=completionDate===originalDate?'same_day_completed':'completed_after_recovery';
      outcomeDate=completionDate;
    } else if(partialDate){
      outcomeState='partial_or_return_visit';
      outcomeDate=partialDate;
    } else if(dispatchDate&&dispatchDate>originalDate){
      outcomeState='rescheduled_pending';
      outcomeDate=dispatchDate;
    } else if(proposedDate&&proposedDate>originalDate){
      outcomeState='proposed_reschedule_pending';
      outcomeDate=proposedDate;
    }
    const season=['spring_summer','fall','winter','four_season'].includes(String(row?.season_context||'').toLowerCase())
      ? String(row.season_context).toLowerCase() : forecastSeason(row);
    return {
      source_key:String(row?.observation_code||row?.id||dispatchId||workOrderId||originalDate),
      observation_id:row?.id||null,dispatch_schedule_item_id:row?.dispatch_schedule_item_id||dispatch?.id||null,work_order_id:row?.work_order_id||dispatch?.work_order_id||null,
      work_order_number:row?.work_order_number||dispatch?.work_order_number||null,site_name:row?.site_name||dispatch?.site_name||null,route_name:row?.route_name||dispatch?.route_name||null,
      service_date:originalDate,season_context:season,service_context:row?.service_context||null,
      decision_state:row?.decision_state||null,workability_state:row?.decision_workability_state||row?.dispatch_workability_state||row?.workability_state||null,
      decision_reason:row?.decision_reason||row?.observation_note||row?.weather_condition||null,
      proposed_reschedule_date:proposedDate,current_dispatch_date:dispatchDate,current_dispatch_status:dispatch?.schedule_status||null,
      outcome_state:outcomeState,outcome_date:outcomeDate,recovery_days:dateDistance(originalDate,outcomeDate),
      completed_service_minutes:full ? Math.max(0,Number(full?.duration_minutes||0)) : 0,
      partial_or_return_visit:Boolean(partial),production_state:full?.production_state||partial?.production_state||null
    };
  }).sort((a:any,b:any)=>String(b.service_date).localeCompare(String(a.service_date)));
  const full=outcomes.filter((row:any)=>['same_day_completed','completed_after_recovery'].includes(row.outcome_state));
  const seasonKeys=['spring_summer','fall','winter','four_season'];
  const seasonOutcomes=seasonKeys.map((season)=> {
    const rows=outcomes.filter((row:any)=>row.season_context===season);
    const completed=rows.filter((row:any)=>['same_day_completed','completed_after_recovery'].includes(row.outcome_state));
    return {
      season_context:season,constraint_episodes:rows.length,full_completion_recovery_count:completed.length,
      partial_or_return_visit_count:rows.filter((row:any)=>row.outcome_state==='partial_or_return_visit').length,
      reschedule_pending_count:rows.filter((row:any)=>['rescheduled_pending','proposed_reschedule_pending'].includes(row.outcome_state)).length,
      unresolved_count:rows.filter((row:any)=>row.outcome_state==='blocked_unresolved').length,
      recovery_rate_percent:rows.length?Math.round((completed.length/rows.length)*1000)/10:0
    };
  });
  const recoveryDays=full.map((row:any)=>row.recovery_days).filter((value:any)=>Number.isFinite(Number(value))).map(Number);
  return {
    source_queries_ok:input.sourceQueriesOk!==false,jobs_visible:input.jobsVisible,lookback_days:lookbackDays,lookback_start:lookbackStart,lookback_end:today,
    summary:{
      constraint_episodes:outcomes.length,linked_dispatch_count:outcomes.filter((row:any)=>row.dispatch_schedule_item_id).length,
      full_completion_recovery_count:full.length,same_day_completion_count:outcomes.filter((row:any)=>row.outcome_state==='same_day_completed').length,
      completed_after_recovery_count:outcomes.filter((row:any)=>row.outcome_state==='completed_after_recovery').length,
      partial_or_return_visit_count:outcomes.filter((row:any)=>row.outcome_state==='partial_or_return_visit').length,
      reschedule_pending_count:outcomes.filter((row:any)=>['rescheduled_pending','proposed_reschedule_pending'].includes(row.outcome_state)).length,
      unresolved_count:outcomes.filter((row:any)=>row.outcome_state==='blocked_unresolved').length,
      completion_recovery_rate_percent:outcomes.length?Math.round((full.length/outcomes.length)*1000)/10:0,
      average_recovery_days:recoveryDays.length?Math.round((recoveryDays.reduce((sum:number,value:number)=>sum+value,0)/recoveryDays.length)*10)/10:null,
      recorded_completed_service_minutes:full.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.completed_service_minutes||0)),0)
    },
    season_outcomes:seasonOutcomes,outcomes:outcomes.slice(0,150),
    evidence_boundary:'A recovery outcome is emitted only from recorded YW Workability, Dispatch and Production evidence. Missing schedule or production evidence remains unresolved rather than being guessed.',
    capacity_boundary:'Completed-capacity evidence uses recorded production duration_minutes only. No jobs-per-crew target, productivity rate or missing duration is invented.',
    weather_boundary:'No external weather provider is queried. Human/source-authoritative Workability observations and decisions remain the weather/workability authority.',
    authority_boundary:'Read-only learning only. This outcome layer cannot change a Workability decision, move or dispatch a schedule item, complete work, send a customer message or alter Safety, Equipment or Finance state.'
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
      estimateWorkflowRead,estimateAssumptionsRead,estimateAssumptionVarianceRead,jobCostDepthRead,invoiceCandidatesRead,changeOrdersRead,paymentApplicationsRead,equipmentUseRead,fleetRead,maintenanceHistoryRead,serviceTasksRead,fleetDowntimeEventsRead,materialStockRead,materialPlansRead,materialActualUseRead,
      crmFollowupsRead,customerDirectoryRead,notificationQueueRead,closeoutsRead,propertyDirectoryRead,managementDecisionOutcomesRead
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
      (canJobsView&&canFinanceView) ? safeListEvidence(supabase,'v_estimate_workflow_assumption_directory','*','updated_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      (canJobsView&&canFinanceView) ? safeListEvidence(supabase,'v_estimate_assumption_variance','*','work_order_number',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      (canJobsView&&canFinanceView) ? safeListEvidence(supabase,'v_job_cost_depth_directory','*','job_code',750,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      (canJobsView&&canFinanceView) ? safeListEvidence(supabase,'job_invoice_candidates','*','created_at',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_change_order_extras_directory','*','updated_at',750,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:750}),
      canFinanceView ? safeListEvidence(supabase,'v_ar_payment_application_directory','*','application_date',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_equipment_signout_history','*','checked_out_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_fleet_vehicle_operations','*','equipment_code',500,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500}),
      canJobsView ? safeListEvidence(supabase,'v_equipment_maintenance_history','*','performed_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_equipment_service_task_directory','*','updated_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'fleet_downtime_events','*','started_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_material_stock_control','*','sku',1000,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_landscape_material_line_directory','*','updated_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canJobsView ? safeListEvidence(supabase,'v_landscape_material_actual_use_directory','*','recorded_at',2500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:2500}),
      canJobsView ? safeListEvidence(supabase,'v_crm_followup_queue','*','due_at',1000,true) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_crm_customer_directory','*','last_crm_activity_at',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_customer_notification_delivery_queue','*','created_at',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_work_order_closeout_queue','*','updated_at',1000,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1000}),
      canJobsView ? safeListEvidence(supabase,'v_crm_property_directory','*','updated_at',1500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:1500}),
      canAdminManage ? safeListEvidence(supabase,'v_management_decision_outcome_journal','*','decision_at',500,false) : Promise.resolve({rows:[],query_ok:true,retrieved_at:new Date().toISOString(),row_count:0,limit:500})
    ]);
    const jobs=jobsRead.rows,dispatch=dispatchRead.rows,production=productionRead.rows,profitability=profitabilityRead.rows,
      timekeeping=timekeepingRead.rows,recurring=recurringRead.rows,recurringVisits=recurringVisitsRead.rows,crews=crewsRead.rows,storms=stormsRead.rows,
      stormRoutes=stormRoutesRead.rows,seasonalWork=seasonalWorkRead.rows,safety=safetyRead.rows,equipment=equipmentRead.rows,
      maintenance=maintenanceRead.rows,trainingSummary=trainingSummaryRead.rows,workforceSummary=workforceSummaryRead.rows,
      receivables=receivablesRead.rows,bank=bankRead.rows,financeExceptions=financeExceptionsRead.rows,
      closeDashboard=closeDashboardRead.rows,workability=workabilityRead.rows,routes=routesRead.rows,timekeepingDetail=timekeepingDetailRead.rows,
      recurringEvents=recurringEventsRead.rows,crmRenewals=crmRenewalsRead.rows,crmInteractions=crmInteractionsRead.rows,
      agreementProfitability=agreementProfitabilityRead.rows,seasonalRollover=seasonalRolloverRead.rows,
      estimateWorkflow=estimateWorkflowRead.rows,estimateAssumptions=estimateAssumptionsRead.rows,estimateAssumptionVariance=estimateAssumptionVarianceRead.rows,
      jobCostDepth=jobCostDepthRead.rows,invoiceCandidates=invoiceCandidatesRead.rows,changeOrders=changeOrdersRead.rows,paymentApplications=paymentApplicationsRead.rows,
      equipmentUse=equipmentUseRead.rows,fleet=fleetRead.rows,maintenanceHistory=maintenanceHistoryRead.rows,serviceTasks=serviceTasksRead.rows,fleetDowntimeEvents=fleetDowntimeEventsRead.rows,
      materialStock=materialStockRead.rows,materialPlans=materialPlansRead.rows,materialActualUse=materialActualUseRead.rows,
      crmFollowups=crmFollowupsRead.rows,customerDirectory=customerDirectoryRead.rows,notificationQueue=notificationQueueRead.rows,closeouts=closeoutsRead.rows,
      propertyDirectory=propertyDirectoryRead.rows,managementDecisionOutcomes=managementDecisionOutcomesRead.rows;
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
    addFresh(estimateAssumptionsRead,'estimate_assumptions','jobs+finance','v_estimate_workflow_assumption_directory',canJobsView&&canFinanceView,168);
    addFresh(estimateAssumptionVarianceRead,'estimate_assumption_variance','jobs+finance','v_estimate_assumption_variance',canJobsView&&canFinanceView,168);
    addFresh(jobCostDepthRead,'job_cost_depth','finance','v_job_cost_depth_directory',canJobsView&&canFinanceView,168);
    addFresh(invoiceCandidatesRead,'invoice_candidates','jobs+finance','job_invoice_candidates',canJobsView&&canFinanceView,168);
    addFresh(changeOrdersRead,'change_orders','jobs','v_change_order_extras_directory',canJobsView,168);
    addFresh(paymentApplicationsRead,'payment_applications','finance','v_ar_payment_application_directory',canFinanceView,168);
    addFresh(equipmentUseRead,'equipment_use','jobs','v_equipment_signout_history',canJobsView,168);
    addFresh(fleetRead,'fleet','jobs','v_fleet_vehicle_operations',canJobsView,168);
    addFresh(maintenanceHistoryRead,'maintenance_history','jobs','v_equipment_maintenance_history',canJobsView,168);
    addFresh(serviceTasksRead,'equipment_service_tasks','jobs','v_equipment_service_task_directory',canJobsView,168);
    addFresh(fleetDowntimeEventsRead,'fleet_downtime_events','jobs','fleet_downtime_events',canJobsView,168);
    addFresh(materialStockRead,'material_stock','jobs','v_material_stock_control',canJobsView,168);
    addFresh(materialPlansRead,'material_plans','jobs','v_landscape_material_line_directory',canJobsView,168);
    addFresh(materialActualUseRead,'material_actual_use','jobs','v_landscape_material_actual_use_directory',canJobsView,168);
    addFresh(crmFollowupsRead,'crm_followups','jobs','v_crm_followup_queue',canJobsView,168);
    addFresh(customerDirectoryRead,'crm_customers','jobs','v_crm_customer_directory',canJobsView,168);
    addFresh(notificationQueueRead,'notification_delivery','jobs','v_customer_notification_delivery_queue',canJobsView,72);
    addFresh(closeoutsRead,'closeouts','jobs','v_work_order_closeout_queue',canJobsView,168);
    addFresh(propertyDirectoryRead,'crm_properties','jobs','v_crm_property_directory',canJobsView,168);
    addFresh(managementDecisionOutcomesRead,'management_decision_outcomes','admin','v_management_decision_outcome_journal',canAdminManage,336);
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
      route_sequence_learning:buildManagementMetricConfidence(sourceFreshness,['dispatch','production','timekeeping_detail','routes','workability']),
      recurring_retention:buildManagementMetricConfidence(sourceFreshness,['recurring','recurring_events','crm_renewals','crm_interactions','seasonal_rollover']),
      recurring_outcomes:buildManagementMetricConfidence(sourceFreshness,['recurring','crm_renewals','crm_interactions','seasonal_rollover']),
      estimate_to_cash:buildManagementMetricConfidence(sourceFreshness,['estimate_workflow','dispatch','production','change_orders','receivables','payment_applications','profitability']),
      estimate_accuracy_calibration:buildManagementMetricConfidence(sourceFreshness,['estimate_workflow','estimate_assumptions','estimate_assumption_variance','production','change_orders','job_cost_depth','jobs']),
      completed_invoiced_cash_conversion:buildManagementMetricConfidence(sourceFreshness,['production','closeouts','invoice_candidates','receivables','payment_applications']),
      utilization_support:buildManagementMetricConfidence(sourceFreshness,['timekeeping_detail','production','dispatch','equipment','equipment_use','maintenance','fleet']),
      labour_capture_payroll_exceptions:buildManagementMetricConfidence(sourceFreshness,['timekeeping_detail','production','dispatch']),
      equipment_downtime_replacement_readiness:buildManagementMetricConfidence(sourceFreshness,['equipment','maintenance','equipment_use','fleet','maintenance_history','equipment_service_tasks','fleet_downtime_events']),
      stock_readiness:buildManagementMetricConfidence(sourceFreshness,['material_stock','material_plans','dispatch','recurring_visits','seasonal_work']),
      material_usage_variance_reorder_calibration:buildManagementMetricConfidence(sourceFreshness,['material_stock','material_plans','material_actual_use']),
      communication_readiness:buildManagementMetricConfidence(sourceFreshness,['workability','dispatch','recurring_visits','crm_interactions','crm_followups','crm_customers','notification_delivery','closeouts','receivables']),
      communication_outcomes:buildManagementMetricConfidence(sourceFreshness,['crm_interactions','crm_followups','notification_delivery','closeouts']),
      data_quality_reconciliation:buildManagementMetricConfidence(sourceFreshness,['crm_customers','crm_properties','jobs','dispatch','recurring','crews','equipment','routes','workability','material_plans']),
      data_quality_remediation_outcomes:buildManagementMetricConfidence(sourceFreshness,['crm_customers','crm_properties','jobs','dispatch','recurring','crews','equipment','routes','workability','material_plans','management_decision_outcomes']),
      workability_schedule_recovery:buildManagementMetricConfidence(sourceFreshness,['workability','dispatch','production']),
      management_outcome_confidence_cohort_trend:buildManagementMetricConfidence(sourceFreshness,['management_decision_outcomes']),
      four_season_capacity_profitability_scenarios:buildManagementMetricConfidence(sourceFreshness,canFinanceView?['dispatch','recurring_visits','crews','equipment','workability','storms','storm_routes','seasonal_work','routes','production','material_stock','material_plans','profitability','agreement_profitability']:['dispatch','recurring_visits','crews','equipment','workability','storms','storm_routes','seasonal_work','routes','production','material_stock','material_plans'])
    };
    const managementOutcomeConfidenceCohortTrend=buildManagementOutcomeConfidenceCohortTrend(
      managementDecisionOutcomes,sourceFreshness.management_decision_outcomes,canAdminManage
    );
    const fourSeasonCapacityForecast=buildFourSeasonCapacityForecast({
      dispatch,visits:recurringVisits,crews,equipment,workability,storms,stormRoutes,seasonalWork
    });
    const workabilityScheduleRecoveryOutcomes=buildWorkabilityScheduleRecoveryOutcomes({
      workability,dispatch,production,jobsVisible:canJobsView,
      sourceQueriesOk:[workabilityRead,dispatchRead,productionRead].every((r)=>r.query_ok!==false)
    });
    const routeCrewEfficiencyEvidence=buildRouteCrewEfficiencyEvidence({
      dispatch,production,timekeeping:timekeepingDetail,workability,routes
    });
    const routePlanActualStopSequenceLearning=buildRoutePlanActualStopSequenceLearning(routeCrewEfficiencyEvidence);
    const recurringRenewalRetentionWorkbench=buildRecurringRenewalRetentionWorkbench({
      programs:recurring,events:recurringEvents,renewals:crmRenewals,interactions:crmInteractions,
      profitability:agreementProfitability,rollovers:seasonalRollover,financeVisible:canFinanceView
    });
    const recurringRenewalConversionChurnOutcomes=buildRecurringRenewalConversionChurnOutcomes({
      programs:recurring,renewals:crmRenewals,interactions:crmInteractions,rollovers:seasonalRollover,
      profitability:agreementProfitability,financeVisible:canFinanceView,
      sourceQueriesOk:[recurringRead,crmRenewalsRead,crmInteractionsRead,seasonalRolloverRead].every((r)=>r.query_ok!==false)
    });
    const estimateToCashLeakageWorkbench=buildEstimateToCashLeakageWorkbench({
      workflows:estimateWorkflow,dispatch,production,changeOrders,receivables,paymentApplications,
      profitability,jobs,jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[estimateWorkflowRead,dispatchRead,productionRead,changeOrdersRead,receivablesRead,paymentApplicationsRead,profitabilityRead].every((r)=>r.query_ok!==false)
    });
    const estimateAccuracyChangeOrderMarginCalibration=buildEstimateAccuracyChangeOrderCalibration({
      workflows:estimateWorkflow,assumptions:estimateAssumptions,assumptionVariance:estimateAssumptionVariance,
      production,changeOrders,jobCosts:jobCostDepth,jobs,jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[estimateWorkflowRead,estimateAssumptionsRead,estimateAssumptionVarianceRead,productionRead,changeOrdersRead,jobCostDepthRead,jobsRead].every((r)=>r.query_ok!==false)
    });
    const completedToInvoicedCashConversion=buildCompletedToInvoicedCashConversion({
      workflows:estimateWorkflow,production,closeouts,invoiceCandidates,receivables,paymentApplications,
      jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[estimateWorkflowRead,productionRead,closeoutsRead,invoiceCandidatesRead,receivablesRead,paymentApplicationsRead].every((r)=>r.query_ok!==false)
    });
    const labourEquipmentFleetUtilizationSupport=buildLabourEquipmentFleetUtilizationDecisionSupport({
      timekeeping:timekeepingDetail,production,dispatch,equipment,equipmentUse,maintenance,fleet,
      jobsVisible:canJobsView,adminVisible:canAdminManage,
      sourceQueriesOk:[timekeepingDetailRead,productionRead,dispatchRead,equipmentRead,equipmentUseRead,maintenanceRead,fleetRead].every((r)=>r.query_ok!==false)
    });
    const equipmentDowntimeCostReplacementReadiness=buildEquipmentDowntimeCostReplacementReadiness({
      equipment,maintenance,maintenanceHistory,serviceTasks,equipmentUse,fleet,downtimeEvents:fleetDowntimeEvents,jobCosts:jobCostDepth,
      jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[equipmentRead,maintenanceRead,maintenanceHistoryRead,serviceTasksRead,equipmentUseRead,fleetRead,fleetDowntimeEventsRead].every((r)=>r.query_ok!==false)&&(!canFinanceView||jobCostDepthRead.query_ok!==false)
    });
    const labourCapturePayrollExceptionReduction=buildLabourCapturePayrollExceptionReduction({
      timekeeping:timekeepingDetail,dispatch,production,jobsVisible:canJobsView,adminVisible:canAdminManage,
      sourceQueriesOk:[timekeepingDetailRead,dispatchRead,productionRead].every((r)=>r.query_ok!==false)
    });
    const materialsConsumablesSeasonalStockReadiness=buildMaterialsConsumablesSeasonalStockReadiness({
      materials:materialStock,materialPlans,dispatch,recurringVisits,seasonalWork,jobsVisible:canJobsView,
      sourceQueriesOk:[materialStockRead,materialPlansRead,dispatchRead,recurringVisitsRead,seasonalWorkRead].every((r)=>r.query_ok!==false)
    });
    const materialUsageVarianceReorderCalibration=buildMaterialUsageVarianceReorderCalibration({
      materialPlans,actualUse:materialActualUse,materials:materialStock,jobsVisible:canJobsView,
      sourceQueriesOk:[materialStockRead,materialPlansRead,materialActualUseRead].every((r)=>r.query_ok!==false)
    });
    const customerCommunicationReadinessQueue=buildCustomerCommunicationReadinessQueue({
      workability,dispatch,recurringVisits,closeouts,crmFollowups,crmInteractions,customerDirectory,notificationQueue,receivables,
      jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:[workabilityRead,dispatchRead,recurringVisitsRead,closeoutsRead,crmFollowupsRead,crmInteractionsRead,customerDirectoryRead,notificationQueueRead,receivablesRead].every((r)=>r.query_ok!==false)
    });
    const customerCommunicationOutcomeFollowUpEffectiveness=buildCustomerCommunicationOutcomeFollowUpEffectiveness({
      interactions:crmInteractions,followups:crmFollowups,notificationQueue,closeouts,jobsVisible:canJobsView,
      sourceQueriesOk:[crmInteractionsRead,crmFollowupsRead,notificationQueueRead,closeoutsRead].every((r)=>r.query_ok!==false)
    });
    const fourSeasonScenarioReads=[dispatchRead,recurringVisitsRead,crewsRead,equipmentRead,workabilityRead,stormsRead,stormRoutesRead,seasonalWorkRead,routesRead,productionRead,materialStockRead,materialPlansRead,recurringRead];
    if(canFinanceView){fourSeasonScenarioReads.push(profitabilityRead,agreementProfitabilityRead)}
    const fourSeasonCapacityProfitabilityScenarioEvidence=buildFourSeasonCapacityProfitabilityScenarioEvidence({
      dispatch,recurringVisits,profitability,capacityForecast:fourSeasonCapacityForecast,routeEfficiency:routeCrewEfficiencyEvidence,
      workabilityRecovery:workabilityScheduleRecoveryOutcomes,stockReadiness:materialsConsumablesSeasonalStockReadiness,
      recurringWorkbench:recurringRenewalRetentionWorkbench,jobsVisible:canJobsView,financeVisible:canFinanceView,
      sourceQueriesOk:fourSeasonScenarioReads.every((r)=>r.query_ok!==false),
      coverageComplete:fourSeasonScenarioReads.every((r)=>r.query_ok!==false&&Number(r.row_count||0)<Number(r.limit||1))
    });
    const dataQualityReferenceReads=[customerDirectoryRead,propertyDirectoryRead,jobsRead,dispatchRead,recurringRead,crewsRead,equipmentRead,routesRead];
    const dataQualityDuplicateOrphanReconciliation=buildDataQualityDuplicateOrphanReconciliation({
      customers:customerDirectory,properties:propertyDirectory,jobs,dispatch,recurring,crews,equipment,routes,workability,materialPlans,
      jobsVisible:canJobsView,
      sourceQueriesOk:[...dataQualityReferenceReads,workabilityRead,materialPlansRead].every((r)=>r.query_ok!==false),
      referenceCoverageComplete:dataQualityReferenceReads.every((r)=>r.query_ok!==false&&Number(r.row_count||0)<Number(r.limit||1))
    });
    const dataQualityOutcomeReads=[...dataQualityReferenceReads,workabilityRead,materialPlansRead];
    const dataQualityRemediationOutcomeRecurrence=buildDataQualityRemediationOutcomeRecurrence({
      reconciliation:dataQualityDuplicateOrphanReconciliation,journal:managementDecisionOutcomes,
      sourceQueriesOk:dataQualityOutcomeReads.every((r)=>r.query_ok!==false)&&managementDecisionOutcomesRead.query_ok!==false,
      coverageComplete:dataQualityOutcomeReads.every((r)=>r.query_ok!==false&&Number(r.row_count||0)<Number(r.limit||1)),
      adminVisible:canAdminManage
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
      owner_equipment_use:equipmentUse,owner_fleet:fleet,owner_material_stock:materialStock,owner_material_plans:materialPlans,
      owner_crm_followups:crmFollowups,owner_notification_delivery:notificationQueue,owner_closeouts:closeouts,owner_crm_properties:propertyDirectory,
      source_visibility:{jobs:canJobsView,finance:canFinanceView,safety:canSafetyView,admin:canAdminManage},
      source_freshness:sourceFreshness,
      management_metric_confidence:metricConfidence,
      management_outcome_confidence_cohort_trend:managementOutcomeConfidenceCohortTrend,
      four_season_capacity_forecast:fourSeasonCapacityForecast,
      workability_schedule_recovery_outcomes:workabilityScheduleRecoveryOutcomes,
      route_crew_efficiency_evidence:routeCrewEfficiencyEvidence,
      route_plan_actual_stop_sequence_learning:routePlanActualStopSequenceLearning,
      recurring_renewal_retention_workbench:recurringRenewalRetentionWorkbench,
      recurring_renewal_conversion_churn_outcomes:recurringRenewalConversionChurnOutcomes,
      estimate_to_cash_leakage_workbench:estimateToCashLeakageWorkbench,
      estimate_accuracy_change_order_margin_calibration:estimateAccuracyChangeOrderMarginCalibration,
      completed_to_invoiced_cycle_time_cash_conversion:completedToInvoicedCashConversion,
      labour_equipment_fleet_utilization_support:labourEquipmentFleetUtilizationSupport,
      labour_capture_completeness_payroll_exception_reduction:labourCapturePayrollExceptionReduction,
      equipment_downtime_cost_replacement_readiness:equipmentDowntimeCostReplacementReadiness,
      materials_consumables_seasonal_stock_readiness:materialsConsumablesSeasonalStockReadiness,
      material_usage_variance_reorder_calibration:materialUsageVarianceReorderCalibration,
      customer_communication_readiness_queue:customerCommunicationReadinessQueue,
      customer_communication_outcome_followup_effectiveness:customerCommunicationOutcomeFollowUpEffectiveness,
      data_quality_duplicate_orphan_reconciliation:dataQualityDuplicateOrphanReconciliation,
      data_quality_remediation_outcome_recurrence:dataQualityRemediationOutcomeRecurrence,
      four_season_capacity_profitability_scenario_evidence:fourSeasonCapacityProfitabilityScenarioEvidence,
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
