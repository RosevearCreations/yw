import { getDb, getRequestToken, jsonResponse } from "../_lib/adminAudit.js";

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function getMemberUserFromRequest(request, env) {
  const db = getDb(env);
  const token = getRequestToken(request);
  if (!db || !token) return null;
  try {
    const session = await db.prepare(`
      SELECT s.session_id, s.user_id, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active
      FROM sessions s
      JOIN users u ON u.user_id=s.user_id
      WHERE (s.session_token=? OR s.token=?)
        AND s.expires_at > datetime('now')
      LIMIT 1
    `).bind(token, token).first();
    if (!session) return null;
    if (Number(session.is_active || 0) !== 1) return null;
    const role = String(session.role || '').toLowerCase();
    if (!['member','admin'].includes(role)) return null;
    return { user_id: Number(session.resolved_user_id || session.user_id || 0), role };
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok:false, error:'Database binding is not configured.' }, 500);
  const memberUser = await getMemberUserFromRequest(context.request, context.env);
  if (!memberUser) return jsonResponse({ ok:false, error:'Unauthorized.' }, 401);

  const assigned = await db.prepare(`
    SELECT LOWER(at.code) AS code
    FROM user_access_tiers uat
    JOIN access_tiers at ON at.access_tier_id=uat.access_tier_id
    WHERE uat.user_id=?
    ORDER BY at.code ASC
  `).bind(memberUser.user_id).all();
  const codes = normalizeResults(assigned).map((row) => String(row.code || '').toLowerCase()).filter(Boolean);
  if (!codes.length) return jsonResponse({ ok:true, policies: [] });

  const placeholders = codes.map(() => '?').join(',');
  const result = await db.prepare(`
    SELECT policy_id, tier_code, title, short_description, benefits_json, badge_color, is_visible, sort_order
    FROM membership_tier_policies
    WHERE is_visible=1 AND LOWER(tier_code) IN (${placeholders})
    ORDER BY sort_order ASC, tier_code ASC
  `).bind(...codes).all();

  const policies = normalizeResults(result).map((row) => {
    let benefits = [];
    try { benefits = JSON.parse(row.benefits_json || '[]'); } catch {}
    return {
      policy_id: Number(row.policy_id || 0),
      tier_code: String(row.tier_code || '').toLowerCase(),
      title: String(row.title || '').trim(),
      short_description: String(row.short_description || '').trim(),
      benefits: Array.isArray(benefits) ? benefits : [],
      badge_color: String(row.badge_color || '').trim(),
      is_visible: Number(row.is_visible || 0) === 1,
      sort_order: Number(row.sort_order || 0)
    };
  });

  return jsonResponse({ ok:true, policies });
}
