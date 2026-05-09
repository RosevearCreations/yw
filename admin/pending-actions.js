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

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function normalizeQueueStatus(value, fallback = "queued") {
  const status = normalizeText(value).toLowerCase();
  return ["queued", "retrying", "failed", "completed", "dismissed"].includes(status) ? status : fallback;
}

function mapRow(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = row.payload_json ? JSON.parse(row.payload_json) : {};
  } catch {
    payload = {};
  }
  return {
    admin_pending_action_id: Number(row.admin_pending_action_id || 0),
    client_action_id: row.client_action_id || null,
    action_scope: row.action_scope || "admin_write",
    order_id: Number(row.order_id || 0),
    label: row.action_label || "Pending admin action",
    endpoint: row.endpoint_path || "",
    method: row.http_method || "POST",
    payload,
    queue_status: row.queue_status || "queued",
    last_error: row.last_error || "",
    warning: row.warning || "",
    attempt_count: Number(row.attempt_count || 0),
    source_device_label: row.source_device_label || null,
    created_by_user_id: Number(row.created_by_user_id || 0),
    resolved_by_user_id: Number(row.resolved_by_user_id || 0),
    last_attempt_at: row.last_attempt_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    resolved_at: row.resolved_at || null
  };
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


export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  await ensureTable(db);

  const url = new URL(request.url);
  const orderId = Number(url.searchParams.get("order_id") || 0);
  const includeResolved = String(url.searchParams.get("include_resolved") || "").trim().toLowerCase() === "1";
  const actionScope = normalizeText(url.searchParams.get("action_scope") || "").toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const statuses = includeResolved
    ? ["queued", "retrying", "failed", "completed", "dismissed"]
    : ["queued", "retrying", "failed"];

  const where = [`queue_status IN (${statuses.map(() => "?").join(", ")})`];
  const bindings = [...statuses];
  if (Number.isInteger(orderId) && orderId > 0) {
    where.push("order_id = ?");
    bindings.push(orderId);
  }
  if (actionScope) {
    where.push("LOWER(COALESCE(action_scope,'')) = ?");
    bindings.push(actionScope);
  }
  bindings.push(limit);

  const rows = normalizeResults(await db.prepare(`
    SELECT *
    FROM admin_pending_actions
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC, admin_pending_action_id DESC
    LIMIT ?
  `).bind(...bindings).all());

  const actions = rows.map(mapRow).filter(Boolean);
  return json({
    ok: true,
    actions,
    summary: {
      open_count: actions.length,
      queued_count: actions.filter((row) => row.queue_status === "queued").length,
      failed_count: actions.filter((row) => row.queue_status === "failed").length,
      retrying_count: actions.filter((row) => row.queue_status === "retrying").length
    }
  });
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

  const label = normalizeText(body.label || body.action_label || "Pending admin action");
  const endpoint = normalizeText(body.endpoint || body.endpoint_path);
  const method = normalizeText(body.method || body.http_method || "POST").toUpperCase() || "POST";
  const actionScope = normalizeText(body.action_scope || "admin_write") || "admin_write";
  const orderId = Number(body.order_id || 0);
  const clientActionId = normalizeText(body.client_action_id || "");
  const payloadJson = JSON.stringify(body.payload || {});
  const queueStatus = normalizeQueueStatus(body.queue_status || "queued");
  const lastError = normalizeText(body.last_error || "");
  const warning = normalizeText(body.warning || "");
  const sourceDeviceLabel = normalizeText(body.source_device_label || request.headers.get("User-Agent") || "");

  if (!endpoint) return json({ ok: false, error: "A valid endpoint is required." }, 400);
  if (!label) return json({ ok: false, error: "A label is required." }, 400);

  let existing = null;
  if (clientActionId) {
    existing = await db.prepare(`SELECT * FROM admin_pending_actions WHERE client_action_id = ? LIMIT 1`).bind(clientActionId).first();
  }

  try {
    if (existing) {
      await db.prepare(`
        UPDATE admin_pending_actions
        SET
          action_scope = ?,
          order_id = ?,
          action_label = ?,
          endpoint_path = ?,
          http_method = ?,
          payload_json = ?,
          queue_status = ?,
          last_error = ?,
          warning = ?,
          source_device_label = ?,
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CASE WHEN ? IN ('completed','dismissed') THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE NULL END,
          resolved_by_user_id = CASE WHEN ? IN ('completed','dismissed') THEN ? ELSE NULL END
        WHERE admin_pending_action_id = ?
      `).bind(
        actionScope,
        orderId > 0 ? orderId : null,
        label,
        endpoint,
        method,
        payloadJson,
        queueStatus,
        lastError || null,
        warning || null,
        sourceDeviceLabel || null,
        queueStatus,
        queueStatus,
        adminUser.user_id,
        existing.admin_pending_action_id
      ).run();
    } else {
      await db.prepare(`
        INSERT INTO admin_pending_actions (
          client_action_id, action_scope, order_id, action_label, endpoint_path, http_method, payload_json,
          queue_status, last_error, warning, created_by_user_id, source_device_label, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        clientActionId || null,
        actionScope,
        orderId > 0 ? orderId : null,
        label,
        endpoint,
        method,
        payloadJson,
        queueStatus,
        lastError || null,
        warning || null,
        adminUser.user_id,
        sourceDeviceLabel || null
      ).run();
    }
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_pending_actions",
      incident_code: "queue_save_failed",
      severity: "warning",
      message: "Failed to save shared admin pending action.",
      related_user_id: adminUser.user_id,
      details: { order_id: orderId, endpoint, method, error: String(error?.message || error || "Unknown queue save error") }
    });
    return json({ ok: false, error: "Failed to save pending action." }, 500);
  }

  const saved = clientActionId
    ? await db.prepare(`SELECT * FROM admin_pending_actions WHERE client_action_id = ? LIMIT 1`).bind(clientActionId).first()
    : await db.prepare(`SELECT * FROM admin_pending_actions ORDER BY admin_pending_action_id DESC LIMIT 1`).first();

  await auditAdminAction(env, request, adminUser, {
    action_type: "admin_pending_action_saved",
    target_type: "admin_pending_action",
    target_id: saved?.admin_pending_action_id || null,
    target_key: clientActionId || endpoint,
    details: { order_id: orderId, endpoint, method, queue_status: queueStatus, action_scope: actionScope }
  });

  return json({ ok: true, action: mapRow(saved) });
}
