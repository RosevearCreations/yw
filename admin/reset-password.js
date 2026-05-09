// File: /functions/api/admin/reset-password.js

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

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input) {
  const encoded = new TextEncoder().encode(String(input || ""));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

async function formatStoredPasswordHashFromPlaintext(password) {
  const hex = await sha256Hex(password);
  return `sha256$${hex}`;
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
  const new_password = String(body.new_password || "");
  const confirm_password = String(body.confirm_password || "");
  const clear_sessions = body.clear_sessions !== false;

  if (!Number.isInteger(user_id) || user_id <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  if (!new_password) {
    return json({ ok: false, error: "New password is required." }, 400);
  }

  if (new_password.length < 8) {
    return json({ ok: false, error: "New password must be at least 8 characters." }, 400);
  }

  if (new_password !== confirm_password) {
    return json({ ok: false, error: "Passwords do not match." }, 400);
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

  const password_hash = await formatStoredPasswordHashFromPlaintext(new_password);

  await env.DB.prepare(`
    UPDATE users
    SET
      password_hash = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `)
    .bind(password_hash, user_id)
    .run();

  let deleted_sessions = 0;

  if (clear_sessions) {
    const sessionsResult = await env.DB.prepare(`
      SELECT
        session_id
      FROM sessions
      WHERE user_id = ?
    `)
      .bind(user_id)
      .all();

    let sessionIds = (Array.isArray(sessionsResult?.results) ? sessionsResult.results : [])
      .map((row) => Number(row.session_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (user_id === adminUser.user_id) {
      sessionIds = sessionIds.filter((id) => id !== adminUser.session_id);
    }

    if (sessionIds.length) {
      const placeholders = sessionIds.map(() => "?").join(", ");

      await env.DB.prepare(`
        DELETE FROM sessions
        WHERE session_id IN (${placeholders})
      `)
        .bind(...sessionIds)
        .run();

      deleted_sessions = sessionIds.length;
    }
  }

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
    message: "Password reset successfully.",
    reset_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    user: {
      user_id: Number(updatedUser?.user_id || user_id || 0),
      email: updatedUser?.email || "",
      display_name: updatedUser?.display_name || "",
      role: updatedUser?.role || "member",
      is_active: Number(updatedUser?.is_active || 0),
      created_at: updatedUser?.created_at || null,
      updated_at: updatedUser?.updated_at || null
    },
    sessions: {
      cleared_other_sessions: !!clear_sessions,
      deleted_sessions
    }
  });
}
