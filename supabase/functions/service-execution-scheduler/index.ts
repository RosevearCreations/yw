import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeRunCode() {
  return `SCH-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
  const { data: actorProfile } = await supabase.from('profiles').select('id,is_active,role').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });
  if (!['admin','supervisor'].includes(String(actorProfile.role || '').toLowerCase())) {
    return Response.json({ ok:false, error:'Supervisor or Admin role required.' }, { status:403, headers:corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const agreementId = String(body.agreement_id || '').trim() || null;
  let query = supabase.from('v_service_execution_scheduler_candidates').select('*').eq('scheduler_status', 'ready').order('candidate_date', { ascending: true });
  if (agreementId) query = query.eq('agreement_id', agreementId);
  const { data: candidates, error } = await query;
  if (error) return Response.json({ ok:false, error:error.message }, { status:500, headers:corsHeaders });

  let sessionCreatedCount = 0;
  let invoiceCandidateCount = 0;
  let skippedCount = 0;
  for (const row of candidates || []) {
    if (row.candidate_kind === 'service_session') {
      if (!row.job_id) { skippedCount += 1; continue; }
      const existing = await supabase.from('job_sessions').select('id').eq('job_id', row.job_id).eq('session_date', row.candidate_date).maybeSingle();
      if (existing.data?.id) { skippedCount += 1; continue; }
      const { data: created } = await supabase.from('job_sessions').insert({
        job_id: row.job_id,
        session_date: row.candidate_date,
        session_kind: 'scheduled_service',
        session_status: 'planned',
        service_frequency_label: row.service_name || 'scheduled_service',
        created_by_profile_id: actorProfile.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('id').single();
      if (created?.id) sessionCreatedCount += 1; else skippedCount += 1;
    } else {
      invoiceCandidateCount += 1;
    }
  }

  const payload = { agreement_id: agreementId, candidate_count: (candidates || []).length, session_created_count: sessionCreatedCount, invoice_candidate_count: invoiceCandidateCount, skipped_count: skippedCount, created_by_profile_id: actorProfile.id, run_code: makeRunCode(), run_mode: agreementId ? 'agreement_trigger' : 'manual', run_status: 'completed', payload: { candidates: candidates || [] }, updated_at: new Date().toISOString() };
  const { data: run, error: runErr } = await supabase.from('service_execution_scheduler_runs').insert(payload).select('*').single();
  if (runErr) return Response.json({ ok:false, error:runErr.message }, { status:500, headers:corsHeaders });
  await supabase.from('site_activity_events').insert({ event_type:'service_execution_scheduler_run', entity_type:'service_execution_scheduler_run', entity_id:run.id, severity:'info', title:'Service execution scheduler run completed', summary:`${sessionCreatedCount} session(s) created, ${invoiceCandidateCount} invoice candidate(s), ${skippedCount} skipped.`, created_by_profile_id: actorProfile.id, occurred_at:new Date().toISOString() }).catch(() => null);
  return Response.json({ ok:true, run, session_created_count: sessionCreatedCount, invoice_candidate_count: invoiceCandidateCount, skipped_count: skippedCount }, { headers:corsHeaders });
});
