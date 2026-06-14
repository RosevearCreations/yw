-- Schema 145: Application sanity check, value-added modification priorities,
-- desktop/mobile parity, visual professional enrichment, local-search value,
-- and source-of-truth migration controls.
-- Build 2026-06-13a.
--
-- Purpose:
-- 1. Capture the sanity-check findings as DB-visible Admin readiness queues.
-- 2. Separate production-readiness gaps from value-added enhancements.
-- 3. Keep desktop website, mobile field app, local SEO, CSS, runtime fallback,
--    visual polish, and JSON/DB source consolidation moving together.

begin;

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_roadmap_action_steps (
  step_key text primary key,
  step_batch text not null default 'next_20',
  step_number integer not null default 0,
  step_area text not null default 'general',
  step_title text not null default 'Roadmap action',
  step_status text not null default 'planned',
  priority text not null default 'medium',
  source_doc text,
  route_hint text,
  implementation_notes text,
  acceptance_check text,
  risk_if_skipped text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_roadmap_action_steps add column if not exists step_batch text not null default 'next_20';
alter table public.app_roadmap_action_steps add column if not exists step_number integer not null default 0;
alter table public.app_roadmap_action_steps add column if not exists step_area text not null default 'general';
alter table public.app_roadmap_action_steps add column if not exists step_title text not null default 'Roadmap action';
alter table public.app_roadmap_action_steps add column if not exists step_status text not null default 'planned';
alter table public.app_roadmap_action_steps add column if not exists priority text not null default 'medium';
alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists sort_order integer not null default 100;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_batch_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check check (step_batch in ('completed_this_pass','next_20'));
alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check check (step_status in ('completed','in_progress','planned','blocked','review'));

create table if not exists public.app_sanity_check_snapshot_queue (
  snapshot_key text primary key,
  snapshot_area text not null default 'sanity',
  snapshot_title text not null default 'Application sanity snapshot',
  snapshot_status text not null default 'review',
  current_state_hint text,
  value_added_hint text,
  next_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_sanity_check_snapshot_queue add column if not exists snapshot_area text not null default 'sanity';
alter table public.app_sanity_check_snapshot_queue add column if not exists snapshot_title text not null default 'Application sanity snapshot';
alter table public.app_sanity_check_snapshot_queue add column if not exists snapshot_status text not null default 'review';
alter table public.app_sanity_check_snapshot_queue add column if not exists current_state_hint text;
alter table public.app_sanity_check_snapshot_queue add column if not exists value_added_hint text;
alter table public.app_sanity_check_snapshot_queue add column if not exists next_action_hint text;
alter table public.app_sanity_check_snapshot_queue add column if not exists fallback_hint text;
alter table public.app_sanity_check_snapshot_queue add column if not exists sort_order integer not null default 100;
alter table public.app_sanity_check_snapshot_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_sanity_check_snapshot_queue add column if not exists checked_at timestamptz;
alter table public.app_sanity_check_snapshot_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_value_added_modification_queue (
  modification_key text primary key,
  value_area text not null default 'value_added',
  modification_title text not null default 'Value-added modification',
  modification_status text not null default 'planned',
  customer_value_hint text,
  operator_value_hint text,
  build_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_value_added_modification_queue add column if not exists value_area text not null default 'value_added';
alter table public.app_value_added_modification_queue add column if not exists modification_title text not null default 'Value-added modification';
alter table public.app_value_added_modification_queue add column if not exists modification_status text not null default 'planned';
alter table public.app_value_added_modification_queue add column if not exists customer_value_hint text;
alter table public.app_value_added_modification_queue add column if not exists operator_value_hint text;
alter table public.app_value_added_modification_queue add column if not exists build_hint text;
alter table public.app_value_added_modification_queue add column if not exists fallback_hint text;
alter table public.app_value_added_modification_queue add column if not exists sort_order integer not null default 100;
alter table public.app_value_added_modification_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_value_added_modification_queue add column if not exists checked_at timestamptz;
alter table public.app_value_added_modification_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_desktop_mobile_value_gap_queue (
  gap_key text primary key,
  surface_area text not null default 'desktop_mobile',
  gap_title text not null default 'Desktop/mobile value gap',
  gap_status text not null default 'planned',
  desktop_hint text,
  mobile_hint text,
  parity_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_desktop_mobile_value_gap_queue add column if not exists surface_area text not null default 'desktop_mobile';
alter table public.app_desktop_mobile_value_gap_queue add column if not exists gap_title text not null default 'Desktop/mobile value gap';
alter table public.app_desktop_mobile_value_gap_queue add column if not exists gap_status text not null default 'planned';
alter table public.app_desktop_mobile_value_gap_queue add column if not exists desktop_hint text;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists mobile_hint text;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists parity_action_hint text;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists fallback_hint text;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists sort_order integer not null default 100;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists checked_at timestamptz;
alter table public.app_desktop_mobile_value_gap_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_visual_professional_backlog_queue (
  backlog_key text primary key,
  visual_area text not null default 'visual_polish',
  backlog_title text not null default 'Visual professional backlog item',
  backlog_status text not null default 'planned',
  visual_effect_hint text,
  image_or_asset_hint text,
  accessibility_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_visual_professional_backlog_queue add column if not exists visual_area text not null default 'visual_polish';
alter table public.app_visual_professional_backlog_queue add column if not exists backlog_title text not null default 'Visual professional backlog item';
alter table public.app_visual_professional_backlog_queue add column if not exists backlog_status text not null default 'planned';
alter table public.app_visual_professional_backlog_queue add column if not exists visual_effect_hint text;
alter table public.app_visual_professional_backlog_queue add column if not exists image_or_asset_hint text;
alter table public.app_visual_professional_backlog_queue add column if not exists accessibility_hint text;
alter table public.app_visual_professional_backlog_queue add column if not exists fallback_hint text;
alter table public.app_visual_professional_backlog_queue add column if not exists sort_order integer not null default 100;
alter table public.app_visual_professional_backlog_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_visual_professional_backlog_queue add column if not exists checked_at timestamptz;
alter table public.app_visual_professional_backlog_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_local_search_value_queue (
  search_key text primary key,
  route_key text,
  search_area text not null default 'local_search',
  search_title text not null default 'Local search value item',
  search_status text not null default 'planned',
  phrase_hint text,
  proof_hint text,
  conversion_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_local_search_value_queue add column if not exists route_key text;
alter table public.app_local_search_value_queue add column if not exists search_area text not null default 'local_search';
alter table public.app_local_search_value_queue add column if not exists search_title text not null default 'Local search value item';
alter table public.app_local_search_value_queue add column if not exists search_status text not null default 'planned';
alter table public.app_local_search_value_queue add column if not exists phrase_hint text;
alter table public.app_local_search_value_queue add column if not exists proof_hint text;
alter table public.app_local_search_value_queue add column if not exists conversion_hint text;
alter table public.app_local_search_value_queue add column if not exists fallback_hint text;
alter table public.app_local_search_value_queue add column if not exists sort_order integer not null default 100;
alter table public.app_local_search_value_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_local_search_value_queue add column if not exists checked_at timestamptz;
alter table public.app_local_search_value_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_source_of_truth_migration_value_queue (
  source_key text primary key,
  source_area text not null default 'source_of_truth',
  source_title text not null default 'Source-of-truth migration value item',
  source_status text not null default 'planned',
  current_source_hint text,
  target_source_hint text,
  migration_priority_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_source_of_truth_migration_value_queue add column if not exists source_area text not null default 'source_of_truth';
alter table public.app_source_of_truth_migration_value_queue add column if not exists source_title text not null default 'Source-of-truth migration value item';
alter table public.app_source_of_truth_migration_value_queue add column if not exists source_status text not null default 'planned';
alter table public.app_source_of_truth_migration_value_queue add column if not exists current_source_hint text;
alter table public.app_source_of_truth_migration_value_queue add column if not exists target_source_hint text;
alter table public.app_source_of_truth_migration_value_queue add column if not exists migration_priority_hint text;
alter table public.app_source_of_truth_migration_value_queue add column if not exists fallback_hint text;
alter table public.app_source_of_truth_migration_value_queue add column if not exists sort_order integer not null default 100;
alter table public.app_source_of_truth_migration_value_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_source_of_truth_migration_value_queue add column if not exists checked_at timestamptz;
alter table public.app_source_of_truth_migration_value_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_sanity_check_snapshot_queue (snapshot_key, snapshot_area, snapshot_title, snapshot_status, current_state_hint, value_added_hint, next_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('platform_architecture_snapshot','architecture','Application is broad and mature, but still needs fewer queue-only features and more write flows','review','The build has desktop website shell, mobile field app navigation, Admin readiness, Supabase Edge Functions, extensive SQL migrations, PWA/offline shell, safety/jobs/equipment/accounting/reporting modules, and schema smoke checks.','The strongest value now comes from turning tracked readiness rows into real actions: payment posting, reconciliation matching, equipment custody, local SEO route publishing, visual asset approval, and fallback telemetry.','Prioritize five operational write flows before adding many more passive queues.','Keep Admin readiness queues visible as fallback when write screens are not complete.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('deployment_hygiene_snapshot','release','Release hygiene is mostly strong once root helper/test files are archived','completed','Smoke checks catch one-H1, CSS brace balance, cache marker freshness, schema markers, Admin view wiring, and public visual strip presence.','Root hygiene cleanup increases deployment confidence and avoids false failures.','Keep archive cleanup automated in every pass.','If helper files reappear, archive them before schema work.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('seo_visual_snapshot','seo_visual','Public SEO and visual polish are improving but still need proof-backed service-area pages','in_progress','The public shell has one H1, local Southern Ontario wording, static sitemap/robots, and CSS-only professional strips.','Value increases when route-level trust proof, job photos, service pages, FAQ, and conversion CTAs are approved and linked.','Create route proof registry and approved asset registry before expanding sitemap.','Keep only the homepage in sitemap until route proof is strong.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (snapshot_key) do update set snapshot_area=excluded.snapshot_area, snapshot_title=excluded.snapshot_title, snapshot_status=excluded.snapshot_status, current_state_hint=excluded.current_state_hint, value_added_hint=excluded.value_added_hint, next_action_hint=excluded.next_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_value_added_modification_queue (modification_key, value_area, modification_title, modification_status, customer_value_hint, operator_value_hint, build_hint, fallback_hint, sort_order, metadata, checked_at) values
('customer_quote_booking_path','public_conversion','Add a clear public quote/request path with proof-backed service choices','planned','Visitors can understand services, trust proof, and request a quote without hunting through the app.','Admin gets cleaner intake records instead of scattered calls/messages.','Start with a simple contact/quote form and service-area proof cards, then connect to CRM/jobs.','Keep phone/email CTA as fallback until form write path is live.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('payment_recon_action_buttons','accounting','Turn payment/reconciliation queues into apply, split, reverse, approve, and export actions','planned','Customers and business owner see cleaner account balances and fewer manual follow-ups.','Accounting close becomes auditable and less spreadsheet-heavy.','Build Edge write actions with approval reason, proof attachment, period lock, and undo trail.','Keep exception export until posting actions are proven.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('equipment_custody_camera_flow','field_operations','Add camera/QR equipment custody flow with manual fallback','planned','Jobs have stronger proof of equipment accountability and service quality.','Crews can check out/arrive/return equipment quickly with fewer missed accessories.','Use BarcodeDetector when available and manual code entry everywhere.','Keep paper/typed code fallback for poor camera/browser support.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (modification_key) do update set value_area=excluded.value_area, modification_title=excluded.modification_title, modification_status=excluded.modification_status, customer_value_hint=excluded.customer_value_hint, operator_value_hint=excluded.operator_value_hint, build_hint=excluded.build_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_desktop_mobile_value_gap_queue (gap_key, surface_area, gap_title, gap_status, desktop_hint, mobile_hint, parity_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_desktop_mobile_split','admin_mobile','Clarify desktop Admin versus mobile field-app responsibilities','in_progress','Desktop is best for Admin readiness, accounting close, schema health, reporting, route/asset approval, and bulk review.','Mobile is best for Today actions, forms, GPS/photo/equipment proof, offline drafts, and crew task completion.','Add a surface map in Admin and docs so new features choose the right primary surface.','Let mobile show read-only summaries where full desktop workflows are too heavy.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('mobile_offline_conflict_ui','mobile','Finish mobile offline conflict choices','planned','Field users understand what happened when sync fails and do not lose work.','Supervisors can review retry/keep/reload/discard decisions.','Add conflict cards to forms and Today dashboard with persisted event logs.','Keep local draft until a server ack or confirmed discard.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('desktop_reporting_drilldowns','desktop','Add desktop drilldowns for readiness queues and job/accounting rollups','planned','Owners can see what needs action without reading raw queue tables.','Admin can turn each queue row into an action, export, or proof upload.','Build summary cards and filters by area/status/owner/date.','Keep existing queue tables as fallback.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (gap_key) do update set surface_area=excluded.surface_area, gap_title=excluded.gap_title, gap_status=excluded.gap_status, desktop_hint=excluded.desktop_hint, mobile_hint=excluded.mobile_hint, parity_action_hint=excluded.parity_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_visual_professional_backlog_queue (backlog_key, visual_area, backlog_title, backlog_status, visual_effect_hint, image_or_asset_hint, accessibility_hint, fallback_hint, sort_order, metadata, checked_at) values
('approved_job_photo_gallery','public_visuals','Add approved job-photo gallery cards once consent/proof gates exist','planned','Real work photos increase credibility and help local visitors understand value.','Admin controls publication, alt text, compression, route assignment, and consent.','Create asset registry with approved/hold/archive states before publishing images.','Use CSS proof cards until approved photos exist.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('micro_interaction_motion','ui_polish','Add subtle motion and hover states with reduced-motion fallback','planned','The app feels sharper and more professional without hurting readability.','Operators get clearer state changes on cards, buttons, and status pills.','Use CSS transitions only where they support clarity and respect prefers-reduced-motion.','Disable motion under reduced-motion or low-power conditions.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('dashboard_visual_hierarchy','admin_visuals','Improve Admin dashboard visual hierarchy with scorecards and progress rails','planned','Business owner sees status, blockers, and value quickly.','Operators can prioritize work by severity and next action.','Add status scorecards, progress rails, and section-level action buttons.','Keep table-first layout as fallback.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (backlog_key) do update set visual_area=excluded.visual_area, backlog_title=excluded.backlog_title, backlog_status=excluded.backlog_status, visual_effect_hint=excluded.visual_effect_hint, image_or_asset_hint=excluded.image_or_asset_hint, accessibility_hint=excluded.accessibility_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_search_value_queue (search_key, route_key, search_area, search_title, search_status, phrase_hint, proof_hint, conversion_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_local_value_terms','/','homepage','Tighten homepage local service wording around real service area and value','in_progress','Southern Ontario, OHSA safety, mobile field app, jobs, crews, equipment, inspections, and reporting.','Proof should explain what the app does and who it helps, without unsupported location claims.','CTA should point to quote/contact or login depending on visitor type.','Use homepage only until route proof grows.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('service_page_candidate_registry','service_pages','service_page_candidates','Create proof-backed service-page candidates before adding sitemap URLs','planned','Use terms people search for in title/H1/body only where the service and location are real.','Require proof, photos/assets, internal links, and CTA before route publication.','Approved pages connect to quote/contact and related proof sections.','Keep candidate route unpublished if proof is weak.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('trust_faq_internal_links','trust_content','faq_internal_links','Add trust FAQ and internal links that support decisions, not just ranking','planned','Questions about safety compliance, mobile field forms, equipment accountability, and reporting.','Answers need proof, plain language, and no overclaiming.','Links should lead to quote/contact, service proof, or login.','Hold FAQ in draft if answers are not business-approved.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (search_key) do update set route_key=excluded.route_key, search_area=excluded.search_area, search_title=excluded.search_title, search_status=excluded.search_status, phrase_hint=excluded.phrase_hint, proof_hint=excluded.proof_hint, conversion_hint=excluded.conversion_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_source_of_truth_migration_value_queue (source_key, source_area, source_title, source_status, current_source_hint, target_source_hint, migration_priority_hint, fallback_hint, sort_order, metadata, checked_at) values
('public_route_registry','seo_routes','Move sitemap/public route approval from static files to DB registry','planned','Static sitemap/robots and manually maintained route assumptions.','Approved public route registry with proof, title/meta/H1, route status, and publish gates.','High priority because SEO and navigation can drift.','Keep static sitemap until generated output is tested.',10,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('visual_asset_registry','visual_assets','Move visual asset publication decisions into DB','planned','CSS-only strips and future image decisions in docs/checklists.','Visual asset registry with asset URL, alt text, consent/proof, compression, route assignment, and publish status.','High priority before adding real images.','Use CSS-only proof cards until registry is live.',20,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('readiness_action_registry','admin_readiness','Move repeated roadmap queues toward actionable registry records','in_progress','Many readiness queues document needs but do not yet execute workflows.','Action registry with owner, write action, proof requirement, severity, and completion audit.','Medium/high priority after payment/equipment write paths.','Keep current queues as read-only fallback.',30,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (source_key) do update set source_area=excluded.source_area, source_title=excluded.source_title, source_status=excluded.source_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, migration_priority_hint=excluded.migration_priority_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema145_done_01','completed_this_pass',1,'sanity_check','Added schema 145 sanity-check and value-added queues','completed','high','docs/SCHEMA_145_SANITY_CHECK_VALUE_ADDED_BREAKDOWN.md','#admin','Schema 145 migration and full schema include sanity/value queues and views.','The sanity check becomes trackable in Admin readiness instead of only living in chat.','Sanity findings get lost after the conversation.',1,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_done_02','completed_this_pass',2,'docs','Added a detailed sanity-check Markdown breakdown','completed','high','docs/SCHEMA_145_SANITY_CHECK_VALUE_ADDED_BREAKDOWN.md','docs','Markdown captures current state, strengths, gaps, and value-added next steps.','Future passes can continue from a clear status baseline.','Next work may chase low-value items.',2,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_done_03','completed_this_pass',3,'cleanup','Archived root helper Markdown and test_write files','completed','high','TESTING_CHECKLIST.md','archive','Smoke root hygiene checks pass.','Keeps deploy root clean.','Smoke fails before useful checks.',3,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_done_04','completed_this_pass',4,'public_shell','Added value-map visual strip to public shell','completed','medium','DEVELOPMENT_ROADMAP.md','/','Index keeps one H1 and adds CSS-only value map.','Public shell communicates operational value without unapproved images.','Site can look less polished than the app depth deserves.',4,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_done_05','completed_this_pass',5,'cache_seo','Updated cache marker and sitemap freshness for 2026-06-13a','completed','high','DEPLOYMENT_GUIDE.md','/','Index/service worker/sitemap are current.','Users see current visual/docs work after hard refresh.','Old cache can hide updates.',5,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_next_01','next_20',1,'accounting','Build the first real payment application/reversal Edge write flow','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply/reverse/refund/write off with proof, reason, period check, and audit row.','This is the highest-value accounting action remaining.','Payment queues remain passive.',101,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_next_02','next_20',2,'reconciliation','Build bank CSV upload preview and match/split/undo workflow','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can stage CSV, reject bad rows, match rows, split rows, undo, and export exceptions.','Month-end close becomes more practical.','Reconciliation stays spreadsheet-heavy.',102,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_next_03','next_20',3,'equipment','Build QR/barcode equipment custody action flow','planned','high','DEVELOPMENT_ROADMAP.md','#equipment','Mobile supports camera scan plus manual fallback for checkout, arrival, return, and service release.','Equipment accountability becomes field-usable.','Custody remains checklist-only.',103,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_next_04','next_20',4,'seo_visual','Create approved visual asset and public route registries','planned','high','KNOWN_ISSUES_AND_GAPS.md','/','Images/routes need proof, alt text, compression, title/meta/H1, CTA, and publish status before sitemap inclusion.','Professional SEO can scale safely.','Unapproved pages/images can dilute trust.',104,'{"build":"2026-06-13a","schema":145}'::jsonb,now()),
('schema145_next_05','next_20',5,'mobile','Finish offline conflict cards and persisted fallback event logs','planned','medium','TESTING_CHECKLIST.md','#today','Mobile users can retry/keep/reload/discard drafts and Admin can review fallback events.','Field reliability improves under poor signal.','Failed sync remains confusing.',105,'{"build":"2026-06-13a","schema":145}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_sanity_check_snapshot_queue;
create view public.v_app_sanity_check_snapshot_queue as select snapshot_key, snapshot_area, snapshot_title, snapshot_status, current_state_hint, value_added_hint, next_action_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_sanity_check_snapshot_queue order by sort_order, snapshot_key;

drop view if exists public.v_app_value_added_modification_queue;
create view public.v_app_value_added_modification_queue as select modification_key, value_area, modification_title, modification_status, customer_value_hint, operator_value_hint, build_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_value_added_modification_queue order by sort_order, modification_key;

drop view if exists public.v_app_desktop_mobile_value_gap_queue;
create view public.v_app_desktop_mobile_value_gap_queue as select gap_key, surface_area, gap_title, gap_status, desktop_hint, mobile_hint, parity_action_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_desktop_mobile_value_gap_queue order by sort_order, gap_key;

drop view if exists public.v_app_visual_professional_backlog_queue;
create view public.v_app_visual_professional_backlog_queue as select backlog_key, visual_area, backlog_title, backlog_status, visual_effect_hint, image_or_asset_hint, accessibility_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_visual_professional_backlog_queue order by sort_order, backlog_key;

drop view if exists public.v_app_local_search_value_queue;
create view public.v_app_local_search_value_queue as select search_key, route_key, search_area, search_title, search_status, phrase_hint, proof_hint, conversion_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_search_value_queue order by sort_order, search_key;

drop view if exists public.v_app_source_of_truth_migration_value_queue;
create view public.v_app_source_of_truth_migration_value_queue as select source_key, source_area, source_title, source_status, current_source_hint, target_source_hint, migration_priority_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_source_of_truth_migration_value_queue order by sort_order, source_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  145::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 145 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 145 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 145.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (145, '145_sanity_check_value_added_breakdown_and_enrichment_controls', '145_sanity_check_value_added_breakdown_and_enrichment_controls.sql', '2026-06-13a', 'Adds application sanity-check snapshot, value-added modification, desktop/mobile value-gap, visual professional backlog, local-search value, and source-of-truth migration queues.', 'applied', 'This pass captures the sanity-check review inside the database/admin readiness layer while keeping Markdown, schema references, SEO/H1, CSS, runtime fallback, and desktop/mobile value planning aligned.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_sanity_check_snapshot_queue to authenticated;
grant select on public.app_value_added_modification_queue to authenticated;
grant select on public.app_desktop_mobile_value_gap_queue to authenticated;
grant select on public.app_visual_professional_backlog_queue to authenticated;
grant select on public.app_local_search_value_queue to authenticated;
grant select on public.app_source_of_truth_migration_value_queue to authenticated;
grant select on public.v_app_sanity_check_snapshot_queue to authenticated;
grant select on public.v_app_value_added_modification_queue to authenticated;
grant select on public.v_app_desktop_mobile_value_gap_queue to authenticated;
grant select on public.v_app_visual_professional_backlog_queue to authenticated;
grant select on public.v_app_local_search_value_queue to authenticated;
grant select on public.v_app_source_of_truth_migration_value_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
