-- YW 556: owner-scoped exception recovery for an independently linked YW555 job.
-- Requires 421/422/434/552/553/554/555. This ledger never creates or edits
-- original Jobs, Dispatch, crews, messages, payments or accepted quotes.
-- Replacement dispatch is performed exclusively by the original authorized ops flow.

create table if not exists public.ywi_landscape_recovery_cases_556 (
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null references public.ywi_landscape_booking_requests_552(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 quote_package_id uuid not null references public.estimate_quote_packages(id) on delete restrict,
 original_dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 replacement_dispatch_id uuid references public.dispatch_schedule_items(id) on delete restrict,
 state text not null check(state in ('exception_open','replacement_pending_customer','closed_verified')),
 reason text not null check(reason in ('crew_unavailable','schedule_conflict','weather','equipment','access','other')),
 owner_note text not null check(char_length(owner_note) between 10 and 1000),
 case_version integer not null check(case_version between 1 and 10000),
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 checked_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(company_id,request_id),
 unique(company_id,replacement_dispatch_id),
 foreign key(company_id,request_id) references public.ywi_landscape_canonical_handoffs_555(company_id,request_id) on delete restrict
);
create table if not exists public.ywi_landscape_recovery_audit_556 (
 id bigint generated always as identity primary key,
 company_id uuid not null,
 request_id uuid not null,
 idempotency_key uuid not null,
 action text not null check(action in ('open','verify_replacement','close')),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{32}$'),
 case_version integer not null,
 result jsonb not null check(jsonb_typeof(result)='object'),
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,idempotency_key)
);
create table if not exists public.ywi_landscape_customer_confirmations_556 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 request_id uuid not null,
 case_version integer not null,
 replacement_dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 quote_package_id uuid not null references public.estimate_quote_packages(id) on delete restrict,
 decision text not null check(decision in ('accepted','declined')),
 customer_name text not null check(char_length(customer_name) between 2 and 180),
 customer_email text not null check(char_length(customer_email) between 3 and 260),
 ip_hash text check(ip_hash ~ '^[0-9a-f]{64}$'),
 user_agent text,
 recorded_at timestamptz not null default now(),
 foreign key(company_id,request_id) references public.ywi_landscape_recovery_cases_556(company_id,request_id) on delete restrict,
 unique(company_id,request_id,case_version)
);
create index if not exists ywi_landscape_556_case_queue on public.ywi_landscape_recovery_cases_556(company_id,state,updated_at desc);
create index if not exists ywi_landscape_556_audit_request on public.ywi_landscape_recovery_audit_556(company_id,request_id,id desc);
create index if not exists ywi_landscape_556_customer_quote on public.ywi_landscape_customer_confirmations_556(quote_package_id,recorded_at desc);

alter table public.ywi_landscape_recovery_cases_556 enable row level security;
alter table public.ywi_landscape_recovery_audit_556 enable row level security;
alter table public.ywi_landscape_customer_confirmations_556 enable row level security;
revoke all on public.ywi_landscape_recovery_cases_556,public.ywi_landscape_recovery_audit_556,public.ywi_landscape_customer_confirmations_556 from public,anon,authenticated;
revoke all on sequence public.ywi_landscape_recovery_audit_556_id_seq from public,anon,authenticated;
grant select on public.ywi_landscape_recovery_cases_556,public.ywi_landscape_recovery_audit_556,public.ywi_landscape_customer_confirmations_556 to authenticated;
drop policy if exists ywi_landscape_556_owner_case on public.ywi_landscape_recovery_cases_556;
create policy ywi_landscape_556_owner_case on public.ywi_landscape_recovery_cases_556 for select to authenticated using (
 (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_556_owner_audit on public.ywi_landscape_recovery_audit_556;
create policy ywi_landscape_556_owner_audit on public.ywi_landscape_recovery_audit_556 for select to authenticated using (
 (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_556_owner_confirmation on public.ywi_landscape_customer_confirmations_556;
create policy ywi_landscape_556_owner_confirmation on public.ywi_landscape_customer_confirmations_556 for select to authenticated using (
 (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Independently prove a replacement against original, unmodified Dispatch data.
-- Always re-run for closure to prevent staleness after the customer responds.
create or replace function public.ywi_landscape_replacement_proof_556(
 p_company_id uuid,p_request_id uuid,p_dispatch_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_job public.work_orders%rowtype;
 v_before public.dispatch_schedule_items%rowtype;
 v_after public.dispatch_schedule_items%rowtype;
 v_decision public.ywi_landscape_booking_decisions_554%rowtype;
 v_preflight jsonb; v_item jsonb;
begin
 select * into v_case from public.ywi_landscape_recovery_cases_556 where company_id=p_company_id and request_id=p_request_id;
 if not found or p_dispatch_id is null then raise exception '556 recovery source missing'; end if;
 select * into v_job from public.work_orders where id=v_case.work_order_id;
 select * into v_before from public.dispatch_schedule_items where id=v_case.original_dispatch_id;
 select * into v_after from public.dispatch_schedule_items where id=p_dispatch_id;
 select * into v_decision from public.ywi_landscape_booking_decisions_554 where company_id=p_company_id and request_id=p_request_id;
 if v_job.id is null or v_job.company_id is distinct from p_company_id or
  v_job.legacy_job_id is null or v_before.id is null or v_after.id is null or
  v_before.work_order_id is distinct from v_job.id or v_before.job_id is distinct from v_job.legacy_job_id or
  v_after.work_order_id is distinct from v_job.id or v_after.job_id is distinct from v_job.legacy_job_id or
  v_after.client_site_id is distinct from v_decision.client_site_id or
  v_before.client_site_id is distinct from v_decision.client_site_id or
  v_after.supersedes_dispatch_id is distinct from v_before.id or
  v_after.id=v_before.id or v_after.crew_id is null or
  jsonb_array_length(coalesce(v_after.assigned_crew_profile_ids,'[]'::jsonb))=0 or
  v_after.schedule_status not in ('scheduled','dispatched') or
  exists(select 1 from public.dispatch_schedule_items alternate
    where alternate.supersedes_dispatch_id=v_before.id and alternate.id<>v_after.id) or
  (v_after.crew_id is not distinct from v_before.crew_id and
   v_after.scheduled_start is not distinct from v_before.scheduled_start and
   v_after.scheduled_end is not distinct from v_before.scheduled_end) or
  exists(select 1 from public.dispatch_schedule_items newer where newer.supersedes_dispatch_id=v_after.id)
 then raise exception '556 original replacement dispatch, crew or current lineage invalid'; end if;
 v_preflight:=public.ywi_rpc_job_dispatch_preflight_434(p_company_id,v_decision.client_id,v_decision.client_site_id,v_job.id);
 select d into v_item from jsonb_array_elements(coalesce(v_preflight->'dispatches','[]'::jsonb)) d where d->>'id'=v_after.id::text limit 1;
 if v_preflight->>'service_enabled'<>'true' or v_preflight->>'release_signed'<>'true' or
  v_item is null or v_item->>'site_matches'<>'true' or
  coalesce((v_item->>'crew_members')::integer,0)=0 or
  v_item->>'lead_recorded'<>'true' or v_item->>'supervisor_recorded'<>'true' or
  coalesce(v_item->>'crew_status','') in ('','inactive','archived','suspended') or
  v_item->>'conflicts_checked'<>'true' or coalesce((v_item->>'conflict_count')::integer,-1)<>0 or
  coalesce(v_item->>'workability_state','') not in ('workable','caution') or
  exists(select 1 from jsonb_array_elements(coalesce(v_item->'equipment','[]'::jsonb)) a where
   coalesce((a->>'locked_out')::boolean,false) or
   lower(coalesce(a->>'status','')) ~ '(lockout|out.of.service|maintenance|unavailable)' or
   lower(coalesce(a->>'fleet_status','')) ~ '(blocked|unavailable|out.of.service)')
 then raise exception '556 original preflight release, crew, safety or capacity on HOLD'; end if;
 return jsonb_build_object('dispatch_id',v_after.id,'work_order_id',v_job.id,'crew_id',v_after.crew_id,
  'scheduled_start',v_after.scheduled_start,'scheduled_end',v_after.scheduled_end,
  'verified_at',now(),'source','original_421_434');
end $$;
revoke all on function public.ywi_landscape_replacement_proof_556(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_landscape_replacement_proof_556(uuid,uuid,uuid) to service_role;

create or replace function public.ywi_rpc_landscape_recovery_candidates_556(
 p_company_id uuid,p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_handoff public.ywi_landscape_canonical_handoffs_555%rowtype;
 v_items jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_handoff from public.ywi_landscape_canonical_handoffs_555
  where company_id=p_company_id and request_id=p_request_id;
 if not found or v_handoff.state<>'verified_crew_handoff' then
  raise exception '556 original source handoff unavailable'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.scheduled_start desc),'[]'::jsonb) into v_items
 from (select id,work_order_id,supersedes_dispatch_id,crew_id,scheduled_start,scheduled_end,schedule_status
  from public.dispatch_schedule_items where work_order_id=v_handoff.work_order_id
   and supersedes_dispatch_id=v_handoff.dispatch_id
  order by scheduled_start desc limit 20) d;
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'original_dispatch_id',v_handoff.dispatch_id,'candidates',v_items,'read_only',true,
  'original_source_authority',true);
end $$;
revoke all on function public.ywi_rpc_landscape_recovery_candidates_556(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_recovery_candidates_556(uuid,uuid) to authenticated;

create or replace function public.ywi_rpc_landscape_recovery_556(
 p_company_id uuid,p_request_id uuid,p_action text,p_idempotency_key uuid,
 p_expected_version integer,p_reason text default null,p_note text default null,
 p_replacement_dispatch_id uuid default null,p_owner_attested boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_handoff public.ywi_landscape_canonical_handoffs_555%rowtype;
 v_repeat public.ywi_landscape_recovery_audit_556%rowtype;
 v_customer public.ywi_landscape_customer_confirmations_556%rowtype;
 v_hash text; v_proof jsonb; v_after jsonb; v_next integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_idempotency_key is null or p_action not in ('open','verify_replacement','close') or
  p_expected_version is null or p_expected_version not between 0 and 9999 or p_owner_attested is distinct from true then
   raise exception '556 owner input, version or attestation invalid'; end if;
 -- Also serialize creation of the very first case, where no row exists yet
 -- to acquire a FOR UPDATE lock. Version checks happen after this lock.
 perform pg_advisory_xact_lock(hashtextextended('yw556:'||p_company_id::text||':'||p_request_id::text,0));
 v_hash:=md5(jsonb_build_object('action',p_action,'reason',p_reason,'note',p_note,
  'replacement',p_replacement_dispatch_id,'version',p_expected_version)::text);
 select * into v_repeat from public.ywi_landscape_recovery_audit_556 where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_repeat.request_id<>p_request_id or v_repeat.payload_hash<>v_hash then raise exception '556 idempotency key reused with different payload'; end if;
  return v_repeat.result;
 end if;
 select * into v_handoff from public.ywi_landscape_canonical_handoffs_555 where company_id=p_company_id and request_id=p_request_id;
 if not found or v_handoff.state<>'verified_crew_handoff' or v_handoff.dispatch_id is null then
  raise exception '556 original Jobs and Dispatch handoff not verified'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556 where company_id=p_company_id and request_id=p_request_id for update;
 if coalesce(v_case.case_version,0)<>p_expected_version then raise exception '556 stale recovery version; refresh required'; end if;
 if p_action='open' then
  if p_reason not in ('crew_unavailable','schedule_conflict','weather','equipment','access','other') or
   char_length(btrim(coalesce(p_note,''))) not between 10 and 1000 or
   p_replacement_dispatch_id is not null then raise exception '556 exception reason and note required'; end if;
  if v_case.case_version is not null and v_case.state='replacement_pending_customer' and not exists(
   select 1 from public.ywi_landscape_customer_confirmations_556 c where c.company_id=p_company_id
   and c.request_id=p_request_id and c.case_version=v_case.case_version and c.decision='declined') then
   raise exception '556 customer decision still pending; cannot silently replace'; end if;
  v_next:=p_expected_version+1;
  insert into public.ywi_landscape_recovery_cases_556
   (company_id,request_id,work_order_id,quote_package_id,original_dispatch_id,state,reason,owner_note,case_version,actor_user_id)
  values(p_company_id,p_request_id,v_handoff.work_order_id,v_handoff.quote_package_id,v_handoff.dispatch_id,
   'exception_open',p_reason,btrim(p_note),v_next,auth.uid())
  on conflict(company_id,request_id) do update set state='exception_open',reason=excluded.reason,
   owner_note=excluded.owner_note,case_version=excluded.case_version,
   replacement_dispatch_id=null,actor_user_id=excluded.actor_user_id,updated_at=now(),checked_at=now();
 elsif p_action='verify_replacement' then
  if v_case.state<>'exception_open' or p_replacement_dispatch_id is null or
   p_reason is not null or p_note is not null then raise exception '556 open exception and original replacement receipt required'; end if;
  v_proof:=public.ywi_landscape_replacement_proof_556(p_company_id,p_request_id,p_replacement_dispatch_id);
  v_next:=p_expected_version+1;
  update public.ywi_landscape_recovery_cases_556 set state='replacement_pending_customer',
   replacement_dispatch_id=p_replacement_dispatch_id,case_version=v_next,checked_at=now(),
   actor_user_id=auth.uid(),updated_at=now() where company_id=p_company_id and request_id=p_request_id;
 elsif p_action='close' then
  if v_case.state<>'replacement_pending_customer' or p_replacement_dispatch_id is not null or
   p_reason is not null or p_note is not null then raise exception '556 original replacement customer gate still pending'; end if;
  select * into v_customer from public.ywi_landscape_customer_confirmations_556
   where company_id=p_company_id and request_id=p_request_id and case_version=v_case.case_version;
  if not found or v_customer.decision<>'accepted' or
   v_customer.replacement_dispatch_id is distinct from v_case.replacement_dispatch_id then
    raise exception '556 current-version customer confirmation not accepted'; end if;
  v_proof:=public.ywi_landscape_replacement_proof_556(p_company_id,p_request_id,v_case.replacement_dispatch_id);
  v_next:=p_expected_version+1;
  update public.ywi_landscape_recovery_cases_556 set state='closed_verified',case_version=v_next,
   checked_at=now(),actor_user_id=auth.uid(),updated_at=now() where company_id=p_company_id and request_id=p_request_id;
 else raise exception '556 unknown action'; end if;
 select to_jsonb(c) into v_after from public.ywi_landscape_recovery_cases_556 c where company_id=p_company_id and request_id=p_request_id;
 v_after:=v_after || jsonb_build_object('original_proof',coalesce(v_proof,'{}'::jsonb),
  'customer_confirmation_verified',p_action='close','authorizes_original_dispatch_mutation',false);
 insert into public.ywi_landscape_recovery_audit_556
 (company_id,request_id,idempotency_key,action,payload_hash,case_version,result,actor_user_id)
 values(p_company_id,p_request_id,p_idempotency_key,p_action,v_hash,v_next,v_after,auth.uid());
 return v_after;
end $$;
revoke all on function public.ywi_rpc_landscape_recovery_556(uuid,uuid,text,uuid,integer,text,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_recovery_556(uuid,uuid,text,uuid,integer,text,text,uuid,boolean) to authenticated;

-- Only the existing token-validated, service-role customer portal may record
-- a real customer decision. Browser/owner authenticated clients cannot execute.
create or replace function public.ywi_rpc_landscape_customer_confirm_556(
 p_public_token text,p_company_id uuid,p_request_id uuid,p_case_version integer,
 p_dispatch_id uuid,p_decision text,p_customer_name text,p_customer_email text,
 p_ip_hash text default null,p_user_agent text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_case public.ywi_landscape_recovery_cases_556%rowtype;
 v_quote public.estimate_quote_packages%rowtype;
 v_receipt public.ywi_landscape_customer_confirmations_556%rowtype;
begin
 if current_user<>'service_role' then raise exception '556 service-role portal boundary required'; end if;
 if p_public_token is null or char_length(p_public_token) not between 16 and 160 or
   p_decision not in ('accepted','declined') or
   char_length(btrim(coalesce(p_customer_name,''))) not between 2 and 180 or
   char_length(btrim(coalesce(p_customer_email,''))) not between 3 and 260 or
   btrim(p_customer_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception '556 customer confirmation input invalid'; end if;
 select * into v_case from public.ywi_landscape_recovery_cases_556
  where company_id=p_company_id and request_id=p_request_id for update;
 if not found or v_case.state<>'replacement_pending_customer' or
  v_case.case_version is distinct from p_case_version or
  v_case.replacement_dispatch_id is distinct from p_dispatch_id then
   raise exception '556 customer confirmation stale or not offered'; end if;
 select * into v_quote from public.estimate_quote_packages where id=v_case.quote_package_id;
 if not found or v_quote.public_token is distinct from p_public_token or
  v_quote.package_status<>'accepted' or v_quote.accepted_at is null then
   raise exception '556 portal token and accepted quote do not match'; end if;
 -- Revalidate immediately before the customer decision, not just when the
 -- owner originally offered it.
 perform public.ywi_landscape_replacement_proof_556(p_company_id,p_request_id,p_dispatch_id);
 select * into v_receipt from public.ywi_landscape_customer_confirmations_556
  where company_id=p_company_id and request_id=p_request_id and case_version=p_case_version;
 if found then
  if v_receipt.decision<>p_decision or v_receipt.replacement_dispatch_id<>p_dispatch_id or
   v_receipt.customer_name<>btrim(p_customer_name) or
   lower(v_receipt.customer_email)<>lower(btrim(p_customer_email)) then
    raise exception '556 customer decision already recorded; conflicts are rejected'; end if;
  return jsonb_build_object('receipt_id',v_receipt.id,'decision',v_receipt.decision,
   'recorded_at',v_receipt.recorded_at,'case_version',v_receipt.case_version);
 end if;
 insert into public.ywi_landscape_customer_confirmations_556
  (company_id,request_id,case_version,replacement_dispatch_id,quote_package_id,
   decision,customer_name,customer_email,ip_hash,user_agent)
 values(p_company_id,p_request_id,p_case_version,p_dispatch_id,v_case.quote_package_id,
  p_decision,btrim(p_customer_name),lower(btrim(p_customer_email)),p_ip_hash,left(p_user_agent,500))
 returning * into v_receipt;
 return jsonb_build_object('receipt_id',v_receipt.id,'decision',v_receipt.decision,
  'recorded_at',v_receipt.recorded_at,'case_version',v_receipt.case_version);
end $$;
revoke all on function public.ywi_rpc_landscape_customer_confirm_556(text,uuid,uuid,integer,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_customer_confirm_556(text,uuid,uuid,integer,uuid,text,text,text,text,text) to service_role;

comment on table public.ywi_landscape_recovery_cases_556 is 'Owner case ledger only; original job and dispatch authority remains external. Live operation requires installed 553/554/555/556 and deployed customer portal function.';
