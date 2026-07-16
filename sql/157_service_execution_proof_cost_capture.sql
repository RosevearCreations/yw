begin;

-- 157_service_execution_proof_cost_capture.sql
-- Captures arrival/completion/service proof and internal labour/material/equipment use,
-- then compares approved actuals against the accepted work order estimate without exposing costs to the customer portal.

create table if not exists public.work_order_execution_proofs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  dispatch_schedule_item_id uuid references public.dispatch_schedule_items(id) on delete set null,
  proof_type text not null default 'progress',
  proof_status text not null default 'submitted',
  customer_visible boolean not null default false,
  title text not null,
  staff_notes text,
  customer_summary text,
  occurred_at timestamptz not null default now(),
  progress_percent numeric(5,2),
  labour_minutes integer not null default 0,
  labour_hourly_rate numeric(12,2) not null default 0,
  labour_cost_total numeric(12,2) not null default 0,
  material_cost_total numeric(12,2) not null default 0,
  equipment_cost_total numeric(12,2) not null default 0,
  other_cost_total numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  captured_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by_profile_id uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proof_type in ('arrival','progress','completion','quality','material','equipment','expense','note')),
  check (proof_status in ('submitted','approved','rejected','retracted')),
  check (progress_percent is null or (progress_percent >= 0 and progress_percent <= 100)),
  check (labour_minutes >= 0),
  check (labour_hourly_rate >= 0),
  check (labour_cost_total >= 0),
  check (material_cost_total >= 0),
  check (equipment_cost_total >= 0),
  check (other_cost_total >= 0),
  check (total_cost >= 0)
);

create index if not exists work_order_execution_proofs_order_idx
  on public.work_order_execution_proofs(work_order_id, proof_status, occurred_at desc, created_at desc);
create index if not exists work_order_execution_proofs_review_idx
  on public.work_order_execution_proofs(proof_status, customer_visible, occurred_at desc);

create table if not exists public.work_order_execution_proof_media (
  id uuid primary key default gen_random_uuid(),
  execution_proof_id uuid not null references public.work_order_execution_proofs(id) on delete cascade,
  visual_asset_id uuid not null references public.visual_asset_approval_items(id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(execution_proof_id, visual_asset_id)
);
create index if not exists work_order_execution_proof_media_proof_idx
  on public.work_order_execution_proof_media(execution_proof_id, display_order, created_at);

alter table public.work_order_execution_proofs enable row level security;
alter table public.work_order_execution_proof_media enable row level security;
revoke all on public.work_order_execution_proofs, public.work_order_execution_proof_media from anon, authenticated;

create or replace view public.v_work_order_execution_cost_dashboard
with (security_barrier=true)
as
with proof_costs as (
  select
    work_order_id,
    count(*) filter (where proof_status='submitted')::int as submitted_proof_count,
    count(*) filter (where proof_status='approved')::int as approved_proof_count,
    max(approved_at) filter (where proof_status='approved') as latest_approved_at,
    coalesce(sum(labour_cost_total) filter (where proof_status='approved'),0)::numeric(12,2) as labour_cost_total,
    coalesce(sum(material_cost_total) filter (where proof_status='approved'),0)::numeric(12,2) as material_cost_total,
    coalesce(sum(equipment_cost_total) filter (where proof_status='approved'),0)::numeric(12,2) as equipment_cost_total,
    coalesce(sum(other_cost_total) filter (where proof_status='approved'),0)::numeric(12,2) as other_cost_total,
    coalesce(sum(total_cost) filter (where proof_status='approved'),0)::numeric(12,2) as total_actual_cost
  from public.work_order_execution_proofs
  group by work_order_id
)
select
  wo.id as work_order_id,
  wo.work_order_number,
  wo.status as work_order_status,
  wo.legacy_job_id as job_id,
  wo.client_id,
  c.legal_name as client_name,
  wo.scheduled_start,
  wo.scheduled_end,
  coalesce(wo.total_amount, e.total_amount, 0)::numeric(12,2) as accepted_estimate_total,
  coalesce(wo.total_amount, e.total_amount, 0)::numeric(12,2) as revenue_total,
  coalesce(pc.labour_cost_total,0)::numeric(12,2) as labour_cost_total,
  coalesce(pc.material_cost_total,0)::numeric(12,2) as material_cost_total,
  coalesce(pc.equipment_cost_total,0)::numeric(12,2) as equipment_cost_total,
  coalesce(pc.other_cost_total,0)::numeric(12,2) as other_cost_total,
  coalesce(pc.total_actual_cost,0)::numeric(12,2) as total_actual_cost,
  (coalesce(wo.total_amount, e.total_amount, 0) - coalesce(pc.total_actual_cost,0))::numeric(12,2) as margin_amount,
  case when coalesce(wo.total_amount, e.total_amount, 0) > 0
       then round(((coalesce(wo.total_amount, e.total_amount, 0) - coalesce(pc.total_actual_cost,0)) / coalesce(wo.total_amount, e.total_amount, 0)) * 100, 2)
       else 0 end as margin_percent,
  coalesce(pc.submitted_proof_count,0)::int as submitted_proof_count,
  coalesce(pc.approved_proof_count,0)::int as approved_proof_count,
  pc.latest_approved_at,
  case
    when coalesce(pc.approved_proof_count,0)=0 then 'awaiting_approved_proof'
    when coalesce(pc.total_actual_cost,0) > coalesce(wo.total_amount, e.total_amount, 0) then 'over_estimate'
    when coalesce(wo.total_amount, e.total_amount, 0) > 0 and coalesce(pc.total_actual_cost,0) >= coalesce(wo.total_amount, e.total_amount, 0) * 0.85 then 'watch_margin'
    else 'on_track'
  end as cost_status,
  now() as calculated_at
from public.work_orders wo
left join public.estimates e on e.id=wo.estimate_id
left join public.clients c on c.id=wo.client_id
left join proof_costs pc on pc.work_order_id=wo.id
where wo.status not in ('cancelled','archived')
order by coalesce(wo.scheduled_start, wo.created_at) desc;

create or replace view public.v_work_order_execution_proof_queue
with (security_barrier=true)
as
select
  p.id,
  p.work_order_id,
  wo.work_order_number,
  wo.status as work_order_status,
  p.proof_type,
  p.proof_status,
  p.customer_visible,
  p.title,
  p.staff_notes,
  p.customer_summary,
  p.occurred_at,
  p.progress_percent,
  p.labour_minutes,
  p.labour_hourly_rate,
  p.labour_cost_total,
  p.material_cost_total,
  p.equipment_cost_total,
  p.other_cost_total,
  p.total_cost,
  c.legal_name as client_name,
  cap.full_name as captured_by_name,
  app.full_name as approved_by_name,
  p.approved_at,
  p.rejection_reason,
  count(pm.id)::int as attached_asset_count,
  count(pm.id) filter (where va.asset_status='approved' and coalesce(va.public_url,'') <> '')::int as approved_public_asset_count,
  cd.accepted_estimate_total,
  cd.total_actual_cost,
  cd.margin_amount,
  cd.margin_percent,
  cd.cost_status,
  p.created_at,
  p.updated_at
from public.work_order_execution_proofs p
join public.work_orders wo on wo.id=p.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.profiles cap on cap.id=p.captured_by_profile_id
left join public.profiles app on app.id=p.approved_by_profile_id
left join public.work_order_execution_proof_media pm on pm.execution_proof_id=p.id
left join public.visual_asset_approval_items va on va.id=pm.visual_asset_id
left join public.v_work_order_execution_cost_dashboard cd on cd.work_order_id=p.work_order_id
group by p.id, wo.id, c.legal_name, cap.full_name, app.full_name, cd.accepted_estimate_total, cd.total_actual_cost, cd.margin_amount, cd.margin_percent, cd.cost_status
order by case p.proof_status when 'submitted' then 0 when 'approved' then 1 else 2 end, p.occurred_at desc, p.created_at desc;

create or replace view public.v_customer_portal_execution_proofs
with (security_barrier=true)
as
select
  p.id as execution_proof_id,
  p.work_order_id,
  p.proof_type,
  p.title,
  p.customer_summary,
  p.occurred_at,
  p.progress_percent,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'asset_id', va.id,
        'url', va.public_url,
        'thumbnail_url', coalesce(va.thumbnail_url, va.public_url),
        'alt_text', coalesce(va.alt_text, p.title),
        'width', va.pixel_width,
        'height', va.pixel_height
      ) order by pm.display_order, pm.created_at
    ) filter (where va.id is not null and va.asset_status='approved' and coalesce(va.public_url,'') <> ''),
    '[]'::jsonb
  ) as media
from public.work_order_execution_proofs p
left join public.work_order_execution_proof_media pm on pm.execution_proof_id=p.id
left join public.visual_asset_approval_items va on va.id=pm.visual_asset_id
where p.proof_status='approved'
  and p.customer_visible is true
  and nullif(trim(coalesce(p.customer_summary,'')),'') is not null
group by p.id, p.work_order_id, p.proof_type, p.title, p.customer_summary, p.occurred_at, p.progress_percent;

revoke all on public.v_work_order_execution_cost_dashboard, public.v_work_order_execution_proof_queue, public.v_customer_portal_execution_proofs from anon, authenticated;
grant select on public.v_work_order_execution_cost_dashboard, public.v_work_order_execution_proof_queue, public.v_customer_portal_execution_proofs to service_role;

create or replace function public.ywi_rpc_submit_work_order_execution_proof(
  p_work_order_id uuid,
  p_actor_profile_id uuid,
  p_proof_type text default 'progress',
  p_title text default null,
  p_staff_notes text default null,
  p_customer_summary text default null,
  p_customer_visible boolean default false,
  p_occurred_at timestamptz default null,
  p_progress_percent numeric default null,
  p_asset_ids uuid[] default '{}'::uuid[],
  p_labour_minutes integer default 0,
  p_labour_hourly_rate numeric default 0,
  p_material_cost_total numeric default 0,
  p_equipment_cost_total numeric default 0,
  p_other_cost_total numeric default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_type text := lower(trim(coalesce(p_proof_type,'progress')));
  v_title text := left(trim(coalesce(p_title,'')),180);
  v_staff_notes text := nullif(left(trim(coalesce(p_staff_notes,'')),4000),'');
  v_customer_summary text := nullif(left(trim(coalesce(p_customer_summary,'')),1500),'');
  v_work_order public.work_orders%rowtype;
  v_assets uuid[];
  v_asset_count integer := 0;
  v_public_asset_count integer := 0;
  v_labour_minutes integer := greatest(coalesce(p_labour_minutes,0),0);
  v_labour_rate numeric := greatest(coalesce(p_labour_hourly_rate,0),0);
  v_labour_cost numeric := 0;
  v_material_cost numeric := greatest(coalesce(p_material_cost_total,0),0);
  v_equipment_cost numeric := greatest(coalesce(p_equipment_cost_total,0),0);
  v_other_cost numeric := greatest(coalesce(p_other_cost_total,0),0);
  v_total_cost numeric := 0;
  v_proof public.work_order_execution_proofs%rowtype;
begin
  if v_rank < 20 then
    raise exception 'Only a site leader or higher may capture service-execution proof.' using errcode='42501';
  end if;
  if v_type not in ('arrival','progress','completion','quality','material','equipment','expense','note') then
    raise exception 'Unsupported service-execution proof type.' using errcode='22023';
  end if;
  if length(v_title) < 3 then
    raise exception 'Execution proof title must contain at least 3 characters.' using errcode='22023';
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
    raise exception 'A proof can include at most 8 approved visual assets.' using errcode='22023';
  end if;

  select count(*)::int,
         count(*) filter (where asset_status='approved' and coalesce(public_url,'') <> '')::int
  into v_asset_count, v_public_asset_count
  from public.visual_asset_approval_items
  where id = any(v_assets);

  if v_asset_count <> cardinality(v_assets) then
    raise exception 'One or more selected visual assets do not exist.' using errcode='P0002';
  end if;
  if coalesce(p_customer_visible,false) and v_public_asset_count <> cardinality(v_assets) then
    raise exception 'Customer-visible execution proof may attach only approved assets with a public delivery URL.' using errcode='42501';
  end if;
  if coalesce(p_customer_visible,false) and v_customer_summary is null then
    raise exception 'Customer-visible execution proof requires a customer-safe summary.' using errcode='22023';
  end if;

  v_labour_cost := round((v_labour_minutes::numeric / 60.0) * v_labour_rate, 2);
  v_total_cost := round(v_labour_cost + v_material_cost + v_equipment_cost + v_other_cost, 2);

  insert into public.work_order_execution_proofs(
    work_order_id, proof_type, proof_status, customer_visible, title, staff_notes, customer_summary,
    occurred_at, progress_percent, labour_minutes, labour_hourly_rate, labour_cost_total,
    material_cost_total, equipment_cost_total, other_cost_total, total_cost,
    captured_by_profile_id, metadata
  ) values (
    v_work_order.id, v_type, 'submitted', coalesce(p_customer_visible,false), v_title, v_staff_notes, v_customer_summary,
    coalesce(p_occurred_at,now()), p_progress_percent, v_labour_minutes, v_labour_rate, v_labour_cost,
    v_material_cost, v_equipment_cost, v_other_cost, v_total_cost,
    p_actor_profile_id, coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('schema',157,'source','operations_cockpit')
  ) returning * into v_proof;

  insert into public.work_order_execution_proof_media(execution_proof_id, visual_asset_id, display_order)
  select v_proof.id, asset_id, (row_number() over ())::int
  from unnest(v_assets) as asset_id;

  update public.work_orders
  set updated_at=now()
  where id=v_work_order.id;

  return jsonb_build_object(
    'execution_proof_id',v_proof.id,
    'work_order_id',v_work_order.id,
    'proof_status',v_proof.proof_status,
    'total_cost',v_proof.total_cost,
    'customer_visible_after_approval',v_proof.customer_visible,
    'message','Execution proof captured for supervisor review. Internal costs are not visible in the customer portal.'
  );
end;
$$;

create or replace function public.ywi_rpc_decide_work_order_execution_proof(
  p_execution_proof_id uuid,
  p_actor_profile_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_decision text := lower(trim(coalesce(p_decision,'')));
  v_note text := nullif(left(trim(coalesce(p_decision_note,'')),1200),'');
  v_proof public.work_order_execution_proofs%rowtype;
  v_work_order public.work_orders%rowtype;
  v_cost record;
  v_snapshot_id uuid;
begin
  if v_rank < 30 then
    raise exception 'Only a supervisor or higher may approve or reject service-execution proof.' using errcode='42501';
  end if;
  if v_decision not in ('approve','reject') then
    raise exception 'Decision must be approve or reject.' using errcode='22023';
  end if;

  select * into v_proof from public.work_order_execution_proofs where id=p_execution_proof_id for update;
  if not found then
    raise exception 'Execution proof not found.' using errcode='P0002';
  end if;
  if v_proof.proof_status <> 'submitted' then
    return jsonb_build_object('execution_proof_id',v_proof.id,'already_decided',true,'proof_status',v_proof.proof_status,'message','Execution proof has already been decided.');
  end if;
  select * into v_work_order from public.work_orders where id=v_proof.work_order_id for update;

  if v_decision='reject' then
    update public.work_order_execution_proofs
    set proof_status='rejected', rejected_by_profile_id=p_actor_profile_id, rejected_at=now(), rejection_reason=coalesce(v_note,'Rejected during supervisor review.'), updated_at=now()
    where id=v_proof.id;
    return jsonb_build_object('execution_proof_id',v_proof.id,'proof_status','rejected','message','Execution proof rejected and excluded from actual job cost.');
  end if;

  update public.work_order_execution_proofs
  set proof_status='approved', approved_by_profile_id=p_actor_profile_id, approved_at=now(), updated_at=now()
  where id=v_proof.id
  returning * into v_proof;

  if v_proof.proof_type='arrival' and v_work_order.status in ('draft','scheduled','assigned') then
    update public.work_orders set status='in_progress', updated_at=now() where id=v_work_order.id;
  elsif v_proof.proof_type='completion' and v_work_order.status not in ('completed','cancelled','archived') then
    update public.work_orders set status='completed', updated_at=now() where id=v_work_order.id;
  else
    update public.work_orders set updated_at=now() where id=v_work_order.id;
  end if;

  if v_proof.customer_visible then
    insert into public.customer_portal_events(
      estimate_id, work_order_id, event_type, event_status, event_note, event_payload
    ) values (
      v_work_order.estimate_id, v_work_order.id, 'execution_proof_approved', 'completed', v_proof.customer_summary,
      jsonb_build_object('execution_proof_id',v_proof.id,'proof_type',v_proof.proof_type,'schema',157)
    );
  end if;

  select * into v_cost from public.v_work_order_execution_cost_dashboard where work_order_id=v_work_order.id;

  if v_cost.job_id is not null then
    insert into public.job_cost_live_snapshots(
      job_id, work_order_id, estimate_total, revenue_total, labour_cost_total,
      material_cost_total, equipment_cost_total, subcontract_cost_total, other_cost_total,
      margin_amount, margin_percent, snapshot_status, snapshot_payload
    ) values (
      v_cost.job_id, v_cost.work_order_id, v_cost.accepted_estimate_total, v_cost.revenue_total,
      v_cost.labour_cost_total, v_cost.material_cost_total, v_cost.equipment_cost_total, 0,
      v_cost.other_cost_total, v_cost.margin_amount, v_cost.margin_percent, v_cost.cost_status,
      jsonb_build_object('schema',157,'source','execution_proof_approval','execution_proof_id',v_proof.id,'approved_proof_count',v_cost.approved_proof_count)
    ) returning id into v_snapshot_id;
  end if;

  return jsonb_build_object(
    'execution_proof_id',v_proof.id,
    'proof_status','approved',
    'work_order_id',v_work_order.id,
    'cost_status',v_cost.cost_status,
    'accepted_estimate_total',v_cost.accepted_estimate_total,
    'total_actual_cost',v_cost.total_actual_cost,
    'margin_amount',v_cost.margin_amount,
    'margin_percent',v_cost.margin_percent,
    'job_cost_snapshot_id',v_snapshot_id,
    'customer_visible',v_proof.customer_visible,
    'message','Execution proof approved and included in internal job-cost comparison. Customer portal never receives internal cost fields.'
  );
end;
$$;

-- Extend the current policy assertion function with execution-proof privacy checks.
create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations'),
           ('work_order_live_updates'),('work_order_live_update_media'),
           ('customer_notification_preferences'),('customer_notification_outbox'),('customer_notification_delivery_attempts'),
           ('work_order_execution_proofs'),('work_order_execution_proof_media')
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
    union all select 'customer_notification_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_set_customer_live_update_email_preference','ywi_rpc_claim_customer_notification','ywi_rpc_complete_customer_notification','ywi_rpc_retry_customer_notification')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Customer notification preference/outbox operations are only reachable through token/service functions.'
    union all select 'execution_proof_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_submit_work_order_execution_proof','ywi_rpc_decide_work_order_execution_proof')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Service-execution proof and internal costing RPCs are not callable by browser roles.'
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
    ('work_order_execution_proof_submit','Capture service-execution proof','site_leader',20),
    ('work_order_execution_proof_decision','Approve service-execution proof','supervisor',30),
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

create or replace view public.v_schema_drift_status as
select 157::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=157 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=157
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 157.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'service_execution_proof_costing','field_execution','Service-execution proof and internal job-cost comparison','active',88,7,8,
  'In staging, submit one arrival proof and one completion proof with labour/material/equipment cost, approve them, and verify the customer portal shows only customer-safe proof while the Cockpit shows cost variance.',
  'Supervisor / site leader',67,'{"build":"2026-07-12a","schema":157,"customer_costs_hidden":true}'::jsonb
)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

insert into public.app_schema_versions(
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  157,
  '157_service_execution_proof_cost_capture',
  '157_service_execution_proof_cost_capture.sql',
  '2026-07-12a',
  'Adds dispatch execution proof, customer-safe approved proof timeline, internal labour/material/equipment cost capture, and estimate-versus-actual comparison.',
  'applied',
  'Customer portal receives approved proof summaries and public images only. Internal costing remains Cockpit/service-role only.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label,
  description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_rpc_submit_work_order_execution_proof(uuid,uuid,text,text,text,text,boolean,timestamptz,numeric,uuid[],integer,numeric,numeric,numeric,numeric,jsonb) from public;
revoke all on function public.ywi_rpc_decide_work_order_execution_proof(uuid,uuid,text,text) from public;
grant execute on function public.ywi_rpc_submit_work_order_execution_proof(uuid,uuid,text,text,text,text,boolean,timestamptz,numeric,uuid[],integer,numeric,numeric,numeric,numeric,jsonb) to service_role;
grant execute on function public.ywi_rpc_decide_work_order_execution_proof(uuid,uuid,text,text) to service_role;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_security_policy_assertions() to service_role;

commit;
