begin;

-- Schema 232 — Build 344 Change Orders & Extras.
-- Extends the canonical public.change_orders / work_orders / work_order_lines chain.
-- Field discovery and evidence cannot alter price. Supervisor pricing plus explicit customer
-- authorization are required before one idempotent work-order scope/budget application.
-- Invoice evidence may reference an existing Finance candidate, but this build never creates,
-- posts, settles or materializes an invoice.

alter table public.change_orders
  add column if not exists service_context text not null default 'general_outdoor',
  add column if not exists season_context text not null default 'four_season',
  add column if not exists field_discovery_summary text,
  add column if not exists field_discovered_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists field_discovered_at timestamptz,
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists customer_authorization_status text not null default 'not_requested',
  add column if not exists customer_authorization_method text,
  add column if not exists scope_application_status text not null default 'not_applied',
  add column if not exists scope_applied_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists scope_applied_at timestamptz,
  add column if not exists invoice_evidence_status text not null default 'not_ready',
  add column if not exists invoice_evidence_reference text,
  add column if not exists invoice_candidate_id uuid references public.job_invoice_candidates(id) on delete set null,
  add column if not exists invoice_evidence_recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_evidence_recorded_at timestamptz;

alter table public.work_order_lines
  add column if not exists change_order_id uuid references public.change_orders(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_service_context_chk') then
    alter table public.change_orders add constraint change_orders_build344_service_context_chk
      check (service_context in ('mowing_landscaping','landscape_installation','fall_cleanup','snow_clearing_removal','general_outdoor'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_season_context_chk') then
    alter table public.change_orders add constraint change_orders_build344_season_context_chk
      check (season_context in ('spring_summer','fall','winter','four_season'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_review_status_chk') then
    alter table public.change_orders add constraint change_orders_build344_review_status_chk
      check (review_status in ('pending','approved_for_pricing','changes_required','rejected'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_customer_authorization_chk') then
    alter table public.change_orders add constraint change_orders_build344_customer_authorization_chk
      check (customer_authorization_status in ('not_requested','pending','authorized','declined'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_customer_authorization_method_chk') then
    alter table public.change_orders add constraint change_orders_build344_customer_authorization_method_chk
      check (customer_authorization_method is null or customer_authorization_method in ('signed','email','sms','verbal','portal','other'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_scope_application_chk') then
    alter table public.change_orders add constraint change_orders_build344_scope_application_chk
      check (scope_application_status in ('not_applied','applied'));
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build344_invoice_evidence_chk') then
    alter table public.change_orders add constraint change_orders_build344_invoice_evidence_chk
      check (invoice_evidence_status in ('not_ready','ready','linked'));
  end if;
end $$;

create unique index if not exists change_order_work_order_line_uk
  on public.work_order_lines(change_order_id) where change_order_id is not null;
create index if not exists change_orders_build344_lifecycle_idx
  on public.change_orders(review_status,customer_authorization_status,scope_application_status,invoice_evidence_status,updated_at desc);
create index if not exists change_orders_build344_season_idx
  on public.change_orders(season_context,service_context,updated_at desc);

create table if not exists public.change_order_evidence (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null references public.change_orders(id) on delete cascade,
  evidence_type text not null default 'note',
  evidence_reference text not null,
  caption text,
  customer_safe boolean not null default false,
  captured_by_profile_id uuid references public.profiles(id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint change_order_evidence_type_chk check (
    evidence_type in ('photo','measurement','note','customer_message','document','other')
  )
);
create index if not exists change_order_evidence_change_idx
  on public.change_order_evidence(change_order_id,captured_at desc);

create table if not exists public.change_order_budget_applications (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null unique references public.change_orders(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  work_order_line_id uuid not null unique references public.work_order_lines(id) on delete restrict,
  scope_summary text not null,
  cost_before numeric(14,2) not null,
  charge_before numeric(14,2) not null,
  cost_delta numeric(14,2) not null,
  charge_delta numeric(14,2) not null,
  cost_after numeric(14,2) not null,
  charge_after numeric(14,2) not null,
  applied_by_profile_id uuid references public.profiles(id) on delete set null,
  applied_at timestamptz not null default now()
);
create index if not exists change_order_budget_applications_work_order_idx
  on public.change_order_budget_applications(work_order_id,applied_at desc);

alter table public.change_orders enable row level security;
alter table public.change_order_evidence enable row level security;
alter table public.change_order_budget_applications enable row level security;
revoke all on table public.change_order_evidence from public,anon,authenticated;
revoke all on table public.change_order_budget_applications from public,anon,authenticated;
grant select,insert on table public.change_order_evidence to service_role;
grant select,insert on table public.change_order_budget_applications to service_role;

create or replace view public.v_change_order_extras_directory
with (security_invoker=true) as
select
  ch.*,
  wo.work_order_number,
  wo.status as work_order_status,
  wo.client_id,
  wo.client_site_id,
  wo.total_cost as current_work_order_cost,
  wo.total_amount as current_work_order_charge,
  e.estimate_number,
  cs.site_name,
  cs.service_address,
  cs.city,
  coalesce(ev.evidence_count,0)::int as evidence_count,
  coalesce(ev.photo_count,0)::int as photo_count,
  app.id as budget_application_id,
  app.work_order_line_id as applied_work_order_line_id,
  app.cost_before,
  app.charge_before,
  app.cost_after,
  app.charge_after,
  case
    when ch.status in ('rejected','void') or ch.review_status='rejected' or ch.customer_authorization_status='declined' then 'closed_not_authorized'
    when nullif(btrim(coalesce(ch.field_discovery_summary,'')),'') is null then 'needs_field_discovery'
    when coalesce(ev.evidence_count,0)=0 then 'needs_evidence'
    when ch.review_status in ('pending','changes_required') then 'needs_supervisor_review'
    when ch.review_status='approved_for_pricing' and ch.customer_authorization_status in ('not_requested','pending') then 'needs_customer_authorization'
    when ch.customer_authorization_status='authorized' and ch.scope_application_status='not_applied' then 'ready_to_apply'
    when ch.scope_application_status='applied' and ch.invoice_evidence_status='not_ready' then 'needs_invoice_evidence'
    when ch.invoice_evidence_status='ready' then 'invoice_evidence_ready'
    when ch.invoice_evidence_status='linked' then 'invoice_evidence_linked'
    else 'in_progress'
  end as lifecycle_stage,
  'canonical_change_orders_work_orders_finance_separate'::text as authority_boundary
from public.change_orders ch
left join public.work_orders wo on wo.id=ch.work_order_id
left join public.estimates e on e.id=coalesce(ch.estimate_id,wo.estimate_id)
left join public.client_sites cs on cs.id=wo.client_site_id
left join lateral (
  select count(*)::int as evidence_count,
         count(*) filter(where ce.evidence_type='photo')::int as photo_count
  from public.change_order_evidence ce where ce.change_order_id=ch.id
) ev on true
left join public.change_order_budget_applications app on app.change_order_id=ch.id;

create or replace view public.v_change_order_evidence_directory
with (security_invoker=true) as
select ce.*,ch.change_order_number,ch.work_order_id,wo.work_order_number,ch.service_context,ch.season_context
from public.change_order_evidence ce
join public.change_orders ch on ch.id=ce.change_order_id
left join public.work_orders wo on wo.id=ch.work_order_id;

create or replace view public.v_change_order_budget_application_directory
with (security_invoker=true) as
select app.*,ch.change_order_number,wo.work_order_number,ch.customer_approval_reference,
       ch.customer_approved_at,ch.customer_approved_by_name
from public.change_order_budget_applications app
join public.change_orders ch on ch.id=app.change_order_id
join public.work_orders wo on wo.id=app.work_order_id;

revoke all on table public.v_change_order_extras_directory from public,anon,authenticated;
revoke all on table public.v_change_order_evidence_directory from public,anon,authenticated;
revoke all on table public.v_change_order_budget_application_directory from public,anon,authenticated;
grant select on table public.v_change_order_extras_directory to service_role;
grant select on table public.v_change_order_evidence_directory to service_role;
grant select on table public.v_change_order_budget_application_directory to service_role;

create or replace function public.ywi_rpc_change_order_discovery_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.change_orders
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_work_order_id uuid := nullif(p_payload->>'work_order_id','')::uuid;
  v_summary text := nullif(btrim(p_payload->>'field_discovery_summary'),'');
  v_scope text := nullif(btrim(p_payload->>'scope_summary'),'');
  v_service text := lower(coalesce(nullif(p_payload->>'service_context',''),'general_outdoor'));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'four_season'));
  v_wo public.work_orders;
  v_row public.change_orders;
begin
  if v_summary is null then raise exception 'Field-discovery summary is required.' using errcode='23514'; end if;
  if v_work_order_id is null then raise exception 'Work order is required.' using errcode='23514'; end if;
  select * into v_wo from public.work_orders where id=v_work_order_id;
  if not found then raise exception 'Work order was not found.' using errcode='23503'; end if;

  if v_id is null then
    insert into public.change_orders(
      job_id,work_order_id,estimate_id,change_order_number,status,scope_summary,reason,
      estimated_cost_delta,estimated_charge_delta,actual_cost_delta,actual_charge_delta,
      notes,created_by_profile_id,service_context,season_context,field_discovery_summary,
      field_discovered_by_profile_id,field_discovered_at,review_status,
      customer_authorization_status,scope_application_status,invoice_evidence_status
    ) values(
      v_wo.legacy_job_id,v_wo.id,v_wo.estimate_id,
      'CO-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      'requested',coalesce(v_scope,v_summary),nullif(btrim(p_payload->>'reason'),''),
      0,0,0,0,nullif(btrim(p_payload->>'notes'),''),p_actor_profile_id,
      v_service,v_season,v_summary,p_actor_profile_id,now(),'pending',
      'not_requested','not_applied','not_ready'
    ) returning * into v_row;
  else
    select * into v_row from public.change_orders where id=v_id for update;
    if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
    if v_row.scope_application_status='applied' then raise exception 'Applied change orders cannot be rewritten as field discoveries.' using errcode='23514'; end if;
    if v_row.work_order_id is distinct from v_work_order_id then raise exception 'Field discovery cannot move a change order to another work order.' using errcode='23514'; end if;
    update public.change_orders ch set
      field_discovery_summary=v_summary,
      scope_summary=coalesce(v_scope,ch.scope_summary),
      reason=case when p_payload?'reason' then nullif(btrim(p_payload->>'reason'),'') else ch.reason end,
      notes=case when p_payload?'notes' then nullif(btrim(p_payload->>'notes'),'') else ch.notes end,
      service_context=v_service,season_context=v_season,
      field_discovered_by_profile_id=coalesce(ch.field_discovered_by_profile_id,p_actor_profile_id),
      field_discovered_at=coalesce(ch.field_discovered_at,now()),
      status=case when ch.status in ('draft','requested') then 'requested' else ch.status end,
      updated_at=now()
    where ch.id=v_id returning ch.* into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_change_order_evidence_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.change_order_evidence
language plpgsql security invoker set search_path=public as $$
declare
  v_change_id uuid := nullif(p_payload->>'change_order_id','')::uuid;
  v_type text := lower(coalesce(nullif(p_payload->>'evidence_type',''),'note'));
  v_reference text := nullif(btrim(p_payload->>'evidence_reference'),'');
  v_change public.change_orders;
  v_row public.change_order_evidence;
begin
  if v_change_id is null or v_reference is null then raise exception 'Change order and evidence reference are required.' using errcode='23514'; end if;
  if v_type not in ('photo','measurement','note','customer_message','document','other') then raise exception 'Unsupported evidence type.' using errcode='23514'; end if;
  select * into v_change from public.change_orders where id=v_change_id;
  if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
  if v_change.status in ('rejected','void') then raise exception 'Evidence cannot be added to a rejected or void change order.' using errcode='23514'; end if;
  insert into public.change_order_evidence(
    change_order_id,evidence_type,evidence_reference,caption,customer_safe,captured_by_profile_id,captured_at
  ) values(
    v_change_id,v_type,v_reference,nullif(btrim(p_payload->>'caption'),''),
    coalesce((p_payload->>'customer_safe')::boolean,false),p_actor_profile_id,
    coalesce(nullif(p_payload->>'captured_at','')::timestamptz,now())
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_change_order_review_price(p_payload jsonb,p_actor_profile_id uuid)
returns public.change_orders
language plpgsql security invoker set search_path=public as $$
declare
  v_change_id uuid := nullif(p_payload->>'change_order_id','')::uuid;
  v_decision text := lower(coalesce(nullif(p_payload->>'decision',''),''));
  v_scope text := nullif(btrim(p_payload->>'scope_summary'),'');
  v_cost numeric := coalesce(nullif(p_payload->>'estimated_cost_delta','')::numeric,0);
  v_charge numeric := coalesce(nullif(p_payload->>'estimated_charge_delta','')::numeric,0);
  v_row public.change_orders;
begin
  if v_change_id is null then raise exception 'Change order is required.' using errcode='23514'; end if;
  if v_decision not in ('approve_for_pricing','changes_required','reject') then raise exception 'Unsupported review decision.' using errcode='23514'; end if;
  select * into v_row from public.change_orders where id=v_change_id for update;
  if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
  if v_row.scope_application_status='applied' then raise exception 'Applied change-order pricing cannot be changed.' using errcode='23514'; end if;
  if v_decision='approve_for_pricing' then
    if coalesce(v_scope,v_row.scope_summary) is null then raise exception 'Reviewed scope is required.' using errcode='23514'; end if;
    if v_cost<0 or v_charge<0 or (v_cost=0 and v_charge=0) then raise exception 'Reviewed cost/charge must be non-negative and at least one delta must be greater than zero.' using errcode='23514'; end if;
    if not exists(select 1 from public.change_order_evidence where change_order_id=v_change_id) then
      raise exception 'At least one evidence item is required before pricing approval.' using errcode='23514';
    end if;
  end if;
  update public.change_orders ch set
    review_status=case v_decision when 'approve_for_pricing' then 'approved_for_pricing' when 'changes_required' then 'changes_required' else 'rejected' end,
    reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now(),
    review_note=nullif(btrim(p_payload->>'review_note'),''),
    scope_summary=case when v_decision='approve_for_pricing' then coalesce(v_scope,ch.scope_summary) else ch.scope_summary end,
    reason=case when p_payload?'reason' then nullif(btrim(p_payload->>'reason'),'') else ch.reason end,
    estimated_cost_delta=case when v_decision='approve_for_pricing' then v_cost else ch.estimated_cost_delta end,
    estimated_charge_delta=case when v_decision='approve_for_pricing' then v_charge else ch.estimated_charge_delta end,
    customer_authorization_status=case when v_decision='approve_for_pricing' then 'pending' when v_decision='reject' then 'not_requested' else ch.customer_authorization_status end,
    status=case when v_decision='reject' then 'rejected' else 'requested' end,
    updated_at=now()
  where ch.id=v_change_id returning ch.* into v_row;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_change_order_customer_authorization(p_payload jsonb,p_actor_profile_id uuid)
returns public.change_orders
language plpgsql security invoker set search_path=public as $$
declare
  v_change_id uuid := nullif(p_payload->>'change_order_id','')::uuid;
  v_decision text := lower(coalesce(nullif(p_payload->>'decision',''),''));
  v_reference text := nullif(btrim(p_payload->>'customer_approval_reference'),'');
  v_name text := nullif(btrim(p_payload->>'customer_approved_by_name'),'');
  v_method text := lower(coalesce(nullif(p_payload->>'customer_authorization_method',''),'other'));
  v_row public.change_orders;
begin
  if v_change_id is null or v_decision not in ('authorize','decline') then raise exception 'Change order and authorization decision are required.' using errcode='23514'; end if;
  select * into v_row from public.change_orders where id=v_change_id for update;
  if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
  if v_row.scope_application_status='applied' then raise exception 'Customer authorization cannot be changed after scope application.' using errcode='23514'; end if;
  if v_row.review_status<>'approved_for_pricing' then raise exception 'Supervisor/office pricing review must be approved first.' using errcode='23514'; end if;
  if v_decision='authorize' and v_reference is null then raise exception 'Customer authorization evidence/reference is required.' using errcode='23514'; end if;
  if v_method not in ('signed','email','sms','verbal','portal','other') then raise exception 'Unsupported authorization method.' using errcode='23514'; end if;

  update public.change_orders ch set
    customer_authorization_status=case when v_decision='authorize' then 'authorized' else 'declined' end,
    customer_authorization_method=v_method,
    customer_approval_reference=case when v_decision='authorize' then v_reference else coalesce(v_reference,ch.customer_approval_reference) end,
    customer_approved_at=case when v_decision='authorize' then coalesce(nullif(p_payload->>'customer_approved_at','')::timestamptz,now()) else null end,
    customer_approved_by_name=case when v_decision='authorize' then v_name else null end,
    approved_at=case when v_decision='authorize' then now() else null end,
    approved_by_profile_id=case when v_decision='authorize' then p_actor_profile_id else null end,
    status=case when v_decision='authorize' then 'approved' else 'rejected' end,
    updated_at=now()
  where ch.id=v_change_id returning ch.* into v_row;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_change_order_apply(p_change_order_id uuid,p_actor_profile_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  v_change public.change_orders;
  v_wo public.work_orders;
  v_line public.work_order_lines;
  v_app public.change_order_budget_applications;
  v_cost_before numeric;
  v_charge_before numeric;
  v_cost_after numeric;
  v_charge_after numeric;
  v_margin numeric;
  v_margin_pct numeric;
  v_order integer;
begin
  select * into v_change from public.change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
  if v_change.scope_application_status='applied' then
    select * into v_app from public.change_order_budget_applications where change_order_id=v_change.id;
    return jsonb_build_object('change_order',to_jsonb(v_change),'application',to_jsonb(v_app),'idempotent',true,'invoice_created',false,'finance_posted',false);
  end if;
  if v_change.status<>'approved' or v_change.review_status<>'approved_for_pricing' or v_change.customer_authorization_status<>'authorized' then
    raise exception 'Reviewed pricing and explicit customer authorization are required before applying scope/budget.' using errcode='23514';
  end if;
  if v_change.work_order_id is null then raise exception 'A canonical work order is required.' using errcode='23514'; end if;
  select * into v_wo from public.work_orders where id=v_change.work_order_id for update;
  if not found then raise exception 'Work order was not found.' using errcode='23503'; end if;

  v_cost_before:=coalesce(v_wo.total_cost,0);
  v_charge_before:=coalesce(v_wo.total_amount,0);
  v_cost_after:=round((v_cost_before+coalesce(v_change.estimated_cost_delta,0))::numeric,2);
  v_charge_after:=round((v_charge_before+coalesce(v_change.estimated_charge_delta,0))::numeric,2);
  v_margin:=round((v_charge_after-v_cost_after)::numeric,2);
  v_margin_pct:=case when v_charge_after=0 then 0 else round((v_margin/v_charge_after*100)::numeric,2) end;
  select coalesce(max(line_order),0)+10 into v_order from public.work_order_lines where work_order_id=v_wo.id;

  insert into public.work_order_lines(
    work_order_id,line_order,line_type,description,quantity,unit_cost,unit_price,line_total,
    cost_total,margin_total,margin_percent,pricing_basis_label,client_visible,change_order_id
  ) values(
    v_wo.id,v_order,'change_order','Change order '||v_change.change_order_number||': '||v_change.scope_summary,
    1,coalesce(v_change.estimated_cost_delta,0),coalesce(v_change.estimated_charge_delta,0),
    coalesce(v_change.estimated_charge_delta,0),coalesce(v_change.estimated_cost_delta,0),
    coalesce(v_change.estimated_charge_delta,0)-coalesce(v_change.estimated_cost_delta,0),
    case when coalesce(v_change.estimated_charge_delta,0)=0 then 0
         else round(((coalesce(v_change.estimated_charge_delta,0)-coalesce(v_change.estimated_cost_delta,0))/v_change.estimated_charge_delta*100)::numeric,2) end,
    'Authorized change order','true',v_change.id
  ) returning * into v_line;

  update public.work_orders wo set
    line_count=coalesce(wo.line_count,0)+1,
    total_cost=v_cost_after,
    subtotal=round((coalesce(wo.subtotal,0)+coalesce(v_change.estimated_charge_delta,0))::numeric,2),
    total_amount=v_charge_after,
    margin_amount=v_margin,
    margin_percent=v_margin_pct,
    margin_estimate_total=v_margin,
    margin_estimate_percent=v_margin_pct,
    updated_at=now()
  where wo.id=v_wo.id;

  insert into public.change_order_budget_applications(
    change_order_id,work_order_id,work_order_line_id,scope_summary,cost_before,charge_before,
    cost_delta,charge_delta,cost_after,charge_after,applied_by_profile_id,applied_at
  ) values(
    v_change.id,v_wo.id,v_line.id,v_change.scope_summary,v_cost_before,v_charge_before,
    v_change.estimated_cost_delta,v_change.estimated_charge_delta,v_cost_after,v_charge_after,p_actor_profile_id,now()
  ) returning * into v_app;

  update public.change_orders set
    scope_application_status='applied',scope_applied_by_profile_id=p_actor_profile_id,scope_applied_at=now(),
    updated_at=now()
  where id=v_change.id returning * into v_change;

  return jsonb_build_object(
    'change_order',to_jsonb(v_change),'application',to_jsonb(v_app),'work_order_line',to_jsonb(v_line),
    'work_order_budget_mutated',true,'invoice_created',false,'finance_posted',false,'idempotent',false
  );
end;
$$;

create or replace function public.ywi_rpc_change_order_invoice_evidence_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.change_orders
language plpgsql security invoker set search_path=public as $$
declare
  v_change_id uuid := nullif(p_payload->>'change_order_id','')::uuid;
  v_status text := lower(coalesce(nullif(p_payload->>'invoice_evidence_status',''),'ready'));
  v_reference text := nullif(btrim(p_payload->>'invoice_evidence_reference'),'');
  v_candidate_id uuid := nullif(p_payload->>'invoice_candidate_id','')::uuid;
  v_row public.change_orders;
begin
  if v_change_id is null or v_status not in ('ready','linked') then raise exception 'Change order and invoice-evidence status are required.' using errcode='23514'; end if;
  select * into v_row from public.change_orders where id=v_change_id for update;
  if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
  if v_row.scope_application_status<>'applied' then raise exception 'Authorized scope/budget must be applied before invoice evidence is recorded.' using errcode='23514'; end if;
  if v_reference is null then raise exception 'Invoice evidence/reference is required.' using errcode='23514'; end if;
  if v_status='linked' then
    if v_candidate_id is null then raise exception 'Existing invoice candidate is required for linked evidence.' using errcode='23514'; end if;
    if not exists(
      select 1 from public.job_invoice_candidates c
      where c.id=v_candidate_id
        and (c.work_order_id=v_row.work_order_id or (v_row.estimate_id is not null and c.estimate_id=v_row.estimate_id))
    ) then raise exception 'Invoice candidate does not belong to this change order work/estimate.' using errcode='23514'; end if;
  end if;
  update public.change_orders ch set
    invoice_evidence_status=v_status,invoice_evidence_reference=v_reference,
    invoice_candidate_id=case when v_status='linked' then v_candidate_id else null end,
    invoice_evidence_recorded_by_profile_id=p_actor_profile_id,invoice_evidence_recorded_at=now(),updated_at=now()
  where ch.id=v_change_id returning ch.* into v_row;
  return v_row;
end;
$$;

revoke all on function public.ywi_rpc_change_order_discovery_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_change_order_evidence_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_change_order_review_price(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_change_order_customer_authorization(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_change_order_apply(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_change_order_invoice_evidence_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_change_order_discovery_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_change_order_evidence_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_change_order_review_price(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_change_order_customer_authorization(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_change_order_apply(uuid,uuid) to service_role;
grant execute on function public.ywi_rpc_change_order_invoice_evidence_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('change_order_discovery_save','jobs','create','write','change_orders_extras','jobs.change_order.discovery_saved',false,true,'Crew records field-discovered extra work without changing customer price or job budget.'),
  ('change_order_evidence_save','jobs','create','write','change_orders_extras','jobs.change_order.evidence_saved',false,true,'Crew records change-order evidence/photos by reference without changing price or billing.'),
  ('change_order_review_price','jobs','approve','write','change_orders_extras','jobs.change_order.review_priced',false,true,'Office/supervisor reviews scope and records proposed cost/charge after evidence exists.'),
  ('change_order_customer_authorization','jobs','approve','write','change_orders_extras','jobs.change_order.customer_authorized',false,true,'Records explicit customer authorization/decline evidence after reviewed pricing.'),
  ('change_order_apply','jobs','approve','write','change_orders_extras','jobs.change_order.applied',true,true,'Applies one authorized change-order line and budget delta to the canonical work order; Finance billing remains separate.'),
  ('change_order_invoice_evidence_save','jobs','approve','write','change_orders_extras','jobs.change_order.invoice_evidence_saved',true,true,'Records invoice-readiness/reference or links an existing Finance candidate without creating/posting an invoice.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=78 then 'passed' else 'failed' end,
    'Exactly 78 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'weather_workability_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'workability_rule_save','workability_observation_save','workability_decision_save','workability_notification_readiness_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 342 weather/workability writes remain explicit Jobs-approve contracts.'
  union all
  select 'landscape_material_estimator_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'landscape_material_estimate_save','landscape_material_actual_use_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=2 then 'passed' else 'failed' end,
    'Build 343 material-estimator writes are explicit Jobs-approve contracts.'
  union all
  select 'change_orders_extras_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'change_order_discovery_save','change_order_evidence_save','change_order_review_price',
      'change_order_customer_authorization','change_order_apply','change_order_invoice_evidence_save'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 344 field discovery, evidence, review, authorization, application and invoice-evidence actions are explicit Jobs contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_change_orders_extras_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_change_order_authority_preserved',
    case when to_regclass('public.change_orders') is not null and to_regclass('public.work_orders') is not null
      and to_regclass('public.work_order_lines') is not null and to_regclass('public.job_invoice_candidates') is not null
    then 'passed' else 'failed' end,
    'Build 344 extends the existing change-order/work-order/Finance chain instead of creating duplicate commercial authority.'
  union all
  select 'field_capture_no_price_mutation',
    case when position('estimated_cost_delta' in lower(pg_get_functiondef('public.ywi_rpc_change_order_discovery_save(jsonb,uuid)'::regprocedure)))>0
      and position('0,0,0,0' in lower(pg_get_functiondef('public.ywi_rpc_change_order_discovery_save(jsonb,uuid)'::regprocedure)))>0
      and position('update public.work_orders' in lower(pg_get_functiondef('public.ywi_rpc_change_order_discovery_save(jsonb,uuid)'::regprocedure)))=0
    then 'passed' else 'failed' end,
    'Crew discovery initializes zero pricing and does not mutate the work-order budget.'
  union all
  select 'customer_authorization_before_apply',
    case when position('v_change.customer_authorization_status<>''authorized''' in replace(lower(pg_get_functiondef('public.ywi_rpc_change_order_apply(uuid,uuid)'::regprocedure)),' ',''))>0
      and position('v_change.review_status<>''approved_for_pricing''' in replace(lower(pg_get_functiondef('public.ywi_rpc_change_order_apply(uuid,uuid)'::regprocedure)),' ',''))>0
      and position('v_change.status<>''approved''' in replace(lower(pg_get_functiondef('public.ywi_rpc_change_order_apply(uuid,uuid)'::regprocedure)),' ',''))>0
    then 'passed' else 'failed' end,
    'Apply RPC requires reviewed pricing, approved status and explicit customer authorization before work-order mutation.'
  union all
  select 'application_idempotent',
    case when exists(select 1 from pg_indexes where schemaname='public' and indexname='change_order_work_order_line_uk')
      and exists(select 1 from pg_constraint where conrelid='public.change_order_budget_applications'::regclass and contype='u')
    then 'passed' else 'failed' end,
    'A change order can create only one linked canonical work-order line and one budget-application record.'
  union all
  select 'invoice_authority_preserved',
    case when position('insert into public.job_invoice_candidates' in lower(pg_get_functiondef('public.ywi_rpc_change_order_invoice_evidence_save(jsonb,uuid)'::regprocedure)))=0
      and position('insert into public.ar_invoices' in lower(pg_get_functiondef('public.ywi_rpc_change_order_invoice_evidence_save(jsonb,uuid)'::regprocedure)))=0
      and position('insert into public.job_invoice_postings' in lower(pg_get_functiondef('public.ywi_rpc_change_order_invoice_evidence_save(jsonb,uuid)'::regprocedure)))=0
    then 'passed' else 'failed' end,
    'Invoice-evidence recording may link existing Finance evidence but never creates/posts an invoice.'
  union all
  select 'change_order_evidence_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('change_order_evidence','change_order_budget_applications')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Field evidence and budget-application proof remain service-role private.';
$$;
revoke all on function public.ywi_change_orders_extras_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_change_orders_extras_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  232,'change_orders_extras',
  'Build 344 adds gated field discovery, evidence, supervisor pricing, customer authorization, idempotent work-order scope/budget application and Finance-safe invoice evidence.',
  'applied',now(),'schema232',
  'Canonical change_orders/work_orders/work_order_lines remain authoritative. Field capture cannot change price; application requires customer authorization; invoice evidence never creates or posts billing.',
  '232_change_orders_extras.sql','schema232'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 232 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=232 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>232 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=232 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>232 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
