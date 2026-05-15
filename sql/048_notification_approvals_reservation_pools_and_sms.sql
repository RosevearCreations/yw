-- File: sql/048_notification_approvals_reservation_pools_and_sms.sql
-- Brief description: Unifies admin notification workflow, adds approval tracking,
-- equipment pool-aware reservation support, and optional SMS verification fields.
-- This version is defensive against older/newer admin_notifications schemas.

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

do $$
declare
  has_event_type boolean;
  has_related_table boolean;
  has_related_id boolean;
  has_submission_id boolean;
  has_message boolean;
  has_created_by boolean;
  has_actor_profile_id boolean;
  has_recipient_profile_id boolean;
  has_target_role boolean;
  has_is_read boolean;
  has_resolved_at boolean;
  has_read_at boolean;
  has_created_at boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'event_type'
  ) into has_event_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'related_table'
  ) into has_related_table;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'related_id'
  ) into has_related_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'submission_id'
  ) into has_submission_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'message'
  ) into has_message;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'created_by'
  ) into has_created_by;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'actor_profile_id'
  ) into has_actor_profile_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'recipient_profile_id'
  ) into has_recipient_profile_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'target_role'
  ) into has_target_role;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'is_read'
  ) into has_is_read;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'resolved_at'
  ) into has_resolved_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'read_at'
  ) into has_read_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'created_at'
  ) into has_created_at;

  execute format($sql$
    update public.admin_notifications
    set
      notification_type = coalesce(notification_type, %1$s, 'general'),
      target_table = coalesce(target_table, %2$s),
      target_id = coalesce(target_id, %3$s),
      body = coalesce(body, %4$s),
      created_by_profile_id = coalesce(created_by_profile_id, %5$s),
      recipient_role = coalesce(
        recipient_role,
        case when %6$s is not null then null else %7$s end,
        'admin'
      ),
      title = coalesce(title, 'Notification'),
      email_subject = coalesce(email_subject, title, 'Notification'),
      target_profile_id = coalesce(target_profile_id, %6$s),
      related_table = coalesce(related_table, target_table),
      related_id = coalesce(related_id, target_id),
      payload = coalesce(payload, '{}'::jsonb),
      message = coalesce(message, body),
      status = case
        when coalesce(status,'') in ('pending','queued') then 'queued'
        when status in ('read','resolved','dismissed','approved','rejected','sent','failed') then status
        when %8$s then 'read'
        else 'queued'
      end,
      decision_status = case
        when decision_status is not null and decision_status <> '' then decision_status
        when coalesce(status,'') = 'approved' then 'approved'
        when coalesce(status,'') = 'rejected' then 'rejected'
        when coalesce(status,'') = 'dismissed' then 'dismissed'
        when %9$s is not null then 'resolved'
        else 'pending'
      end,
      read_at = coalesce(read_at, %10$s),
      decided_at = coalesce(decided_at, %9$s),
      sent_at = coalesce(sent_at, case when coalesce(status,'') = 'sent' then %11$s else null end),
      email_status = case
        when coalesce(email_status,'') <> '' then email_status
        when coalesce(status,'') = 'sent' then 'sent'
        when coalesce(status,'') = 'failed' then 'failed'
        else 'pending'
      end
  $sql$,
    case when has_event_type then 'event_type' else 'null' end,
    case when has_related_table then 'related_table' else 'null' end,
    case
      when has_related_id and has_submission_id then 'coalesce(related_id, submission_id::text)'
      when has_related_id then 'related_id'
      when has_submission_id then 'submission_id::text'
      else 'null'
    end,
    case when has_message then 'message' else 'null' end,
    case
      when has_created_by and has_actor_profile_id then 'coalesce(created_by, actor_profile_id)'
      when has_created_by then 'created_by'
      when has_actor_profile_id then 'actor_profile_id'
      else 'null'
    end,
    case when has_recipient_profile_id then 'recipient_profile_id' else 'null' end,
    case when has_target_role then 'target_role' else 'null' end,
    case when has_is_read then 'coalesce(is_read,false)' else 'false' end,
    case when has_resolved_at then 'resolved_at' else 'null' end,
    case
      when has_is_read and has_created_at then 'case when coalesce(is_read,false) then created_at else null end'
      else 'null'
    end,
    case when has_created_at then 'created_at' else 'now()' end
  );
end $$;

create index if not exists idx_equipment_items_pool_key
  on public.equipment_items(equipment_pool_key);

create index if not exists idx_job_equipment_requirements_pool_key
  on public.job_equipment_requirements(equipment_pool_key);

create index if not exists idx_jobs_approval_status
  on public.jobs(approval_status);

create index if not exists idx_admin_notifications_decision_status
  on public.admin_notifications(decision_status);

create index if not exists idx_admin_notifications_email_status
  on public.admin_notifications(email_status);

update public.equipment_items
set equipment_pool_key = lower(trim(coalesce(
  nullif(equipment_pool_key,''),
  nullif(category,''),
  nullif(equipment_name,''),
  equipment_code
)))
where equipment_pool_key is null or equipment_pool_key = '';

update public.job_equipment_requirements
set equipment_pool_key = lower(trim(coalesce(
  nullif(equipment_pool_key,''),
  nullif(equipment_name,''),
  equipment_code
)))
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

do $$
declare
  has_event_type boolean;
  has_target_role boolean;
  has_recipient_profile_id boolean;
  has_created_by boolean;
  has_actor_profile_id boolean;
  has_site_id boolean;
  has_submission_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'event_type'
  ) into has_event_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'target_role'
  ) into has_target_role;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'recipient_profile_id'
  ) into has_recipient_profile_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'created_by'
  ) into has_created_by;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'actor_profile_id'
  ) into has_actor_profile_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'site_id'
  ) into has_site_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admin_notifications' and column_name = 'submission_id'
  ) into has_submission_id;

  execute format($sql$
    create view public.v_admin_notifications as
    select
      n.id,
      coalesce(n.notification_type, %1$s, 'general') as notification_type,
      coalesce(n.title, 'Notification') as title,
      coalesce(n.body, n.message, '') as message,
      coalesce(n.recipient_role, %2$s, 'admin') as recipient_role,
      coalesce(n.target_profile_id, %3$s) as target_profile_id,
      coalesce(n.target_table, n.related_table) as target_table,
      coalesce(n.target_id, n.related_id) as target_id,
      n.payload,
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
      coalesce(n.created_by_profile_id, %4$s) as created_by_profile_id,
      creator.full_name as created_by_name,
      creator.email as created_by_email,
      decider.full_name as decided_by_name,
      decider.email as decided_by_email,
      %5$s as site_id,
      %6$s as submission_id
    from public.admin_notifications n
    left join public.profiles creator
      on creator.id = coalesce(n.created_by_profile_id, %4$s)
    left join public.profiles decider
      on decider.id = n.decided_by_profile_id
  $sql$,
    case when has_event_type then 'n.event_type' else 'null' end,
    case when has_target_role then 'n.target_role' else 'null' end,
    case when has_recipient_profile_id then 'n.recipient_profile_id' else 'null' end,
    case
      when has_created_by and has_actor_profile_id then 'coalesce(n.created_by, n.actor_profile_id)'
      when has_created_by then 'n.created_by'
      when has_actor_profile_id then 'n.actor_profile_id'
      else 'null'
    end,
    case when has_site_id then 'n.site_id' else 'null::uuid' end,
    case when has_submission_id then 'n.submission_id' else 'null::uuid' end
  );
end $$;

commit;
