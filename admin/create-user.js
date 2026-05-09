// File: /functions/api/admin/create-user.js

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

function isValidEmail(email) {
  const value = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  return ["member", "admin"].includes(role) ? role : "";
}

function normalizeIsActive(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return 0;
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

  const email = normalizeText(body.email).toLowerCase();
  const display_name = normalizeText(body.display_name || body.name);
  const password = String(body.password || "");
  const confirm_password = String(body.confirm_password || body.password_confirm || "");
  const role = normalizeRole(body.role);
  const is_active = normalizeIsActive(body.is_active);

  if (!email) {
    return json({ ok: false, error: "Email is required." }, 400);
  }

  if (!isValidEmail(email)) {
    return json({ ok: false, error: "A valid email is required." }, 400);
  }

  if (!password) {
    return json({ ok: false, error: "Password is required." }, 400);
  }

  if (password.length < 8) {
    return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
  }

  if (password !== confirm_password) {
    return json({ ok: false, error: "Passwords do not match." }, 400);
  }

  if (!role) {
    return json({ ok: false, error: "Role must be member or admin." }, 400);
  }

  const existingUser = await env.DB.prepare(`
    SELECT
      user_id,
      email
    FROM users
    WHERE LOWER(email) = LOWER(?)
    LIMIT 1
  `)
    .bind(email)
    .first();

  if (existingUser) {
    return json({ ok: false, error: "An account with this email already exists." }, 409);
  }

  const password_hash = await formatStoredPasswordHashFromPlaintext(password);

  const insertResult = await env.DB.prepare(`
    INSERT INTO users (
      email,
      password_hash,
      display_name,
      role,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `)
    .bind(
      email,
      password_hash,
      display_name || null,
      role,
      is_active
    )
    .run();

  const user_id = insertResult?.meta?.last_row_id;

  if (!user_id) {
    return json({ ok: false, error: "User could not be created." }, 500);
  }

  const user = await env.DB.prepare(`
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
    .bind(Number(user_id))
    .first();

  return json({
    ok: true,
    message: "User created successfully.",
    created_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    user: {
      user_id: Number(user?.user_id || user_id || 0),
      email: user?.email || email,
      display_name: user?.display_name || "",
      role: user?.role || role,
      is_active: Number(user?.is_active || is_active),
      created_at: user?.created_at || null,
      updated_at: user?.updated_at || null
    }
  }, 201);
}
