-- File: sql/050_equipment_asset_history_and_auth_runtime.sql
-- Brief description: Adds richer equipment rental-style tracking fields,
-- typed checkout/return sign-off names, and keeps the schema aligned with the password-first app pass.

begin;

alter table if exists public.equipment_items
  add column if not exists asset_tag text,
  add column if not exists manufacturer text,
  add column if not exists model_number text,
  add column if not exists purchase_year integer,
  add column if not exists purchase_date date,
  add column if not exists purchase_price numeric(12,2),
  add column if not exists condition_status text,
  add column if not exists image_url text,
  add column if not exists comments text;

alter table if exists public.equipment_signouts
  add column if not exists checkout_worker_signature_name text,
  add column if not exists checkout_supervisor_signature_name text,
  add column if not exists checkout_admin_signature_name text,
  add column if not exists return_worker_signature_name text,
  add column if not exists return_supervisor_signature_name text,
  add column if not exists return_admin_signature_name text,
  add column if not exists checkout_condition text,
  add column if not exists return_condition text,
  add column if not exists return_notes text;

create index if not exists idx_equipment_items_asset_tag on public.equipment_items(asset_tag);
create index if not exists idx_equipment_items_purchase_date on public.equipment_items(purchase_date);
create index if not exists idx_equipment_signouts_returned_at on public.equipment_signouts(returned_at);

create or replace view public.v_equipment_signout_history as
select
  s.*,
  e.equipment_code,
  e.equipment_name,
  j.job_code,
  j.job_name
from public.equipment_signouts s
left join public.equipment_items e on e.id = s.equipment_item_id
left join public.jobs j on j.id = s.job_id;

commit;
