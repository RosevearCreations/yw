import { getDb, getClientIp, jsonResponse, normalizeText } from "../_lib/adminAudit.js";
import { processNotificationOutbox, queueNotification } from "../_lib/notificationOutbox.js";

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const requestType = normalizeText(body.request_type);
  const contactEmail = normalizeEmail(body.contact_email);
  const possibleEmail = normalizeEmail(body.possible_email);
  const displayName = normalizeText(body.display_name);
  const note = normalizeText(body.note);
  const ipAddress = getClientIp(request);
  const userAgent = normalizeText(request.headers.get('User-Agent'));

  if (!['forgot_password', 'forgot_email'].includes(requestType)) {
    return jsonResponse({ ok: false, error: 'Invalid request type.' }, 400);
  }
  if (!contactEmail) {
    return jsonResponse({ ok: false, error: 'A contact email is required.' }, 400);
  }

  try {
    const recentByEmail = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM auth_recovery_requests
      WHERE contact_email = ?
        AND created_at >= datetime('now', '-1 hour')
    `).bind(contactEmail).first();

    const recentByIp = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM auth_recovery_requests
      WHERE COALESCE(ip_address, '') = ?
        AND created_at >= datetime('now', '-1 hour')
    `).bind(ipAddress || '').first();

    if (Number(recentByEmail?.count || 0) >= 3 || (ipAddress && Number(recentByIp?.count || 0) >= 6)) {
      return jsonResponse({
        ok: true,
        message: 'Your request has been recorded. For privacy, we do not confirm whether a matching account exists.'
      }, 202);
    }
  } catch {}

  const inserted = await db.prepare(`
    INSERT INTO auth_recovery_requests (
      request_type,
      contact_email,
      possible_email,
      display_name,
      note,
      ip_address,
      user_agent,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(requestType, contactEmail, possibleEmail || null, displayName || null, note || null, ipAddress || null, userAgent || null).run();

  const adminDestination = normalizeEmail(env.ACCOUNT_HELP_REVIEW_EMAIL || env.NOTIFICATION_ADMIN_TO || env.NOTIFICATION_FROM_EMAIL);
  if (adminDestination) {
    await queueNotification(db, {
      notification_kind: 'account_recovery_request',
      channel: 'email',
      destination: adminDestination,
      payload: {
        request_id: Number(inserted?.meta?.last_row_id || 0),
        request_type: requestType,
        contact_email: contactEmail,
        possible_email: possibleEmail || '',
        display_name: displayName || '',
        note: note || ''
      }
    }).catch(() => null);
  }

  await queueNotification(db, {
    notification_kind: 'account_recovery_received',
    channel: 'email',
    destination: contactEmail,
    payload: {
      request_id: Number(inserted?.meta?.last_row_id || 0),
      request_type: requestType,
      contact_email: contactEmail
    }
  }).catch(() => null);

  await processNotificationOutbox(env, { limit: 5 }).catch(() => null);

  return jsonResponse({
    ok: true,
    message: 'Your request has been recorded. For privacy, we do not confirm whether a matching account exists.'
  });
}
