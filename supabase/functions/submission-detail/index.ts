
// Detailed Edge Function: submission-detail
// Purpose:
// - Return a single submission with review history and image metadata
// - Enforce self/supervisor/admin visibility rules in one backend path

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

  const body = await req.json();
  const submissionId = body.submission_id;
  const { data: submission, error } = await supabase.from('submissions').select('*').eq('id', submissionId).single();
  if (error || !submission) return Response.json({ ok:false, error:'Submission not found' }, { status:404, headers:corsHeaders });

  const canView = roleRank(actorProfile.role) >= roleRank('supervisor') || submission.submitted_by_profile_id === actorProfile.id;
  if (!canView) return Response.json({ ok:false, error:'Not allowed to view this record' }, { status:403, headers:corsHeaders });

  const { data: reviews } = await supabase.from('submission_reviews').select('*').eq('submission_id', submissionId).order('created_at', { ascending:false });
  const { data: images } = await supabase.from('submission_images').select('*').eq('submission_id', submissionId).order('created_at', { ascending:false });

  return Response.json({ ok:true, submission, reviews: reviews || [], images: images || [] }, { headers:corsHeaders });
});
