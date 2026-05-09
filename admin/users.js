// File: /functions/api/admin/users.js
// Brief description: Returns the admin user directory with contact/profile summary fields
// so admins can manage customers and employees with stronger profile visibility.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
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
    SELECT s.session_id, s.user_id, s.session_token, s.token, s.expires_at,
           u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active
    FROM sessions s
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || "").toLowerCase() !== "admin") return null;

  return {
    session_id: Number(session.session_id || 0),
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || "",
    display_name: session.display_name || ""
  };
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  return ["member", "admin"].includes(role) ? role : "";
}

function normalizeActive(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (["1", "true", "active", "yes"].includes(normalized)) return 1;
  if (["0", "false", "inactive", "no"].includes(normalized)) return 0;
  return null;
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const roleFilter = normalizeRole(url.searchParams.get("role"));
  const activeFilter = normalizeActive(url.searchParams.get("is_active"));
  const search = normalizeText(url.searchParams.get("search")).toLowerCase();

  const conditions = [];
  const bindings = [];

  if (roleFilter) {
    conditions.push(`LOWER(COALESCE(u.role, '')) = ?`);
    bindings.push(roleFilter);
  }

  if (activeFilter !== null) {
    conditions.push(`COALESCE(u.is_active, 0) = ?`);
    bindings.push(activeFilter);
  }

  if (search) {
    conditions.push(`(
      LOWER(COALESCE(u.email, '')) LIKE ?
      OR LOWER(COALESCE(u.display_name, '')) LIKE ?
      OR LOWER(COALESCE(up.preferred_name, '')) LIKE ?
      OR LOWER(COALESCE(up.phone, '')) LIKE ?
      OR LOWER(COALESCE(up.company_name, '')) LIKE ?
      OR CAST(u.user_id AS TEXT) LIKE ?
    )`);
    const like = `%${search}%`;
    bindings.push(like, like, like, like, like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    WITH session_counts AS (
      SELECT
        s.user_id,
        COUNT(*) AS total_sessions,
        SUM(CASE WHEN s.expires_at > datetime('now') THEN 1 ELSE 0 END) AS active_sessions,
        SUM(CASE WHEN s.expires_at <= datetime('now') THEN 1 ELSE 0 END) AS expired_sessions
      FROM sessions s
      GROUP BY s.user_id
    ),
    tier_rollup AS (
      SELECT
        uat.user_id,
        GROUP_CONCAT(at.code, ', ') AS access_tier_codes
      FROM user_access_tiers uat
      JOIN access_tiers at ON at.access_tier_id = uat.access_tier_id
      GROUP BY uat.user_id
    )
    SELECT
      u.user_id,
      u.email,
      u.display_name,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at,
      COALESCE(sc.total_sessions, 0) AS total_sessions,
      COALESCE(sc.active_sessions, 0) AS active_sessions,
      COALESCE(sc.expired_sessions, 0) AS expired_sessions,
      up.profile_type,
      up.preferred_name,
      up.phone,
      COALESCE(up.phone_verified, 0) AS phone_verified,
      COALESCE(up.email_verified, 0) AS email_verified,
      up.preferred_contact_method,
      up.company_name,
      up.city,
      up.province,
      up.country,
      up.department,
      up.job_title,
      COALESCE(tr.access_tier_codes, '') AS access_tier_codes
    FROM users u
    LEFT JOIN session_counts sc ON sc.user_id = u.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.user_id
    LEFT JOIN tier_rollup tr ON tr.user_id = u.user_id
    ${whereClause}
    ORDER BY
      CASE WHEN LOWER(COALESCE(u.role, '')) = 'admin' THEN 0 ELSE 1 END,
      u.created_at DESC,
      u.user_id DESC
  `;

  const result = bindings.length
    ? await env.DB.prepare(sql).bind(...bindings).all()
    : await env.DB.prepare(sql).all();

  return json({
    ok: true,
    requested_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    users: normalizeResults(result).map((row) => ({
      user_id: Number(row.user_id || 0),
      email: row.email || "",
      display_name: row.display_name || "",
      role: row.role || "member",
      is_active: Number(row.is_active || 0),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      total_sessions: Number(row.total_sessions || 0),
      active_sessions: Number(row.active_sessions || 0),
      expired_sessions: Number(row.expired_sessions || 0),
      profile_type: row.profile_type || "",
      preferred_name: row.preferred_name || "",
      phone: row.phone || "",
      phone_verified: Number(row.phone_verified || 0),
      email_verified: Number(row.email_verified || 0),
      preferred_contact_method: row.preferred_contact_method || "",
      company_name: row.company_name || "",
      city: row.city || "",
      province: row.province || "",
      country: row.country || "",
      department: row.department || "",
      job_title: row.job_title || "",
      access_tier_codes: row.access_tier_codes || ""
    }))
  });
}
