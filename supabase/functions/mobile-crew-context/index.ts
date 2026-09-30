import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { accessAtLeast, effectiveModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOBILE_BUSINESS_READ_BUDGET_MAX = 13;
const MOBILE_PERMISSION_EVALUATION_BUDGET_MAX = 2;
const MOBILE_READ_ROUND_BUDGET_MAX = 4;
const MOBILE_PAYLOAD_BUDGET_BYTES = 180000;

function normalizeRole(value: unknown) {
  const clean = String(value || "employee").trim().toLowerCase();
  if (clean === "worker" || clean === "staff") return "employee";
  return clean || "employee";
}
function roleRank(value: unknown) {
  return ({ employee:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 } as Record<string,number>)[normalizeRole(value)] || 0;
}
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}
function containsProfile(value: unknown, profileId: string) {
  return asArray(value).some((item: any) => String(typeof item === "object" ? (item?.profile_id || item?.id || "") : item) === profileId);
}
function uniq(values: unknown[]) {
  return [...new Set(values.map((value) => String(value || "")).filter(Boolean))];
}
async function safeRows(query: any) {
  try {
    const { data, error } = await query;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
async function inRows(supabase: any, table: string, select: string, column: string, ids: string[]) {
  if (!ids.length) return [];
  return safeRows(supabase.from(table).select(select).in(column, ids));
}
function indexBy(rows: any[], key = "id") {
  const map = new Map<string, any>();
  rows.forEach((row) => { const id = String(row?.[key] || ""); if (id) map.set(id, row); });
  return map;
}
function groupBy(rows: any[], key: string) {
  const map = new Map<string, any[]>();
  rows.forEach((row) => {
    const id = String(row?.[key] || "");
    if (!id) return;
    const list = map.get(id) || [];
    list.push(row);
    map.set(id, list);
  });
  return map;
}
function latest(rows: any[], field = "updated_at") {
  return [...rows].sort((a,b) => String(b?.[field] || "").localeCompare(String(a?.[field] || "")))[0] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ ok:false, error:"POST required." }, { status:405, headers:corsHeaders });

  try {
    const supabase = createClient(
      (Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL"))!,
      (Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ ok:false, error:"Unauthorized" }, { status:401, headers:corsHeaders });
    const { data:userData, error:userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id) return Response.json({ ok:false, error:"Unauthorized" }, { status:401, headers:corsHeaders });

    const { data:profile } = await supabase.from("profiles").select("id,full_name,email,role,is_active").eq("id", user.id).maybeSingle();
    if (!profile?.id || profile.is_active === false) return Response.json({ ok:false, error:"Inactive profile" }, { status:403, headers:corsHeaders });

    const body = await req.json().catch(() => ({}));
    const requestedDays = Math.max(1, Math.min(14, Number(body?.days || 7)));
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + requestedDays * 24 * 60 * 60 * 1000).toISOString();

    // Build 361: resolve each permission domain once, in parallel with the assignment membership read.
    // Jobs access is reused for view/create/approve capability derivation instead of issuing repeated RPC checks.
    const [jobsAccess, safetyAccess, memberships] = await Promise.all([
      effectiveModuleAccess(supabase, profile, "jobs"),
      effectiveModuleAccess(supabase, profile, "safety"),
      safeRows(supabase.from("crew_members").select("crew_id,member_role,is_primary").eq("profile_id", profile.id))
    ]);
    if (!accessAtLeast(jobsAccess, "view")) {
      return Response.json({ ok:false, error:"Jobs module view access is required." }, { status:403, headers:corsHeaders });
    }

    const crewIds = uniq(memberships.map((row) => row.crew_id));
    const candidateDispatch = await safeRows(
      supabase.from("dispatch_schedule_items")
        .select("id,work_order_id,job_id,schedule_status,scheduled_start,scheduled_end,assigned_supervisor_profile_id,assigned_crew_profile_ids,route_id,dispatch_notes,crew_id,lead_profile_id,client_site_id,estimated_duration_minutes,travel_allowance_minutes,route_order,assigned_truck_equipment_item_id,assigned_trailer_equipment_item_id,assigned_equipment_item_ids,workability_state,weather_summary")
        .gte("scheduled_start", from).lt("scheduled_start", to)
        .not("schedule_status", "in", "(cancelled,superseded)")
        .order("scheduled_start", { ascending:true }).limit(300)
    );

    const assignedDispatch = candidateDispatch.filter((row:any) =>
      String(row.lead_profile_id || "") === profile.id ||
      String(row.assigned_supervisor_profile_id || "") === profile.id ||
      containsProfile(row.assigned_crew_profile_ids, profile.id) ||
      crewIds.includes(String(row.crew_id || ""))
    );

    const workOrderIds = uniq(assignedDispatch.map((row) => row.work_order_id));
    const jobIds = uniq(assignedDispatch.map((row) => row.job_id));
    const siteIds = uniq(assignedDispatch.map((row) => row.client_site_id));
    const routeIds = uniq(assignedDispatch.map((row) => row.route_id));

    // Build 361: one bounded related-source fan-out. Route metadata, live-update history and
    // full evidence histories are not needed to render the field cards, so they are not read.
    // Production/evidence collections are reduced to IDs/counts instead of returning large histories.
    const [workOrders,jobs,sites,routeStops,sessions,materials,proofs,closeouts,signouts,quantities] = await Promise.all([
      inRows(supabase,"work_orders","id,work_order_number,client_site_id,legacy_job_id,work_type,status,scheduled_start,route_id", "id", workOrderIds),
      jobIds.length ? safeRows(supabase.from("jobs").select("id,job_code,job_name,status,priority").in("id", jobIds.map(Number))) : [],
      inRows(supabase,"client_sites","id,site_code,site_name,service_address,city,access_notes,hazard_notes,gate_fence_summary,parking_trailer_limits,pet_notes,slope_notes,drainage_wet_area_notes,utility_locate_notes,tree_brush_notes,recurring_property_instructions", "id", siteIds),
      routeIds.length && siteIds.length ? safeRows(supabase.from("route_stops").select("id,route_id,client_site_id,stop_order").in("route_id", routeIds).in("client_site_id", siteIds).eq("is_active", true)) : [],
      inRows(supabase,"job_sessions","id,work_order_id,session_status,started_at,ended_at,completion_state,updated_at", "work_order_id", workOrderIds),
      inRows(supabase,"material_issues","id,work_order_id", "work_order_id", workOrderIds),
      inRows(supabase,"work_order_execution_proofs","id,work_order_id", "work_order_id", workOrderIds),
      inRows(supabase,"work_order_closeout_packages","id,work_order_id,closeout_status,updated_at", "work_order_id", workOrderIds),
      inRows(supabase,"equipment_signouts","id,equipment_item_id,work_order_id", "work_order_id", workOrderIds),
      inRows(supabase,"job_session_production_quantities","id,work_order_id", "work_order_id", workOrderIds)
    ]);

    const equipmentIds = uniq(assignedDispatch.flatMap((row:any) => [
      row.assigned_truck_equipment_item_id,
      row.assigned_trailer_equipment_item_id,
      ...asArray(row.assigned_equipment_item_ids).map((item:any) => typeof item === "object" ? (item?.equipment_item_id || item?.id) : item)
    ]));
    signouts.forEach((row:any) => { if (row.equipment_item_id) equipmentIds.push(String(row.equipment_item_id)); });
    const equipment = equipmentIds.length ? await safeRows(
      supabase.from("equipment_items")
        .select("id,equipment_code,equipment_name,status,defect_status,is_locked_out")
        .in("id", uniq(equipmentIds).map(Number))
    ) : [];

    const byWorkOrder = {
      sessions: groupBy(sessions,"work_order_id"),
      quantities: groupBy(quantities,"work_order_id"),
      materials: groupBy(materials,"work_order_id"),
      proofs: groupBy(proofs,"work_order_id"),
      closeouts: groupBy(closeouts,"work_order_id"),
      signouts: groupBy(signouts,"work_order_id")
    };
    const workOrderById=indexBy(workOrders), jobById=indexBy(jobs), siteById=indexBy(sites);
    const equipmentById=indexBy(equipment);
    const routeStopByKey = new Map<string,any>();
    routeStops.forEach((row:any) => routeStopByKey.set(`${String(row?.route_id || "")}:${String(row?.client_site_id || "")}`, row));

    const rank = roleRank(profile.role);
    const jobsCreate = accessAtLeast(jobsAccess, "create");
    const jobsApprove = accessAtLeast(jobsAccess, "approve");
    const safetyCreate = accessAtLeast(safetyAccess, "create");

    const myJobs = assignedDispatch.map((dispatch:any) => {
      const workOrderId=String(dispatch.work_order_id || "");
      const workOrder=workOrderById.get(workOrderId) || null;
      const job=jobById.get(String(dispatch.job_id || workOrder?.legacy_job_id || "")) || null;
      const siteId=String(dispatch.client_site_id || workOrder?.client_site_id || "");
      const site=siteById.get(siteId) || null;
      const routeId=String(dispatch.route_id || workOrder?.route_id || "");
      const stop=routeStopByKey.get(`${routeId}:${siteId}`) || null;
      const workSessions=byWorkOrder.sessions.get(workOrderId) || [];
      const latestSession=latest(workSessions);
      const workQuantities=byWorkOrder.quantities.get(workOrderId) || [];
      const workMaterials=byWorkOrder.materials.get(workOrderId) || [];
      const workProofs=byWorkOrder.proofs.get(workOrderId) || [];
      const workCloseouts=byWorkOrder.closeouts.get(workOrderId) || [];
      const workSignouts=byWorkOrder.signouts.get(workOrderId) || [];
      const assignedEquipmentIds=uniq([
        dispatch.assigned_truck_equipment_item_id,dispatch.assigned_trailer_equipment_item_id,
        ...asArray(dispatch.assigned_equipment_item_ids).map((item:any)=>typeof item==="object"?(item?.equipment_item_id||item?.id):item),
        ...workSignouts.map((row:any)=>row.equipment_item_id)
      ]);
      return {
        dispatch,
        work_order:workOrder,
        job,
        site,
        route: stop ? { stop } : null,
        latest_session:latestSession,
        production:{ session_count:workSessions.length, quantity_count:workQuantities.length, material_issue_count:workMaterials.length },
        evidence:{ proof_count:workProofs.length },
        closeout:latest(workCloseouts),
        equipment:assignedEquipmentIds.map((id)=>equipmentById.get(String(id))).filter(Boolean)
      };
    });

    const payload:any = {
      ok:true, build:326, schema:215,
      profile:{ id:profile.id, full_name:profile.full_name, role:normalizeRole(profile.role) },
      window:{ from,to,days:requestedDays },
      capabilities:{
        jobs_view:true,
        time_clock:true,
        safety_create:!!safetyCreate,
        equipment_scan:!!jobsCreate,
        live_update:!!jobsCreate && rank>=20,
        production_capture:!!jobsCreate && rank>=20,
        execution_proof:!!jobsCreate && rank>=20,
        deficiency_rework:!!jobsCreate && rank>=20,
        closeout_request:!!jobsApprove && rank>=30,
        customer_signoff_review:!!jobsApprove && rank>=30
      },
      my_jobs:myJobs,
      my_route:[...myJobs].sort((a:any,b:any)=>{
        const at=String(a?.dispatch?.scheduled_start||""); const bt=String(b?.dispatch?.scheduled_start||"");
        if(at!==bt) return at.localeCompare(bt);
        return Number(a?.dispatch?.route_order||a?.route?.stop?.stop_order||9999)-Number(b?.dispatch?.route_order||b?.route?.stop?.stop_order||9999);
      }),
      meta:{
        assignment_filtered:true,
        finance_exposed:false,
        optimization_build:361,
        payload_contract:"mobile_summary_v361",
        canonical_authorities:["dispatch_schedule_items","client_sites","job_sessions","job_session_production_quantities","material_issues","equipment_signouts","work_order_live_updates","work_order_execution_proofs","work_order_closeout_packages"],
        read_budget:{
          business_read_budget_max:MOBILE_BUSINESS_READ_BUDGET_MAX,
          permission_evaluation_budget_max:MOBILE_PERMISSION_EVALUATION_BUDGET_MAX,
          read_round_budget_max:MOBILE_READ_ROUND_BUDGET_MAX,
          candidate_dispatch_limit:300,
          payload_budget_bytes:MOBILE_PAYLOAD_BUDGET_BYTES,
          payload_bytes_estimate:0,
          payload_budget_state:"within_budget"
        }
      }
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
    payload.meta.read_budget.payload_bytes_estimate = bytes;
    payload.meta.read_budget.payload_budget_state = bytes <= MOBILE_PAYLOAD_BUDGET_BYTES ? "within_budget" : "over_budget";

    return Response.json(payload, { headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:error instanceof Error ? error.message : "Mobile crew context failed." }, { status:500, headers:corsHeaders });
  }
});
