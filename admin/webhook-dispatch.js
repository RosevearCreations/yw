import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try { body = await request.json(); } catch {}
  const mode = String(body.mode || 'dispatch_due').trim().toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(body.limit || 25)));
  if (!['dispatch_due', 'requeue_failed'].includes(mode)) return json({ ok: false, error: 'Unsupported mode.' }, 400);

  const rows = normalizeResults(await db.prepare(`
    SELECT webhook_event_id, provider, provider_event_id, event_type, process_status, attempt_count, next_retry_at
    FROM webhook_events
    WHERE (
      (? = 'dispatch_due' AND COALESCE(process_status, 'received') IN ('received', 'failed'))
      OR (? = 'requeue_failed' AND COALESCE(process_status, '') = 'failed')
    )
      AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP OR next_retry_at <= datetime('now'))
    ORDER BY COALESCE(next_retry_at, received_at) ASC, webhook_event_id ASC
    LIMIT ?
  `).bind(mode, mode, limit).all().catch(() => ({ results: [] })));

  const processed = [];
  for (const row of rows) {
    const attemptCount = Number(row.attempt_count || 0) + 1;
    const nextRetryAt = new Date(Date.now() + Number(env.WEBHOOK_RETRY_MINUTES || 15) * 60 * 1000).toISOString();
    await db.prepare(`
      UPDATE webhook_events
      SET process_status = 'received',
          attempt_count = ?,
          last_attempt_at = CURRENT_TIMESTAMP,
          next_retry_at = ?,
          dispatch_notes = TRIM(COALESCE(dispatch_notes,'') || CASE WHEN COALESCE(dispatch_notes,'') = '' THEN '' ELSE ' | ' END || ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE webhook_event_id = ?
    `).bind(attemptCount, nextRetryAt, `Requeued by admin dispatch worker (${mode}).`, Number(row.webhook_event_id || 0)).run();
    processed.push({
      webhook_event_id: Number(row.webhook_event_id || 0),
      provider: row.provider || '',
      provider_event_id: row.provider_event_id || '',
      previous_status: row.process_status || 'received',
      next_status: 'received',
      attempt_count: attemptCount,
      next_retry_at: nextRetryAt
    });
  }

  await auditAdminAction(env, request, adminUser, {
    action_type: 'webhook_dispatch_batch',
    target_type: 'webhook_events',
    target_key: mode,
    details: { mode, processed_count: processed.length, webhook_event_ids: processed.map((row) => row.webhook_event_id) }
  });

  return json({ ok: true, mode, processed_count: processed.length, items: processed });
}
