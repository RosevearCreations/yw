// File: /functions/api/admin/assign-user-access-tier.js

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

function normalizeText(value) {
  return String(value || "").trim();
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

  const user_id = Number(body.user_id);
  const access_tier_id = Number(body.access_tier_id);
  const expires_at = normalizeText(body.expires_at) || null;
  const notes = normalizeText(body.notes) || null;

  if (!Number.isInteger(user_id) || user_id <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  if (!Number.isInteger(access_tier_id) || access_tier_id <= 0) {
    return json({ ok: false, error: "A valid access_tier_id is required." }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT
      user_id,
      email,
      display_name,
      role,
      is_active
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `)
    .bind(user_id)
    .first();

  if (!user) {
    return json({ ok: false, error: "User not found." }, 404);
  }

  const tier = await env.DB.prepare(`
    SELECT
      access_tier_id,
      code,
      name,
      is_active
    FROM access_tiers
    WHERE access_tier_id = ?
    LIMIT 1
  `)
    .bind(access_tier_id)
    .first();

  if (!tier) {
    return json({ ok: false, error: "Access tier not found." }, 404);
  }

  if (Number(tier.is_active) !== 1) {
    return json({ ok: false, error: "That access tier is inactive." }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT
      user_access_tier_id
    FROM user_access_tiers
    WHERE user_id = ?
      AND access_tier_id = ?
    LIMIT 1
  `)
    .bind(user_id, access_tier_id)
    .first();

  if (existing) {
    return json({ ok: false, error: "That tier is already assigned to this user." }, 409);
  }

  const insertResult = await env.DB.prepare(`
    INSERT INTO user_access_tiers (
      user_id,
      access_tier_id,
      granted_at,
      expires_at,
      granted_by_user_id,
      notes
    )
    VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
  `)
    .bind(
      user_id,
      access_tier_id,
      expires_at,
      authCheck.sessionUser.user_id,
      notes
    )
    .run();

  const newId = insertResult?.meta?.last_row_id;

  const createdAssignment = await env.DB.prepare(`
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
    .bind(newId)
    .first();

  return json({
    ok: true,
    message: "Access tier assigned successfully.",
    assignment: createdAssignment
  }, 201);
}
