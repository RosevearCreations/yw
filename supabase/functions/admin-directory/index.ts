// Detailed Edge Function: admin-directory
// Purpose:
// - self scope: current employee profile only
// - crew scope: supervisor/hse/job_admin/admin people list based on role visibility
// - all/users/sites/assignments scopes for admin directory

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

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  const scope = body.scope || body.mode || 'all';
  const search = String(body.search || '').trim().toLowerCase();
  const roleFilter = String(body.role_filter || body.profile_role || '').trim().toLowerCase();

  const { data: peopleRaw } = await supabase.from('v_people_directory').select('*');
  const people = (peopleRaw || []).filter((row: any) => {
    const targetRank = roleRank(row.role || 'worker');
    if (scope === 'self') return row.id === actorId;
    if (scope === 'crew') {
      if (actorProfile.role === 'admin') return true;
      if (actorProfile.role === 'supervisor') return targetRank < roleRank('supervisor');
      if (actorProfile.role === 'hse' || actorProfile.role === 'job_admin') return targetRank < roleRank('admin');
      return row.id === actorId;
    }
    if (scope === 'all' || scope === 'users') {
      return roleRank(actorProfile.role) >= roleRank('supervisor');
    }
    return true;
  }).filter((row: any) => {
    if (roleFilter && row.role !== roleFilter) return false;
    if (!search) return true;
    return [row.full_name, row.email, row.current_position, row.trade_specialty, row.phone, row.primary_site_name, row.primary_site_code]
      .some((v) => String(v || '').toLowerCase().includes(search));
  });

  const response: Record<string, unknown> = { ok:true, profiles: people };

  if ((scope === 'all' || scope === 'sites') && roleRank(actorProfile.role) >= roleRank('supervisor')) {
    const { data: sites } = await supabase.from('sites').select('*').order('site_code');
    response.sites = sites || [];
  }

  if ((scope === 'all' || scope === 'assignments') && roleRank(actorProfile.role) >= roleRank('supervisor')) {
    const { data: assignments } = await supabase
      .from('site_assignments')
      .select('id, site_id, profile_id, assignment_role, is_primary, profiles!inner(email,full_name,is_active), sites!inner(site_code,site_name)');
    response.assignments = assignments || [];
  }

  if (scope === 'self') response.profile = people[0] || null;
  return Response.json(response, { headers: corsHeaders });
});
