-- Schema 143: Desktop/mobile surface parity, visual-professional enrichment,
-- local-search content depth, CSS/motion/image guardrails, schema deploy validation,
-- and JSON/DB source-consolidation controls.
-- Build 2026-06-12a.
--
-- Purpose:
-- 1. Ensure every pass keeps a desktop website/Admin surface and mobile field-app surface aligned.
-- 2. Track visual polish/enrichment without adding unsupported images or SEO claims.
-- 3. Keep schema/full-schema/Markdown/cache/SEO smoke markers aligned after the schema 141/142 repairs.

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

create table if not exists public.app_desktop_mobile_surface_parity_queue (
  parity_key text primary key,
  surface_area text not null default 'surface_parity',
  parity_title text not null default 'Desktop/mobile parity control',
  parity_status text not null default 'planned',
  desktop_hint text,
  mobile_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_desktop_mobile_surface_parity_queue add column if not exists surface_area text not null default 'surface_parity';
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists parity_title text not null default 'Desktop/mobile parity control';
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists parity_status text not null default 'planned';
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists desktop_hint text;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists mobile_hint text;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists validation_hint text;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists fallback_hint text;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists sort_order integer not null default 100;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists checked_at timestamptz;
alter table public.app_desktop_mobile_surface_parity_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_visual_professional_enrichment_queue (
  enrichment_key text primary key,
  enrichment_area text not null default 'visual_enrichment',
  enrichment_title text not null default 'Visual enrichment control',
  enrichment_status text not null default 'planned',
  asset_or_effect_hint text,
  professionalism_hint text,
  accessibility_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_visual_professional_enrichment_queue add column if not exists enrichment_area text not null default 'visual_enrichment';
alter table public.app_visual_professional_enrichment_queue add column if not exists enrichment_title text not null default 'Visual enrichment control';
alter table public.app_visual_professional_enrichment_queue add column if not exists enrichment_status text not null default 'planned';
alter table public.app_visual_professional_enrichment_queue add column if not exists asset_or_effect_hint text;
alter table public.app_visual_professional_enrichment_queue add column if not exists professionalism_hint text;
alter table public.app_visual_professional_enrichment_queue add column if not exists accessibility_hint text;
alter table public.app_visual_professional_enrichment_queue add column if not exists fallback_hint text;
alter table public.app_visual_professional_enrichment_queue add column if not exists sort_order integer not null default 100;
alter table public.app_visual_professional_enrichment_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_visual_professional_enrichment_queue add column if not exists checked_at timestamptz;
alter table public.app_visual_professional_enrichment_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_local_search_content_depth_queue (
  depth_key text primary key,
  route_key text,
  depth_area text not null default 'local_search',
  depth_title text not null default 'Local-search content depth control',
  depth_status text not null default 'planned',
  phrase_hint text,
  proof_hint text,
  internal_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_local_search_content_depth_queue add column if not exists route_key text;
alter table public.app_local_search_content_depth_queue add column if not exists depth_area text not null default 'local_search';
alter table public.app_local_search_content_depth_queue add column if not exists depth_title text not null default 'Local-search content depth control';
alter table public.app_local_search_content_depth_queue add column if not exists depth_status text not null default 'planned';
alter table public.app_local_search_content_depth_queue add column if not exists phrase_hint text;
alter table public.app_local_search_content_depth_queue add column if not exists proof_hint text;
alter table public.app_local_search_content_depth_queue add column if not exists internal_link_hint text;
alter table public.app_local_search_content_depth_queue add column if not exists fallback_hint text;
alter table public.app_local_search_content_depth_queue add column if not exists sort_order integer not null default 100;
alter table public.app_local_search_content_depth_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_local_search_content_depth_queue add column if not exists checked_at timestamptz;
alter table public.app_local_search_content_depth_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_css_motion_image_guard_queue (
  guard_key text primary key,
  guard_area text not null default 'css_visuals',
  guard_title text not null default 'CSS motion image guard',
  guard_status text not null default 'planned',
  selector_or_asset_hint text,
  motion_or_image_hint text,
  test_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_css_motion_image_guard_queue add column if not exists guard_area text not null default 'css_visuals';
alter table public.app_css_motion_image_guard_queue add column if not exists guard_title text not null default 'CSS motion image guard';
alter table public.app_css_motion_image_guard_queue add column if not exists guard_status text not null default 'planned';
alter table public.app_css_motion_image_guard_queue add column if not exists selector_or_asset_hint text;
alter table public.app_css_motion_image_guard_queue add column if not exists motion_or_image_hint text;
alter table public.app_css_motion_image_guard_queue add column if not exists test_hint text;
alter table public.app_css_motion_image_guard_queue add column if not exists fallback_hint text;
alter table public.app_css_motion_image_guard_queue add column if not exists sort_order integer not null default 100;
alter table public.app_css_motion_image_guard_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_css_motion_image_guard_queue add column if not exists checked_at timestamptz;
alter table public.app_css_motion_image_guard_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_schema_deploy_validation_queue (
  validation_key text primary key,
  validation_area text not null default 'schema_deploy',
  validation_title text not null default 'Schema deploy validation',
  validation_status text not null default 'planned',
  schema_hint text,
  deploy_hint text,
  verification_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_schema_deploy_validation_queue add column if not exists validation_area text not null default 'schema_deploy';
alter table public.app_schema_deploy_validation_queue add column if not exists validation_title text not null default 'Schema deploy validation';
alter table public.app_schema_deploy_validation_queue add column if not exists validation_status text not null default 'planned';
alter table public.app_schema_deploy_validation_queue add column if not exists schema_hint text;
alter table public.app_schema_deploy_validation_queue add column if not exists deploy_hint text;
alter table public.app_schema_deploy_validation_queue add column if not exists verification_hint text;
alter table public.app_schema_deploy_validation_queue add column if not exists fallback_hint text;
alter table public.app_schema_deploy_validation_queue add column if not exists sort_order integer not null default 100;
alter table public.app_schema_deploy_validation_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_schema_deploy_validation_queue add column if not exists checked_at timestamptz;
alter table public.app_schema_deploy_validation_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_source_consolidation_decision_queue (
  decision_key text primary key,
  source_area text not null default 'source_consolidation',
  decision_title text not null default 'Source consolidation decision',
  decision_status text not null default 'planned',
  current_source_hint text,
  preferred_source_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_source_consolidation_decision_queue add column if not exists source_area text not null default 'source_consolidation';
alter table public.app_source_consolidation_decision_queue add column if not exists decision_title text not null default 'Source consolidation decision';
alter table public.app_source_consolidation_decision_queue add column if not exists decision_status text not null default 'planned';
alter table public.app_source_consolidation_decision_queue add column if not exists current_source_hint text;
alter table public.app_source_consolidation_decision_queue add column if not exists preferred_source_hint text;
alter table public.app_source_consolidation_decision_queue add column if not exists validation_hint text;
alter table public.app_source_consolidation_decision_queue add column if not exists fallback_hint text;
alter table public.app_source_consolidation_decision_queue add column if not exists sort_order integer not null default 100;
alter table public.app_source_consolidation_decision_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_source_consolidation_decision_queue add column if not exists checked_at timestamptz;
alter table public.app_source_consolidation_decision_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_desktop_mobile_surface_parity_queue (parity_key, surface_area, parity_title, parity_status, desktop_hint, mobile_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('desktop_admin_mobile_today_parity','surface_parity','Keep desktop Admin website and mobile Today app aligned','in_progress','Desktop website/Admin shows dashboards, jobs, equipment, reports, accounting readiness, and release status.','Mobile app shows Today actions, PPE, incidents, inspections, drills, jobs, equipment, offline drafts, and fallback choices.','Smoke checks desktop/mobile text markers, cache marker, service worker, and responsive CSS.','If mobile live data fails, keep forms and cached shell available until sync returns.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('desktop_mobile_navigation_parity','navigation','Keep desktop nav and mobile menu clear without adding duplicate H1s','planned','Desktop nav stays useful on wide layouts and Admin surfaces.','Mobile menu stays compact, touch-friendly, and clear for field staff.','One public H1 is preserved and menu current-section text updates.','Fallback is static links with accessible labels.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('offline_sync_surface_parity','offline','Keep offline recovery visible on both surfaces','planned','Desktop/Admin explains stale cache, schema deploy, and optional-view fallback states.','Mobile forms keep local drafts and explain retry/keep/discard choices.','Runtime fallback logs and service worker cache markers prove which surface handled failure.','Manual notes and exported packets remain fallback.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (parity_key) do update set surface_area=excluded.surface_area, parity_title=excluded.parity_title, parity_status=excluded.parity_status, desktop_hint=excluded.desktop_hint, mobile_hint=excluded.mobile_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_visual_professional_enrichment_queue (enrichment_key, enrichment_area, enrichment_title, enrichment_status, asset_or_effect_hint, professionalism_hint, accessibility_hint, fallback_hint, sort_order, metadata, checked_at) values
('surface_readiness_visual_strip','public_shell','Add polished desktop/mobile readiness visual strip','completed','Subtle gradient card and professional feature chips in the public shell.','Keeps Southern Ontario OHSA, desktop website, mobile field app, and professional visuals clear without adding another H1.','Uses readable text, semantic section label, no unsupported image claims, and responsive single-column mobile layout.','If CSS fails, content remains plain readable text.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('admin_visual_enrichment_backlog','admin','Track future Admin visual enrichment without slowing the app','planned','Use compact status chips, section icons, and proof thumbnails only where they improve scanning.','Keep visuals sharp, operational, and not decorative clutter.','Respect contrast and avoid motion that interferes with field work.','Text/table view remains fallback.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('image_ready_service_sections','seo_public','Prepare image-ready service sections with alt/proof rules','planned','Future route images should have real service proof, descriptive alt text, and optimized dimensions.','Images support trust and clarity without fake local claims.','Alt text and layout are required before publication.','Hold images as drafts if proof, consent, or optimization is incomplete.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (enrichment_key) do update set enrichment_area=excluded.enrichment_area, enrichment_title=excluded.enrichment_title, enrichment_status=excluded.enrichment_status, asset_or_effect_hint=excluded.asset_or_effect_hint, professionalism_hint=excluded.professionalism_hint, accessibility_hint=excluded.accessibility_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_search_content_depth_queue (depth_key, route_key, depth_area, depth_title, depth_status, phrase_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('southern_ontario_ohsa_home_depth','home','home_page','Deepen homepage local OHSA wording and conversion path','in_progress','Use customer-search language such as Southern Ontario OHSA safety app, mobile field app, inspections, incidents, PPE, jobs, and equipment.','Proof should come from real app capabilities and served-area language.','Link users toward login, contact/quote, jobs, reports, or Admin paths without dead routes.','Keep current homepage wording until route proof is approved.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('service_area_page_depth','service_area','service_area','Draft deeper approved service-area content only where proof exists','planned','Use exact served-area and service words in title, main heading, intro, and link text.','Local proof must exist before page goes into sitemap.','Internal links should help users choose service, proof, pricing/quote, contact, or login paths.','Keep unsupported local pages unpublished.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('visual_seo_asset_depth','media_assets','media_assets','Tie images and visual effects to SEO evidence','planned','Use images that support actual services, safety, equipment, crews, or app workflows.','Every image needs alt text, compression, and proof/consent if people or customer sites appear.','Link images to useful public sections instead of decorative dead ends.','Use gradient/card visual fallback when images are not ready.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (depth_key) do update set route_key=excluded.route_key, depth_area=excluded.depth_area, depth_title=excluded.depth_title, depth_status=excluded.depth_status, phrase_hint=excluded.phrase_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_motion_image_guard_queue (guard_key, guard_area, guard_title, guard_status, selector_or_asset_hint, motion_or_image_hint, test_hint, fallback_hint, sort_order, metadata, checked_at) values
('surface_readiness_css_guard','css','Guard the new surface-readiness visual CSS','completed','.surface-readiness-strip and .surface-readiness-card selectors.','Gradient/card effects are CSS-only and remain readable if images are absent.','CSS brace balance and mobile media query checks must pass.','Plain text section remains visible if advanced CSS is ignored.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('reduced_motion_visual_guard','motion','Keep visual effects calm and field-safe','planned','Future animation selectors should respect reduced motion and avoid distracting field users.','Use subtle transitions only when they improve clarity.','Smoke/checklist should flag risky animation before release.','Disable motion and keep static cards.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('image_asset_performance_guard','images','Require optimization before adding new public images','planned','Future image assets should be compressed and sized for mobile/desktop.','Prefer real proof images and avoid heavy decorative files.','Check alt text, file size, dimensions, and fallback background.','Use CSS gradients/cards until images pass review.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (guard_key) do update set guard_area=excluded.guard_area, guard_title=excluded.guard_title, guard_status=excluded.guard_status, selector_or_asset_hint=excluded.selector_or_asset_hint, motion_or_image_hint=excluded.motion_or_image_hint, test_hint=excluded.test_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_schema_deploy_validation_queue (validation_key, validation_area, validation_title, validation_status, schema_hint, deploy_hint, verification_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_141_142_repair_regression_guard','schema_repair','Keep schema 141/142 repairs locked during schema 143','completed','Full schema keeps proof_area/payment_area and repaired SEO evidence row lengths.','Apply schema 141 repair if needed, then schema 142, then schema 143.','Smoke checks schema 143 marker and keeps 141/142 repair markers.','Use standalone migrations if full-schema restore is not needed.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema_143_admin_view_validation','admin_views','Validate schema 143 views through admin-directory','planned','Six schema 143 views should load in command-center and health scopes.','Redeploy admin-directory after applying schema 143.','Admin UI receives rows or safe empty arrays.','Keep cached Admin data and empty table messages if optional views are unavailable.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema_143_asset_cache_validation','assets','Validate cache, sitemap, robots, CSS, and one-H1 markers','planned','Build marker is 2026-06-12a and sitemap lastmod is 2026-06-12.','Hard refresh/clear service worker after deploy.','Smoke confirms one public H1 and CSS brace balance.','Previous cached shell remains fallback until refresh.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (validation_key) do update set validation_area=excluded.validation_area, validation_title=excluded.validation_title, validation_status=excluded.validation_status, schema_hint=excluded.schema_hint, deploy_hint=excluded.deploy_hint, verification_hint=excluded.verification_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_source_consolidation_decision_queue (decision_key, source_area, decision_title, decision_status, current_source_hint, preferred_source_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('visual_enrichment_registry_source','visual_assets','Move visual-enrichment decisions toward DB registry','planned','Visual polish notes are repeated across Markdown, CSS comments, and roadmap rows.','DB registry should track visual assets/effects, proof, alt text, accessibility, and publication status.','Compare DB queue, CSS selectors, public shell, and Markdown plan.','Keep Markdown checklist until DB editor exists.',10,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('desktop_mobile_surface_registry_source','surface_parity','Move desktop/mobile parity rules toward DB registry','planned','Surface parity rules are spread across app shell, mobile scripts, service worker, and docs.','DB registry should define desktop/mobile route pairs, offline support, and validation checks.','Smoke compares registry rows, nav links, service worker assets, and mobile menu.','Keep static nav and docs as fallback.',20,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('local_search_content_registry_source','seo_content','Move local-search content depth decisions toward DB registry','planned','SEO route/proof/internal-link decisions repeat in sitemap, docs, and smoke checks.','DB registry should define approved routes, phrases, proof, links, image readiness, and publication status.','Generated sitemap/internal-link candidates must match approved rows.','Keep static sitemap until generator is proven.',30,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (decision_key) do update set source_area=excluded.source_area, decision_title=excluded.decision_title, decision_status=excluded.decision_status, current_source_hint=excluded.current_source_hint, preferred_source_hint=excluded.preferred_source_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema143_done_01','completed_this_pass',1,'schema','Added schema 143 desktop/mobile and visual enrichment readiness queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 143 migration and full schema include the new queues and views.','Desktop/mobile parity and visual enrichment are now tracked as first-class readiness items.','Desktop/mobile and visual polish work remains informal.',1,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_done_02','completed_this_pass',2,'public_shell','Added desktop/mobile readiness visual strip','completed','medium','DEVELOPMENT_ROADMAP.md','/','Index contains a professional surface-readiness strip without adding another H1.','Public shell better communicates desktop website, mobile field app, and visual polish.','Visitors may not understand the app supports both desktop and mobile surfaces.',2,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_done_03','completed_this_pass',3,'css','Added responsive visual polish CSS and kept CSS brace balance','completed','medium','TESTING_CHECKLIST.md','style.css','CSS brace balance and smoke checks pass.','Visual enrichment remains responsive and readable on mobile.','CSS drift may hide or crowd the public shell.',3,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_done_04','completed_this_pass',4,'seo','Updated sitemap/cache markers and preserved one public H1','completed','high','TESTING_CHECKLIST.md','/','Sitemap lastmod, cache marker, and one-H1 smoke checks pass.','SEO and cache freshness stay aligned with the build.','Search/cache signals may drift.',4,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_done_05','completed_this_pass',5,'cleanup','Archived retired helper Markdown and temporary test files','completed','high','KNOWN_ISSUES_AND_GAPS.md','archive','Smoke root hygiene checks pass.','Active root remains clean for deployment.','Smoke fails before latest schema checks.',5,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_next_01','next_20',1,'admin','Build editable desktop/mobile parity checklist in Admin','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can mark desktop/mobile parity rows complete with proof notes.','Parity moves from queue-only to operational control.','Parity checks remain read-only.',101,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_next_02','next_20',2,'visuals','Add approved visual asset registry and thumbnail proof review','planned','medium','DEVELOPMENT_ROADMAP.md','#admin','Visual assets have alt text, proof, usage, compression, and publish status.','Images/effects stay professional and accountable.','Visual work can become inconsistent or heavy.',102,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_next_03','next_20',3,'seo','Generate sitemap and internal-link candidates from approved DB rows','planned','high','DEVELOPMENT_ROADMAP.md','/','Generated candidates match approved route/proof rows and smoke checks.','SEO source of truth moves away from repeated static lists.','Sitemap and public links can drift.',103,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_next_04','next_20',4,'mobile','Add mobile visual/offline conflict guidance cards','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#today','Mobile users see clear retry/keep/discard and proof-card guidance.','Field users get safer recovery paths.','Offline conflicts remain confusing.',104,'{"build":"2026-06-12a","schema":143}'::jsonb,now()),
('schema143_next_05','next_20',5,'runtime','Persist fallback events from UI and Edge Functions','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Fallback events include surface, payload, owner, and resolution.','Repeated failures become measurable.','Fallback issues remain anecdotal.',105,'{"build":"2026-06-12a","schema":143}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_desktop_mobile_surface_parity_queue;
create view public.v_app_desktop_mobile_surface_parity_queue as select parity_key, surface_area, parity_title, parity_status, desktop_hint, mobile_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_desktop_mobile_surface_parity_queue order by sort_order, parity_key;

drop view if exists public.v_app_visual_professional_enrichment_queue;
create view public.v_app_visual_professional_enrichment_queue as select enrichment_key, enrichment_area, enrichment_title, enrichment_status, asset_or_effect_hint, professionalism_hint, accessibility_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_visual_professional_enrichment_queue order by sort_order, enrichment_key;

drop view if exists public.v_app_local_search_content_depth_queue;
create view public.v_app_local_search_content_depth_queue as select depth_key, route_key, depth_area, depth_title, depth_status, phrase_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_search_content_depth_queue order by sort_order, depth_key;

drop view if exists public.v_app_css_motion_image_guard_queue;
create view public.v_app_css_motion_image_guard_queue as select guard_key, guard_area, guard_title, guard_status, selector_or_asset_hint, motion_or_image_hint, test_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_css_motion_image_guard_queue order by sort_order, guard_key;

drop view if exists public.v_app_schema_deploy_validation_queue;
create view public.v_app_schema_deploy_validation_queue as select validation_key, validation_area, validation_title, validation_status, schema_hint, deploy_hint, verification_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_schema_deploy_validation_queue order by sort_order, validation_key;

drop view if exists public.v_app_source_consolidation_decision_queue;
create view public.v_app_source_consolidation_decision_queue as select decision_key, source_area, decision_title, decision_status, current_source_hint, preferred_source_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_source_consolidation_decision_queue order by sort_order, decision_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  143::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 143 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 143 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 143.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (143, '143_desktop_mobile_visual_enrichment_seo_css_runtime_data_source_controls', '143_desktop_mobile_visual_enrichment_seo_css_runtime_data_source_controls.sql', '2026-06-12a', 'Adds desktop/mobile surface parity, visual-professional enrichment, local-search content depth, CSS/motion/image guardrails, schema deploy validation, and JSON/DB source consolidation queues.', 'applied', 'This pass keeps repaired schema 141/142 state, Markdown, public SEO, one-H1, desktop/mobile surface clarity, visual enrichment, and cache markers aligned.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_desktop_mobile_surface_parity_queue to authenticated;
grant select on public.app_visual_professional_enrichment_queue to authenticated;
grant select on public.app_local_search_content_depth_queue to authenticated;
grant select on public.app_css_motion_image_guard_queue to authenticated;
grant select on public.app_schema_deploy_validation_queue to authenticated;
grant select on public.app_source_consolidation_decision_queue to authenticated;
grant select on public.v_app_desktop_mobile_surface_parity_queue to authenticated;
grant select on public.v_app_visual_professional_enrichment_queue to authenticated;
grant select on public.v_app_local_search_content_depth_queue to authenticated;
grant select on public.v_app_css_motion_image_guard_queue to authenticated;
grant select on public.v_app_schema_deploy_validation_queue to authenticated;
grant select on public.v_app_source_consolidation_decision_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
