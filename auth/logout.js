// File: /functions/api/auth/logout.js
// Brief description: Logs out the current session tied to the bearer token or auth cookie.

function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }); }
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
  const token = getRequestToken(request);
  if (!token) return json({ ok: false, error: "Unauthorized." }, 401, { "Set-Cookie": clearSessionCookie(request) });
  const session = await env.DB.prepare(`SELECT session_id, user_id FROM sessions WHERE (session_token = ? OR token = ?) LIMIT 1`).bind(token, token).first();
  if (!session) return json({ ok: true, message: "Session was already logged out." }, 200, { "Set-Cookie": clearSessionCookie(request) });
  await env.DB.prepare(`DELETE FROM sessions WHERE session_id = ?`).bind(Number(session.session_id || 0)).run();
  return json({ ok: true, message: "Logged out successfully." }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
