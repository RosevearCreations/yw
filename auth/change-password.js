// File: /functions/api/auth/change-password.js
// Brief description: Changes the password for the currently authenticated user.
// It verifies the current password, writes the new normalized password hash,
// and updates the user record while keeping the active session model consistent
// with the rest of auth.

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

async function verifyStoredPasswordHash(password, storedHash) {
  const normalizedStoredHash = String(storedHash || "").trim();

  if (!normalizedStoredHash) {
    return false;
  }

  if (normalizedStoredHash.startsWith("sha256$")) {
    const expected = normalizedStoredHash.slice("sha256$".length);
    const actual = await sha256Hex(password);
    return actual === expected;
  }

  return false;
}

async function formatStoredPasswordHashFromPlaintext(password) {
  const hex = await sha256Hex(password);
  return `sha256$${hex}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const token = getBearerToken(request);

  if (!token) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const sessionUser = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
      s.session_token,
      s.token,
      s.expires_at,
      u.user_id AS resolved_user_id,
      u.email,
      u.password_hash,
      u.display_name,
      u.role,
      u.is_active,
      u.created_at,
      u.updated_at
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

  if (!sessionUser) {
    return json({ ok: false, error: "Invalid or expired session." }, 401);
  }

  if (Number(sessionUser.is_active || 0) !== 1) {
    return json({ ok: false, error: "Account is inactive." }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const current_password = String(body.current_password || "");
  const new_password = String(body.new_password || "");

  if (!current_password) {
    return json({ ok: false, error: "Current password is required." }, 400);
  }

  if (!new_password) {
    return json({ ok: false, error: "New password is required." }, 400);
  }

  if (new_password.length < 8) {
    return json({ ok: false, error: "New password must be at least 8 characters." }, 400);
  }

  const currentMatches = await verifyStoredPasswordHash(
    current_password,
    sessionUser.password_hash
  );

  if (!currentMatches) {
    return json({ ok: false, error: "Current password is incorrect." }, 401);
  }

  const newMatchesCurrent = await verifyStoredPasswordHash(
    new_password,
    sessionUser.password_hash
  );

  if (newMatchesCurrent) {
    return json({
      ok: false,
      error: "New password must be different from the current password."
    }, 400);
  }

  const new_password_hash = await formatStoredPasswordHashFromPlaintext(new_password);

  await env.DB.prepare(`
    UPDATE users
    SET
      password_hash = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `)
    .bind(
      new_password_hash,
      Number(sessionUser.resolved_user_id || sessionUser.user_id || 0)
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
    .bind(Number(sessionUser.resolved_user_id || sessionUser.user_id || 0))
    .first();

  return json({
    ok: true,
    message: "Password changed successfully.",
    user: {
      user_id: Number(updatedUser?.user_id || sessionUser.resolved_user_id || sessionUser.user_id || 0),
      email: updatedUser?.email || sessionUser.email || "",
      display_name: updatedUser?.display_name || sessionUser.display_name || "",
      role: updatedUser?.role || sessionUser.role || "member",
      is_active: Number(updatedUser?.is_active || sessionUser.is_active || 0),
      created_at: updatedUser?.created_at || null,
      updated_at: updatedUser?.updated_at || null
    }
  });
}
