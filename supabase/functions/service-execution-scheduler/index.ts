import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduler-secret",
};

function makeRunCode() {
  return `SCH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function computeSchedulerNextRunAt(setting: any, base = new Date()) {
  const cadence = String(setting?.cadence || 'manual').trim().toLowerCase();
  if (!setting?.is_enabled || cadence === 'manual') return null;
  const next = new Date(base.getTime());
  if (cadence === 'hourly') {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.toISOString();
  }
  const hour = Math.max(0, Math.min(23, Number(setting?.run_hour_local ?? 0) || 0));
  const minute = Math.max(0, Math.min(59, Number(setting?.run_minute_local ?? 0) || 0));
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (cadence === 'weekly') {
    if (next <= base) next.setDate(next.getDate() + 7);
    return next.toISOString();
  }
  if (next <= base) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    (Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!,
    (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
  );

  const schedulerSecret = String(Deno.env.get('SERVICE_EXECUTION_SCHEDULER_SECRET') || '').trim();
  const providedSecret = String(req.headers.get('x-scheduler-secret') || '').trim();
  const secretAuthorized = !!schedulerSecret && !!providedSecret && schedulerSecret === providedSecret;

  let actorId: string | null = null;
  if (!secretAuthorized) {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const { data: actorProfile } = await supabase.from('profiles').select('id,is_active,role').eq('id', userData.user.id).single();
    if (!actorProfile?.is_active) {
      return Response.json({ ok: false, error: 'Inactive profile' }, { status: 403, headers: corsHeaders });
    }
    if (!['admin', 'supervisor'].includes(String(actorProfile.role || '').toLowerCase())) {
      return Response.json({ ok: false, error: 'Supervisor or Admin role required.' }, { status: 403, headers: corsHeaders });
    }
    actorId = String(actorProfile.id || '');
  }

  const body = await req.json().catch(() => ({}));
  const agreementId = String(body.agreement_id || '').trim() || null;
  const settingCode = String(body.setting_code || 'default').trim() || 'default';

  const { data: setting } = await supabase
    .from('service_execution_scheduler_settings')
    .select('*')
    .eq('setting_code', settingCode)
    .maybeSingle();

  let query = supabase
    .from('v_service_execution_scheduler_candidates')
    .select('*')
    .eq('scheduler_status', 'ready')
    .order('candidate_date', { ascending: true });
  if (agreementId) query = query.eq('agreement_id', agreementId);

  const { data: candidates, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });

  const lookaheadDays = Math.max(0, Number(setting?.lookahead_days ?? 1) || 0);
  const lastAllowed = new Date();
  lastAllowed.setDate(lastAllowed.getDate() + lookaheadDays);
  const lastAllowedIso = lastAllowed.toISOString().slice(0, 10);

  const filtered = (candidates || []).filter((row: any) => {
    const candidateDate = String(row?.candidate_date || '').slice(0, 10);
    if (candidateDate && candidateDate > lastAllowedIso) return false;
    if (row?.candidate_kind === 'service_session' && setting?.require_linked_job !== false && !row?.job_id) return false;
    return true;
  });

  let sessionCreatedCount = 0;
  let invoiceCandidateCount = 0;
  let skippedCount = 0;

  for (const row of filtered) {
    if (row.candidate_kind === 'service_session') {
      if (setting?.auto_create_sessions === false) {
        skippedCount += 1;
        continue;
      }
      if (!row.job_id) {
        skippedCount += 1;
        continue;
      }
      const existing = await supabase
        .from('job_sessions')
        .select('id')
        .eq('job_id', row.job_id)
        .eq('session_date', row.candidate_date)
        .maybeSingle();
      if (existing.data?.id) {
        skippedCount += 1;
        continue;
      }
      const { data: created } = await supabase
        .from('job_sessions')
        .insert({
          job_id: row.job_id,
          session_date: row.candidate_date,
          session_kind: 'scheduled_service',
          session_status: 'planned',
          service_frequency_label: row.service_name || 'scheduled_service',
          created_by_profile_id: actorId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (created?.id) sessionCreatedCount += 1;
      else skippedCount += 1;
      continue;
    }

    if (setting?.auto_stage_invoices === false) {
      skippedCount += 1;
      continue;
    }
    invoiceCandidateCount += 1;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    agreement_id: agreementId,
    candidate_count: filtered.length,
    session_created_count: sessionCreatedCount,
    invoice_candidate_count: invoiceCandidateCount,
    skipped_count: skippedCount,
    created_by_profile_id: actorId || null,
    run_code: makeRunCode(),
    run_mode: agreementId ? 'agreement_trigger' : (secretAuthorized ? 'scheduled' : 'manual'),
    run_status: 'completed',
    payload: {
      candidates: filtered,
      setting_code: settingCode,
      lookahead_days: lookaheadDays,
      auto_create_sessions: setting?.auto_create_sessions ?? true,
      auto_stage_invoices: setting?.auto_stage_invoices ?? true,
      require_linked_job: setting?.require_linked_job ?? true,
    },
    updated_at: nowIso,
  };
  const { data: run, error: runErr } = await supabase.from('service_execution_scheduler_runs').insert(payload).select('*').single();
  if (runErr) return Response.json({ ok: false, error: runErr.message }, { status: 500, headers: corsHeaders });

  if (setting?.id) {
    await supabase
      .from('service_execution_scheduler_settings')
      .update({
        last_run_at: nowIso,
        next_run_at: computeSchedulerNextRunAt(setting, new Date(nowIso)),
        last_dispatch_status: 'completed',
        last_dispatch_notes: secretAuthorized ? 'Completed from cron/secret scheduler invocation.' : 'Completed from admin/supervisor manual invocation.',
        updated_at: nowIso,
      })
      .eq('id', setting.id);
  }

  await supabase
    .from('site_activity_events')
    .insert({
      event_type: 'service_execution_scheduler_run',
      entity_type: 'service_execution_scheduler_run',
      entity_id: run.id,
      severity: 'info',
      title: 'Service execution scheduler run completed',
      summary: `${sessionCreatedCount} session(s) created, ${invoiceCandidateCount} invoice candidate(s), ${skippedCount} skipped.`,
      created_by_profile_id: actorId || null,
      occurred_at: nowIso,
    })
    .catch(() => null);

  return Response.json(
    {
      ok: true,
      run,
      session_created_count: sessionCreatedCount,
      invoice_candidate_count: invoiceCandidateCount,
      skipped_count: skippedCount,
      filtered_candidate_count: filtered.length,
      scheduled_invocation: secretAuthorized,
    },
    { headers: corsHeaders },
  );
});
