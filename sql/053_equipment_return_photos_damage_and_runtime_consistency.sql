-- File: sql/053_equipment_return_photos_damage_and_runtime_consistency.sql
-- Brief description:
-- Adds equipment checkout/return evidence photo storage and damage reporting fields,
-- keeps runtime config/account-recovery data aligned, and refreshes signout history views.

begin;

alter table if exists public.equipment_signouts
  add column if not exists checkout_photos_json jsonb not null default '[]'::jsonb,
  add column if not exists return_photos_json jsonb not null default '[]'::jsonb,
  add column if not exists damage_reported boolean not null default false,
  add column if not exists damage_notes text;

create index if not exists idx_equipment_signouts_damage_reported
  on public.equipment_signouts(damage_reported, returned_at desc);

create index if not exists idx_profiles_recovery_email
  on public.profiles (lower(recovery_email))
  where recovery_email is not null and btrim(recovery_email) <> '';

drop view if exists public.v_equipment_signout_history;
create view public.v_equipment_signout_history as
select
  s.*,
  e.equipment_code,
  e.equipment_name,
  e.serial_number,
  e.asset_tag,
  j.job_code,
  j.job_name,
  jsonb_array_length(coalesce(s.checkout_photos_json, '[]'::jsonb)) as checkout_photo_count,
  jsonb_array_length(coalesce(s.return_photos_json, '[]'::jsonb)) as return_photo_count
from public.equipment_signouts s
left join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id;

commit;
