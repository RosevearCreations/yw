// Detailed Edge Function: admin-selectors
// Purpose:
// - Return profile/site/assignment selectors for admin management
// - Admins get full selector lists, supervisor+ can receive read-only selector data if desired

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
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });
  if (roleRank(actorProfile.role) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const { data: profiles } = await supabase.from('profiles').select('id,email,full_name,role,is_active').order('email');
  const { data: sites } = await supabase.from('sites').select('id,site_code,site_name,is_active').order('site_code');
  const { data: assignments } = await supabase
    .from('site_assignments')
    .select('id,site_id,profile_id,assignment_role,is_primary, profiles(email,full_name), sites(site_code,site_name)');

  return Response.json({ ok:true, profiles: profiles || [], sites: sites || [], assignments: assignments || [] }, { headers: corsHeaders });
});
