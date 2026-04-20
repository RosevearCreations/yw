// Edge Function: service-execution-scheduler
// Purpose:
// - Process service-session execution candidates for recurring agreements
// - Create planned job_sessions for linked jobs when due
// - Be callable by an authenticated admin now and schedulable later

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-schedule-secret",
};

function makeRunCode() {
  return `SCH-${new Date().toISOString().replaceAll(/[-:TZ.]/g, '').slice(0, 14)}`;
}

async function recordSiteActivity(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from('site_activity_events').insert({
      event_type: payload.event_type || 'service_execution_candidate',
      entity_type: payload.entity_type || 'job_session',
      entity_id: payload.entity_id || null,
      severity: payload.severity || 'info',
      title: payload.title || 'Service execution scheduler event',
      summary: payload.summary || null,
      metadata: payload.metadata || {},
      related_job_id: payload.related_job_id || null,
      related_profile_id: payload.related_profile_id || null,
      created_by_profile_id: payload.created_by_profile_id || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
    });
  } catch {
    // ignore activity insert failures
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const schedulerSecret = String(req.headers.get('x-schedule-secret') || '');
  const expectedSecret = String(Deno.env.get('SERVICE_SCHEDULER_SECRET') || '');
  let actorId: string | null = null;

  if (expectedSecret && schedulerSecret && schedulerSecret === expectedSecret) {
    actorId = null;
  } else {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
    const { data: actorProfile } = await supabase.from('profiles').select('id,is_active,role').eq('id', userData.user.id).single();
    if (!actorProfile?.is_active || actorProfile.role !== 'admin') return Response.json({ ok:false, error:'Admin role required' }, { status:403, headers:corsHeaders });
    actorId = actorProfile.id;
  }

  const body = await req.json().catch(() => ({}));
  const agreementId = body?.agreement_id || null;
  let query = supabase.from('v_service_agreement_execution_candidates').select('*').eq('candidate_kind', 'service_session').eq('scheduler_ready', true).order('candidate_date', { ascending: true }).limit(100);
  if (agreementId) query = query.eq('id', agreementId);
  const { data: candidates, error: candidateError } = await query;
  if (candidateError) return Response.json({ ok:false, error: candidateError.message }, { status:500, headers:corsHeaders });

  const runPatch = {
    run_code: makeRunCode(),
    run_status: 'running',
    candidate_count: Array.isArray(candidates) ? candidates.length : 0,
    sessions_created_count: 0,
    invoices_created_count: 0,
    notes: agreementId ? `Scheduler run for agreement ${agreementId}` : 'Scheduler run for due service-session candidates',
    created_by_profile_id: actorId,
    ran_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: runRow, error: runError } = await supabase.from('service_execution_scheduler_runs').insert(runPatch).select('*').single();
  if (runError) return Response.json({ ok:false, error: runError.message }, { status:500, headers:corsHeaders });

  const createdSessions: any[] = [];
  const skipped: any[] = [];
  try {
    for (const candidate of candidates || []) {
      if (!candidate?.job_id) {
        skipped.push({ agreement_id: candidate?.id || null, reason: 'No linked job available.' });
        continue;
      }
      const { data: existingSession } = await supabase.from('job_sessions').select('id').eq('job_id', candidate.job_id).eq('session_date', candidate.candidate_date).maybeSingle();
      if (existingSession?.id) {
        skipped.push({ agreement_id: candidate?.id || null, job_id: candidate.job_id, reason: 'Session already exists for candidate date.' });
        continue;
      }
      const { data: session, error: sessionError } = await supabase.from('job_sessions').insert({
        job_id: candidate.job_id,
        session_date: candidate.candidate_date,
        session_kind: 'agreement_service',
        session_status: 'planned',
        service_frequency_label: candidate.service_name || 'service_visit',
        notes: `Auto-created by service execution scheduler from ${candidate.agreement_code || candidate.id}`,
        created_by_profile_id: actorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (sessionError) {
        skipped.push({ agreement_id: candidate?.id || null, job_id: candidate.job_id, reason: sessionError.message });
        continue;
      }
      createdSessions.push(session);
      await recordSiteActivity(supabase, {
        event_type: 'service_execution_candidate',
        entity_type: 'job_session',
        entity_id: session.id,
        severity: 'info',
        title: 'Service session scheduled',
        summary: `${candidate.agreement_code || candidate.id} created a planned session for ${candidate.candidate_date}.`,
        related_job_id: candidate.job_id,
        created_by_profile_id: actorId,
      });
    }

    const finalStatus = skipped.length ? 'completed_with_warnings' : 'completed';
    const { data: finalRun, error: finalError } = await supabase.from('service_execution_scheduler_runs').update({
      run_status: finalStatus,
      sessions_created_count: createdSessions.length,
      notes: skipped.length ? `${runPatch.notes} ${skipped.length} candidate(s) skipped.` : runPatch.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', runRow.id).select('*').single();
    if (finalError) throw finalError;

    return Response.json({ ok:true, record: finalRun, created_sessions: createdSessions, skipped }, { headers:corsHeaders });
  } catch (err) {
    await supabase.from('service_execution_scheduler_runs').update({ run_status:'failed', last_error:String(err?.message || err), updated_at:new Date().toISOString() }).eq('id', runRow.id);
    return Response.json({ ok:false, error:String(err?.message || err), created_sessions: createdSessions, skipped }, { status:500, headers:corsHeaders });
  }
});
