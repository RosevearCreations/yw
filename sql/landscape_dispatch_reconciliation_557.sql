-- YW 557: company-scoped, source-bound recovery review and independent supervisor receipt.
-- Requires YW 422/434/435/553/554/555/556. It never writes original Jobs,
-- Dispatch, crew assignment, capacity plan, quotes, customer response or messages.
-- The original Dispatch workflow alone can schedule or release a crew.

create table if not exists public.ywi_landscape_supervisor_acknowledgements_557 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 1 and 10000),
 dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 dispatch_signature text not null check(dispatch_signature ~ '^[0-9a-f]{32}$'),
 acknowledgement text not null check(acknowledgement in ('reviewed','escalated')),
 supervisor_profile_id uuid not null references public.profiles(id) on delete restrict,
 note text not null check(char_length(btrim(note)) between 10 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,request_id,case_version),
 unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_557_ack_company_age
 on public.ywi_landscape_supervisor_acknowledgements_557(company_id,recorded_at desc);
create index if not exists ywi_landscape_557_ack_supervisor
 on public.ywi_landscape_supervisor_acknowledgements_557(supervisor_profile_id,recorded_at desc);
alter table public.ywi_landscape_supervisor_acknowledgements_557 enable row level security;
revoke all on public.ywi_landscape_supervisor_acknowledgements_557 from public,anon,authenticated;
grant select on public.ywi_landscape_supervisor_acknowledgements_557 to authenticated;
drop policy if exists ywi_landscape_557_owner_or_signer_read on public.ywi_landscape_supervisor_acknowledgements_557;
create policy ywi_landscape_557_owner_or_signer_read on public.ywi_landscape_supervisor_acknowledgements_557
 for select to authenticated using (
 (select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and (supervisor_profile_id=(select auth.uid()) or exists (
  select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())
 )));

-- One canonical signature shared by both the owner read model and the supervisor
-- write gate. Reassignment, time, status or supervisor changes invalidate old ACKs.
create or replace function public.ywi_landscape_dispatch_signature_557(p_dispatch_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
  'id',d.id,'work_order_id',d.work_order_id,'supersedes',d.supersedes_dispatch_id,
  'crew_id',d.crew_id,'supervisor',d.assigned_supervisor_profile_id,
  'start',d.scheduled_start,'end',d.scheduled_end,'status',d.schedule_status,
  'crew_members',d.assigned_crew_profile_ids)::text)
 from public.dispatch_schedule_items d where d.id=p_dispatch_id
$$;
revoke all on function public.ywi_landscape_dispatch_signature_557(uuid) from public,anon,authenticated;
grant execute on function public.ywi_landscape_dispatch_signature_557(uuid) to service_role;

-- Only a current, independently authenticated ORIGINAL assigned supervisor can
-- record an acknowledgement. Neither a company owner nor a client may impersonate
-- the supervisor. Acknowledgement is an audit receipt, never a dispatch approval.
create or replace function public.ywi_rpc_landscape_supervisor_queue_557()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_rows jsonb;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception '557 authenticated supervisor required'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) into v_rows
 from (select c.company_id,c.request_id,c.case_version,c.state,c.reason,c.updated_at,
  d.id dispatch_id,d.scheduled_start,d.scheduled_end,d.schedule_status,
  public.ywi_landscape_dispatch_signature_557(d.id) dispatch_signature
  from public.ywi_landscape_recovery_cases_556 c
  join public.work_orders w on w.id=c.work_order_id and w.company_id=c.company_id
  join public.dispatch_schedule_items d on d.id=coalesce(c.replacement_dispatch_id,c.original_dispatch_id)
   and d.work_order_id=w.id and d.assigned_supervisor_profile_id=v_user
  where c.state<>'closed_verified' order by c.updated_at desc limit 30) x;
 return jsonb_build_object('cases',v_rows,'read_only',true,'source','original_dispatch_210_and_recovery_556',
  'dispatch_authorized',false,'customer_confirmation_authorized',false);
end $$;
revoke all on function public.ywi_rpc_landscape_supervisor_queue_557() from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_supervisor_queue_557() to authenticated;

create or replace function public.ywi_rpc_landscape_supervisor_ack_557(
 p_company_id uuid,p_request_id uuid,p_expected_case_version integer,
 p_dispatch_id uuid,p_expected_dispatch_signature text,
 p_acknowledgement text,p_note text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_existing public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_user uuid:=auth.uid(); v_signature text; v_result jsonb;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or
  p_company_id is null or p_request_id is null or p_idempotency_key is null or
  p_expected_case_version is null or p_dispatch_id is null or
  p_expected_dispatch_signature !~ '^[0-9a-f]{32}$' or
  p_acknowledgement not in ('reviewed','escalated') or
  char_length(btrim(coalesce(p_note,''))) not between 10 and 500 then
  raise exception '557 supervisor input invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yw557:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_existing from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.request_id<>p_request_id or v_existing.case_version<>p_expected_case_version or
   v_existing.dispatch_id<>p_dispatch_id or v_existing.dispatch_signature<>p_expected_dispatch_signature or
   v_existing.acknowledgement<>p_acknowledgement or v_existing.note<>btrim(p_note) or
   v_existing.supervisor_profile_id<>v_user then
    raise exception '557 idempotency key reused with changed payload'; end if;
  select * into v_case from public.ywi_landscape_recovery_cases_556
   where company_id=p_company_id and request_id=p_request_id;
  select * into v_dispatch from public.dispatch_schedule_items where id=p_dispatch_id;
  if v_case.case_version is distinct from p_expected_case_version or v_case.state='closed_verified' or
   p_dispatch_id is distinct from coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id) or
   v_dispatch.work_order_id is distinct from v_case.work_order_id or
   v_dispatch.assigned_supervisor_profile_id is distinct from v_user or
   public.ywi_landscape_dispatch_signature_557(p_dispatch_id) is distinct from p_expected_dispatch_signature then
   raise exception '557 recorded receipt is now stale; refresh original Dispatch'; end if;
  return jsonb_build_object('status','RECORDED','receipt_id',v_existing.id,
   'case_version',v_existing.case_version,'dispatch_authorized',false,'replayed',true);
 end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version or v_case.state='closed_verified' then
  raise exception '557 original recovery case changed; refresh'; end if;
 if not exists(select 1 from public.work_orders w where w.id=v_case.work_order_id and w.company_id=p_company_id) then
  raise exception '557 original company Job mismatched'; end if;
 if p_dispatch_id is distinct from coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id) then
  raise exception '557 current original Dispatch receipt changed'; end if;
 select * into v_dispatch from public.dispatch_schedule_items where id=p_dispatch_id;
 if not found or v_dispatch.work_order_id is distinct from v_case.work_order_id or
  v_dispatch.assigned_supervisor_profile_id is distinct from v_user or
  v_dispatch.schedule_status not in ('scheduled','dispatched') or
  v_dispatch.scheduled_end<=v_dispatch.scheduled_start then
   raise exception '557 current original supervisor or Dispatch assignment invalid'; end if;
 v_signature:=public.ywi_landscape_dispatch_signature_557(p_dispatch_id);
 if v_signature is distinct from p_expected_dispatch_signature then
  raise exception '557 original Dispatch signature stale; refresh'; end if;
 if exists(select 1 from public.ywi_landscape_supervisor_acknowledgements_557 a
  where a.company_id=p_company_id and a.request_id=p_request_id and a.case_version=p_expected_case_version) then
  raise exception '557 supervisor already acknowledged this case version'; end if;
 insert into public.ywi_landscape_supervisor_acknowledgements_557
  (company_id,request_id,case_version,dispatch_id,dispatch_signature,
   acknowledgement,supervisor_profile_id,note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_dispatch_id,v_signature,
  p_acknowledgement,v_user,btrim(p_note),p_idempotency_key) returning id into v_existing.id;
 return jsonb_build_object('status','RECORDED','receipt_id',v_existing.id,
  'case_version',p_expected_case_version,'dispatch_authorized',false,'customer_confirmation_authorized',false,
  'original_dispatch_mutated',false,'replayed',false);
end $$;
revoke all on function public.ywi_rpc_landscape_supervisor_ack_557(uuid,uuid,integer,uuid,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_supervisor_ack_557(uuid,uuid,integer,uuid,text,text,text,uuid)
 to authenticated;

-- Owner-only capacity reconciliation. The 553 totals remain advisory; original
-- 435 data must be verified independently and never treated as crew release.
create or replace function public.ywi_rpc_landscape_recovery_review_557(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_dispatch public.dispatch_schedule_items%rowtype;
 v_ack public.ywi_landscape_supervisor_acknowledgements_557%rowtype;
 v_availability jsonb;v_signature text;v_age_minutes integer;v_age text;
 v_date date;v_state text:='HOLD';v_notes jsonb:='[]'::jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '557 company recovery case missing'; end if;
 select * into v_dispatch from public.dispatch_schedule_items
  where id=coalesce(v_case.replacement_dispatch_id,v_case.original_dispatch_id);
 if not found or not exists(select 1 from public.work_orders w
  where w.id=v_case.work_order_id and w.company_id=p_company_id
   and w.id=v_dispatch.work_order_id) then
  raise exception '557 original company Dispatch lineage unavailable'; end if;
 v_signature:=public.ywi_landscape_dispatch_signature_557(v_dispatch.id);
 v_age_minutes:=greatest(0,floor(extract(epoch from(now()-v_case.updated_at))/60)::integer);
 v_age:=case when v_case.state='closed_verified' then 'closed'
  when v_age_minutes>=4320 then 'critical_72h'
  when v_age_minutes>=2880 then 'overdue_48h'
  when v_age_minutes>=1440 then 'aging_24h' else 'recent' end;
 v_date:=(v_dispatch.scheduled_start at time zone 'America/Toronto')::date;
 begin
  v_availability:=public.ywi_rpc_landscape_availability_553(p_company_id,p_request_id,v_date);
  if v_availability->>'company_id'<>p_company_id::text or
   v_availability->>'company_scope_only'<>'true' or
   v_availability->>'schedule_state'<>'company_dispatch_verified' then
   v_notes:=v_notes||jsonb_build_array('Original 435 capacity source not independently verified');
  elsif v_availability->>'capacity_state' in ('exhausted','stale','unknown') or
   v_availability->>'weather_state'='restricted' or
   coalesce((v_availability->>'missing_crew_assignment_count')::integer,0)>0 or
   coalesce((v_availability->>'not_ready_asset_count')::integer,0)>0 then
   v_notes:=v_notes||jsonb_build_array('Crew plan is exhausted, stale, incomplete or workability restricted');
  else
   v_state:='REVIEW_REQUIRED';
  end if;
 exception when others then
  v_notes:=v_notes||jsonb_build_array('YW553/435 original capacity source unavailable; manual HOLD');
 end;
 select * into v_ack from public.ywi_landscape_supervisor_acknowledgements_557
  where company_id=p_company_id and request_id=p_request_id and case_version=v_case.case_version;
 if v_ack.id is null or v_ack.dispatch_id is distinct from v_dispatch.id or
  v_ack.dispatch_signature is distinct from v_signature or
  v_ack.supervisor_profile_id is distinct from v_dispatch.assigned_supervisor_profile_id then
  v_state:='HOLD';
  v_notes:=v_notes||jsonb_build_array('Current original assigned supervisor acknowledgement absent or stale');
 elsif v_ack.acknowledgement='escalated' then
  v_state:='HOLD';v_notes:=v_notes||jsonb_build_array('Supervisor escalated current recovery case');
 elsif v_state='REVIEW_REQUIRED' then v_state:='ACKNOWLEDGED_REVIEW_ONLY'; end if;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'case_state',v_case.state,'case_version',v_case.case_version,
  'original_dispatch_id',v_case.original_dispatch_id,'current_dispatch_id',v_dispatch.id,
  'current_dispatch_signature',v_signature,'current_supervisor_profile_id',v_dispatch.assigned_supervisor_profile_id,
  'recovery_age_minutes',v_age_minutes,'aging_band',v_age,'capacity',v_availability,
  'acknowledgement',case when v_ack.id is not null and v_ack.dispatch_signature=v_signature
    and v_ack.supervisor_profile_id=v_dispatch.assigned_supervisor_profile_id
    then jsonb_build_object('kind',v_ack.acknowledgement,'recorded_at',v_ack.recorded_at,'receipt_id',v_ack.id)
    else null end,'status',v_state,'reasons',v_notes,'checked_at',now(),
  'read_only',true,'original_source_authority',true,'capacity_advisory_only',true,
  'dispatch_authorized',false,'customer_confirmation_authorized',false,
  'master_shell_connection_proven',false);
end $$;
revoke all on function public.ywi_rpc_landscape_recovery_review_557(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_recovery_review_557(uuid,uuid) to authenticated;
