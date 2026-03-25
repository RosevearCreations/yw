-- File: sql/051_equipment_maintenance_lockout_and_history.sql
-- Brief description:
-- Adds equipment maintenance/service/inspection/lockout tracking and
-- safely recreates admin notification views without column-order conflicts.
-- This version matches equipment_items.id as BIGINT.

begin;

-- =========================================================
-- EQUIPMENT ITEM EXTENSIONS
-- =========================================================

alter table if exists public.equipment_items
  add column if not exists serial_number text,
  add column if not exists asset_tag text,
  add column if not exists photo_url text,
  add column if not exists comments text,
  add column if not exists purchase_date date,
  add column if not exists purchase_vendor text,
  add column if not exists purchase_cost numeric(12,2),
  add column if not exists warranty_expiry_date date,
  add column if not exists manufacturer text,
  add column if not exists model_number text,
  add column if not exists year_of_manufacture integer,
  add column if not exists service_interval_days integer,
  add column if not exists inspection_interval_days integer,
  add column if not exists last_service_at timestamptz,
  add column if not exists next_service_due_at timestamptz,
  add column if not exists last_inspection_at timestamptz,
  add column if not exists next_inspection_due_at timestamptz,
  add column if not exists defect_status text not null default 'none',
  add column if not exists defect_notes text,
  add column if not exists is_locked_out boolean not null default false,
  add column if not exists locked_out_at timestamptz,
  add column if not exists locked_out_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists lockout_reason text;

create index if not exists idx_equipment_items_serial_number
  on public.equipment_items(serial_number);

create index if not exists idx_equipment_items_asset_tag
  on public.equipment_items(asset_tag);

create index if not exists idx_equipment_items_locked_out
  on public.equipment_items(is_locked_out);

-- =========================================================
-- EQUIPMENT INSPECTION HISTORY
-- IMPORTANT: equipment_items.id is BIGINT in this project
-- =========================================================

create table if not exists public.equipment_inspection_history (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  inspection_at timestamptz not null default now(),
  inspection_type text not null default 'general',
  result_status text not null default 'pass',
  notes text,
  defect_status text,
  defect_notes text,
  inspected_by_profile_id uuid references public.profiles(id) on delete set null,
  inspected_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_inspection_history_item_id
  on public.equipment_inspection_history(equipment_item_id, inspection_at desc);

-- =========================================================
-- EQUIPMENT MAINTENANCE / SERVICE HISTORY
-- IMPORTANT: equipment_items.id is BIGINT in this project
-- =========================================================

create table if not exists public.equipment_service_history (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  serviced_at timestamptz not null default now(),
  service_type text not null default 'maintenance',
  notes text,
  vendor_name text,
  cost numeric(12,2),
  serviced_by_profile_id uuid references public.profiles(id) on delete set null,
  serviced_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_service_history_item_id
  on public.equipment_service_history(equipment_item_id, serviced_at desc);

-- =========================================================
-- EQUIPMENT CHECKOUT / RETURN SIGNOFFS
-- =========================================================

alter table if exists public.job_equipment_assignments
  add column if not exists checkout_worker_name text,
  add column if not exists checkout_supervisor_name text,
  add column if not exists checkout_admin_name text,
  add column if not exists checkout_condition_notes text,
  add column if not exists return_worker_name text,
  add column if not exists return_supervisor_name text,
  add column if not exists return_admin_name text,
  add column if not exists return_condition_notes text;

-- =========================================================
-- NOTIFICATION DELIVERY ENHANCEMENTS
-- =========================================================

alter table if exists public.admin_notifications
  add column if not exists email_provider text,
  add column if not exists email_attempt_count integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists email_dead_lettered_at timestamptz,
  add column if not exists email_dead_letter_reason text,
  add column if not exists sms_provider text,
  add column if not exists sms_attempt_count integer not null default 0,
  add column if not exists sms_last_attempt_at timestamptz,
  add column if not exists sms_dead_lettered_at timestamptz,
  add column if not exists sms_dead_letter_reason text;

create index if not exists idx_admin_notifications_email_attempt_count
  on public.admin_notifications(email_attempt_count);

create index if not exists idx_admin_notifications_sms_attempt_count
  on public.admin_notifications(sms_attempt_count);

-- =========================================================
-- SAFE VIEW RECREATION
-- =========================================================

drop view if exists public.v_admin_notifications;
drop view if exists public.v_equipment_pool_availability;

create view public.v_admin_notifications as
select
  n.id,
  coalesce(n.notification_type, 'general') as notification_type,
  coalesce(n.title, 'Notification') as title,
  coalesce(n.body, n.message, '') as message,
  coalesce(n.recipient_role, 'admin') as recipient_role,
  n.target_profile_id,
  coalesce(n.target_table, n.related_table) as target_table,
  coalesce(n.target_id, n.related_id) as target_id,
  coalesce(n.payload, '{}'::jsonb) as payload,
  coalesce(n.status, 'queued') as status,
  coalesce(n.decision_status, 'pending') as decision_status,
  n.decision_notes,
  n.created_at,
  n.read_at,
  n.decided_at,
  n.sent_at,
  coalesce(n.email_subject, n.title, 'Notification') as email_subject,
  n.email_to,
  coalesce(n.email_status, 'pending') as email_status,
  n.email_error,
  n.email_provider,
  n.email_attempt_count,
  n.email_last_attempt_at,
  n.email_dead_lettered_at,
  n.email_dead_letter_reason,
  n.sms_provider,
  n.sms_attempt_count,
  n.sms_last_attempt_at,
  n.sms_dead_lettered_at,
  n.sms_dead_letter_reason,
  n.created_by_profile_id,
  creator.full_name as created_by_name,
  creator.email as created_by_email,
  n.decided_by_profile_id,
  decider.full_name as decided_by_name,
  decider.email as decided_by_email
from public.admin_notifications n
left join public.profiles creator
  on creator.id = n.created_by_profile_id
left join public.profiles decider
  on decider.id = n.decided_by_profile_id;

create view public.v_equipment_pool_availability as
select
  e.equipment_pool_key,
  min(e.category) as category,
  count(*)::int as total_qty,
  count(*) filter (
    where coalesce(e.status, 'available') = 'available'
      and coalesce(e.is_locked_out, false) = false
  )::int as available_qty,
  count(*) filter (where coalesce(e.status, 'reserved') = 'reserved')::int as reserved_qty,
  count(*) filter (where coalesce(e.status, 'checked_out') = 'checked_out')::int as checked_out_qty,
  count(*) filter (where coalesce(e.is_locked_out, false) = true)::int as locked_out_qty,
  array_agg(e.equipment_code order by e.equipment_code) as equipment_codes
from public.equipment_items e
where e.equipment_pool_key is not null
group by e.equipment_pool_key;

commit;
