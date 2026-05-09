-- Current pass note: accounting now adds statement-import tables, reconciliation exceptions, fixed-asset groundwork, attachment-required month-close checks, export bundle v2 groundwork, and public colour-filter/catalog-preference support.
-- Current pass note: this storefront/discovery pass adds dedicated public Collections and Marketplaces pages, stronger sale-channel/provenance guidance, and broader internal linking without requiring new database tables.
-- Current pass note: customer engagement workflow depth now includes purchaser-versus-recipient gift-card support, broader engagement queues, and storefront featured-testimonial placement.
-- Current pass note: phone-first finished-product entry now supports a lightweight wizard mode plus capture metadata for same-day draft review and safer bulk cleanup.
-- Current pass note: stock-unit versus usage-unit inventory handling was expanded for clearer craft-material costing and planning.
-- Current pass note: DD finished-product numbering now has a configurable start value in app_settings, defaulting to 1000 when older databases have not seeded the setting yet.
-- Current pass note: broad product repricing is now handled in code through the existing products table and admin bulk tooling; no new required schema tables were needed for this pass.
-- Current pass note: admin write-path resilience now extends beyond read-only fallback. Order status updates, manual payment recording, and refund/dispute actions log server-side incidents more defensively, while the order-detail UI can preserve failed admin writes locally for manual retry. Composite payment/refund/dispute indexes were added to keep these health and follow-up queries fast as the fallback layer grows.
-- Current pass note: no brand-new required tables were added in this pass; the main work was endpoint hardening against partially migrated or lightly seeded D1 data so admin and storefront JSON routes fail gracefully instead of returning HTML errors.
-- File: /database_full_schema.sql
-- Brief description: Full current database schema for the Devil n Dove platform.
-- Apply on a fresh database to create the complete current auth, commerce, payment,
-- media, analytics, notifications, profiles, and access-tier structure.

-- Current pass note: phone product capture now resolves the shared D1 binding through DB or DD_DB and returns structured JSON failures instead of HTML parser breaks.
PRAGMA foreign_keys = ON;

-- =========================================================
-- CORE AUTH / ADMIN
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS sessions (
  session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT,
  target_user_id INTEGER,
  target_type TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_user_id ON admin_logs(admin_user_id);

-- =========================================================
-- PROFILES / ACCESS TIERS
-- =========================================================
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

CREATE TABLE IF NOT EXISTS access_tiers (
  access_tier_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capture_reference TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_access_tiers (
  user_access_tier_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  access_tier_id INTEGER NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  granted_by_user_id INTEGER,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (access_tier_id) REFERENCES access_tiers(access_tier_id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_type ON user_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_access_tiers_unique ON user_access_tiers(user_id, access_tier_id);
CREATE INDEX IF NOT EXISTS idx_user_access_tiers_user_id ON user_access_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_tiers_access_tier_id ON user_access_tiers(access_tier_id);

INSERT OR IGNORE INTO access_tiers (code, name, description, is_active)
VALUES
  ('artist', 'Artist', 'Internal artist/creator access', 1),
  ('customer', 'Customer', 'Standard customer account access', 1),
  ('donor', 'Donor', 'Supporter/donor access tier', 1),
  ('vip_donor', 'VIP Donor', 'Higher donor/supporter tier', 1),
  ('subscriber', 'Subscriber', 'Subscriber/member content access', 1),
  ('customer_bronze', 'Customer Bronze', 'Entry customer tier for future discount and loyalty features', 1),
  ('customer_silver', 'Customer Silver', 'Mid customer tier for future discount and loyalty features', 1),
  ('customer_gold', 'Customer Gold', 'Higher customer tier for future discount and loyalty features', 1),
  ('customer_platinum', 'Customer Platinum', 'Top customer tier for future discount and loyalty features', 1),
  ('employee', 'Employee', 'Standard employee/internal access tier', 1),
  ('employee_senior', 'Senior Employee', 'Senior employee/internal access tier', 1),
  ('employee_manager', 'Employee Manager', 'Manager/internal leadership tier', 1);

-- =========================================================
-- STORE / COMMERCE
-- =========================================================
CREATE TABLE IF NOT EXISTS tax_classes (
  tax_class_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capture_reference TEXT,
  description TEXT,
  tax_rate REAL NOT NULL DEFAULT 0.13,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  product_number INTEGER UNIQUE,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  capture_reference TEXT,
  product_category TEXT,
  color_name TEXT,
  color_names_json TEXT,
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
  merchandise_origin TEXT NOT NULL DEFAULT 'handmade' CHECK (merchandise_origin IN ('handmade','vintage','collectible','antique','oddity','prebuilt')),
  sale_channel TEXT NOT NULL DEFAULT 'onsite' CHECK (sale_channel IN ('onsite','external_only','hybrid')),
  external_listing_url TEXT,
  external_listing_label TEXT,
  condition_summary TEXT,
  era_label TEXT,
  sourcing_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  capture_entry_mode TEXT NOT NULL DEFAULT 'full' CHECK (capture_entry_mode IN ('full','wizard')),
  capture_created_by_user_id INTEGER,
  capture_updated_by_user_id INTEGER,
  capture_entry_started_at TEXT,
  capture_last_saved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tax_class_id) REFERENCES tax_classes(tax_class_id),
  FOREIGN KEY (capture_created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (capture_updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_products_capture_last_saved_at ON products(capture_last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_capture_updated_by ON products(capture_updated_by_user_id, capture_last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_origin_channel ON products(merchandise_origin, sale_channel, status, review_status);

CREATE TABLE IF NOT EXISTS product_images (
  product_image_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

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

-- =========================================================
-- PAYMENTS / WEBHOOKS / MEDIA ASSETS
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('paypal', 'stripe', 'square', 'manual', 'other')),
  provider_payment_id TEXT,
  provider_order_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  payment_method_label TEXT,
  transaction_reference TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL CHECK (provider IN ('paypal', 'stripe', 'square', 'other')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT,
  verification_status TEXT,
  process_status TEXT NOT NULL DEFAULT 'received'
    CHECK (process_status IN ('received', 'processed', 'ignored', 'duplicate', 'failed')),
  related_order_id INTEGER,
  related_payment_id INTEGER,
  payload_json TEXT,
  error_text TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  replay_requested_at TEXT,
  replay_requested_by_user_id INTEGER,
  dispatch_notes TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
  FOREIGN KEY (related_payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  media_asset_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  bucket_name TEXT,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  variant_role TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  annotation_notes TEXT,
  width_px INTEGER,
  height_px INTEGER,
  image_orientation TEXT,
  background_consistency_score INTEGER,
  subject_fill_score INTEGER,
  sharpness_score INTEGER,
  brightness_score INTEGER,
  contrast_score INTEGER,
  angle_group TEXT,
  shot_style TEXT,
  merchandising_score INTEGER,
  deleted_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_status_created_at ON payments(order_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status ON webhook_events(provider, process_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_product_id ON media_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_sort_order ON media_assets(product_id, sort_order);

CREATE TABLE IF NOT EXISTS payment_refunds (
  refund_id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_refund_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  refund_status TEXT NOT NULL DEFAULT 'recorded' CHECK (refund_status IN ('recorded','requested','submitted','succeeded','failed','cancelled')),
  reason TEXT,
  note TEXT,
  provider_sync_status TEXT,
  provider_sync_note TEXT,
  provider_sync_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_disputes (
  dispute_id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_dispute_id TEXT,
  dispute_status TEXT NOT NULL DEFAULT 'open' CHECK (dispute_status IN ('open','under_review','won','lost','closed')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  reason TEXT,
  evidence_due_at TEXT,
  note TEXT,
  provider_sync_status TEXT,
  provider_sync_note TEXT,
  provider_sync_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order_id ON payment_refunds(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_order_id ON payment_disputes(order_id, dispute_status);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_sync_status ON payment_refunds(provider_sync_status, refund_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status_provider ON payment_disputes(dispute_status, provider_sync_status, created_at DESC);


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



-- =========================================================
-- GROWTH / ANALYTICS / SEO / NOTIFICATIONS / INVENTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS site_visitors (
  site_visitor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_token TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  user_agent TEXT,
  referrer_host TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visit_count INTEGER NOT NULL DEFAULT 1,
  is_bot INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_visitor_sessions (
  site_visitor_session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_visitor_id INTEGER NOT NULL,
  session_token TEXT NOT NULL,
  user_id INTEGER,
  entry_path TEXT,
  last_path TEXT,
  country TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  page_view_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  is_checkout_started INTEGER NOT NULL DEFAULT 0,
  is_abandoned_cart INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (site_visitor_id) REFERENCES site_visitors(site_visitor_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE(site_visitor_id, session_token)
);

CREATE TABLE IF NOT EXISTS site_page_views (
  site_page_view_id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_visitor_id INTEGER,
  site_visitor_session_id INTEGER,
  user_id INTEGER,
  path TEXT NOT NULL,
  query_string TEXT,
  referrer TEXT,
  page_title TEXT,
  page_h1 TEXT,
  event_type TEXT NOT NULL DEFAULT 'page_view',
  duration_ms INTEGER,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_visitor_id) REFERENCES site_visitors(site_visitor_id) ON DELETE SET NULL,
  FOREIGN KEY (site_visitor_session_id) REFERENCES site_visitor_sessions(site_visitor_session_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS site_search_events (
  site_search_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_visitor_id INTEGER,
  site_visitor_session_id INTEGER,
  user_id INTEGER,
  search_term TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_visitor_id) REFERENCES site_visitors(site_visitor_id) ON DELETE SET NULL,
  FOREIGN KEY (site_visitor_session_id) REFERENCES site_visitor_sessions(site_visitor_session_id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_activity (
  cart_activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_token TEXT,
  session_token TEXT,
  user_id INTEGER,
  order_id INTEGER,
  event_type TEXT NOT NULL,
  path TEXT,
  cart_count INTEGER NOT NULL DEFAULT 0,
  cart_value_cents INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  app_setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_jobs (
  notification_job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  job_type TEXT NOT NULL,
  target TEXT,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_dispatch_logs (
  notification_dispatch_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_job_id INTEGER,
  status TEXT NOT NULL,
  error_text TEXT,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_job_id) REFERENCES notification_jobs(notification_job_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_seo (
  product_seo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL UNIQUE,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  h1_override TEXT,
  canonical_url TEXT,
  schema_type TEXT NOT NULL DEFAULT 'Product',
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_image_annotations (
  product_image_annotation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  product_image_id INTEGER,
  image_url TEXT,
  alt_text TEXT,
  image_title TEXT,
  caption TEXT,
  focal_point_x REAL,
  focal_point_y REAL,
  annotation_notes TEXT,
  width_px INTEGER,
  height_px INTEGER,
  image_orientation TEXT,
  crop_x REAL,
  crop_y REAL,
  crop_width REAL,
  crop_height REAL,
  first_image_score INTEGER,
  background_consistency_score INTEGER,
  subject_fill_score INTEGER,
  sharpness_score INTEGER,
  brightness_score INTEGER,
  contrast_score INTEGER,
  angle_group TEXT,
  shot_style TEXT,
  merchandising_score INTEGER,
  merchandising_override_reason TEXT,
  merchandising_override_note TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (product_image_id) REFERENCES product_images(product_image_id) ON DELETE CASCADE
);

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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_media_score_history_product_id_created_at ON product_media_score_history(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS catalog_items (
  catalog_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('tool','supply','creation','other')),
  source_key TEXT NOT NULL,
  slug TEXT,
  name TEXT NOT NULL,
  capture_reference TEXT,
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


CREATE TABLE IF NOT EXISTS site_item_inventory (
  site_item_inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  external_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  source_url TEXT,
  amazon_url TEXT,
  image_url TEXT,
  on_hand_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  incoming_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  stock_unit_label TEXT NOT NULL DEFAULT 'unit',
  usage_unit_label TEXT NOT NULL DEFAULT 'unit',
  usage_units_per_stock_unit REAL NOT NULL DEFAULT 1,
  supplier_name TEXT,
  supplier_sku TEXT,
  supplier_contact TEXT,
  reorder_notes TEXT,
  preferred_reorder_quantity INTEGER NOT NULL DEFAULT 0,
  is_on_reorder_list INTEGER NOT NULL DEFAULT 0,
  do_not_reorder INTEGER NOT NULL DEFAULT 0,
  do_not_reuse INTEGER NOT NULL DEFAULT 0,
  reuse_status TEXT,
  reservation_notes TEXT,
  last_reorder_requested_at TEXT,
  last_counted_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, external_key)
);


CREATE TABLE IF NOT EXISTS site_inventory_movements (
  site_inventory_movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_item_inventory_id INTEGER,
  source_type TEXT,
  external_key TEXT,
  item_name TEXT,
  movement_type TEXT NOT NULL DEFAULT 'adjustment' CHECK (movement_type IN ('create','adjustment','reserve','release','incoming','delete','correction')),
  quantity_delta INTEGER NOT NULL DEFAULT 0,
  previous_on_hand_quantity INTEGER NOT NULL DEFAULT 0,
  new_on_hand_quantity INTEGER NOT NULL DEFAULT 0,
  previous_reserved_quantity INTEGER NOT NULL DEFAULT 0,
  new_reserved_quantity INTEGER NOT NULL DEFAULT 0,
  previous_incoming_quantity INTEGER NOT NULL DEFAULT 0,
  new_incoming_quantity INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  actor_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_item_inventory_id) REFERENCES site_item_inventory(site_item_inventory_id) ON DELETE SET NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_site_visitors_token ON site_visitors(visitor_token);
CREATE INDEX IF NOT EXISTS idx_site_visitors_country ON site_visitors(country);
CREATE INDEX IF NOT EXISTS idx_site_visitor_sessions_site_visitor_id ON site_visitor_sessions(site_visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_visitor_sessions_last_seen_at ON site_visitor_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_site_page_views_path ON site_page_views(path);
CREATE INDEX IF NOT EXISTS idx_site_page_views_created_at ON site_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_site_search_events_search_term ON site_search_events(search_term);
CREATE INDEX IF NOT EXISTS idx_cart_activity_event_type ON cart_activity(event_type);
CREATE INDEX IF NOT EXISTS idx_cart_activity_created_at ON cart_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_site_item_inventory_source ON site_item_inventory(source_type, category);
CREATE INDEX IF NOT EXISTS idx_site_inventory_movements_item_id ON site_inventory_movements(site_item_inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_inventory_movements_created_at ON site_inventory_movements(created_at DESC);


INSERT OR IGNORE INTO app_settings (setting_key, setting_value, is_public)
VALUES
  ('site.seo.business_name', 'Devil n Dove', 1),
  ('site.seo.default_title_suffix', 'Devil n Dove', 1),
  ('site.seo.default_description', 'Devil n Dove is a Southern Ontario creative workshop and online store focused on handcrafted jewelry, custom artisan goods, tools, supplies, and maker projects.', 1),
  ('site.seo.default_keywords', 'Devil n Dove, handmade jewelry Ontario, artisan workshop, creative supplies, workshop tools, polymer clay jewelry, maker shop Southern Ontario', 1),
  ('site.seo.primary_h1_pattern', 'Devil n Dove | Handmade Jewelry, Creative Supplies, and Workshop Tools in Southern Ontario', 1),
  ('site.business.primary_location', 'Tillsonburg, Ontario, Canada', 1),
  ('site.catalog.product_number_start', '1000', 0),
  ('site.catalog.product_category_options', '[]', 0),
  ('site.catalog.color_options', '[]', 0),
  ('site.catalog.shipping_code_options', '[]', 0),
  ('site.notifications.retry_minutes', '15', 0),
  ('payments.paypal.enabled', 'true', 1),
  ('payments.stripe.enabled', 'true', 1);


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
  FOREIGN KEY (supplier_purchase_order_id) REFERENCES supplier_purchase_orders(supplier_purchase_order_id) ON DELETE CASCADE,
  FOREIGN KEY (site_item_inventory_id) REFERENCES site_item_inventory(site_item_inventory_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_order_items_po ON supplier_purchase_order_items(supplier_purchase_order_id);

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


-- Current pass note: the public movies page uses front_image_url/back_image_url from data/movies/movie_catalog_enriched.v2.json and can derive a trailer search URL at runtime when trailer_url is blank.


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
  gifi_reviewed_by_user_id INTEGER,
  gifi_reviewed_at TEXT,
  tax_deductibility_percent INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS accounting_expenses (
  expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT,
  vendor_id INTEGER,
  vendor_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  ledger_code TEXT,
  ledger_name TEXT,
  recurring_expense_rule_id INTEGER,
  source_mode TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
  journal_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_month TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  reference_code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  total_debit_cents INTEGER NOT NULL DEFAULT 0,
  total_credit_cents INTEGER NOT NULL DEFAULT 0,
  imbalance_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_month, source_type, source_key)
);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_period ON accounting_journal_entries(period_month, entry_date DESC, journal_entry_id DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_source ON accounting_journal_entries(source_type, source_key, period_month);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  journal_line_id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_entry_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  ledger_code TEXT,
  ledger_name TEXT,
  line_description TEXT,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (journal_entry_id, line_number),
  FOREIGN KEY (journal_entry_id) REFERENCES accounting_journal_entries(journal_entry_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id, line_number ASC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_ledger ON accounting_journal_lines(ledger_code, created_at DESC);


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


-- Current Pass Note — 2026-04-15
-- Added app_settings-backed dropdown master-data keys for product categories, colours, and shipping codes.
-- Product resource links now support per-unit, end-of-lot, and story-only inventory usage modes.
-- End-of-lot mode is intended for supplies such as wax/resin/clay where one lot may cover many finished products before inventory should be reduced.


-- Current Pass Note — 2026-04-16
-- Inventory items now support usage-unit labeling and per-stock-unit usage counts so cost/buildable math can work for cups, wicks, grams, and similar partial-use materials.

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

-- Current Pass Update
-- Added/expected usage this pass:
-- 1) Member/storefront order-history views can read gift_cards by order_id.
-- 2) Member/storefront order-history views can read gift_card_delivery_audit by gift_card_id.
-- 3) product_image_annotations should continue to support width/height/orientation/crop/first_image_score.
-- 4) No destructive schema changes were introduced in this pass; this is a documentation sync note.



-- Current pass note: product image review now also supports merchandising_override_reason / merchandising_override_note and product_media_score_history trend snapshots for admin drift review.


CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_category_sort ON general_ledger_accounts(category, sort_order, code);
CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_gifi ON general_ledger_accounts(gifi_section, gifi_code, code);
CREATE INDEX IF NOT EXISTS idx_general_ledger_accounts_review_state ON general_ledger_accounts(gifi_review_state, is_active, code);


-- Pass update: accounting attachments and deeper reconciliation metadata
CREATE TABLE IF NOT EXISTS accounting_attachments (
  accounting_attachment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_kind TEXT NOT NULL DEFAULT 'other',
  attachment_status TEXT NOT NULL DEFAULT 'uploaded',
  attachment_scope TEXT NOT NULL DEFAULT 'other',
  document_date TEXT,
  scope_key TEXT,
  provider_scope TEXT,
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
ALTER TABLE accounting_attachments ADD COLUMN attachment_status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE accounting_attachments ADD COLUMN document_date TEXT;
ALTER TABLE accounting_attachments ADD COLUMN scope_key TEXT;
CREATE INDEX IF NOT EXISTS idx_accounting_attachments_scope ON accounting_attachments(reconciliation_type, period_month, scope_key, attachment_kind);

ALTER TABLE accounting_reconciliation_reviews ADD COLUMN statement_reference TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN difference_reason TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN detail_json TEXT;
ALTER TABLE accounting_reconciliation_reviews ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0;
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


-- Current pass update: customer engagement automation timing rules


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
  recurrence_rule TEXT NOT NULL DEFAULT 'none',
  recurrence_interval INTEGER NOT NULL DEFAULT 1,
  recurrence_count INTEGER,
  recurrence_until TEXT,
  recurrence_label TEXT,
  image_url TEXT,
  image_alt TEXT,
  application_mode TEXT NOT NULL DEFAULT 'closed',
  application_url TEXT,
  vendor_capacity INTEGER NOT NULL DEFAULT 0,
  vendor_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_community_events_active_start ON community_events(is_active, starts_at, sort_order);

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

