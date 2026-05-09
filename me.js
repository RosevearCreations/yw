function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return json({ ok: false, error: "Missing session token." }, 401);
  }

  const user = await env.DB.prepare(`
    SELECT
      users.user_id,
      users.email,
      users.display_name,
      users.role,
      users.is_active,
      users.created_at
    FROM sessions
    JOIN users ON sessions.user_id = users.user_id
    WHERE sessions.session_token = ?
      AND sessions.expires_at > datetime('now')
    LIMIT 1
  `)
    .bind(token)
    .first();

  if (!user) {
    return json({ ok: false, error: "Invalid session." }, 401);
  }

  if (!user.is_active) {
    return json({ ok: false, error: "Account is inactive." }, 403);
  }

  return json({
    ok: true,
    user: {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at
    }
  });
}
