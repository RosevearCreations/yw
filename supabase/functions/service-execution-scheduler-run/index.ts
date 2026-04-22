import { createClient } from 'npm:@supabase/supabase-js@2'

type SchedulerSetting = {
  id: string
  setting_code: string
  is_enabled: boolean
  cadence: string
  run_timezone: string
  run_hour_local: number
  run_minute_local: number
  lookahead_days: number
  auto_create_sessions: boolean
  auto_stage_invoices: boolean
  require_linked_job: boolean
  last_run_at: string | null
  next_run_at: string | null
  notes: string | null
}

type SchedulerCandidate = {
  agreement_id: string | null
  agreement_code: string | null
  service_name: string | null
  candidate_kind: 'service_session' | 'visit_invoice' | 'snow_invoice'
  invoice_source: string | null
  candidate_date: string
  candidate_reason: string | null
  client_id: string | null
  client_site_id: string | null
  route_id: string | null
  crew_id: string | null
  job_id: number | null
  job_code: string | null
  job_name: string | null
  job_status: string | null
  visit_charge_total: number | null
  visit_cost_total: number | null
  snow_event_trigger_id: string | null
  scheduler_status: 'ready' | 'session_exists' | 'no_linked_job'
}

type RunInsert = {
  run_code: string
  run_mode: 'scheduled'
  run_status: 'queued' | 'running' | 'completed' | 'partial' | 'failed'
  agreement_id: string | null
  candidate_count: number
  session_created_count: number
  invoice_candidate_count: number
  skipped_count: number
  run_notes: string | null
  payload: Record<string, unknown>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function makeRunCode(settingCode: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const rand = crypto.randomUUID().slice(0, 8)
  return `SERUN-${settingCode}-${stamp}-${rand}`
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405)
    }

    const incomingSecret = req.headers.get('x-scheduler-secret')
    const expectedSecret = Deno.env.get('SERVICE_EXECUTION_SCHEDULER_SECRET')

    if (!incomingSecret || !expectedSecret || incomingSecret !== expectedSecret) {
      return json({ ok: false, error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        {
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets',
        },
        500,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const settingCode =
      typeof body?.setting_code === 'string' && body.setting_code.trim()
        ? body.setting_code.trim()
        : 'default'

    const { data: setting, error: settingError } = await supabase
      .from('service_execution_scheduler_settings')
      .select('*')
      .eq('setting_code', settingCode)
      .maybeSingle<SchedulerSetting>()

    if (settingError) {
      return json(
        { ok: false, error: 'Could not read scheduler setting', details: settingError.message },
        500,
      )
    }

    if (!setting) {
      return json({ ok: false, error: `No scheduler setting found for ${settingCode}` }, 404)
    }

    if (!setting.is_enabled) {
      return json({ ok: true, skipped: true, reason: 'Scheduler setting is disabled' })
    }

    const { data: allCandidates, error: candidateError } = await supabase
      .from('v_service_execution_scheduler_candidates')
      .select('*')
      .eq('scheduler_status', 'ready')

    if (candidateError) {
      return json(
        { ok: false, error: 'Could not read scheduler candidates', details: candidateError.message },
        500,
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const maxDate = addDays(today, Math.max(0, Number(setting.lookahead_days ?? 0)))

    const candidates = ((allCandidates ?? []) as SchedulerCandidate[]).filter((row) => {
      return row.candidate_date >= today && row.candidate_date <= maxDate
    })

    const runCode = makeRunCode(setting.setting_code)

    const runInsert: RunInsert = {
      run_code: runCode,
      run_mode: 'scheduled',
      run_status: 'running',
      agreement_id: null,
      candidate_count: candidates.length,
      session_created_count: 0,
      invoice_candidate_count: 0,
      skipped_count: 0,
      run_notes: null,
      payload: {
        setting_code: setting.setting_code,
        lookahead_days: setting.lookahead_days,
        candidate_window: { start: today, end: maxDate },
      },
    }

    const { data: runRow, error: runCreateError } = await supabase
      .from('service_execution_scheduler_runs')
      .insert(runInsert)
      .select('id')
      .single()

    if (runCreateError) {
      return json(
        { ok: false, error: 'Could not create scheduler run row', details: runCreateError.message },
        500,
      )
    }

    const runId = runRow.id as string

    let sessionCreatedCount = 0
    let invoiceCandidateCount = 0
    let skippedCount = 0

    const createdSessionIds: string[] = []
    const skipped: Array<Record<string, unknown>> = []
    const invoiceCandidates: Array<Record<string, unknown>> = []

    for (const candidate of candidates) {
      if (candidate.candidate_kind === 'service_session') {
        if (!setting.auto_create_sessions) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: 'auto_create_sessions is disabled',
          })
          continue
        }

        if (!candidate.job_id) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: 'No linked job',
          })
          continue
        }

        const { data: existingSession, error: existingSessionError } = await supabase
          .from('job_sessions')
          .select('id')
          .eq('job_id', candidate.job_id)
          .eq('session_date', candidate.candidate_date)
          .limit(1)
          .maybeSingle()

        if (existingSessionError) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: `Existing session check failed: ${existingSessionError.message}`,
          })
          continue
        }

        if (existingSession?.id) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: 'Session already exists',
          })
          continue
        }

        const { data: agreement, error: agreementError } = await supabase
          .from('recurring_service_agreements')
          .select('visit_estimated_duration_hours')
          .eq('id', candidate.agreement_id)
          .maybeSingle()

        if (agreementError) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: `Agreement lookup failed: ${agreementError.message}`,
          })
          continue
        }

        const durationMinutes =
          agreement?.visit_estimated_duration_hours != null
            ? Math.round(Number(agreement.visit_estimated_duration_hours) * 60)
            : null

        const scheduledStartAt = `${candidate.candidate_date}T${String(setting.run_hour_local).padStart(2, '0')}:${String(setting.run_minute_local).padStart(2, '0')}:00`

        const { data: newSession, error: createSessionError } = await supabase
          .from('job_sessions')
          .insert({
            job_id: candidate.job_id,
            session_date: candidate.candidate_date,
            session_kind: 'field_service',
            session_status: 'planned',
            service_frequency_label: 'scheduler-created',
            scheduled_start_at: scheduledStartAt,
            duration_minutes: durationMinutes,
            notes: `Auto-created by scheduler run ${runCode} for agreement ${candidate.agreement_code ?? ''}`.trim(),
          })
          .select('id')
          .single()

        if (createSessionError) {
          skippedCount += 1
          skipped.push({
            agreement_code: candidate.agreement_code,
            candidate_kind: candidate.candidate_kind,
            candidate_date: candidate.candidate_date,
            reason: `Session create failed: ${createSessionError.message}`,
          })
          continue
        }

        sessionCreatedCount += 1
        createdSessionIds.push(newSession.id as string)

        if (candidate.agreement_id) {
          await supabase
            .from('recurring_service_agreements')
            .update({ last_scheduler_run_at: new Date().toISOString() })
            .eq('id', candidate.agreement_id)
        }

        continue
      }

      if (candidate.candidate_kind === 'visit_invoice' || candidate.candidate_kind === 'snow_invoice') {
        invoiceCandidateCount += 1
        invoiceCandidates.push({
          agreement_id: candidate.agreement_id,
          agreement_code: candidate.agreement_code,
          candidate_kind: candidate.candidate_kind,
          invoice_source: candidate.invoice_source,
          candidate_date: candidate.candidate_date,
          job_id: candidate.job_id,
          snow_event_trigger_id: candidate.snow_event_trigger_id,
        })
        continue
      }

      skippedCount += 1
      skipped.push({
        agreement_code: candidate.agreement_code,
        candidate_kind: candidate.candidate_kind,
        candidate_date: candidate.candidate_date,
        reason: 'Unhandled candidate kind',
      })
    }

    const finalStatus =
      skippedCount > 0 && (sessionCreatedCount > 0 || invoiceCandidateCount > 0)
        ? 'partial'
        : 'completed'

    const nowIso = new Date().toISOString()

    await supabase
      .from('service_execution_scheduler_runs')
      .update({
        run_status: finalStatus,
        session_created_count: sessionCreatedCount,
        invoice_candidate_count: invoiceCandidateCount,
        skipped_count: skippedCount,
        run_notes:
          invoiceCandidateCount > 0
            ? 'Sessions created where possible. Invoice candidates were logged to payload for later staging.'
            : 'Scheduler run completed.',
        payload: {
          setting_code: setting.setting_code,
          candidate_window: { start: today, end: maxDate },
          created_session_ids: createdSessionIds,
          invoice_candidates: invoiceCandidates,
          skipped,
        },
        updated_at: nowIso,
      })
      .eq('id', runId)

    await supabase
      .from('service_execution_scheduler_settings')
      .update({
        last_run_at: nowIso,
        next_run_at: null,
        last_dispatch_status: 'completed',
        last_dispatch_notes: `Edge Function completed run ${runCode}`,
        updated_at: nowIso,
      })
      .eq('id', setting.id)

    return json({
      ok: true,
      run_code: runCode,
      candidate_count: candidates.length,
      session_created_count: sessionCreatedCount,
      invoice_candidate_count: invoiceCandidateCount,
      skipped_count: skippedCount,
      note: 'This first version creates missing planned job_sessions and logs invoice candidates into the run payload.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ ok: false, error: message }, 500)
  }
})
