// File: /functions/api/member/order-detail.js
// Brief description: Returns one order for the logged-in member. It validates the active
// bearer-token session, ensures the requested order belongs to the current user, and returns
// the order, items, status history, and lightweight payment summary for the member order-detail modal.

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

function summarizePayments(order, payments) {
  const safePayments = Array.isArray(payments) ? payments : [];
  const orderTotalCents = Number(order?.total_cents || 0);

  let paid_total_cents = 0;
  let refunded_total_cents = 0;
  let pending_total_cents = 0;

  for (const payment of safePayments) {
    const status = String(payment?.payment_status || "").toLowerCase();
    const amount = Number(payment?.amount_cents || 0);

    if (["paid", "completed", "captured"].includes(status)) {
      paid_total_cents += amount;
    }

    if (["refunded", "partially_refunded"].includes(status)) {
      refunded_total_cents += amount;
    }

    if (["pending", "authorized"].includes(status)) {
      pending_total_cents += amount;
    }
  }

  let derived_payment_status = "pending";

  if (safePayments.length === 0) {
    derived_payment_status = String(order?.payment_status || "pending").toLowerCase();
  } else if (safePayments.some((payment) => String(payment?.payment_status || "").toLowerCase() === "refunded")) {
    derived_payment_status = "refunded";
  } else if (safePayments.some((payment) => String(payment?.payment_status || "").toLowerCase() === "partially_refunded")) {
    derived_payment_status = "partially_refunded";
  } else if (paid_total_cents >= orderTotalCents && orderTotalCents > 0) {
    derived_payment_status = "paid";
  } else if (safePayments.some((payment) => String(payment?.payment_status || "").toLowerCase() === "authorized")) {
    derived_payment_status = "authorized";
  } else if (safePayments.some((payment) => String(payment?.payment_status || "").toLowerCase() === "pending")) {
    derived_payment_status = "pending";
  } else if (
    safePayments.every((payment) => {
      const status = String(payment?.payment_status || "").toLowerCase();
      return ["failed", "cancelled"].includes(status);
    })
  ) {
    derived_payment_status = "failed";
  }

  return {
    payment_count: safePayments.length,
    paid_total_cents,
    refunded_total_cents,
    pending_total_cents,
    outstanding_cents: Math.max(orderTotalCents - paid_total_cents, 0),
    derived_payment_status
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const memberUser = await getMemberUserFromRequest(request, env);

  if (!memberUser) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const order_id = Number(url.searchParams.get("order_id"));

  if (!Number.isInteger(order_id) || order_id <= 0) {
    return json({ ok: false, error: "A valid order_id is required." }, 400);
  }

  const order = await env.DB.prepare(`
    SELECT
      order_id,
      order_number,
      user_id,
      customer_email,
      customer_name,
      order_status,
      payment_status,
      payment_method,
      fulfillment_type,
      currency,
      subtotal_cents,
      COALESCE(discount_cents, 0) AS discount_cents,
      shipping_cents,
      tax_cents,
      total_cents,
      shipping_name,
      shipping_company,
      shipping_address1,
      shipping_address2,
      shipping_city,
      shipping_province,
      shipping_postal_code,
      shipping_country,
      billing_name,
      billing_company,
      billing_address1,
      billing_address2,
      billing_city,
      billing_province,
      billing_postal_code,
      billing_country,
      notes,
      created_at,
      updated_at
    FROM orders
    WHERE order_id = ?
      AND (
        user_id = ?
        OR LOWER(COALESCE(customer_email, '')) = LOWER(?)
      )
    LIMIT 1
  `)
    .bind(order_id, memberUser.user_id, memberUser.email)
    .first();

  if (!order) {
    return json({ ok: false, error: "Order not found." }, 404);
  }

  const itemsResult = await env.DB.prepare(`
    SELECT
      order_item_id,
      order_id,
      product_id,
      sku,
      product_name,
      product_type,
      unit_price_cents,
      quantity,
      line_subtotal_cents,
      taxable,
      tax_class_code,
      requires_shipping,
      digital_file_url,
      created_at
    FROM order_items
    WHERE order_id = ?
    ORDER BY order_item_id ASC
  `)
    .bind(order_id)
    .all();

  const historyResult = await env.DB.prepare(`
    SELECT
      order_status_history_id,
      order_id,
      old_status,
      new_status,
      note,
      created_at
    FROM order_status_history
    WHERE order_id = ?
    ORDER BY created_at ASC, order_status_history_id ASC
  `)
    .bind(order_id)
    .all();

  const paymentsResult = await env.DB.prepare(`
    SELECT
      payment_id,
      payment_status,
      amount_cents
    FROM payments
    WHERE order_id = ?
    ORDER BY payment_id DESC
  `)
    .bind(order_id)
    .all();

  const items = normalizeResults(itemsResult).map((item) => ({
    order_item_id: Number(item.order_item_id || 0),
    order_id: Number(item.order_id || 0),
    product_id: Number(item.product_id || 0),
    sku: item.sku || "",
    product_name: item.product_name || "",
    product_type: item.product_type || "",
    unit_price_cents: Number(item.unit_price_cents || 0),
    quantity: Number(item.quantity || 0),
    line_subtotal_cents: Number(item.line_subtotal_cents || 0),
    taxable: Number(item.taxable || 0),
    tax_class_code: item.tax_class_code || "",
    requires_shipping: Number(item.requires_shipping || 0),
    digital_file_url: item.digital_file_url || "",
    created_at: item.created_at || null
  }));

  const status_history = normalizeResults(historyResult).map((row) => ({
    order_status_history_id: Number(row.order_status_history_id || 0),
    order_id: Number(row.order_id || 0),
    old_status: row.old_status || "",
    new_status: row.new_status || "",
    note: row.note || "",
    created_at: row.created_at || null
  }));

  const payment_summary = summarizePayments(order, normalizeResults(paymentsResult));

  return json({
    ok: true,
    requested_by: {
      user_id: memberUser.user_id,
      email: memberUser.email,
      display_name: memberUser.display_name,
      role: memberUser.role
    },
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
      shipping_name: order.shipping_name || "",
      shipping_company: order.shipping_company || "",
      shipping_address1: order.shipping_address1 || "",
      shipping_address2: order.shipping_address2 || "",
      shipping_city: order.shipping_city || "",
      shipping_province: order.shipping_province || "",
      shipping_postal_code: order.shipping_postal_code || "",
      shipping_country: order.shipping_country || "",
      billing_name: order.billing_name || "",
      billing_company: order.billing_company || "",
      billing_address1: order.billing_address1 || "",
      billing_address2: order.billing_address2 || "",
      billing_city: order.billing_city || "",
      billing_province: order.billing_province || "",
      billing_postal_code: order.billing_postal_code || "",
      billing_country: order.billing_country || "",
      notes: order.notes || "",
      created_at: order.created_at || null,
      updated_at: order.updated_at || null
    },
    items,
    status_history,
    payment_summary
  });
}
