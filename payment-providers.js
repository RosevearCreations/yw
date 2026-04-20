// File: /functions/api/payment-providers.js
// Brief description: Returns public payment-provider readiness information for checkout.
// It exposes safe, non-secret provider availability flags so checkout can explain
// which payment methods are configured live and which are still operating in stub mode.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function isConfigured(value) {
  return String(value || "").trim().length > 0;
}

export async function onRequestGet(context) {
  const { env } = context;

  const paypalConfigured = isConfigured(env.PAYPAL_CLIENT_ID) && isConfigured(env.PAYPAL_SECRET);
  const paypalWebhookConfigured = isConfigured(env.PAYPAL_WEBHOOK_ID);
  const stripeConfigured = isConfigured(env.STRIPE_PUBLISHABLE_KEY) && isConfigured(env.STRIPE_SECRET_KEY);
  const stripeWebhookConfigured = isConfigured(env.STRIPE_WEBHOOK_SECRET);
  const squareConfigured = isConfigured(env.SQUARE_APPLICATION_ID) && isConfigured(env.SQUARE_ACCESS_TOKEN);

  return json({
    ok: true,
    providers: [
      {
        code: "paypal",
        label: "PayPal",
        ready: paypalConfigured,
        mode: paypalConfigured ? (String(env.PAYPAL_ENV || "sandbox").trim().toLowerCase() || "sandbox") : "stub",
        checkout_kind: "redirect",
        webhook_ready: paypalWebhookConfigured
      },
      {
        code: "stripe",
        label: "Card / Stripe",
        ready: stripeConfigured,
        mode: stripeConfigured ? "hosted_checkout" : "stub",
        checkout_kind: "hosted_checkout",
        webhook_ready: stripeWebhookConfigured
      },
      {
        code: "square",
        label: "Square",
        ready: squareConfigured,
        mode: squareConfigured ? "live_bridge" : "stub",
        checkout_kind: "hosted_or_sdk",
        webhook_ready: false
      },
      {
        code: "manual",
        label: "Manual / Invoice",
        ready: true,
        mode: "manual",
        checkout_kind: "offline",
        webhook_ready: false
      },
      {
        code: "other",
        label: "Other",
        ready: true,
        mode: "manual",
        checkout_kind: "offline",
        webhook_ready: false
      }
    ]
  });
}
