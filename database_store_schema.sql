-- Current pass note: customer engagement workflow depth now includes purchaser-versus-recipient gift-card support, broader engagement queues, and storefront featured-testimonial placement.
-- Current pass note: stock-unit versus usage-unit inventory handling was expanded for clearer craft-material costing and planning.
-- Current pass note: DD finished-product numbering now has a configurable start value in app_settings, defaulting to 1000 when older databases have not seeded the setting yet.
-- Current pass note: broad product repricing is now handled in code through the existing products table and admin bulk tooling; no new required schema tables were needed for this pass.
-- Current pass note: admin write-path resilience now extends beyond read-only fallback. Order status updates, manual payment recording, and refund/dispute actions log server-side incidents more defensively, while the order-detail UI can preserve failed admin writes locally for manual retry. Composite payment/refund/dispute indexes were added where those tables exist so health and follow-up queries stay responsive.
-- =========================================================
-- DEVIL N DOVE
-- STORE / COMMERCE EXTENSION SCHEMA
-- Works alongside the main users / sessions schema
-- =========================================================

-- Current pass note: phone product capture now resolves the shared D1 binding through DB or DD_DB and returns structured JSON failures instead of HTML parser breaks.
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- TAX CLASSES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_classes (
  tax_class_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tax_rate REAL NOT NULL DEFAULT 0.13,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  product_number INTEGER UNIQUE,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  capture_reference TEXT,
  product_category TEXT,
  color_name TEXT,
  shipping_code TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','approved','needs_changes','published')),
  is_ready_for_storefront INTEGER NOT NULL DEFAULT 0,
  ready_check_notes TEXT,
  short_description TEXT,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('physical','digital')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  compare_at_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'CAD',
  taxable INTEGER NOT NULL DEFAULT 1,
  tax_class_id INTEGER,
  tax_class_code TEXT,
  requires_shipping INTEGER NOT NULL DEFAULT 0,
  weight_grams INTEGER,
  inventory_tracking INTEGER NOT NULL DEFAULT 0,
  inventory_quantity INTEGER NOT NULL DEFAULT 0,
  digital_file_url TEXT,
  featured_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tax_class_id) REFERENCES tax_classes(tax_class_id)
);

-- ---------------------------------------------------------
-- PRODUCT IMAGES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  product_image_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- PRODUCT TAGS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_tags (
  product_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- ORDERS
-- order_status:
--   draft | pending | paid | fulfilled | cancelled | refunded
-- payment_status:
--   pending | authorized | paid | failed | cancelled | refunded | partially_refunded
-- fulfillment_type:
--   shipping | digital | mixed
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  order_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('draft','pending','paid','fulfilled','cancelled','refunded')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','authorized','paid','failed','cancelled','refunded','partially_refunded')),
  payment_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('paypal','stripe','square','manual','other','pending')),
  fulfillment_type TEXT NOT NULL DEFAULT 'shipping'
    CHECK (fulfillment_type IN ('shipping','digital','mixed')),
  currency TEXT NOT NULL DEFAULT 'CAD',

  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,

  shipping_name TEXT,
  shipping_company TEXT,
  shipping_address1 TEXT,
  shipping_address2 TEXT,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,

  billing_name TEXT,
  billing_company TEXT,
  billing_address1 TEXT,
  billing_address2 TEXT,
  billing_city TEXT,
  billing_province TEXT,
  billing_postal_code TEXT,
  billing_country TEXT,

  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ---------------------------------------------------------
-- ORDER ITEMS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  sku TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('physical','digital')),
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  taxable INTEGER NOT NULL DEFAULT 1,
  tax_class_code TEXT,
  requires_shipping INTEGER NOT NULL DEFAULT 0,
  digital_file_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- ORDER STATUS HISTORY
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  order_status_history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_number ON products(product_number);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

INSERT OR IGNORE INTO tax_classes (code, name, description, tax_rate, is_active)
VALUES
  ('standard', 'Standard Taxable Item', 'Default taxable item for Ontario sales', 0.13, 1),
  ('digital', 'Digital Product', 'Digital item tax profile', 0.13, 1),
  ('exempt', 'Tax Exempt', 'Non-taxable item', 0.00, 1);


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


CREATE TABLE IF NOT EXISTS runtime_incidents (
  runtime_incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_scope TEXT,
  incident_code TEXT,
  severity TEXT DEFAULT 'warning',
  endpoint_path TEXT,
  request_method TEXT,
  message TEXT,
  details_json TEXT,
  related_user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_runtime_incidents_created_at ON runtime_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_incidents_scope ON runtime_incidents(incident_scope, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_incidents_code_path ON runtime_incidents(incident_code, endpoint_path, created_at DESC);



-- ---------------------------------------------------------
-- UNIFIED CATALOG MIGRATION
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_items (
  catalog_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('tool','supply','creation','other')),
  source_key TEXT NOT NULL,
  slug TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  subcategory TEXT,
  item_type TEXT,
  short_description TEXT,
  notes TEXT,
  image_url TEXT,
  r2_object_key TEXT,
  amazon_url TEXT,
  storage_location TEXT,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  visible_public INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','draft')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_record_json TEXT,
  source_json_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_kind, source_key)
);
CREATE INDEX IF NOT EXISTS idx_catalog_items_kind ON catalog_items(item_kind);
CREATE INDEX IF NOT EXISTS idx_catalog_items_slug ON catalog_items(slug);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status_public ON catalog_items(status, visible_public);
CREATE INDEX IF NOT EXISTS idx_catalog_items_public_sort ON catalog_items(item_kind, status, visible_public, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_catalog_items_grouping ON catalog_items(item_kind, category, subcategory, item_type);

CREATE TABLE IF NOT EXISTS app_settings (
  app_setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, is_public)
VALUES ('site.catalog.product_number_start', '1000', 0);


CREATE TABLE IF NOT EXISTS movie_catalog (
  movie_catalog_id INTEGER PRIMARY KEY AUTOINCREMENT,
  upc TEXT NOT NULL UNIQUE,
  slug TEXT,
  title TEXT,
  original_title TEXT,
  sort_title TEXT,
  summary TEXT,
  release_year INTEGER,
  media_format TEXT,
  genre TEXT,
  director_names TEXT,
  actor_names TEXT,
  front_image_url TEXT,
  back_image_url TEXT,
  runtime_minutes INTEGER,
  studio_name TEXT,
  trailer_url TEXT,
  imdb_id TEXT,
  alternate_identifier TEXT,
  metadata_status TEXT NOT NULL DEFAULT 'pending',
  metadata_source TEXT,
  estimated_value_low_cents INTEGER,
  estimated_value_high_cents INTEGER,
  estimated_value_currency TEXT,
  rarity_notes TEXT,
  collection_notes TEXT,
  value_search_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  featured_rank INTEGER,
  source_record_json TEXT,
  source_json_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_title ON movie_catalog(sort_title, title);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_year ON movie_catalog(release_year);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_status ON movie_catalog(status);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_imdb_id ON movie_catalog(imdb_id);



-- Current pass note: the public movies page uses front_image_url/back_image_url from data/movies/movie_catalog_enriched.v2.json and can derive a trailer search URL at runtime when trailer_url is blank.


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


CREATE TABLE IF NOT EXISTS product_resource_links (
  product_resource_link_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('tool','supply')),
  source_key TEXT NOT NULL,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  usage_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumption_mode TEXT NOT NULL DEFAULT 'per_unit' CHECK (consumption_mode IN ('per_unit','end_of_lot','story_only')),
  lot_size_units INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  UNIQUE(product_id, resource_kind, source_key)
);
CREATE INDEX IF NOT EXISTS idx_product_resource_links_product ON product_resource_links(product_id, sort_order);

CREATE TABLE IF NOT EXISTS product_review_actions (
  product_review_action_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('approve','request_changes','publish','unpublish')),
  previous_review_status TEXT,
  new_review_status TEXT,
  previous_status TEXT,
  new_status TEXT,
  actor_user_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_review_actions_product ON product_review_actions(product_id, created_at DESC);



-- Pass 16: departmental accounting + membership policy foundation
CREATE TABLE IF NOT EXISTS membership_tier_policies (
  membership_tier_policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_title TEXT,
  short_description TEXT,
  benefits_json TEXT,
  badge_color TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS general_ledger_accounts (
  gl_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'expense',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_expenses (
  expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT,
  vendor_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  ledger_code TEXT,
  ledger_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounting_writeoffs (
  writeoff_id INTEGER PRIMARY KEY AUTOINCREMENT,
  writeoff_date TEXT,
  item_name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  reason_code TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_costs (
  product_cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_number TEXT NOT NULL,
  cost_per_unit REAL NOT NULL DEFAULT 0,
  effective_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS accounting_overhead_allocations (
  allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL,
  ledger_code TEXT NOT NULL DEFAULT '',
  ledger_name TEXT NOT NULL DEFAULT '',
  allocation_basis TEXT NOT NULL DEFAULT 'manual',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_month, ledger_code)
);

-- Current pass: indexes to support phone dashboard, accounting overview, and item-costing reads.

CREATE INDEX IF NOT EXISTS idx_accounting_expenses_date ON accounting_expenses(expense_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_writeoffs_date ON accounting_writeoffs(writeoff_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_costs_product_number_effective ON product_costs(product_number, effective_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_overhead_allocations_month ON accounting_overhead_allocations(period_month, ledger_code);
-- Current pass note: runtime_incidents remains the server-side fallback/error log table, and `/api/admin/runtime-incidents` now reads from it for admin review while client pages keep last-good snapshot fallbacks in the browser. This pass also adds order/payment-focused partial fallbacks plus a code/path index so admin incident review can stay fast as more endpoint warnings are recorded.



CREATE TABLE IF NOT EXISTS accounting_overhead_product_allocations (
  overhead_product_allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL,
  ledger_code TEXT NOT NULL DEFAULT '',
  product_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_month, ledger_code, product_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_overhead_product_allocations_month ON accounting_overhead_product_allocations(period_month, ledger_code, product_id);
CREATE INDEX IF NOT EXISTS idx_accounting_overhead_product_allocations_product ON accounting_overhead_product_allocations(product_id, period_month DESC);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  accounting_journal_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL,
  entry_date TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_reference TEXT,
  memo TEXT,
  is_balanced INTEGER NOT NULL DEFAULT 1,
  total_debit_cents INTEGER NOT NULL DEFAULT 0,
  total_credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_month, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_period ON accounting_journal_entries(period_month, entry_date DESC, accounting_journal_entry_id DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_id, period_month);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  accounting_journal_line_id INTEGER PRIMARY KEY AUTOINCREMENT,
  accounting_journal_entry_id INTEGER NOT NULL,
  line_order INTEGER NOT NULL DEFAULT 0,
  ledger_code TEXT NOT NULL,
  ledger_name TEXT NOT NULL,
  entry_side TEXT NOT NULL CHECK(entry_side IN ('debit','credit')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accounting_journal_entry_id) REFERENCES accounting_journal_entries(accounting_journal_entry_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(accounting_journal_entry_id, line_order ASC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_ledger ON accounting_journal_lines(ledger_code, entry_side, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_pending_actions (
  admin_pending_action_id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_action_id TEXT,
  action_scope TEXT,
  order_id INTEGER,
  action_label TEXT,
  endpoint_path TEXT,
  http_method TEXT,
  payload_json TEXT,
  queue_status TEXT DEFAULT 'queued',
  last_error TEXT,
  warning TEXT,
  attempt_count INTEGER DEFAULT 0,
  created_by_user_id INTEGER,
  resolved_by_user_id INTEGER,
  source_device_label TEXT,
  last_attempt_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_pending_actions_client_action_id ON admin_pending_actions(client_action_id);
CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_status_created ON admin_pending_actions(queue_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_order_status ON admin_pending_actions(order_id, queue_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_pending_actions_scope_status ON admin_pending_actions(action_scope, queue_status, created_at DESC);

-- Current pass note: admin_pending_actions now provides a shared cross-device replay queue for failed admin writes, including order/payment actions and product review actions, while browser-local fallback remains the last safety net when even the queue cannot be reached.

-- Current pass note: catalog migration sync now accepts both collections and legacy item_kinds payloads.
-- Tools, supplies, and featured creations continue to upsert into catalog_items.
-- Movies now sync into movie_catalog so hybrid JSON + D1 movie authority can advance without violating the catalog_items item_kind constraint.
-- Current Pass Note — 2026-04-12
-- Movie catalog sync now uses chunked D1 batch upserts to stay below Worker invocation request ceilings.
-- Admin products now supports degraded query fallback during staged schema/data migrations.
-- No new tables were introduced in this pass; schema files were refreshed to reflect the current operational state.


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
