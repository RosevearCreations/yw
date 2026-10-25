-- PMS 445 companion: opt-in rural garbage collection, manual sticker and contract service.
-- No automatic sticker sale, payment, municipal approval, route dispatch or invoicing.
begin;
create table if not exists public.ywi_pms_garbage_config_445 (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict
);
create table if not exists public.ywi_pms_garbage_switch_audit_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 previous_enabled boolean not null,new_enabled boolean not null,
 changed_at timestamptz not null default now(),
 actor_id uuid not null references auth.users(id) on delete restrict
);
create index if not exists ywi_445_garbage_audit_timeline on public.ywi_pms_garbage_switch_audit_445(company_id,changed_at desc);

create table if not exists public.ywi_pms_garbage_stickers_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,client_id uuid not null,site_id uuid not null,
 request_id uuid not null,
 serial text not null check(serial ~ '^[A-Za-z0-9-]{4,40}$'),
 reported_receipt_ref text check(reported_receipt_ref is null or char_length(reported_receipt_ref)<=160),
 status text not null default 'issued' check(status in ('issued','redeemed','void')),
 issued_at timestamptz not null default now(),redeemed_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),unique(company_id,serial),
 unique(company_id,client_id,site_id,id),
 foreign key(company_id,client_id,site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict
);
create index if not exists ywi_445_garbage_stickers_company on public.ywi_pms_garbage_stickers_445(company_id,issued_at desc);
create table if not exists public.ywi_pms_garbage_contracts_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,client_id uuid not null,site_id uuid not null,
 request_id uuid not null,
 agreement_ref text not null check(char_length(btrim(agreement_ref)) between 3 and 160),
 pickup_interval_days integer not null check(pickup_interval_days in (7,14,28)),
 reported_status text not null check(reported_status in ('draft','reported_active','ended')),
 created_at timestamptz not null default now(),created_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),unique(company_id,client_id,site_id,id),
 foreign key(company_id,client_id,site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict
);
create index if not exists ywi_445_garbage_contracts_company on public.ywi_pms_garbage_contracts_445(company_id,created_at desc);
create table if not exists public.ywi_pms_garbage_pickups_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,client_id uuid not null,site_id uuid not null,
 request_id uuid not null,
 service_basis text not null check(service_basis in ('sticker','contract')),
 sticker_id uuid,contract_id uuid,
 planned_date date not null,
 reported_status text not null default 'scheduled' check(reported_status in ('scheduled','collected','missed','cancelled')),
 field_notes text check(field_notes is null or char_length(field_notes)<=400),
 created_at timestamptz not null default now(),completed_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 completed_by uuid references auth.users(id) on delete restrict,
 unique(company_id,request_id),
 foreign key(company_id,client_id,site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 foreign key(company_id,client_id,site_id,sticker_id)
  references public.ywi_pms_garbage_stickers_445(company_id,client_id,site_id,id) on delete restrict,
 foreign key(company_id,client_id,site_id,contract_id)
  references public.ywi_pms_garbage_contracts_445(company_id,client_id,site_id,id) on delete restrict,
 constraint ywi_445_garbage_source_only check((service_basis='sticker' and sticker_id is not null and contract_id is null)
    or (service_basis='contract' and contract_id is not null and sticker_id is null)),
 constraint ywi_445_garbage_completion check((reported_status='scheduled' and completed_at is null and completed_by is null)
    or (reported_status<>'scheduled' and completed_at is not null and completed_by is not null))
);
create unique index if not exists ywi_445_garbage_once_per_sticker
 on public.ywi_pms_garbage_pickups_445(company_id,sticker_id)
 where sticker_id is not null and reported_status in ('scheduled','collected');
create index if not exists ywi_445_garbage_pickups_by_date on public.ywi_pms_garbage_pickups_445(company_id,planned_date desc,id desc);

alter table public.ywi_pms_garbage_config_445 enable row level security;
alter table public.ywi_pms_garbage_switch_audit_445 enable row level security;
alter table public.ywi_pms_garbage_stickers_445 enable row level security;
alter table public.ywi_pms_garbage_contracts_445 enable row level security;
alter table public.ywi_pms_garbage_pickups_445 enable row level security;
revoke all on public.ywi_pms_garbage_config_445 from public,anon,authenticated;
revoke all on public.ywi_pms_garbage_switch_audit_445 from public,anon,authenticated;
revoke all on public.ywi_pms_garbage_stickers_445 from public,anon,authenticated;
revoke all on public.ywi_pms_garbage_contracts_445 from public,anon,authenticated;
revoke all on public.ywi_pms_garbage_pickups_445 from public,anon,authenticated;
-- None of the five new tables has direct browser grants or INSERT/UPDATE policies.

create or replace function public.ywi_445_assert_garbage_enabled(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if not exists(select 1 from public.ywi_pms_garbage_config_445
  where company_id=p_company_id and enabled=true) then
  raise exception '445 garbage module OFF: new sticker, contract and pickup work denied';end if;
end $$;

create or replace function public.ywi_rpc_pms_garbage_snapshot_445(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_enabled boolean;v_stickers jsonb;v_contracts jsonb;v_pickups jsonb;
 v_sticker_count integer;v_contract_count integer;v_pickup_count integer;
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 select coalesce((select enabled from public.ywi_pms_garbage_config_445
    where company_id=p_company_id),false) into v_enabled;
 select count(*) into v_sticker_count from public.ywi_pms_garbage_stickers_445 where company_id=p_company_id;
 select count(*) into v_contract_count from public.ywi_pms_garbage_contracts_445 where company_id=p_company_id;
 select count(*) into v_pickup_count from public.ywi_pms_garbage_pickups_445 where company_id=p_company_id;
 if v_sticker_count>100 or v_contract_count>100 or v_pickup_count>200 then
  raise exception '445 garbage source caps reached; pagination required';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.issued_at desc),'[]'::jsonb) into v_stickers
 from (select id,client_id,site_id,serial,reported_receipt_ref,status,issued_at,redeemed_at
  from public.ywi_pms_garbage_stickers_445 where company_id=p_company_id order by issued_at desc,id desc limit 100) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_contracts
 from (select id,client_id,site_id,agreement_ref,pickup_interval_days,reported_status,created_at
  from public.ywi_pms_garbage_contracts_445 where company_id=p_company_id order by created_at desc,id desc limit 100) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_pickups
 from (select id,client_id,site_id,service_basis,sticker_id,contract_id,planned_date,
  reported_status,field_notes,created_at,completed_at
  from public.ywi_pms_garbage_pickups_445 where company_id=p_company_id order by created_at desc,id desc limit 200) t;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_445_assert_hr_owner','enabled',v_enabled,
  'stickers',v_stickers,'contracts',v_contracts,'pickups',v_pickups,
  'sticker_count',v_sticker_count,'contract_count',v_contract_count,'pickup_count',v_pickup_count,
  'source_caps',jsonb_build_object('stickers',100,'contracts',100,'pickups',200),
  'financial_receipt_verified',false,'auto_billing',false,'municipal_authorization',false,
  'route_dispatched',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_garbage_switch_445(p_company_id uuid,p_enabled boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_prior boolean;
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 if p_enabled is null then raise exception '445 explicit garbage switch required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('garbage-switch:'||p_company_id::text,445));
 select coalesce((select enabled from public.ywi_pms_garbage_config_445 where company_id=p_company_id),false) into v_prior;
 if v_prior is distinct from p_enabled then
  insert into public.ywi_pms_garbage_config_445(company_id,enabled,updated_by)
  values(p_company_id,p_enabled,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,updated_at=now(),updated_by=excluded.updated_by;
  insert into public.ywi_pms_garbage_switch_audit_445(company_id,previous_enabled,new_enabled,actor_id)
  values(p_company_id,v_prior,p_enabled,auth.uid());
 end if;
 return jsonb_build_object('company_id',p_company_id,'enabled',p_enabled,'previous_enabled',v_prior,
  'new_work_authorized',false,'automatic_billing',false);
end $$;

create or replace function public.ywi_rpc_pms_garbage_issue_sticker_445(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_serial text,p_reported_receipt_ref text default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;v_serial text:=btrim(coalesce(p_serial,''));
 v_ref text:=nullif(btrim(coalesce(p_reported_receipt_ref,'')),'');
begin
 perform public.ywi_445_assert_garbage_enabled(p_company_id);
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 if p_request_id is null or v_serial !~ '^[A-Za-z0-9-]{4,40}$' or char_length(coalesce(v_ref,''))>160 then
  raise exception '445 invalid sticker serial or receipt reference';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('garbage-sticker:'||p_company_id::text,445));
 select * into v_existing from public.ywi_pms_garbage_stickers_445 where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.client_id is distinct from p_client_id or v_existing.site_id is distinct from p_site_id or
    v_existing.serial is distinct from v_serial or v_existing.reported_receipt_ref is distinct from v_ref then
   raise exception '445 sticker request ID collision';end if;
  return v_existing.id;
 end if;
 if (select count(*) from public.ywi_pms_garbage_stickers_445 where company_id=p_company_id)>=100 then
  raise exception '445 sticker review cap reached';end if;
 insert into public.ywi_pms_garbage_stickers_445(company_id,client_id,site_id,request_id,serial,reported_receipt_ref,created_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,v_serial,v_ref,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_garbage_contract_445(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_agreement_ref text,p_interval_days integer,p_status text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;v_ref text:=btrim(coalesce(p_agreement_ref,''));
begin
 perform public.ywi_445_assert_garbage_enabled(p_company_id);
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 if p_request_id is null or char_length(v_ref) not between 3 and 160 or
  p_interval_days not in (7,14,28) or p_interval_days is null or
  p_status not in ('draft','reported_active','ended') or p_status is null then
   raise exception '445 invalid reported garbage contract';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('garbage-contract:'||p_company_id::text,445));
 select * into v_existing from public.ywi_pms_garbage_contracts_445 where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.client_id is distinct from p_client_id or v_existing.site_id is distinct from p_site_id or
    v_existing.agreement_ref is distinct from v_ref or
    v_existing.pickup_interval_days is distinct from p_interval_days or
    v_existing.reported_status is distinct from p_status then
   raise exception '445 garbage contract request ID collision';end if;
  return v_existing.id;
 end if;
 if (select count(*) from public.ywi_pms_garbage_contracts_445 where company_id=p_company_id)>=100 then
  raise exception '445 garbage contract cap reached';end if;
 insert into public.ywi_pms_garbage_contracts_445(company_id,client_id,site_id,request_id,
  agreement_ref,pickup_interval_days,reported_status,created_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,v_ref,p_interval_days,p_status,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_garbage_schedule_445(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_request_id uuid,
 p_basis text,p_source_id uuid,p_planned_date date)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;
begin
 perform public.ywi_445_assert_garbage_enabled(p_company_id);
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 if p_request_id is null or p_source_id is null or p_planned_date is null or
   p_basis not in ('sticker','contract') or p_basis is null then
   raise exception '445 pickup needs valid sticker/contract and date';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('garbage-pickup:'||p_company_id::text,445));
 select * into v_existing from public.ywi_pms_garbage_pickups_445
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.client_id is distinct from p_client_id or v_existing.site_id is distinct from p_site_id or
   v_existing.service_basis is distinct from p_basis or v_existing.planned_date is distinct from p_planned_date or
   coalesce(v_existing.sticker_id,v_existing.contract_id) is distinct from p_source_id then
    raise exception '445 pickup request ID collision';end if;
  return v_existing.id;
 end if;
 -- Availability applies to NEW schedules; identical request retries remain
 -- idempotent even after a sticker was redeemed or a contract was ended.
 if p_basis='sticker' and not exists(select 1 from public.ywi_pms_garbage_stickers_445
  where id=p_source_id and company_id=p_company_id and client_id=p_client_id and site_id=p_site_id and status='issued') then
   raise exception '445 sticker unavailable, used or foreign';end if;
 if p_basis='contract' and not exists(select 1 from public.ywi_pms_garbage_contracts_445
  where id=p_source_id and company_id=p_company_id and client_id=p_client_id and site_id=p_site_id and reported_status='reported_active') then
   raise exception '445 contract not reported active or foreign';end if;
 if (select count(*) from public.ywi_pms_garbage_pickups_445 where company_id=p_company_id)>=200 then
   raise exception '445 pickup review cap reached';end if;
 insert into public.ywi_pms_garbage_pickups_445(company_id,client_id,site_id,request_id,
  service_basis,sticker_id,contract_id,planned_date,created_by)
 values(p_company_id,p_client_id,p_site_id,p_request_id,p_basis,
  case when p_basis='sticker' then p_source_id else null end,
  case when p_basis='contract' then p_source_id else null end,p_planned_date,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_garbage_complete_445(
 p_company_id uuid,p_pickup_id uuid,p_outcome text,p_notes text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_row record;v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 -- Closing or cancelling previously scheduled obligations is still available
 -- when a service is OFF. No new work is created by this closure RPC.
 perform public.ywi_445_assert_hr_owner(p_company_id);
 if p_pickup_id is null or p_outcome not in ('collected','missed','cancelled') or p_outcome is null or
  char_length(coalesce(v_notes,''))>400 then raise exception '445 invalid pickup outcome';end if;
 select * into v_row from public.ywi_pms_garbage_pickups_445
  where company_id=p_company_id and id=p_pickup_id for update;
 if not found or v_row.reported_status<>'scheduled' then
  raise exception '445 pickup missing, foreign or already closed';end if;
 if p_outcome='collected' and v_row.service_basis='sticker' then
  update public.ywi_pms_garbage_stickers_445 set status='redeemed',redeemed_at=now()
  where company_id=p_company_id and id=v_row.sticker_id and status='issued';
  if not found then raise exception '445 sticker already redeemed or unavailable';end if;
 end if;
 update public.ywi_pms_garbage_pickups_445 set reported_status=p_outcome,field_notes=v_notes,
  completed_at=now(),completed_by=auth.uid() where id=p_pickup_id and company_id=p_company_id;
 return jsonb_build_object('id',p_pickup_id,'company_id',p_company_id,
  'reported_status',p_outcome,'sticker_redeemed',p_outcome='collected' and v_row.service_basis='sticker',
  'payment_collected',false,'invoice_posted',false,'dispatch_sent',false);
end $$;

revoke all on function public.ywi_445_assert_garbage_enabled(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_snapshot_445(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_switch_445(uuid,boolean) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_issue_sticker_445(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_contract_445(uuid,uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_schedule_445(uuid,uuid,uuid,uuid,text,uuid,date) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_garbage_complete_445(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_garbage_snapshot_445(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_garbage_switch_445(uuid,boolean) to authenticated;
grant execute on function public.ywi_rpc_pms_garbage_issue_sticker_445(uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_garbage_contract_445(uuid,uuid,uuid,uuid,text,integer,text) to authenticated;
grant execute on function public.ywi_rpc_pms_garbage_schedule_445(uuid,uuid,uuid,uuid,text,uuid,date) to authenticated;
grant execute on function public.ywi_rpc_pms_garbage_complete_445(uuid,uuid,text,text) to authenticated;
commit;
