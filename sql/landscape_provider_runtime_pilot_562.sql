-- YW562: original runtime provider pilot; exact signed receipt/owner source gate.
-- Requires YW553-561 installed in order. This migration does not install them,
-- issue a provider signature, send a customer message or grant Master acceptance.
create table if not exists public.ywi_landscape_provider_pilot_decisions_562 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null check(case_version between 3 and 10000),
 provider_verified_receipt_id uuid not null references
  public.ywi_landscape_provider_verified_561(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 source_decision text not null check(source_decision in
  ('approve_for_master_review','reject_source_pilot')),
 owner_note text not null check(char_length(btrim(owner_note)) between 15 and 500),
 idempotency_key uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references
  public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key),
 unique(company_id,request_id,case_version,provider_verified_receipt_id)
);
create index if not exists ywi_562_owner_pilot_history on
 public.ywi_landscape_provider_pilot_decisions_562(company_id,request_id,recorded_at desc);
alter table public.ywi_landscape_provider_pilot_decisions_562 enable row level security;
revoke all on public.ywi_landscape_provider_pilot_decisions_562 from public,anon,authenticated;
grant select on public.ywi_landscape_provider_pilot_decisions_562 to authenticated,service_role;
drop policy if exists ywi_562_owner_pilot_select on
 public.ywi_landscape_provider_pilot_decisions_562;
create policy ywi_562_owner_pilot_select on
 public.ywi_landscape_provider_pilot_decisions_562 for select to authenticated
 using ((select auth.uid()) is not null and
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false and
  exists(select 1 from public.ywi_companies c
   where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Exact original case, signed provider receipt, fresh supervisor/customer proof
-- and prior owner source decision must ALL match. Provider "delivered" does
-- not imply independently proven recipient delivery.
create or replace function public.ywi_rpc_landscape_provider_pilot_review_562(
 p_company_id uuid,p_request_id uuid,p_verified_receipt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_receipt public.ywi_landscape_provider_verified_561%rowtype;
 v_source jsonb;
 v_decision public.ywi_landscape_provider_pilot_decisions_562%rowtype;
 v_ready boolean:=false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_verified_receipt_id is null then
  raise exception '562 original provider receipt required'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id;
 if not found then raise exception '562 original case inaccessible'; end if;
 select * into v_receipt from public.ywi_landscape_provider_verified_561
  where id=p_verified_receipt_id and company_id=p_company_id
   and request_id=p_request_id;
 if not found then raise exception '562 cross-company or missing signed receipt'; end if;
 v_source:=public.ywi_rpc_landscape_reopen_review_561(p_company_id,p_request_id);
 v_ready:=v_case.state='closed_verified' and
  v_case.case_version=v_receipt.case_version and
  v_receipt.provider_reported_state='delivered' and
  v_receipt.verified_at>=now()-interval '24 hours' and
  v_receipt.verified_at<=now()+interval '2 minutes' and
  v_source->>'case_state'='closed_verified' and
  (v_source->>'case_version')::integer=v_receipt.case_version and
  v_source->>'owner_decision'='continuity_reviewed' and
  v_source->>'fresh_original_supervisor_verified'='true' and
  v_source->>'closure_source_verified'='true' and
  v_source->>'customer_delivery_independently_verified'='false' and
  v_source->>'master_delivery_accepted'='false';
 select * into v_decision from public.ywi_landscape_provider_pilot_decisions_562
  where company_id=p_company_id and request_id=p_request_id
   and case_version=v_case.case_version
   and provider_verified_receipt_id=p_verified_receipt_id;
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,
  'case_version',v_case.case_version,
  'verified_receipt_id',v_receipt.id,
  'canonical_sha256',v_receipt.canonical_sha256,
  'signature_sha256',v_receipt.signature_sha256,
  'provider_state',v_receipt.provider_reported_state,
  'provider_verified_at',v_receipt.verified_at,
  'original_supervisor_verified',v_source->'fresh_original_supervisor_verified',
  'original_closure_verified',v_source->'closure_source_verified',
  'source_pilot_ready',v_ready,
  'source_owner_decision',coalesce(v_decision.source_decision,'HOLD'),
  'source_owner_decision_id',v_decision.id,
  'pilot_gate',case
    when v_decision.source_decision='approve_for_master_review'
      then 'SOURCE_OWNER_APPROVED_MASTER_INDEPENDENT_HOLD'
    when v_decision.source_decision='reject_source_pilot'
      then 'SOURCE_OWNER_REJECTED_MASTER_HOLD'
    when v_ready then 'READY_FOR_SOURCE_OWNER_PILOT_DECISION'
    else 'HOLD_ORIGINAL_SIGNED_RECEIPT_OR_FRESH_CLOSURE' end,
  'provider_signature_verified',true,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'company_scope_only',true,'read_only',true,'checked_at',now());
end $$;
revoke all on function
 public.ywi_rpc_landscape_provider_pilot_review_562(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function
 public.ywi_rpc_landscape_provider_pilot_review_562(uuid,uuid,uuid)
 to authenticated;

-- Protected immutable source pilot decision; Master MUST independently admit
-- the exact evidence and require a separate explicit Master owner acceptance.
create or replace function public.ywi_rpc_landscape_provider_pilot_decide_562(
 p_company_id uuid,p_request_id uuid,p_verified_receipt_id uuid,
 p_expected_case_version integer,p_source_decision text,p_owner_note text,
 p_idempotency_key uuid,p_owner_attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_review jsonb;
 v_existing public.ywi_landscape_provider_pilot_decisions_562%rowtype;
 v_saved public.ywi_landscape_provider_pilot_decisions_562%rowtype;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if (select auth.uid()) is null or
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=true or
  p_request_id is null or p_verified_receipt_id is null or
  p_idempotency_key is null or
  p_expected_case_version not between 3 and 10000 or
  p_source_decision not in ('approve_for_master_review','reject_source_pilot') or
  char_length(btrim(coalesce(p_owner_note,''))) not between 15 and 500 or
  p_owner_attested is distinct from true then
  raise exception '562 explicit original owner decision required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(
  'yw562:'||p_company_id::text||':'||p_request_id::text,0));
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.case_version<>p_expected_case_version then
  raise exception '562 original recovery version changed'; end if;
 v_review:=public.ywi_rpc_landscape_provider_pilot_review_562(
  p_company_id,p_request_id,p_verified_receipt_id);
 select * into v_existing from public.ywi_landscape_provider_pilot_decisions_562
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.request_id<>p_request_id or
   v_existing.provider_verified_receipt_id<>p_verified_receipt_id or
   v_existing.case_version<>p_expected_case_version or
   v_existing.source_decision<>p_source_decision or
   v_existing.owner_note<>btrim(p_owner_note) or
   v_existing.owner_user_id is distinct from auth.uid() then
   raise exception '562 conflicting owner idempotency replay'; end if;
  return jsonb_build_object('status','SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD',
   'decision_id',v_existing.id,'replayed',true,'master_owner_acceptance',false);
 end if;
 if p_source_decision='approve_for_master_review' and
  v_review->>'source_pilot_ready'<>'true' then
  raise exception '562 original signed provider and closure not ready'; end if;
 if exists(select 1 from public.ywi_landscape_provider_pilot_decisions_562 d
  where d.company_id=p_company_id and d.request_id=p_request_id
   and d.case_version=p_expected_case_version
   and d.provider_verified_receipt_id=p_verified_receipt_id) then
  raise exception '562 source pilot already decided for exact receipt'; end if;
 insert into public.ywi_landscape_provider_pilot_decisions_562
  (company_id,request_id,case_version,provider_verified_receipt_id,
   owner_user_id,source_decision,owner_note,idempotency_key)
 values(p_company_id,p_request_id,p_expected_case_version,p_verified_receipt_id,
  auth.uid(),p_source_decision,btrim(p_owner_note),p_idempotency_key)
 returning * into v_saved;
 return jsonb_build_object('status','SOURCE_OWNER_PILOT_RECORDED_MASTER_HOLD',
  'decision_id',v_saved.id,'source_decision',v_saved.source_decision,
  'canonical_sha256',v_review->>'canonical_sha256',
  'signature_sha256',v_review->>'signature_sha256',
  'replayed',false,'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false);
end $$;
revoke all on function
 public.ywi_rpc_landscape_provider_pilot_decide_562(uuid,uuid,uuid,integer,text,text,uuid,boolean)
 from public,anon,authenticated;
grant execute on function
 public.ywi_rpc_landscape_provider_pilot_decide_562(uuid,uuid,uuid,integer,text,text,uuid,boolean)
 to authenticated;

-- Only the protected master source worker can read tenant-free aggregates.
-- Exact source hash/receipt linkage remains owner-scoped; Master accepts
-- independently using its own signed, source-bound admission and owner gate.
create or replace function public.ywi_rpc_landscape_master_pilot_summary_562()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_approved bigint;v_rejected bigint;v_signed bigint;
begin
 if current_user<>'service_role' then
  raise exception '562 protected platform-shell Master source only'; end if;
 select count(*) filter(where source_decision='approve_for_master_review'),
        count(*) filter(where source_decision='reject_source_pilot')
 into v_approved,v_rejected
 from public.ywi_landscape_provider_pilot_decisions_562;
 select count(*) into v_signed from public.ywi_landscape_provider_verified_561;
 return jsonb_build_object('schema','rosevear.yw.provider-runtime-pilot-aggregate.v1',
  'source_id','yw','source_role','platform_shell',
  'tenant_boundary','platform_shell','verified_provider_receipts',v_signed,
  'source_owner_approved_for_master_review',v_approved,
  'source_owner_rejected',v_rejected,
  'recipient_delivery_independently_verified',false,
  'master_owner_acceptance',false,'master_connected',false,
  'handoff','INDEPENDENT_EXACT_RECEIPT_MASTER_REVIEW_REQUIRED',
  'checked_at',now());
end $$;
revoke all on function public.ywi_rpc_landscape_master_pilot_summary_562()
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_master_pilot_summary_562()
 to service_role;

comment on table public.ywi_landscape_provider_pilot_decisions_562 is
 'Immutable original company owner pilot source decisions. Never Master owner acceptance or recipient delivery.';
