import { getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
  if (!db) return jsonResponse({ ok: false, error: 'Database binding is not configured.' }, 500);

  const url = new URL(request.url);
  const scope = normalizeText(url.searchParams.get('scope')).toLowerCase();
  const severity = normalizeText(url.searchParams.get('severity')).toLowerCase();
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 40), 100));
  const clauses = ['1=1'];
  const bindings = [];
  const warnings = [];

  if (scope) {
    clauses.push('LOWER(COALESCE(incident_scope, "")) = ?');
    bindings.push(scope);
  }
  if (severity) {
    clauses.push('LOWER(COALESCE(severity, "")) = ?');
    bindings.push(severity);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS runtime_incidents (
        runtime_incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_scope TEXT,
        incident_code TEXT,
        severity TEXT DEFAULT 'warning',
        endpoint_path TEXT,
        request_method TEXT,
        message TEXT,
        details_json TEXT,
        related_user_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {
    warnings.push('runtime_incident_schema_guard_failed');
  }

  try {
    const rows = normalizeResults(await db.prepare(`
      SELECT
        runtime_incident_id,
        incident_scope,
        incident_code,
        severity,
        endpoint_path,
        request_method,
        message,
        details_json,
        related_user_id,
        ip_address,
        user_agent,
        created_at
      FROM runtime_incidents
      WHERE ${clauses.join(' AND ')}
      ORDER BY datetime(created_at) DESC, runtime_incident_id DESC
      LIMIT ?
    `).bind(...bindings, limit).all());

    const summaryRow = await db.prepare(`
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN LOWER(COALESCE(severity,'')) = 'error' THEN 1 ELSE 0 END) AS error_count,
        SUM(CASE WHEN LOWER(COALESCE(severity,'')) = 'warning' THEN 1 ELSE 0 END) AS warning_count
      FROM runtime_incidents
      WHERE ${clauses.join(' AND ')}
    `).bind(...bindings).first().catch(() => null);

    return jsonResponse({
      ok: true,
      requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
      warnings,
      filters: { scope, severity, limit },
      summary: {
        total_count: Number(summaryRow?.total_count || 0),
        error_count: Number(summaryRow?.error_count || 0),
        warning_count: Number(summaryRow?.warning_count || 0)
      },
      incidents: rows.map((row) => ({
        runtime_incident_id: Number(row.runtime_incident_id || 0),
        incident_scope: row.incident_scope || '',
        incident_code: row.incident_code || '',
        severity: row.severity || 'warning',
        endpoint_path: row.endpoint_path || '',
        request_method: row.request_method || '',
        message: row.message || '',
        details_json: row.details_json || '',
        related_user_id: row.related_user_id == null ? null : Number(row.related_user_id),
        ip_address: row.ip_address || '',
        user_agent: row.user_agent || '',
        created_at: row.created_at || null
      }))
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to load runtime incidents.' }, 500);
  }
}
