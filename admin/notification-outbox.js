import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from '../_lib/adminAudit.js';
import { processNotificationOutbox } from '../_lib/notificationOutbox.js';
import { requireAdminStepUp } from '../_lib/adminStepUp.js';

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const url = new URL(request.url);
  const status = normalizeText(url.searchParams.get('status')).toLowerCase();
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 250));
  const like = `%${q}%`;
  const rows = normalizeResults(await db.prepare(`
    SELECT notification_outbox_id, notification_kind, channel, destination, related_order_id, related_payment_id,
           status, attempt_count, last_attempt_at, next_attempt_at, provider_message_id, error_text, created_at, updated_at
    FROM notification_outbox
    WHERE (? = '' OR LOWER(COALESCE(status, '')) = ?)
      AND (? = '' OR LOWER(COALESCE(notification_kind, '')) LIKE ? OR LOWER(COALESCE(destination, '')) LIKE ? OR LOWER(COALESCE(error_text, '')) LIKE ?)
    ORDER BY created_at DESC, notification_outbox_id DESC
    LIMIT ?
  `).bind(status, status, q, like, like, like, limit).all().catch(() => ({ results: [] })));
  return json({ ok: true, items: rows.map((row) => ({
    notification_outbox_id: Number(row.notification_outbox_id || 0),
    notification_kind: row.notification_kind || '',
    channel: row.channel || 'email',
    destination: row.destination || '',
    related_order_id: Number(row.related_order_id || 0),
    related_payment_id: Number(row.related_payment_id || 0),
    status: row.status || 'queued',
    attempt_count: Number(row.attempt_count || 0),
    last_attempt_at: row.last_attempt_at || null,
    next_attempt_at: row.next_attempt_at || null,
    provider_message_id: row.provider_message_id || null,
    error_text: row.error_text || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const action = normalizeText(body.action).toLowerCase();

  if (action === 'dispatch_due') {
    const stepUp = await requireAdminStepUp(request, env, adminUser, body, 'notification dispatch');
    if (!stepUp.ok) return stepUp.response;
    const result = await processNotificationOutbox(env, { limit: Number(body.limit || 10) });
    await auditAdminAction(env, request, adminUser, { action_type: 'notification_dispatch', target_type: 'notification_outbox', target_key: 'dispatch_due', details: result });
    return json(result);
  }

  const notificationOutboxId = Number(body.notification_outbox_id || 0);
  if (!Number.isInteger(notificationOutboxId) || notificationOutboxId <= 0) return json({ ok: false, error: 'A valid notification_outbox_id is required.' }, 400);

  if (action === 'retry') {
    await db.prepare(`UPDATE notification_outbox SET status = 'retry', next_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE notification_outbox_id = ?`).bind(notificationOutboxId).run();
    await auditAdminAction(env, request, adminUser, { action_type: 'notification_retry', target_type: 'notification_outbox', target_id: notificationOutboxId, target_key: String(notificationOutboxId) });
    return json({ ok: true, message: 'Notification queued for retry.', notification_outbox_id: notificationOutboxId });
  }

  if (action === 'cancel') {
    const stepUp = await requireAdminStepUp(request, env, adminUser, body, 'notification cancellation');
    if (!stepUp.ok) return stepUp.response;
    await db.prepare(`UPDATE notification_outbox SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE notification_outbox_id = ?`).bind(notificationOutboxId).run();
    await auditAdminAction(env, request, adminUser, { action_type: 'notification_cancel', target_type: 'notification_outbox', target_id: notificationOutboxId, target_key: String(notificationOutboxId) });
    return json({ ok: true, message: 'Notification cancelled.', notification_outbox_id: notificationOutboxId });
  }

  return json({ ok: false, error: 'Unsupported action.' }, 400);
}
