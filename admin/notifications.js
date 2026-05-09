// File: /functions/api/admin/notifications.js
// Brief description: Lists notification jobs and allows queued/retry updates for a stronger retry foundation.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getAdminUserFromRequest(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
      u.user_id AS resolved_user_id,
      u.email,
      u.display_name,
      u.role,
      u.is_active
    FROM sessions s
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || '').toLowerCase() !== 'admin') return null;

  return {
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || '',
    display_name: session.display_name || '',
    role: 'admin'
  };
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}


export async function onRequestGet(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const rows = normalizeResults(await env.DB.prepare(`
    SELECT notification_job_id, channel, job_type, target, status, attempt_count, max_attempts,
           next_attempt_at, last_attempt_at, last_error, created_at, updated_at
    FROM notification_jobs
    ORDER BY created_at DESC
    LIMIT 100
  `).all());
  return json({ ok: true, jobs: rows.map((row) => ({
    notification_job_id: Number(row.notification_job_id || 0), channel: row.channel || '',
    job_type: row.job_type || '', target: row.target || '', status: row.status || '',
    attempt_count: Number(row.attempt_count || 0), max_attempts: Number(row.max_attempts || 0),
    next_attempt_at: row.next_attempt_at || null, last_attempt_at: row.last_attempt_at || null,
    last_error: row.last_error || '', created_at: row.created_at || null, updated_at: row.updated_at || null
  })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const action = normalizeText(body.action).toLowerCase();

  if (action === 'queue') {
    const channel = normalizeText(body.channel) || 'email';
    const job_type = normalizeText(body.job_type) || 'generic';
    const target = normalizeText(body.target);
    await env.DB.prepare(`
      INSERT INTO notification_jobs (channel, job_type, target, payload_json, status, next_attempt_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'queued', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(channel, job_type, target || null, body.payload_json ? JSON.stringify(body.payload_json) : null).run();
    return json({ ok: true, message: 'Notification job queued.' }, 201);
  }

  const notification_job_id = Number(body.notification_job_id);
  if (!Number.isInteger(notification_job_id) || notification_job_id <= 0) return json({ ok: false, error: 'notification_job_id is required.' }, 400);

  if (action === 'retry') {
    await env.DB.prepare(`
      UPDATE notification_jobs
      SET status = 'queued', next_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE notification_job_id = ?
    `).bind(notification_job_id).run();
    return json({ ok: true, message: 'Notification job queued for retry.' });
  }

  if (action === 'mark_sent') {
    await env.DB.prepare(`
      UPDATE notification_jobs
      SET status = 'sent', last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE notification_job_id = ?
    `).bind(notification_job_id).run();
    return json({ ok: true, message: 'Notification job marked sent.' });
  }

  return json({ ok: false, error: 'Unsupported action.' }, 400);
}
