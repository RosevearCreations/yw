-- Current pass note: customer engagement workflow depth now includes purchaser-versus-recipient gift-card support, broader engagement queues, and storefront featured-testimonial placement.
-- Current pass note: stock-unit versus usage-unit inventory handling was expanded for clearer craft-material costing and planning.
-- File: /database_profiles_extension.sql
-- Brief description: Adds full customer/employee profile storage for contact details,
-- verification flags, preferences, and future discount/employee management support.

-- Current pass note: phone product capture now resolves the shared D1 binding through DB or DD_DB and returns structured JSON failures instead of HTML parser breaks.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  profile_type TEXT NOT NULL DEFAULT 'customer',
  preferred_name TEXT,
  company_name TEXT,
  phone TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  preferred_contact_method TEXT NOT NULL DEFAULT 'email',
  contact_notes TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  order_updates_opt_in INTEGER NOT NULL DEFAULT 1,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  employee_code TEXT,
  department TEXT,
  job_title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_type
ON user_profiles(profile_type);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone
ON user_profiles(phone);


CREATE TABLE IF NOT EXISTS auth_recovery_requests (
  auth_recovery_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_type TEXT NOT NULL CHECK (request_type IN ('forgot_password','forgot_email')),
  contact_email TEXT NOT NULL,
  possible_email TEXT,
  display_name TEXT,
  note TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_recovery_requests_status_created_at ON auth_recovery_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_action_audit (
  admin_action_audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  target_key TEXT,
  request_method TEXT,
  request_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_action_audit_created_at ON admin_action_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_audit_actor ON admin_action_audit(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_audit_target ON admin_action_audit(target_type, target_id, created_at DESC);



CREATE TABLE IF NOT EXISTS notification_outbox (
  notification_outbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_kind TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  destination TEXT,
  related_order_id INTEGER,
  related_payment_id INTEGER,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','retry','sent','failed','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,
  provider_message_id TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_order_payment ON notification_outbox(related_order_id, related_payment_id);


-- Current pass note: the initial D1 catalog migration completed successfully for Tools, Supplies, Movies, and Featured Creations.
-- The main Catalog admin page no longer exposes the day-to-day migration panel, while `/api/admin/catalog-sync` remains available for maintenance or reseed recovery only.

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

-- Current Pass Note — 2026-04-16
-- Admin dropdown master-data is now wired through app_settings and tax_classes in application code.
-- Site inventory usage-unit support was added in application/runtime migration logic for cups, wicks, grams, spools, and end-of-lot costing.

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

-- Pass 30 schema note: storefront gift-card purchases may use gift_cards.order_id, purchase_source, and pending_activation status; publish scoring now expects image-count-aware readiness.
