-- File: sql/051_equipment_maintenance_lockout_and_history.sql
-- Brief description: Adds equipment maintenance/service interval fields,
-- inspection + maintenance history tables, and defect lockout workflow support.

begin;

alter table if exists public.equipment_items
  add column if not exists service_interval_days integer,
  add column if not exists last_service_date date,
  add column if not exists next_service_due_date date,
  add column if not exists last_inspection_at date,
  add column if not exists next_inspection_due_date date,
  add column if not exists defect_status text default 'clear',
  add column if not exists defect_notes text,
  add column if not exists is_locked_out boolean not null default false,
  add column if not exists locked_out_at timestamptz,
  add column if not exists locked_out_by_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.equipment_inspection_history (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  inspected_by_profile_id uuid references public.profiles(id) on delete set null,
  inspected_at timestamptz not null default now(),
  inspection_status text not null default 'pass',
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_maintenance_history (
  id bigserial primary key,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  performed_by_profile_id uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  maintenance_type text not null default 'service',
  provider_name text,
  cost_amount numeric(12,2),
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_items_locked_out on public.equipment_items(is_locked_out);
create index if not exists idx_equipment_items_next_service_due on public.equipment_items(next_service_due_date);
create index if not exists idx_equipment_items_next_inspection_due on public.equipment_items(next_inspection_due_date);
create index if not exists idx_equipment_inspection_history_item on public.equipment_inspection_history(equipment_item_id, inspected_at desc);
create index if not exists idx_equipment_maintenance_history_item on public.equipment_maintenance_history(equipment_item_id, performed_at desc);

create or replace view public.v_equipment_inspection_history as
select
  h.*,
  e.equipment_code,
  e.equipment_name,
  p.full_name as inspector_name
from public.equipment_inspection_history h
left join public.equipment_items e on e.id = h.equipment_item_id
left join public.profiles p on p.id = h.inspected_by_profile_id;

create or replace view public.v_equipment_maintenance_history as
select
  h.*,
  e.equipment_code,
  e.equipment_name,
  p.full_name as performed_by_name
from public.equipment_maintenance_history h
left join public.equipment_items e on e.id = h.equipment_item_id
left join public.profiles p on p.id = h.performed_by_profile_id;

update public.equipment_items
set defect_status = coalesce(nullif(defect_status, ''), case when is_locked_out then 'open' else 'clear' end)
where defect_status is null or defect_status = '';

create or replace view public.v_admin_notifications as
select
  n.id,
  n.notification_type,
  coalesce(n.title, 'Notification') as title,
  coalesce(n.body, n.message, '') as message,
  n.recipient_role,
  n.target_profile_id,
  n.target_table,
  n.target_id,
  n.payload,
  n.status,
  n.decision_status,
  n.decision_notes,
  n.created_at,
  n.read_at,
  n.decided_at,
  n.sent_at,
  n.email_to,
  n.email_subject,
  n.email_status,
  n.email_provider,
  n.email_attempt_count,
  n.email_last_attempt_at,
  n.email_error,
  n.sms_provider,
  n.sms_attempt_count,
  n.sms_last_attempt_at,
  n.dead_lettered_at,
  n.dead_letter_reason,
  n.created_by_profile_id
from public.admin_notifications n;

commit;
