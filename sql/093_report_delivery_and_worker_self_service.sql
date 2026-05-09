-- 093_report_delivery_and_worker_self_service.sql
-- Adds:
-- - scheduled report delivery plumbing and run history
-- - worker self-service SDS prompt queue
-- - supervisor/admin delivery reporting support

create table if not exists public.report_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  setting_code text not null default 'default',
  subscription_id uuid references public.report_subscriptions(id) on delete set null,
  subscription_name text,
  report_kind text,
  delivery_channel text,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  run_status text not null default 'queued',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  attachment_count integer not null default 0,
  delivery_subject text,
  delivery_summary text,
  payload jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_delivery_runs
  drop constraint if exists report_delivery_runs_status_check;

alter table if exists public.report_delivery_runs
  add constraint report_delivery_runs_status_check
  check (run_status in ('queued','running','completed','partial','failed','skipped'));

create index if not exists idx_report_delivery_runs_subscription
  on public.report_delivery_runs(subscription_id, started_at desc);

create index if not exists idx_report_delivery_runs_status
  on public.report_delivery_runs(run_status, started_at desc);

create table if not exists public.report_delivery_scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  setting_code text not null unique,
  is_enabled boolean not null default false,
  run_timezone text not null default 'America/Toronto',
  cadence text not null default 'hourly',
  run_hour_local integer not null default 7,
  run_minute_local integer not null default 0,
  invoke_url text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_dispatch_at timestamptz,
  last_dispatch_request_id bigint,
  last_dispatch_status text,
  last_dispatch_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_delivery_scheduler_settings
  drop constraint if exists report_delivery_scheduler_settings_cadence_check;

alter table if exists public.report_delivery_scheduler_settings
  add constraint report_delivery_scheduler_settings_cadence_check
  check (cadence in ('manual','hourly','daily','weekly'));

alter table if exists public.report_delivery_scheduler_settings
  drop constraint if exists report_delivery_scheduler_settings_last_dispatch_status_check;

alter table if exists public.report_delivery_scheduler_settings
  add constraint report_delivery_scheduler_settings_last_dispatch_status_check
  check (last_dispatch_status in ('queued','completed','failed') or last_dispatch_status is null);

insert into public.report_delivery_scheduler_settings (
  setting_code,
  is_enabled,
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  notes
)
select
  'default',
  false,
  'America/Toronto',
  'hourly',
  7,
  0,
  'Deploy report-subscription-delivery-run, set invoke_url, then enable this scheduler row.'
where not exists (
  select 1 from public.report_delivery_scheduler_settings where setting_code = 'default'
);

create or replace function public.dispatch_due_report_delivery_scheduler_runs()
returns integer
language plpgsql
security definer
as $$
declare
  v_secret text := null;
  v_dispatched integer := 0;
  v_request_id bigint;
  r record;
begin
  begin
    execute $sql$
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'service_execution_scheduler_secret'
      limit 1
    $sql$
    into v_secret;
  exception
    when undefined_table or invalid_schema_name then
      v_secret := null;
  end;

  if coalesce(v_secret, '') = '' then
    v_secret := nullif(current_setting('app.settings.service_execution_scheduler_secret', true), '');
  end if;

  if coalesce(v_secret, '') = '' then
    update public.report_delivery_scheduler_settings
    set
      last_dispatch_status = 'failed',
      last_dispatch_notes = 'Missing scheduler secret. Checked Vault first, then app.settings.service_execution_scheduler_secret.',
      updated_at = now()
    where is_enabled = true
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now();
    return 0;
  end if;

  for r in
    select *
    from public.report_delivery_scheduler_settings
    where is_enabled = true
      and cadence <> 'manual'
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now()
      and not (
        coalesce(last_dispatch_status, '') = 'queued'
        and coalesce(last_dispatch_at, now() - interval '100 years') > now() - interval '10 minutes'
      )
    order by next_run_at nulls first, created_at
    for update skip locked
  loop
    begin
      select net.http_post(
        url := r.invoke_url,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-scheduler-secret', v_secret
        ),
        body := jsonb_build_object('setting_code', r.setting_code)
      ) into v_request_id;

      update public.report_delivery_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_request_id = v_request_id,
        last_dispatch_status = 'queued',
        last_dispatch_notes = 'Queued through pg_cron/pg_net dispatcher.',
        updated_at = now()
      where id = r.id;

      v_dispatched := v_dispatched + 1;
    exception when others then
      update public.report_delivery_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_status = 'failed',
        last_dispatch_notes = left(sqlerrm, 1000),
        updated_at = now()
      where id = r.id;
    end;
  end loop;

  return v_dispatched;
end;
$$;

do $dispatch$
begin
  begin
    perform cron.unschedule('report_subscription_delivery_dispatch_default');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'report_subscription_delivery_dispatch_default',
    '* * * * *',
    $job$select public.dispatch_due_report_delivery_scheduler_runs();$job$
  );
exception when others then
  null;
end;
$dispatch$;

update public.report_delivery_scheduler_settings
set next_run_at = public.compute_service_execution_scheduler_next_run_at(
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  now()
)
where is_enabled = true
  and cadence <> 'manual'
  and next_run_at is null;

create or replace view public.v_report_delivery_scheduler_status as
with latest_run as (
  select distinct on (coalesce(setting_code, 'default'))
    coalesce(setting_code, 'default') as setting_key,
    id,
    run_code,
    run_status,
    sent_count,
    failed_count,
    attachment_count,
    delivery_subject,
    delivery_summary,
    started_at,
    completed_at,
    updated_at
  from public.report_delivery_runs
  order by coalesce(setting_code, 'default'), started_at desc
)
select
  s.id,
  s.setting_code,
  s.is_enabled,
  s.run_timezone,
  s.cadence,
  s.run_hour_local,
  s.run_minute_local,
  s.last_run_at,
  s.next_run_at,
  s.notes,
  lr.id as latest_run_id,
  lr.run_code as latest_run_code,
  lr.run_status as latest_run_status,
  lr.sent_count as latest_sent_count,
  lr.failed_count as latest_failed_count,
  lr.attachment_count as latest_attachment_count,
  lr.delivery_subject as latest_delivery_subject,
  lr.delivery_summary as latest_delivery_summary,
  lr.started_at as latest_started_at,
  lr.completed_at as latest_completed_at,
  case
    when s.is_enabled = true and s.next_run_at is not null and s.next_run_at <= now() then true
    else false
  end as is_due,
  s.invoke_url,
  s.last_dispatch_at,
  s.last_dispatch_request_id,
  s.last_dispatch_status,
  s.last_dispatch_notes
from public.report_delivery_scheduler_settings s
left join latest_run lr on lr.setting_key = s.setting_code;

create or replace view public.v_report_delivery_run_history as
select
  r.id,
  r.run_code,
  r.setting_code,
  r.subscription_id,
  r.subscription_name,
  r.report_kind,
  r.delivery_channel,
  r.recipient_profile_id,
  coalesce(p.full_name, p.email, '') as recipient_profile_name,
  r.recipient_email,
  r.run_status,
  r.started_at,
  r.completed_at,
  r.sent_count,
  r.failed_count,
  r.attachment_count,
  r.delivery_subject,
  r.delivery_summary,
  r.error_text,
  r.payload,
  r.created_at,
  r.updated_at
from public.report_delivery_runs r
left join public.profiles p on p.id = r.recipient_profile_id;

create or replace view public.v_worker_sds_prompt_queue as
with latest_sds as (
  select distinct on (sa.profile_id, sa.linked_training_record_id)
    sa.profile_id,
    sa.linked_training_record_id,
    sa.id as sds_acknowledgement_id,
    sa.product_name,
    sa.chemical_name,
    sa.vendor_name,
    sa.status,
    sa.acknowledged_at,
    sa.expires_at,
    sa.is_expired,
    sa.expires_within_7_days,
    sa.job_code,
    sa.work_order_number,
    sa.route_code,
    sa.equipment_code,
    sa.prompt_context_label,
    sa.updated_at
  from public.v_sds_acknowledgement_directory sa
  order by sa.profile_id, sa.linked_training_record_id, coalesce(sa.acknowledged_at, sa.updated_at, sa.created_at) desc nulls last
)
select
  tr.profile_id,
  tr.profile_name,
  tr.employee_number,
  tr.id as training_record_id,
  tr.course_id,
  tr.course_code,
  tr.course_name,
  tc.sds_prompt_text,
  tr.completed_at,
  tr.expires_at as training_expires_at,
  ls.sds_acknowledgement_id,
  coalesce(ls.product_name, tc.course_name) as product_name,
  ls.chemical_name,
  ls.vendor_name,
  ls.status as sds_status,
  ls.acknowledged_at,
  ls.expires_at,
  ls.job_code,
  ls.work_order_number,
  ls.route_code,
  ls.equipment_code,
  coalesce(ls.prompt_context_label, tc.sds_prompt_text, tc.course_name) as prompt_context_label,
  case
    when ls.sds_acknowledgement_id is null then true
    when coalesce(ls.is_expired, false) = true then true
    when coalesce(ls.expires_within_7_days, false) = true then true
    else false
  end as prompt_due,
  case
    when ls.sds_acknowledgement_id is null then 'missing'
    when coalesce(ls.is_expired, false) = true then 'expired'
    when coalesce(ls.expires_within_7_days, false) = true then 'expiring'
    else 'current'
  end as prompt_status
from public.v_training_record_directory tr
left join public.training_courses tc on tc.id = tr.course_id
left join latest_sds ls on ls.profile_id = tr.profile_id and ls.linked_training_record_id = tr.id
where coalesce(tc.requires_sds_acknowledgement, false) = true
  and coalesce(tr.completion_status, '') = 'completed';
