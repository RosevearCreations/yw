// File: /functions/api/auth/logout-all.js
// Brief description: Logs out all sessions for the currently authenticated user.

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
  const sessionUser = await env.DB.prepare(`SELECT s.session_id, s.user_id, s.expires_at, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active FROM sessions s INNER JOIN users u ON u.user_id = s.user_id WHERE (s.session_token = ? OR s.token = ?) AND s.expires_at > datetime('now') LIMIT 1`).bind(token, token).first();
  if (!sessionUser) return json({ ok: false, error: "Invalid or expired session." }, 401, { "Set-Cookie": clearSessionCookie(request) });
  if (Number(sessionUser.is_active || 0) !== 1) return json({ ok: false, error: "Account is inactive." }, 403, { "Set-Cookie": clearSessionCookie(request) });
  const user_id = Number(sessionUser.resolved_user_id || sessionUser.user_id || 0);
  const sessionsResult = await env.DB.prepare(`SELECT session_id FROM sessions WHERE user_id = ?`).bind(user_id).all();
  const sessionIds = (Array.isArray(sessionsResult?.results) ? sessionsResult.results : []).map((row) => Number(row.session_id || 0)).filter((id) => Number.isInteger(id) && id > 0);
  if (sessionIds.length) {
    const placeholders = sessionIds.map(() => '?').join(', ');
    await env.DB.prepare(`DELETE FROM sessions WHERE session_id IN (${placeholders})`).bind(...sessionIds).run();
  }
  return json({ ok: true, message: "All sessions were logged out successfully.", deleted_sessions: sessionIds.length }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
