// File: /functions/api/admin/order-detail.js
// Brief description: Returns admin order detail with partial fallbacks for items/history sections
// so the order detail modal can still open when one supporting table drifts.

import { captureRuntimeIncident, getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function runSafeQuery(db, sql, bindings = []) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return normalizeResults(result);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);
  if (!db) return json({ ok: false, error: "Database binding is not configured." }, 500);

  const url = new URL(request.url);
  const order_id = Number(url.searchParams.get("order_id"));
  if (!Number.isInteger(order_id) || order_id <= 0) {
    return json({ ok: false, error: "A valid order_id is required." }, 400);
  }

  const order = await db.prepare(`
    SELECT
      order_id, order_number, user_id, customer_email, customer_name, order_status, payment_status,
      payment_method, fulfillment_type, currency, subtotal_cents, COALESCE(discount_cents, 0) AS discount_cents,
      shipping_cents, tax_cents, total_cents,
      shipping_name, shipping_company, shipping_address1, shipping_address2, shipping_city, shipping_province, shipping_postal_code, shipping_country,
      billing_name, billing_company, billing_address1, billing_address2, billing_city, billing_province, billing_postal_code, billing_country,
      notes, created_at, updated_at
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(order_id).first();

  if (!order) {
    return json({ ok: false, error: "Order not found." }, 404);
  }

  const warnings = [];

  let items = [];
  try {
    items = await runSafeQuery(db, `
      SELECT
        order_item_id, order_id, product_id, sku, product_name, product_type,
        unit_price_cents, quantity, line_subtotal_cents, taxable, tax_class_code,
        requires_shipping, digital_file_url, created_at
      FROM order_items
      WHERE order_id = ?
      ORDER BY order_item_id ASC
    `, [order_id]);
  } catch (error) {
    warnings.push("order_items_query_failed");
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_orders",
      incident_code: "order_detail_items_query_failed",
      severity: "warning",
      message: "Admin order detail items query failed. Returning a safe empty items list.",
      details: { order_id, error: String(error?.message || error || "Unknown order items query error") }
    });
  }

  let history = [];
  try {
    history = await runSafeQuery(db, `
      SELECT history_id, order_id, old_status, new_status, changed_by_user_id, note, created_at
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY created_at DESC, history_id DESC
    `, [order_id]);
  } catch (error) {
    warnings.push("order_history_query_failed");
    await captureRuntimeIncident(env, request, {
      incident_scope: "admin_orders",
      incident_code: "order_detail_history_query_failed",
      severity: "warning",
      message: "Admin order history query failed. Returning a safe empty history list.",
      details: { order_id, error: String(error?.message || error || "Unknown order history query error") }
    });
  }

  return json({
    ok: true,
    requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
    warning: warnings.length ? "Some order detail sections used safe empty fallbacks." : "",
    diagnostics: { warnings, authority: warnings.length ? "partial_fallback" : "primary_queries" },
    order: {
      order_id: Number(order.order_id || 0),
      order_number: order.order_number || "",
      user_id: Number(order.user_id || 0),
      customer_email: order.customer_email || "",
      customer_name: order.customer_name || "",
      order_status: order.order_status || "pending",
      payment_status: order.payment_status || "pending",
      payment_method: order.payment_method || "",
      fulfillment_type: order.fulfillment_type || "shipping",
      currency: order.currency || "CAD",
      subtotal_cents: Number(order.subtotal_cents || 0),
      discount_cents: Number(order.discount_cents || 0),
      shipping_cents: Number(order.shipping_cents || 0),
      tax_cents: Number(order.tax_cents || 0),
      total_cents: Number(order.total_cents || 0),
      shipping_name: order.shipping_name || null,
      shipping_company: order.shipping_company || null,
      shipping_address1: order.shipping_address1 || null,
      shipping_address2: order.shipping_address2 || null,
      shipping_city: order.shipping_city || null,
      shipping_province: order.shipping_province || null,
      shipping_postal_code: order.shipping_postal_code || null,
      shipping_country: order.shipping_country || null,
      billing_name: order.billing_name || null,
      billing_company: order.billing_company || null,
      billing_address1: order.billing_address1 || null,
      billing_address2: order.billing_address2 || null,
      billing_city: order.billing_city || null,
      billing_province: order.billing_province || null,
      billing_postal_code: order.billing_postal_code || null,
      billing_country: order.billing_country || null,
      notes: order.notes || null,
      created_at: order.created_at || null,
      updated_at: order.updated_at || null
    },
    items: items.map((item) => ({
      order_item_id: Number(item.order_item_id || 0),
      order_id: Number(item.order_id || 0),
      product_id: Number(item.product_id || 0),
      sku: item.sku || null,
      product_name: item.product_name || "",
      product_type: item.product_type || "",
      unit_price_cents: Number(item.unit_price_cents || 0),
      quantity: Number(item.quantity || 0),
      line_subtotal_cents: Number(item.line_subtotal_cents || 0),
      taxable: Number(item.taxable || 0) === 1,
      tax_class_code: item.tax_class_code || null,
      requires_shipping: Number(item.requires_shipping || 0) === 1,
      digital_file_url: item.digital_file_url || null,
      created_at: item.created_at || null
    })),
    status_history: history.map((row) => ({
      history_id: Number(row.history_id || 0),
      order_id: Number(row.order_id || 0),
      old_status: row.old_status || null,
      new_status: row.new_status || null,
      changed_by_user_id: Number(row.changed_by_user_id || 0),
      note: row.note || null,
      created_at: row.created_at || null
    }))
  });
}
