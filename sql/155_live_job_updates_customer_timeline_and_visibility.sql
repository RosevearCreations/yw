-- Schema 155: Live work updates, customer-visible progress timeline, private/staff note separation,
-- approved-media attachments, and operational visibility guardrails.
-- Build 2026-07-05a.
--
-- Purpose:
-- 1. Give field teams a concise, auditable way to record arrival, progress, delay, access, and completion updates.
-- 2. Let customers see only deliberately customer-visible, published updates through an existing token-protected portal.
-- 3. Keep staff-only notes and unapproved/private media out of the customer surface.
-- 4. Attach only approved public visual assets to customer-visible updates.
-- 5. Preserve existing payment, release-evidence, media-approval, and portal-token controls.

begin;

create table if not exists public.work_order_live_updates (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'staff',
  update_type text not null default 'progress',
  update_status text not null default 'published',
  title text not null,
  message text,
  occurred_at timestamptz not null default now(),
  progress_percent numeric(5,2),
  customer_notification_status text not null default 'not_requested',
  customer_notified_at timestamptz,
  retracted_at timestamptz,
  retracted_by_profile_id uuid references public.profiles(id) on delete set null,
  retraction_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility in ('customer','staff')),
  check (update_type in ('arrival','progress','delay','access','completion','note')),
  check (update_status in ('published','retracted')),
  check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  check (customer_notification_status in ('not_requested','queued','sent','not_available','failed'))
);

create index if not exists work_order_live_updates_order_idx
  on public.work_order_live_updates(work_order_id, occurred_at desc, created_at desc);
create index if not exists work_order_live_updates_customer_idx
  on public.work_order_live_updates(client_id, visibility, update_status, occurred_at desc);
create index if not exists work_order_live_updates_staff_queue_idx
  on public.work_order_live_updates(update_status, visibility, occurred_at desc);

create table if not exists public.work_order_live_update_media (
  id uuid primary key default gen_random_uuid(),
  live_update_id uuid not null references public.work_order_live_updates(id) on delete cascade,
  visual_asset_id uuid not null references public.visual_asset_approval_items(id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(live_update_id, visual_asset_id)
);
create index if not exists work_order_live_update_media_update_idx
  on public.work_order_live_update_media(live_update_id, display_order, created_at);

alter table public.work_order_live_updates enable row level security;
alter table public.work_order_live_update_media enable row level security;
revoke all on public.work_order_live_updates, public.work_order_live_update_media from anon, authenticated;

-- This view is intentionally not granted to browser roles. Customer portal reads
-- it only through its token-validating service-role Edge Function.
create or replace view public.v_customer_portal_live_updates
with (security_barrier=true)
as
select
  u.id as live_update_id,
  u.work_order_id,
  u.update_type,
  u.title,
  u.message,
  u.occurred_at,
  u.progress_percent,
  u.customer_notification_status,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'asset_id', a.id,
        'url', a.public_url,
        'thumbnail_url', coalesce(a.thumbnail_url, a.public_url),
        'alt_text', coalesce(a.alt_text, u.title),
        'width', a.pixel_width,
        'height', a.pixel_height
      )
      order by m.display_order, m.created_at
    ) filter (
      where a.id is not null
        and a.asset_status = 'approved'
        and coalesce(a.public_url,'') <> ''
    ),
    '[]'::jsonb
  ) as media
from public.work_order_live_updates u
left join public.work_order_live_update_media m on m.live_update_id = u.id
left join public.visual_asset_approval_items a on a.id = m.visual_asset_id
where u.visibility='customer'
  and u.update_status='published'
group by
  u.id, u.work_order_id, u.update_type, u.title, u.message, u.occurred_at,
  u.progress_percent, u.customer_notification_status;

-- This staff queue exposes no direct private-storage path. It is fetched only by
-- operations-manage after an authenticated role check.
create or replace view public.v_work_order_live_update_queue
with (security_barrier=true)
as
select
  u.id,
  u.work_order_id,
  wo.work_order_number,
  wo.status as work_order_status,
  u.client_id,
  c.legal_name as client_name,
  u.visibility,
  u.update_type,
  u.update_status,
  u.title,
  u.message,
  u.occurred_at,
  u.progress_percent,
  u.customer_notification_status,
  u.customer_notified_at,
  p.full_name as author_name,
  u.retracted_at,
  u.retracted_by_profile_id,
  u.retraction_reason,
  count(m.id)::int as attached_asset_count,
  count(m.id) filter (where a.asset_status='approved' and coalesce(a.public_url,'') <> '')::int as approved_public_asset_count,
  u.created_at,
  u.updated_at
from public.work_order_live_updates u
join public.work_orders wo on wo.id=u.work_order_id
left join public.clients c on c.id=u.client_id
left join public.profiles p on p.id=u.author_profile_id
left join public.work_order_live_update_media m on m.live_update_id=u.id
left join public.visual_asset_approval_items a on a.id=m.visual_asset_id
group by
  u.id, wo.work_order_number, wo.status, c.legal_name, p.full_name
order by u.occurred_at desc, u.created_at desc;

create or replace function public.ywi_rpc_create_work_order_live_update(
  p_work_order_id uuid,
  p_actor_profile_id uuid,
  p_visibility text default 'staff',
  p_update_type text default 'progress',
  p_title text default null,
  p_message text default null,
  p_occurred_at timestamptz default null,
  p_progress_percent numeric default null,
  p_asset_ids uuid[] default '{}'::uuid[],
  p_customer_notification_requested boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_visibility text := lower(trim(coalesce(p_visibility,'staff')));
  v_type text := lower(trim(coalesce(p_update_type,'progress')));
  v_title text := left(trim(coalesce(p_title,'')),180);
  v_message text := nullif(left(trim(coalesce(p_message,'')),4000),'');
  v_work_order public.work_orders%rowtype;
  v_update public.work_order_live_updates%rowtype;
  v_quote_package_id uuid;
  v_assets uuid[];
  v_asset_count integer := 0;
  v_public_asset_count integer := 0;
  v_notification text := 'not_requested';
begin
  if v_rank < 20 then
    raise exception 'Only a site leader or higher may record a live work update.' using errcode='42501';
  end if;
  if v_visibility not in ('customer','staff') then
    raise exception 'Visibility must be customer or staff.' using errcode='22023';
  end if;
  if v_visibility='customer' and v_rank < 30 then
    raise exception 'Customer-visible updates require supervisor or higher.' using errcode='42501';
  end if;
  if v_type not in ('arrival','progress','delay','access','completion','note') then
    raise exception 'Unsupported live update type.' using errcode='22023';
  end if;
  if length(v_title) < 3 then
    raise exception 'Live update title must contain at least 3 characters.' using errcode='22023';
  end if;
  if p_progress_percent is not null and (p_progress_percent < 0 or p_progress_percent > 100) then
    raise exception 'Progress must be between 0 and 100.' using errcode='22023';
  end if;

  select * into v_work_order from public.work_orders where id=p_work_order_id for update;
  if not found then
    raise exception 'Work order not found.' using errcode='P0002';
  end if;

  select coalesce(array_agg(distinct asset_id), '{}'::uuid[])
  into v_assets
  from unnest(coalesce(p_asset_ids,'{}'::uuid[])) as asset_id;

  if cardinality(v_assets) > 8 then
    raise exception 'A live update can include at most 8 approved visual assets.' using errcode='22023';
  end if;
  select count(*)::int,
         count(*) filter (where asset_status='approved' and coalesce(public_url,'') <> '')::int
  into v_asset_count, v_public_asset_count
  from public.visual_asset_approval_items
  where id = any(v_assets);

  if v_asset_count <> cardinality(v_assets) then
    raise exception 'One or more selected visual assets do not exist.' using errcode='P0002';
  end if;
  if v_visibility='customer' and v_public_asset_count <> cardinality(v_assets) then
    raise exception 'Customer-visible updates may attach only approved assets with a public delivery URL.' using errcode='42501';
  end if;

  if p_customer_notification_requested and v_visibility='customer' then
    v_notification := 'queued';
  elsif p_customer_notification_requested then
    v_notification := 'not_available';
  end if;

  insert into public.work_order_live_updates(
    work_order_id, client_id, author_profile_id, visibility, update_type, update_status,
    title, message, occurred_at, progress_percent, customer_notification_status, metadata
  )
  values (
    v_work_order.id, v_work_order.client_id, p_actor_profile_id, v_visibility, v_type, 'published',
    v_title, v_message, coalesce(p_occurred_at,now()), p_progress_percent, v_notification,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('schema',155,'customer_notification_requested',coalesce(p_customer_notification_requested,false))
  )
  returning * into v_update;

  insert into public.work_order_live_update_media(live_update_id, visual_asset_id, display_order)
  select v_update.id, asset_id, (row_number() over ())::int
  from unnest(v_assets) as asset_id;

  if v_visibility='customer' then
    select id into v_quote_package_id
    from public.estimate_quote_packages
    where estimate_id=v_work_order.estimate_id
    order by created_at desc
    limit 1;

    insert into public.customer_portal_events(
      quote_package_id, estimate_id, work_order_id, event_type, event_status, event_note, event_payload
    )
    values (
      v_quote_package_id, v_work_order.estimate_id, v_work_order.id, 'live_work_update_published', 'completed',
      v_title, jsonb_build_object('live_update_id',v_update.id,'update_type',v_type,'visibility','customer','media_count',cardinality(v_assets),'schema',155)
    );
  end if;

  update public.work_orders
  set updated_at=now()
  where id=v_work_order.id;

  return jsonb_build_object(
    'live_update_id',v_update.id,
    'work_order_id',v_work_order.id,
    'visibility',v_update.visibility,
    'update_type',v_update.update_type,
    'update_status',v_update.update_status,
    'asset_count',cardinality(v_assets),
    'customer_notification_status',v_update.customer_notification_status,
    'message',case when v_visibility='customer'
      then 'Customer-visible work update published. It will appear in the existing secure portal when the customer refreshes.'
      else 'Staff-only work update saved. It is not visible through the customer portal.'
    end
  );
end;
$$;

create or replace function public.ywi_rpc_retract_work_order_live_update(
  p_live_update_id uuid,
  p_actor_profile_id uuid,
  p_retraction_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_update public.work_order_live_updates%rowtype;
begin
  if v_rank < 30 then
    raise exception 'Only a supervisor or higher may retract a live work update.' using errcode='42501';
  end if;
  select * into v_update from public.work_order_live_updates where id=p_live_update_id for update;
  if not found then
    raise exception 'Live work update not found.' using errcode='P0002';
  end if;
  if v_update.update_status='retracted' then
    return jsonb_build_object('already_retracted',true,'live_update_id',v_update.id,'message','Live work update was already retracted.');
  end if;

  update public.work_order_live_updates
  set update_status='retracted',
      retracted_at=now(),
      retracted_by_profile_id=p_actor_profile_id,
      retraction_reason=nullif(left(trim(coalesce(p_retraction_reason,'')),1000),''),
      customer_notification_status=case when visibility='customer' then 'not_available' else customer_notification_status end,
      updated_at=now()
  where id=v_update.id;

  if v_update.visibility='customer' then
    insert into public.customer_portal_events(
      estimate_id, work_order_id, event_type, event_status, event_note, event_payload
    )
    select w.estimate_id, v_update.work_order_id, 'live_work_update_retracted', 'completed',
           nullif(left(trim(coalesce(p_retraction_reason,'')),1000),''),
           jsonb_build_object('live_update_id',v_update.id,'schema',155)
    from public.work_orders w where w.id=v_update.work_order_id;
  end if;

  return jsonb_build_object('live_update_id',v_update.id,'retracted',true,'message','Live work update retracted. It is no longer visible in the customer portal.');
end;
$$;

-- Existing policy summary is extended rather than replaced with a parallel,
-- easy-to-miss check. It retains the same result shape consumed by schema 154.
create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations'),
           ('work_order_live_updates'),('work_order_live_update_media')
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

-- Capabilities retain server-side rank enforcement. These labels help the Cockpit
-- explain why customer-visible updates may be unavailable to a field role.
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

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'live_job_updates','customer_experience','Live job updates with customer/staff visibility','active',82,6,7,
  'Deploy schema 155, test staff-only versus customer-visible updates, then attach one approved public image to a portal update.',
  'Supervisor / field lead',65,'{"build":"2026-07-05a","schema":155,"human_review":true}'::jsonb
)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

-- Preserve the existing view shape so schema 154's dependent dashboard remains
-- valid; only the target version and message change.
create or replace view public.v_schema_drift_status as
select 155::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=155 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=155
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 155.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions(
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  155,
  '155_live_job_updates_customer_timeline_and_visibility',
  '155_live_job_updates_customer_timeline_and_visibility.sql',
  '2026-07-05a',
  'Adds controlled live work updates, customer/staff visibility, approved public media attachments, portal timeline rendering, and update retraction safeguards.',
  'applied',
  'Schema 155 keeps live field updates private by default, lets supervisors publish approved customer-visible updates, and preserves an auditable retraction path.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label,
  description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_rpc_create_work_order_live_update(uuid,uuid,text,text,text,text,timestamptz,numeric,uuid[],boolean,jsonb) from public;
revoke all on function public.ywi_rpc_retract_work_order_live_update(uuid,uuid,text) from public;
grant execute on function public.ywi_rpc_create_work_order_live_update(uuid,uuid,text,text,text,text,timestamptz,numeric,uuid[],boolean,jsonb) to service_role;
grant execute on function public.ywi_rpc_retract_work_order_live_update(uuid,uuid,text) to service_role;
-- The Edge Functions use the service role after authenticating the portal token or
-- staff JWT themselves. Browser roles receive no direct select permission.
grant select on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue to service_role;
revoke all on public.v_customer_portal_live_updates, public.v_work_order_live_update_queue from anon, authenticated;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_security_policy_assertions() to service_role;

commit;
