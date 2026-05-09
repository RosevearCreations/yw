// File: /functions/api/admin/user-access-tiers.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function getSessionUser(env, token) {
  if (!token) return null;

  const sessionUser = await env.DB.prepare(`
    SELECT
      users.user_id,
      users.email,
      users.display_name,
      users.role,
      users.is_active
    FROM sessions
    JOIN users ON sessions.user_id = users.user_id
    WHERE sessions.session_token = ?
      AND sessions.expires_at > datetime('now')
    LIMIT 1
  `)
    .bind(token)
    .first();

  return sessionUser || null;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { error: json({ ok: false, error: "Unauthorized." }, 401) };
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return { error: json({ ok: false, error: "Missing session token." }, 401) };
  }

  const sessionUser = await getSessionUser(env, token);

  if (!sessionUser) {
    return { error: json({ ok: false, error: "Invalid session." }, 401) };
  }

  if (!sessionUser.is_active) {
    return { error: json({ ok: false, error: "Account is inactive." }, 403) };
  }

  if (sessionUser.role !== "admin") {
    return { error: json({ ok: false, error: "Forbidden." }, 403) };
  }

  return { sessionUser };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const authCheck = await requireAdmin(request, env);
  if (authCheck.error) return authCheck.error;

  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("user_id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT
      user_id,
      email,
      display_name,
      role,
      is_active,
      created_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `)
    .bind(userId)
    .first();

  if (!user) {
    return json({ ok: false, error: "User not found." }, 404);
  }

  const result = await env.DB.prepare(`
    SELECT
      uat.user_access_tier_id,
      uat.user_id,
      uat.access_tier_id,
      uat.granted_at,
      uat.expires_at,
      uat.granted_by_user_id,
      uat.notes,
      at.code,
      at.name,
      at.description,
      at.is_active
    FROM user_access_tiers uat
    JOIN access_tiers at
      ON uat.access_tier_id = at.access_tier_id
    WHERE uat.user_id = ?
    ORDER BY at.name ASC, uat.user_access_tier_id ASC
  `)
    .bind(userId)
    .all();

  return json({
    ok: true,
    user,
    access_tiers: result.results || []
  });
}
