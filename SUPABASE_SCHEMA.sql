-- Last synchronized: March 30, 2026. Reviewed during the session-first cleanup, promo stabilization follow-up, and docs/schema synchronization pass.
-- March 30, 2026 promo stability and session-noise pass note
-- Promo management now aligns with the reconciled live promo_codes table/constraint model, guest booking no longer hits client dashboard prefill until auth is confirmed, and more active admin routes now require session-first staff access.

-- March 30, 2026 promo compatibility pass note
-- Admin promo creation now targets the minimal canonical promo payload expected by the live promo_codes table.

-- March 29, 2026 sync note: no new tables were required for this pass; this refresh mainly extends signed-in staff session coverage, reduces shared-password-only endpoint usage, and improves actor attribution in time/intake/media/booking flows.
-- 
-- 
> Last synchronized: March 28, 2026. Reviewed during the pricing chart zoom/modal, manufacturer callout, local SEO metadata, and current-build synchronization pass.

-- Last synchronized: March 27, 2026. Reviewed during the booking wizard sticky-fix, two-way active-job communication pass, and docs/schema refresh.
-- March 27, 2026 mobile booking + account widget pass: no new DDL required; booking flow, account widget, and customer progress filtering changed application behavior only.

-- March 26, 2026 pass note: no new table was required in this pass; the focus moved to UI coverage over existing catalog inventory, movement, booking-linked usage, and progress/session flows.
-- Rosie Dazzlers - Current Supabase Schema Snapshot
-- Updated: 2026-03-25

create extension if not exists pgcrypto;

create table if not exists public.app_management_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending',
  job_status text null,
  service_date date not null,
  start_slot text not null check (start_slot in ('AM','PM')),
  duration_slots integer not null default 1 check (duration_slots in (1,2)),
  service_area text not null,
  package_code text not null,
  vehicle_size text not null,
  addons jsonb not null default '[]'::jsonb,
  customer_name text not null,
  customer_email text not null,
  customer_phone text null,
  address_line1 text not null,
  address_line2 text null,
  city text null,
  postal_code text null,
  currency text not null default 'CAD',
  price_total_cents integer not null default 0,
  deposit_cents integer not null default 0,
  stripe_session_id text null,
  stripe_payment_intent text null,
  payment_provider text null,
  paypal_order_id text null,
  paypal_capture_id text null,
  progress_enabled boolean not null default false,
  progress_token uuid null default gen_random_uuid(),
  assigned_to text null,
  assigned_staff_user_id uuid null,
  customer_profile_id uuid null,
  customer_tier_code text null,
  waiver_accepted_at timestamptz null,
  waiver_ip text null,
  waiver_user_agent text null,
  ack_driveway boolean not null default false,
  ack_power_water boolean not null default false,
  ack_bylaw boolean not null default false,
  ack_cancellation boolean not null default false,
  notes text null,
  vehicle_year integer null,
  vehicle_make text null,
  vehicle_model text null,
  vehicle_body_style text null,
  vehicle_category text null,
  vehicle_plate text null,
  vehicle_mileage_km numeric null,
  vehicle_photo_url text null,
  current_workflow_stage text null,
  detailer_response_status text null,
  detailer_response_reason text null,
  dispatched_at timestamptz null,
  arrived_at timestamptz null,
  detailing_started_at timestamptz null,
  detailing_paused_at timestamptz null,
  detailing_completed_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists public.date_blocks (id uuid primary key default gen_random_uuid(), blocked_date date not null unique, reason text null, created_at timestamptz not null default now());
create table if not exists public.slot_blocks (id uuid primary key default gen_random_uuid(), blocked_date date not null, slot text not null check (slot in ('AM','PM')), reason text null, created_at timestamptz not null default now(), unique (blocked_date, slot));
create table if not exists public.booking_events (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, created_at timestamptz not null default now(), event_type text not null, event_note text null, actor_name text null, payload jsonb not null default '{}'::jsonb);
create table if not exists public.promo_codes (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), code text not null unique, active boolean not null default true, is_active boolean not null default true, discount_type text null, discount_percent numeric(6,2) null, discount_cents integer null, percent_off numeric(6,2) null, amount_off_cents integer null, starts_at timestamptz null, ends_at timestamptz null, starts_on date null, ends_on date null, max_uses integer null, uses integer not null default 0, notes text null);
create table if not exists public.gift_products (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), sku text not null unique, type text not null check (type in ('service','open','fixed_amount')), package_code text null, vehicle_size text null, face_value_cents integer not null default 0, currency text not null default 'CAD', is_active boolean not null default true, title text null, description text null);
create table if not exists public.gift_certificates (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), code text not null unique, type text not null check (type in ('service','open','fixed_amount')), status text not null default 'active', currency text not null default 'CAD', package_code text null, vehicle_size text null, original_value_cents integer not null default 0, remaining_cents integer not null default 0, purchaser_email text null, recipient_name text null, recipient_email text null, stripe_session_id text null, redeemed_at timestamptz null, expires_at timestamptz null, notes text null);
create table if not exists public.job_updates (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text not null, note text not null, visibility text not null default 'customer' check (visibility in ('customer','internal')), parent_update_id uuid null references public.job_updates(id) on delete cascade, thread_status text not null default 'visible' check (thread_status in ('visible','hidden','internal_only','pinned')), moderated_at timestamptz null, moderated_by_name text null, moderation_reason text null, staff_user_id uuid null);
create table if not exists public.job_media (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by text not null, kind text not null check (kind in ('photo','video')), caption text null, media_url text not null, visibility text not null default 'customer' check (visibility in ('customer','internal')), thread_status text not null default 'visible' check (thread_status in ('visible','hidden','internal_only','pinned')), moderated_at timestamptz null, moderated_by_name text null, moderation_reason text null, staff_user_id uuid null);
create table if not exists public.job_signoffs (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, created_at timestamptz not null default now(), signed_at timestamptz not null default now(), signer_type text not null check (signer_type in ('customer','staff')), signer_name text not null, signer_email text null, notes text null, user_agent text null, staff_user_id uuid null);
create table if not exists public.recovery_message_templates (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), template_key text not null unique, channel text not null check (channel in ('email','sms')), provider text not null default 'manual', is_active boolean not null default true, subject_template text null, body_template text not null, variables jsonb not null default '[]'::jsonb, rules jsonb not null default '{}'::jsonb, notes text null);
create table if not exists public.catalog_inventory_items (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), item_key text not null unique, item_type text not null check (item_type in ('tool','consumable')), name text not null, category text null, subcategory text null, description text null, image_url text null, amazon_url text null, is_public boolean not null default true, is_active boolean not null default true, qty_on_hand numeric(12,2) not null default 0, reorder_point numeric(12,2) not null default 0, reorder_qty numeric(12,2) not null default 0, unit_label text null, cost_cents integer null, preferred_vendor text null, vendor_sku text null, rating_value numeric(3,2) null, rating_count integer not null default 0, sort_key integer not null default 0, reuse_policy text not null default 'reorder' check (reuse_policy in ('reorder','single_use','never_reuse')), purchase_date date null, estimated_jobs_per_unit numeric(12,2) null, notes text null);
create table if not exists public.catalog_low_stock_alerts (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), item_id uuid not null references public.catalog_inventory_items(id) on delete cascade, item_key text null, qty_snapshot numeric(12,2) null, reorder_point_snapshot numeric(12,2) null, is_resolved boolean not null default false, resolved_at timestamptz null, resolved_by_name text null, resolution_notes text null);
create table if not exists public.catalog_purchase_orders (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), item_id uuid null references public.catalog_inventory_items(id) on delete set null, item_key text null, item_name text null, vendor_name text null, qty_ordered numeric(12,2) not null default 0, unit_cost_cents integer null, status text not null default 'draft' check (status in ('draft','requested','ordered','received','cancelled')), reminder_at timestamptz null, reminder_sent_at timestamptz null, reminder_last_channel text null, ordered_at timestamptz null, received_at timestamptz null, purchase_url text null, note text null);


create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null unique,
  full_name text null,
  phone text null,
  tier_code text null,
  notes text null,
  address_line1 text null,
  address_line2 text null,
  city text null,
  province text null,
  postal_code text null,
  vehicle_notes text null,
  password_hash text null,
  is_active boolean not null default true,
  notification_opt_in boolean not null default true,
  notification_channel text null,
  detailer_chat_opt_in boolean not null default true,
  email_verified_at timestamptz null,
  marketing_source text null,
  last_login_at timestamptz null
);
create table if not exists public.customer_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null,
  ip_address text null,
  user_agent text null
);
create table if not exists public.customer_auth_tokens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  purpose text not null check (purpose in ('password_reset','email_verification')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  payload jsonb not null default '{}'::jsonb
);
create table if not exists public.site_activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id text not null,
  session_id text not null,
  event_type text not null,
  page_path text not null,
  page_title text null,
  referrer text null,
  country text null,
  ip_address text null,
  user_agent text null,
  locale text null,
  timezone text null,
  screen text null,
  source text null,
  campaign text null,
  checkout_state text null,
  payload jsonb not null default '{}'::jsonb
);
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_type text not null,
  channel text null,
  booking_id uuid null,
  customer_profile_id uuid null,
  recipient_email text null,
  recipient_phone text null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  max_attempts integer not null default 5,
  provider_response jsonb null,
  subject text null,
  body_text text null,
  body_html text null
);
create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  vehicle_name text null,
  model_year integer null,
  make text null,
  model text null,
  vehicle_size text null,
  body_style text null,
  vehicle_category text null,
  is_exotic boolean not null default false,
  color text null,
  mileage_km numeric null,
  parking_location text null,
  alternate_service_address text null,
  notes_for_team text null,
  detailer_visible_notes text null,
  admin_private_notes text null,
  preferred_contact_name text null,
  contact_email text null,
  contact_phone text null,
  text_updates_opt_in boolean not null default false,
  live_updates_opt_in boolean not null default true,
  has_water_hookup boolean not null default false,
  has_power_hookup boolean not null default false,
  save_billing_on_file boolean not null default false,
  billing_label text null,
  display_order integer not null default 0,
  last_wash_at date null,
  next_cleaning_due_at date null,
  service_interval_days integer null,
  auto_schedule_opt_in boolean not null default false,
  last_package_code text null,
  last_addons jsonb not null default '[]'::jsonb,
  is_primary boolean not null default false
);

create table if not exists public.vehicle_catalog_cache (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  model_year integer not null,
  make text not null,
  model text not null,
  vehicle_type text not null default '',
  size_bucket text null,
  is_exotic boolean not null default false,
  source text not null default 'nhtsa_vpic',
  last_seen_at timestamptz not null default now(),
  unique (model_year, make, model, vehicle_type)
);

create table if not exists public.observation_annotations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  media_id uuid null references public.job_media(id) on delete cascade,
  author_type text null,
  author_name text null,
  annotation_text text null,
  thread_status text not null default 'visible',
  moderated_at timestamptz null,
  moderated_by_staff_user_id uuid null,
  moderated_by_name text null,
  moderation_reason text null
);

-- March 24, 2026 late-pass note
-- Public analytics continues to store raw events in public.site_activity_events.
-- Daily traffic, live-online counts, cart signals, and checkout-state summaries are currently derived in the admin analytics layer rather than via separate aggregate tables.


-- March 25, 2026 indexes / settings helpers
create index if not exists catalog_purchase_orders_status_idx on public.catalog_purchase_orders(status);
create index if not exists catalog_purchase_orders_reminder_at_idx on public.catalog_purchase_orders(reminder_at);
create index if not exists catalog_purchase_orders_item_key_idx on public.catalog_purchase_orders(item_key);
create index if not exists catalog_inventory_items_category_idx on public.catalog_inventory_items(category);
create index if not exists catalog_inventory_items_subcategory_idx on public.catalog_inventory_items(subcategory);
create index if not exists catalog_inventory_items_sort_key_idx on public.catalog_inventory_items(sort_key);
create index if not exists catalog_inventory_items_reuse_policy_idx on public.catalog_inventory_items(reuse_policy);
-- app_management_settings.pricing_catalog is now the canonical DB-backed pricing source, with bundled JSON as fallback.

create index if not exists vehicle_catalog_cache_year_make_idx on public.vehicle_catalog_cache(model_year, make);
create index if not exists vehicle_catalog_cache_make_model_idx on public.vehicle_catalog_cache(make, model);


create table if not exists public.catalog_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  item_id uuid null references public.catalog_inventory_items(id) on delete set null,
  item_key text null,
  booking_id uuid null references public.bookings(id) on delete set null,
  movement_type text not null check (movement_type in ('adjustment','job_use','receive','recount','waste','return')),
  qty_delta numeric(12,2) not null default 0,
  previous_qty numeric(12,2) null,
  new_qty numeric(12,2) null,
  unit_label text null,
  note text null,
  actor_name text null,
  actor_staff_user_id uuid null references public.staff_users(id) on delete set null,
  actor_customer_profile_id uuid null references public.customer_profiles(id) on delete set null
);

create table if not exists public.job_completion_checklists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  keys_returned boolean not null default false,
  water_disconnected boolean not null default false,
  electricity_disconnected boolean not null default false,
  debrief_completed boolean not null default false,
  suggested_next_steps text null,
  suggested_interval_days integer null,
  auto_schedule_requested boolean not null default false,
  completed_by_name text null,
  completed_by_staff_user_id uuid null references public.staff_users(id) on delete set null,
  completed_at timestamptz null,
  notes text null
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_profile_id uuid null references public.customer_profiles(id) on delete set null,
  booking_id uuid null references public.bookings(id) on delete set null,
  vehicle_id uuid null references public.customer_vehicles(id) on delete set null,
  review_source text not null default 'app' check (review_source in ('app','google')),
  rating integer not null check (rating between 1 and 5),
  review_title text null,
  review_text text null,
  is_public boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  google_review_url text null,
  reviewer_name text null
);

create index if not exists catalog_inventory_movements_item_key_idx on public.catalog_inventory_movements(item_key);
create index if not exists catalog_inventory_movements_booking_id_idx on public.catalog_inventory_movements(booking_id);
create index if not exists customer_reviews_booking_id_idx on public.customer_reviews(booking_id);
create index if not exists customer_reviews_customer_profile_id_idx on public.customer_reviews(customer_profile_id);


-- Pass note: March 26, 2026
-- No new schema migration was required for the booking add-on imagery, public catalog autofill hardening,
-- low-stock reorder UI, or Amazon-link inventory intake pass.


-- 2026-03-28 late pass
-- No schema changes were required in this pass.
-- This pass repaired shared staff-auth compatibility, admin-shell loading UX, button contrast, and image-path issues.

-- March 29, 2026 gift / upload / endpoint pass
-- No new schema objects were required in this pass. Work focused on staff-session coverage, gift/account polish, upload validation, and documentation synchronization.

create index if not exists catalog_purchase_orders_reminder_sent_at_idx on public.catalog_purchase_orders(reminder_sent_at);

-- Last synchronized: 2026-03-29. Reviewed during the promo/block/session conversion and purchase-order reminder lifecycle pass.


-- March 29, 2026 pricing/session/recovery/moderation pass
-- No new table was required in this pass; the main changes were DB-first public pricing consumption, endpoint auth cleanup, recovery audit visibility, moderation filtering, and purchase reminder audit logging.
