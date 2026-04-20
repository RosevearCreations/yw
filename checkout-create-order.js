// File: /functions/api/checkout-create-order.js
// Brief description: Creates a checkout order from the browser cart and customer form data.
// It validates the incoming cart, enforces shipping details for physical orders, calculates
// order totals, writes the order, order items, and initial status history into D1,
// and returns the new order for the confirmation and payment flow.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function toInteger(value, fallback = 0) {
  const num = Number(value);
  return Number.isInteger(num) ? num : fallback;
}

function generateOrderNumber() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `DD-${y}${m}${d}-${rand}`;
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getSessionUser(env, token) {
  if (!token) return null;

  const row = await env.DB.prepare(`
    SELECT
      s.session_id,
      s.user_id,
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

  if (!row) return null;
  if (Number(row.is_active || 0) !== 1) return null;

  return {
    session_id: Number(row.session_id || 0),
    user_id: Number(row.resolved_user_id || row.user_id || 0),
    email: row.email || "",
    display_name: row.display_name || "",
    role: row.role || "member"
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizeFulfillmentType(items) {
  const requiresShipping = items.some((item) => Number(item.requires_shipping || 0) === 1);
  const hasDigital = items.some((item) => Number(item.requires_shipping || 0) === 0);

  if (requiresShipping && hasDigital) return "mixed";
  if (requiresShipping) return "shipping";
  return "digital";
}

function calculateTaxCents(subtotalCents, shippingCents, taxRate = 0.13) {
  const taxableBase = Number(subtotalCents || 0) + Number(shippingCents || 0);
  return Math.round(taxableBase * taxRate);
}

function validateShippingFields(fulfillmentType, shipping) {
  if (!["shipping", "mixed"].includes(String(fulfillmentType || "").toLowerCase())) {
    return "";
  }

  if (!shipping.shipping_name) return "Shipping name is required for physical orders.";
  if (!shipping.shipping_address1) return "Shipping address line 1 is required for physical orders.";
  if (!shipping.shipping_city) return "Shipping city is required for physical orders.";
  if (!shipping.shipping_province) return "Shipping province or state is required for physical orders.";
  if (!shipping.shipping_postal_code) return "Shipping postal or ZIP code is required for physical orders.";
  if (!shipping.shipping_country) return "Shipping country is required for physical orders.";

  return "";
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const token = getBearerToken(request);
  const sessionUser = await getSessionUser(env, token);

  const customer_name = normalizeText(body.customer_name);
  const customer_email = normalizeEmail(body.customer_email || sessionUser?.email || "");
  const notes = normalizeText(body.notes);
  const payment_method = normalizeText(body.payment_method || "pending").toLowerCase() || "pending";
  const currency = normalizeText(body.currency || "CAD").toUpperCase() || "CAD";

  const shipping_name = normalizeText(body.shipping_name || customer_name);
  const shipping_company = normalizeText(body.shipping_company);
  const shipping_address1 = normalizeText(body.shipping_address1);
  const shipping_address2 = normalizeText(body.shipping_address2);
  const shipping_city = normalizeText(body.shipping_city);
  const shipping_province = normalizeText(body.shipping_province);
  const shipping_postal_code = normalizeText(body.shipping_postal_code);
  const shipping_country = normalizeText(body.shipping_country || "Canada");

  const billing_name = normalizeText(body.billing_name || shipping_name || customer_name);
  const billing_company = normalizeText(body.billing_company);
  const billing_address1 = normalizeText(body.billing_address1 || shipping_address1);
  const billing_address2 = normalizeText(body.billing_address2 || shipping_address2);
  const billing_city = normalizeText(body.billing_city || shipping_city);
  const billing_province = normalizeText(body.billing_province || shipping_province);
  const billing_postal_code = normalizeText(body.billing_postal_code || shipping_postal_code);
  const billing_country = normalizeText(body.billing_country || shipping_country || "Canada");

  const shipping_cents = Math.max(0, toInteger(body.shipping_cents, 0));
  const cartItems = Array.isArray(body.items) ? body.items : [];

  if (!customer_name) {
    return json({ ok: false, error: "Customer name is required." }, 400);
  }

  if (!customer_email || !isValidEmail(customer_email)) {
    return json({ ok: false, error: "A valid customer email is required." }, 400);
  }

  if (!cartItems.length) {
    return json({ ok: false, error: "At least one cart item is required." }, 400);
  }

  const productIds = cartItems
    .map((item) => Number(item.product_id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!productIds.length) {
    return json({ ok: false, error: "Cart items must include valid product IDs." }, 400);
  }

  const placeholders = productIds.map(() => "?").join(", ");
  const productsResult = await env.DB.prepare(`
    SELECT
      product_id,
      sku,
      name,
      product_type,
      status,
      price_cents,
      currency,
      taxable,
      tax_class_code,
      requires_shipping,
      digital_file_url
    FROM products
    WHERE product_id IN (${placeholders})
  `)
    .bind(...productIds)
    .all();

  const productRows = normalizeResults(productsResult);
  const productMap = new Map(
    productRows.map((row) => [Number(row.product_id), row])
  );

  const orderItems = [];
  let subtotal_cents = 0;

  for (const rawItem of cartItems) {
    const product_id = Number(rawItem.product_id);
    const quantity = Number(rawItem.quantity);

    if (!Number.isInteger(product_id) || product_id <= 0) {
      return json({ ok: false, error: "Every cart item must have a valid product_id." }, 400);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return json({ ok: false, error: "Every cart item must have a quantity of at least 1." }, 400);
    }

    const product = productMap.get(product_id);

    if (!product) {
      return json({ ok: false, error: `Product ${product_id} was not found.` }, 404);
    }

    if (String(product.status || "").toLowerCase() !== "active") {
      return json({ ok: false, error: `Product ${product.name || product_id} is not available.` }, 400);
    }

    const unit_price_cents = Number(product.price_cents || 0);
    const line_subtotal_cents = unit_price_cents * quantity;

    subtotal_cents += line_subtotal_cents;

    orderItems.push({
      product_id,
      sku: product.sku || "",
      product_name: product.name || "",
      product_type: product.product_type || "physical",
      unit_price_cents,
      quantity,
      line_subtotal_cents,
      taxable: Number(product.taxable || 0),
      tax_class_code: product.tax_class_code || "",
      requires_shipping: Number(product.requires_shipping || 0),
      digital_file_url: product.digital_file_url || "",
      currency: product.currency || currency || "CAD"
    });
  }

  const fulfillment_type = normalizeFulfillmentType(orderItems);
  const shippingError = validateShippingFields(fulfillment_type, {
    shipping_name,
    shipping_address1,
    shipping_city,
    shipping_province,
    shipping_postal_code,
    shipping_country
  });

  if (shippingError) {
    return json({ ok: false, error: shippingError }, 400);
  }

  const tax_cents = calculateTaxCents(subtotal_cents, shipping_cents, 0.13);
  const discount_cents = 0;
  const total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents;
  const order_number = generateOrderNumber();
  const user_id = sessionUser?.user_id || null;

  const insertOrder = await env.DB.prepare(`
    INSERT INTO orders (
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
      discount_cents,
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
    )
    VALUES (
      ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `)
    .bind(
      order_number,
      user_id,
      customer_email,
      customer_name,
      payment_method,
      fulfillment_type,
      currency,
      subtotal_cents,
      discount_cents,
      shipping_cents,
      tax_cents,
      total_cents,
      shipping_name || null,
      shipping_company || null,
      shipping_address1 || null,
      shipping_address2 || null,
      shipping_city || null,
      shipping_province || null,
      shipping_postal_code || null,
      shipping_country || null,
      billing_name || null,
      billing_company || null,
      billing_address1 || null,
      billing_address2 || null,
      billing_city || null,
      billing_province || null,
      billing_postal_code || null,
      billing_country || null,
      notes || null
    )
    .run();

  const order_id = Number(insertOrder?.meta?.last_row_id || 0);

  if (!order_id) {
    return json({ ok: false, error: "Order could not be created." }, 500);
  }

  for (const item of orderItems) {
    await env.DB.prepare(`
      INSERT INTO order_items (
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
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
      .bind(
        order_id,
        item.product_id,
        item.sku || null,
        item.product_name,
        item.product_type,
        item.unit_price_cents,
        item.quantity,
        item.line_subtotal_cents,
        item.taxable,
        item.tax_class_code || null,
        item.requires_shipping,
        item.digital_file_url || null
      )
      .run();
  }

  const historyNote = sessionUser
    ? `Order created by ${sessionUser.display_name || sessionUser.email || `user #${sessionUser.user_id}`}.`
    : "Order created from checkout.";

  await env.DB.prepare(`
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by_user_id,
      note,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `)
    .bind(
      order_id,
      "draft",
      "pending",
      sessionUser?.user_id || null,
      historyNote
    )
    .run();

  const createdOrder = await env.DB.prepare(`
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
      discount_cents,
      shipping_cents,
      tax_cents,
      total_cents,
      created_at,
      updated_at
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `)
    .bind(order_id)
    .first();

  return json({
    ok: true,
    message: "Order created successfully.",
    order: {
      order_id: Number(createdOrder?.order_id || order_id),
      order_number: createdOrder?.order_number || order_number,
      user_id: createdOrder?.user_id ? Number(createdOrder.user_id) : null,
      customer_email: createdOrder?.customer_email || customer_email,
      customer_name: createdOrder?.customer_name || customer_name,
      order_status: createdOrder?.order_status || "pending",
      payment_status: createdOrder?.payment_status || "pending",
      payment_method: createdOrder?.payment_method || payment_method,
      fulfillment_type: createdOrder?.fulfillment_type || fulfillment_type,
      currency: createdOrder?.currency || currency,
      subtotal_cents: Number(createdOrder?.subtotal_cents || subtotal_cents),
      discount_cents: Number(createdOrder?.discount_cents || discount_cents),
      shipping_cents: Number(createdOrder?.shipping_cents || shipping_cents),
      tax_cents: Number(createdOrder?.tax_cents || tax_cents),
      total_cents: Number(createdOrder?.total_cents || total_cents),
      created_at: createdOrder?.created_at || null,
      updated_at: createdOrder?.updated_at || null
    },
    items: orderItems
  }, 201);
}
