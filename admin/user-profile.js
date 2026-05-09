// File: /functions/api/admin/user-profile.js
// Brief description: Gets or updates a full customer/employee profile for a selected user.
// It validates the admin session, supports profile reads and writes, and keeps profile
// details separate from the core auth user record while still supporting future tiering.

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

function normalizeProfileType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["customer", "employee", "both", "other"].includes(normalized)
    ? normalized
    : "customer";
}

function normalizeContactMethod(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ["email", "phone", "text", "mail", "none"].includes(normalized)
    ? normalized
    : "email";
}

function normalizeBool(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getAdminUserFromRequest(request, env) {
  const token = getBearerToken(request);

  if (!token) return null;

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
    INNER JOIN users u ON u.user_id = s.user_id
    WHERE (s.session_token = ? OR s.token = ?)
      AND s.expires_at > datetime('now')
    LIMIT 1
  `).bind(token, token).first();

  if (!session) return null;
  if (Number(session.is_active || 0) !== 1) return null;
  if (String(session.role || "").toLowerCase() !== "admin") return null;

  return {
    session_id: Number(session.session_id || 0),
    user_id: Number(session.resolved_user_id || session.user_id || 0),
    email: session.email || "",
    display_name: session.display_name || ""
  };
}

async function getTierCodesForUser(env, userId) {
  const result = await env.DB.prepare(`
    SELECT at.code
    FROM user_access_tiers uat
    JOIN access_tiers at ON at.access_tier_id = uat.access_tier_id
    WHERE uat.user_id = ?
    ORDER BY at.code ASC
  `).bind(userId).all();

  return (Array.isArray(result?.results) ? result.results : []).map((row) => row.code || "");
}

async function readProfile(env, userId) {
  const user = await env.DB.prepare(`
    SELECT user_id, email, display_name, role, is_active, created_at, updated_at
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!user) return null;

  const profile = await env.DB.prepare(`
    SELECT
      user_profile_id,
      user_id,
      profile_type,
      preferred_name,
      company_name,
      phone,
      phone_verified,
      email_verified,
      preferred_contact_method,
      contact_notes,
      marketing_opt_in,
      order_updates_opt_in,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      country,
      emergency_contact_name,
      emergency_contact_phone,
      employee_code,
      department,
      job_title,
      created_at,
      updated_at
    FROM user_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();

  const access_tier_codes = await getTierCodesForUser(env, userId);

  return {
    user: {
      user_id: Number(user.user_id || 0),
      email: user.email || "",
      display_name: user.display_name || "",
      role: user.role || "member",
      is_active: Number(user.is_active || 0),
      created_at: user.created_at || null,
      updated_at: user.updated_at || null
    },
    profile: {
      user_profile_id: Number(profile?.user_profile_id || 0),
      user_id: Number(user.user_id || 0),
      profile_type: profile?.profile_type || "customer",
      preferred_name: profile?.preferred_name || "",
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
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null,
      access_tier_codes
    }
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  const url = new URL(request.url);
  const user_id = Number(url.searchParams.get("user_id"));
  if (!Number.isInteger(user_id) || user_id <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  const payload = await readProfile(env, user_id);
  if (!payload) return json({ ok: false, error: "User not found." }, 404);

  return json({
    ok: true,
    requested_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    ...payload
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const user_id = Number(body.user_id);
  if (!Number.isInteger(user_id) || user_id <= 0) {
    return json({ ok: false, error: "A valid user_id is required." }, 400);
  }

  const existingUser = await env.DB.prepare(`SELECT user_id FROM users WHERE user_id = ? LIMIT 1`).bind(user_id).first();
  if (!existingUser) return json({ ok: false, error: "User not found." }, 404);

  const profile_type = normalizeProfileType(body.profile_type);
  const preferred_name = normalizeText(body.preferred_name);
  const company_name = normalizeText(body.company_name);
  const phone = normalizeText(body.phone);
  const phone_verified = normalizeBool(body.phone_verified, 0);
  const email_verified = normalizeBool(body.email_verified, 0);
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
  const emergency_contact_name = normalizeText(body.emergency_contact_name);
  const emergency_contact_phone = normalizeText(body.emergency_contact_phone);
  const employee_code = normalizeText(body.employee_code);
  const department = normalizeText(body.department);
  const job_title = normalizeText(body.job_title);

  await env.DB.prepare(`
    INSERT INTO user_profiles (
      user_id, profile_type, preferred_name, company_name, phone, phone_verified,
      email_verified, preferred_contact_method, contact_notes, marketing_opt_in,
      order_updates_opt_in, address_line1, address_line2, city, province,
      postal_code, country, emergency_contact_name, emergency_contact_phone,
      employee_code, department, job_title, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      profile_type = excluded.profile_type,
      preferred_name = excluded.preferred_name,
      company_name = excluded.company_name,
      phone = excluded.phone,
      phone_verified = excluded.phone_verified,
      email_verified = excluded.email_verified,
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
      emergency_contact_name = excluded.emergency_contact_name,
      emergency_contact_phone = excluded.emergency_contact_phone,
      employee_code = excluded.employee_code,
      department = excluded.department,
      job_title = excluded.job_title,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    user_id,
    profile_type,
    preferred_name || null,
    company_name || null,
    phone || null,
    phone_verified,
    email_verified,
    preferred_contact_method,
    contact_notes || null,
    marketing_opt_in,
    order_updates_opt_in,
    address_line1 || null,
    address_line2 || null,
    city || null,
    province || null,
    postal_code || null,
    country || null,
    emergency_contact_name || null,
    emergency_contact_phone || null,
    employee_code || null,
    department || null,
    job_title || null
  ).run();

  const payload = await readProfile(env, user_id);
  return json({
    ok: true,
    message: "User profile updated successfully.",
    updated_by: {
      user_id: adminUser.user_id,
      email: adminUser.email,
      display_name: adminUser.display_name
    },
    ...payload
  });
}
