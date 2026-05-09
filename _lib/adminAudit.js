export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...extraHeaders
    }
  });
}

export function normalizeText(value) {
  return String(value || "").trim();
}

export function getDb(env) {
  return env.DB || env.DD_DB;
}

export function getClientIp(request) {
  return normalizeText(
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    ''
  );
}

export function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  return raw.split(/;\s*/).reduce((acc, part) => {
    if (!part) return acc;
    const eq = part.indexOf("=");
    if (eq === -1) return acc;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try { acc[key] = decodeURIComponent(value); } catch { acc[key] = value; }
    return acc;
  }, {});
}

export function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

export function getRequestToken(request) {
  const bearer = getBearerToken(request);
  if (bearer) return bearer;
  const cookies = parseCookies(request);
  return normalizeText(cookies.dd_auth_token || '');
}

export async function getAdminUserFromRequest(request, env) {
  const db = getDb(env);
  const token = getRequestToken(request);
  if (!token || !db) return null;

  try {
    const session = await db.prepare(`
      SELECT s.session_id, s.user_id, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active
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
      display_name: session.display_name || ''
    };
  } catch {
    return null;
  }
}

export async function auditAdminAction(env, request, adminUser, payload = {}) {
  const db = getDb(env);
  if (!db || !adminUser?.user_id) return;
  try {
    await db.prepare(`
      INSERT INTO admin_action_audit (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        target_key,
        request_method,
        request_path,
        ip_address,
        user_agent,
        details_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      Number(adminUser.user_id || 0),
      normalizeText(payload.action_type) || 'admin_action',
      normalizeText(payload.target_type) || null,
      payload.target_id == null || payload.target_id === '' ? null : Number(payload.target_id),
      normalizeText(payload.target_key) || null,
      normalizeText(request.method) || null,
      new URL(request.url).pathname,
      getClientIp(request) || null,
      normalizeText(request.headers.get('User-Agent')) || null,
      JSON.stringify(payload.details || {})
    ).run();
  } catch {}
}


export async function captureRuntimeIncident(env, request, payload = {}) {
  const db = getDb(env);
  if (!db) return false;

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS runtime_incidents (
        runtime_incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_scope TEXT,
        incident_code TEXT,
        severity TEXT DEFAULT 'warning',
        endpoint_path TEXT,
        request_method TEXT,
        message TEXT,
        details_json TEXT,
        related_user_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {}

  try {
    await db.prepare(`
      INSERT INTO runtime_incidents (
        incident_scope,
        incident_code,
        severity,
        endpoint_path,
        request_method,
        message,
        details_json,
        related_user_id,
        ip_address,
        user_agent,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      normalizeText(payload.incident_scope) || 'runtime',
      normalizeText(payload.incident_code) || 'unspecified',
      normalizeText(payload.severity) || 'warning',
      new URL(request.url).pathname,
      normalizeText(request.method) || null,
      normalizeText(payload.message) || 'Runtime incident recorded.',
      JSON.stringify(payload.details || {}),
      payload.related_user_id == null || payload.related_user_id === '' ? null : Number(payload.related_user_id),
      getClientIp(request) || null,
      normalizeText(request.headers.get('User-Agent')) || null,
    ).run();
    return true;
  } catch {
    return false;
  }
}
