// Detailed Edge Function: admin-selectors
// Purpose:
// - Return profile/site/assignment selectors for admin management
// - Return operational/accounting selectors so Admin UI can manage new backbone tables

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function safeList(supabase: any, table: string, columns = '*', orderColumn?: string) {
  try {
    let q = supabase.from(table).select(columns);
    if (orderColumn) q = q.order(orderColumn);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
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
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  const actorRole = effectiveRole(actorProfile, userData.user);
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });
  if (roleRank(actorRole) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const profiles = await safeList(supabase, 'v_people_directory', 'id,email,full_name,role,is_active,default_supervisor_name,default_admin_name,staff_tier,current_position,trade_specialty', 'full_name');
  const sites = await safeList(supabase, 'sites', 'id,site_code,site_name,is_active,region,client_name,project_code,project_status', 'site_code');
  const assignments = await safeList(supabase, 'site_assignments', 'id,site_id,profile_id,assignment_role,is_primary,reports_to_supervisor_profile_id,reports_to_admin_profile_id', 'id');

  const workOrders = await safeList(supabase, 'work_orders', '*', 'work_order_number');
  const workOrderRollups = await safeList(supabase, 'v_work_order_rollups', '*', 'work_order_number');
  const linkedHsePackets = await safeList(supabase, 'linked_hse_packets', '*', 'packet_number');
  const hseProgress = await safeList(supabase, 'v_hse_packet_progress', '*', 'packet_number');
  const arInvoices = await safeList(supabase, 'ar_invoices', '*', 'invoice_number');
  const apBills = await safeList(supabase, 'ap_bills', '*', 'bill_number');
  const materialReceipts = await safeList(supabase, 'material_receipts', '*', 'receipt_number');
  const materialReceiptRollups = await safeList(supabase, 'v_material_receipt_rollups', '*', 'receipt_number');
  const accountRollups = await safeList(supabase, 'v_account_balance_rollups', '*', 'record_number');

  return Response.json({
    ok:true,
    profiles,
    sites,
    assignments,
    positions: await safeList(supabase, 'position_catalog', '*', 'sort_order'),
    trades: await safeList(supabase, 'trade_catalog', '*', 'sort_order'),
    staff_tiers: await safeList(supabase, 'staff_tier_catalog', '*', 'sort_order'),
    seniority_levels: await safeList(supabase, 'seniority_level_catalog', '*', 'sort_order'),
    employment_statuses: await safeList(supabase, 'employment_status_catalog', '*', 'sort_order'),
    job_types: await safeList(supabase, 'job_type_catalog', '*', 'sort_order'),
    units_of_measure: await safeList(supabase, 'units_of_measure', '*', 'sort_order'),
    cost_codes: await safeList(supabase, 'cost_codes', '*', 'code'),
    service_areas: await safeList(supabase, 'service_areas', '*', 'name'),
    routes: await safeList(supabase, 'routes', '*', 'name'),
    clients: await safeList(supabase, 'clients', '*', 'legal_name'),
    client_sites: await safeList(supabase, 'client_sites', '*', 'site_name'),
    materials_catalog: await safeList(supabase, 'materials_catalog', '*', 'item_name'),
    equipment_master: await safeList(supabase, 'equipment_master', '*', 'item_name'),
    estimates: await safeList(supabase, 'estimates', '*', 'estimate_number'),
    estimate_lines: await safeList(supabase, 'estimate_lines', '*', 'line_order'),
    work_orders: mergeRowsById(workOrders, workOrderRollups),
    work_order_lines: await safeList(supabase, 'work_order_lines', '*', 'line_order'),
    route_stops: await safeList(supabase, 'route_stops', '*', 'stop_order'),
    subcontract_clients: await safeList(supabase, 'subcontract_clients', '*', 'company_name'),
    subcontract_dispatches: await safeList(supabase, 'subcontract_dispatches', '*', 'dispatch_number'),
    linked_hse_packets: mergeRowsById(linkedHsePackets, hseProgress),
    chart_of_accounts: await safeList(supabase, 'chart_of_accounts', '*', 'account_number'),
    ap_vendors: await safeList(supabase, 'ap_vendors', '*', 'legal_name'),
    ar_invoices: mergeRowsById(arInvoices, (accountRollups || []).filter((row: any) => row?.record_type === 'ar_invoice')),
    ar_payments: await safeList(supabase, 'ar_payments', '*', 'payment_number'),
    ap_bills: mergeRowsById(apBills, (accountRollups || []).filter((row: any) => row?.record_type === 'ap_bill')),
    ap_payments: await safeList(supabase, 'ap_payments', '*', 'payment_number'),
    material_receipts: mergeRowsById(materialReceipts, materialReceiptRollups),
    material_receipt_lines: await safeList(supabase, 'material_receipt_lines', '*', 'line_order'),
  }, { headers: corsHeaders });
});
