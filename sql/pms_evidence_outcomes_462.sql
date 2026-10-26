-- YW 462: immutable owner documentary outcomes, never an independent approval.
begin;
create table if not exists public.ywi_evidence_outcomes_462 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 request_id uuid not null unique references public.ywi_reassessment_evidence_requests_461(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 outcome text not null check(outcome in ('evidence_received','clarification_pending','continued_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_462_company_created on public.ywi_evidence_outcomes_462(company_id,created_at desc);
alter table public.ywi_evidence_outcomes_462 enable row level security;
revoke all on public.ywi_evidence_outcomes_462 from public,anon,authenticated;

create or replace function public.ywi_rpc_evidence_outcomes_462(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_total integer;v_rows jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then raise exception '462 owner Jobs viewing permission denied';end if;
 select count(*) into v_total from public.ywi_evidence_outcomes_462 where company_id=p_company_id;
 if v_total>60 then raise exception '462 outcome sample capped: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_rows from (
  select o.id,o.company_id,o.request_id,o.owner_user_id,o.outcome,o.source_reference,o.notes,o.created_at
  from public.ywi_evidence_outcomes_462 o join public.ywi_reassessment_evidence_requests_461 r
  on r.id=o.request_id and r.company_id=o.company_id
  where o.company_id=p_company_id order by o.created_at desc,o.id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'viewer_id',v_actor,'captured_at',statement_timestamp(),
  'outcomes',v_rows,'total',v_total,'sample_capped',false,'is_owner',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'release_green',false,'outbound_actions',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_record_evidence_outcome_462(
 p_company_id uuid,p_operation_id uuid,p_request_id uuid,p_outcome text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_request record;v_id uuid;v_old record;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_operation_id is null or p_request_id is null or p_outcome not in ('evidence_received','clarification_pending','continued_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '462 invalid documentary outcome';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '462 owner Jobs approval permission denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,462));
 select r.id,r.created_at,r.reassessment_id,t.comparison_id into v_request
 from public.ywi_reassessment_evidence_requests_461 r
 join public.ywi_retest_reassessments_460 a on a.id=r.reassessment_id and a.company_id=r.company_id
 join public.ywi_retest_triages_460 t on t.id=a.triage_id and t.company_id=a.company_id
 where r.id=p_request_id and r.company_id=p_company_id and r.owner_user_id=v_actor;
 if not found then raise exception '462 original owner request missing';end if;
 perform public.ywi_460_assert_comparison_source(p_company_id,v_request.comparison_id);
 if v_request.created_at>statement_timestamp() then raise exception '462 future request denied';end if;
 if (select count(*) from public.ywi_evidence_outcomes_462 where company_id=p_company_id)>=200
  then raise exception '462 outcome journal capacity reached';end if;
 insert into public.ywi_evidence_outcomes_462(company_id,operation_id,request_id,owner_user_id,outcome,source_reference,notes)
 values(p_company_id,p_operation_id,p_request_id,v_actor,p_outcome,v_ref,v_notes)
 on conflict(company_id,operation_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_evidence_outcomes_462 where company_id=p_company_id and operation_id=p_operation_id;
  if not found or v_old.request_id is distinct from p_request_id or v_old.owner_user_id is distinct from v_actor
   or v_old.outcome is distinct from p_outcome or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '462 operation replay differs';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,'field_accepted',false,
  'service_authorized',false,'independent_reapproval',false,'release_green',false,'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_evidence_outcomes_462(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_evidence_outcome_462(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_evidence_outcomes_462(uuid) to authenticated;
grant execute on function public.ywi_rpc_record_evidence_outcome_462(uuid,uuid,uuid,text,text,text) to authenticated;
comment on table public.ywi_evidence_outcomes_462 is 'Immutable owner documentary outcome, not actual evidence verification or independent recheck approval.';
commit;
