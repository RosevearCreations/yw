// /functions/api/admin/migrate.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ---- Simple protection (do NOT skip this on a public site) ----
  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-admin-token") ||
    "";

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json(
      { ok: false, error: "Unauthorized. Missing/invalid token." },
      401
    );
  }

  if (!env.DD_DB) {
    return json(
      { ok: false, error: "Missing D1 binding. Expected env.DD_DB." },
      500
    );
  }

  // Keep schema statements conservative for D1 compatibility.
  // (No STRICT; use CURRENT_TIMESTAMP.)
  const statements = [
    `CREATE TABLE IF NOT EXISTS members (
      member_id      INTEGER PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      display_name   TEXT,
      role           TEXT NOT NULL DEFAULT 'member',
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at  TEXT
    );`,

    `CREATE TABLE IF NOT EXISTS member_sessions (
      session_id    TEXT PRIMARY KEY,
      member_id     INTEGER NOT NULL,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at    TEXT NOT NULL,
      ip_hash       TEXT,
      user_agent    TEXT,
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
    );`,

    `CREATE INDEX IF NOT EXISTS idx_member_sessions_member_id
     ON member_sessions(member_id);`,

    `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      subscriber_id  INTEGER PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      is_confirmed   INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at   TEXT,
      unsubscribed_at TEXT
    );`,

    `CREATE TABLE IF NOT EXISTS blog_posts (
      post_id       INTEGER PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'draft',
      author_member_id INTEGER,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at  TEXT,
      updated_at    TEXT,
      FOREIGN KEY (author_member_id) REFERENCES members(member_id)
    );`,

    `CREATE INDEX IF NOT EXISTS idx_blog_posts_status
     ON blog_posts(status);`,

    `CREATE TABLE IF NOT EXISTS blog_comments (
      comment_id    INTEGER PRIMARY KEY,
      post_id       INTEGER NOT NULL,
      member_id     INTEGER,
      guest_name    TEXT,
      guest_email   TEXT,
      body          TEXT NOT NULL,
      is_approved   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES blog_posts(post_id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE SET NULL
    );`,

    `CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id
     ON blog_comments(post_id);`,
  ];

  let applied = 0;

  try {
    for (const sql of statements) {
      await env.DD_DB.prepare(sql).run();
      applied += 1;
    }
    return json({ ok: true, applied });
  } catch (err) {
    // Try to return a helpful error (D1 often includes useful text in err.message)
    return json(
      {
        ok: false,
        error: String(err?.message || err),
        applied,
      },
      500
    );
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
