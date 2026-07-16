-- Schema 156: Consent-controlled customer live-update notification delivery.
-- Build 2026-07-07a.
--
-- Purpose:
-- 1. Add an explicit opt-in for customer email notifications about deliberately customer-visible live work updates.
-- 2. Create an auditable email outbox with bounded retry handling and no public/browser access.
-- 3. Keep staff notes, private review media, portal tokens, customer contact details, and delivery errors out of public routes and browser queues.
-- 4. Require an authenticated token-validated customer action or a qualified staff action; delivery itself runs only from a separately protected scheduler function.
--
-- This migration intentionally starts with email only. SMS is not enabled by this schema.

begin;

create table if not exists public.customer_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  contact_email text,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','granted','withdrawn','expired')),
  live_work_update_opt_in boolean not null default false,
  consent_source text not null default 'customer_portal',
  consent_captured_at timestamptz,
  consent_withdrawn_at timestamptz,
  last_changed_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, channel)
);
create index if not exists customer_notification_preferences_client_idx
  on public.customer_notification_preferences(client_id, consent_status, live_work_update_opt_in);

create table if not exists public.customer_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  quote_package_id uuid not null references public.estimate_quote_packages(id) on delete cascade,
  live_update_id uuid not null references public.work_order_live_updates(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued','sending','sent','retry_scheduled','failed','manual_review','blocked','cancelled')),
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  not_before_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  provider_name text,
  provider_message_id text,
  last_error text,
  last_response_code integer,
  cancelled_at timestamptz,
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(live_update_id, channel)
);
create index if not exists customer_notification_outbox_dispatch_idx
  on public.customer_notification_outbox(delivery_status, next_attempt_at, created_at);
create index if not exists customer_notification_outbox_client_idx
  on public.customer_notification_outbox(client_id, created_at desc);

create table if not exists public.customer_notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.customer_notification_outbox(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  provider_name text not null default 'resend',
  attempt_status text not null check (attempt_status in ('sent','retry_scheduled','failed','manual_review','blocked')),
  provider_message_id text,
  response_code integer,
  error_summary text,
  attempted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(outbox_id, attempt_number)
);
create index if not exists customer_notification_delivery_attempts_outbox_idx
  on public.customer_notification_delivery_attempts(outbox_id, attempted_at desc);

-- Schema 155 intentionally restricted notification status values. Schema 156 adds
-- consent and delivery lifecycle states while retaining every prior valid value.
alter table public.work_order_live_updates
  drop constraint if exists work_order_live_updates_customer_notification_status_check;
alter table public.work_order_live_updates
  add constraint work_order_live_updates_customer_notification_status_check
  check (customer_notification_status in (
    'not_requested','queued','sent','not_available','failed',
    'pending_consent','retry_scheduled','manual_review','opted_out'
  ));

alter table public.customer_notification_preferences enable row level security;
alter table public.customer_notification_outbox enable row level security;
alter table public.customer_notification_delivery_attempts enable row level security;

revoke all on public.customer_notification_preferences, public.customer_notification_outbox, public.customer_notification_delivery_attempts from anon, authenticated;

-- The queue intentionally excludes e-mail addresses and portal tokens. It is loaded
-- only through operations-manage after a JWT + role check.
create or replace view public.v_customer_notification_delivery_queue
with (security_barrier=true)
as
select
  o.id,
  o.client_id,
  o.work_order_id,
  o.quote_package_id,
  o.live_update_id,
  o.channel,
  o.delivery_status,
  o.requested_at,
  o.not_before_at,
  o.next_attempt_at,
  o.last_attempt_at,
  o.sent_at,
  o.attempt_count,
  o.max_attempts,
  o.provider_name,
  o.provider_message_id,
  o.last_error,
  o.last_response_code,
  o.cancelled_at,
  o.cancellation_reason,
  wo.work_order_number,
  wo.status as work_order_status,
  coalesce(c.display_name,c.legal_name) as client_name,
  u.title as live_update_title,
  u.update_type,
  u.occurred_at as live_update_occurred_at,
  u.customer_notification_status as live_update_notification_status,
  p.consent_status,
  p.live_work_update_opt_in,
  (coalesce(p.contact_email,'') <> '') as contact_email_configured,
  o.created_at,
  o.updated_at
from public.customer_notification_outbox o
join public.work_orders wo on wo.id=o.work_order_id
join public.work_order_live_updates u on u.id=o.live_update_id
left join public.clients c on c.id=o.client_id
left join public.customer_notification_preferences p on p.client_id=o.client_id and p.channel=o.channel
order by
  case o.delivery_status
    when 'manual_review' then 1
    when 'failed' then 2
    when 'retry_scheduled' then 3
    when 'queued' then 4
    else 5
  end,
  o.next_attempt_at asc,
  o.created_at desc;

-- Customer portal preference change. The token must match a currently enabled
-- quote package. This is explicit opt-in/out; it does not backfill old messages.
create or replace function public.ywi_rpc_set_customer_live_update_email_preference(
  p_quote_package_id uuid,
  p_portal_token text,
  p_enable boolean,
  p_contact_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.estimate_quote_packages%rowtype;
  v_client public.clients%rowtype;
  v_email text;
  v_pref public.customer_notification_preferences%rowtype;
  v_cancelled integer := 0;
begin
  select * into v_pkg
  from public.estimate_quote_packages
  where id=p_quote_package_id
    and public_token=p_portal_token
    and coalesce(portal_enabled,false)=true
  for update;
  if not found then
    raise exception 'This customer portal link is unavailable.' using errcode='42501';
  end if;
  if v_pkg.client_id is null then
    raise exception 'This quote is not linked to a customer record.' using errcode='P0002';
  end if;

  select * into v_client from public.clients where id=v_pkg.client_id;
  v_email := lower(trim(coalesce(nullif(p_contact_email,''), nullif(v_pkg.client_email,''), nullif(v_client.billing_email,''))));
  if p_enable and (v_email = '' or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Enter a valid email address before enabling live service update email.' using errcode='22023';
  end if;

  insert into public.customer_notification_preferences(
    client_id, channel, contact_email, consent_status, live_work_update_opt_in,
    consent_source, consent_captured_at, consent_withdrawn_at, metadata
  ) values (
    v_pkg.client_id, 'email',
    case when p_enable then v_email else null end,
    case when p_enable then 'granted' else 'withdrawn' end,
    p_enable, 'customer_portal',
    case when p_enable then now() else null end,
    case when p_enable then null else now() end,
    jsonb_build_object('schema',156,'source','customer_portal','quote_package_id',v_pkg.id)
  )
  on conflict (client_id, channel) do update set
    contact_email=case when excluded.live_work_update_opt_in then excluded.contact_email else public.customer_notification_preferences.contact_email end,
    consent_status=excluded.consent_status,
    live_work_update_opt_in=excluded.live_work_update_opt_in,
    consent_source=excluded.consent_source,
    consent_captured_at=case when excluded.live_work_update_opt_in then now() else public.customer_notification_preferences.consent_captured_at end,
    consent_withdrawn_at=case when excluded.live_work_update_opt_in then null else now() end,
    metadata=coalesce(public.customer_notification_preferences.metadata,'{}'::jsonb) || excluded.metadata,
    updated_at=now()
  returning * into v_pref;

  if not p_enable then
    update public.customer_notification_outbox
    set delivery_status='cancelled',
        cancelled_at=now(),
        cancellation_reason='customer_opted_out',
        updated_at=now()
    where client_id=v_pkg.client_id
      and channel='email'
      and delivery_status in ('queued','retry_scheduled');
    get diagnostics v_cancelled = row_count;

    update public.work_order_live_updates u
    set customer_notification_status='opted_out',
        updated_at=now()
    where u.id in (
      select live_update_id from public.customer_notification_outbox
      where client_id=v_pkg.client_id
        and channel='email'
        and cancellation_reason='customer_opted_out'
        and cancelled_at >= now() - interval '5 minutes'
    )
    and u.update_status='published';
  end if;

  insert into public.customer_portal_events(
    quote_package_id, estimate_id, work_order_id, event_type, event_status, event_note, event_payload
  ) values (
    v_pkg.id, v_pkg.estimate_id, v_pkg.converted_work_order_id,
    'live_update_notification_preference_updated', 'completed',
    case when p_enable then 'Customer opted in to live service update email.' else 'Customer opted out of live service update email.' end,
    jsonb_build_object('schema',156,'enabled',p_enable,'channel','email','email_configured',coalesce(v_pref.contact_email,'') <> '','cancelled_pending_count',v_cancelled)
  );

  return jsonb_build_object(
    'live_work_update_email_opt_in',v_pref.live_work_update_opt_in,
    'consent_status',v_pref.consent_status,
    'email_configured',coalesce(v_pref.contact_email,'') <> '',
    'cancelled_pending_count',v_cancelled,
    'message',case when p_enable
      then 'Live service update email is enabled for future customer-visible updates.'
      else 'Live service update email is off. Queued messages that had not been sent were cancelled.'
    end
  );
end;
$$;

-- Creates one non-duplicated delivery record after a supervisor has deliberately
-- published a customer-visible update and current consent exists.
create or replace function public.ywi_rpc_enqueue_customer_live_update_notification(
  p_live_update_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_update public.work_order_live_updates%rowtype;
  v_pkg public.estimate_quote_packages%rowtype;
  v_pref public.customer_notification_preferences%rowtype;
  v_outbox public.customer_notification_outbox%rowtype;
begin
  if v_rank < 30 then
    raise exception 'Only a supervisor or higher may queue a customer notification.' using errcode='42501';
  end if;
  select * into v_update from public.work_order_live_updates where id=p_live_update_id for update;
  if not found then raise exception 'Live work update not found.' using errcode='P0002'; end if;
  if v_update.visibility <> 'customer' or v_update.update_status <> 'published' then
    raise exception 'Only published customer-visible live updates can be queued for delivery.' using errcode='P0001';
  end if;
  if v_update.client_id is null then
    update public.work_order_live_updates set customer_notification_status='not_available', updated_at=now() where id=v_update.id;
    return jsonb_build_object('queued',false,'status','not_available','message','No customer record is linked to this update.');
  end if;

  select * into v_pkg
  from public.estimate_quote_packages
  where estimate_id=(select estimate_id from public.work_orders where id=v_update.work_order_id)
    and coalesce(portal_enabled,false)=true
    and coalesce(public_token,'') <> ''
  order by created_at desc
  limit 1;
  if not found then
    update public.work_order_live_updates set customer_notification_status='not_available', updated_at=now() where id=v_update.id;
    return jsonb_build_object('queued',false,'status','not_available','message','A current secure customer portal link is required before an email notification can be queued.');
  end if;

  select * into v_pref
  from public.customer_notification_preferences
  where client_id=v_update.client_id and channel='email'
  for update;
  if not found or v_pref.consent_status <> 'granted' or not v_pref.live_work_update_opt_in
     or coalesce(v_pref.contact_email,'') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    update public.work_order_live_updates set customer_notification_status='pending_consent', updated_at=now() where id=v_update.id;
    return jsonb_build_object('queued',false,'status','pending_consent','message','The customer has not explicitly enabled live service update email. The portal can collect opt-in before a future update is sent.');
  end if;

  insert into public.customer_notification_outbox(
    client_id, work_order_id, quote_package_id, live_update_id, channel,
    delivery_status, requested_by_profile_id, not_before_at, next_attempt_at, metadata
  ) values (
    v_update.client_id, v_update.work_order_id, v_pkg.id, v_update.id, 'email',
    'queued', p_actor_profile_id, now(), now(),
    jsonb_build_object('schema',156,'source','operations-manage','consent_verified_at',now())
  )
  on conflict (live_update_id, channel) do update set
    updated_at=now()
  returning * into v_outbox;

  update public.work_order_live_updates
  set customer_notification_status=case
        when v_outbox.delivery_status='sent' then 'sent'
        when v_outbox.delivery_status='manual_review' then 'manual_review'
        when v_outbox.delivery_status='failed' then 'failed'
        when v_outbox.delivery_status='cancelled' then 'opted_out'
        else 'queued'
      end,
      updated_at=now()
  where id=v_update.id;

  return jsonb_build_object(
    'queued',v_outbox.delivery_status in ('queued','retry_scheduled'),
    'status',v_outbox.delivery_status,
    'outbox_id',v_outbox.id,
    'message',case when v_outbox.delivery_status='sent'
      then 'This customer update was already sent.'
      else 'Customer notification queued. Delivery will occur only when the protected dispatcher is enabled.'
    end
  );
end;
$$;

-- Claims one queued email for the scheduler. It resolves the recipient and secure
-- portal link only inside the service-role function response; the queue view never
-- exposes either value.
create or replace function public.ywi_rpc_claim_customer_notification(
  p_outbox_id uuid,
  p_dispatch_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox public.customer_notification_outbox%rowtype;
  v_pref public.customer_notification_preferences%rowtype;
  v_pkg public.estimate_quote_packages%rowtype;
  v_update public.work_order_live_updates%rowtype;
  v_email text;
begin
  select * into v_outbox from public.customer_notification_outbox where id=p_outbox_id for update;
  if not found then return jsonb_build_object('claimed',false,'status','missing'); end if;
  if v_outbox.delivery_status not in ('queued','retry_scheduled') or v_outbox.next_attempt_at > now() then
    return jsonb_build_object('claimed',false,'status',v_outbox.delivery_status);
  end if;
  if length(coalesce(p_dispatch_key,'')) < 24 then
    raise exception 'Protected dispatcher credential is required.' using errcode='42501';
  end if;
  select * into v_pref from public.customer_notification_preferences where client_id=v_outbox.client_id and channel='email' for update;
  select * into v_pkg from public.estimate_quote_packages where id=v_outbox.quote_package_id;
  select * into v_update from public.work_order_live_updates where id=v_outbox.live_update_id;

  if v_update.id is null or v_update.visibility <> 'customer' or v_update.update_status <> 'published' then
    update public.customer_notification_outbox
    set delivery_status='cancelled', cancelled_at=now(), cancellation_reason='live_update_not_customer_visible',
        last_error='The linked live update is no longer customer-visible.', updated_at=now()
    where id=v_outbox.id;
    update public.work_order_live_updates
    set customer_notification_status='not_available', updated_at=now()
    where id=v_outbox.live_update_id;
    return jsonb_build_object('claimed',false,'status','cancelled');
  end if;

  v_email := lower(trim(coalesce(v_pref.contact_email,'')));
  if v_pref.id is null or v_pref.consent_status <> 'granted' or not v_pref.live_work_update_opt_in
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or v_pkg.id is null or coalesce(v_pkg.portal_enabled,false)=false or coalesce(v_pkg.public_token,'')='' then
    update public.customer_notification_outbox
    set delivery_status='blocked', last_error='Current consent, e-mail, or secure portal link is unavailable.', updated_at=now()
    where id=v_outbox.id;
    update public.work_order_live_updates set customer_notification_status='pending_consent', updated_at=now() where id=v_outbox.live_update_id;
    return jsonb_build_object('claimed',false,'status','blocked');
  end if;

  update public.customer_notification_outbox
  set delivery_status='sending',
      attempt_count=attempt_count+1,
      last_attempt_at=now(),
      provider_name='resend',
      updated_at=now()
  where id=v_outbox.id
  returning * into v_outbox;

  return jsonb_build_object(
    'claimed',true,
    'outbox_id',v_outbox.id,
    'attempt_number',v_outbox.attempt_count,
    'recipient_email',v_email,
    'public_token',v_pkg.public_token,
    'title',v_update.title,
    'message',coalesce(v_update.message,''),
    'work_order_number',(select work_order_number from public.work_orders where id=v_outbox.work_order_id)
  );
end;
$$;

-- Finalizes a claimed attempt. Network uncertainty becomes manual_review instead
-- of an automatic resend, which avoids silently mailing the same update twice.
create or replace function public.ywi_rpc_complete_customer_notification(
  p_outbox_id uuid,
  p_result_status text,
  p_provider_name text default 'resend',
  p_provider_message_id text default null,
  p_response_code integer default null,
  p_error_summary text default null,
  p_retry_after_seconds integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outbox public.customer_notification_outbox%rowtype;
  v_result text := lower(trim(coalesce(p_result_status,'')));
  v_next timestamptz;
  v_update_status text;
begin
  if v_result not in ('sent','retry_scheduled','failed','manual_review','blocked') then
    raise exception 'Unsupported delivery result.' using errcode='22023';
  end if;
  select * into v_outbox from public.customer_notification_outbox where id=p_outbox_id for update;
  if not found then raise exception 'Notification outbox item not found.' using errcode='P0002'; end if;
  if v_outbox.delivery_status <> 'sending' then
    return jsonb_build_object('completed',false,'status',v_outbox.delivery_status,'message','This notification is no longer claimed for delivery.');
  end if;
  if v_result='retry_scheduled' and v_outbox.attempt_count >= v_outbox.max_attempts then
    v_result := 'manual_review';
  end if;

  v_next := case when v_result='retry_scheduled'
    then now() + make_interval(secs => greatest(60,least(coalesce(p_retry_after_seconds,300),14400)))
    else null end;
  v_update_status := case v_result
    when 'sent' then 'sent'
    when 'retry_scheduled' then 'retry_scheduled'
    when 'manual_review' then 'manual_review'
    when 'blocked' then 'pending_consent'
    else 'failed'
  end;

  update public.customer_notification_outbox
  set delivery_status=v_result,
      provider_name=coalesce(nullif(p_provider_name,''),provider_name),
      provider_message_id=coalesce(nullif(p_provider_message_id,''),provider_message_id),
      last_response_code=p_response_code,
      last_error=nullif(left(trim(coalesce(p_error_summary,'')),2000),''),
      sent_at=case when v_result='sent' then now() else sent_at end,
      next_attempt_at=coalesce(v_next,next_attempt_at),
      updated_at=now()
  where id=v_outbox.id
  returning * into v_outbox;

  insert into public.customer_notification_delivery_attempts(
    outbox_id, attempt_number, provider_name, attempt_status, provider_message_id,
    response_code, error_summary, metadata
  ) values (
    v_outbox.id, v_outbox.attempt_count, coalesce(nullif(p_provider_name,''),'resend'), v_result,
    nullif(p_provider_message_id,''), p_response_code,
    nullif(left(trim(coalesce(p_error_summary,'')),2000),''),
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('schema',156)
  )
  on conflict (outbox_id, attempt_number) do update set
    provider_name=excluded.provider_name,
    attempt_status=excluded.attempt_status,
    provider_message_id=excluded.provider_message_id,
    response_code=excluded.response_code,
    error_summary=excluded.error_summary,
    metadata=excluded.metadata;

  update public.work_order_live_updates
  set customer_notification_status=v_update_status,
      customer_notified_at=case when v_result='sent' then now() else customer_notified_at end,
      updated_at=now()
  where id=v_outbox.live_update_id;

  return jsonb_build_object(
    'completed',true,'outbox_id',v_outbox.id,'status',v_outbox.delivery_status,
    'attempt_number',v_outbox.attempt_count,'next_attempt_at',v_outbox.next_attempt_at
  );
end;
$$;

-- Recover interrupted scheduler claims without automatically resending them.
-- Only claims older than fifteen minutes are moved to manual review. A reviewer
-- must explicitly decide whether a new delivery attempt is safe.
create or replace function public.ywi_rpc_recover_stale_customer_notification_claims(
  p_dispatch_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_recovered integer := 0;
begin
  if length(coalesce(p_dispatch_key,'')) < 24 then
    raise exception 'Protected dispatcher credential is required.' using errcode='42501';
  end if;
  for v_row in
    update public.customer_notification_outbox
    set delivery_status='manual_review',
        last_error=coalesce(nullif(last_error,''),'') || case when coalesce(last_error,'')='' then '' else ' | ' end || 'Delivery claim timed out; verify provider status before retrying.',
        updated_at=now()
    where delivery_status='sending'
      and last_attempt_at < now() - interval '15 minutes'
    returning live_update_id
  loop
    update public.work_order_live_updates
    set customer_notification_status='manual_review', updated_at=now()
    where id=v_row.live_update_id;
    v_recovered := v_recovered + 1;
  end loop;
  return jsonb_build_object('recovered',v_recovered,'status','manual_review');
end;
$$;

-- Manual retry is intentionally job-admin-only. It never re-sends a completed item
-- and still rechecks consent at dispatch time.
create or replace function public.ywi_rpc_retry_customer_notification(
  p_outbox_id uuid,
  p_actor_profile_id uuid,
  p_retry_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_outbox public.customer_notification_outbox%rowtype;
  v_pref public.customer_notification_preferences%rowtype;
begin
  if v_rank < 45 then
    raise exception 'Only a job admin or higher may retry a customer notification.' using errcode='42501';
  end if;
  select * into v_outbox from public.customer_notification_outbox where id=p_outbox_id for update;
  if not found then raise exception 'Notification outbox item not found.' using errcode='P0002'; end if;
  if v_outbox.delivery_status='sent' then
    return jsonb_build_object('queued',false,'status','sent','message','A sent customer notification cannot be retried automatically.');
  end if;
  if v_outbox.attempt_count >= v_outbox.max_attempts then
    raise exception 'Maximum delivery attempts reached. Review the customer contact details before creating a new customer-visible update.' using errcode='P0001';
  end if;
  select * into v_pref from public.customer_notification_preferences where client_id=v_outbox.client_id and channel='email';
  if not found or v_pref.consent_status <> 'granted' or not v_pref.live_work_update_opt_in then
    update public.customer_notification_outbox set delivery_status='blocked', last_error='Customer has not currently opted in.', updated_at=now() where id=v_outbox.id;
    update public.work_order_live_updates set customer_notification_status='pending_consent', updated_at=now() where id=v_outbox.live_update_id;
    return jsonb_build_object('queued',false,'status','blocked','message','Customer consent is no longer current.');
  end if;

  update public.customer_notification_outbox
  set delivery_status='queued',
      next_attempt_at=now(),
      last_error=coalesce(last_error,'') || case when coalesce(p_retry_note,'')<>'' then ' | Manual retry: ' || left(trim(p_retry_note),800) else '' end,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('last_manual_retry_by',p_actor_profile_id,'last_manual_retry_at',now()),
      updated_at=now()
  where id=v_outbox.id
  returning * into v_outbox;
  update public.work_order_live_updates set customer_notification_status='queued', updated_at=now() where id=v_outbox.live_update_id;
  return jsonb_build_object('queued',true,'outbox_id',v_outbox.id,'status','queued','message','Customer notification re-queued for the protected dispatcher.');
end;
$$;

create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations'),
           ('work_order_live_updates'),('work_order_live_update_media'),('customer_notification_preferences'),('customer_notification_outbox'),('customer_notification_delivery_attempts')
  ), checks as (
    select 'review_assets_private'::text as assertion_key,
      case when exists(select 1 from storage.buckets where id='review-assets' and public=false) then 'passed' else 'failed' end as assertion_status,
      'Review uploads must remain in a private bucket until approved.'::text as details
    union all select 'accountant_exports_private', case when exists(select 1 from storage.buckets where id='accountant-exports' and public=false) then 'passed' else 'failed' end,
      'Accountant ZIP packages must remain private and use signed downloads.'
    union all select 'public_assets_bucket_present', case when exists(select 1 from storage.buckets where id='public-assets' and public=true) then 'passed' else 'failed' end,
      'Public assets may be public only after the approval-copy workflow promotes them.'
    union all select 'sensitive_tables_rls_enabled', case when not exists(
      select 1 from required_tables r left join pg_class c on c.relname=r.table_name and c.relnamespace='public'::regnamespace where coalesce(c.relrowsecurity,false)=false
    ) then 'passed' else 'failed' end,
      'Sensitive direct-data tables must have Row Level Security enabled.'
    union all select 'portal_rpc_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public' and rp.routine_name='ywi_rpc_accept_quote_package' and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Portal conversion RPC is callable only through the token-validating service function.'
    union all select 'customer_notification_tables_rls_enabled', case when not exists(
      select 1 from (values ('customer_notification_preferences'),('customer_notification_outbox'),('customer_notification_delivery_attempts')) as n(table_name)
      left join pg_class c on c.relname=n.table_name and c.relnamespace='public'::regnamespace
      where coalesce(c.relrowsecurity,false)=false
    ) then 'passed' else 'failed' end,
      'Customer notification consent and delivery records must not be directly readable by browser roles.'
    union all select 'customer_notification_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in (
          'ywi_rpc_set_customer_live_update_email_preference',
          'ywi_rpc_enqueue_customer_live_update_notification',
          'ywi_rpc_claim_customer_notification',
          'ywi_rpc_complete_customer_notification',
          'ywi_rpc_recover_stale_customer_notification_claims',
          'ywi_rpc_retry_customer_notification'
        )
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Customer notification records are written only through token-validating or authenticated service functions.'
    union all select 'live_update_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_create_work_order_live_update','ywi_rpc_retract_work_order_live_update')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Live job updates are written only by the authenticated role-checking service function.'
  ) select * from checks;
$$;

create or replace function public.ywi_get_operations_capabilities(p_actor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce((select role from public.profiles where id = p_actor_profile_id and coalesce(is_active,true) is true), ''));
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id), 0);
  v_actions jsonb;
begin
  select coalesce(jsonb_object_agg(action_key,
    jsonb_build_object(
      'label', label,
      'minimum_role', minimum_role,
      'minimum_rank', minimum_rank,
      'permitted', v_rank >= minimum_rank,
      'reason', case when v_rank >= minimum_rank then 'Allowed for your role.' else 'Requires ' || replace(minimum_role, '_', ' ') || ' or higher.' end
    )
  ), '{}'::jsonb)
  into v_actions
  from (values
    ('payment_action_request','Create payment action','job_admin',45),
    ('payment_action_decision','Approve, reject, or post payment','job_admin',45),
    ('bank_csv_preview','Parse bank CSV','job_admin',45),
    ('bank_csv_confirm_import','Promote confirmed bank rows','job_admin',45),
    ('reconciliation_action','Process reconciliation','job_admin',45),
    ('equipment_scan_event','Record equipment custody scan','site_leader',20),
    ('equipment_cost_recovery_decision','Approve equipment recovery','job_admin',45),
    ('visual_asset_register','Register visual asset','supervisor',30),
    ('visual_asset_decision','Approve or reject visual asset','job_admin',45),
    ('public_route_register','Save public route','job_admin',45),
    ('public_route_decision','Approve or reject public route','job_admin',45),
    ('public_route_publish','Publish public route and sitemap','job_admin',45),
    ('quote_owner_assign','Assign quote owner','supervisor',30),
    ('quote_followup_event','Record quote follow-up','supervisor',30),
    ('dispatch_schedule','Dispatch work order','supervisor',30),
    ('job_cost_refresh','Refresh live job cost','supervisor',30),
    ('work_order_live_update','Record live work update','site_leader',20),
    ('work_order_live_update_retract','Retract live work update','supervisor',30),
    ('customer_notification_retry','Retry customer notification','job_admin',45),
    ('accountant_export_prepare','Generate accountant package','job_admin',45),
    ('staging_fixture_create','Create disposable staging fixture','job_admin',45),
    ('staging_fixture_cleanup','Clean disposable staging fixture','job_admin',45),
    ('content_signal_record','Record search/local performance evidence','job_admin',45),
    ('content_signal_decision','Decide route/content follow-up','job_admin',45),
    ('stripe_webhook_alert_decision','Acknowledge or resolve webhook alert','job_admin',45),
    ('release_readiness_snapshot','Capture release evidence snapshot','job_admin',45)
  ) as permissions(action_key, label, minimum_role, minimum_rank);
  return jsonb_build_object('actor_profile_id',p_actor_profile_id,'actor_role',coalesce(v_role,'unknown'),'actor_rank',v_rank,'actions',v_actions,'generated_at',now());
end;
$$;

-- Existing status view column shape is retained for schema 154 compatibility.
create or replace view public.v_schema_drift_status as
select 156::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=156 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=156
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 156.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'customer_live_update_notifications','customer_experience','Consent-controlled customer live-update email','active',86,6,7,
  'In staging, record an explicit portal opt-in, publish one customer-visible update, run the protected dispatcher, and verify no staff-only data reaches the email.',
  'Supervisor / job admin',66,'{"build":"2026-07-07a","schema":156,"human_review":true,"channel":"email_only"}'::jsonb
)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

insert into public.app_schema_versions(
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  156,
  '156_customer_notification_consent_outbox_delivery',
  '156_customer_notification_consent_outbox_delivery.sql',
  '2026-07-07a',
  'Adds explicit portal-controlled e-mail consent, a private live-update notification outbox, bounded retry/manual-review handling, and protected delivery RPCs.',
  'applied',
  'Schema 156 sends no automatic customer e-mail until explicit consent and delivery configuration both exist. SMS is intentionally out of scope.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label,
  description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_rpc_set_customer_live_update_email_preference(uuid,text,boolean,text) from public;
revoke all on function public.ywi_rpc_enqueue_customer_live_update_notification(uuid,uuid) from public;
revoke all on function public.ywi_rpc_claim_customer_notification(uuid,text) from public;
revoke all on function public.ywi_rpc_complete_customer_notification(uuid,text,text,text,integer,text,integer,jsonb) from public;
revoke all on function public.ywi_rpc_recover_stale_customer_notification_claims(text) from public;
revoke all on function public.ywi_rpc_retry_customer_notification(uuid,uuid,text) from public;
grant execute on function public.ywi_rpc_set_customer_live_update_email_preference(uuid,text,boolean,text) to service_role;
grant execute on function public.ywi_rpc_enqueue_customer_live_update_notification(uuid,uuid) to service_role;
grant execute on function public.ywi_rpc_claim_customer_notification(uuid,text) to service_role;
grant execute on function public.ywi_rpc_complete_customer_notification(uuid,text,text,text,integer,text,integer,jsonb) to service_role;
grant execute on function public.ywi_rpc_recover_stale_customer_notification_claims(text) to service_role;
grant execute on function public.ywi_rpc_retry_customer_notification(uuid,uuid,text) to service_role;
grant select on public.v_customer_notification_delivery_queue to service_role;
revoke all on public.v_customer_notification_delivery_queue from anon, authenticated;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_security_policy_assertions() to service_role;

commit;
