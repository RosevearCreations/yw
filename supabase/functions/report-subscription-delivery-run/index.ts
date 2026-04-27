import { createClient } from 'npm:@supabase/supabase-js@2'

type SubscriptionRow = {
  id: string
  subscription_name: string
  report_kind: string
  cadence: string
  delivery_channel: string
  target_role: string | null
  target_profile_id: string | null
  target_profile_name: string | null
  recipient_email: string | null
  report_preset_id: string | null
  report_preset_name: string | null
  filter_payload: Record<string, unknown> | null
  include_csv: boolean
  next_send_at: string | null
  last_sent_at: string | null
  last_status: string | null
  notes: string | null
}

type SchedulerSetting = {
  id: string
  setting_code: string
  is_enabled: boolean
  cadence: string
  run_hour_local: number
  run_minute_local: number
  next_run_at: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function makeRunCode(settingCode: string, subscriptionName: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const safe = String(subscriptionName || 'subscription').replace(/[^A-Z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 24).toUpperCase() || 'SUB'
  return `REPDL-${settingCode}-${safe}-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

function computeNextRunAt(setting: SchedulerSetting, baseIso = new Date().toISOString()) {
  const cadence = String(setting.cadence || 'manual').toLowerCase()
  if (cadence === 'manual') return null
  const base = new Date(baseIso)
  const hour = Math.max(0, Math.min(Number(setting.run_hour_local ?? 0), 23))
  const minute = Math.max(0, Math.min(Number(setting.run_minute_local ?? 0), 59))
  if (cadence === 'hourly') {
    const next = new Date(base)
    next.setUTCMinutes(0, 0, 0)
    next.setUTCHours(next.getUTCHours() + 1)
    return next.toISOString()
  }
  const next = new Date(base)
  next.setUTCHours(hour, minute, 0, 0)
  if (next <= base) next.setUTCDate(next.getUTCDate() + (cadence === 'weekly' ? 7 : 1))
  return next.toISOString()
}

function computeNextSendAt(cadence: string, baseIso = new Date().toISOString()) {
  const next = new Date(baseIso)
  const clean = String(cadence || 'weekly').toLowerCase()
  if (clean === 'daily') next.setUTCDate(next.getUTCDate() + 1)
  else if (clean === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1)
  else next.setUTCDate(next.getUTCDate() + 7)
  return next.toISOString()
}

function asCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return 'No rows
'
  const cols = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key))
    return set
  }, new Set<string>()))
  const esc = (value: unknown) => {
    const text = String(value ?? '')
    if (/[",
]/.test(text)) return `"${text.replaceAll('"', '""')}"`
    return text
  }
  const lines = [cols.join(',')]
  for (const row of rows) lines.push(cols.map((col) => esc(row[col])).join(','))
  return `${lines.join('
')}
`
}

async function sendEmail(to: string[], subject: string, text: string, csvName?: string | null, csvText?: string | null) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM')
  if (!apiKey || !from || !to.length) return { attempted: false, status: 'pending', error: 'Missing email delivery config.' }
  const payload: Record<string, unknown> = { from, to, subject, text }
  if (csvName && csvText) payload.attachments = [{ filename: csvName, content: btoa(csvText) }]
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(body)
  return { attempted: true, status: 'sent', error: '' }
}

async function getRoleRecipients(supabase: any, role: string) {
  const { data } = await supabase.from('profiles').select('id,email,full_name,role,is_active').eq('is_active', true).eq('role', role)
  return Array.isArray(data) ? data.filter((row) => row?.email).map((row) => ({ id: row.id, email: row.email, name: row.full_name || row.email })) : []
}

function applyFilterPayload(rows: Record<string, unknown>[], filterPayload: Record<string, unknown> | null | undefined) {
  const payload = filterPayload || {}
  const keys = ['site_code', 'job_code', 'route_code', 'work_order_number', 'supervisor_profile_id', 'target_profile_id']
  return rows.filter((row) => keys.every((key) => {
    const expected = String((payload as Record<string, unknown>)[key] ?? '').trim()
    if (!expected) return true
    return String(row[key] ?? '').trim() === expected
  }))
}

async function fetchRowsForKind(supabase: any, sub: SubscriptionRow) {
  const kind = String(sub.report_kind || 'weekly_supervisor_summary')
  const limit = 100
  if (kind === 'overdue_corrective_actions') {
    const { data } = await supabase.from('v_corrective_action_task_directory').select('*').or('is_overdue.eq.true,reminder_due.eq.true,escalation_due.eq.true').order('due_date', { ascending: true }).limit(limit)
    return applyFilterPayload((data || []) as Record<string, unknown>[], sub.filter_payload)
  }
  if (kind === 'training_expiry_30_days') {
    const { data } = await supabase.from('v_training_record_directory').select('*').or('is_expired.eq.true,expires_within_30_days.eq.true,verification_pending.eq.true').order('expires_at', { ascending: true }).limit(limit)
    return applyFilterPayload((data || []) as Record<string, unknown>[], sub.filter_payload)
  }
  if (kind === 'rejected_evidence_followup') {
    const att = await supabase.from('v_attendance_photo_review').select('*').in('review_status', ['rejected', 'follow_up']).order('uploaded_at', { ascending: false }).limit(limit)
    const hse = await supabase.from('v_hse_evidence_review').select('*').in('review_status', ['rejected', 'follow_up']).order('created_at', { ascending: false }).limit(limit)
    return applyFilterPayload(([...(att.data || []), ...(hse.data || [])] as Record<string, unknown>[]), sub.filter_payload)
  }
  if (kind === 'incident_near_miss_summary') {
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 7)
    const { data } = await supabase.from('v_incident_near_miss_history').select('*').gte('submission_date', cutoff.toISOString().slice(0,10)).order('submission_date', { ascending: false }).limit(limit)
    return applyFilterPayload((data || []) as Record<string, unknown>[], sub.filter_payload)
  }
  const queue = await supabase.from('v_supervisor_safety_queue').select('*').order('sort_at', { ascending: false }).limit(limit)
  return applyFilterPayload((queue.data || []) as Record<string, unknown>[], sub.filter_payload)
}

function buildSummaryText(sub: SubscriptionRow, rows: Record<string, unknown>[]) {
  const kind = String(sub.report_kind || '')
  const title = sub.subscription_name || sub.report_kind || 'Safety report'
  const lines = [title, '', `Rows included: ${rows.length}`]
  if (kind === 'weekly_supervisor_summary') {
    lines.push(
      `Corrective items: ${rows.filter((row) => String(row.queue_type || row.alert_type || '').includes('corrective')).length}`,
      `Training items: ${rows.filter((row) => String(row.queue_type || row.alert_type || '').includes('training')).length}`,
      `SDS items: ${rows.filter((row) => String(row.queue_type || row.alert_type || '').includes('sds')).length}`,
    )
  }
  lines.push('', 'Top rows:')
  rows.slice(0, 12).forEach((row) => {
    const label = row.headline || row.task_title || row.course_name || row.primary_context || row.product_name || row.record_number || 'Row'
    const status = row.queue_status || row.alert_status || row.status || row.completion_status || ''
    const due = row.due_label || row.due_date || row.expires_at || row.next_send_at || ''
    lines.push(`- ${label}${status ? ` [${status}]` : ''}${due ? ` due ${due}` : ''}`)
  })
  return lines.join('
')
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
    const incomingSecret = req.headers.get('x-scheduler-secret')
    const expectedSecret = Deno.env.get('REPORT_DELIVERY_SCHEDULER_SECRET') || Deno.env.get('SERVICE_EXECUTION_SCHEDULER_SECRET')
    if (!incomingSecret || !expectedSecret || incomingSecret !== expectedSecret) return json({ ok: false, error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Missing service role configuration' }, 500)
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

    const body = await req.json().catch(() => ({}))
    const settingCode = typeof body?.setting_code === 'string' && body.setting_code.trim() ? body.setting_code.trim() : 'default'
    const { data: setting, error: settingError } = await supabase.from('report_delivery_scheduler_settings').select('*').eq('setting_code', settingCode).maybeSingle<SchedulerSetting>()
    if (settingError) return json({ ok: false, error: 'Could not read report delivery scheduler setting', details: settingError.message }, 500)
    if (!setting) return json({ ok: false, error: `No report delivery scheduler setting found for ${settingCode}` }, 404)
    if (!setting.is_enabled) return json({ ok: true, skipped: true, reason: 'Report delivery scheduler is disabled' })

    const { data: dueRows, error: dueError } = await supabase.from('v_report_delivery_candidates').select('*').order('next_send_at', { ascending: true }).limit(25)
    if (dueError) return json({ ok: false, error: 'Could not read report delivery candidates', details: dueError.message }, 500)

    const candidates = (dueRows || []) as SubscriptionRow[]
    const nowIso = new Date().toISOString()
    let sentCount = 0
    let failedCount = 0
    const results: Record<string, unknown>[] = []

    for (const sub of candidates) {
      const runCode = makeRunCode(setting.setting_code, sub.subscription_name || sub.id)
      const { data: runRow } = await supabase.from('report_delivery_runs').insert({
        run_code: runCode,
        setting_code: setting.setting_code,
        subscription_id: sub.id,
        subscription_name: sub.subscription_name,
        report_kind: sub.report_kind,
        delivery_channel: sub.delivery_channel,
        recipient_profile_id: sub.target_profile_id,
        recipient_email: sub.recipient_email,
        run_status: 'running',
        started_at: nowIso,
        payload: { report_preset_id: sub.report_preset_id || null, filter_payload: sub.filter_payload || {} },
        created_at: nowIso,
        updated_at: nowIso,
      }).select('id').single()
      const runId = runRow?.id as string | undefined
      try {
        const rows = await fetchRowsForKind(supabase, sub)
        const subject = `[YWI] ${sub.subscription_name || sub.report_kind || 'Safety report'}`
        const text = buildSummaryText(sub, rows)
        const csvText = sub.include_csv ? asCsv(rows) : null
        const csvName = sub.include_csv ? `${String(sub.report_kind || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv` : null

        if (String(sub.delivery_channel || 'email') === 'in_app') {
          if (sub.target_profile_id) {
            await supabase.from('admin_notifications').insert({
              notification_type: 'scheduled_report',
              recipient_role: sub.target_role || 'employee',
              target_profile_id: sub.target_profile_id,
              title: subject,
              body: text,
              message: text,
              payload: { subscription_id: sub.id, report_kind: sub.report_kind, row_count: rows.length },
              status: 'queued',
              email_subject: subject,
              created_at: nowIso,
            })
          } else if (sub.target_role) {
            const recipients = await getRoleRecipients(supabase, sub.target_role)
            if (recipients.length) {
              await supabase.from('admin_notifications').insert(recipients.map((recipient) => ({
                notification_type: 'scheduled_report',
                recipient_role: sub.target_role,
                target_profile_id: recipient.id,
                title: subject,
                body: text,
                message: text,
                payload: { subscription_id: sub.id, report_kind: sub.report_kind, row_count: rows.length },
                status: 'queued',
                email_subject: subject,
                created_at: nowIso,
              })))
            }
          }
        } else {
          let recipientEmails = String(sub.recipient_email || '').split(/[;,]/).map((value) => value.trim()).filter(Boolean)
          if (!recipientEmails.length && sub.target_profile_id) {
            const { data: target } = await supabase.from('profiles').select('id,email').eq('id', sub.target_profile_id).maybeSingle()
            if (target?.email) recipientEmails = [target.email]
          }
          if (!recipientEmails.length && sub.target_role) {
            const recipients = await getRoleRecipients(supabase, sub.target_role)
            recipientEmails = recipients.map((row) => row.email)
          }
          if (!recipientEmails.length) throw new Error('No email recipient is configured for this report subscription.')
          await sendEmail(recipientEmails, subject, text, csvName, csvText)
        }

        await supabase.from('report_subscriptions').update({
          last_sent_at: nowIso,
          next_send_at: computeNextSendAt(sub.cadence || 'weekly', nowIso),
          last_status: 'sent',
          updated_at: nowIso,
        }).eq('id', sub.id)
        if (runId) {
          await supabase.from('report_delivery_runs').update({
            run_status: 'completed',
            completed_at: nowIso,
            sent_count: 1,
            failed_count: 0,
            attachment_count: sub.include_csv ? 1 : 0,
            delivery_subject: subject,
            delivery_summary: text.slice(0, 1200),
            payload: { row_count: rows.length, filter_payload: sub.filter_payload || {} },
            updated_at: nowIso,
          }).eq('id', runId)
        }
        sentCount += 1
        results.push({ subscription_id: sub.id, status: 'sent', subject, row_count: rows.length })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Delivery failed'
        failedCount += 1
        await supabase.from('report_subscriptions').update({
          last_status: message,
          next_send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          updated_at: nowIso,
        }).eq('id', sub.id)
        if (runId) {
          await supabase.from('report_delivery_runs').update({
            run_status: 'failed',
            completed_at: nowIso,
            sent_count: 0,
            failed_count: 1,
            error_text: message,
            updated_at: nowIso,
          }).eq('id', runId)
        }
        results.push({ subscription_id: sub.id, status: 'failed', error: message })
      }
    }

    await supabase.from('report_delivery_scheduler_settings').update({
      last_run_at: nowIso,
      next_run_at: computeNextRunAt(setting, nowIso),
      last_dispatch_status: 'completed',
      last_dispatch_notes: candidates.length ? `Processed ${candidates.length} due report subscription(s).` : 'No report subscriptions were due.',
      updated_at: nowIso,
    }).eq('id', setting.id)

    return json({ ok: true, processed: candidates.length, sent_count: sentCount, failed_count: failedCount, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ ok: false, error: message }, 500)
  }
})
