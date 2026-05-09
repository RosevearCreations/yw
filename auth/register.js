// File: /functions/api/auth/register.js
// Brief description: Registers a new member account, creates an initial session,
// and returns the user plus session token expected by the shared public/js/auth.js helper.

function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }); }
function normalizeText(value) { return String(value || "").trim(); }
function normalizeEmail(value) { return normalizeText(value).toLowerCase(); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()); }
function toHex(buffer) { return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function sha256Hex(input) { const encoded = new TextEncoder().encode(String(input || "")); const digest = await crypto.subtle.digest("SHA-256", encoded); return toHex(digest); }
async function formatStoredPasswordHashFromPlaintext(password) { return `sha256$${await sha256Hex(password)}`; }
function makeSessionToken() { return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`; }
function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  return raw.split(/;\s*/).reduce((acc, part) => {
    if (!part) return acc;
    const eq = part.indexOf("=");
    if (eq === -1) return acc;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try { acc[key] = decodeURIComponent(value); } catch { acc[key] = value; }
    return acc;
  }, {});
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function getRequestToken(request) {
  const bearer = getBearerToken(request);
  if (bearer) return bearer;
  const cookies = parseCookies(request);
  return String(cookies.dd_auth_token || "").trim();
}

function buildSessionCookie(request, token, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const host = String(url.hostname || "").toLowerCase();
  const parts = [
    `dd_auth_token=${encodeURIComponent(String(token || ""))}`,
    'Path=/',
    `Max-Age=${Number(maxAgeSeconds || 0)}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secure) parts.push('Secure');
  if (host === 'devilndove.com' || host.endsWith('.devilndove.com')) parts.push('Domain=.devilndove.com');
  return parts.join('; ');
}

function clearSessionCookie(request) {
  return buildSessionCookie(request, '', 0);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON body." }, 400); }
  const email = normalizeEmail(body.email);
  const display_name = normalizeText(body.display_name || body.name);
  const password = String(body.password || "");
  const password_confirm = String(body.password_confirm || body.confirm_password || "");
  if (!email) return json({ ok: false, error: "Email is required." }, 400);
  if (!isValidEmail(email)) return json({ ok: false, error: "A valid email is required." }, 400);
  if (!password) return json({ ok: false, error: "Password is required." }, 400);
  if (password.length < 8) return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
  if (password !== password_confirm) return json({ ok: false, error: "Passwords do not match." }, 400);
  const existingUser = await env.DB.prepare(`SELECT user_id, email FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`).bind(email).first();
  if (existingUser) return json({ ok: false, error: "An account with this email already exists." }, 409);
  const password_hash = await formatStoredPasswordHashFromPlaintext(password);
  const insertResult = await env.DB.prepare(`INSERT INTO users (email, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, 'member', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(email, password_hash, display_name || null).run();
  const user_id = Number(insertResult?.meta?.last_row_id || 0);
  if (!user_id) return json({ ok: false, error: "Account could not be created." }, 500);
  const sessionToken = makeSessionToken();
  await env.DB.prepare(`INSERT INTO sessions (user_id, session_token, token, expires_at, created_at) VALUES (?, ?, ?, datetime('now', '+30 days'), CURRENT_TIMESTAMP)`).bind(user_id, sessionToken, sessionToken).run();
  const user = await env.DB.prepare(`SELECT user_id, email, display_name, role, is_active, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1`).bind(user_id).first();
  const session = await env.DB.prepare(`SELECT session_id, user_id, session_token, token, expires_at, created_at FROM sessions WHERE user_id = ? ORDER BY session_id DESC LIMIT 1`).bind(user_id).first();
  return json({ ok: true, message: "Account created successfully.", session_token: session?.session_token || sessionToken, token: session?.token || sessionToken, session: { session_id: Number(session?.session_id || 0), session_token: session?.session_token || sessionToken, token: session?.token || sessionToken, expires_at: session?.expires_at || null, created_at: session?.created_at || null }, user: { user_id: Number(user?.user_id || user_id || 0), email: user?.email || email, display_name: user?.display_name || "", role: user?.role || "member", is_active: Number(user?.is_active || 1), created_at: user?.created_at || null, updated_at: user?.updated_at || null } }, 201, { "Set-Cookie": buildSessionCookie(request, session?.session_token || sessionToken) });
}
