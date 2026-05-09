import { getDb, getRequestToken, normalizeText } from './adminAudit.js';
import { verifyStoredPasswordHash } from './passwordHash.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function requireAdminStepUp(request, env, adminUser, body = {}, purpose = 'sensitive action') {
  if (!adminUser?.user_id) return { ok: false, response: json({ ok: false, error: 'Unauthorized.' }, 401) };
  const db = getDb(env);
  const confirmPassword = String(body.confirm_password || '').trim();
  const token = getRequestToken(request);
  if (!confirmPassword) {
    return {
      ok: false,
      response: json({ ok: false, error: `Please confirm your password before this ${purpose}.`, requires_step_up: true }, 403)
    };
  }
  const row = await db.prepare(`
    SELECT u.user_id, u.password_hash, s.expires_at
    FROM users u
    INNER JOIN sessions s ON s.user_id = u.user_id
    WHERE u.user_id = ?
      AND (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(Number(adminUser.user_id || 0), token, token).first().catch(() => null);
  if (!row) {
    return { ok: false, response: json({ ok: false, error: 'Invalid or expired admin session.' }, 401) };
  }
  const verified = await verifyStoredPasswordHash(confirmPassword, row.password_hash);
  if (!verified) {
    return { ok: false, response: json({ ok: false, error: 'Password confirmation failed.', requires_step_up: true }, 403) };
  }
  return { ok: true };
}
