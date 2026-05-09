// File: /functions/api/admin/orders.js
// Brief description: Returns admin order-list data with a fallback query so the orders screen
// can stay usable even when the richer payment rollup query drifts.

import { captureRuntimeIncident, getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function shapeOrders(rows) {
  return normalizeResults(rows).map((row) => {
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
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const warnings = [];
  const primarySql = `
    WITH payment_summary AS (
      SELECT
        p.order_id,
        COUNT(*) AS payment_count,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(p.payment_status, '')) IN ('paid', 'completed', 'captured') THEN COALESCE(p.amount_cents, 0) ELSE 0 END), 0) AS paid_total_cents,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'authorized') THEN COALESCE(p.amount_cents, 0) ELSE 0 END), 0) AS pending_total_cents,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(p.payment_status, '')) IN ('refunded', 'partially_refunded') THEN COALESCE(p.amount_cents, 0) ELSE 0 END), 0) AS refunded_total_cents,
        MAX(CASE WHEN LOWER(COALESCE(p.payment_status, '')) = 'refunded' THEN 1 ELSE 0 END) AS has_refunded,
        MAX(CASE WHEN LOWER(COALESCE(p.payment_status, '')) = 'partially_refunded' THEN 1 ELSE 0 END) AS has_partially_refunded,
        MAX(CASE WHEN LOWER(COALESCE(p.payment_status, '')) = 'authorized' THEN 1 ELSE 0 END) AS has_authorized,
        MAX(CASE WHEN LOWER(COALESCE(p.payment_status, '')) = 'pending' THEN 1 ELSE 0 END) AS has_pending,
        MIN(CASE WHEN LOWER(COALESCE(p.payment_status, '')) IN ('failed', 'cancelled') THEN 1 ELSE 0 END) AS all_failed_or_cancelled
      FROM payments p
      GROUP BY p.order_id
    )
    SELECT
      o.order_id, o.order_number, o.user_id, o.customer_email, o.customer_name,
      o.order_status, o.payment_status, o.payment_method, o.fulfillment_type,
      o.currency, o.subtotal_cents, COALESCE(o.discount_cents, 0) AS discount_cents,
      o.shipping_cents, o.tax_cents, o.total_cents, o.created_at, o.updated_at,
      COALESCE(ps.payment_count, 0) AS payment_count,
      COALESCE(ps.paid_total_cents, 0) AS paid_total_cents,
      COALESCE(ps.pending_total_cents, 0) AS pending_total_cents,
      COALESCE(ps.refunded_total_cents, 0) AS refunded_total_cents,
      CASE
        WHEN ps.order_id IS NULL THEN COALESCE(o.payment_status, 'pending')
        WHEN COALESCE(ps.has_refunded, 0) = 1 THEN 'refunded'
        WHEN COALESCE(ps.has_partially_refunded, 0) = 1 THEN 'partially_refunded'
        WHEN COALESCE(ps.paid_total_cents, 0) >= COALESCE(o.total_cents, 0) AND COALESCE(o.total_cents, 0) > 0 THEN 'paid'
        WHEN COALESCE(ps.has_authorized, 0) = 1 THEN 'authorized'
        WHEN COALESCE(ps.has_pending, 0) = 1 THEN 'pending'
        WHEN COALESCE(ps.all_failed_or_cancelled, 0) = 1 THEN 'failed'
        ELSE COALESCE(o.payment_status, 'pending')
      END AS derived_payment_status
    FROM orders o
    LEFT JOIN payment_summary ps ON ps.order_id = o.order_id
    ORDER BY o.created_at DESC, o.order_id DESC
  `;

  const fallbackSql = `
    SELECT
      o.order_id, o.order_number, o.user_id, o.customer_email, o.customer_name,
      o.order_status, o.payment_status, o.payment_method, o.fulfillment_type,
      o.currency, o.subtotal_cents, COALESCE(o.discount_cents, 0) AS discount_cents,
      o.shipping_cents, o.tax_cents, o.total_cents, o.created_at, o.updated_at,
      0 AS payment_count,
      0 AS paid_total_cents,
      0 AS pending_total_cents,
      0 AS refunded_total_cents,
      COALESCE(o.payment_status, 'pending') AS derived_payment_status
    FROM orders o
    ORDER BY o.created_at DESC, o.order_id DESC
  `;

  try {
    const result = await db.prepare(primarySql).all();
    return json({
      ok: true,
      requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
      orders: shapeOrders(result),
      diagnostics: { warnings, authority: "primary_orders_query" }
    });
  } catch (primaryError) {
    warnings.push("primary_orders_query_failed");
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_orders",
      incident_code: "orders_primary_query_failed",
      severity: "warning",
      message: "Admin orders primary query failed. Falling back to the basic orders query.",
      details: { error: String(primaryError?.message || primaryError || "Unknown primary orders query error") }
    });

    try {
      const fallbackResult = await db.prepare(fallbackSql).all();
      warnings.push("fallback_orders_query_used");
      return json({
        ok: true,
        warning: "Fallback orders query used. Payment rollups may be incomplete until the richer query recovers.",
        requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
        orders: shapeOrders(fallbackResult),
        diagnostics: { warnings, authority: "fallback_orders_query" }
      });
    } catch (fallbackError) {
      warnings.push("fallback_orders_query_failed");
      await captureRuntimeIncident(env, request, {
        incident_scope: "admin_orders",
        incident_code: "orders_fallback_query_failed",
        severity: "error",
        message: "Both admin orders queries failed. Returning a safe empty list.",
        details: {
          primary_error: String(primaryError?.message || primaryError || "Unknown primary orders query error"),
          fallback_error: String(fallbackError?.message || fallbackError || "Unknown fallback orders query error")
        }
      });
      return json({
        ok: true,
        warning: "Live admin orders are unavailable right now. A safe empty result was returned.",
        requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
        orders: [],
        diagnostics: { warnings, authority: "empty_fallback" }
      });
    }
  }
}
