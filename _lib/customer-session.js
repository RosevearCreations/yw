// functions/api/_lib/customer-session.js
// Shared customer session helpers.

const CUSTOMER_SESSION_COOKIE = "rd_client_session";
const DEFAULT_SESSION_DAYS = 14;
const SESSION_ROTATE_AFTER_HOURS = 24;

export function getCustomerSessionCookieName() {
  return CUSTOMER_SESSION_COOKIE;
}

export function serviceHeaders(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export async function createCustomerSession({ env, customerProfile, request, days = DEFAULT_SESSION_DAYS }) {
  assertSessionEnv(env);
  if (!customerProfile?.id) throw new Error("createCustomerSession requires a valid customer profile.");

  const rawToken = await makeOpaqueSessionToken(env, customerProfile.id);
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 86400000);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_sessions`, {
    method: "POST",
    headers: { ...serviceHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify([{
      customer_profile_id: customerProfile.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      ip_address: getClientIp(request),
      user_agent: getUserAgent(request),
      last_seen_at: now.toISOString()
    }])
  });
  if (!res.ok) throw new Error(`Could not create customer session. ${await res.text()}`);
  const rows = await res.json().catch(() => []);
  return {
    token: rawToken,
    session: Array.isArray(rows) ? rows[0] || null : null,
    cookie: buildSessionCookie(rawToken, { expiresAt })
  };
}

export async function getCurrentCustomerSession({ env, request }) {
  assertSessionEnv(env);
  const rawToken = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (!rawToken) return { ok: true, session: null, customer_profile: null, needs_rotation: false };

  const tokenHash = await sha256Hex(rawToken);
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/customer_auth_sessions` +
      `?select=id,customer_profile_id,created_at,updated_at,expires_at,revoked_at,last_seen_at,ip_address,user_agent,` +
      `customer_profile:customer_profiles!customer_auth_sessions_customer_profile_id_fkey(id,created_at,updated_at,email,full_name,phone,tier_code,notes,address_line1,address_line2,city,province,postal_code,vehicle_notes,is_active,notification_opt_in,notification_channel,detailer_chat_opt_in,email_verified_at)` +
      `&token_hash=eq.${encodeURIComponent(tokenHash)}` +
      `&limit=1`,
    { headers: serviceHeaders(env) }
  );
  if (!res.ok) throw new Error(`Could not load current customer session. ${await res.text()}`);

  const rows = await res.json().catch(() => []);
  const session = Array.isArray(rows) ? rows[0] || null : null;
  if (!session || session.revoked_at) return { ok: true, session: null, customer_profile: null, needs_rotation: false, clear_cookie: buildClearCustomerSessionCookie() };
  const expiresAtMs = Date.parse(session.expires_at || "");
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return { ok: true, session: null, customer_profile: null, needs_rotation: false, clear_cookie: buildClearCustomerSessionCookie() };

  const customerProfile = normalizeCustomerProfile(session.customer_profile);
  if (!customerProfile || customerProfile.is_active !== true) return { ok: true, session: null, customer_profile: null, needs_rotation: false, clear_cookie: buildClearCustomerSessionCookie() };

  return { ok: true, session, customer_profile: customerProfile, needs_rotation: shouldRotateSession(session), raw_token: rawToken };
}

export async function touchCustomerSession({ env, sessionId, request }) {
  assertSessionEnv(env);
  if (!sessionId) return;
  await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(env), Prefer: "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), ip_address: getClientIp(request), user_agent: getUserAgent(request) })
  }).catch(() => null);
}

export async function revokeCustomerSessionByToken({ env, token }) {
  assertSessionEnv(env);
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(env), Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }).catch(() => null);
}

export async function rotateCustomerSession({ env, request, currentSession, customerProfile }) {
  assertSessionEnv(env);
  if (!currentSession?.id || !customerProfile?.id) throw new Error("rotateCustomerSession requires current session and customer profile.");
  await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_sessions?id=eq.${encodeURIComponent(currentSession.id)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(env), Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }).catch(() => null);
  return createCustomerSession({ env, customerProfile, request, days: DEFAULT_SESSION_DAYS });
}

export function buildClearCustomerSessionCookie() {
  return [`${CUSTOMER_SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Secure"].join("; ");
}

export function appendSetCookie(headers, cookieValue) {
  const out = headers instanceof Headers ? new Headers(headers) : new Headers(headers || {});
  if (cookieValue) out.append("Set-Cookie", cookieValue);
  return out;
}

function buildSessionCookie(token, { expiresAt }) {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [`${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, `Expires=${expiresAt.toUTCString()}`, "Secure"].join("; ");
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === name) {
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return null;
}

async function makeOpaqueSessionToken(env, customerProfileId) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomHex = [...randomBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const base = `${customerProfileId}.${Date.now()}.${randomHex}.${getSessionSecret(env)}`;
  const digest = await sha256Hex(base);
  return `${randomHex}.${digest}`;
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input || ""));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeCustomerProfile(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    email: row.email || null,
    full_name: row.full_name || null,
    phone: row.phone || null,
    tier_code: row.tier_code || null,
    notes: row.notes || null,
    address_line1: row.address_line1 || null,
    address_line2: row.address_line2 || null,
    city: row.city || null,
    province: row.province || null,
    postal_code: row.postal_code || null,
    vehicle_notes: row.vehicle_notes || null,
    notification_opt_in: row.notification_opt_in === true,
    notification_channel: row.notification_channel || "email",
    detailer_chat_opt_in: row.detailer_chat_opt_in !== false,
    is_active: row.is_active === true
  };
}

function shouldRotateSession(session) {
  const updatedAt = Date.parse(session.updated_at || session.last_seen_at || session.created_at || "");
  return !Number.isFinite(updatedAt) || (Date.now() - updatedAt) >= SESSION_ROTATE_AFTER_HOURS * 3600000;
}
function getClientIp(request) { return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || null; }
function getUserAgent(request) { return request.headers.get("user-agent") || null; }
function getSessionSecret(env) { return env.CUSTOMER_SESSION_SECRET || env.ADMIN_PASSWORD || env.SUPABASE_SERVICE_ROLE_KEY || "rosiedazzlers-session-fallback"; }
function assertSessionEnv(env) { if (!env?.SUPABASE_URL) throw new Error("Missing SUPABASE_URL."); if (!env?.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY."); }
