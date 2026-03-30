import { loadRecoverySettings } from "./app-settings.js";

export async function dispatchNotificationThroughProvider(env, event, options = {}) {
  const channel = String(event.channel || "").trim().toLowerCase();
  const payload = {
    id: event.id || null,
    event_type: event.event_type || null,
    channel,
    recipient_email: event.recipient_email || null,
    recipient_phone: event.recipient_phone || null,
    subject: event.subject || null,
    body_text: event.body_text || null,
    body_html: event.body_html || null,
    payload: event.payload || null,
    preview_mode: options.preview === true
  };

  const recoverySettings = await loadRecoverySettings(env).catch(() => null);
  const providerRules = recoverySettings?.recovery_provider_rules || {};
  const eventType = String(event.event_type || '').trim().toLowerCase();
  const isRecovery = eventType === 'abandoned_checkout_recovery';
  const rule = providerRules?.[channel] || {};

  if (rule.enabled === false) {
    return { ok: false, provider: channel || 'unknown', error: `${channel || 'Provider'} dispatch is disabled by settings.` };
  }

  if (channel === "email") {
    const url = (isRecovery && rule.recovery_webhook_url) || env.RECOVERY_EMAIL_WEBHOOK_URL || env.NOTIFICATIONS_EMAIL_WEBHOOK_URL || "";
    const authToken = rule.auth_token || env.RECOVERY_PROVIDER_AUTH_TOKEN || env.NOTIFICATIONS_PROVIDER_AUTH_TOKEN || '';
    const previewRecipient = options.previewRecipient || rule.send_test_to || '';
    const outbound = options.preview === true && previewRecipient ? { ...payload, recipient_email: previewRecipient } : payload;
    if (!url) return { ok: false, provider: rule.provider_key || 'email', error: 'Missing email provider webhook URL.' };
    return postJson(url, outbound, authToken, rule.provider_key || 'email');
  }

  if (channel === "sms") {
    const url = (isRecovery && rule.recovery_webhook_url) || env.RECOVERY_SMS_WEBHOOK_URL || env.NOTIFICATIONS_SMS_WEBHOOK_URL || "";
    const authToken = rule.auth_token || env.RECOVERY_PROVIDER_AUTH_TOKEN || env.NOTIFICATIONS_PROVIDER_AUTH_TOKEN || '';
    const previewRecipient = options.previewRecipient || rule.send_test_to || '';
    const outbound = options.preview === true && previewRecipient ? { ...payload, recipient_phone: previewRecipient } : payload;
    if (!url) return { ok: false, provider: rule.provider_key || 'sms', error: 'Missing SMS provider webhook URL.' };
    return postJson(url, outbound, authToken, rule.provider_key || 'sms');
  }

  return { ok: false, provider: channel || "unknown", error: "Unsupported notification channel." };
}

async function postJson(url, payload, bearerToken, providerKey) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      return { ok: false, status: response.status, provider: providerKey || null, error: data?.error || text || `Provider returned ${response.status}.` };
    }

    return { ok: true, status: response.status, provider: providerKey || null, provider_response: data || text || null };
  } catch (err) {
    return { ok: false, provider: providerKey || null, error: err?.message || 'Provider dispatch failed.' };
  }
}
