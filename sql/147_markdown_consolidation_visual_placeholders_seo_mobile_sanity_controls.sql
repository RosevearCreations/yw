-- Schema 147: Markdown consolidation, competitive SEO benchmarking, visual placeholders,
-- desktop/mobile polish, and next-step sanity controls.
-- Build 2026-06-14a.

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

create table if not exists public.app_markdown_consolidation_registry (
  registry_key text primary key,
  doc_area text not null default 'documentation',
  registry_title text not null default 'Markdown consolidation item',
  registry_status text not null default 'planned',
  canonical_doc_hint text,
  retire_or_archive_hint text,
  ai_handoff_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_markdown_consolidation_registry add column if not exists doc_area text not null default 'documentation';
alter table public.app_markdown_consolidation_registry add column if not exists registry_title text not null default 'Markdown consolidation item';
alter table public.app_markdown_consolidation_registry add column if not exists registry_status text not null default 'planned';
alter table public.app_markdown_consolidation_registry add column if not exists canonical_doc_hint text;
alter table public.app_markdown_consolidation_registry add column if not exists retire_or_archive_hint text;
alter table public.app_markdown_consolidation_registry add column if not exists ai_handoff_hint text;
alter table public.app_markdown_consolidation_registry add column if not exists fallback_hint text;
alter table public.app_markdown_consolidation_registry add column if not exists sort_order integer not null default 100;
alter table public.app_markdown_consolidation_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_markdown_consolidation_registry add column if not exists checked_at timestamptz;
alter table public.app_markdown_consolidation_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_visual_placeholder_registry (
  placeholder_key text primary key,
  surface_area text not null default 'public',
  placeholder_title text not null default 'Visual placeholder',
  placeholder_status text not null default 'planned',
  image_role_hint text,
  alt_text_hint text,
  placement_hint text,
  performance_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_visual_placeholder_registry add column if not exists surface_area text not null default 'public';
alter table public.app_visual_placeholder_registry add column if not exists placeholder_title text not null default 'Visual placeholder';
alter table public.app_visual_placeholder_registry add column if not exists placeholder_status text not null default 'planned';
alter table public.app_visual_placeholder_registry add column if not exists image_role_hint text;
alter table public.app_visual_placeholder_registry add column if not exists alt_text_hint text;
alter table public.app_visual_placeholder_registry add column if not exists placement_hint text;
alter table public.app_visual_placeholder_registry add column if not exists performance_hint text;
alter table public.app_visual_placeholder_registry add column if not exists fallback_hint text;
alter table public.app_visual_placeholder_registry add column if not exists sort_order integer not null default 100;
alter table public.app_visual_placeholder_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_visual_placeholder_registry add column if not exists checked_at timestamptz;
alter table public.app_visual_placeholder_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_competitive_seo_enhancement_queue (
  enhancement_key text primary key,
  seo_area text not null default 'local_search',
  enhancement_title text not null default 'Competitive SEO enhancement',
  enhancement_status text not null default 'planned',
  benchmark_hint text,
  page_or_route_hint text,
  conversion_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_competitive_seo_enhancement_queue add column if not exists seo_area text not null default 'local_search';
alter table public.app_competitive_seo_enhancement_queue add column if not exists enhancement_title text not null default 'Competitive SEO enhancement';
alter table public.app_competitive_seo_enhancement_queue add column if not exists enhancement_status text not null default 'planned';
alter table public.app_competitive_seo_enhancement_queue add column if not exists benchmark_hint text;
alter table public.app_competitive_seo_enhancement_queue add column if not exists page_or_route_hint text;
alter table public.app_competitive_seo_enhancement_queue add column if not exists conversion_hint text;
alter table public.app_competitive_seo_enhancement_queue add column if not exists fallback_hint text;
alter table public.app_competitive_seo_enhancement_queue add column if not exists sort_order integer not null default 100;
alter table public.app_competitive_seo_enhancement_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_competitive_seo_enhancement_queue add column if not exists checked_at timestamptz;
alter table public.app_competitive_seo_enhancement_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_desktop_mobile_polish_queue (
  polish_key text primary key,
  surface_area text not null default 'app_shell',
  polish_title text not null default 'Desktop/mobile polish item',
  polish_status text not null default 'planned',
  desktop_hint text,
  mobile_hint text,
  css_guard_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_desktop_mobile_polish_queue add column if not exists surface_area text not null default 'app_shell';
alter table public.app_desktop_mobile_polish_queue add column if not exists polish_title text not null default 'Desktop/mobile polish item';
alter table public.app_desktop_mobile_polish_queue add column if not exists polish_status text not null default 'planned';
alter table public.app_desktop_mobile_polish_queue add column if not exists desktop_hint text;
alter table public.app_desktop_mobile_polish_queue add column if not exists mobile_hint text;
alter table public.app_desktop_mobile_polish_queue add column if not exists css_guard_hint text;
alter table public.app_desktop_mobile_polish_queue add column if not exists fallback_hint text;
alter table public.app_desktop_mobile_polish_queue add column if not exists sort_order integer not null default 100;
alter table public.app_desktop_mobile_polish_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_desktop_mobile_polish_queue add column if not exists checked_at timestamptz;
alter table public.app_desktop_mobile_polish_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_next_step_sanity_queue (
  sanity_key text primary key,
  sanity_area text not null default 'next_steps',
  sanity_title text not null default 'Next-step sanity item',
  sanity_status text not null default 'planned',
  current_state_hint text,
  next_action_hint text,
  value_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_next_step_sanity_queue add column if not exists sanity_area text not null default 'next_steps';
alter table public.app_next_step_sanity_queue add column if not exists sanity_title text not null default 'Next-step sanity item';
alter table public.app_next_step_sanity_queue add column if not exists sanity_status text not null default 'planned';
alter table public.app_next_step_sanity_queue add column if not exists current_state_hint text;
alter table public.app_next_step_sanity_queue add column if not exists next_action_hint text;
alter table public.app_next_step_sanity_queue add column if not exists value_hint text;
alter table public.app_next_step_sanity_queue add column if not exists fallback_hint text;
alter table public.app_next_step_sanity_queue add column if not exists sort_order integer not null default 100;
alter table public.app_next_step_sanity_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_next_step_sanity_queue add column if not exists checked_at timestamptz;
alter table public.app_next_step_sanity_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_markdown_consolidation_registry (registry_key,doc_area,registry_title,registry_status,canonical_doc_hint,retire_or_archive_hint,ai_handoff_hint,fallback_hint,sort_order,metadata,checked_at) values
('active_project_handbook','documentation','Create one main active project handbook','completed','docs/ACTIVE_PROJECT_HANDBOOK.md becomes the compact source of truth for business model, architecture, current schema, SEO guardrails, mobile/desktop direction, and next steps.','Keep detailed historical docs in docs/ and archive root helper drafts instead of deleting context.','AI_CONTEXT.md and NEW_CHAT_STATUS.md point future chats to the handbook.','Use archived snapshots if a specific historical pass is needed.',10,'{"build":"2026-06-14a","schema":147}'::jsonb,now()),
('next_steps_sanity_file','documentation','Create one main next-step sanity file','completed','docs/NEXT_STEPS_AND_SANITY_CHECK.md carries immediate priorities, current gaps, and next-pass build focus.','Older detailed docs remain available but no longer need to be read first.','Future AI/new chat can read two docs first, then branch into detailed docs only when needed.','Fallback to DEVELOPMENT_ROADMAP.md and KNOWN_ISSUES_AND_GAPS.md if the compact doc is stale.',20,'{"build":"2026-06-14a","schema":147}'::jsonb,now())
on conflict (registry_key) do update set doc_area=excluded.doc_area, registry_title=excluded.registry_title, registry_status=excluded.registry_status, canonical_doc_hint=excluded.canonical_doc_hint, retire_or_archive_hint=excluded.retire_or_archive_hint, ai_handoff_hint=excluded.ai_handoff_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_visual_placeholder_registry (placeholder_key,surface_area,placeholder_title,placeholder_status,image_role_hint,alt_text_hint,placement_hint,performance_hint,fallback_hint,sort_order,metadata,checked_at) values
('public_hero_placeholder','public','Hero operations visual placeholder','completed','Future approved image: crew, equipment, jobsite, or dashboard screenshot.','Alt text must describe the actual approved image and local/business context.','Public shell above readiness strips.','Use compressed WebP/AVIF later; CSS-only placeholder now prevents broken assets.','Keep gradient card if no image is approved.',10,'{"build":"2026-06-14a","schema":147}'::jsonb,now()),
('section_placeholder_system','app_sections','Visual placeholders across empty app sections','completed','Toolbox, PPE, incident, inspection, jobs, equipment, and Admin sections now have image-ready placeholders.','Each future image needs descriptive alt text and proof/consent if people or client sites appear.','Inside relevant mobile/desktop cards.','No heavy image load until the asset registry approves files.','Text/shape placeholder remains usable offline.',20,'{"build":"2026-06-14a","schema":147}'::jsonb,now())
on conflict (placeholder_key) do update set surface_area=excluded.surface_area, placeholder_title=excluded.placeholder_title, placeholder_status=excluded.placeholder_status, image_role_hint=excluded.image_role_hint, alt_text_hint=excluded.alt_text_hint, placement_hint=excluded.placement_hint, performance_hint=excluded.performance_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_competitive_seo_enhancement_queue (enhancement_key,seo_area,enhancement_title,enhancement_status,benchmark_hint,page_or_route_hint,conversion_hint,fallback_hint,sort_order,metadata,checked_at) values
('title_h1_local_alignment','technical_seo','Keep title/H1/local wording aligned without duplicate prominent headings','completed','Google title-link guidance warns that multiple large prominent headings can confuse the main title selection.','Homepage keeps one H1; future route registry must enforce one H1 per exposed page.','Local phrases should connect to quote/contact or app-intake action, not just keyword stuffing.','Hold new pages in draft until title, H1, meta, proof, and CTA pass smoke.',10,'{"build":"2026-06-14a","schema":147}'::jsonb,now()),
('service_site_competitive_features','competitive_features','Track modern service-site expectations before expanding public pages','in_progress','Competitive service sites commonly emphasize mobile-first intake, trust proof, service-area clarity, visual proof, and frictionless contact.','Route registry should require proof, internal links, CTA, visual placeholder/approved image, and fallback copy.','Quote/contact intake should become the primary conversion path.','Keep current public shell until proof-backed pages are ready.',20,'{"build":"2026-06-14a","schema":147}'::jsonb,now())
on conflict (enhancement_key) do update set seo_area=excluded.seo_area, enhancement_title=excluded.enhancement_title, enhancement_status=excluded.enhancement_status, benchmark_hint=excluded.benchmark_hint, page_or_route_hint=excluded.page_or_route_hint, conversion_hint=excluded.conversion_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_desktop_mobile_polish_queue (polish_key,surface_area,polish_title,polish_status,desktop_hint,mobile_hint,css_guard_hint,fallback_hint,sort_order,metadata,checked_at) values
('public_placeholder_responsive_grid','public_shell','Responsive graphic placeholder wall','completed','Desktop uses a four-card visual wall with a wider hero placeholder.','Mobile collapses to one column with readable spacing and no overlap.','CSS uses max-width containers, grid collapse, and no fixed overflow.','CSS-only graphics remain if images are unavailable.',10,'{"build":"2026-06-14a","schema":147}'::jsonb,now()),
('section_placeholder_responsive_cards','app_sections','Image-ready placeholders inside major app sections','completed','Desktop sections show polished placeholder cards for future screenshots/images.','Mobile sections keep short captions and tap-friendly spacing.','Cards use responsive min-height and no additional H1 tags.','Plain text remains visible if CSS is unavailable.',20,'{"build":"2026-06-14a","schema":147}'::jsonb,now())
on conflict (polish_key) do update set surface_area=excluded.surface_area, polish_title=excluded.polish_title, polish_status=excluded.polish_status, desktop_hint=excluded.desktop_hint, mobile_hint=excluded.mobile_hint, css_guard_hint=excluded.css_guard_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_next_step_sanity_queue (sanity_key,sanity_area,sanity_title,sanity_status,current_state_hint,next_action_hint,value_hint,fallback_hint,sort_order,metadata,checked_at) values
('next_real_write_actions','workflow_execution','Move from registries to real write actions','planned','Schemas 145-147 now document and expose priority queues, placeholders, and compact handoff docs.','Build payment application and quote/contact intake Edge write paths first.','This creates measurable business value instead of more planning rows.','Keep queue-only mode until write validation and rollback are safe.',10,'{"build":"2026-06-14a","schema":147}'::jsonb,now()),
('next_public_route_depth','seo_growth','Publish only proof-backed public routes','planned','The public shell is stronger, but service/location pages still need route registry approval.','Create route templates with title, one H1, meta, internal links, CTA, visual placeholder/approved image, and proof.','This supports local search without thin/unsupported pages.','Hold routes in draft if proof is weak.',20,'{"build":"2026-06-14a","schema":147}'::jsonb,now())
on conflict (sanity_key) do update set sanity_area=excluded.sanity_area, sanity_title=excluded.sanity_title, sanity_status=excluded.sanity_status, current_state_hint=excluded.current_state_hint, next_action_hint=excluded.next_action_hint, value_hint=excluded.value_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_markdown_consolidation_registry;
create view public.v_app_markdown_consolidation_registry as select registry_key, doc_area, registry_title, registry_status, canonical_doc_hint, retire_or_archive_hint, ai_handoff_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_markdown_consolidation_registry order by sort_order, registry_key;
drop view if exists public.v_app_visual_placeholder_registry;
create view public.v_app_visual_placeholder_registry as select placeholder_key, surface_area, placeholder_title, placeholder_status, image_role_hint, alt_text_hint, placement_hint, performance_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_visual_placeholder_registry order by sort_order, placeholder_key;
drop view if exists public.v_app_competitive_seo_enhancement_queue;
create view public.v_app_competitive_seo_enhancement_queue as select enhancement_key, seo_area, enhancement_title, enhancement_status, benchmark_hint, page_or_route_hint, conversion_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_competitive_seo_enhancement_queue order by sort_order, enhancement_key;
drop view if exists public.v_app_desktop_mobile_polish_queue;
create view public.v_app_desktop_mobile_polish_queue as select polish_key, surface_area, polish_title, polish_status, desktop_hint, mobile_hint, css_guard_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_desktop_mobile_polish_queue order by sort_order, polish_key;
drop view if exists public.v_app_next_step_sanity_queue;
create view public.v_app_next_step_sanity_queue as select sanity_key, sanity_area, sanity_title, sanity_status, current_state_hint, next_action_hint, value_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_next_step_sanity_queue order by sort_order, sanity_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 147::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 147 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 147 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 147.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (147, '147_markdown_consolidation_visual_placeholders_seo_mobile_sanity_controls', '147_markdown_consolidation_visual_placeholders_seo_mobile_sanity_controls.sql', '2026-06-14a', 'Adds Markdown consolidation registry, visual placeholder registry, competitive SEO enhancement queue, desktop/mobile polish queue, and next-step sanity queue.', 'applied', 'This pass consolidates the documentation direction into two canonical handoff files, adds image-ready visual placeholders across the application, preserves one-H1 SEO discipline, and identifies the next real write-action steps.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_markdown_consolidation_registry to authenticated;
grant select on public.app_visual_placeholder_registry to authenticated;
grant select on public.app_competitive_seo_enhancement_queue to authenticated;
grant select on public.app_desktop_mobile_polish_queue to authenticated;
grant select on public.app_next_step_sanity_queue to authenticated;
grant select on public.v_app_markdown_consolidation_registry to authenticated;
grant select on public.v_app_visual_placeholder_registry to authenticated;
grant select on public.v_app_competitive_seo_enhancement_queue to authenticated;
grant select on public.v_app_desktop_mobile_polish_queue to authenticated;
grant select on public.v_app_next_step_sanity_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
