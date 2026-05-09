import {
  auditAdminAction,
  captureRuntimeIncident,
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText
} from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function normalizeQueueStatus(value) {
  const status = normalizeText(value).toLowerCase();
  return ["queued", "retrying", "failed", "completed", "dismissed"].includes(status) ? status : "";
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_pending_actions (
      admin_pending_action_id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_action_id TEXT,
      action_scope TEXT,
      order_id INTEGER,
      action_label TEXT,
      endpoint_path TEXT,
      http_method TEXT,
      payload_json TEXT,
      queue_status TEXT DEFAULT 'queued',
      last_error TEXT,
      warning TEXT,
      attempt_count INTEGER DEFAULT 0,
      created_by_user_id INTEGER,
      resolved_by_user_id INTEGER,
      source_device_label TEXT,
      last_attempt_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    )
  `).run();
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_pending_actions_client_action_id ON admin_pending_actions(client_action_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_status_created ON admin_pending_actions(queue_status, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_order_status ON admin_pending_actions(order_id, queue_status, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_scope_status ON admin_pending_actions(action_scope, queue_status, created_at DESC)`).run();
}


export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  await ensureTable(db);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const pendingActionId = Number(body.admin_pending_action_id || 0);
  const clientActionId = normalizeText(body.client_action_id || "");
  const queueStatus = normalizeQueueStatus(body.queue_status);
  const lastError = normalizeText(body.last_error || "");
  const incrementAttempt = Number(body.increment_attempt || 0) === 1 || body.increment_attempt === true;

  if ((!Number.isInteger(pendingActionId) || pendingActionId <= 0) && !clientActionId) {
    return json({ ok: false, error: "A valid pending action id or client_action_id is required." }, 400);
  }
  if (!queueStatus) {
    return json({ ok: false, error: "A valid queue_status is required." }, 400);
  }

  const where = pendingActionId > 0 ? { sql: "admin_pending_action_id = ?", value: pendingActionId } : { sql: "client_action_id = ?", value: clientActionId };

  const existing = await db.prepare(`SELECT * FROM admin_pending_actions WHERE ${where.sql} LIMIT 1`).bind(where.value).first();
  if (!existing) return json({ ok: false, error: "Pending action not found." }, 404);

  try {
    await db.prepare(`
      UPDATE admin_pending_actions
      SET
        queue_status = ?,
        last_error = ?,
        attempt_count = COALESCE(attempt_count, 0) + ?,
        last_attempt_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE last_attempt_at END,
        updated_at = CURRENT_TIMESTAMP,
        resolved_by_user_id = CASE WHEN ? IN ('completed','dismissed') THEN ? ELSE resolved_by_user_id END,
        resolved_at = CASE WHEN ? IN ('completed','dismissed') THEN CURRENT_TIMESTAMP WHEN ? IN ('queued','retrying','failed') THEN NULL ELSE resolved_at END
      WHERE admin_pending_action_id = ?
    `).bind(
      queueStatus,
      lastError || null,
      incrementAttempt ? 1 : 0,
      incrementAttempt ? 1 : 0,
      queueStatus,
      adminUser.user_id,
      queueStatus,
      queueStatus,
      existing.admin_pending_action_id
    ).run();
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_pending_actions",
      incident_code: "queue_status_update_failed",
      severity: "warning",
      message: "Failed to update shared admin pending action status.",
      related_user_id: adminUser.user_id,
      details: { admin_pending_action_id: existing.admin_pending_action_id, queue_status: queueStatus, error: String(error?.message || error || "Unknown queue update error") }
    });
    return json({ ok: false, error: "Failed to update pending action status." }, 500);
  }

  const saved = await db.prepare(`SELECT * FROM admin_pending_actions WHERE admin_pending_action_id = ? LIMIT 1`).bind(existing.admin_pending_action_id).first();

  await auditAdminAction(env, request, adminUser, {
    action_type: "admin_pending_action_status_updated",
    target_type: "admin_pending_action",
    target_id: existing.admin_pending_action_id,
    target_key: existing.client_action_id || existing.endpoint_path || String(existing.admin_pending_action_id),
    details: { queue_status: queueStatus, increment_attempt: incrementAttempt, last_error: lastError || null }
  });

  return json({
    ok: true,
    action: {
      admin_pending_action_id: Number(saved?.admin_pending_action_id || existing.admin_pending_action_id || 0),
      client_action_id: saved?.client_action_id || null,
      queue_status: saved?.queue_status || queueStatus,
      attempt_count: Number(saved?.attempt_count || 0),
      last_error: saved?.last_error || "",
      last_attempt_at: saved?.last_attempt_at || null,
      updated_at: saved?.updated_at || null,
      resolved_at: saved?.resolved_at || null
    }
  });
}
