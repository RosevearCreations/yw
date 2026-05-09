// File: /functions/api/member/downloads.js
// Brief description: Returns the logged-in member’s available digital downloads.
// It validates the active bearer-token session, looks for the member’s paid/completed
// digital order items, and returns a clean downloads list for the members downloads panel.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function getMemberUserFromRequest(request, env) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const session = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
      s.session_token,
      s.token,
      s.expires_at,
      u.user_id AS resolved_user_id,
      u.email,
      u.display_name,
      u.role,
      u.is_active
    FROM sessions s
    INNER JOIN users u
      ON u.user_id = s.user_id
    WHERE (
      s.session_token = ?
      OR s.token = ?
    )
      AND s.expires_at > datetime('now')
    LIMIT 1
  `)
    .bind(token, token)
    .first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;

  const role = String(session.role || "").toLowerCase();
  if (!["member", "admin"].includes(role)) return null;

  return {
    session_id: Number(session.session_id || 0),
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || "",
    display_name: session.display_name || "",
    role
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const memberUser = await getMemberUserFromRequest(request, env);

  if (!memberUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const result = await env.DB.prepare(`
    SELECT
      oi.order_item_id,
      oi.order_id,
      oi.product_id,
      oi.product_name,
      oi.product_type,
      oi.digital_file_url,
      oi.created_at AS order_item_created_at,

      o.order_number,
      o.order_status,
      o.payment_status,
      o.currency,
      o.created_at AS order_created_at,
      o.updated_at AS order_updated_at,

      p.sku
    FROM order_items oi
    INNER JOIN orders o
      ON o.order_id = oi.order_id
    LEFT JOIN products p
      ON p.product_id = oi.product_id
    WHERE (
      o.user_id = ?
      OR LOWER(COALESCE(o.customer_email, '')) = LOWER(?)
    )
      AND LOWER(COALESCE(oi.product_type, '')) = 'digital'
      AND COALESCE(oi.digital_file_url, '') <> ''
      AND LOWER(COALESCE(o.order_status, '')) IN ('paid', 'fulfilled')
      AND LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'completed', 'captured')
    ORDER BY o.created_at DESC, oi.order_item_id DESC
  `)
    .bind(memberUser.user_id, memberUser.email)
    .all();

  const downloads = normalizeResults(result).map((row) => ({
    order_item_id: Number(row.order_item_id || 0),
    order_id: Number(row.order_id || 0),
    product_id: Number(row.product_id || 0),
    product_name: row.product_name || "",
    product_type: row.product_type || "digital",
    sku: row.sku || "",
    digital_file_url: row.digital_file_url || "",
    order_number: row.order_number || "",
    order_status: row.order_status || "paid",
    payment_status: row.payment_status || "paid",
    currency: row.currency || "CAD",
    order_created_at: row.order_created_at || null,
    order_updated_at: row.order_updated_at || null,
    order_item_created_at: row.order_item_created_at || null
  }));

  return json({
    ok: true,
    requested_by: {
      user_id: memberUser.user_id,
      email: memberUser.email,
      display_name: memberUser.display_name,
      role: memberUser.role
    },
    downloads
  });
}
