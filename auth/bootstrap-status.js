// File: /functions/api/auth/bootstrap-status.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  const totals = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_users,
      SUM(CASE WHEN LOWER(COALESCE(role, '')) = 'admin' THEN 1 ELSE 0 END) AS admin_users,
      SUM(CASE WHEN COALESCE(is_active, 0) = 1 THEN 1 ELSE 0 END) AS active_users,
      SUM(CASE
        WHEN LOWER(COALESCE(role, '')) = 'admin'
         AND COALESCE(is_active, 0) = 1
        THEN 1 ELSE 0
      END) AS active_admin_users
    FROM users
  `).first();

  const total_users = Number(totals?.total_users || 0);
  const admin_users = Number(totals?.admin_users || 0);
  const active_users = Number(totals?.active_users || 0);
  const active_admin_users = Number(totals?.active_admin_users || 0);

  const bootstrap_required = active_admin_users === 0;

  return json({
    ok: true,
    bootstrap_required,
    status: bootstrap_required ? "needs_bootstrap" : "ready",
    summary: {
      total_users,
      admin_users,
      active_users,
      active_admin_users
    }
  });
}
