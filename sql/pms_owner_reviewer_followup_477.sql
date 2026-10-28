-- YW Build 477: immutable company-owner documentary response to a genuine 476
-- independent reviewer request. Neither this nor its read workspace releases HOLD.
begin;
create table if not exists public.ywi_owner_reviewer_responses_477 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 reviewer_receipt_id uuid not null unique references public.ywi_renewal_reviewer_receipts_476(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('provide_fresh_owner_source','request_independent_recheck','retain_documentary_hold')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
create index if not exists ywi_477_company_created on public.ywi_owner_reviewer_responses_477(company_id,created_at desc);
alter table public.ywi_owner_reviewer_responses_477 enable row level security;
revoke all on public.ywi_owner_reviewer_responses_477 from public,anon,authenticated;
create or replace function public.ywi_rpc_owner_reviewer_response_477(
 p_company_id uuid,p_operation_id uuid,p_reviewer_receipt_id uuid,p_decision text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_src record;v_old record;v_id uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if v_actor is null or p_company_id is null or p_operation_id is null or p_reviewer_receipt_id is null
  or p_decision not in ('provide_fresh_owner_source','request_independent_recheck','retain_documentary_hold')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '477 invalid owner response: HOLD';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,477));
 v_base:=public.ywi_rpc_reviewer_renewal_workspace_476(p_company_id);
 if (v_base->>'viewer_id')::uuid is distinct from v_actor
  or (v_base->'handoff_source'->>'is_owner') is distinct from 'true'
 then raise exception '477 verified original owner required: HOLD';end if;
 select r.id receipt_id,r.company_id,r.reviewer_user_id,r.disposition,r.source_reference reviewer_source,
  r.created_at reviewer_at,p.id request_id,p.owner_user_id,p.source_reference owner_source,p.created_at owner_at,
  t.reviewer_user_id original_reviewer,t.source_reference continuity_source
 into v_src from public.ywi_renewal_reviewer_receipts_476 r
 join public.ywi_continuity_owner_requests_475 p on p.id=r.owner_request_id and p.company_id=r.company_id
 join public.ywi_clarification_continuity_reviews_474 t on t.id=p.continuity_review_id and t.company_id=p.company_id
 where r.company_id=p_company_id and r.id=p_reviewer_receipt_id;
 if not found or v_src.owner_user_id is distinct from v_actor
  or v_src.reviewer_user_id is distinct from v_src.original_reviewer or v_src.reviewer_user_id=v_actor
  or v_src.disposition is distinct from 'request_owner_source_refresh'
  or v_src.owner_at>v_src.reviewer_at or v_src.reviewer_at>pg_catalog.now()
  or v_ref in (v_src.reviewer_source,v_src.owner_source,v_src.continuity_source)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts') x
     where (x.value->>'id')::uuid=p_reviewer_receipt_id)
  or not exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'owner_renewal_requests') x
     where (x.value->>'id')::uuid=v_src.request_id)
 then raise exception '477 real reviewer source or company-owner continuity withheld: HOLD';end if;
 select * into v_old from public.ywi_owner_reviewer_responses_477
 where company_id=p_company_id and (operation_id=p_operation_id or reviewer_receipt_id=p_reviewer_receipt_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.reviewer_receipt_id is distinct from p_reviewer_receipt_id
   or v_old.owner_user_id is distinct from v_actor or v_old.decision is distinct from p_decision
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '477 conflicting owner replay: HOLD';end if;
  v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_owner_reviewer_responses_477 where company_id=p_company_id)>=60
  then raise exception '477 owner response capacity: HOLD';end if;
  insert into public.ywi_owner_reviewer_responses_477(company_id,operation_id,reviewer_receipt_id,owner_user_id,decision,source_reference,notes)
  values(p_company_id,p_operation_id,p_reviewer_receipt_id,v_actor,p_decision,v_ref,v_notes) returning id into v_id;
 end if;
 return pg_catalog.jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;
create or replace function public.ywi_rpc_owner_reviewer_workspace_477(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_base jsonb;v_clock timestamptz;
 v_aging jsonb;v_responses jsonb;v_count integer;v_reviews integer;
begin
 v_base:=public.ywi_rpc_reviewer_renewal_workspace_476(p_company_id);
 if v_actor is null or (v_base->>'viewer_id')::uuid is distinct from v_actor
 then raise exception '477 source viewer withheld: HOLD';end if;
 v_clock:=(v_base->>'captured_at')::timestamptz;
 if exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts') x
  where (x.value->>'created_at')::timestamptz>v_clock)
 then raise exception '477 future independent reviewer receipt: HOLD';end if;
 select count(*) into v_reviews from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts');
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'reviewer_receipt_id',x.value->>'id','owner_request_id',x.value->>'owner_request_id',
  'age_days',greatest(0,pg_catalog.floor(extract(epoch from (v_clock-(x.value->>'created_at')::timestamptz))/86400)::integer),
  'band',case when v_clock-(x.value->>'created_at')::timestamptz>=interval '15 days' then 'overdue'
       when v_clock-(x.value->>'created_at')::timestamptz>=interval '8 days' then 'aging' else 'current' end
 ) order by (x.value->>'created_at')::timestamptz desc),'[]'::jsonb)
 into v_aging from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts') x;
 select count(*) into v_count from public.ywi_owner_reviewer_responses_477 r
 where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts') x
  where (x.value->>'id')::uuid=r.reviewer_receipt_id);
 if v_count>60 then raise exception '477 owner response sample capped: HOLD';end if;
 select coalesce(pg_catalog.jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_responses from (
  select r.id,r.company_id,r.reviewer_receipt_id,r.owner_user_id,r.decision,r.source_reference,r.created_at
  from public.ywi_owner_reviewer_responses_477 r
  where r.company_id=p_company_id and exists(select 1 from pg_catalog.jsonb_array_elements(v_base->'reviewer_followup_receipts') k
    where (k.value->>'id')::uuid=r.reviewer_receipt_id)
  order by r.created_at desc,r.id desc limit 60) x;
 return v_base||pg_catalog.jsonb_build_object('owner_reviewer_as_of',v_clock,
  'reviewer_receipt_aging',v_aging,'reviewer_receipt_age_total',v_reviews,
  'owner_reviewer_responses',v_responses,'owner_reviewer_response_total',v_count,
  'owner_reviewer_response_sample_capped',false);
end $$;
revoke all on function public.ywi_rpc_owner_reviewer_response_477(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_owner_reviewer_workspace_477(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_reviewer_response_477(uuid,uuid,uuid,text,text,text) to authenticated;
grant execute on function public.ywi_rpc_owner_reviewer_workspace_477(uuid) to authenticated;
comment on table public.ywi_owner_reviewer_responses_477 is 'Private one-time original owner documentary source response to independent reviewer 476. No field/Jobs/Safety/integration release.';
commit;