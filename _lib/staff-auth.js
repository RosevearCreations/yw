// functions/api/_lib/staff-auth.js
//
// Unified staff auth / capability helper.
//
// What this file does:
// - keeps current ADMIN_PASSWORD bridge support
// - adds session-cookie based staff resolution
// - prefers signed-in staff session over manual bridge headers
// - resolves staff identity from staff_users
// - enforces capability checks
// - enforces scoped booking access for non-admin staff
// - provides shared json/headers/helper utilities used by admin endpoints
//
// Transition order:
// 1) session cookie if present and valid
// 2) x-staff-user-id / x-staff-email bridge headers
// 3) legacy ADMIN_PASSWORD fallback if explicitly allowed
//
// Expected env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ADMIN_PASSWORD
// - STAFF_SESSION_SECRET
//
// Expected helper file:
// - ./staff-session.js

import { getCurrentStaffSession } from "./staff-session.js";

/* ---------------- main auth entry ---------------- */

export async function requireStaffAccess({
  request,
  env,
  body = {},
  capability,
  bookingId = null,
  allowLegacyAdminFallback = false
}) {
  try {
    assertBaseEnv(env);

    // 1) Try real signed-in session first.
    const sessionResolved = await resolveSessionActor({ request, env });

    if (sessionResolved.actor) {
      const actor = sessionResolved.actor;

      if (!actor.is_active) {
        return {
          ok: false,
          response: json({ error: "Staff account is inactive." }, 403)
        };
      }

      if (capability && !hasCapability(actor, capability)) {
        return {
          ok: false,
          response: json({ error: "Permission denied." }, 403)
        };
      }

      if (bookingId && capability === "work_booking") {
        const scoped = await canActorWorkBooking({
          env,
          actor,
          bookingId
        });

        if (!scoped.ok) {
          return {
            ok: false,
            response: scoped.response
          };
        }
      }

      return {
        ok: true,
        actor,
        auth_mode: "session"
      };
    }

    // 2) Try transition bridge headers.
    const bridgeActor = await resolveBridgeActor({
      request,
      env,
      body
    });

    if (bridgeActor) {
      if (!bridgeActor.is_active) {
        return {
          ok: false,
          response: json({ error: "Staff account is inactive." }, 403)
        };
      }

      if (capability && !hasCapability(bridgeActor, capability)) {
        return {
          ok: false,
          response: json({ error: "Permission denied." }, 403)
        };
      }

      if (bookingId && capability === "work_booking") {
        const scoped = await canActorWorkBooking({
          env,
          actor: bridgeActor,
          bookingId
        });

        if (!scoped.ok) {
          return {
            ok: false,
            response: scoped.response
          };
        }
      }

      return {
        ok: true,
        actor: bridgeActor,
        auth_mode: "bridge"
      };
    }

    // 3) Optional legacy admin password fallback. Disabled unless ALLOW_LEGACY_ADMIN_FALLBACK=true.
    if (allowLegacyAdminFallback && env.ALLOW_LEGACY_ADMIN_FALLBACK === "true") {
      const passwordOk = checkAdminPassword(request, env);
      if (passwordOk) {
        const actor = makeLegacyAdminActor();

        if (capability && !hasCapability(actor, capability)) {
          return {
            ok: false,
            response: json({ error: "Permission denied." }, 403)
          };
        }

        return {
          ok: true,
          actor,
          auth_mode: "legacy_admin_password"
        };
      }
    }

    return {
      ok: false,
      response: json({ error: "Unauthorized." }, 401)
    };
  } catch (err) {
    return {
      ok: false,
      response: json(
        {
          error: err && err.message ? err.message : "Unexpected auth error."
        },
        500
      )
    };
  }
}

/* ---------------- actor resolution ---------------- */

async function resolveSessionActor({ request, env }) {
  try {
    const current = await getCurrentStaffSession({
      env,
      request
    });

    if (!current || !current.staff_user) {
      return { actor: null };
    }

    return {
      actor: normalizeActor(current.staff_user, {
        is_legacy_admin: false
      })
    };
  } catch {
    return { actor: null };
  }
}

async function resolveBridgeActor({ request, env, body }) {
  const staffUserId =
    cleanText(request.headers.get("x-staff-user-id")) ||
    cleanText(body.staff_user_id);

  const staffEmail =
    cleanEmail(request.headers.get("x-staff-email")) ||
    cleanEmail(body.staff_email);

  if (staffUserId) {
    const row = await loadStaffUserById(env, staffUserId);
    return row ? normalizeActor(row, { is_legacy_admin: false }) : null;
  }

  if (staffEmail) {
    const row = await loadStaffUserByEmail(env, staffEmail);
    return row ? normalizeActor(row, { is_legacy_admin: false }) : null;
  }

  return null;
}

/* ---------------- booking scope checks ---------------- */

async function canActorWorkBooking({ env, actor, bookingId }) {
  if (!bookingId) {
    return {
      ok: false,
      response: json({ error: "Missing booking scope target." }, 400)
    };
  }

  if (!isUuid(bookingId)) {
    return {
      ok: false,
      response: json({ error: "Invalid booking id." }, 400)
    };
  }

  if (actor.is_admin || actor.can_manage_bookings) {
    return { ok: true };
  }

  const booking = await loadBookingScopeRow(env, bookingId);
  if (!booking) {
    return {
      ok: false,
      response: json({ error: "Booking not found." }, 404)
    };
  }

  const matchesById =
    actor.id &&
    booking.assigned_staff_user_id &&
    String(actor.id).trim() === String(booking.assigned_staff_user_id).trim();

  const matchesByEmail =
    actor.email &&
    booking.assigned_staff_email &&
    String(actor.email).trim().toLowerCase() ===
      String(booking.assigned_staff_email).trim().toLowerCase();

  const actorName = String(actor.full_name || "").trim().toLowerCase();
  const matchesByName =
    actorName &&
    (
      String(booking.assigned_staff_name || "").trim().toLowerCase() === actorName ||
      String(booking.assigned_to || "").trim().toLowerCase() === actorName
    );

  if (matchesById || matchesByEmail || matchesByName) {
    return { ok: true };
  }

  return {
    ok: false,
    response: json({ error: "This booking is outside your work scope." }, 403)
  };
}

/* ---------------- capability model ---------------- */

function hasCapability(actor, capability) {
  if (!actor) return false;
  if (actor.is_admin || actor.is_legacy_admin) return true;

  switch (String(capability || "")) {
    case "manage_bookings":
      return actor.can_manage_bookings === true;

    case "manage_blocks":
      return actor.can_manage_blocks === true;

    case "manage_progress":
      return actor.can_manage_progress === true;

    case "manage_promos":
      return actor.can_manage_promos === true;

    case "manage_staff":
      return actor.can_manage_staff === true;

    case "view_live_ops":
      return (
        actor.can_manage_bookings === true ||
        actor.can_manage_progress === true ||
        actor.is_senior_detailer === true ||
        actor.is_detailer === true
      );

    case "work_booking":
      return (
        actor.is_senior_detailer === true ||
        actor.is_detailer === true ||
        actor.can_manage_bookings === true ||
        actor.can_manage_progress === true
      );

    case "override_lower_entries":
      return actor.can_override_lower_entries === true;

    default:
      return false;
  }
}

/* ---------------- staff loading ---------------- */

async function loadStaffUserById(env, staffUserId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_users` +
      `?select=id,created_at,updated_at,full_name,email,role_code,is_active,` +
      `can_override_lower_entries,can_manage_bookings,can_manage_blocks,can_manage_progress,can_manage_promos,can_manage_staff,notes` +
      `&id=eq.${encodeURIComponent(staffUserId)}` +
      `&limit=1`,
    {
      headers: serviceHeaders(env)
    }
  );

  if (!res.ok) return null;

  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadStaffUserByEmail(env, email) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/staff_users` +
      `?select=id,created_at,updated_at,full_name,email,role_code,is_active,` +
      `can_override_lower_entries,can_manage_bookings,can_manage_blocks,can_manage_progress,can_manage_promos,can_manage_staff,notes` +
      `&email=eq.${encodeURIComponent(email)}` +
      `&limit=1`,
    {
      headers: serviceHeaders(env)
    }
  );

  if (!res.ok) return null;

  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadBookingScopeRow(env, bookingId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/bookings` +
      `?select=id,assigned_to,assigned_staff_user_id,assigned_staff_email,assigned_staff_name` +
      `&id=eq.${encodeURIComponent(bookingId)}` +
      `&limit=1`,
    {
      headers: serviceHeaders(env)
    }
  );

  if (!res.ok) return null;

  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

/* ---------------- override log helper ---------------- */

export async function insertOverrideLog({
  env,
  booking_id = null,
  source_table,
  source_row_id = null,
  overridden_by_staff_user_id = null,
  previous_staff_user_id = null,
  override_reason = null,
  change_summary = null
}) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    if (!source_table) return null;

    const payload = {
      booking_id: booking_id || null,
      source_table,
      source_row_id: source_row_id || null,
      overridden_by_staff_user_id: overridden_by_staff_user_id || null,
      previous_staff_user_id: previous_staff_user_id || null,
      override_reason: cleanText(override_reason),
      change_summary: cleanText(change_summary)
    };

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/staff_override_log`, {
      method: "POST",
      headers: {
        ...serviceHeaders(env),
        Prefer: "return=minimal"
      },
      body: JSON.stringify([payload])
    });

    if (!res.ok) {
      return null;
    }

    return true;
  } catch {
    return null;
  }
}

/* ---------------- actor shaping ---------------- */

function normalizeActor(row, { is_legacy_admin = false } = {}) {
  const roleCode = String(row.role_code || "").trim().toLowerCase();

  return {
    id: row.id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    full_name: row.full_name || null,
    email: row.email || null,
    role_code: roleCode || null,
    is_active: row.is_active === true,

    can_override_lower_entries: row.can_override_lower_entries === true,
    can_manage_bookings: row.can_manage_bookings === true,
    can_manage_blocks: row.can_manage_blocks === true,
    can_manage_progress: row.can_manage_progress === true,
    can_manage_promos: row.can_manage_promos === true,
    can_manage_staff: row.can_manage_staff === true,

    notes: row.notes || null,

    is_admin: roleCode === "admin",
    is_senior_detailer: roleCode === "senior_detailer",
    is_detailer: roleCode === "detailer",
    is_legacy_admin: is_legacy_admin === true
  };
}

function makeLegacyAdminActor() {
  return {
    id: null,
    created_at: null,
    updated_at: null,
    full_name: "Legacy Admin",
    email: null,
    role_code: "admin",
    is_active: true,

    can_override_lower_entries: true,
    can_manage_bookings: true,
    can_manage_blocks: true,
    can_manage_progress: true,
    can_manage_promos: true,
    can_manage_staff: true,

    notes: null,

    is_admin: true,
    is_senior_detailer: false,
    is_detailer: false,
    is_legacy_admin: true
  };
}

/* ---------------- bridge helpers ---------------- */

function checkAdminPassword(request, env) {
  const provided = request.headers.get("x-admin-password") || "";
  return !!env.ADMIN_PASSWORD && provided === env.ADMIN_PASSWORD;
}

/* ---------------- shared exports used by many endpoints ---------------- */

export function serviceHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed." }, 405);
}

export function cleanText(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

export function cleanEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function cleanStringArray(value, { dedupe = true, allowEmpty = false } = {}) {
  const input = Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];

  const cleaned = input
    .map((item) => cleanText(item))
    .filter((item) => (allowEmpty ? item !== null : !!item));

  if (!dedupe) return cleaned;

  const seen = new Set();
  const out = [];

  for (const item of cleaned) {
    const key = String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const s = String(value || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export function toNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

/* ---------------- internal guards ---------------- */

function assertBaseEnv(env) {
  if (!env || !env.SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL.");
  }

  if (!env || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
}
