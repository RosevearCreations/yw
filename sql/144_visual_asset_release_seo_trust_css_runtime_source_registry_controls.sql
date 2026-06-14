-- Schema 144: Visual asset release, desktop/mobile polish, local SEO trust signals,
-- CSS visual regression, runtime fallback drills, and DB source-registry candidate controls.
-- Build 2026-06-12b.
--
-- Purpose:
-- 1. Continue visual/professional enrichment without relying on unapproved images.
-- 2. Keep desktop website and mobile field app surfaces aligned.
-- 3. Track local-search trust signals, CSS/image regression, fallback drills, and JSON/DB source moves.

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

create table if not exists public.app_visual_asset_publication_queue (
  asset_key text primary key,
  asset_area text not null default 'visual_assets',
  asset_title text not null default 'Visual asset publication control',
  asset_status text not null default 'planned',
  source_hint text,
  alt_text_hint text,
  performance_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_visual_asset_publication_queue add column if not exists asset_area text not null default 'visual_assets';
alter table public.app_visual_asset_publication_queue add column if not exists asset_title text not null default 'Visual asset publication control';
alter table public.app_visual_asset_publication_queue add column if not exists asset_status text not null default 'planned';
alter table public.app_visual_asset_publication_queue add column if not exists source_hint text;
alter table public.app_visual_asset_publication_queue add column if not exists alt_text_hint text;
alter table public.app_visual_asset_publication_queue add column if not exists performance_hint text;
alter table public.app_visual_asset_publication_queue add column if not exists fallback_hint text;
alter table public.app_visual_asset_publication_queue add column if not exists sort_order integer not null default 100;
alter table public.app_visual_asset_publication_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_visual_asset_publication_queue add column if not exists checked_at timestamptz;
alter table public.app_visual_asset_publication_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_desktop_mobile_release_polish_queue (
  polish_key text primary key,
  surface_area text not null default 'surface_polish',
  polish_title text not null default 'Desktop/mobile polish control',
  polish_status text not null default 'planned',
  desktop_hint text,
  mobile_hint text,
  visual_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_desktop_mobile_release_polish_queue add column if not exists surface_area text not null default 'surface_polish';
alter table public.app_desktop_mobile_release_polish_queue add column if not exists polish_title text not null default 'Desktop/mobile polish control';
alter table public.app_desktop_mobile_release_polish_queue add column if not exists polish_status text not null default 'planned';
alter table public.app_desktop_mobile_release_polish_queue add column if not exists desktop_hint text;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists mobile_hint text;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists visual_hint text;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists fallback_hint text;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists sort_order integer not null default 100;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists checked_at timestamptz;
alter table public.app_desktop_mobile_release_polish_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_local_seo_trust_signal_queue (
  trust_key text primary key,
  route_key text,
  trust_area text not null default 'local_seo',
  trust_title text not null default 'Local SEO trust signal control',
  trust_status text not null default 'planned',
  search_phrase_hint text,
  proof_hint text,
  internal_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_local_seo_trust_signal_queue add column if not exists route_key text;
alter table public.app_local_seo_trust_signal_queue add column if not exists trust_area text not null default 'local_seo';
alter table public.app_local_seo_trust_signal_queue add column if not exists trust_title text not null default 'Local SEO trust signal control';
alter table public.app_local_seo_trust_signal_queue add column if not exists trust_status text not null default 'planned';
alter table public.app_local_seo_trust_signal_queue add column if not exists search_phrase_hint text;
alter table public.app_local_seo_trust_signal_queue add column if not exists proof_hint text;
alter table public.app_local_seo_trust_signal_queue add column if not exists internal_link_hint text;
alter table public.app_local_seo_trust_signal_queue add column if not exists fallback_hint text;
alter table public.app_local_seo_trust_signal_queue add column if not exists sort_order integer not null default 100;
alter table public.app_local_seo_trust_signal_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_local_seo_trust_signal_queue add column if not exists checked_at timestamptz;
alter table public.app_local_seo_trust_signal_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_css_visual_regression_queue (
  regression_key text primary key,
  regression_area text not null default 'css_visual',
  regression_title text not null default 'CSS visual regression control',
  regression_status text not null default 'planned',
  selector_hint text,
  visual_test_hint text,
  accessibility_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_css_visual_regression_queue add column if not exists regression_area text not null default 'css_visual';
alter table public.app_css_visual_regression_queue add column if not exists regression_title text not null default 'CSS visual regression control';
alter table public.app_css_visual_regression_queue add column if not exists regression_status text not null default 'planned';
alter table public.app_css_visual_regression_queue add column if not exists selector_hint text;
alter table public.app_css_visual_regression_queue add column if not exists visual_test_hint text;
alter table public.app_css_visual_regression_queue add column if not exists accessibility_hint text;
alter table public.app_css_visual_regression_queue add column if not exists fallback_hint text;
alter table public.app_css_visual_regression_queue add column if not exists sort_order integer not null default 100;
alter table public.app_css_visual_regression_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_css_visual_regression_queue add column if not exists checked_at timestamptz;
alter table public.app_css_visual_regression_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_runtime_fallback_drill_queue (
  drill_key text primary key,
  app_surface text not null default 'app',
  drill_title text not null default 'Runtime fallback drill control',
  drill_status text not null default 'planned',
  trigger_hint text,
  user_message_hint text,
  operator_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_fallback_drill_queue add column if not exists app_surface text not null default 'app';
alter table public.app_runtime_fallback_drill_queue add column if not exists drill_title text not null default 'Runtime fallback drill control';
alter table public.app_runtime_fallback_drill_queue add column if not exists drill_status text not null default 'planned';
alter table public.app_runtime_fallback_drill_queue add column if not exists trigger_hint text;
alter table public.app_runtime_fallback_drill_queue add column if not exists user_message_hint text;
alter table public.app_runtime_fallback_drill_queue add column if not exists operator_action_hint text;
alter table public.app_runtime_fallback_drill_queue add column if not exists fallback_hint text;
alter table public.app_runtime_fallback_drill_queue add column if not exists sort_order integer not null default 100;
alter table public.app_runtime_fallback_drill_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_runtime_fallback_drill_queue add column if not exists checked_at timestamptz;
alter table public.app_runtime_fallback_drill_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_db_source_registry_candidate_queue (
  candidate_key text primary key,
  source_area text not null default 'source_registry',
  candidate_title text not null default 'DB source registry candidate',
  candidate_status text not null default 'planned',
  current_source_hint text,
  db_registry_hint text,
  migration_check_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_db_source_registry_candidate_queue add column if not exists source_area text not null default 'source_registry';
alter table public.app_db_source_registry_candidate_queue add column if not exists candidate_title text not null default 'DB source registry candidate';
alter table public.app_db_source_registry_candidate_queue add column if not exists candidate_status text not null default 'planned';
alter table public.app_db_source_registry_candidate_queue add column if not exists current_source_hint text;
alter table public.app_db_source_registry_candidate_queue add column if not exists db_registry_hint text;
alter table public.app_db_source_registry_candidate_queue add column if not exists migration_check_hint text;
alter table public.app_db_source_registry_candidate_queue add column if not exists fallback_hint text;
alter table public.app_db_source_registry_candidate_queue add column if not exists sort_order integer not null default 100;
alter table public.app_db_source_registry_candidate_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_db_source_registry_candidate_queue add column if not exists checked_at timestamptz;
alter table public.app_db_source_registry_candidate_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_visual_asset_publication_queue (asset_key, asset_area, asset_title, asset_status, source_hint, alt_text_hint, performance_hint, fallback_hint, sort_order, metadata, checked_at) values
('visual_proof_strip_css_asset','public_shell','Publish CSS-only proof strip as lightweight visual enhancement','completed','Uses CSS gradients and cards already present in the public shell rather than heavy image files.','Text labels explain desktop website, mobile field app, and professional visuals without relying on decorative alt text.','No new image download is required, so mobile performance remains protected.','Plain text remains readable if CSS is not loaded.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('future_route_image_gate','public_routes','Gate future service images behind proof, consent, alt, and compression review','planned','Future route images should come from real app/service proof, approved stock, or consented operational photos.','Alt text must describe the helpful content and include no unsupported local/service claims.','Images must be compressed and sized for desktop/mobile before sitemap publication.','Use the CSS visual strip until approved images exist.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('admin_thumbnail_proof_queue','admin','Prepare Admin thumbnail proof review before public publication','planned','Admin should eventually show visual asset source, proof, alt text, usage location, and status.','Alt/proof should be reviewed before publication.','Thumbnail review protects layout and page weight.','Keep assets in draft and use table-only fallback.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (asset_key) do update set asset_area=excluded.asset_area, asset_title=excluded.asset_title, asset_status=excluded.asset_status, source_hint=excluded.source_hint, alt_text_hint=excluded.alt_text_hint, performance_hint=excluded.performance_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_desktop_mobile_release_polish_queue (polish_key, surface_area, polish_title, polish_status, desktop_hint, mobile_hint, visual_hint, fallback_hint, sort_order, metadata, checked_at) values
('public_desktop_mobile_message','public_shell','Keep public copy clear that the product has both desktop and mobile surfaces','completed','Desktop website/admin language is shown in the visual strip and public shell.','Mobile field app language is shown with touch/offline-friendly wording.','Visual cards present both surfaces without adding another H1.','If enhanced cards fail, the text still appears in source order.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('admin_mobile_parity_audit','admin_mobile','Audit Admin desktop controls against mobile field workflows','planned','Admin tables should show queues for proof, equipment, SEO, and source consolidation.','Mobile must keep simple action cards, draft recovery, and field-safe messages.','Polish should improve scanning without reducing tap target clarity.','Keep static menus and manual forms as fallback.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('offline_visual_guidance','offline','Add polished but simple offline/conflict guidance cards','planned','Desktop explains cache/schema fallback and deploy actions.','Mobile explains retry, keep local, reload server, and discard options.','Use calm chips/cards and avoid distracting motion.','Plain alert text remains fallback.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (polish_key) do update set surface_area=excluded.surface_area, polish_title=excluded.polish_title, polish_status=excluded.polish_status, desktop_hint=excluded.desktop_hint, mobile_hint=excluded.mobile_hint, visual_hint=excluded.visual_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_trust_signal_queue (trust_key, route_key, trust_area, trust_title, trust_status, search_phrase_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_trust_signal_depth','home','home_page','Strengthen homepage trust signals without unsupported local claims','in_progress','Use plain words people search for: Southern Ontario OHSA safety app, mobile field app, inspections, incidents, equipment, jobs, and reports.','Trust should come from actual app features, clear role flows, and truthful service-area language.','Internal links should lead to useful login, contact, quote, jobs, reporting, or Admin paths.','Keep current homepage copy until proof-backed routes are ready.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('approved_service_area_trust','service_area','service_area','Only publish service-area pages when proof and conversion paths are ready','planned','Use exact served geography and service terms in title, main heading, intro, and link text.','Proof must support the location/service claim before sitemap inclusion.','Link to proof, pricing/quote/contact, login, or service/action pages.','Hold unsupported local pages in draft.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('visual_trust_signal_gate','media_assets','media_assets','Use images or effects only when they improve trust and clarity','planned','Images should support real services, safety workflows, equipment, crews, or app screens.','Every public image needs proof, alt text, compression, and consent where applicable.','Image links should help users move toward useful actions.','Use CSS cards/gradients until image proof is strong.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (trust_key) do update set route_key=excluded.route_key, trust_area=excluded.trust_area, trust_title=excluded.trust_title, trust_status=excluded.trust_status, search_phrase_hint=excluded.search_phrase_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_visual_regression_queue (regression_key, regression_area, regression_title, regression_status, selector_hint, visual_test_hint, accessibility_hint, fallback_hint, sort_order, metadata, checked_at) values
('visual_proof_strip_regression','public_shell','Guard visual proof strip spacing, wrap, and contrast','completed','.surface-readiness-strip, .surface-readiness-card, .surface-proof-strip, and .surface-proof-card.','Smoke checks markers; manual review should verify desktop width, mobile stack, and no overflow.','Maintain readable contrast and no extra H1.','Content remains readable as plain text.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('reduced_motion_regression','motion','Keep motion optional and calm for field users','planned','Future motion selectors should be grouped and easy to disable.','Use only subtle transitions where they help orientation.','Respect reduced-motion preference and avoid confusing field workflows.','Disable animation and keep static cards.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('image_overflow_regression','images','Prevent image or card additions from breaking mobile layout','planned','Future image/card selectors should be checked at narrow widths.','Check for horizontal scroll, oversized images, and cramped text.','Require alt text and accessible labels where images communicate meaning.','Use CSS-only visual fallback until images pass.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (regression_key) do update set regression_area=excluded.regression_area, regression_title=excluded.regression_title, regression_status=excluded.regression_status, selector_hint=excluded.selector_hint, visual_test_hint=excluded.visual_test_hint, accessibility_hint=excluded.accessibility_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_fallback_drill_queue (drill_key, app_surface, drill_title, drill_status, trigger_hint, user_message_hint, operator_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_optional_view_drill','admin_directory','Drill missing optional schema view fallback after every schema pass','planned','Simulate or observe missing optional views after schema deploy.','Tell the user which schema/function action is needed without crashing Admin.','Apply missing schema, redeploy admin-directory, or keep empty optional table while live data catches up.','Cached Admin data and empty queues remain safe fallback.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('mobile_offline_draft_drill','mobile_field_app','Drill offline draft conflict fallback on mobile','planned','Network loss, stale server row, or failed sync retry.','Offer Retry sync, Keep local copy, Reload server, or Discard after confirmation.','Supervisor reviews unresolved conflict queue and keeps user work.','Local draft remains until server acknowledges.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('visual_asset_failure_drill','public_shell','Drill visual asset failure without losing page clarity','planned','CSS/image asset fails to load or new image route is unavailable.','Page should still explain desktop/mobile app value and local trust language.','Operator checks cache marker, asset path, and fallback text.','Plain text cards remain available.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (drill_key) do update set app_surface=excluded.app_surface, drill_title=excluded.drill_title, drill_status=excluded.drill_status, trigger_hint=excluded.trigger_hint, user_message_hint=excluded.user_message_hint, operator_action_hint=excluded.operator_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_db_source_registry_candidate_queue (candidate_key, source_area, candidate_title, candidate_status, current_source_hint, db_registry_hint, migration_check_hint, fallback_hint, sort_order, metadata, checked_at) values
('visual_asset_registry_candidate','visual_assets','Move approved visual assets and effects from repeated notes into DB registry','planned','Visual asset/effect rules repeat across Markdown, CSS comments, smoke checks, and Admin queues.','DB registry should store source, proof, alt text, usage route, performance status, and publish status.','Compare DB rows to public shell, CSS selectors, sitemap, and docs before publishing.','Keep Markdown checklist as fallback until an editor exists.',10,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('desktop_mobile_registry_candidate','surface_parity','Move desktop/mobile route parity checks into DB registry','planned','Desktop/mobile parity is repeated in docs, smoke script, mobile scripts, service worker, and Admin rows.','DB registry should store route pair, surface owner, offline support, fallback message, and validation status.','Smoke compares registry rows to nav, service worker, mobile menu, and public shell.','Keep static checks until registry generator is proven.',20,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('local_seo_trust_registry_candidate','seo_trust','Move local SEO trust and service-area proof into DB registry','planned','SEO proof, route approval, image readiness, and internal links repeat in Markdown, sitemap, and smoke checks.','DB registry should store approved route, phrase, proof, internal link, image readiness, and publication status.','Generated sitemap/internal links must match approved registry rows.','Keep static sitemap and manual review until generator is proven.',30,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (candidate_key) do update set source_area=excluded.source_area, candidate_title=excluded.candidate_title, candidate_status=excluded.candidate_status, current_source_hint=excluded.current_source_hint, db_registry_hint=excluded.db_registry_hint, migration_check_hint=excluded.migration_check_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema144_done_01','completed_this_pass',1,'schema','Added schema 144 visual asset, desktop/mobile, SEO trust, CSS, runtime, and DB registry queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 144 migration and full schema include the new queues and views.','Visual/professional enrichment and source consolidation are now tracked as release controls.','Visual and source moves remain scattered across docs.',1,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_done_02','completed_this_pass',2,'public_shell','Added professional visual proof strip to the public shell','completed','medium','DEVELOPMENT_ROADMAP.md','/','Index contains a second lightweight visual proof strip without adding an H1.','The public shell now communicates desktop/mobile/proof/value more sharply.','Visitors may miss the app professionalism and dual-surface support.',2,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_done_03','completed_this_pass',3,'css','Added responsive CSS for visual proof cards and kept brace balance','completed','medium','TESTING_CHECKLIST.md','style.css','CSS brace balance, one-H1, and smoke checks pass.','Visual enrichment remains responsive and readable.','CSS drift can break professional polish.',3,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_done_04','completed_this_pass',4,'cache_seo','Updated cache marker to 2026-06-12b and kept sitemap/robots fresh','completed','high','DEPLOYMENT_GUIDE.md','/','Index/service worker cache marker and sitemap/robots smoke checks pass.','Users and crawlers see the current build assets.','Old cached assets can hide visual/SEO changes.',4,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_done_05','completed_this_pass',5,'cleanup','Archived retired helper Markdown and root test files again','completed','high','KNOWN_ISSUES_AND_GAPS.md','archive','Root hygiene smoke checks pass.','Deployment root stays clean.','Smoke fails before schema checks.',5,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_next_01','next_20',1,'admin','Create editable visual asset registry with proof, alt text, route use, and publish status','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can approve/hold visual assets and see missing alt/performance proof.','Image/effect publication becomes controlled.','Images can become unapproved, slow, or off-brand.',101,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_next_02','next_20',2,'seo','Generate sitemap/internal-link candidates from approved SEO trust registry rows','planned','high','DEVELOPMENT_ROADMAP.md','/','Generated candidates match proof-backed route rows and smoke checks.','Local search criteria move into one source of truth.','Static sitemap/internal links drift.',102,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_next_03','next_20',3,'mobile','Build mobile offline/conflict visual guidance cards','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#today','Mobile shows retry/keep/reload/discard choices without losing drafts.','Field app becomes safer under poor signal.','Offline conflicts remain confusing.',103,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_next_04','next_20',4,'css','Add deeper visual regression checks for overflow, reduced motion, image sizing, and contrast','planned','medium','TESTING_CHECKLIST.md','style.css','Smoke/checklist catches risky visual changes before deploy.','Professional polish stays stable across devices.','Visual changes can regress silently.',104,'{"build":"2026-06-12b","schema":144}'::jsonb,now()),
('schema144_next_05','next_20',5,'runtime','Persist runtime fallback drill results from Admin, mobile, and public shell','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Fallback drill events store trigger, message, owner action, and result.','Fallback quality becomes measurable.','Fallback success remains anecdotal.',105,'{"build":"2026-06-12b","schema":144}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_visual_asset_publication_queue;
create view public.v_app_visual_asset_publication_queue as select asset_key, asset_area, asset_title, asset_status, source_hint, alt_text_hint, performance_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_visual_asset_publication_queue order by sort_order, asset_key;

drop view if exists public.v_app_desktop_mobile_release_polish_queue;
create view public.v_app_desktop_mobile_release_polish_queue as select polish_key, surface_area, polish_title, polish_status, desktop_hint, mobile_hint, visual_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_desktop_mobile_release_polish_queue order by sort_order, polish_key;

drop view if exists public.v_app_local_seo_trust_signal_queue;
create view public.v_app_local_seo_trust_signal_queue as select trust_key, route_key, trust_area, trust_title, trust_status, search_phrase_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_seo_trust_signal_queue order by sort_order, trust_key;

drop view if exists public.v_app_css_visual_regression_queue;
create view public.v_app_css_visual_regression_queue as select regression_key, regression_area, regression_title, regression_status, selector_hint, visual_test_hint, accessibility_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_css_visual_regression_queue order by sort_order, regression_key;

drop view if exists public.v_app_runtime_fallback_drill_queue;
create view public.v_app_runtime_fallback_drill_queue as select drill_key, app_surface, drill_title, drill_status, trigger_hint, user_message_hint, operator_action_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_runtime_fallback_drill_queue order by sort_order, drill_key;

drop view if exists public.v_app_db_source_registry_candidate_queue;
create view public.v_app_db_source_registry_candidate_queue as select candidate_key, source_area, candidate_title, candidate_status, current_source_hint, db_registry_hint, migration_check_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_db_source_registry_candidate_queue order by sort_order, candidate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  144::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 144 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 144 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 144.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (144, '144_visual_asset_release_seo_trust_css_runtime_source_registry_controls', '144_visual_asset_release_seo_trust_css_runtime_source_registry_controls.sql', '2026-06-12b', 'Adds visual asset publication, desktop/mobile release polish, local SEO trust signals, CSS visual regression, runtime fallback drill, and DB source-registry candidate queues.', 'applied', 'This pass keeps desktop website/mobile field-app clarity, public visual polish, one-H1 SEO guidance, CSS stability, fallback drills, Markdown, and schema references aligned.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_visual_asset_publication_queue to authenticated;
grant select on public.app_desktop_mobile_release_polish_queue to authenticated;
grant select on public.app_local_seo_trust_signal_queue to authenticated;
grant select on public.app_css_visual_regression_queue to authenticated;
grant select on public.app_runtime_fallback_drill_queue to authenticated;
grant select on public.app_db_source_registry_candidate_queue to authenticated;
grant select on public.v_app_visual_asset_publication_queue to authenticated;
grant select on public.v_app_desktop_mobile_release_polish_queue to authenticated;
grant select on public.v_app_local_seo_trust_signal_queue to authenticated;
grant select on public.v_app_css_visual_regression_queue to authenticated;
grant select on public.v_app_runtime_fallback_drill_queue to authenticated;
grant select on public.v_app_db_source_registry_candidate_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
