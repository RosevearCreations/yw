-- YW 554: owner-only decisions on immutable YW 552 customer requests.
-- Requires 422 CRM links, 421 company new-work gate and installed YW 553.
-- An approval creates a company-owned scheduling PROPOSAL, NOT a Dispatch booking.
create table if not exists public.ywi_landscape_booking_decisions_554 (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  request_id uuid not null references public.ywi_landscape_booking_requests_552(id) on delete restrict,
  decision_version integer not null check (decision_version between 1 and 10000),
  decision_state text not null check (decision_state in
    ('review_hold','requote_draft','declined','approved_pending_dispatch')),
  owner_note text not null default '' check (char_length(owner_note)<=800),
  owner_quote_cents integer check (owner_quote_cents between 0 and 100000000),
  proposed_start timestamptz,
  proposed_end timestamptz,
  planned_minutes integer check (planned_minutes between 30 and 720),
  client_id uuid references public.clients(id) on delete restrict,
  client_site_id uuid references public.client_sites(id) on delete restrict,
  availability_evidence jsonb,
  owner_checked_site_safety boolean not null default false,
  decided_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id,request_id),
  check ((decision_state='requote_draft' and owner_quote_cents is not null)
    or (decision_state<>'requote_draft' and owner_quote_cents is null)),
  check ((decision_state='approved_pending_dispatch' and
    proposed_start is not null and proposed_end is not null and proposed_end>proposed_start and
    planned_minutes is not null and client_id is not null and client_site_id is not null and
    availability_evidence is not null and owner_checked_site_safety is true)
    or (decision_state<>'approved_pending_dispatch' and
    proposed_start is null and proposed_end is null and planned_minutes is null and
    client_id is null and client_site_id is null and availability_evidence is null and
    owner_checked_site_safety is false))
);
create index if not exists ywi_landscape_554_proposals_by_date
 on public.ywi_landscape_booking_decisions_554(company_id,proposed_start)
 where decision_state='approved_pending_dispatch';

create table if not exists public.ywi_landscape_booking_decision_audit_554 (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  request_id uuid not null,
  idempotency_key uuid not null,
  action text not null check (action in ('hold','requote','decline','approve')),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{32}$'),
  decision_version integer not null,
  state_after jsonb not null check (jsonb_typeof(state_after)='object'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  foreign key (company_id,request_id)
    references public.ywi_landscape_booking_decisions_554(company_id,request_id) on delete restrict,
  unique(company_id,idempotency_key)
);
create index if not exists ywi_landscape_554_audit_by_request
 on public.ywi_landscape_booking_decision_audit_554(company_id,request_id,id desc);

alter table public.ywi_landscape_booking_decisions_554 enable row level security;
alter table public.ywi_landscape_booking_decision_audit_554 enable row level security;
revoke all on public.ywi_landscape_booking_decisions_554 from public,anon,authenticated;
revoke all on public.ywi_landscape_booking_decision_audit_554 from public,anon,authenticated;
revoke all on sequence public.ywi_landscape_booking_decision_audit_554_id_seq from public,anon,authenticated;
grant select on public.ywi_landscape_booking_decisions_554 to authenticated;
grant select on public.ywi_landscape_booking_decision_audit_554 to authenticated;

drop policy if exists ywi_landscape_554_decision_owner_read on public.ywi_landscape_booking_decisions_554;
create policy ywi_landscape_554_decision_owner_read on public.ywi_landscape_booking_decisions_554
 for select to authenticated using (
  (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists(select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid()))
 );
drop policy if exists ywi_landscape_554_audit_owner_read on public.ywi_landscape_booking_decision_audit_554;
create policy ywi_landscape_554_audit_owner_read on public.ywi_landscape_booking_decision_audit_554
 for select to authenticated using (
  (select auth.uid()) is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists(select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid()))
 );

-- Only this owner-gated, atomic RPC may mutate the 554 decision and audit tables.
-- One locked original request serializes its transitions. A company/day advisory
-- lock prevents simultaneous approvals from oversubscribing the declared budget.
create or replace function public.ywi_rpc_landscape_decide_554(
 p_company_id uuid,p_request_id uuid,p_action text,p_idempotency_key uuid,
 p_expected_version integer,p_owner_note text default '',p_quote_cents integer default null,
 p_start timestamptz default null,p_end timestamptz default null,
 p_client_id uuid default null,p_site_id uuid default null,
 p_owner_checked boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_request public.ywi_landscape_booking_requests_552%rowtype;
 v_previous public.ywi_landscape_booking_decisions_554%rowtype;
 v_repeat public.ywi_landscape_booking_decision_audit_554%rowtype;
 v_state text;
 v_version integer;
 v_note text := btrim(coalesce(p_owner_note,''));
 v_hash text;
 v_day date;
 v_minutes integer;
 v_reserved integer := 0;
 v_availability jsonb;
 v_evidence jsonb;
 v_after jsonb;
 v_quote integer;
 v_client uuid;
 v_site uuid;
 v_start timestamptz;
 v_end timestamptz;
 v_attested boolean := false;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_request_id is null or p_idempotency_key is null or
    p_action not in ('hold','requote','decline','approve') or p_action is null or
    p_expected_version is null or p_expected_version not between 0 and 9999 or
    char_length(v_note)>800 then
   raise exception '554 action, idempotency, expected version or note invalid';
 end if;
 if p_action in ('hold','requote','decline') and char_length(v_note)<3 then
   raise exception '554 enter an owner decision explanation (at least 3 characters)';
 end if;
 if p_action='requote' and (p_quote_cents is null or p_quote_cents not between 0 and 100000000) then
   raise exception '554 proposed requote amount invalid';
 end if;
 if p_action<>'requote' and p_quote_cents is not null then
   raise exception '554 only a requote may carry a new draft amount';
 end if;
 if p_action<>'approve' and (p_start is not null or p_end is not null or
   p_client_id is not null or p_site_id is not null or p_owner_checked is true) then
   raise exception '554 only approval may include proposed scheduling or CRM fields';
 end if;
 v_hash:=md5(jsonb_build_object('action',p_action,'version',p_expected_version,
  'note',v_note,'quote',p_quote_cents,'start',p_start,'end',p_end,
  'client',p_client_id,'site',p_site_id,'checked',coalesce(p_owner_checked,false))::text);

 select * into v_request from public.ywi_landscape_booking_requests_552
  where company_id=p_company_id and id=p_request_id for update;
 if not found then raise exception '554 source request not in this owner company'; end if;
 select * into v_repeat from public.ywi_landscape_booking_decision_audit_554
  where company_id=p_company_id and idempotency_key=p_idempotency_key;
 if found then
  if v_repeat.request_id<>p_request_id or v_repeat.payload_hash<>v_hash then
   raise exception '554 idempotency key conflicts with another action';
  end if;
  return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
   'state',v_repeat.state_after,'idempotent_replay',true,
   'no_dispatch_write',true,'no_customer_message',true);
 end if;
 select * into v_previous from public.ywi_landscape_booking_decisions_554
  where company_id=p_company_id and request_id=p_request_id for update;
 v_version:=case when found then v_previous.decision_version else 0 end;
 if v_version<>p_expected_version then
  raise exception '554 decision changed; refresh the company queue before acting';
 end if;
 if v_previous.decision_state in ('declined','approved_pending_dispatch') then
  raise exception '554 terminal decision cannot be silently overwritten';
 end if;
 if p_action='approve' and v_previous.decision_state='requote_draft' then
  raise exception '554 a revised quote needs separately verified customer agreement';
 end if;
 if p_action='approve' then
  -- Original 421/422 check owns company service, Jobs-create and verified CRM links.
  perform public.ywi_421_assert_company_new_work(p_company_id,'landscape',p_client_id,p_site_id);
  if p_owner_checked is distinct from true or p_start is null or p_end is null or
     p_end<=p_start or p_start<now()+interval '15 minutes' then
    raise exception '554 reviewed owner acknowledgement and future date/time required';
  end if;
  v_day:=(p_start at time zone 'America/Toronto')::date;
  if (p_end at time zone 'America/Toronto')::date<>v_day or
     v_day>(now() at time zone 'America/Toronto')::date+179 then
    raise exception '554 proposal must fit inside one Toronto service date and 553 horizon';
  end if;
  v_minutes:=ceil(extract(epoch from p_end-p_start)/60)::integer;
  if v_minutes not between 30 and 720 then
    raise exception '554 proposed appointment must be 30–720 minutes';
  end if;
  if v_request.requested_date is distinct from v_day and char_length(v_note)<10 then
    raise exception '554 explain schedule differing from customer preferred date';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_company_id::text),pg_catalog.hashtext(v_day::text));
  v_availability:=public.ywi_rpc_landscape_availability_553(p_company_id,p_request_id,v_day);
  if v_availability->>'company_id'<>p_company_id::text or
     v_availability->>'request_id'<>p_request_id::text or
     v_availability->>'availability_state'<>'review' or
     v_availability->>'coverage_state'<>'included' or
     v_availability->>'schedule_state'<>'company_dispatch_verified' or
     v_availability->>'capacity_state'<>'potential_headroom' or
     coalesce((v_availability->>'missing_crew_assignment_count')::integer,0)>0 or
     coalesce((v_availability->>'not_ready_asset_count')::integer,0)>0 then
    raise exception '554 original 553 area, capacity, Dispatch or asset review not ready';
  end if;
  select coalesce(sum(planned_minutes),0)::integer into v_reserved
   from public.ywi_landscape_booking_decisions_554
   where company_id=p_company_id and decision_state='approved_pending_dispatch'
     and (proposed_start at time zone 'America/Toronto')::date=v_day;
  if v_minutes+v_reserved>coalesce((v_availability->>'remaining_minutes_advisory')::integer,0) then
    raise exception '554 requested minutes exceed remaining crew budget including pending owner proposals';
  end if;
  v_state:='approved_pending_dispatch';
  v_evidence:=jsonb_build_object('evaluated_at',v_availability->'evaluated_at',
    'availability_state',v_availability->'availability_state',
    'weather_state',v_availability->'weather_state',
    'capacity_state',v_availability->'capacity_state',
    'original_dispatch_count',v_availability->'original_dispatch_count',
    'scheduled_minutes',v_availability->'scheduled_minutes',
    'owner_planned_proposal_minutes',v_reserved,'owner_attested',true,
    'customer_confirmation_obtained',false,'dispatch_reservation_created',false);
  v_client:=p_client_id;v_site:=p_site_id;v_start:=p_start;v_end:=p_end;v_attested:=true;
 elsif p_action='requote' then
  v_state:='requote_draft';v_quote:=p_quote_cents;
 elsif p_action='decline' then
  v_state:='declined';
 else
  v_state:='review_hold';
 end if;
 insert into public.ywi_landscape_booking_decisions_554
  (company_id,request_id,decision_version,decision_state,owner_note,owner_quote_cents,
   proposed_start,proposed_end,planned_minutes,client_id,client_site_id,
   availability_evidence,owner_checked_site_safety,decided_by)
 values(p_company_id,p_request_id,v_version+1,v_state,v_note,v_quote,
   v_start,v_end,v_minutes,v_client,v_site,v_evidence,v_attested,auth.uid())
 on conflict(company_id,request_id) do update set
  decision_version=excluded.decision_version,decision_state=excluded.decision_state,
  owner_note=excluded.owner_note,owner_quote_cents=excluded.owner_quote_cents,
  proposed_start=excluded.proposed_start,proposed_end=excluded.proposed_end,
  planned_minutes=excluded.planned_minutes,client_id=excluded.client_id,
  client_site_id=excluded.client_site_id,availability_evidence=excluded.availability_evidence,
  owner_checked_site_safety=excluded.owner_checked_site_safety,
  decided_by=excluded.decided_by,updated_at=now();
 select to_jsonb(d) into v_after from public.ywi_landscape_booking_decisions_554 d
  where d.company_id=p_company_id and d.request_id=p_request_id;
 insert into public.ywi_landscape_booking_decision_audit_554
  (company_id,request_id,idempotency_key,action,payload_hash,decision_version,state_after,actor_user_id)
 values(p_company_id,p_request_id,p_idempotency_key,p_action,v_hash,v_version+1,v_after,auth.uid());
 return jsonb_build_object('company_id',p_company_id,'request_id',p_request_id,
  'state',v_after,'idempotent_replay',false,'no_dispatch_write',true,
  'no_customer_message',true,'customer_confirmation_pending',v_state='approved_pending_dispatch');
end $$;
revoke all on function public.ywi_rpc_landscape_decide_554(
 uuid,uuid,text,uuid,integer,text,integer,timestamptz,timestamptz,uuid,uuid,boolean
) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_decide_554(
 uuid,uuid,text,uuid,integer,text,integer,timestamptz,timestamptz,uuid,uuid,boolean
) to authenticated;
comment on function public.ywi_rpc_landscape_decide_554(
 uuid,uuid,text,uuid,integer,text,integer,timestamptz,timestamptz,uuid,uuid,boolean
) is 'YW554 original 552 request remains immutable; owner-only versioned decisions and audit, capacity-checked proposals only, canonical Dispatch unchanged.';
