-- YW Item 457: explicit independent reviewer handoff and immutable exception decisions.
-- A review/exception closure is NOT operational, Safety, field or Production approval.
begin;

create table if not exists public.ywi_first_service_handoffs_457 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 owner_review_id uuid not null references public.ywi_first_service_reviews_456(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 unique(company_id,owner_review_id),
 check(reviewer_user_id<>owner_user_id)
);
create index if not exists ywi_457_reviewer_inbox_idx
 on public.ywi_first_service_handoffs_457(reviewer_user_id,created_at desc);
alter table public.ywi_first_service_handoffs_457 enable row level security;
revoke all on public.ywi_first_service_handoffs_457 from public,anon,authenticated;

create table if not exists public.ywi_first_service_decisions_457 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 handoff_id uuid not null unique references public.ywi_first_service_handoffs_457(id) on delete restrict,
 decision text not null check(decision in
  ('reviewed_no_exception','returned_for_follow_up','exception_verified_closed')),
 exception_review_id uuid references public.ywi_first_service_reviews_456(id) on delete restrict,
 resolution_evidence_id uuid references public.ywi_owner_first_use_entries_455(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 check(decision<>'exception_verified_closed' or
  (exception_review_id is not null and resolution_evidence_id is not null)),
 check(decision='exception_verified_closed' or
  (exception_review_id is null and resolution_evidence_id is null))
);
create index if not exists ywi_457_decisions_company_idx
 on public.ywi_first_service_decisions_457(company_id,created_at desc);
alter table public.ywi_first_service_decisions_457 enable row level security;
revoke all on public.ywi_first_service_decisions_457 from public,anon,authenticated;

-- The inbox is deliberately minimal and bounded. Reviewers only see companies
-- explicitly handed to their identity; owners see only their own companies.
create or replace function public.ywi_rpc_reviewer_inbox_457()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_rows jsonb;v_count integer;
begin
 if v_uid is null or not exists(select 1 from public.profiles p
   where p.id=v_uid and p.is_active is true) then
  raise exception '457 signed-in active profile required';
 end if;
 select count(*) into v_count from public.ywi_companies c
  where c.owner_user_id=v_uid or exists(select 1
   from public.ywi_first_service_handoffs_457 h
   where h.company_id=c.id and h.reviewer_user_id=v_uid);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.name,s.id),'[]'::jsonb) into v_rows
 from (select c.id,c.name,(c.owner_user_id=v_uid) as is_owner,
   exists(select 1 from public.ywi_first_service_handoffs_457 h
    where h.company_id=c.id and h.reviewer_user_id=v_uid) as is_assigned_reviewer
   from public.ywi_companies c where c.owner_user_id=v_uid or exists(
    select 1 from public.ywi_first_service_handoffs_457 h
     where h.company_id=c.id and h.reviewer_user_id=v_uid)
   order by c.name,c.id limit 60) s;
 return jsonb_build_object('captured_at',statement_timestamp(),'companies',v_rows,
  'total',v_count,'sample_capped',v_count>60,'outbound_actions',false,'release_green',false);
end $$;

create or replace function public.ywi_rpc_first_service_independent_457(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_owner boolean;v_reviewer boolean;
 v_services jsonb;v_handoffs jsonb;v_decisions jsonb;v_exceptions jsonb;v_evidence jsonb;
 v_handoff_count integer;v_decision_count integer;v_exception_count integer;v_evidence_count integer;
begin
 if v_uid is null or not exists(select 1 from public.profiles
  where id=v_uid and is_active is true) then raise exception '457 active identity required';end if;
 select c.owner_user_id=v_uid into v_owner from public.ywi_companies c where c.id=p_company_id;
 v_owner:=coalesce(v_owner,false);
 select exists(select 1 from public.ywi_first_service_handoffs_457
  where company_id=p_company_id and reviewer_user_id=v_uid) into v_reviewer;
 if not v_owner and not v_reviewer then raise exception '457 company/reviewer scope denied';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.module_key),'[]'::jsonb) into v_services
  from (select company_id,module_key,enabled from public.ywi_company_service_modules
   where company_id=p_company_id order by module_key) s;
 select count(*) into v_handoff_count from public.ywi_first_service_handoffs_457
  where company_id=p_company_id and (v_owner or reviewer_user_id=v_uid);
 select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id desc),'[]'::jsonb)
 into v_handoffs from (select h.id,h.company_id,h.owner_review_id,h.reviewer_user_id,
  h.source_reference,h.notes,h.created_at,r.service_module_key,r.target_table,r.target_id,
  r.review_outcome as owner_recommendation
  from public.ywi_first_service_handoffs_457 h
  join public.ywi_first_service_reviews_456 r on r.id=h.owner_review_id
  where h.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
  order by h.created_at desc,h.id desc limit 60) h;
 select count(*) into v_decision_count from public.ywi_first_service_decisions_457 d
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id
  where d.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid);
 select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc,d.id desc),'[]'::jsonb)
 into v_decisions from (select d.id,d.company_id,d.handoff_id,d.decision,
  d.exception_review_id,d.resolution_evidence_id,d.source_reference,d.notes,d.created_at
  from public.ywi_first_service_decisions_457 d
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id
  where d.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
  order by d.created_at desc,d.id desc limit 60) d;
 select count(distinct r.id) into v_exception_count
 from public.ywi_first_service_reviews_456 r
 join public.ywi_first_service_reviews_456 ready on ready.company_id=r.company_id
  and ready.target_table=r.target_table and ready.target_id=r.target_id
  and ready.service_module_key=r.service_module_key
 join public.ywi_first_service_handoffs_457 h on h.owner_review_id=ready.id
 where h.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
  and r.review_outcome in ('blocked','needs_follow_up') and r.recorded_at<ready.recorded_at;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.recorded_at desc,e.id desc),'[]'::jsonb)
 into v_exceptions from (select distinct r.id,r.company_id,r.service_module_key,
   r.target_table,r.target_id,r.review_outcome,r.recorded_at
   from public.ywi_first_service_reviews_456 r
   join public.ywi_first_service_reviews_456 ready on ready.company_id=r.company_id
    and ready.target_table=r.target_table and ready.target_id=r.target_id
    and ready.service_module_key=r.service_module_key
   join public.ywi_first_service_handoffs_457 h on h.owner_review_id=ready.id
   where h.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
    and r.review_outcome in ('blocked','needs_follow_up') and r.recorded_at<ready.recorded_at
   order by r.recorded_at desc,r.id desc limit 60) e;
 select count(*) into v_evidence_count from public.ywi_owner_first_use_entries_455 e
  where e.company_id=p_company_id and e.checkpoint='field_observation' and e.disposition='observed'
   and exists(select 1 from public.ywi_first_service_handoffs_457 h
    where h.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
     and e.created_at>h.created_at);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc),'[]'::jsonb)
 into v_evidence from (select e.id,e.company_id,e.created_at,e.source_reference,
  e.checkpoint,e.disposition from public.ywi_owner_first_use_entries_455 e
  where e.company_id=p_company_id and e.checkpoint='field_observation' and e.disposition='observed'
   and exists(select 1 from public.ywi_first_service_handoffs_457 h
    where h.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_uid)
     and e.created_at>h.created_at)
  order by e.created_at desc,e.id desc limit 60) e;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'viewer_id',v_uid,'is_owner',v_owner,'is_assigned_reviewer',v_reviewer,
  'services',v_services,'handoffs',v_handoffs,'handoff_total',v_handoff_count,
  'handoff_sample_capped',v_handoff_count>60,'decisions',v_decisions,
  'decision_total',v_decision_count,'decision_sample_capped',v_decision_count>60,
  'exceptions',v_exceptions,'exception_total',v_exception_count,
  'exception_sample_capped',v_exception_count>60,'resolution_evidence',v_evidence,
  'evidence_total',v_evidence_count,'evidence_sample_capped',v_evidence_count>60,
  'independent_service_approval',false,'field_accepted',false,'release_green',false,
  'outbound_actions',false,'synthetic',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_assign_independent_457(
 p_company_id uuid,p_request_id uuid,p_owner_review_id uuid,p_reviewer_user_id uuid,
 p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid;v_old record;v_review record;
 v_role text;v_level text;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');v_enabled boolean;
 v_reviewer_role text;v_reviewer_level text;v_source_company uuid;v_source_service text;
 v_client uuid;v_site uuid;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_owner_review_id is null or p_reviewer_user_id is null
  or p_reviewer_user_id=v_owner or char_length(v_ref) not between 4 and 250
  or char_length(coalesce(v_notes,''))>500 then raise exception '457 invalid handoff request';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
  where role=v_role and module_key='jobs')) into v_level;
 if v_level is null or v_level not in ('approve','manage') then
  raise exception '457 owner Jobs approve/manage permission required';end if;
 if not exists(select 1 from public.profiles where id=p_reviewer_user_id and is_active is true) then
  raise exception '457 reviewer must be an active existing profile';end if;
 select lower(role) into v_reviewer_role from public.profiles
  where id=p_reviewer_user_id and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=p_reviewer_user_id and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
  where role=v_reviewer_role and module_key='jobs')) into v_reviewer_level;
 if v_reviewer_level is null or v_reviewer_level not in ('approve','manage') then
  raise exception '457 proposed reviewer lacks independent Jobs approve/manage permission';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,457));
 select * into v_review from public.ywi_first_service_reviews_456
  where id=p_owner_review_id and company_id=p_company_id
   and review_outcome='ready_for_independent_review';
 if not found or v_review.evidence_id is null or not v_review.switch_enabled_at_review
  or not v_review.canonical_site_verified then raise exception '457 456 readiness recommendation missing';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_review.service_module_key for share;
 if v_enabled is distinct from true or not exists(select 1 from public.ywi_new_work_gate_receipts_421
   where company_id=p_company_id and service_module_key=v_review.service_module_key
    and target_table=v_review.target_table and target_id=v_review.target_id) then
  raise exception '457 original 421 source or current ON service missing';end if;
 if not exists(select 1 from public.ywi_owner_first_use_entries_455
  where id=v_review.evidence_id and company_id=p_company_id
   and checkpoint='field_observation' and disposition='observed') then
  raise exception '457 455 recorded observation missing';end if;
 if v_review.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site from public.estimates
   where id=v_review.target_id;
 else
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site from public.work_orders
   where id=v_review.target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id or
  v_source_service is distinct from v_review.service_module_key or not exists(
   select 1 from public.ywi_company_site_links_422 l
   join public.clients c on c.id=l.client_id and c.is_active is true
   join public.client_sites s on s.id=l.client_site_id and s.is_active is true
   where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '457 original active canonical 422 source property missing';end if;
 if (select count(*) from public.ywi_first_service_handoffs_457 where company_id=p_company_id)>=200 then
  raise exception '457 handoff capacity reached; pagination required';end if;
 insert into public.ywi_first_service_handoffs_457
 (company_id,request_id,owner_review_id,reviewer_user_id,owner_user_id,source_reference,notes)
 values(p_company_id,p_request_id,p_owner_review_id,p_reviewer_user_id,v_owner,v_ref,v_notes)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_first_service_handoffs_457
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.owner_review_id is distinct from p_owner_review_id
   or v_old.reviewer_user_id is distinct from p_reviewer_user_id
   or v_old.owner_user_id is distinct from v_owner
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes then
    raise exception '457 handoff replay differs from original';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'independent_service_approval',false,'field_accepted',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_record_independent_457(
 p_company_id uuid,p_request_id uuid,p_handoff_id uuid,p_decision text,
 p_exception_review_id uuid,p_resolution_evidence_id uuid,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_old record;v_handoff record;
 v_ready record;v_source_company uuid;v_source_service text;v_client uuid;v_site uuid;
 v_role text;v_level text;v_enabled boolean;v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if p_request_id is null or p_handoff_id is null or p_decision not in
  ('reviewed_no_exception','returned_for_follow_up','exception_verified_closed')
  or p_decision is null or char_length(v_ref) not between 4 and 250
  or char_length(coalesce(v_notes,''))>500 or
  ((p_decision='exception_verified_closed') is distinct from
   (p_exception_review_id is not null and p_resolution_evidence_id is not null)) then
  raise exception '457 invalid independent decision request';end if;
 select * into v_handoff from public.ywi_first_service_handoffs_457
  where id=p_handoff_id and company_id=p_company_id and reviewer_user_id=v_actor;
 if not found or v_handoff.owner_user_id=v_actor then
  raise exception '457 only explicitly assigned independent reviewer may decide';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
  where role=v_role and module_key='jobs')) into v_level;
 if v_level is null or v_level not in ('approve','manage') then
  raise exception '457 active reviewer Jobs approve/manage permission required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,457));
 select * into v_ready from public.ywi_first_service_reviews_456
  where id=v_handoff.owner_review_id and company_id=p_company_id
  and review_outcome='ready_for_independent_review';
 if not found or not v_ready.switch_enabled_at_review or not v_ready.canonical_site_verified then
  raise exception '457 owner readiness source missing';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_ready.service_module_key for share;
 if v_enabled is distinct from true and p_decision<>'returned_for_follow_up' then
  raise exception '457 service switched OFF; return for follow-up';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421
  where company_id=p_company_id and service_module_key=v_ready.service_module_key
  and target_table=v_ready.target_table and target_id=v_ready.target_id) then
  raise exception '457 original Jobs gate receipt missing';end if;
 if v_ready.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id
  into v_source_company,v_source_service,v_client,v_site from public.estimates
  where id=v_ready.target_id;
 else
  select company_id,service_module_key,client_id,client_site_id
  into v_source_company,v_source_service,v_client,v_site from public.work_orders
  where id=v_ready.target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id
  or v_source_service is distinct from v_ready.service_module_key then
  raise exception '457 original source no longer matches company/service';end if;
 if p_decision<>'returned_for_follow_up' and not exists(
  select 1 from public.ywi_company_site_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  join public.client_sites s on s.id=l.client_site_id and s.is_active is true
  where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '457 canonical active customer/property proof missing';end if;
 if p_decision='exception_verified_closed' then
  if not exists(select 1 from public.ywi_first_service_reviews_456 r
   where r.id=p_exception_review_id and r.company_id=p_company_id
    and r.service_module_key=v_ready.service_module_key
    and r.target_table=v_ready.target_table and r.target_id=v_ready.target_id
    and r.review_outcome in ('blocked','needs_follow_up') and r.recorded_at<v_ready.recorded_at) then
    raise exception '457 earlier same-target exception review missing';end if;
  if not exists(select 1 from public.ywi_owner_first_use_entries_455 e
   where e.id=p_resolution_evidence_id and e.company_id=p_company_id
    and e.checkpoint='field_observation' and e.disposition='observed'
    and e.created_at>v_handoff.created_at and e.created_at>v_ready.recorded_at) then
    raise exception '457 later observed 455 resolution evidence missing';end if;
 end if;
 if p_decision='reviewed_no_exception' and exists(
  select 1 from public.ywi_first_service_reviews_456 r
  where r.company_id=p_company_id and r.service_module_key=v_ready.service_module_key
   and r.target_table=v_ready.target_table and r.target_id=v_ready.target_id
   and r.review_outcome in ('blocked','needs_follow_up') and r.recorded_at<v_ready.recorded_at) then
  raise exception '457 documented prior exception cannot be bypassed as no exception';end if;
 if (select count(*) from public.ywi_first_service_decisions_457 where company_id=p_company_id)>=200 then
  raise exception '457 decision journal capacity reached; pagination required';end if;
 insert into public.ywi_first_service_decisions_457
 (company_id,request_id,handoff_id,decision,exception_review_id,resolution_evidence_id,
  source_reference,notes,reviewer_user_id)
 values(p_company_id,p_request_id,p_handoff_id,p_decision,p_exception_review_id,
  p_resolution_evidence_id,v_ref,v_notes,v_actor)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_first_service_decisions_457
  where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.handoff_id is distinct from p_handoff_id
   or v_old.decision is distinct from p_decision
   or v_old.exception_review_id is distinct from p_exception_review_id
   or v_old.resolution_evidence_id is distinct from p_resolution_evidence_id
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
   or v_old.reviewer_user_id is distinct from v_actor then
    raise exception '457 independent decision replay differs from original';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'decision',p_decision,'independent_service_approval',false,
  'field_accepted',false,'outbound_actions',false);
end $$;

revoke all on function public.ywi_rpc_reviewer_inbox_457() from public,anon,authenticated;
revoke all on function public.ywi_rpc_first_service_independent_457(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_assign_independent_457(uuid,uuid,uuid,uuid,text,text)
 from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_independent_457(uuid,uuid,uuid,text,uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_reviewer_inbox_457() to authenticated;
grant execute on function public.ywi_rpc_first_service_independent_457(uuid) to authenticated;
grant execute on function public.ywi_rpc_assign_independent_457(uuid,uuid,uuid,uuid,text,text)
 to authenticated;
grant execute on function public.ywi_rpc_record_independent_457(uuid,uuid,uuid,text,uuid,uuid,text,text)
 to authenticated;
comment on table public.ywi_first_service_handoffs_457 is
 'Explicit owner handoff of 456 readiness to a distinct active reviewer. No service authorization.';
comment on table public.ywi_first_service_decisions_457 is
 'Immutable reviewer evidence decisions. Verified closure means review exception only; not field/Safety/Production approval.';
commit;
