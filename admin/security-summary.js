// File: /functions/api/admin/security-summary.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getAdminUserFromRequest(request, env) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const session = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
      s.session_token,
      s.token,
      s.expires_at,
      u.user_id AS resolved_user_id,
      u.email,
      u.display_name,
      u.role,
      u.is_active
    FROM sessions s
    INNER JOIN users u
      ON u.user_id = s.user_id
    WHERE (
      s.session_token = ?
      OR s.token = ?
    )
      AND s.expires_at > datetime('now')
    LIMIT 1
  `)
    .bind(token, token)
    .first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || "").toLowerCase() !== "admin") return null;

  return {
    session_id: Number(session.session_id || 0),
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || "",
    display_name: session.display_name || "",
    role: session.role || "admin"
  };
}

async function getSingleRow(env, sql) {
  const row = await env.DB.prepare(sql).first();
  return row || {};
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const userSummary = await getSingleRow(env, `
    SELECT
      COUNT(*) AS total_users,
      SUM(CASE WHEN COALESCE(is_active, 0) = 1 THEN 1 ELSE 0 END) AS active_users,
      SUM(CASE WHEN COALESCE(is_active, 0) = 0 THEN 1 ELSE 0 END) AS inactive_users,
      SUM(CASE WHEN LOWER(COALESCE(role, '')) = 'admin' THEN 1 ELSE 0 END) AS admin_users,
      SUM(CASE
        WHEN LOWER(COALESCE(role, '')) = 'admin'
         AND COALESCE(is_active, 0) = 1
        THEN 1 ELSE 0
      END) AS active_admin_users
    FROM users
  `);

  const sessionSummary = await getSingleRow(env, `
    SELECT
      COUNT(*) AS total_sessions,
      SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS active_sessions,
      SUM(CASE WHEN expires_at <= datetime('now') THEN 1 ELSE 0 END) AS expired_sessions
    FROM sessions
  `);

  const bootstrap_required = Number(userSummary.active_admin_users || 0) === 0;

  return json({
    ok: true,
    checked_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    summary: {
      total_users: Number(userSummary.total_users || 0),
      active_users: Number(userSummary.active_users || 0),
      inactive_users: Number(userSummary.inactive_users || 0),
      admin_users: Number(userSummary.admin_users || 0),
      active_admin_users: Number(userSummary.active_admin_users || 0),
      total_sessions: Number(sessionSummary.total_sessions || 0),
      active_sessions: Number(sessionSummary.active_sessions || 0),
      expired_sessions: Number(sessionSummary.expired_sessions || 0),
      bootstrap_required
    }
  });
}
