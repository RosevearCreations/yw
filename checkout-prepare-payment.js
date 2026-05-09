// File: /functions/api/checkout-prepare-payment.js
// Brief description: Prepares a payment handoff for an existing order. It validates the order,
// creates or reuses a pending payment record, and returns a live PayPal or Stripe redirect when
// credentials are configured, while still supporting safe stub/manual fallback flows.

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

function normalizeProvider(value) {
  const provider = normalizeText(value).toLowerCase();
  return ["paypal", "stripe", "square", "manual", "other"].includes(provider)
    ? provider
    : "";
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function getDb(env) {
  return env.DB || env.DD_DB;
}

function getBaseUrl(request, env) {
  return normalizeText(env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

async function getOrCreatePendingPayment(env, order_id, provider, order) {
  const db = getDb(env);

  const existingPendingPaymentsResult = await db.prepare(`
    SELECT
      payment_id,
      order_id,
      provider,
      provider_payment_id,
      provider_order_id,
      payment_status,
      amount_cents,
      currency,
      payment_method_label,
      transaction_reference,
      paid_at,
      created_at,
      updated_at,
      notes
    FROM payments
    WHERE order_id = ?
      AND LOWER(COALESCE(provider, '')) = ?
      AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'authorized')
    ORDER BY payment_id DESC
  `)
    .bind(order_id, provider)
    .all();

  const existingPendingPayments = normalizeResults(existingPendingPaymentsResult);
  let paymentRecord = existingPendingPayments[0] || null;

  if (!paymentRecord) {
    const insertResult = await db.prepare(`
      INSERT INTO payments (
        order_id,
        provider,
        payment_status,
        amount_cents,
        currency,
        payment_method_label,
        created_at,
        updated_at,
        notes
      )
      VALUES (?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `)
      .bind(
        order_id,
        provider,
        Number(order.total_cents || 0),
        order.currency || "CAD",
        provider,
        `Prepared for ${provider} checkout handoff.`
      )
      .run();

    const payment_id = Number(insertResult?.meta?.last_row_id || 0);

    if (payment_id > 0) {
      paymentRecord = await db.prepare(`
        SELECT
          payment_id,
          order_id,
          provider,
          provider_payment_id,
          provider_order_id,
          payment_status,
          amount_cents,
          currency,
          payment_method_label,
          transaction_reference,
          paid_at,
          created_at,
          updated_at,
          notes
        FROM payments
        WHERE payment_id = ?
        LIMIT 1
      `)
        .bind(payment_id)
        .first();
    }
  }

  return paymentRecord;
}

async function getPaypalAccessToken(env) {
  const clientId = normalizeText(env.PAYPAL_CLIENT_ID);
  const secret = normalizeText(env.PAYPAL_SECRET);
  const mode = normalizeText(env.PAYPAL_ENV || "sandbox").toLowerCase() || "sandbox";

  if (!clientId || !secret) {
    return null;
  }

  const base = mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

  const basic = btoa(`${clientId}:${secret}`);

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Failed to obtain PayPal access token.");
  }

  return {
    access_token: data.access_token,
    base,
    mode
  };
}

async function createPaypalOrder(request, env, order, paymentRecord) {
  const db = getDb(env);
  const auth = await getPaypalAccessToken(env);
  if (!auth) return null;

  const baseUrl = getBaseUrl(request, env);
  const returnUrl = `${baseUrl}/checkout/confirmation/?order_id=${encodeURIComponent(String(order.order_id || ""))}&order_number=${encodeURIComponent(String(order.order_number || ""))}&provider=paypal&payment_provider=paypal`;
  const cancelUrl = `${baseUrl}/checkout/?order_id=${encodeURIComponent(String(order.order_id || ""))}`;

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: String(order.order_number || order.order_id || "order"),
        description: `Devil n Dove order ${String(order.order_number || order.order_id || "")}`,
        custom_id: String(order.order_id || ""),
        amount: {
          currency_code: String(order.currency || "CAD").toUpperCase(),
          value: (Number(order.total_cents || 0) / 100).toFixed(2)
        }
      }
    ],
    payer: {
      email_address: order.customer_email || undefined,
      name: order.customer_name ? { given_name: order.customer_name } : undefined
    },
    application_context: {
      brand_name: "Devil n Dove",
      user_action: "PAY_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };

  const response = await fetch(`${auth.base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    throw new Error(data?.message || data?.details?.[0]?.description || "Failed to create PayPal order.");
  }

  const approveLink = Array.isArray(data.links)
    ? data.links.find((link) => String(link.rel || "").toLowerCase() === "approve")
    : null;

  await db.prepare(`
    UPDATE payments
    SET
      provider_order_id = ?,
      transaction_reference = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ?
  `)
    .bind(
      String(data.id || ""),
      String(data.id || ""),
      `Prepared for paypal checkout handoff.${approveLink?.href ? ` Approval URL created.` : ""}`,
      Number(paymentRecord.payment_id || 0)
    )
    .run();

  await db.prepare(`
    UPDATE orders
    SET payment_status = 'pending', payment_method = 'paypal', updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(Number(order.order_id || 0)).run();

  return {
    provider: "paypal",
    mode: auth.mode,
    redirect_url: approveLink?.href || null,
    provider_order_id: String(data.id || ""),
    provider_payment_id: null,
    status: "pending"
  };
}

async function createStripeCheckoutSession(request, env, order, paymentRecord) {
  const db = getDb(env);
  const secretKey = normalizeText(env.STRIPE_SECRET_KEY);
  if (!secretKey) return null;

  const baseUrl = getBaseUrl(request, env);
  const successUrl = `${baseUrl}/checkout/confirmation/?order_id=${encodeURIComponent(String(order.order_id || ""))}&order_number=${encodeURIComponent(String(order.order_number || ""))}&payment_provider=stripe&provider=stripe&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/checkout/?order_id=${encodeURIComponent(String(order.order_id || ""))}`;

  const orderItemsResult = await db.prepare(`
    SELECT product_name, quantity, unit_price_cents
    FROM order_items
    WHERE order_id = ?
    ORDER BY order_item_id ASC
  `).bind(Number(order.order_id || 0)).all();

  const orderItems = normalizeResults(orderItemsResult);
  const lineItems = orderItems.map((item) => ({
    price_data: {
      currency: String(order.currency || "CAD").toLowerCase(),
      product_data: {
        name: String(item.product_name || "Devil n Dove item").slice(0, 200)
      },
      unit_amount: Math.max(0, Number(item.unit_price_cents || 0))
    },
    quantity: Math.max(1, Number(item.quantity || 1))
  }));

  if (Number(order.shipping_cents || 0) > 0) {
    lineItems.push({
      price_data: {
        currency: String(order.currency || "CAD").toLowerCase(),
        product_data: { name: "Shipping" },
        unit_amount: Math.max(0, Number(order.shipping_cents || 0))
      },
      quantity: 1
    });
  }

  if (Number(order.tax_cents || 0) > 0) {
    lineItems.push({
      price_data: {
        currency: String(order.currency || "CAD").toLowerCase(),
        product_data: { name: "Tax" },
        unit_amount: Math.max(0, Number(order.tax_cents || 0))
      },
      quantity: 1
    });
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("customer_email", String(order.customer_email || ""));
  params.set("billing_address_collection", "required");
  params.set("submit_type", "pay");
  params.set("metadata[order_id]", String(order.order_id || ""));
  params.set("metadata[order_number]", String(order.order_number || ""));
  params.set("payment_intent_data[metadata][order_id]", String(order.order_id || ""));
  params.set("payment_intent_data[metadata][order_number]", String(order.order_number || ""));

  if (order.shipping_address1 || order.shipping_city || order.shipping_country) {
    params.set("shipping_address_collection[allowed_countries][0]", "CA");
    params.set("shipping_address_collection[allowed_countries][1]", "US");
  }

  lineItems.forEach((lineItem, index) => {
    params.set(`line_items[${index}][price_data][currency]`, lineItem.price_data.currency);
    params.set(`line_items[${index}][price_data][product_data][name]`, lineItem.price_data.product_data.name);
    params.set(`line_items[${index}][price_data][unit_amount]`, String(lineItem.price_data.unit_amount));
    params.set(`line_items[${index}][quantity]`, String(lineItem.quantity));
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.id) {
    throw new Error(data?.error?.message || "Failed to create Stripe Checkout session.");
  }

  await db.prepare(`
    UPDATE payments
    SET
      provider_order_id = ?,
      transaction_reference = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ?
  `)
    .bind(
      String(data.id || ""),
      String(data.payment_intent || data.id || ""),
      `Prepared for stripe checkout handoff.${data.url ? ` Hosted checkout URL created.` : ""}`,
      Number(paymentRecord.payment_id || 0)
    )
    .run();

  await db.prepare(`
    UPDATE orders
    SET payment_status = 'pending', payment_method = 'stripe', updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(Number(order.order_id || 0)).run();

  return {
    provider: "stripe",
    mode: "hosted_checkout",
    redirect_url: String(data.url || "") || null,
    provider_order_id: String(data.id || ""),
    provider_payment_id: String(data.payment_intent || "") || null,
    status: String(data.payment_status || "unpaid").toLowerCase() === "paid" ? "paid" : "pending"
  };
}

function buildStubPreparation(provider, order, paymentRecord) {
  return {
    provider,
    mode: "stub",
    redirect_url: null,
    provider_order_id: paymentRecord?.provider_order_id || null,
    provider_payment_id: paymentRecord?.provider_payment_id || null,
    status: String(paymentRecord?.payment_status || order?.payment_status || "pending").toLowerCase() || "pending"
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);

  if (!db) {
    return json({ ok: false, error: "Database binding is missing." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const order_id = Number(body?.order_id || 0);
  const provider = normalizeProvider(body?.provider || body?.payment_method || "paypal") || "paypal";

  if (!Number.isInteger(order_id) || order_id <= 0) {
    return json({ ok: false, error: "A valid order_id is required." }, 400);
  }

  const order = await db.prepare(`
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
      shipping_address1,
      shipping_city,
      shipping_country,
      created_at,
      updated_at
    FROM orders
    WHERE order_id = ?
    LIMIT 1
  `)
    .bind(order_id)
    .first();

  if (!order) {
    return json({ ok: false, error: "Order not found." }, 404);
  }

  const currentOrderStatus = normalizeText(order.order_status).toLowerCase();
  if (["cancelled", "refunded", "fulfilled"].includes(currentOrderStatus)) {
    return json({ ok: false, error: `Payments can no longer be prepared for ${currentOrderStatus} orders.` }, 409);
  }

  const paymentRecord = await getOrCreatePendingPayment(env, order_id, provider, order);

  if (!paymentRecord) {
    return json({ ok: false, error: "A pending payment record could not be created." }, 500);
  }

  let preparation;

  try {
    if (provider === "paypal") {
      preparation = await createPaypalOrder(request, env, order, paymentRecord);
    } else if (provider === "stripe") {
      preparation = await createStripeCheckoutSession(request, env, order, paymentRecord);
    }
  } catch (error) {
    await db.prepare(`
      UPDATE payments
      SET notes = COALESCE(notes, '') || ?, updated_at = CURRENT_TIMESTAMP
      WHERE payment_id = ?
    `).bind(
      ` Preparation error for ${provider}: ${String(error?.message || error)}.`,
      Number(paymentRecord.payment_id || 0)
    ).run();

    return json({
      ok: false,
      error: String(error?.message || `Failed to prepare ${provider} payment.`),
      payment_preparation: {
        order_id,
        provider,
        payment_id: Number(paymentRecord.payment_id || 0)
      }
    }, 502);
  }

  if (!preparation) {
    preparation = buildStubPreparation(provider, order, paymentRecord);
  }

  const refreshedPayment = await db.prepare(`
    SELECT
      payment_id,
      provider,
      provider_payment_id,
      provider_order_id,
      payment_status,
      amount_cents,
      currency,
      payment_method_label,
      transaction_reference,
      paid_at,
      created_at,
      updated_at,
      notes
    FROM payments
    WHERE payment_id = ?
    LIMIT 1
  `).bind(Number(paymentRecord.payment_id || 0)).first();

  return json({
    ok: true,
    message: `${provider.charAt(0).toUpperCase()}${provider.slice(1)} payment preparation created.`,
    payment_preparation: {
      order_id: Number(order.order_id || 0),
      order_number: order.order_number || "",
      provider,
      redirect_url: preparation.redirect_url || null,
      mode: preparation.mode || "stub",
      payment_stub: {
        payment_id: Number(refreshedPayment?.payment_id || paymentRecord.payment_id || 0),
        provider: refreshedPayment?.provider || provider,
        provider_payment_id: refreshedPayment?.provider_payment_id || preparation.provider_payment_id || null,
        provider_order_id: refreshedPayment?.provider_order_id || preparation.provider_order_id || null,
        payment_status: refreshedPayment?.payment_status || preparation.status || "pending",
        amount_cents: Number(refreshedPayment?.amount_cents || order.total_cents || 0),
        currency: refreshedPayment?.currency || order.currency || "CAD",
        payment_method_label: refreshedPayment?.payment_method_label || provider,
        transaction_reference: refreshedPayment?.transaction_reference || null,
        paid_at: refreshedPayment?.paid_at || null,
        created_at: refreshedPayment?.created_at || null,
        updated_at: refreshedPayment?.updated_at || null,
        notes: refreshedPayment?.notes || null
      }
    }
  });
}
