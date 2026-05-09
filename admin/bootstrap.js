// functions/api/admin/bootstrap.js
// One-time DB bootstrap endpoint (idempotent).
// After it succeeds, we can keep it (locked down) or delete it.

export async function onRequestGet({ request, env }) {
  // --- Auth (token via Bearer header OR ?token=) ---
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token") || "";

  const auth = request.headers.get("authorization") || "";
  const tokenFromBearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  const providedToken = tokenFromBearer || tokenFromQuery;
  const expectedToken = env.ADMIN_TOKEN;

  if (!expectedToken) {
    return json({ ok: false, error: "Missing ADMIN_TOKEN in Pages environment variables." }, 500);
  }
  if (!providedToken || providedToken !== expectedToken) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  if (!env.DD_DB) {
    return json({ ok: false, error: "Missing D1 binding DD_DB. Check Pages > Settings > Functions > D1 bindings." }, 500);
  }

  // --- Schema (SQLite / D1) ---
  // We execute statements one-by-one for reliability.
  // D1 supports running SQL through the D1 binding (exec/prepare/etc.). :contentReference[oaicite:2]{index=2}
  const statements = [
    "PRAGMA foreign_keys = ON;",

    // Members + sessions (for login + members-only area)
    `
    CREATE TABLE IF NOT EXISTS members (
      member_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      display_name    TEXT,
      role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
      is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at   TEXT
    ) STRICT;
    `,

    `
    CREATE TABLE IF NOT EXISTS sessions (
      session_id    TEXT PRIMARY KEY,               -- uuid
      member_id     INTEGER NOT NULL,
      token_hash    TEXT NOT NULL UNIQUE,            -- store hash, not raw token
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
    ) STRICT;
    `,

    "CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON sessions(member_id);",

    // Newsletter (we can later wire this to an email service, but keep signups in D1)
    `
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      email            TEXT PRIMARY KEY,
      status           TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','unsubscribed')),
      verify_token     TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at      TEXT,
      unsubscribed_at  TEXT
    ) STRICT;
    `,

    // Blog posts (public) + project updates (optionally members-only)
    `
    CREATE TABLE IF NOT EXISTS blog_posts (
      post_id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug            TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      summary         TEXT,
      content_md      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','published','archived')),
      cover_image_url TEXT,
      author_member_id INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT,
      published_at    TEXT,
      FOREIGN KEY (author_member_id) REFERENCES members(member_id) ON DELETE SET NULL
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);",
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);",

    `
    CREATE TABLE IF NOT EXISTS project_updates (
      update_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      content_md      TEXT NOT NULL,
      tags            TEXT,                          -- comma separated or JSON later
      member_only     INTEGER NOT NULL DEFAULT 0 CHECK (member_only IN (0,1)),
      author_member_id INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_member_id) REFERENCES members(member_id) ON DELETE SET NULL
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_project_updates_created_at ON project_updates(created_at);",

    // Comments (for blog posts, project updates, creations, etc.)
    `
    CREATE TABLE IF NOT EXISTS comments (
      comment_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_type   TEXT NOT NULL,        -- 'blog_post' | 'project_update' | 'creation' | etc.
      parent_id     INTEGER NOT NULL,
      member_id     INTEGER,              -- nullable for guest comments (optional)
      display_name  TEXT,
      email         TEXT,
      body          TEXT NOT NULL,
      is_hidden     INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0,1)),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE SET NULL
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_type, parent_id);",
    "CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);",

    // Creations (your R2 /creations images will be linked here later)
    `
    CREATE TABLE IF NOT EXISTS creations (
      creation_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT UNIQUE, -- your filename/product code
      title           TEXT NOT NULL,
      description_md  TEXT,
      status          TEXT NOT NULL DEFAULT 'showcase'
                       CHECK (status IN ('showcase','wip','for_sale','sold','archived')),
      member_only     INTEGER NOT NULL DEFAULT 0 CHECK (member_only IN (0,1)),
      hero_image_url  TEXT,
      gallery_json    TEXT,        -- JSON array of image URLs
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_creations_status ON creations(status);",

    // Inventory + usage (link supplies/tools to creations)
    `
    CREATE TABLE IF NOT EXISTS inventory_items (
      item_id        INTEGER PRIMARY KEY AUTOINCREMENT,
      code           TEXT UNIQUE,          -- SKU or internal code
      name           TEXT NOT NULL,
      category       TEXT,                -- e.g., 'supplies', 'tools', 'consumable'
      unit           TEXT,                -- e.g., 'g', 'ml', 'each'
      on_hand        REAL NOT NULL DEFAULT 0,
      reorder_level  REAL,
      image_url      TEXT,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);",

    `
    CREATE TABLE IF NOT EXISTS inventory_usage (
      usage_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      creation_id  INTEGER NOT NULL,
      item_id      INTEGER NOT NULL,
      qty          REAL NOT NULL,
      unit_cost    REAL,
      used_at      TEXT NOT NULL DEFAULT (datetime('now')),
      notes        TEXT,
      FOREIGN KEY (creation_id) REFERENCES creations(creation_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE RESTRICT
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_inventory_usage_creation ON inventory_usage(creation_id);",

    // Store products (we won’t turn this on until you’re ready, but schema is here)
    `
    CREATE TABLE IF NOT EXISTS store_products (
      product_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT UNIQUE, -- product code / filename
      title           TEXT NOT NULL,
      description_md  TEXT NOT NULL DEFAULT '',
      price_cents     INTEGER NOT NULL DEFAULT 0,
      currency        TEXT NOT NULL DEFAULT 'CAD',
      status          TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','active','paused','archived')),
      hero_image_url  TEXT,
      gallery_json    TEXT,
      stock_qty       INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT
    ) STRICT;
    `,
    "CREATE INDEX IF NOT EXISTS idx_store_products_status ON store_products(status);",

    // Simple site links (socials, support links, etc.) editable later via admin UI
    `
    CREATE TABLE IF NOT EXISTS site_links (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    ) STRICT;
    `
  ];

  for (const sql of statements) {
    const cleaned = sql.trim();
    if (!cleaned) continue;

    try {
      await env.DD_DB.exec(cleaned);
    } catch (err) {
      return json(
        {
          ok: false,
          error: String(err),
          failed_sql: cleaned.slice(0, 500)
        },
        500
      );
    }
  }

  return json({ ok: true, message: "DB bootstrap complete.", statements_ran: statements.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
