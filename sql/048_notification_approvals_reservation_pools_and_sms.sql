-- File: sql/048_notification_approvals_reservation_pools_and_sms.sql
-- Brief description: Unifies admin notification workflow, adds approval tracking,
-- equipment pool-aware reservation support, and optional SMS verification fields.

begin;

alter table if exists public.jobs
  add column if not exists approval_status text not null default 'not_requested',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists approval_notes text;

alter table if exists public.equipment_items
  add column if not exists equipment_pool_key text;

alter table if exists public.job_equipment_requirements
  add column if not exists equipment_pool_key text,
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists approval_notes text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.profiles
  add column if not exists phone_verification_provider text,
  add column if not exists phone_verification_sid text,
  add column if not exists phone_verified_at timestamptz;

alter table if exists public.admin_notifications
  add column if not exists recipient_role text default 'admin',
  add column if not exists target_table text,
  add column if not exists target_id text,
  add column if not exists body text,
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists sent_at timestamptz,
  add column if not exists email_to text,
  add column if not exists email_subject text,
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_error text,
  add column if not exists decision_status text not null default 'pending',
  add column if not exists decision_notes text,
  add column if not exists decided_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists target_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists related_table text,
  add column if not exists related_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists message text,
  add column if not exists title text,
  add column if not exists notification_type text,
  add column if not exists status text default 'queued';

update public.admin_notifications
set
  notification_type = coalesce(notification_type, event_type, 'general'),
  target_table = coalesce(target_table, related_table),
  target_id = coalesce(target_id, related_id, submission_id::text),
  body = coalesce(body, message),
  created_by_profile_id = coalesce(created_by_profile_id, created_by, actor_profile_id),
  recipient_role = coalesce(recipient_role, case when recipient_profile_id is not null then null else target_role end, 'admin'),
  title = coalesce(title, subject, 'Notification'),
  email_subject = coalesce(email_subject, subject, title),
  target_profile_id = coalesce(target_profile_id, recipient_profile_id),
  related_table = coalesce(related_table, target_table),
  related_id = coalesce(related_id, target_id),
  payload = coalesce(payload, '{}'::jsonb),
  message = coalesce(message, body),
  status = case
    when coalesce(status,'') in ('pending','queued') then 'queued'
    when status in ('read','resolved','dismissed','approved','rejected','sent','failed') then status
    when coalesce(is_read,false) then 'read'
    else 'queued'
  end,
  decision_status = case
    when decision_status is not null and decision_status <> '' then decision_status
    when coalesce(status,'') = 'approved' then 'approved'
    when coalesce(status,'') = 'rejected' then 'rejected'
    when coalesce(status,'') = 'dismissed' then 'dismissed'
    when resolved_at is not null then 'resolved'
    else 'pending'
  end,
  read_at = coalesce(read_at, case when coalesce(is_read,false) then created_at else null end),
  decided_at = coalesce(decided_at, resolved_at),
  sent_at = coalesce(sent_at, case when coalesce(status,'') = 'sent' then created_at else null end),
  email_status = case
    when coalesce(email_status,'') <> '' then email_status
    when coalesce(status,'') = 'sent' then 'sent'
    when coalesce(status,'') = 'failed' then 'failed'
    else 'pending'
  end;

create index if not exists idx_equipment_items_pool_key on public.equipment_items(equipment_pool_key);
create index if not exists idx_job_equipment_requirements_pool_key on public.job_equipment_requirements(equipment_pool_key);
create index if not exists idx_jobs_approval_status on public.jobs(approval_status);
create index if not exists idx_admin_notifications_decision_status on public.admin_notifications(decision_status);
create index if not exists idx_admin_notifications_email_status on public.admin_notifications(email_status);

update public.equipment_items
set equipment_pool_key = lower(trim(coalesce(nullif(equipment_pool_key,''), nullif(category,''), nullif(equipment_name,''), equipment_code)))
where equipment_pool_key is null or equipment_pool_key = '';

update public.job_equipment_requirements
set equipment_pool_key = lower(trim(coalesce(nullif(equipment_pool_key,''), nullif(equipment_name,''), equipment_code)))
where equipment_pool_key is null or equipment_pool_key = '';

drop view if exists public.v_equipment_pool_availability;
create view public.v_equipment_pool_availability as
select
  e.equipment_pool_key,
  min(e.category) as category,
  count(*)::int as total_qty,
  count(*) filter (where e.status = 'available')::int as available_qty,
  count(*) filter (where e.status = 'reserved')::int as reserved_qty,
  count(*) filter (where e.status = 'checked_out')::int as checked_out_qty,
  array_agg(e.equipment_code order by e.equipment_code) as equipment_codes
from public.equipment_items e
where e.equipment_pool_key is not null
group by e.equipment_pool_key;

drop view if exists public.v_admin_notifications;
create view public.v_admin_notifications as
select
  n.id,
  coalesce(n.notification_type, n.event_type, 'general') as notification_type,
  coalesce(n.title, n.subject, 'Notification') as title,
  coalesce(n.body, n.message, '') as message,
  coalesce(n.recipient_role, n.target_role, 'admin') as recipient_role,
  coalesce(n.target_profile_id, n.recipient_profile_id) as target_profile_id,
  coalesce(n.target_table, n.related_table) as target_table,
  coalesce(n.target_id, n.related_id, n.submission_id::text) as target_id,
  n.payload,
  coalesce(n.status, 'queued') as status,
  coalesce(n.decision_status, 'pending') as decision_status,
  n.decision_notes,
  n.created_at,
  n.read_at,
  n.decided_at,
  n.sent_at,
  coalesce(n.email_subject, n.subject, n.title) as email_subject,
  n.email_to,
  coalesce(n.email_status, 'pending') as email_status,
  n.email_error,
  coalesce(n.created_by_profile_id, n.created_by, n.actor_profile_id) as created_by_profile_id,
  creator.full_name as created_by_name,
  creator.email as created_by_email,
  decider.full_name as decided_by_name,
  decider.email as decided_by_email,
  n.site_id,
  n.submission_id
from public.admin_notifications n
left join public.profiles creator on creator.id = coalesce(n.created_by_profile_id, n.created_by, n.actor_profile_id)
left join public.profiles decider on decider.id = n.decided_by_profile_id;

commit;
