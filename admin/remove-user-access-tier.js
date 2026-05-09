// File: /functions/api/admin/remove-user-access-tier.js

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

export async function onRequestPost(context) {
  const { request, env } = context;

  const authCheck = await requireAdmin(request, env);
  if (authCheck.error) return authCheck.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const user_access_tier_id = Number(body.user_access_tier_id);

  if (!Number.isInteger(user_access_tier_id) || user_access_tier_id <= 0) {
    return json({ ok: false, error: "A valid user_access_tier_id is required." }, 400);
  }

  const existingAssignment = await env.DB.prepare(`
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
      at.description
    FROM user_access_tiers uat
    JOIN access_tiers at
      ON uat.access_tier_id = at.access_tier_id
    WHERE uat.user_access_tier_id = ?
    LIMIT 1
  `)
    .bind(user_access_tier_id)
    .first();

  if (!existingAssignment) {
    return json({ ok: false, error: "Assigned access tier not found." }, 404);
  }

  await env.DB.prepare(`
    DELETE FROM user_access_tiers
    WHERE user_access_tier_id = ?
  `)
    .bind(user_access_tier_id)
    .run();

  return json({
    ok: true,
    message: "Access tier removed successfully.",
    assignment: existingAssignment
  });
}
