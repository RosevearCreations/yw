-- YW Item 458: owner reassessment of independent 457 review decisions.
-- Every record is private, append-only and advisory; no field/Safety/business release.
begin;
create table if not exists public.ywi_owner_independent_followups_458 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 independent_decision_id uuid not null references public.ywi_first_service_decisions_457(id) on delete restrict,
 disposition text not null check(disposition in
  ('hold_open','retest_evidence_ready','closure_review_acknowledged','closure_challenged')),
 followup_evidence_id uuid references public.ywi_owner_first_use_entries_455(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 check(disposition in ('retest_evidence_ready','closure_review_acknowledged')
  or followup_evidence_id is null),
 check(disposition not in ('retest_evidence_ready','closure_review_acknowledged')
  or followup_evidence_id is not null)
);
create index if not exists ywi_458_owner_followups_idx
 on public.ywi_owner_independent_followups_458(company_id,created_at desc,id desc);
alter table public.ywi_owner_independent_followups_458 enable row level security;
revoke all on public.ywi_owner_independent_followups_458 from public,anon,authenticated;

create or replace function public.ywi_rpc_owner_independent_followup_458(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_source jsonb;v_entries jsonb;v_total integer;v_age jsonb;v_oldest numeric;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 v_source:=public.ywi_rpc_first_service_independent_457(p_company_id);
 select count(*) into v_total from public.ywi_owner_independent_followups_458
  where company_id=p_company_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id desc),'[]'::jsonb)
 into v_entries from (
  select id,company_id,independent_decision_id,disposition,followup_evidence_id,
   source_reference,notes,created_at
  from public.ywi_owner_independent_followups_458 where company_id=p_company_id
  order by created_at desc,id desc limit 60
 ) s;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id desc),'[]'::jsonb)
 into v_age from (
  select d.id,d.company_id,d.handoff_id,d.decision,d.created_at,
   floor(extract(epoch from (statement_timestamp()-d.created_at))/86400)::integer as age_days,
   (statement_timestamp()-d.created_at)>interval '7 days' as older_than_seven_days,
   (select count(*) from public.ywi_owner_independent_followups_458 f
    where f.company_id=p_company_id and f.independent_decision_id=d.id) as followup_count
  from public.ywi_first_service_decisions_457 d
  where d.company_id=p_company_id order by d.created_at desc,d.id desc limit 60
 ) a;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','independent_snapshot',v_source,
  'decision_aging',v_age,'followups',v_entries,'followup_total',v_total,
  'followup_sample_capped',v_total>60,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'release_green',false,'outbound_actions',false,'synthetic',false,
  'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_append_owner_independent_followup_458(
 p_company_id uuid,p_request_id uuid,p_independent_decision_id uuid,
 p_disposition text,p_followup_evidence_id uuid,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_id uuid;v_old record;v_decision record;
 v_handoff record;v_ready record;v_role text;v_level text;v_enabled boolean;
 v_source_company uuid;v_source_service text;v_client uuid;v_site uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_independent_decision_id is null or p_disposition is null
  or p_disposition not in ('hold_open','retest_evidence_ready',
   'closure_review_acknowledged','closure_challenged')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
  or ((p_disposition in ('retest_evidence_ready','closure_review_acknowledged'))
    is distinct from (p_followup_evidence_id is not null)) then
  raise exception '458 invalid follow-up request';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions
  where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
  where role=v_role and module_key='jobs')) into v_level;
 if v_level not in ('approve','manage') or v_level is null then
  raise exception '458 owner Jobs approve/manage permission required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,458));
 select * into v_decision from public.ywi_first_service_decisions_457
  where id=p_independent_decision_id and company_id=p_company_id;
 if not found or v_decision.reviewer_user_id=v_owner then
  raise exception '458 separate independent reviewer decision missing';end if;
 select * into v_handoff from public.ywi_first_service_handoffs_457
  where id=v_decision.handoff_id and company_id=p_company_id
   and owner_user_id=v_owner and reviewer_user_id=v_decision.reviewer_user_id;
 if not found then raise exception '458 signed owner/reviewer handoff mismatch';end if;
 select * into v_ready from public.ywi_first_service_reviews_456
  where id=v_handoff.owner_review_id and company_id=p_company_id
   and review_outcome='ready_for_independent_review';
 if not found or not v_ready.switch_enabled_at_review or not v_ready.canonical_site_verified then
  raise exception '458 original 456 readiness missing';end if;
 if p_disposition in ('closure_review_acknowledged','closure_challenged') and
  v_decision.decision<>'exception_verified_closed' then
  raise exception '458 closure reassessment requires independently verified exception closure';end if;
 if p_disposition='retest_evidence_ready' and v_decision.decision<>'returned_for_follow_up' then
  raise exception '458 retest evidence requires independent return for follow-up';end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_ready.service_module_key for share;
 if v_enabled is distinct from true and p_disposition in
  ('retest_evidence_ready','closure_review_acknowledged') then
  raise exception '458 service OFF; keep review HOLD';end if;
 if not exists(select 1 from public.ywi_new_work_gate_receipts_421 r
  where r.company_id=p_company_id and r.service_module_key=v_ready.service_module_key
   and r.target_table=v_ready.target_table and r.target_id=v_ready.target_id) then
  raise exception '458 original 421 Jobs/estimate source missing';end if;
 if v_ready.target_table='estimates' then
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site
   from public.estimates where id=v_ready.target_id;
 else
  select company_id,service_module_key,client_id,client_site_id
   into v_source_company,v_source_service,v_client,v_site
   from public.work_orders where id=v_ready.target_id;
 end if;
 if not found or v_source_company is distinct from p_company_id
  or v_source_service is distinct from v_ready.service_module_key then
  raise exception '458 original Jobs source mismatch';end if;
 if p_disposition in ('retest_evidence_ready','closure_review_acknowledged') and not exists(
  select 1 from public.ywi_company_site_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  join public.client_sites s on s.id=l.client_site_id and s.is_active is true
  where l.company_id=p_company_id and l.client_id=v_client and l.client_site_id=v_site) then
  raise exception '458 current canonical active customer/property missing';end if;
 if p_disposition='retest_evidence_ready' and not exists(
  select 1 from public.ywi_owner_first_use_entries_455 e
  where e.id=p_followup_evidence_id and e.company_id=p_company_id
   and e.checkpoint='field_observation' and e.disposition='observed'
   and e.created_at>v_decision.created_at) then
  raise exception '458 retest evidence must be observed after independent return';end if;
 if p_disposition='closure_review_acknowledged' and
  (p_followup_evidence_id is distinct from v_decision.resolution_evidence_id
   or not exists(select 1 from public.ywi_owner_first_use_entries_455 e
     where e.id=p_followup_evidence_id and e.company_id=p_company_id
      and e.checkpoint='field_observation' and e.disposition='observed'
      and e.created_at>v_handoff.created_at)) then
  raise exception '458 owner closure reassessment must cite independent closure evidence';end if;
 if (select count(*) from public.ywi_owner_independent_followups_458
  where company_id=p_company_id)>=200 then
  raise exception '458 follow-up journal capacity reached; pagination required';end if;
 insert into public.ywi_owner_independent_followups_458
 (company_id,request_id,independent_decision_id,disposition,followup_evidence_id,
  source_reference,notes,recorded_by)
 values(p_company_id,p_request_id,p_independent_decision_id,p_disposition,
  p_followup_evidence_id,v_ref,v_notes,v_owner)
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_owner_independent_followups_458
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.independent_decision_id is distinct from p_independent_decision_id
   or v_old.disposition is distinct from p_disposition
   or v_old.followup_evidence_id is distinct from p_followup_evidence_id
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
   or v_old.recorded_by is distinct from v_owner then
   raise exception '458 replay request differs from recorded follow-up';end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'disposition',p_disposition,'field_accepted',false,'service_authorized',false,
  'independent_reapproval',false,'outbound_actions',false);
end $$;

revoke all on function public.ywi_rpc_owner_independent_followup_458(uuid)
 from public,anon,authenticated;
revoke all on function public.ywi_rpc_append_owner_independent_followup_458(
 uuid,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_independent_followup_458(uuid)
 to authenticated;
grant execute on function public.ywi_rpc_append_owner_independent_followup_458(
 uuid,uuid,uuid,text,uuid,text,text) to authenticated;
comment on table public.ywi_owner_independent_followups_458 is
 'Immutable owner reassessment of independent 457 review outcomes. No real field, Safety, customer or release approval.';
commit;
