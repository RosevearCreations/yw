-- Current pass note: customer engagement workflow depth now includes purchaser-versus-recipient gift-card support, broader engagement queues, and storefront featured-testimonial placement.
-- Current pass note: stock-unit versus usage-unit inventory handling was expanded for clearer craft-material costing and planning.
-- MIGRATION: members/member_sessions -> users/sessions
-- This preserves existing member IDs so related tables like user_profiles keep working.

PRAGMA foreign_keys = OFF;

-- 1) Rename old auth tables out of the way
ALTER TABLE members RENAME TO members_legacy;
ALTER TABLE member_sessions RENAME TO member_sessions_legacy;

-- 2) Create the new users table expected by the newer app
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

-- 3) Create the new sessions table expected by the newer app
CREATE TABLE sessions (
  session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_token ON sessions(session_token);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- 4) Copy members into users, preserving IDs
INSERT INTO users (
  user_id,
  email,
  password_hash,
  display_name,
  role,
  is_active,
  created_at,
  updated_at,
  last_login_at
)
SELECT
  member_id,
  email,
  password_hash,
  display_name,
  role,
  is_active,
  created_at,
  COALESCE(last_login_at, created_at, CURRENT_TIMESTAMP),
  last_login_at
FROM members_legacy;

-- 5) Copy member sessions into new sessions table
-- We preserve the old text session_id as both session_token and token
INSERT INTO sessions (
  user_id,
  session_token,
  token,
  created_at,
  expires_at,
  ip_address,
  user_agent
)
SELECT
  member_id,
  session_id,
  session_id,
  created_at,
  expires_at,
  ip_hash,
  user_agent
FROM member_sessions_legacy;

-- 6) Optional sanity checks
-- SELECT COUNT(*) AS old_members FROM members_legacy;
-- SELECT COUNT(*) AS new_users FROM users;
-- SELECT COUNT(*) AS old_sessions FROM member_sessions_legacy;
-- SELECT COUNT(*) AS new_sessions FROM sessions;

PRAGMA foreign_keys = ON;

-- 2026-04-13 pass note:
-- No brand-new required tables were introduced in this pass.
-- Current pass focused on DD-series label display, standalone brand-asset uploads,
-- and public social-link restoration through shared UI/footer behavior.

-- Current pass note
-- Added bulk site-inventory unit-cost update workflow in application code.
-- No schema expansion was required in this pass; existing site_item_inventory and site_inventory_movements tables were reused.

-- Pass 20 note — mobile capture compatibility repair
-- The live production database may still be missing one or more newer mobile-capture columns
-- on `products` (for example `capture_reference`) even though the current schema files include them.
-- Application code now checks the live table shape before writing optional mobile-capture fields so
-- `/api/admin/mobile-create-product` and `/api/admin/mobile-product-drafts` keep working during a
-- partial migration window. The preferred long-term fix is still to complete the products-table upgrade.

-- Current Pass Note — 2026-04-14
-- Approval-required storefront fields are now surfaced in the mobile capture UI and approval is blocked until readiness checks pass.


-- Current Pass Note — 2026-04-15
-- Added app_settings-backed dropdown master-data keys for product categories, colours, and shipping codes.
-- Product resource links now support per-unit, end-of-lot, and story-only inventory usage modes.
-- End-of-lot mode is intended for supplies such as wax/resin/clay where one lot may cover many finished products before inventory should be reduced.

-- Current Pass Update — 2026-04-17
-- This pass assumes/uses the following current-direction features in code:
-- 1) member wishlist and product interest request review workflows
-- 2) checkout recovery leads and recovery email notification outbox support
-- 3) gift card validation / redemption support
-- 4) product review / testimonial submission and approved review display
-- 5) pricing suggestion load/apply actions in admin
-- 6) continued schema-compatibility hardening for older D1 tables
-- Pass 29 - footer socials, engagement depth, and editor price write-back
-- Notes: live code now expects footer social fallback behavior, deeper engagement admin actions, and editor-side price preset write-back.
