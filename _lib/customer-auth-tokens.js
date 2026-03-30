
import { serviceHeaders } from "./customer-session.js";
import { dispatchNotificationThroughProvider } from "./provider-dispatch.js";

export async function issueCustomerAuthToken({ env, customerProfileId, purpose, expiresMinutes = 60, payload = {} }) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server configuration is incomplete.");
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + Math.max(5, Number(expiresMinutes || 60)) * 60000).toISOString();
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_tokens`, {
    method: "POST",
    headers: { ...serviceHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify([{
      customer_profile_id: customerProfileId,
      purpose,
      token_hash: tokenHash,
      payload,
      expires_at: expiresAt
    }])
  });
  if (!res.ok) throw new Error(`Could not create auth token. ${await res.text()}`);
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] || null : null;
  return { rawToken, tokenHash, record: row, expiresAt };
}

export async function consumeCustomerAuthToken({ env, rawToken, purpose }) {
  const row = await loadCustomerAuthToken({ env, rawToken, purpose, includeCustomer: true });
  if (!row) return null;
  await markCustomerAuthTokenUsed({ env, tokenId: row.id });
  return row;
}

export async function loadCustomerAuthToken({ env, rawToken, purpose, includeCustomer = false }) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY || !rawToken || !purpose) return null;
  const tokenHash = await sha256Hex(rawToken);
  let select = 'id,customer_profile_id,purpose,token_hash,expires_at,used_at,payload,created_at';
  if (includeCustomer) {
    select += ',customer_profile:customer_profiles!customer_auth_tokens_customer_profile_id_fkey(id,email,full_name,is_active,email_verified_at,notification_channel,notification_opt_in,phone)';
  }
  const url = `${env.SUPABASE_URL}/rest/v1/customer_auth_tokens?select=${encodeURIComponent(select)}&purpose=eq.${encodeURIComponent(purpose)}&token_hash=eq.${encodeURIComponent(tokenHash)}&order=created_at.desc&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders(env) });
  if (!res.ok) throw new Error(`Could not load auth token. ${await res.text()}`);
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] || null : null;
  if (!row) return null;
  if (row.used_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function markCustomerAuthTokenUsed({ env, tokenId }) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/customer_auth_tokens?id=eq.${encodeURIComponent(tokenId)}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(env), Prefer: 'return=minimal' },
    body: JSON.stringify({ used_at: new Date().toISOString() })
  });
  if (!res.ok) throw new Error(`Could not mark auth token used. ${await res.text()}`);
}

export async function sendCustomerAuthEmail({ env, request, customer, purpose, rawToken }) {
  const origin = new URL(request.url).origin;
  let subject = '';
  let body_text = '';
  let event_type = '';
  if (purpose === 'password_reset') {
    const link = `${origin}/login?reset_token=${encodeURIComponent(rawToken)}`;
    subject = 'Reset your Rosie Dazzlers password';
    body_text = `We received a request to reset your Rosie Dazzlers password. Use this link to choose a new password: ${link}`;
    event_type = 'customer_password_reset';
  } else if (purpose === 'email_verification') {
    const link = `${origin}/login?verify_token=${encodeURIComponent(rawToken)}`;
    subject = 'Verify your Rosie Dazzlers email';
    body_text = `Please verify your Rosie Dazzlers email address by opening this link: ${link}`;
    event_type = 'customer_email_verification';
  } else {
    throw new Error('Unsupported auth email purpose.');
  }
  return dispatchNotificationThroughProvider(env, {
    event_type,
    channel: 'email',
    recipient_email: customer.email,
    recipient_phone: customer.phone || null,
    subject,
    body_text,
    payload: { purpose, customer_profile_id: customer.id || null, full_name: customer.full_name || null }
  });
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
