// File: /functions/api/member/orders.js
// Brief description: Returns the logged-in member’s orders for the members dashboard.
// It validates the active bearer-token session, limits results to the current user’s
// own orders, and includes lightweight payment summaries for the member orders table.

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

  const db = env.DB || env.DD_DB;
  if (!db) {
    return null;
  }

  const session = await db.prepare(`
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
  const db = env.DB || env.DD_DB;

  if (!db) {
    return json({ ok: false, error: "Database binding is not configured." }, 500);
  }

  const memberUser = await getMemberUserFromRequest(request, env);

  if (!memberUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const sql = `
    WITH payment_summary AS (
      SELECT
        p.order_id,
        COUNT(*) AS payment_count,

        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(p.payment_status, '')) IN ('paid', 'completed', 'captured')
              THEN COALESCE(p.amount_cents, 0)
            ELSE 0
          END
        ), 0) AS paid_total_cents,

        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'authorized')
              THEN COALESCE(p.amount_cents, 0)
            ELSE 0
          END
        ), 0) AS pending_total_cents,

        COALESCE(SUM(
          CASE
            WHEN LOWER(COALESCE(p.payment_status, '')) IN ('refunded', 'partially_refunded')
              THEN COALESCE(p.amount_cents, 0)
            ELSE 0
          END
        ), 0) AS refunded_total_cents,

        MAX(CASE
          WHEN LOWER(COALESCE(p.payment_status, '')) = 'refunded' THEN 1
          ELSE 0
        END) AS has_refunded,

        MAX(CASE
          WHEN LOWER(COALESCE(p.payment_status, '')) = 'partially_refunded' THEN 1
          ELSE 0
        END) AS has_partially_refunded,

        MAX(CASE
          WHEN LOWER(COALESCE(p.payment_status, '')) = 'authorized' THEN 1
          ELSE 0
        END) AS has_authorized,

        MAX(CASE
          WHEN LOWER(COALESCE(p.payment_status, '')) = 'pending' THEN 1
          ELSE 0
        END) AS has_pending,

        MIN(CASE
          WHEN LOWER(COALESCE(p.payment_status, '')) IN ('failed', 'cancelled') THEN 1
          ELSE 0
        END) AS all_failed_or_cancelled
      FROM payments p
      GROUP BY p.order_id
    )

    SELECT
      o.order_id,
      o.order_number,
      o.user_id,
      o.customer_email,
      o.customer_name,
      o.order_status,
      o.payment_status,
      o.payment_method,
      o.fulfillment_type,
      o.currency,
      o.subtotal_cents,
      COALESCE(o.discount_cents, 0) AS discount_cents,
      o.shipping_cents,
      o.tax_cents,
      o.total_cents,
      o.created_at,
      o.updated_at,

      COALESCE(ps.payment_count, 0) AS payment_count,
      COALESCE(ps.paid_total_cents, 0) AS paid_total_cents,
      COALESCE(ps.pending_total_cents, 0) AS pending_total_cents,
      COALESCE(ps.refunded_total_cents, 0) AS refunded_total_cents,

      CASE
        WHEN ps.order_id IS NULL THEN COALESCE(o.payment_status, 'pending')
        WHEN COALESCE(ps.has_refunded, 0) = 1 THEN 'refunded'
        WHEN COALESCE(ps.has_partially_refunded, 0) = 1 THEN 'partially_refunded'
        WHEN COALESCE(ps.paid_total_cents, 0) >= COALESCE(o.total_cents, 0)
             AND COALESCE(o.total_cents, 0) > 0 THEN 'paid'
        WHEN COALESCE(ps.has_authorized, 0) = 1 THEN 'authorized'
        WHEN COALESCE(ps.has_pending, 0) = 1 THEN 'pending'
        WHEN COALESCE(ps.all_failed_or_cancelled, 0) = 1 THEN 'failed'
        ELSE COALESCE(o.payment_status, 'pending')
      END AS derived_payment_status

    FROM orders o
    LEFT JOIN payment_summary ps
      ON ps.order_id = o.order_id

    WHERE (
      o.user_id = ?
      OR LOWER(COALESCE(o.customer_email, '')) = LOWER(?)
    )

    ORDER BY o.created_at DESC, o.order_id DESC
  `;

  const result = await db.prepare(sql)
    .bind(memberUser.user_id, memberUser.email)
    .all();

  const orders = normalizeResults(result).map((row) => {
    const total = Number(row.total_cents || 0);
    const paid = Number(row.paid_total_cents || 0);

    return {
      order_id: Number(row.order_id || 0),
      order_number: row.order_number || "",
      user_id: Number(row.user_id || 0),
      customer_email: row.customer_email || "",
      customer_name: row.customer_name || "",
      order_status: row.order_status || "pending",
      payment_status: row.payment_status || "pending",
      derived_payment_status: row.derived_payment_status || row.payment_status || "pending",
      payment_method: row.payment_method || "",
      fulfillment_type: row.fulfillment_type || "shipping",
      currency: row.currency || "CAD",
      subtotal_cents: Number(row.subtotal_cents || 0),
      discount_cents: Number(row.discount_cents || 0),
      shipping_cents: Number(row.shipping_cents || 0),
      tax_cents: Number(row.tax_cents || 0),
      total_cents: total,
      payment_count: Number(row.payment_count || 0),
      paid_total_cents: paid,
      pending_total_cents: Number(row.pending_total_cents || 0),
      refunded_total_cents: Number(row.refunded_total_cents || 0),
      outstanding_cents: Math.max(total - paid, 0),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  });

  return json({
    ok: true,
    requested_by: {
      user_id: memberUser.user_id,
      email: memberUser.email,
      display_name: memberUser.display_name,
      role: memberUser.role
    },
    orders
  });
}
