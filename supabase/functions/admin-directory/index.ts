// Detailed Edge Function: admin-directory
// Purpose:
// - self scope: current employee profile only
// - crew scope: direct reports based on profile hierarchy and assignment reporting lines
// - all/users/sites/assignments/notifications scopes for admin/senior directory

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
  const { data: assignmentsRaw } = await supabase.from('v_assignments_directory').select('*');
  const people = peopleRaw || [];
  const assignments = assignmentsRaw || [];

  const directReportIds = new Set<string>();
  for (const row of people) {
    if (row.id === actorId) continue;
    if (row.default_supervisor_profile_id === actorId || row.override_supervisor_profile_id === actorId) directReportIds.add(String(row.id));
    if ((actorProfile.role === 'admin' || actorProfile.role === 'job_admin' || actorProfile.role === 'hse') && (row.default_admin_profile_id === actorId || row.override_admin_profile_id === actorId)) {
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
      if (actorProfile.role === 'admin') return true;
      if (roleRank(actorProfile.role) >= roleRank('supervisor')) return row.id === actorId || directReportIds.has(String(row.id));
      return row.id === actorId;
    }
    if (scope === 'all' || scope === 'users') return roleRank(actorProfile.role) >= roleRank('supervisor');
    return true;
  }).filter((row: any) => {
    if (roleFilter && row.role !== roleFilter) return false;
    if (!search) return true;
    return [row.full_name, row.email, row.current_position, row.trade_specialty, row.phone, row.default_supervisor_name, row.default_admin_name]
      .some((v) => String(v || '').toLowerCase().includes(search));
  });

  const response: Record<string, unknown> = { ok:true, profiles: filteredPeople, users: filteredPeople };
  if ((scope === 'all' || scope === 'sites') && roleRank(actorProfile.role) >= roleRank('supervisor')) {
    const { data: sites } = await supabase.from('sites').select('*').order('site_code');
    response.sites = sites || [];
  }
  if ((scope === 'all' || scope === 'assignments') && roleRank(actorProfile.role) >= roleRank('supervisor')) {
    response.assignments = assignments;
  }
  if ((scope === 'all' || scope === 'notifications') && roleRank(actorProfile.role) >= roleRank('supervisor')) {
    let q = supabase.from('v_admin_notifications').select('*').order('created_at', { ascending:false }).limit(Math.max(1, Math.min(500, Number(body.limit || 200))));
    if (actorProfile.role !== 'admin') q = q.or(`recipient_role.eq.admin,target_profile_id.eq.${actorId}`);
    const { data: notifications } = await q;
    response.notifications = (notifications || []).filter((row: any) => {
      if (!search) return true;
      return [row.notification_type, row.title, row.message, row.status, row.decision_status, row.created_by_name].some((v) => String(v || '').toLowerCase().includes(search));
    });
  }
  if (scope === 'self') response.profile = filteredPeople[0] || null;
  return Response.json(response, { headers: corsHeaders });
});
