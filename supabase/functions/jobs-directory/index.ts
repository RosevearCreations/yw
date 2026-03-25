// Detailed Edge Function: jobs-directory
// Purpose:
// - Return jobs, requirements, equipment, active signouts, notifications, and pool availability
// - Supervisor+ can use this to plan reservations and track equipment movements

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function roleRank(role: string) {
  return { worker:10, staff:15, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[role] ?? 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active || roleRank(actorProfile.role) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const { data: jobs } = await supabase.from('v_jobs_directory').select('*').order('start_date', { ascending: false });
  const { data: equipment } = await supabase.from('v_equipment_directory').select('*').order('equipment_code');
  const { data: requirements } = await supabase.from('job_equipment_requirements').select('*').order('job_id');
  const { data: signouts } = await supabase.from('equipment_signouts').select('*, equipment_items(equipment_code,equipment_name), jobs(job_code,job_name)').order('checked_out_at', { ascending:false });
  const { data: pools } = await supabase.from('v_equipment_pool_availability').select('*').order('equipment_pool_key');
  const { data: notifications } = await supabase.from('v_admin_notifications').select('*').in('notification_type', ['equipment_reservation_conflict','job_approval_requested','equipment_checkout','equipment_return','equipment_inspection','equipment_maintenance','equipment_lockout','equipment_lockout_cleared']).order('created_at', { ascending:false }).limit(150);
  const { data: inspections } = await supabase.from('v_equipment_inspection_history').select('*').order('inspected_at', { ascending:false }).limit(200);
  const { data: maintenance } = await supabase.from('v_equipment_maintenance_history').select('*').order('performed_at', { ascending:false }).limit(200);
  const signoutRows = (signouts || []).map((row: any) => ({ ...row, equipment_code: row.equipment_items?.equipment_code || null, equipment_name: row.equipment_items?.equipment_name || null, job_code: row.jobs?.job_code || null, job_name: row.jobs?.job_name || null }));
  return Response.json({ ok:true, jobs: jobs || [], equipment: equipment || [], requirements: requirements || [], signouts: signoutRows, pools: pools || [], notifications: notifications || [], inspections: inspections || [], maintenance: maintenance || [] }, { headers: corsHeaders });
});
