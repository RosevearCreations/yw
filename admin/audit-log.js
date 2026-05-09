import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);

  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
  const actionType = normalizeText(url.searchParams.get('action_type')).toLowerCase();
  const targetType = normalizeText(url.searchParams.get('target_type')).toLowerCase();

  try {
    const rows = normalizeResults(await db.prepare(`
      SELECT a.admin_action_audit_id, a.actor_user_id, a.action_type, a.target_type, a.target_id, a.target_key,
             a.request_method, a.request_path, a.ip_address, a.user_agent, a.details_json, a.created_at,
             u.email, u.display_name
      FROM admin_action_audit a
      LEFT JOIN users u ON u.user_id = a.actor_user_id
      WHERE (? = '' OR LOWER(COALESCE(a.action_type,'')) = ?)
        AND (? = '' OR LOWER(COALESCE(a.target_type,'')) = ?)
        AND (? = '' OR LOWER(COALESCE(a.action_type,'')) LIKE ? OR LOWER(COALESCE(a.target_type,'')) LIKE ? OR LOWER(COALESCE(a.target_key,'')) LIKE ? OR LOWER(COALESCE(a.request_path,'')) LIKE ? OR LOWER(COALESCE(u.email,'')) LIKE ?)
      ORDER BY a.created_at DESC, a.admin_action_audit_id DESC
      LIMIT ?
    `).bind(actionType, actionType, targetType, targetType, q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit).all());

    const summary = await db.prepare(`
      SELECT COUNT(*) AS total_events,
             COUNT(DISTINCT actor_user_id) AS distinct_admins,
             SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS last_24h_events
      FROM admin_action_audit
    `).first();

    return jsonResponse({
      ok: true,
      requested_by: adminUser,
      summary: {
        total_events: Number(summary?.total_events || 0),
        distinct_admins: Number(summary?.distinct_admins || 0),
        last_24h_events: Number(summary?.last_24h_events || 0)
      },
      items: rows.map((row) => ({
        admin_action_audit_id: Number(row.admin_action_audit_id || 0),
        actor_user_id: Number(row.actor_user_id || 0),
        actor_email: row.email || '',
        actor_display_name: row.display_name || '',
        action_type: row.action_type || '',
        target_type: row.target_type || '',
        target_id: row.target_id == null ? null : Number(row.target_id),
        target_key: row.target_key || '',
        request_method: row.request_method || '',
        request_path: row.request_path || '',
        ip_address: row.ip_address || '',
        user_agent: row.user_agent || '',
        details_json: row.details_json || '',
        created_at: row.created_at || null
      }))
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || 'Failed to load audit log.' }, 500);
  }
}
