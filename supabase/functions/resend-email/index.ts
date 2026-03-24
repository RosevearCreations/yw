
// Detailed Edge Function: resend-email
// Purpose:
// - Create a new submission record
// - Attach sign-off metadata when submitted by a supervisor/site leader/HSE/job admin/admin
// - Queue admin notifications for records requiring admin review
// - Insert toolbox attendee rows when needed

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
  const formType = body.formType;
  const payload = body.payload || {};
  const siteText = String(payload.site || '');
  const requiresAdminReview = roleRank(actorProfile.role) >= roleRank('site_leader');

  let siteId = payload.site_id || null;
  if (!siteId && siteText) {
    const code = siteText.split('—')[0].trim();
    const { data: site } = await supabase.from('sites').select('id').or(`site_code.eq.${code},site_name.eq.${siteText}`).maybeSingle();
    siteId = site?.id || null;
  }

  const submissionRow: Record<string, unknown> = {
    site: siteText,
    site_id: siteId,
    form_type: formType,
    submission_date: payload.date || new Date().toISOString().slice(0,10),
    submitted_by: payload.submitted_by || payload.checked_by || payload.inspector || payload.supervisor || actorProfile.full_name || actorProfile.email,
    submitted_by_profile_id: actorProfile.id,
    payload,
    status: requiresAdminReview ? 'under_review' : 'submitted',
    requires_admin_review: requiresAdminReview,
    signed_off_by_profile_id: requiresAdminReview ? actorProfile.id : null,
    signed_off_by_name: requiresAdminReview ? (actorProfile.full_name || actorProfile.email) : null,
    signed_off_role: requiresAdminReview ? actorProfile.role : null,
    signed_off_at: requiresAdminReview ? new Date().toISOString() : null,
  };

  const { data: submission, error: submissionError } = await supabase.from('submissions').insert(submissionRow).select('*').single();
  if (submissionError) return Response.json({ ok:false, error:submissionError.message }, { status:500, headers:corsHeaders });

  if (formType === 'E' && Array.isArray(payload.attendees) && payload.attendees.length) {
    const attendeeRows = payload.attendees.map((a:any) => ({
      submission_id: submission.id,
      name: a.name,
      role: a.role_on_site || a.role || null,
      company: a.company || null,
    }));
    await supabase.from('toolbox_attendees').insert(attendeeRows);
  }

  if (requiresAdminReview) {
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'admin');
    const noteRows = (admins || []).map((admin:any) => ({
      notification_type: 'submission_signed_off',
      submission_id: submission.id,
      site_id: siteId,
      created_by_profile_id: actorProfile.id,
      actor_name: actorProfile.full_name || actorProfile.email,
      actor_role: actorProfile.role,
      target_profile_id: admin.id,
      title: 'Supervisor sign-off submitted',
      body: `${actorProfile.full_name || actorProfile.email} submitted ${formType} for admin review.`,
      payload: { formType, site: siteText }
    }));
    if (noteRows.length) await supabase.from('admin_notifications').insert(noteRows.map((row:any) => ({...row, recipient_role: 'admin', status: 'queued', email_subject: row.title || row.subject || 'Notification', message: row.body || row.message || '' })));
  }

  return Response.json({ ok:true, id: submission.id, record: submission }, { headers:corsHeaders });
});
