// File: /functions/api/member/profile.js
// Brief description: Gets or updates the logged-in member profile with contact details.

import { getDb, getRequestToken, jsonResponse } from "../_lib/adminAudit.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeContactMethod(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["email", "phone", "text", "mail", "none"].includes(normalized) ? normalized : "email";
}

function normalizeBool(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

async function getMemberUserFromRequest(request, env) {
  const token = getRequestToken(request);
  const db = getDb(env);
  if (!token || !db) return null;

  const session = await db.prepare(`
    SELECT s.session_id, s.user_id, s.expires_at,
      u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active, u.created_at, u.updated_at
    FROM sessions s
    JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (!["member", "admin"].includes(String(session.role || "").toLowerCase())) return null;

  return {
    session_id: Number(session.session_id || 0),
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || "",
    display_name: session.display_name || "",
    role: session.role || "member",
    created_at: session.created_at || null,
    updated_at: session.updated_at || null,
  };
}

async function getTierCodesForUser(env, userId) {
  const db = getDb(env);
  const result = await db.prepare(`
    SELECT at.code
    FROM user_access_tiers uat
    JOIN access_tiers at ON at.access_tier_id = uat.access_tier_id
    WHERE uat.user_id = ?
    ORDER BY at.code ASC
  `).bind(userId).all();
  return (Array.isArray(result?.results) ? result.results : []).map((row) => row.code || "");
}

async function readProfile(env, user) {
  const db = getDb(env);
  const profile = await db.prepare(`
    SELECT user_profile_id, user_id, profile_type, preferred_name, company_name, phone, phone_verified, email_verified,
      preferred_contact_method, contact_notes, marketing_opt_in, order_updates_opt_in,
      address_line1, address_line2, city, province, postal_code, country,
      emergency_contact_name, emergency_contact_phone, employee_code, department, job_title, created_at, updated_at
    FROM user_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(user.user_id).first();

  return {
    user: {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    profile: {
      user_profile_id: Number(profile?.user_profile_id || 0),
      user_id: user.user_id,
      profile_type: profile?.profile_type || "customer",
      preferred_name: profile?.preferred_name || user.display_name || "",
      company_name: profile?.company_name || "",
      phone: profile?.phone || "",
      phone_verified: Number(profile?.phone_verified || 0),
      email_verified: Number(profile?.email_verified || 0),
      preferred_contact_method: profile?.preferred_contact_method || "email",
      contact_notes: profile?.contact_notes || "",
      marketing_opt_in: Number(profile?.marketing_opt_in || 0),
      order_updates_opt_in: Number(profile?.order_updates_opt_in ?? 1),
      address_line1: profile?.address_line1 || "",
      address_line2: profile?.address_line2 || "",
      city: profile?.city || "",
      province: profile?.province || "",
      postal_code: profile?.postal_code || "",
      country: profile?.country || "",
      emergency_contact_name: profile?.emergency_contact_name || "",
      emergency_contact_phone: profile?.emergency_contact_phone || "",
      employee_code: profile?.employee_code || "",
      department: profile?.department || "",
      job_title: profile?.job_title || "",
      access_tier_codes: await getTierCodesForUser(env, user.user_id),
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null,
    },
  };
}

export async function onRequestGet(context) {
  const memberUser = await getMemberUserFromRequest(context.request, context.env);
  if (!memberUser) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const payload = await readProfile(context.env, memberUser);
  return jsonResponse({ ok: true, ...payload });
}

export async function onRequestPost(context) {
  const memberUser = await getMemberUserFromRequest(context.request, context.env);
  if (!memberUser) return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  const db = getDb(context.env);
  let body;
  try { body = await context.request.json(); } catch { return jsonResponse({ ok:false, error:"Invalid JSON body." }, 400); }

  const preferred_name = normalizeText(body.preferred_name);
  const company_name = normalizeText(body.company_name);
  const phone = normalizeText(body.phone);
  const preferred_contact_method = normalizeContactMethod(body.preferred_contact_method);
  const contact_notes = normalizeText(body.contact_notes);
  const marketing_opt_in = normalizeBool(body.marketing_opt_in, 0);
  const order_updates_opt_in = normalizeBool(body.order_updates_opt_in, 1);
  const address_line1 = normalizeText(body.address_line1);
  const address_line2 = normalizeText(body.address_line2);
  const city = normalizeText(body.city);
  const province = normalizeText(body.province);
  const postal_code = normalizeText(body.postal_code);
  const country = normalizeText(body.country);

  await db.prepare(`
    INSERT INTO user_profiles (
      user_id, profile_type, preferred_name, company_name, phone, preferred_contact_method, contact_notes,
      marketing_opt_in, order_updates_opt_in, address_line1, address_line2, city, province, postal_code, country,
      created_at, updated_at
    ) VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      preferred_name = excluded.preferred_name,
      company_name = excluded.company_name,
      phone = excluded.phone,
      preferred_contact_method = excluded.preferred_contact_method,
      contact_notes = excluded.contact_notes,
      marketing_opt_in = excluded.marketing_opt_in,
      order_updates_opt_in = excluded.order_updates_opt_in,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      city = excluded.city,
      province = excluded.province,
      postal_code = excluded.postal_code,
      country = excluded.country,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    memberUser.user_id,
    preferred_name || null,
    company_name || null,
    phone || null,
    preferred_contact_method,
    contact_notes || null,
    marketing_opt_in,
    order_updates_opt_in,
    address_line1 || null,
    address_line2 || null,
    city || null,
    province || null,
    postal_code || null,
    country || null
  ).run();

  const payload = await readProfile(context.env, memberUser);
  return jsonResponse({ ok: true, message: "Profile updated successfully.", ...payload });
}
