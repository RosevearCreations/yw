// File: /functions/api/checkout-create-order.js
// Brief description: Creates a checkout order from the browser cart and customer form data.
// It now also supports storefront gift-card purchases where the purchaser and recipient
// can be different people, while keeping new gift cards in pending_activation until payment is confirmed.

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

function cents(value) {
  return Math.max(0, Math.round(Number(value || 0) || 0));
}

function generateOrderNumber() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `DD-${y}${m}${d}-${rand}`;
}

function generateGiftCardCode() {
  return `DND-GIFT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getSessionUser(env, token) {
  if (!token) return null;

  const db = env.DB || env.DD_DB;
  if (!db) return null;

  const row = await db.prepare(`
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

async function ensureGiftCardTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS gift_cards (
    gift_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL DEFAULT 'CAD',
    initial_amount_cents INTEGER NOT NULL DEFAULT 0,
    remaining_amount_cents INTEGER NOT NULL DEFAULT 0,
    issued_to_email TEXT,
    issued_to_name TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT,
    last_redeemed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_email TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_name TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_email TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_name TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN recipient_note TEXT`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchaser_user_id INTEGER`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN order_id INTEGER`).run().catch(() => null);
  await db.prepare(`ALTER TABLE gift_cards ADD COLUMN purchase_source TEXT`).run().catch(() => null);
  await db.prepare(`CREATE TABLE IF NOT EXISTS gift_card_redemptions (
    gift_card_redemption_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_card_id INTEGER NOT NULL,
    order_id INTEGER,
    redeemed_amount_cents INTEGER NOT NULL DEFAULT 0,
    redeemed_by_email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run().catch(() => null);
}

function normalizeGiftCardPurchase(raw, sessionUser, customerName, customerEmail) {
  if (!raw || typeof raw !== 'object') return null;
  const amountCents = cents(raw.amount_cents || raw.amount || 0);
  const recipientEmail = normalizeEmail(raw.recipient_email);
  const recipientName = normalizeText(raw.recipient_name);
  const purchaserEmail = normalizeEmail(raw.purchaser_email || customerEmail || sessionUser?.email || '');
  const purchaserName = normalizeText(raw.purchaser_name || customerName || sessionUser?.display_name || '');
  const recipientNote = normalizeText(raw.recipient_note || raw.message || '');
  const expiresAt = normalizeText(raw.expires_at);
  if (amountCents <= 0 || !recipientEmail || !isValidEmail(recipientEmail)) return null;
  return {
    amount_cents: amountCents,
    currency: normalizeText(raw.currency || 'CAD').toUpperCase() || 'CAD',
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    purchaser_email: purchaserEmail,
    purchaser_name: purchaserName,
    recipient_note: recipientNote,
    expires_at: expiresAt,
    purchase_label: normalizeText(raw.purchase_label || 'Storefront gift card') || 'Storefront gift card'
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

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
  const gift_card_code = normalizeText(body.gift_card_code).toUpperCase();
  const requested_gift_card_discount_cents = Math.max(0, toInteger(body.gift_card_discount_cents, 0));

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
  const giftCardPurchase = normalizeGiftCardPurchase(body.gift_card_purchase, sessionUser, customer_name, customer_email);

  if (!customer_name) return json({ ok: false, error: "Customer name is required." }, 400);
  if (!customer_email || !isValidEmail(customer_email)) return json({ ok: false, error: "A valid customer email is required." }, 400);
  if (!cartItems.length && !giftCardPurchase) return json({ ok: false, error: "At least one cart item or a gift-card purchase is required." }, 400);

  const productIds = cartItems.map((item) => Number(item.product_id)).filter((id) => Number.isInteger(id) && id > 0);
  let productMap = new Map();
  if (productIds.length) {
    const placeholders = productIds.map(() => "?").join(", ");
    const productsResult = await db.prepare(`
      SELECT product_id, sku, name, product_type, status, price_cents, currency, taxable, tax_class_code, requires_shipping, digital_file_url
      FROM products
      WHERE product_id IN (${placeholders})
    `).bind(...productIds).all();
    productMap = new Map(normalizeResults(productsResult).map((row) => [Number(row.product_id), row]));
  }

  const orderItems = [];
  let subtotal_cents = 0;

  for (const rawItem of cartItems) {
    const product_id = Number(rawItem.product_id);
    const quantity = Number(rawItem.quantity);
    if (!Number.isInteger(product_id) || product_id <= 0) return json({ ok: false, error: "Every cart item must have a valid product_id." }, 400);
    if (!Number.isInteger(quantity) || quantity <= 0) return json({ ok: false, error: "Every cart item must have a quantity of at least 1." }, 400);

    const product = productMap.get(product_id);
    if (!product) return json({ ok: false, error: `Product ${product_id} was not found.` }, 404);
    if (String(product.status || "").toLowerCase() !== "active") return json({ ok: false, error: `Product ${product.name || product_id} is not available.` }, 400);

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

  if (giftCardPurchase) {
    const lineSubtotal = giftCardPurchase.amount_cents;
    subtotal_cents += lineSubtotal;
    orderItems.push({
      product_id: null,
      sku: 'DND-GIFT-CARD',
      product_name: `${giftCardPurchase.purchase_label} for ${giftCardPurchase.recipient_name || giftCardPurchase.recipient_email}`,
      product_type: 'digital',
      unit_price_cents: giftCardPurchase.amount_cents,
      quantity: 1,
      line_subtotal_cents: lineSubtotal,
      taxable: 0,
      tax_class_code: '',
      requires_shipping: 0,
      digital_file_url: '',
      currency: giftCardPurchase.currency || currency || 'CAD',
      gift_card_purchase: giftCardPurchase
    });
  }

  const fulfillment_type = normalizeFulfillmentType(orderItems);
  const shippingError = validateShippingFields(fulfillment_type, { shipping_name, shipping_address1, shipping_city, shipping_province, shipping_postal_code, shipping_country });
  if (shippingError) return json({ ok: false, error: shippingError }, 400);

  let giftCard = null;
  let discount_cents = 0;
  if (gift_card_code) {
    await ensureGiftCardTables(db);
    giftCard = await db.prepare(`
      SELECT gift_card_id, code, currency, remaining_amount_cents, status, expires_at
      FROM gift_cards
      WHERE UPPER(code) = ?
      LIMIT 1
    `).bind(gift_card_code).first();
    if (!giftCard) return json({ ok: false, error: 'Gift card not found.' }, 404);
    if (String(giftCard.status || 'active').toLowerCase() !== 'active') return json({ ok: false, error: 'Gift card is not active.' }, 400);
    if (giftCard.expires_at && String(giftCard.expires_at) < new Date().toISOString().slice(0, 10)) return json({ ok: false, error: 'Gift card has expired.' }, 400);
    if (String(giftCard.currency || 'CAD').toUpperCase() !== currency) return json({ ok: false, error: 'Gift card currency does not match this order.' }, 400);
    const provisionalTax = calculateTaxCents(subtotal_cents, shipping_cents, 0.13);
    const maxDiscount = Math.max(0, subtotal_cents + shipping_cents + provisionalTax);
    discount_cents = Math.min(maxDiscount, Math.max(0, Number(giftCard.remaining_amount_cents || 0)), requested_gift_card_discount_cents || maxDiscount);
  }

  const tax_cents = calculateTaxCents(Math.max(0, subtotal_cents - discount_cents), shipping_cents, 0.13);
  const total_cents = Math.max(0, subtotal_cents - discount_cents + shipping_cents + tax_cents);
  const order_number = generateOrderNumber();
  const user_id = sessionUser?.user_id || null;

  const insertOrder = await db.prepare(`
    INSERT INTO orders (
      order_number, user_id, customer_email, customer_name, order_status, payment_status, payment_method, fulfillment_type, currency,
      subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
      shipping_name, shipping_company, shipping_address1, shipping_address2, shipping_city, shipping_province, shipping_postal_code, shipping_country,
      billing_name, billing_company, billing_address1, billing_address2, billing_city, billing_province, billing_postal_code, billing_country,
      notes, created_at, updated_at
    )
    VALUES (
      ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).bind(
    order_number, user_id, customer_email, customer_name, payment_method, fulfillment_type, currency,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    shipping_name || null, shipping_company || null, shipping_address1 || null, shipping_address2 || null, shipping_city || null, shipping_province || null, shipping_postal_code || null, shipping_country || null,
    billing_name || null, billing_company || null, billing_address1 || null, billing_address2 || null, billing_city || null, billing_province || null, billing_postal_code || null, billing_country || null,
    notes || null
  ).run();

  const order_id = Number(insertOrder?.meta?.last_row_id || 0);
  if (!order_id) return json({ ok: false, error: "Order could not be created." }, 500);

  for (const item of orderItems) {
    await db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, sku, product_name, product_type, unit_price_cents, quantity, line_subtotal_cents, taxable, tax_class_code, requires_shipping, digital_file_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      order_id, item.product_id, item.sku || null, item.product_name, item.product_type, item.unit_price_cents, item.quantity, item.line_subtotal_cents, item.taxable, item.tax_class_code || null, item.requires_shipping, item.digital_file_url || null
    ).run();
  }

  const historyNote = sessionUser ? `Order created by ${sessionUser.display_name || sessionUser.email || `user #${sessionUser.user_id}`}.` : "Order created from checkout.";
  await db.prepare(`
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(order_id, "draft", "pending", sessionUser?.user_id || null, historyNote).run();

  if (giftCard && discount_cents > 0) {
    const remaining = Math.max(0, Number(giftCard.remaining_amount_cents || 0) - discount_cents);
    await db.prepare(`UPDATE gift_cards SET remaining_amount_cents = ?, status = CASE WHEN ? <= 0 THEN 'redeemed' ELSE 'active' END, last_redeemed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE gift_card_id = ?`).bind(remaining, remaining, Number(giftCard.gift_card_id || 0)).run();
    await db.prepare(`INSERT INTO gift_card_redemptions (gift_card_id, order_id, redeemed_amount_cents, redeemed_by_email, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(Number(giftCard.gift_card_id || 0), order_id, discount_cents, customer_email || null).run().catch(() => null);
  }

  let createdGiftCard = null;
  if (giftCardPurchase) {
    await ensureGiftCardTables(db);
    const code = generateGiftCardCode();
    await db.prepare(`
      INSERT INTO gift_cards (
        code, currency, initial_amount_cents, remaining_amount_cents,
        issued_to_email, issued_to_name, recipient_email, recipient_name,
        purchaser_email, purchaser_name, purchaser_user_id,
        note, recipient_note, status, expires_at, order_id, purchase_source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_activation', ?, ?, 'storefront_checkout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      code,
      giftCardPurchase.currency || currency,
      giftCardPurchase.amount_cents,
      giftCardPurchase.amount_cents,
      giftCardPurchase.recipient_email,
      giftCardPurchase.recipient_name || null,
      giftCardPurchase.recipient_email,
      giftCardPurchase.recipient_name || null,
      giftCardPurchase.purchaser_email || customer_email || null,
      giftCardPurchase.purchaser_name || customer_name || null,
      user_id,
      `${notes ? `${notes} • ` : ''}Storefront gift card purchase pending payment confirmation.`.trim(),
      giftCardPurchase.recipient_note || null,
      giftCardPurchase.expires_at || null,
      order_id
    ).run();
    createdGiftCard = await db.prepare(`SELECT gift_card_id, code, currency, initial_amount_cents, remaining_amount_cents, recipient_email, recipient_name, purchaser_email, purchaser_name, status, expires_at FROM gift_cards WHERE order_id = ? ORDER BY gift_card_id DESC LIMIT 1`).bind(order_id).first().catch(() => null);
  }

  if (customer_email) {
    await db.prepare(`UPDATE checkout_recovery_leads SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE LOWER(COALESCE(customer_email,'')) = LOWER(?) AND status != 'converted'`).bind(customer_email).run().catch(() => null);
  }

  const createdOrder = await db.prepare(`
    SELECT order_id, order_number, user_id, customer_email, customer_name, order_status, payment_status, payment_method, fulfillment_type, currency,
           subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, created_at, updated_at
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `).bind(order_id).first();

  return json({
    ok: true,
    message: giftCardPurchase ? "Order created successfully. Gift card purchase recorded and waiting for payment confirmation." : "Order created successfully.",
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
    items: orderItems,
    storefront_gift_card: createdGiftCard ? {
      gift_card_id: Number(createdGiftCard.gift_card_id || 0),
      code: createdGiftCard.code || '',
      currency: createdGiftCard.currency || currency,
      initial_amount_cents: Number(createdGiftCard.initial_amount_cents || 0),
      remaining_amount_cents: Number(createdGiftCard.remaining_amount_cents || 0),
      recipient_email: createdGiftCard.recipient_email || '',
      recipient_name: createdGiftCard.recipient_name || '',
      purchaser_email: createdGiftCard.purchaser_email || '',
      purchaser_name: createdGiftCard.purchaser_name || '',
      status: createdGiftCard.status || 'pending_activation',
      expires_at: createdGiftCard.expires_at || null
    } : null
  });
}
