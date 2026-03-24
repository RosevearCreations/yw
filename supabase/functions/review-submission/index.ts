
// Detailed Edge Function: review-submission
// Purpose:
// - Write review history
// - Update submission status/admin notes
// - Queue admin notifications when supervisor-level reviews escalate a record

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
  if (!actorProfile?.is_active || roleRank(actorProfile.role) < roleRank('site_leader')) {
    return Response.json({ ok:false, error:'Site leader or higher required' }, { status:403, headers:corsHeaders });
  }

  const body = await req.json();
  const submissionId = body.submission_id;
  const action = body.action || 'commented';
  const status = body.status || null;
  const note = body.note || null;
  const adminNotes = body.admin_notes || null;

  const { error: reviewError } = await supabase.from('submission_reviews').insert({
    submission_id: submissionId,
    reviewer_id: actorProfile.id,
    action,
    note,
  });
  if (reviewError) return Response.json({ ok:false, error:reviewError.message }, { status:500, headers:corsHeaders });

  const patch: Record<string, unknown> = {
    reviewed_by: actorProfile.full_name || actorProfile.email,
    reviewed_at: new Date().toISOString(),
  };
  if (status) patch.status = status;
  if (adminNotes !== null) patch.admin_notes = adminNotes;
  const { data: submission, error: submissionError } = await supabase.from('submissions').update(patch).eq('id', submissionId).select('*').single();
  if (submissionError) return Response.json({ ok:false, error:submissionError.message }, { status:500, headers:corsHeaders });

  if (roleRank(actorProfile.role) >= roleRank('supervisor') && (status === 'follow_up_required' || status === 'under_review')) {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'admin');
    const noteRows = (admins || []).map((admin:any) => ({
      notification_type: 'submission_reviewed',
      submission_id: submission.id,
      site_id: submission.site_id,
      created_by_profile_id: actorProfile.id,
      actor_name: actorProfile.full_name || actorProfile.email,
      actor_role: actorProfile.role,
      target_profile_id: admin.id,
      title: 'Submission review update',
      body: `${actorProfile.full_name || actorProfile.email} marked submission ${submission.id} as ${status}.`,
      payload: { action, status }
    }));
    if (noteRows.length) await supabase.from('admin_notifications').insert(noteRows.map((row:any) => ({...row, recipient_role: 'admin', status: 'queued', email_subject: row.title || row.subject || 'Notification', message: row.body || row.message || '' })));
  }

  return Response.json({ ok:true, record: submission }, { headers:corsHeaders });
});
