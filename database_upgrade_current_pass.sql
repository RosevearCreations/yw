-- Current pass note: accounting now adds statement-import tables, reconciliation exceptions, fixed-asset groundwork, attachment-required month-close checks, export bundle v2 groundwork, and public colour-filter/catalog-preference support.
-- Current pass note: products now support multi-colour storage through color_names_json while keeping color_name as the primary/filter colour.
-- Current pass note: this storefront/discovery pass adds dedicated public Collections and Marketplaces pages, stronger sale-channel/provenance guidance, and broader internal linking without requiring new database tables.
-- Current pass note: collectible / vintage / external-listing catalog support now lets Devil n Dove sell handmade work alongside pre-built finds, antiquities, oddities, and marketplace-linked items.
-- Current pass note: year-end close export now includes CSV output plus scope-aware attachment and reconciliation summaries for accountant handoff.
-- Current pass note: accounting review now adds starter GL finalize helpers, richer attachment metadata, deeper reconciliation review detail, and a more accountant-ready year-end close bundle.
-- Current pass note: accounting now adds explicit GIFI staging fields on general_ledger_accounts, a live DB sanity route, and schema alignment for accounting_journal_entries/accounting_journal_lines.
-- Current pass note: customer engagement workflow depth now includes purchaser-versus-recipient gift-card support, broader engagement queues, and storefront featured-testimonial placement.
-- Current pass note: phone-first finished-product entry now supports a lightweight wizard mode plus capture metadata for same-day draft review and safer bulk cleanup.
-- Current pass note: stock-unit versus usage-unit inventory handling was expanded for clearer craft-material costing and planning.
-- Current pass note: DD finished-product numbering now has a configurable start value in app_settings, defaulting to 1000 when older databases have not seeded the setting yet.
-- Current pass note: broad product repricing is now handled in code through the existing products table and admin bulk tooling; no new required schema tables were needed for this pass.
-- File: /database_upgrade_current_pass.sql
-- Brief description: Incremental upgrade SQL for older Devil n Dove D1/SQLite databases.
-- This pass focuses on movie overlay compatibility, phone-first product capture fields,
-- and governance tables that are already used by current admin flows.
--
-- SQLite / D1 does not support ADD COLUMN IF NOT EXISTS.
-- If a statement fails with a duplicate-column error, skip that one and continue.

-- Current pass note: phone product capture now resolves the shared D1 binding through DB or DD_DB and returns structured JSON failures instead of HTML parser breaks.
PRAGMA foreign_keys = ON;

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
VALUES ('site.catalog.product_number_start', '1000', 0),
       ('site.catalog.product_category_options', '[]', 0),
       ('site.catalog.color_options', '[]', 0),
       ('site.catalog.shipping_code_options', '[]', 0);


-- Movie overlay compatibility for JSON-first + D1-override workflow.
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
  status TEXT NOT NULL DEFAULT 'active',
  featured_rank INTEGER,
  source_record_json TEXT,
  source_json_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE movie_catalog ADD COLUMN original_title TEXT;
ALTER TABLE movie_catalog ADD COLUMN trailer_url TEXT;
ALTER TABLE movie_catalog ADD COLUMN imdb_id TEXT;
ALTER TABLE movie_catalog ADD COLUMN alternate_identifier TEXT;
ALTER TABLE movie_catalog ADD COLUMN metadata_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE movie_catalog ADD COLUMN metadata_source TEXT;
ALTER TABLE movie_catalog ADD COLUMN estimated_value_low_cents INTEGER;
ALTER TABLE movie_catalog ADD COLUMN estimated_value_high_cents INTEGER;
ALTER TABLE movie_catalog ADD COLUMN estimated_value_currency TEXT;
ALTER TABLE movie_catalog ADD COLUMN rarity_notes TEXT;
ALTER TABLE movie_catalog ADD COLUMN collection_notes TEXT;
ALTER TABLE movie_catalog ADD COLUMN value_search_url TEXT;

CREATE INDEX IF NOT EXISTS idx_movie_catalog_title ON movie_catalog(sort_title, title);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_year ON movie_catalog(release_year);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_status ON movie_catalog(status);
CREATE INDEX IF NOT EXISTS idx_movie_catalog_imdb_id ON movie_catalog(imdb_id);


-- UNIFIED CATALOG SUPPORT (for environments that have not created it yet).
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

-- Phone-first product capture and review governance.
ALTER TABLE products ADD COLUMN product_number INTEGER;
ALTER TABLE products ADD COLUMN capture_reference TEXT;
ALTER TABLE products ADD COLUMN product_category TEXT;
ALTER TABLE products ADD COLUMN color_name TEXT;
ALTER TABLE products ADD COLUMN color_names_json TEXT;
ALTER TABLE products ADD COLUMN shipping_code TEXT;
ALTER TABLE products ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending_review';
ALTER TABLE products ADD COLUMN is_ready_for_storefront INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN ready_check_notes TEXT;
ALTER TABLE products ADD COLUMN capture_entry_mode TEXT NOT NULL DEFAULT 'full';
ALTER TABLE products ADD COLUMN capture_created_by_user_id INTEGER;
ALTER TABLE products ADD COLUMN capture_updated_by_user_id INTEGER;
ALTER TABLE products ADD COLUMN capture_entry_started_at TEXT;
ALTER TABLE products ADD COLUMN capture_last_saved_at TEXT;
ALTER TABLE products ADD COLUMN merchandise_origin TEXT NOT NULL DEFAULT 'handmade';
ALTER TABLE products ADD COLUMN sale_channel TEXT NOT NULL DEFAULT 'onsite';
ALTER TABLE products ADD COLUMN external_listing_url TEXT;
ALTER TABLE products ADD COLUMN external_listing_label TEXT;
ALTER TABLE products ADD COLUMN condition_summary TEXT;
ALTER TABLE products ADD COLUMN era_label TEXT;
ALTER TABLE products ADD COLUMN sourcing_notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_number ON products(product_number);
CREATE INDEX IF NOT EXISTS idx_products_capture_last_saved_at ON products(capture_last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_capture_updated_by ON products(capture_updated_by_user_id, capture_last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_origin_channel ON products(merchandise_origin, sale_channel, status, review_status);

UPDATE products
SET review_status = CASE
  WHEN COALESCE(status, 'draft') = 'active' THEN 'published'
  ELSE 'pending_review'
END
WHERE review_status IS NULL OR review_status = '';

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
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_product_review_actions_product ON product_review_actions(product_id, created_at DESC);

-- Product storytelling links used by storefront/admin detail views.
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

-- Durable local notification queue used by admin/payment flows.
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

-- Recovery and audit hardening used by the admin/auth flows.
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
ALTER TABLE auth_recovery_requests ADD COLUMN ip_address TEXT;
ALTER TABLE auth_recovery_requests ADD COLUMN user_agent TEXT;
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


-- Supplier reorder draft records now used by the inventory workflow.
CREATE TABLE IF NOT EXISTS supplier_purchase_orders (
  supplier_purchase_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','ordered','received','cancelled')),
  notes TEXT,
  total_estimated_cents INTEGER NOT NULL DEFAULT 0,
  ordered_applied_at TEXT,
  received_completed_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_orders_status ON supplier_purchase_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_purchase_order_items (
  supplier_purchase_order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_purchase_order_id INTEGER NOT NULL,
  site_item_inventory_id INTEGER,
  item_name TEXT NOT NULL,
  source_type TEXT,
  external_key TEXT,
  quantity_ordered INTEGER NOT NULL DEFAULT 1,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  incoming_applied_at TEXT,
  received_at TEXT,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_purchase_order_id) REFERENCES supplier_purchase_orders(supplier_purchase_order_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_order_items_po ON supplier_purchase_order_items(supplier_purchase_order_id);


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
  parent_group TEXT,
  normal_balance TEXT NOT NULL DEFAULT 'debit',
  sort_order INTEGER NOT NULL DEFAULT 0,
  gifi_code TEXT,
  gifi_label TEXT,
  gifi_section TEXT,
  gifi_review_state TEXT NOT NULL DEFAULT 'draft',
  gifi_review_note TEXT,
  tax_deductibility_percent INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- GIFI review columns for older databases.
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_review_state TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_review_note TEXT;

CREATE TABLE IF NOT EXISTS accounting_gifi_review_notes (
  accounting_gifi_review_note_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_year INTEGER NOT NULL,
  gifi_code TEXT NOT NULL,
  gifi_label TEXT,
  gifi_section TEXT,
  accountant_note TEXT,
  schedule_141_note TEXT,
  supporting_details TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft',
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tax_year, gifi_code)
);
CREATE INDEX IF NOT EXISTS idx_accounting_gifi_review_notes_year ON accounting_gifi_review_notes(tax_year, gifi_code);

CREATE TABLE IF NOT EXISTS accounting_period_closures (
  accounting_period_closure_id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL UNIQUE,
  lock_state TEXT NOT NULL DEFAULT 'open',
  close_checklist_json TEXT,
  close_notes TEXT,
  locked_by_user_id INTEGER,
  locked_at TEXT,
  reopened_by_user_id INTEGER,
  reopened_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounting_period_closures_period ON accounting_period_closures(period_month, lock_state, updated_at DESC);

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


ALTER TABLE product_resource_links ADD COLUMN consumption_mode TEXT NOT NULL DEFAULT 'per_unit';
ALTER TABLE product_resource_links ADD COLUMN lot_size_units INTEGER NOT NULL DEFAULT 1;

-- Current pass note: dropdown master-data now uses app_settings, and resource links support per-product, end-of-lot, or story-only inventory usage.


-- Current Pass Note — 2026-04-15
-- Added app_settings-backed dropdown master-data keys for product categories, colours, and shipping codes.
-- Product resource links now support per-unit, end-of-lot, and story-only inventory usage modes.
-- End-of-lot mode is intended for supplies such as wax/resin/clay where one lot may cover many finished products before inventory should be reduced.

ALTER TABLE site_item_inventory ADD COLUMN usage_unit_label TEXT NOT NULL DEFAULT 'unit';
ALTER TABLE site_item_inventory ADD COLUMN usage_units_per_stock_unit REAL NOT NULL DEFAULT 1;

-- Current Pass Note — 2026-04-16
-- Wired the catalog option manager into admin pages and added usage-unit / end-of-lot costing support for site inventory and product resource links.

-- Current Pass Note — 2026-04-16
-- Inventory now distinguishes stock unit labels from usage-unit labels so batch materials are easier to understand in costing and planning.
ALTER TABLE site_item_inventory ADD COLUMN stock_unit_label TEXT NOT NULL DEFAULT 'unit';

-- Current Pass Update — 2026-04-17
-- This pass assumes/uses the following current-direction features in code:
-- 1) member wishlist and product interest request review workflows
-- 2) checkout recovery leads and recovery email notification outbox support
-- 3) gift card validation / redemption support
-- 4) product review / testimonial submission and approved review display
-- 5) pricing suggestion load/apply actions in admin
-- 6) continued schema-compatibility hardening for older D1 tables

-- Gift card purchaser versus recipient tracking for engagement workflows.
CREATE TABLE IF NOT EXISTS gift_cards (
  gift_card_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'CAD',
  initial_amount_cents INTEGER NOT NULL DEFAULT 0,
  remaining_amount_cents INTEGER NOT NULL DEFAULT 0,
  issued_to_email TEXT,
  issued_to_name TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  last_redeemed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE gift_cards ADD COLUMN purchaser_email TEXT;
ALTER TABLE gift_cards ADD COLUMN purchaser_name TEXT;
ALTER TABLE gift_cards ADD COLUMN recipient_email TEXT;
ALTER TABLE gift_cards ADD COLUMN recipient_name TEXT;
ALTER TABLE gift_cards ADD COLUMN recipient_note TEXT;
ALTER TABLE gift_cards ADD COLUMN purchaser_user_id INTEGER;
-- Pass 29 - footer socials, engagement depth, and editor price write-back
-- Notes: live code now expects footer social fallback behavior, deeper engagement admin actions, and editor-side price preset write-back.


-- Pass 30 upgrade notes
ALTER TABLE gift_cards ADD COLUMN order_id INTEGER;
ALTER TABLE gift_cards ADD COLUMN purchase_source TEXT;
-- Runtime code also keeps gift_cards purchaser/recipient fields in sync and uses pending_activation for storefront-issued cards.

-- Pass 30 schema note: storefront gift-card purchases may use gift_cards.order_id, purchase_source, and pending_activation status; publish scoring now expects image-count-aware readiness.

-- Pass 31 note: gift card webhook activation, publish override gating, notification cooldown/exclusion support, and image validation workflow updates.

-- Pass 32 update (2026-04-20)
-- Current pass expects/supports these schema capabilities where applicable:
-- 1) notification_exclusions, notification_cooldown_rules, customer_engagement_runs, notification_dispatch_log
-- 2) product_publish_overrides plus product publish_readiness_score / image_quality_score / ready_check_notes support
-- 3) media_assets and product_image_annotations dimension/orientation tracking for listing-quality checks
-- 4) gift_cards purchaser/recipient/order/purchase_source friendly fulfillment support
-- 5) inventory and pricing decision support to continue using landed-cost, markup, packaging, shipping, and increase-planning signals

-- Pass 33 update
-- Deepened gift card delivery history and resend controls with recipient/purchaser audit support.
-- Strengthened listing-photo readiness with crop history, first-image scoring, and richer media-quality checks.
-- Expanded public trust/testimonial placement and support CTA coverage.
-- Pushed pricing toward a fuller operating console with receiving/packaging/shipping assumptions and save-time warnings.



CREATE TABLE IF NOT EXISTS gift_card_delivery_audit (
  gift_card_delivery_audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  gift_card_id INTEGER,
  audience TEXT NOT NULL DEFAULT 'recipient',
  notification_kind TEXT NOT NULL,
  destination TEXT,
  notification_outbox_id INTEGER,
  notification_dispatch_log_id INTEGER,
  actor_user_id INTEGER,
  action_type TEXT NOT NULL DEFAULT 'queued',
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE product_image_annotations ADD COLUMN crop_x REAL;
ALTER TABLE product_image_annotations ADD COLUMN crop_y REAL;
ALTER TABLE product_image_annotations ADD COLUMN crop_width REAL;
ALTER TABLE product_image_annotations ADD COLUMN crop_height REAL;
ALTER TABLE product_image_annotations ADD COLUMN first_image_score INTEGER;

-- Current pass concrete schema note
-- Runtime code will safely create/use gift_card_delivery_audit when needed.
-- Runtime code will also safely add/expect these product_image_annotations fields when needed:
-- crop_x, crop_y, crop_width, crop_height, first_image_score, image_orientation, width_px, height_px
-- Keep database upgrade execution cautious on older live databases where some columns may already exist.



-- Pass 34 update
-- Media upload and product image annotations now track a fuller merchandising score model.
-- This supports cleaner lead-image guidance, upload-time analysis, asset-library selection hints,
-- and publish/readiness scoring based on more than image count alone.

ALTER TABLE media_assets ADD COLUMN width_px INTEGER;
ALTER TABLE media_assets ADD COLUMN height_px INTEGER;
ALTER TABLE media_assets ADD COLUMN image_orientation TEXT;
ALTER TABLE media_assets ADD COLUMN background_consistency_score INTEGER;
ALTER TABLE media_assets ADD COLUMN subject_fill_score INTEGER;
ALTER TABLE media_assets ADD COLUMN sharpness_score INTEGER;
ALTER TABLE media_assets ADD COLUMN brightness_score INTEGER;
ALTER TABLE media_assets ADD COLUMN contrast_score INTEGER;
ALTER TABLE media_assets ADD COLUMN angle_group TEXT;
ALTER TABLE media_assets ADD COLUMN shot_style TEXT;
ALTER TABLE media_assets ADD COLUMN merchandising_score INTEGER;

ALTER TABLE product_image_annotations ADD COLUMN background_consistency_score INTEGER;
ALTER TABLE product_image_annotations ADD COLUMN subject_fill_score INTEGER;
ALTER TABLE product_image_annotations ADD COLUMN sharpness_score INTEGER;
ALTER TABLE product_image_annotations ADD COLUMN brightness_score INTEGER;
ALTER TABLE product_image_annotations ADD COLUMN contrast_score INTEGER;
ALTER TABLE product_image_annotations ADD COLUMN angle_group TEXT;
ALTER TABLE product_image_annotations ADD COLUMN shot_style TEXT;
ALTER TABLE product_image_annotations ADD COLUMN merchandising_score INTEGER;

-- Current pass concrete schema note
-- Runtime code will safely add/use these media scoring fields when they are absent on older live databases.
-- Preferred live shape now includes:
-- media_assets.width_px, media_assets.height_px, media_assets.image_orientation,
-- media_assets.background_consistency_score, media_assets.subject_fill_score, media_assets.sharpness_score,
-- media_assets.brightness_score, media_assets.contrast_score, media_assets.angle_group,
-- media_assets.shot_style, media_assets.merchandising_score
-- plus matching product_image_annotations scoring fields for saved gallery rows.

ALTER TABLE product_image_annotations ADD COLUMN merchandising_override_reason TEXT;
ALTER TABLE product_image_annotations ADD COLUMN merchandising_override_note TEXT;

CREATE TABLE IF NOT EXISTS product_media_score_history (
  product_media_score_history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  image_count INTEGER NOT NULL DEFAULT 0,
  lead_image_score INTEGER,
  gallery_merchandising_score INTEGER,
  weak_image_count INTEGER NOT NULL DEFAULT 0,
  weak_unapproved_image_count INTEGER NOT NULL DEFAULT 0,
  overridden_image_count INTEGER NOT NULL DEFAULT 0,
  override_reasons_json TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_media_score_history_product_id_created_at ON product_media_score_history(product_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_category_sort ON general_ledger_accounts(category, sort_order, code);
CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_gifi ON general_ledger_accounts(gifi_section, gifi_code, code);


-- Current pass accounting schema alignment: general ledger GIFI staging fields.
ALTER TABLE general_ledger_accounts ADD COLUMN parent_group TEXT;
ALTER TABLE general_ledger_accounts ADD COLUMN normal_balance TEXT NOT NULL DEFAULT 'debit';
ALTER TABLE general_ledger_accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_code TEXT;
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_label TEXT;
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_section TEXT;
ALTER TABLE general_ledger_accounts ADD COLUMN tax_deductibility_percent INTEGER NOT NULL DEFAULT 100;
CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_category_sort ON general_ledger_accounts(category, sort_order, code);
CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_gifi ON general_ledger_accounts(gifi_section, gifi_code, code);

-- Journal table shape in runtime code uses journal_entry_id/journal_line_id and source_key/description/status/imbalance fields.
-- Older databases with the previous accounting_journal_* shape should be migrated with a table rebuild during a controlled maintenance window.

-- Current pass note: accounting now adds vendor defaults, recurring expense rules, reconciliation reviews, richer expense linkage, and a year-end close bundle foundation.

ALTER TABLE general_ledger_accounts ADD COLUMN gifi_reviewed_by_user_id INTEGER;
ALTER TABLE general_ledger_accounts ADD COLUMN gifi_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_review_state ON general_ledger_accounts(gifi_review_state, is_active, code);

CREATE TABLE IF NOT EXISTS accounting_vendors (
  accounting_vendor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_name TEXT NOT NULL UNIQUE,
  default_ledger_code TEXT,
  default_tax_percent REAL NOT NULL DEFAULT 0,
  payment_terms TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounting_vendors_active_name ON accounting_vendors(is_active, vendor_name);

ALTER TABLE accounting_expenses ADD COLUMN vendor_id INTEGER;
ALTER TABLE accounting_expenses ADD COLUMN recurring_expense_rule_id INTEGER;
ALTER TABLE accounting_expenses ADD COLUMN source_mode TEXT;
ALTER TABLE accounting_expenses ADD COLUMN reference_number TEXT;
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_vendor ON accounting_expenses(vendor_id, vendor_name, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_expenses_recurring ON accounting_expenses(recurring_expense_rule_id, expense_date DESC);

CREATE TABLE IF NOT EXISTS accounting_recurring_expense_rules (
  recurring_expense_rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER,
  vendor_name TEXT,
  rule_name TEXT NOT NULL,
  ledger_code TEXT,
  ledger_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  due_day INTEGER,
  next_due_date TEXT,
  auto_create_mode TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_generated_at TEXT,
  last_generated_expense_id INTEGER,
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounting_recurring_expense_rules_due ON accounting_recurring_expense_rules(is_active, next_due_date, frequency);

CREATE TABLE IF NOT EXISTS accounting_reconciliation_reviews (
  accounting_reconciliation_review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_type TEXT NOT NULL,
  period_month TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT 'all',
  review_status TEXT NOT NULL DEFAULT 'draft',
  note TEXT,
  reference_amount_cents INTEGER NOT NULL DEFAULT 0,
  compared_amount_cents INTEGER NOT NULL DEFAULT 0,
  difference_cents INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reconciliation_type, period_month, scope_key)
);
CREATE INDEX IF NOT EXISTS idx_accounting_reconciliation_reviews_type_period ON accounting_reconciliation_reviews(reconciliation_type, period_month DESC, review_status);


-- Current pass: accounting attachments and reconciliation detail metadata
CREATE TABLE IF NOT EXISTS accounting_attachments (
  accounting_attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_kind TEXT NOT NULL DEFAULT 'other',
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  bucket_name TEXT,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  expense_id INTEGER,
  vendor_id INTEGER,
  reconciliation_type TEXT,
  period_month TEXT,
  tax_year TEXT,
  statement_reference TEXT,
  statement_gross_cents INTEGER NOT NULL DEFAULT 0,
  statement_fee_cents INTEGER NOT NULL DEFAULT 0,
  statement_net_cents INTEGER NOT NULL DEFAULT 0,
  statement_tax_cents INTEGER NOT NULL DEFAULT 0,
  statement_shipping_cents INTEGER NOT NULL DEFAULT 0,
  statement_txn_count INTEGER NOT NULL DEFAULT 0,
  statement_period_start TEXT,
  statement_period_end TEXT,
  statement_detail_json TEXT,
  notes TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_accounting_attachments_expense ON accounting_attachments(expense_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_attachments_vendor ON accounting_attachments(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_attachments_period ON accounting_attachments(period_month, tax_year, reconciliation_type, attachment_kind);
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN statement_reference TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN difference_reason TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN detail_json TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0;


-- Accounting handoff pass: richer accounting attachment metadata and reconciliation review detail.
ALTER TABLE accounting_attachments ADD COLUMN attachment_status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE accounting_attachments ADD COLUMN document_date TEXT;
ALTER TABLE accounting_attachments ADD COLUMN scope_key TEXT;
CREATE INDEX IF NOT EXISTS idx_accounting_attachments_scope ON accounting_attachments(reconciliation_type, period_month, scope_key, attachment_kind);

ALTER TABLE accounting_reconciliation_reviews ADD COLUMN statement_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN book_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN tolerance_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN expected_rate_basis_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN observed_rate_basis_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN unresolved_item_count INTEGER NOT NULL DEFAULT 0;

-- Current pass additions for statement-backed accounting attachments
ALTER TABLE accounting_attachments ADD COLUMN attachment_scope TEXT NOT NULL DEFAULT 'other';
ALTER TABLE accounting_attachments ADD COLUMN provider_scope TEXT;
ALTER TABLE accounting_attachments ADD COLUMN statement_gross_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_net_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_tax_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_shipping_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_txn_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounting_attachments ADD COLUMN statement_period_start TEXT;
ALTER TABLE accounting_attachments ADD COLUMN statement_period_end TEXT;
ALTER TABLE accounting_attachments ADD COLUMN statement_detail_json TEXT;




-- Current pass update: statement imports, reconciliation exceptions, and fixed-asset groundwork
CREATE TABLE IF NOT EXISTS accounting_statement_imports (
  accounting_statement_import_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_scope TEXT NOT NULL DEFAULT 'other',
  import_status TEXT NOT NULL DEFAULT 'imported',
  source_filename TEXT,
  source_format TEXT NOT NULL DEFAULT 'csv',
  period_month TEXT,
  period_start TEXT,
  period_end TEXT,
  currency TEXT NOT NULL DEFAULT 'CAD',
  row_count INTEGER NOT NULL DEFAULT 0,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  net_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  withdrawal_cents INTEGER NOT NULL DEFAULT 0,
  txn_count INTEGER NOT NULL DEFAULT 0,
  statement_reference TEXT,
  detail_json TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_accounting_statement_imports_period ON accounting_statement_imports(provider_scope, period_month DESC, import_status);

CREATE TABLE IF NOT EXISTS accounting_statement_import_rows (
  accounting_statement_import_row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  accounting_statement_import_id INTEGER NOT NULL,
  provider_scope TEXT NOT NULL DEFAULT 'other',
  txn_date TEXT,
  txn_type TEXT,
  description TEXT,
  reference_number TEXT,
  gross_cents INTEGER NOT NULL DEFAULT 0,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  net_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  running_balance_cents INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT,
  matched_scope_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accounting_statement_import_id) REFERENCES accounting_statement_imports(accounting_statement_import_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_accounting_statement_import_rows_import ON accounting_statement_import_rows(accounting_statement_import_id, txn_date);

CREATE TABLE IF NOT EXISTS accounting_reconciliation_exceptions (
  accounting_reconciliation_exception_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_type TEXT NOT NULL,
  period_month TEXT NOT NULL,
  scope_key TEXT NOT NULL DEFAULT 'all',
  provider_scope TEXT,
  exception_status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'warning',
  reference_label TEXT,
  statement_amount_cents INTEGER NOT NULL DEFAULT 0,
  book_amount_cents INTEGER NOT NULL DEFAULT 0,
  difference_cents INTEGER NOT NULL DEFAULT 0,
  tolerance_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  detail_json TEXT,
  source_import_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_import_id) REFERENCES accounting_statement_imports(accounting_statement_import_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_accounting_reconciliation_exceptions_period ON accounting_reconciliation_exceptions(reconciliation_type, period_month DESC, exception_status);

CREATE TABLE IF NOT EXISTS accounting_fixed_assets (
  accounting_fixed_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_label TEXT NOT NULL,
  asset_category TEXT,
  cca_class TEXT,
  acquisition_date TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  salvage_cents INTEGER NOT NULL DEFAULT 0,
  business_use_percent INTEGER NOT NULL DEFAULT 100,
  vendor_name TEXT,
  related_expense_id INTEGER,
  notes TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_accounting_fixed_assets_category ON accounting_fixed_assets(asset_category, cca_class, acquisition_date DESC);

-- Current pass update: customer engagement automation timing rules
CREATE TABLE IF NOT EXISTS notification_automation_settings (
  notification_automation_setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_kind TEXT NOT NULL UNIQUE,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  send_after_hours INTEGER NOT NULL DEFAULT 24,
  max_age_days INTEGER NOT NULL DEFAULT 30,
  order_statuses_json TEXT,
  payment_statuses_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_automation_settings_kind ON notification_automation_settings(notification_kind);

CREATE TABLE IF NOT EXISTS community_events (
  community_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'market',
  event_status TEXT NOT NULL DEFAULT 'planned',
  starts_at TEXT,
  ends_at TEXT,
  venue_name TEXT,
  city TEXT,
  region_label TEXT,
  event_url TEXT,
  public_note TEXT,
  sale_channel_note TEXT,
  pickup_supported INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_community_events_active_start ON community_events(is_active, starts_at, sort_order);

CREATE TABLE IF NOT EXISTS pickup_profiles (
  pickup_profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  pickup_mode TEXT NOT NULL DEFAULT 'appointment',
  city TEXT,
  region_label TEXT,
  appointment_only INTEGER NOT NULL DEFAULT 1,
  lead_time_hours INTEGER NOT NULL DEFAULT 24,
  public_note TEXT,
  availability_note TEXT,
  map_url TEXT,
  contact_hint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pickup_profiles_active_sort ON pickup_profiles(is_active, sort_order, label);



-- Current pass note: community content now includes recurring schedules, vendor-application capture, and event-image support through the existing media upload flow.
ALTER TABLE community_events ADD COLUMN recurrence_rule TEXT NOT NULL DEFAULT 'none';
ALTER TABLE community_events ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE community_events ADD COLUMN recurrence_count INTEGER;
ALTER TABLE community_events ADD COLUMN recurrence_until TEXT;
ALTER TABLE community_events ADD COLUMN recurrence_label TEXT;
ALTER TABLE community_events ADD COLUMN image_url TEXT;
ALTER TABLE community_events ADD COLUMN image_alt TEXT;
ALTER TABLE community_events ADD COLUMN application_mode TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE community_events ADD COLUMN application_url TEXT;
ALTER TABLE community_events ADD COLUMN vendor_capacity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE community_events ADD COLUMN vendor_note TEXT;
CREATE TABLE IF NOT EXISTS event_vendor_applications (
  event_vendor_application_id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_event_id INTEGER,
  event_title_snapshot TEXT,
  vendor_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  city TEXT,
  offered_items TEXT,
  website_url TEXT,
  marketplace_url TEXT,
  instagram_url TEXT,
  setup_notes TEXT,
  application_status TEXT NOT NULL DEFAULT 'submitted',
  internal_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (community_event_id) REFERENCES community_events(community_event_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_event_vendor_applications_event_status ON event_vendor_applications(community_event_id, application_status, created_at DESC);
