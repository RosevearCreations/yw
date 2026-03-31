// Detailed Edge Function: reference-data
// Purpose:
// - Return populated site, supervisor, admin, employee, position, and trade lists for the frontend.
// - Scope results based on the signed-in user's role and site assignments.

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

  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const { data: myAssignments } = await supabase.from('site_assignments').select('site_id').eq('profile_id', actorProfile.id);
  const mySiteIds = (myAssignments || []).map((x:any) => x.site_id);
  const broad = roleRank(actorProfile.role) >= roleRank('supervisor');

  let sitesQuery = supabase.from('sites').select('id,site_code,site_name,project_code,project_status,region').eq('is_active', true).order('site_code');
  if (!broad && mySiteIds.length) sitesQuery = sitesQuery.in('id', mySiteIds);
  const { data: sites } = await sitesQuery;

  let peopleQuery = supabase.from('v_people_directory').select('*').eq('is_active', true).order('full_name');
  if (!broad) {
    const { data: assignedProfiles } = await supabase.from('site_assignments').select('profile_id').in('site_id', mySiteIds.length ? mySiteIds : ['00000000-0000-0000-0000-000000000000']);
    const ids = [...new Set((assignedProfiles || []).map((x:any) => x.profile_id).concat([actorProfile.id]))];
    peopleQuery = peopleQuery.in('id', ids);
  }
  const { data: people } = await peopleQuery;

  const list = (people || []).map((p:any) => ({ ...p, display_name: p.full_name || p.email }));
  const supervisors = list.filter((p:any) => roleRank(p.role) >= roleRank('site_leader') && roleRank(p.role) < roleRank('admin'));
  const admins = list.filter((p:any) => p.role === 'admin');
  const employees = list;

  const { data: positions } = await supabase.from('position_catalog').select('name,sort_order').eq('is_active', true).order('sort_order');
  const { data: trades } = await supabase.from('trade_catalog').select('name,sort_order').eq('is_active', true).order('sort_order');

  return Response.json({ ok:true, sites: sites || [], supervisors, admins, employees, positions: positions || [], trades: trades || [] }, { headers:corsHeaders });
});
