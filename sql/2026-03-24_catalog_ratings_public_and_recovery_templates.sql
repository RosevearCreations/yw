-- sql/2026-03-24_catalog_ratings_public_and_recovery_templates.sql
--
-- Adds:
-- - ratings and richer inventory fields for catalog_items
-- - recovery templates / rules settings seeds
-- - public-catalog friendly indexes

begin;

alter table public.catalog_items add column if not exists brand text null;
alter table public.catalog_items add column if not exists model text null;
alter table public.catalog_items add column if not exists location_label text null;
alter table public.catalog_items add column if not exists acquired_on date null;
alter table public.catalog_items add column if not exists condition_rating integer not null default 0;
alter table public.catalog_items add column if not exists usefulness_rating integer not null default 0;
alter table public.catalog_items add column if not exists overall_rating numeric(4,2) generated always as (
  case
    when coalesce(condition_rating,0)=0 and coalesce(usefulness_rating,0)=0 then null
    else round(((coalesce(condition_rating,0) + coalesce(usefulness_rating,0))::numeric / 2.0), 2)
  end
) stored;

alter table public.catalog_items add constraint catalog_items_condition_rating_check
  check (condition_rating between 0 and 5);

alter table public.catalog_items add constraint catalog_items_usefulness_rating_check
  check (usefulness_rating between 0 and 5);

create index if not exists idx_catalog_items_public on public.catalog_items (catalog_type, is_active, sort_order, updated_at desc);
create index if not exists idx_catalog_items_rating on public.catalog_items (catalog_type, overall_rating desc nulls last);

insert into public.app_management_settings (key, value)
values
  ('recovery_templates', jsonb_build_object(
    'abandoned_checkout_subject', 'Complete your Rosie Dazzlers booking',
    'abandoned_checkout_body_text', 'We noticed you started a booking but did not complete checkout. Come back when you are ready and finish your order.',
    'abandoned_checkout_body_html', '<p>We noticed you started a booking but did not complete checkout.</p><p>Come back when you are ready and finish your order.</p>'
  )),
  ('recovery_rules', jsonb_build_object(
    'abandoned_recovery_enabled', true,
    'minimum_page_events', 2,
    'require_email', true,
    'cooldown_hours', 24
  ))
on conflict (key) do nothing;

commit;
