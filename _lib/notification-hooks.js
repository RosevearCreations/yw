// functions/api/_lib/notification-hooks.js
// Best-effort notification hook logging for email/SMS preference flows.

export async function queueNotificationEvent({ env, event_type, channel = null, booking_id = null, customer_profile_id = null, recipient_email = null, recipient_phone = null, payload = {} }) {
  try {
    if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY || !event_type) return { ok: false, skipped: true };
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    };
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/notification_events`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        event_type,
        channel,
        booking_id,
        customer_profile_id,
        recipient_email,
        recipient_phone,
        payload,
        status: 'queued',
        attempt_count: 0,
        next_attempt_at: new Date().toISOString(),
        max_attempts: 5
      }])
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function loadCustomerNotificationProfile({ env, customer_email = null, customer_profile_id = null }) {
  try {
    if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) return null;
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };
    let url = `${env.SUPABASE_URL}/rest/v1/customer_profiles?select=id,email,full_name,phone,notification_opt_in,notification_channel,detailer_chat_opt_in,notify_on_progress_post,notify_on_media_upload,notify_on_comment_reply`;
    if (customer_profile_id) url += `&id=eq.${encodeURIComponent(customer_profile_id)}`;
    else if (customer_email) url += `&email=eq.${encodeURIComponent(customer_email)}`;
    else return null;
    url += '&limit=1';
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch {
    return null;
  }
}

export async function maybeQueueCustomerNotification({ env, booking = null, customer_profile = null, event_type, message, channel_hint = null, payload = {} }) {
  if (!booking && !customer_profile) return { ok: false, skipped: true };
  const profile = customer_profile || await loadCustomerNotificationProfile({
    env,
    customer_profile_id: booking?.customer_profile_id || null,
    customer_email: booking?.customer_email || null
  });
  if (!profile) return { ok: false, skipped: true, reason: 'no_profile' };
  if (profile.notification_opt_in !== true) return { ok: false, skipped: true, reason: 'opted_out' };
  const channel = channel_hint || profile.notification_channel || 'email';
  return queueNotificationEvent({
    env,
    event_type,
    channel,
    booking_id: booking?.id || null,
    customer_profile_id: profile.id || null,
    recipient_email: profile.email || null,
    recipient_phone: profile.phone || null,
    payload: { message, ...payload }
  });
}
