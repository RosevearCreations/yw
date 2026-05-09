// File: /functions/api/admin/app-settings.js
// Brief description: Gets and updates saved app settings for wider enforcement across the site.

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
    SELECT setting_key, setting_value, is_public, updated_at
    FROM app_settings
    ORDER BY setting_key ASC
  `).all());

  return json({ ok: true, settings: rows.map((row) => ({
    setting_key: row.setting_key || '',
    setting_value: row.setting_value || '',
    is_public: Number(row.is_public || 0),
    updated_at: row.updated_at || null
  })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
  const setting_key = normalizeText(body.setting_key);
  const setting_value = typeof body.setting_value === 'string' ? body.setting_value : JSON.stringify(body.setting_value ?? '');
  const is_public = Number(body.is_public) === 1 ? 1 : 0;
  if (!setting_key) return json({ ok: false, error: 'setting_key is required.' }, 400);

  await env.DB.prepare(`
    INSERT INTO app_settings (setting_key, setting_value, is_public, updated_by_user_id, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      is_public = excluded.is_public,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(setting_key, setting_value, is_public, adminUser.user_id).run();

  return json({ ok: true, message: 'Setting saved.', setting_key });
}
