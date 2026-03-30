// functions/api/_lib/staff-session.js
//
// Shared staff session helpers.
//
// What this file does:
// - creates secure opaque session tokens for staff logins
// - stores only a token hash in Supabase
// - reads/writes the staff session cookie
// - loads the current session + staff user
// - supports session rotation and logout invalidation
// - allows a safe fallback secret if STAFF_SESSION_SECRET is not set yet
//
// Expected env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - STAFF_SESSION_SECRET (preferred, but fallback now supported)

const STAFF_SESSION_COOKIE = "rd_staff_session";
const DEFAULT_SESSION_DAYS = 14;
const SESSION_ROTATE_AFTER_HOURS = 24;

/* ---------------- public helpers ---------------- */

export function getStaffSessionCookieName() {
  return STAFF_SESSION_COOKIE;
}

export function serviceHeaders(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export async function createStaffSession({
  env,
  staffUser,
  request,
  days = DEFAULT_SESSION_DAYS
}) {
  assertSessionEnv(env);

  if (!staffUser || !staffUser.id) {
    throw new Error("createStaffSession requires a valid staff user.");
  }

  const rawToken = await makeOpaqueSessionToken(env, staffUser.id);
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const payload = {
    staff_user_id: staffUser.id,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    ip_address: getClientIp(request),
    user_agent: getUserAgent(request),
    last_seen_at: now.toISOString()
  };

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/staff_auth_sessions`, {
    method: "POST",
    headers: {
      ...serviceHeaders(env),
      Prefer: "return=representation"
    },
    body: JSON.stringify([payload])
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not create staff session. ${text}`);
  }

  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] || null : null;

  return {
    token: rawToken,
    session: row,
    cookie: buildSessionCookie(rawToken, {
      expiresAt
    })
  };
}

export async function getCurrentStaffSession({ env, request }) {
  assertSessionEnv(env);

  const rawToken = readCookie(request, STAFF_SESSION_COOKIE);
  if (!rawToken) {
    return {
      ok: true,
      session: null,
      staff_user: null,
      needs_rotation: false
    };
  }

  const tokenHash = await sha256Hex(rawToken);

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_auth_sessions` +
      `?select=id,staff_user_id,created_at,updated_at,expires_at,revoked_at,last_seen_at,ip_address,user_agent,` +
      `staff_user:staff_users!staff_auth_sessions_staff_user_id_fkey(id,created_at,updated_at,full_name,email,role_code,is_active,` +
      `can_override_lower_entries,can_manage_bookings,can_manage_blocks,can_manage_progress,can_manage_promos,can_manage_staff,notes)` +
      `&token_hash=eq.${encodeURIComponent(tokenHash)}` +
      `&limit=1`,
    {
      headers: serviceHeaders(env)
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not load current staff session. ${text}`);
  }

  const rows = await res.json().catch(() => []);
  const session = Array.isArray(rows) ? rows[0] || null : null;

  if (!session) {
    return {
      ok: true,
      session: null,
      staff_user: null,
      needs_rotation: false,
      clear_cookie: buildClearSessionCookie()
    };
  }

  if (session.revoked_at) {
    return {
      ok: true,
      session: null,
      staff_user: null,
      needs_rotation: false,
      clear_cookie: buildClearSessionCookie()
    };
  }

  const expiresAtMs = Date.parse(session.expires_at || "");
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return {
      ok: true,
      session: null,
      staff_user: null,
      needs_rotation: false,
      clear_cookie: buildClearSessionCookie()
    };
  }

  const staffUser = normalizeStaffUser(session.staff_user);
  if (!staffUser || staffUser.is_active !== true) {
    return {
      ok: true,
      session: null,
      staff_user: null,
      needs_rotation: false,
      clear_cookie: buildClearSessionCookie()
    };
  }

  const needsRotation = shouldRotateSession(session);

  return {
    ok: true,
    session,
    staff_user: staffUser,
    needs_rotation: needsRotation,
    raw_token: rawToken
  };
}

export async function touchStaffSession({ env, sessionId, request }) {
  assertSessionEnv(env);

  if (!sessionId) return;

  const patch = {
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    ip_address: getClientIp(request),
    user_agent: getUserAgent(request)
  };

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_auth_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(env),
        Prefer: "return=minimal"
      },
      body: JSON.stringify(patch)
    }
  ).catch(() => null);
}

export async function revokeStaffSessionByToken({ env, token }) {
  assertSessionEnv(env);

  if (!token) return;

  const tokenHash = await sha256Hex(token);

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(env),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  ).catch(() => null);
}

export async function rotateStaffSession({ env, request, currentSession, staffUser }) {
  assertSessionEnv(env);

  if (!currentSession || !currentSession.id || !staffUser || !staffUser.id) {
    throw new Error("rotateStaffSession requires current session and staff user.");
  }

  await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_auth_sessions?id=eq.${encodeURIComponent(currentSession.id)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(env),
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  ).catch(() => null);

  return createStaffSession({
    env,
    staffUser,
    request,
    days: DEFAULT_SESSION_DAYS
  });
}

export function buildClearSessionCookie() {
  return [
    `${STAFF_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Secure"
  ].join("; ");
}

export function appendSetCookie(headers, cookieValue) {
  if (!headers || !cookieValue) return headers;

  const out = headers instanceof Headers ? new Headers(headers) : new Headers(headers || {});
  out.append("Set-Cookie", cookieValue);
  return out;
}

/* ---------------- cookie + token helpers ---------------- */

function buildSessionCookie(token, { expiresAt }) {
  const maxAge = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );

  return [
    `${STAFF_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`,
    "Secure"
  ].join("; ");
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;

    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

async function makeOpaqueSessionToken(env, staffUserId) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomHex = [...randomBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const secret = getSessionSecret(env);
  const base = `${staffUserId}.${Date.now()}.${randomHex}.${secret}`;
  const digest = await sha256Hex(base);

  return `${randomHex}.${digest}`;
}

function getSessionSecret(env) {
  return (
    env.STAFF_SESSION_SECRET ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.ADMIN_PASSWORD ||
    "rosie-dev-fallback-staff-secret"
  );
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------- staff/session normalization ---------------- */

function normalizeStaffUser(row) {
  if (!row || typeof row !== "object") return null;

  return {
    id: row.id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    full_name: row.full_name || null,
    email: row.email || null,
    role_code: row.role_code || null,
    is_active: row.is_active === true,
    can_override_lower_entries: row.can_override_lower_entries === true,
    can_manage_bookings: row.can_manage_bookings === true,
    can_manage_blocks: row.can_manage_blocks === true,
    can_manage_progress: row.can_manage_progress === true,
    can_manage_promos: row.can_manage_promos === true,
    can_manage_staff: row.can_manage_staff === true,
    notes: row.notes || null,
    is_admin: String(row.role_code || "") === "admin",
    is_senior_detailer: String(row.role_code || "") === "senior_detailer",
    is_detailer: String(row.role_code || "") === "detailer"
  };
}

function shouldRotateSession(session) {
  const updatedAt = Date.parse(session.updated_at || session.last_seen_at || session.created_at || "");
  if (!Number.isFinite(updatedAt)) return true;

  const ageMs = Date.now() - updatedAt;
  return ageMs >= SESSION_ROTATE_AFTER_HOURS * 60 * 60 * 1000;
}

/* ---------------- request helpers ---------------- */

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    null
  );
}

function getUserAgent(request) {
  return request.headers.get("user-agent") || null;
}

function assertSessionEnv(env) {
  if (!env || !env.SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL.");
  }

  if (!env || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
}
