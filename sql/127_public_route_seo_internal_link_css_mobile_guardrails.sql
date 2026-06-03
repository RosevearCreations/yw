-- Schema 127: public route SEO, internal-link, CSS-token, mobile action, and release-manifest guardrails.
-- Build 2026-06-02b. This pass keeps roadmap/issues/schema/docs/cache checks synchronized and adds DB-visible next-step depth.

begin;

create table if not exists public.app_public_route_seo_registry (
  route_key text primary key,
  route_path text not null,
  route_label text not null,
  page_title text,
  h1_text text,
  meta_description text,
  primary_local_terms text[] not null default '{}'::text[],
  secondary_search_terms text[] not null default '{}'::text[],
  proof_status text not null default 'review',
  title_status text not null default 'review',
  h1_status text not null default 'review',
  meta_status text not null default 'review',
  image_alt_status text not null default 'review',
  internal_link_status text not null default 'review',
  structured_data_status text not null default 'review',
  publish_status text not null default 'draft',
  local_wording_notes text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_public_route_seo_registry add column if not exists route_path text;
alter table public.app_public_route_seo_registry add column if not exists route_label text;
alter table public.app_public_route_seo_registry add column if not exists page_title text;
alter table public.app_public_route_seo_registry add column if not exists h1_text text;
alter table public.app_public_route_seo_registry add column if not exists meta_description text;
alter table public.app_public_route_seo_registry add column if not exists primary_local_terms text[] not null default '{}'::text[];
alter table public.app_public_route_seo_registry add column if not exists secondary_search_terms text[] not null default '{}'::text[];
alter table public.app_public_route_seo_registry add column if not exists proof_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists title_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists h1_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists meta_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists image_alt_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists internal_link_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists structured_data_status text not null default 'review';
alter table public.app_public_route_seo_registry add column if not exists publish_status text not null default 'draft';
alter table public.app_public_route_seo_registry add column if not exists local_wording_notes text;
alter table public.app_public_route_seo_registry add column if not exists fallback_hint text;
alter table public.app_public_route_seo_registry add column if not exists sort_order integer not null default 100;
alter table public.app_public_route_seo_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_public_route_seo_registry add column if not exists checked_at timestamptz;
alter table public.app_public_route_seo_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_internal_link_suggestion_queue (
  suggestion_key text primary key,
  source_route_key text references public.app_public_route_seo_registry(route_key) on delete cascade,
  target_route_key text references public.app_public_route_seo_registry(route_key) on delete set null,
  link_context text not null,
  suggested_anchor_text text,
  suggestion_status text not null default 'review',
  seo_reason text,
  proof_reason text,
  fallback_plan text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_internal_link_suggestion_queue add column if not exists source_route_key text;
alter table public.app_internal_link_suggestion_queue add column if not exists target_route_key text;
alter table public.app_internal_link_suggestion_queue add column if not exists link_context text;
alter table public.app_internal_link_suggestion_queue add column if not exists suggested_anchor_text text;
alter table public.app_internal_link_suggestion_queue add column if not exists suggestion_status text not null default 'review';
alter table public.app_internal_link_suggestion_queue add column if not exists seo_reason text;
alter table public.app_internal_link_suggestion_queue add column if not exists proof_reason text;
alter table public.app_internal_link_suggestion_queue add column if not exists fallback_plan text;
alter table public.app_internal_link_suggestion_queue add column if not exists sort_order integer not null default 100;
alter table public.app_internal_link_suggestion_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_internal_link_suggestion_queue add column if not exists checked_at timestamptz;
alter table public.app_internal_link_suggestion_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_css_component_token_inventory (
  token_key text primary key,
  component_area text not null,
  token_name text not null,
  token_purpose text,
  current_source text,
  recommended_class_name text,
  drift_risk text not null default 'medium',
  token_status text not null default 'review',
  mobile_check_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_mobile_field_action_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'employee',
  route_hint text,
  offline_support_status text not null default 'review',
  scan_or_proof_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_release_manifest_checks (
  manifest_key text primary key,
  release_label text not null,
  manifest_area text not null,
  manifest_title text not null,
  manifest_status text not null default 'review',
  file_path text,
  expected_marker text,
  verification_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_public_route_seo_registry (
  route_key, route_path, route_label, page_title, h1_text, meta_description,
  primary_local_terms, secondary_search_terms, proof_status, title_status, h1_status,
  meta_status, image_alt_status, internal_link_status, structured_data_status,
  publish_status, local_wording_notes, fallback_hint, sort_order, metadata, checked_at
)
values
  ('home_shell', '/', 'Home shell', 'YWI HSE workplace safety and field operations app', 'YWI HSE Field Operations', 'Workplace safety, job tracking, equipment accountability, and accounting workflow app for Ontario field operations.', array['Ontario workplace safety','field operations'], array['equipment signoff','job safety forms','mobile field app'], 'review', 'passed', 'passed', 'review', 'review', 'review', 'review', 'draft', 'Keep public wording truthful and service-area wording supported by real operations.', 'If DB registry is unavailable, keep index.html title/H1/meta smoke checks active.', 10, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('today_mobile', '/#today', 'Mobile Today', 'Today dashboard for field crews', 'YWI HSE Field Operations', 'Phone-first dashboard for safety forms, saved drafts, offline work, equipment checks, and Admin follow-up.', array['Ontario field crew','mobile safety forms'], array['offline draft','equipment scan','daily dashboard'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Today route is internal but should still use clear accessible labels.', 'If route registry fails, Today remains available from static shell and cached JS.', 20, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('jobs_equipment', '/#jobs', 'Jobs and Equipment', 'Jobs, equipment, signoffs, and accounting depth', 'YWI HSE Field Operations', 'Manage jobs, equipment checkout, arrival verification, return signoff, service tasks, and job profitability review.', array['equipment checkout','job profitability'], array['return signoff','arrival verification','repair costs'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Jobs route needs plain headings and no duplicate title-like H1 blocks.', 'Jobs UI should fall back to empty arrays when optional views are missing.', 30, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('admin_readiness', '/#admin', 'Admin readiness', 'Admin readiness and deployment checks', 'YWI HSE Field Operations', 'Admin command center for schema readiness, deployment guardrails, SEO checks, mobile quality, and accounting close review.', array['admin readiness','deployment checks'], array['schema drift','production readiness','local SEO checks'], 'review', 'review', 'passed', 'review', 'review', 'review', 'review', 'internal', 'Admin is internal, but labels must stay clear for operators.', 'Admin directory optional views must fail soft to visible empty tables.', 40, '{"build":"2026-06-02b","schema":127}'::jsonb, now())
on conflict (route_key) do update set
  route_path = excluded.route_path,
  route_label = excluded.route_label,
  page_title = excluded.page_title,
  h1_text = excluded.h1_text,
  meta_description = excluded.meta_description,
  primary_local_terms = excluded.primary_local_terms,
  secondary_search_terms = excluded.secondary_search_terms,
  proof_status = excluded.proof_status,
  title_status = excluded.title_status,
  h1_status = excluded.h1_status,
  meta_status = excluded.meta_status,
  image_alt_status = excluded.image_alt_status,
  internal_link_status = excluded.internal_link_status,
  structured_data_status = excluded.structured_data_status,
  publish_status = excluded.publish_status,
  local_wording_notes = excluded.local_wording_notes,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_internal_link_suggestion_queue (
  suggestion_key, source_route_key, target_route_key, link_context, suggested_anchor_text,
  suggestion_status, seo_reason, proof_reason, fallback_plan, sort_order, metadata, checked_at
)
values
  ('link_home_to_jobs_equipment', 'home_shell', 'jobs_equipment', 'Home shell should lead operators to job/equipment workflow.', 'Jobs and equipment signoff', 'review', 'Supports clear navigation to high-value workflow.', 'Only expose as public copy if actual workflow proof is ready.', 'Keep static nav link as fallback.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('link_today_to_jobs_scan', 'today_mobile', 'jobs_equipment', 'Today dashboard should lead to scan/check equipment action.', 'Scan or verify equipment', 'planned', 'Improves phone-first action clarity.', 'Requires working scan/proof action before marking ready.', 'Manual equipment-code search remains fallback.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('link_admin_to_seo_registry', 'admin_readiness', 'home_shell', 'Admin readiness should track public route title/H1/meta quality.', 'Public route SEO registry', 'review', 'Keeps SEO/local wording from drifting.', 'Registry must reflect real route content.', 'Smoke checks keep one-H1/title checks active.', 30, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (suggestion_key) do update set
  source_route_key = excluded.source_route_key,
  target_route_key = excluded.target_route_key,
  link_context = excluded.link_context,
  suggested_anchor_text = excluded.suggested_anchor_text,
  suggestion_status = excluded.suggestion_status,
  seo_reason = excluded.seo_reason,
  proof_reason = excluded.proof_reason,
  fallback_plan = excluded.fallback_plan,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_css_component_token_inventory (
  token_key, component_area, token_name, token_purpose, current_source,
  recommended_class_name, drift_risk, token_status, mobile_check_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('token_admin_table_scroll', 'admin tables', 'table-scroll', 'Shared horizontal overflow wrapper for long Admin tables.', 'style.css .table-scroll plus inline table wrappers', 'table-scroll', 'medium', 'in_progress', 'Verify tables become scrollable instead of overflowing phone screens.', 'Keep wrapper around new tables even when cards are added later.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_notice_panel', 'notices', 'notice', 'Reusable status/instruction block for fallback and empty state messages.', 'style.css .notice', 'notice notice--status', 'medium', 'review', 'Check small screens for readable wrapping and spacing.', 'Plain text fallback remains visible if enhanced cards fail.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_status_pill', 'status pills', 'admin-status-pill', 'Shared status labels for pass/warn/fail/review rows.', 'js/admin-ui.js renderStatusPill and style.css status classes', 'status-pill status-pill--state', 'high', 'review', 'Tap target not needed, but text and contrast must remain readable.', 'Fallback to text status when CSS is missing.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('token_mobile_quick_nav', 'mobile navigation', 'mobile-quick-nav', 'Phone-first fixed quick navigation bar.', 'style.css .mobile-quick-nav', 'mobile-quick-nav', 'medium', 'in_progress', 'Check bottom spacing and no overlap with form buttons.', 'Static top nav remains available.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (token_key) do update set
  component_area = excluded.component_area,
  token_name = excluded.token_name,
  token_purpose = excluded.token_purpose,
  current_source = excluded.current_source,
  recommended_class_name = excluded.recommended_class_name,
  drift_risk = excluded.drift_risk,
  token_status = excluded.token_status,
  mobile_check_hint = excluded.mobile_check_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_mobile_field_action_queue (
  action_key, action_area, action_title, action_status, required_role, route_hint,
  offline_support_status, scan_or_proof_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('mobile_scan_equipment_label', 'equipment', 'Scan equipment label into QR/barcode fields', 'planned', 'employee', '#jobs', 'manual_fallback_ready', 'Use BarcodeDetector/camera when available, with manual prompt fallback.', 'Manual code entry remains available.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_verify_arrival', 'equipment', 'Verify arrival/site test from phone', 'in_progress', 'site_leader', '#jobs', 'review', 'Use equipment code, arrival condition, arrival test, accessory status, and notes.', 'Supervisor can complete verification from desktop if phone fails.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_return_proof', 'equipment', 'Capture return proof and accessory status', 'in_progress', 'employee', '#jobs', 'review', 'Use return/damage photos, return test, and accessory checklist.', 'Evidence upload failures should show a visible retry message.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('mobile_accounting_review', 'accounting', 'Review accounting close exceptions on phone', 'planned', 'admin', '#admin', 'online_only', 'Use compact cards before tables for payment/reconciliation/remittance exceptions.', 'Desktop Admin remains fallback.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  offline_support_status = excluded.offline_support_status,
  scan_or_proof_hint = excluded.scan_or_proof_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_release_manifest_checks (
  manifest_key, release_label, manifest_area, manifest_title, manifest_status,
  file_path, expected_marker, verification_hint, failure_hint, sort_order, metadata, checked_at
)
values
  ('manifest_schema_127', '2026-06-02b', 'schema', 'Schema migration and full reference are aligned through 127', 'passed', 'sql/127_public_route_seo_internal_link_css_mobile_guardrails.sql', '127_public_route_seo_internal_link_css_mobile_guardrails', 'Run smoke check and verify schema drift expects 127.', 'Live DB can drift from shipped functions.', 10, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_docs_127', '2026-06-02b', 'documentation', 'Root Markdown and schema 127 doc refreshed', 'passed', 'docs/PUBLIC_ROUTE_SEO_INTERNAL_LINK_CSS_MOBILE_SCHEMA127.md', 'schema 127', 'Review roadmap/issues/database/deployment/checklist docs.', 'Operators may follow stale deploy steps.', 20, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_cache_127', '2026-06-02b', 'pwa', 'Index and service worker use the same cache marker', 'passed', 'server-worker.js', '2026-06-02b', 'Hard-refresh after deployment and check service worker cache.', 'Browsers can keep stale repaired code.', 30, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('manifest_smoke_127', '2026-06-02b', 'testing', 'Repo smoke script checks schema 127 guardrails', 'passed', 'scripts/repo-smoke-check.mjs', 'schema-has-127', 'Run node scripts/repo-smoke-check.mjs before packaging.', 'Deployment regressions may reach Supabase first.', 40, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (manifest_key) do update set
  release_label = excluded.release_label,
  manifest_area = excluded.manifest_area,
  manifest_title = excluded.manifest_title,
  manifest_status = excluded.manifest_status,
  file_path = excluded.file_path,
  expected_marker = excluded.expected_marker,
  verification_hint = excluded.verification_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority,
  source_doc, route_hint, implementation_notes, acceptance_check, risk_if_skipped,
  sort_order, metadata, checked_at
)
values
  ('schema127_01_archive_snapshot', 'completed_this_pass', 1, 'repo hygiene', 'Archive schema 126 active Markdown before editing', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Created archive/markdown-current-snapshot-2026-06-02a with active root docs before this pass.', 'Snapshot contains README and active docs.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 1, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_02_retire_root_docs', 'completed_this_pass', 2, 'repo hygiene', 'Retire legacy prompt/runbook root Markdown again', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Moved legacy root docs into archive so root remains clean.', 'Smoke confirms retired docs are not in root.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 2, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_03_retire_test_files', 'completed_this_pass', 3, 'repo hygiene', 'Retire test_write files again', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Moved uploaded root test_write files to archive.', 'Smoke confirms test_write files are not active.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 3, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_04_schema_migration', 'completed_this_pass', 4, 'schema', 'Add schema 127 migration', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added public route SEO, link, CSS token, mobile action, and release manifest guardrails.', 'Migration file exists and drift expects 127.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 4, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_05_schema_reference', 'completed_this_pass', 5, 'schema', 'Update full schema reference through 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Appended schema 127 to canonical schema reference.', 'Full reference includes schema 127 marker.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 5, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_06_route_seo_registry', 'completed_this_pass', 6, 'seo', 'Add DB route-level SEO registry', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_public_route_seo_registry for title/H1/meta/local/proof/internal-link status.', 'v_app_public_route_seo_registry is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 6, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_07_internal_links', 'completed_this_pass', 7, 'seo', 'Add internal-link suggestion queue', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_internal_link_suggestion_queue for service/location/proof/contact link suggestions.', 'v_app_internal_link_suggestion_queue is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 7, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_08_css_tokens', 'completed_this_pass', 8, 'css', 'Add CSS component token inventory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_css_component_token_inventory for repeatable component/token review.', 'v_app_css_component_token_inventory is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 8, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_09_mobile_actions', 'completed_this_pass', 9, 'mobile', 'Add mobile field action queue', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_mobile_field_action_queue for phone-first scan/proof actions.', 'v_app_mobile_field_action_queue is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 9, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_10_release_manifest', 'completed_this_pass', 10, 'deployment', 'Add release manifest checks', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_release_manifest_checks to track SQL/docs/cache/smoke packaging pieces.', 'v_app_release_manifest_checks is visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 10, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_11_admin_directory', 'completed_this_pass', 11, 'admin ui', 'Load schema 127 views in admin-directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin command_center and health scopes return schema 127 arrays.', 'admin-directory source includes all schema 127 views.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 11, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_12_admin_ui_state', 'completed_this_pass', 12, 'admin ui', 'Store schema 127 arrays in Admin UI state', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added Admin state keys and payload mapping for new arrays.', 'Admin UI source includes schema 127 state names.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 12, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_13_admin_ui_tables', 'completed_this_pass', 13, 'admin ui', 'Render route SEO, links, CSS, mobile, and release rows', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Production Readiness now has compact tables for schema 127 views.', 'Admin UI has table IDs and render bodies.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 13, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_14_cache_marker', 'completed_this_pass', 14, 'pwa', 'Update cache marker to 2026-06-02b', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Updated index query strings and service worker cache version.', 'Smoke checks 2026-06-02b marker.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 14, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_15_smoke_current', 'completed_this_pass', 15, 'testing', 'Update smoke expectations to schema 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Smoke now checks schema 127 marker, views, admin loading, and cache version.', 'node scripts/repo-smoke-check.mjs passes.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 15, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_16_markdown_root', 'completed_this_pass', 16, 'documentation', 'Refresh root Markdown for schema 127', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Updated roadmap, issues, database, deployment, project, status, and checklist docs.', 'Root docs mention schema 127.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 16, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_17_docs_page', 'completed_this_pass', 17, 'documentation', 'Add schema 127 implementation doc', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added docs/PUBLIC_ROUTE_SEO_INTERNAL_LINK_CSS_MOBILE_SCHEMA127.md.', 'Schema 127 doc is present.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 17, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_18_seo_direction', 'completed_this_pass', 18, 'seo', 'Carry local SEO rules forward', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Documented one H1, plain local wording, internal links, and proof-level status.', 'SEO gaps now tie to route registry.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 18, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_19_mobile_depth', 'completed_this_pass', 19, 'mobile', 'Carry phone-first scan/proof depth forward', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Mobile action queue documents checkout/arrival/return/proof actions.', 'Mobile next steps are DB-visible.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 19, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_20_next20', 'completed_this_pass', 20, 'roadmap', 'Add the next 20 roadmap steps after this pass', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Roadmap and DB rows now list the next implementation targets.', 'v_app_roadmap_action_steps has next_20 rows.', 'This step can drift if Markdown, schema, and Admin readiness are not kept in sync.', 20, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_01', 'next_20', 1, 'accounting', 'Build payment application UI actions for apply/reverse/approve', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Create buttons and Edge Function actions for invoice/deposit/credit/write-off/overpayment application.', 'Payment application rows can be acted on from Jobs/Admin.', 'Leaving this gap open keeps the workflow partly manual.', 101, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_02', 'next_20', 2, 'accounting', 'Add bank CSV import preview screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Preview parsed rows, bad dates, duplicate candidates, rejected rows, and amount signs before staging.', 'Bank CSV preview can reject unsafe imports.', 'Leaving this gap open keeps the workflow partly manual.', 102, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_03', 'next_20', 3, 'accounting', 'Add reconciliation manual match and undo actions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Support match, split match, unmatch, reviewer notes, and final signoff.', 'Reconciliation review no longer requires manual DB editing.', 'Leaving this gap open keeps the workflow partly manual.', 103, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_04', 'next_20', 4, 'accounting', 'Finish HST/GST filing proof workflow', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add upload proof, source totals, adjustment notes, filed/remitted dates, and lock state.', 'Sales tax filing rows have evidence and status.', 'Leaving this gap open keeps the workflow partly manual.', 104, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_05', 'next_20', 5, 'accounting', 'Finish payroll remittance proof workflow', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Link payroll source runs, deductions/employer costs, proof, payment date, and close period.', 'Payroll remittance rows can be reviewed and signed off.', 'Leaving this gap open keeps the workflow partly manual.', 105, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_06', 'next_20', 6, 'accounting', 'Finish month-end close lock/reopen controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Block postings to closed periods and record reopen reason/signoff.', 'Closed periods prevent accidental posting.', 'Leaving this gap open keeps the workflow partly manual.', 106, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_07', 'next_20', 7, 'accounting', 'Package accountant export files', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate manifest, CSV/JSON summaries, proof list, delivery status, and resend record.', 'Accountant handoff package is complete.', 'Leaving this gap open keeps the workflow partly manual.', 107, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_08', 'next_20', 8, 'equipment', 'Add real QR/barcode scan buttons', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Use device camera/BarcodeDetector where supported, with manual fallback prompt.', 'Phone user can scan equipment labels into the selected field.', 'Leaving this gap open keeps the workflow partly manual.', 108, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_09', 'next_20', 9, 'equipment', 'Create reusable accessory checklist templates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Move category/pool checklist templates from free text to DB rows.', 'Checklist can auto-load by pool/category.', 'Leaving this gap open keeps the workflow partly manual.', 109, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_10', 'next_20', 10, 'equipment', 'Enforce verifier role server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Block final return verification, defect clearing, and return-to-service below required role.', 'Lower-role users cannot clear locked-out equipment.', 'Leaving this gap open keeps the workflow partly manual.', 110, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_11', 'next_20', 11, 'equipment', 'Convert failed tests into service work orders', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Promote failed arrival/return tasks to assigned work orders with cost and proof.', 'Service tasks have owner, due date, evidence, and cost.', 'Leaving this gap open keeps the workflow partly manual.', 111, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_12', 'next_20', 12, 'jobs', 'Roll up detailed cost categories into profitability', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Include repair, delay, equipment usage, replacement, fuel, disposal, materials, and subcontractors.', 'Job profitability matches source costs.', 'Leaving this gap open keeps the workflow partly manual.', 112, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_13', 'next_20', 13, 'jobs', 'Carry quote acceptance terms into invoice candidates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Accepted terms should populate invoice candidates without retyping.', 'Invoice candidates retain accepted pricing terms.', 'Leaving this gap open keeps the workflow partly manual.', 113, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_14', 'next_20', 14, 'seo', 'Populate public route SEO registry from actual routes', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate route rows from active route list and fail missing title/H1/meta/local terms.', 'SEO registry reflects actual public pages.', 'Leaving this gap open keeps the workflow partly manual.', 114, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_15', 'next_20', 15, 'seo', 'Build internal-link review UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Approve or dismiss link suggestions between service/location/proof/contact pages.', 'Internal link suggestions can be managed in Admin.', 'Leaving this gap open keeps the workflow partly manual.', 115, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_16', 'next_20', 16, 'mobile', 'Add Today dashboard scan/proof buttons', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add quick buttons for scan equipment, add proof, review exceptions, and resume drafts.', 'Phone users reach common field actions in one tap.', 'Leaving this gap open keeps the workflow partly manual.', 116, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_17', 'next_20', 17, 'offline', 'Improve offline conflict review language', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Add clearer retry/keep local/discard local choices and sync explanations.', 'Offline errors are understandable.', 'Leaving this gap open keeps the workflow partly manual.', 117, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_18', 'next_20', 18, 'css', 'Create reusable CSS token classes', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Move repeated cards/pills/tables/notices toward named component classes.', 'Fewer one-off inline styles.', 'Leaving this gap open keeps the workflow partly manual.', 118, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_19', 'next_20', 19, 'deployment', 'Add release manifest file generation', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Generate a build manifest Markdown/JSON from schema, docs, code, and smoke results.', 'Each zip includes a release manifest.', 'Leaving this gap open keeps the workflow partly manual.', 119, '{"build":"2026-06-02b","schema":127}'::jsonb, now()),
  ('schema127_next_20', 'next_20', 20, 'testing', 'Add sitemap/robots/link/image-alt smoke checks', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Extend smoke checks for public SEO files, broken links, robots, sitemap, and alt text.', 'Public SEO regressions fail before packaging.', 'Leaving this gap open keeps the workflow partly manual.', 120, '{"build":"2026-06-02b","schema":127}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  implementation_notes = excluded.implementation_notes,
  acceptance_check = excluded.acceptance_check,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_data_migration_candidates (
  candidate_key, data_area, source_location, recommended_target, duplication_risk,
  migration_status, reason, fallback_plan, acceptance_check, sort_order, metadata, checked_at
)
values
  ('schema127_public_route_seo_registry', 'seo', 'index.html / future public route copy', 'app_public_route_seo_registry with generated static fallback', 'medium', 'in_progress', 'Public SEO title/H1/meta/local terms need one reviewed source of truth.', 'Static index.html title/meta and smoke checks remain fallback.', 'Route registry rows exist before adding more public pages.', 15, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_css_token_inventory', 'css', 'style.css and inline component styles', 'app_css_component_token_inventory plus reusable CSS classes', 'medium', 'review', 'CSS drift grows when repeated component styles are one-off.', 'Existing style.css remains source until tokens are implemented.', 'Token inventory covers tables, notices, pills, and mobile quick nav.', 25, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_release_manifest', 'deployment', 'Markdown deploy notes and smoke script output', 'app_release_manifest_checks plus generated release manifest files', 'low', 'in_progress', 'Each zip needs a clear schema/docs/cache/smoke summary.', 'Final assistant summary and docs remain fallback.', 'Release manifest checks are DB-visible.', 35, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (candidate_key) do update set
  data_area = excluded.data_area,
  source_location = excluded.source_location,
  recommended_target = excluded.recommended_target,
  duplication_risk = excluded.duplication_risk,
  migration_status = excluded.migration_status,
  reason = excluded.reason,
  fallback_plan = excluded.fallback_plan,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_schema_documentation_sync_checks (
  check_key, check_area, check_title, expected_status, current_status,
  file_path, test_command, failure_hint, sort_order, metadata, checked_at
)
values
  ('schema127_sql_reference_sync', 'schema', 'Schema 127 migration and full reference are synchronized', 'required', 'passed', 'sql/000_full_schema_reference.sql', 'node scripts/repo-smoke-check.mjs', 'Apply schema 127 before deploying Admin views.', 15, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_markdown_sync', 'documentation', 'Roadmap, issues, deployment, database, and checklist docs mention schema 127', 'required', 'passed', 'DEVELOPMENT_ROADMAP.md', 'manual review', 'Docs may direct the next pass to the wrong feature set.', 25, '{"build":"2026-06-02b"}'::jsonb, now()),
  ('schema127_cache_sync', 'pwa', 'Index and service worker cache markers match 2026-06-02b', 'required', 'passed', 'server-worker.js', 'node scripts/repo-smoke-check.mjs', 'A stale browser cache can hide new code.', 35, '{"build":"2026-06-02b"}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  file_path = excluded.file_path,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_public_route_seo_registry;
create view public.v_app_public_route_seo_registry as
select
  route_key, route_path, route_label, page_title, h1_text, meta_description,
  array_to_string(primary_local_terms, ', ') as primary_local_terms,
  array_to_string(secondary_search_terms, ', ') as secondary_search_terms,
  proof_status, title_status, h1_status, meta_status, image_alt_status,
  internal_link_status, structured_data_status, publish_status,
  local_wording_notes, fallback_hint, sort_order, checked_at, updated_at
from public.app_public_route_seo_registry
order by sort_order, route_key;

drop view if exists public.v_app_internal_link_suggestion_queue;
create view public.v_app_internal_link_suggestion_queue as
select
  q.suggestion_key,
  q.link_context,
  q.suggested_anchor_text,
  q.suggestion_status,
  src.route_path as source_route_path,
  src.route_label as source_route_label,
  tgt.route_path as target_route_path,
  tgt.route_label as target_route_label,
  q.seo_reason,
  q.proof_reason,
  q.fallback_plan,
  q.sort_order,
  q.checked_at,
  q.updated_at
from public.app_internal_link_suggestion_queue q
left join public.app_public_route_seo_registry src on src.route_key = q.source_route_key
left join public.app_public_route_seo_registry tgt on tgt.route_key = q.target_route_key
order by q.sort_order, q.suggestion_key;

drop view if exists public.v_app_css_component_token_inventory;
create view public.v_app_css_component_token_inventory as
select
  token_key, component_area, token_name, token_purpose, current_source,
  recommended_class_name, drift_risk, token_status, mobile_check_hint,
  fallback_hint, sort_order, checked_at, updated_at
from public.app_css_component_token_inventory
order by sort_order, token_key;

drop view if exists public.v_app_mobile_field_action_queue;
create view public.v_app_mobile_field_action_queue as
select
  action_key, action_area, action_title, action_status, required_role,
  route_hint, offline_support_status, scan_or_proof_hint, fallback_hint,
  sort_order, checked_at, updated_at
from public.app_mobile_field_action_queue
order by sort_order, action_key;

drop view if exists public.v_app_release_manifest_checks;
create view public.v_app_release_manifest_checks as
select
  manifest_key, release_label, manifest_area, manifest_title, manifest_status,
  file_path, expected_marker, verification_hint, failure_hint,
  sort_order, checked_at, updated_at
from public.app_release_manifest_checks
order by sort_order, manifest_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  127::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 127 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 127
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 127.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  127,
  '127_public_route_seo_internal_link_css_mobile_guardrails',
  '127_public_route_seo_internal_link_css_mobile_guardrails.sql',
  '2026-06-02b',
  'Adds route-level SEO registry, internal link suggestion queue, CSS token inventory, mobile field action queue, release manifest checks, and refreshed roadmap/data-migration/sync rows.',
  'applied',
  'This pass cleans uploaded archive/test drift again, updates cache marker, exposes schema 127 readiness views, and records the next 20 roadmap steps.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_public_route_seo_registry to authenticated;
grant select on public.app_internal_link_suggestion_queue to authenticated;
grant select on public.app_css_component_token_inventory to authenticated;
grant select on public.app_mobile_field_action_queue to authenticated;
grant select on public.app_release_manifest_checks to authenticated;
grant select on public.v_app_public_route_seo_registry to authenticated;
grant select on public.v_app_internal_link_suggestion_queue to authenticated;
grant select on public.v_app_css_component_token_inventory to authenticated;
grant select on public.v_app_mobile_field_action_queue to authenticated;
grant select on public.v_app_release_manifest_checks to authenticated;
grant select on public.v_app_roadmap_action_steps to authenticated;
grant select on public.v_app_data_migration_candidates to authenticated;
grant select on public.v_app_schema_documentation_sync_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
