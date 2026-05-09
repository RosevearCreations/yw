// File: /functions/api/admin/user-update.js

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

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  return ["member", "admin"].includes(role) ? role : "";
}

function normalizeIsActive(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return null;
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

async function countActiveAdmins(env) {
  const row = await env.DB.prepare(`
    SELECT
      SUM(CASE
        WHEN LOWER(COALESCE(role, '')) = 'admin'
         AND COALESCE(is_active, 0) = 1
        THEN 1 ELSE 0
      END) AS active_admin_users
    FROM users
  `).first();

  return Number(row?.active_admin_users || 0);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const adminUser = await getAdminUserFromRequest(request, env);

  if (!adminUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const user_id = Number(body.user_id);
  const display_name =
    body.display_name !== undefined
      ? normalizeText(body.display_name)
      : undefined;
  const role =
    body.role !== undefined
      ? normalizeRole(body.role)
      : undefined;
  const is_active =
    body.is_active !== undefined
      ? normalizeIsActive(body.is_active)
      : undefined;

  if (!Number.isInteger(user_id) || user_id <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  if (
    display_name === undefined &&
    role === undefined &&
    is_active === undefined
  ) {
    return json({ ok: false, error: "At least one field must be provided to update." }, 400);
  }

  if (body.role !== undefined && !role) {
    return json({ ok: false, error: "Role must be member or admin." }, 400);
  }

  if (body.is_active !== undefined && is_active === null) {
    return json({ ok: false, error: "is_active must be 1 or 0." }, 400);
  }

  const targetUser = await env.DB.prepare(`
    SELECT
      user_id,
      email,
      display_name,
      role,
      is_active,
      created_at,
      updated_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `)
    .bind(user_id)
    .first();

  if (!targetUser) {
    return json({ ok: false, error: "User not found." }, 404);
  }

  const currentRole = String(targetUser.role || "").toLowerCase();
  const currentIsActive = Number(targetUser.is_active || 0);
  const isSelf = user_id === adminUser.user_id;

  if (isSelf && role && role !== "admin") {
    return json({ ok: false, error: "You cannot remove your own admin role." }, 400);
  }

  if (isSelf && is_active === 0) {
    return json({ ok: false, error: "You cannot deactivate your own account." }, 400);
  }

  const activeAdminUsers = await countActiveAdmins(env);
  const targetIsActiveAdmin =
    currentRole === "admin" && currentIsActive === 1;

  if (targetIsActiveAdmin && activeAdminUsers <= 1) {
    if (role && role !== "admin") {
      return json({ ok: false, error: "You cannot demote the last active admin." }, 400);
    }

    if (is_active === 0) {
      return json({ ok: false, error: "You cannot deactivate the last active admin." }, 400);
    }
  }

  const nextDisplayName =
    display_name !== undefined ? (display_name || null) : targetUser.display_name;
  const nextRole =
    role !== undefined ? role : currentRole;
  const nextIsActive =
    is_active !== undefined ? is_active : currentIsActive;

  await env.DB.prepare(`
    UPDATE users
    SET
      display_name = ?,
      role = ?,
      is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `)
    .bind(
      nextDisplayName,
      nextRole,
      nextIsActive,
      user_id
    )
    .run();

  const updatedUser = await env.DB.prepare(`
    SELECT
      user_id,
      email,
      display_name,
      role,
      is_active,
      created_at,
      updated_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `)
    .bind(user_id)
    .first();

  return json({
    ok: true,
    message: "User updated successfully.",
    updated_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    user: {
      user_id: Number(updatedUser?.user_id || user_id || 0),
      email: updatedUser?.email || "",
      display_name: updatedUser?.display_name || "",
      role: updatedUser?.role || nextRole,
      is_active: Number(updatedUser?.is_active || nextIsActive || 0),
      created_at: updatedUser?.created_at || null,
      updated_at: updatedUser?.updated_at || null
    }
  });
}
