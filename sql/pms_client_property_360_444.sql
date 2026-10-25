-- YW Item 444: additive first-party Client & Property 360 evidence.
-- Canonical customers/properties/Jobs remain in clients, client_sites, and 422 links.
-- A private append-only owner ledger keeps contacts, assets, reported contracts,
-- photo REFERENCES (not uploads), and consent EVIDENCE (not sending authority).
begin;
create table if not exists public.ywi_pms_360_entries_444 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 client_id uuid not null,
 client_site_id uuid,
 request_id uuid not null,
 entry_kind text not null check(entry_kind in ('contact','asset','contract','photo','consent')),
 title text not null check(char_length(btrim(title)) between 2 and 120),
 details text check(details is null or char_length(details)<=600),
 source_reference text check(source_reference is null or char_length(source_reference)<=250),
 reported_status text not null check(reported_status in
  ('primary','alternate','good','monitor','repair','unknown','draft','reported_active',
   'expired','ended','reference_only','given','withdrawn')),
 channel text check(channel is null or channel in ('email','sms','phone','postal')),
 consent_scope text check(consent_scope is null or consent_scope in ('service_updates','marketing')),
 valid_from date,
 valid_until date,
 created_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),
 foreign key(company_id,client_id)
  references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 foreign key(company_id,client_id,client_site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 constraint ywi_444_type_values check(
  (entry_kind='contact' and client_site_id is null and reported_status in ('primary','alternate')
   and channel is null and consent_scope is null and valid_from is null and valid_until is null) or
  (entry_kind='asset' and client_site_id is not null and reported_status in ('good','monitor','repair','unknown')
   and channel is null and consent_scope is null and valid_from is null and valid_until is null) or
  (entry_kind='contract' and client_site_id is not null and reported_status in
   ('draft','reported_active','expired','ended') and nullif(btrim(source_reference),'') is not null
   and channel is null and consent_scope is null) or
  (entry_kind='photo' and client_site_id is not null and reported_status='reference_only'
   and nullif(btrim(source_reference),'') is not null and channel is null and consent_scope is null
   and valid_from is null and valid_until is null) or
  (entry_kind='consent' and client_site_id is null and reported_status in ('given','withdrawn','unknown')
   and channel is not null and consent_scope is not null
   and valid_from is null and valid_until is null
   and (reported_status='unknown' or nullif(btrim(source_reference),'') is not null))
 ),
 constraint ywi_444_valid_dates check(valid_until is null or (valid_from is not null and valid_until>=valid_from))
);
create index if not exists ywi_444_company_client_timeline
 on public.ywi_pms_360_entries_444(company_id,client_id,created_at desc,id desc);
create index if not exists ywi_444_company_property_timeline
 on public.ywi_pms_360_entries_444(company_id,client_id,client_site_id,created_at desc)
 where client_site_id is not null;
alter table public.ywi_pms_360_entries_444 enable row level security;
revoke all on public.ywi_pms_360_entries_444 from public,anon,authenticated;
drop policy if exists ywi_444_owner_read_defense on public.ywi_pms_360_entries_444;
create policy ywi_444_owner_read_defense on public.ywi_pms_360_entries_444
 for select to authenticated using(exists (
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));
-- No table grant to authenticated, no direct INSERT/UPDATE/DELETE policies.

create or replace function public.ywi_rpc_client_property_360_444(
 p_company_id uuid,p_client_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_history jsonb;v_items jsonb;v_count integer;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 -- The 422 RPC itself verifies original, active company/client/site links and
 -- excludes unrelated legacy data; never join unrestricted CRM views here.
 v_history:=public.ywi_rpc_customer_history_422(p_company_id,p_client_id);
 if v_history->>'company_id' is distinct from p_company_id::text
    or v_history->>'client_id' is distinct from p_client_id::text
    or v_history->>'legacy_unscoped_excluded' is distinct from 'true'
    or jsonb_array_length(v_history->'properties')>100 then
   raise exception '444 canonical company/client/property history unverifiable or over cap';
 end if;
 select count(*) into v_count from public.ywi_pms_360_entries_444
 where company_id=p_company_id and client_id=p_client_id;
 if v_count>200 then raise exception '444 timeline exceeds bounded review cap; use future pagination';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into v_items from (
  select e.id,e.client_site_id as property_id,e.entry_kind,e.title,e.details,
   e.source_reference,e.reported_status,e.channel,e.consent_scope,
   e.valid_from,e.valid_until,e.created_at
  from public.ywi_pms_360_entries_444 e
  where e.company_id=p_company_id and e.client_id=p_client_id
  order by e.created_at desc,e.id desc limit 200
 ) t;
 return jsonb_build_object('company_id',p_company_id,'client_id',p_client_id,
  'captured_at',statement_timestamp(),'owner_guard','ywi_422_assert_owner',
  'canonical_source','422-original-crm','history',v_history,
  'entries',v_items,'entries_count',v_count,'max_entries',200,
  'legacy_unscoped_excluded',true,'privacy_minimized',false,
  'photo_upload_available',false,'contract_execution_verified',false,
  'consent_authorizes_messaging',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_append_client_property_360_444(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_kind text,p_title text,p_details text default null,p_reference text default null,
 p_reported_status text default null,p_channel text default null,p_scope text default null,
 p_valid_from date default null,p_valid_until date default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;
 v_title text:=btrim(coalesce(p_title,''));
 v_details text:=nullif(btrim(coalesce(p_details,'')),'');
 v_reference text:=nullif(btrim(coalesce(p_reference,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_client_id is null or p_kind not in
  ('contact','asset','contract','photo','consent') or p_kind is null or
  char_length(v_title) not between 2 and 120 or
  char_length(coalesce(v_details,''))>600 or char_length(coalesce(v_reference,''))>250 then
   raise exception '444 invalid owner-scoped journal request';
 end if;
 if not exists(select 1 from public.ywi_company_client_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  where l.company_id=p_company_id and l.client_id=p_client_id) then
   raise exception '444 customer not actively owned by this company';
 end if;
 if p_site_id is not null then
  perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 end if;
 if p_kind='photo' and (v_reference ~* '(^https?://|\.\.|[?&#])') then
  raise exception '444 photo must be a private internal reference, never an external URL or traversal';
 end if;
 -- Serialize entries for one customer so the bounded 200-entry review cannot
 -- be exceeded by concurrent requests. A future paginated UI may raise cap.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  p_company_id::text||':'||p_client_id::text,444));
 if (select count(*) from public.ywi_pms_360_entries_444
     where company_id=p_company_id and client_id=p_client_id)>=200 then
  raise exception '444 review capacity reached; pagination required before further entries';
 end if;
 -- The DB constraints supply a second, mandatory type/status/consent gate.
 insert into public.ywi_pms_360_entries_444
 (company_id,client_id,client_site_id,request_id,entry_kind,title,details,
  source_reference,reported_status,channel,consent_scope,valid_from,valid_until,recorded_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,p_kind,v_title,v_details,
  v_reference,p_reported_status,p_channel,p_scope,p_valid_from,p_valid_until,auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_existing from public.ywi_pms_360_entries_444
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_existing.client_id is distinct from p_client_id
   or v_existing.client_site_id is distinct from p_site_id
   or v_existing.entry_kind is distinct from p_kind
   or v_existing.title is distinct from v_title
   or v_existing.details is distinct from v_details
   or v_existing.source_reference is distinct from v_reference
   or v_existing.reported_status is distinct from p_reported_status
   or v_existing.channel is distinct from p_channel
   or v_existing.consent_scope is distinct from p_scope
   or v_existing.valid_from is distinct from p_valid_from
   or v_existing.valid_until is distinct from p_valid_until
   or v_existing.recorded_by is distinct from auth.uid() then
    raise exception '444 request ID was reused with different content';
  end if;
  v_id:=v_existing.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,
  'client_id',p_client_id,'entry_kind',p_kind,'recorded',true,
  'sending_authorized',false,'contract_execution_verified',false);
end $$;

revoke all on function public.ywi_rpc_client_property_360_444(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_append_client_property_360_444(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,date,date)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_client_property_360_444(uuid,uuid) to authenticated;
grant execute on function public.ywi_rpc_append_client_property_360_444(uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,date,date)
 to authenticated;
comment on table public.ywi_pms_360_entries_444 is
 'Append-only, owner-bound company CRM notes, assets, contract/photo references and consent evidence; never a messaging or payment authority.';
commit;
