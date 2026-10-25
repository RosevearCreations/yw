-- PMS 447: OFF-by-default company accounting shell and field-access matrix.
-- This is a non-posting review journal, NOT the canonical GL/AP/AR/payment/tax ledger.
begin;
create table if not exists public.ywi_pms_accounting_config_447 (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 enabled boolean not null default false,
 allow_receivables boolean not null default false,
 allow_payables boolean not null default false,
 allow_costs boolean not null default false,
 allow_reports boolean not null default false,
 allow_payroll_reference boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict
);
create table if not exists public.ywi_pms_accounting_config_audit_447 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 previous_config jsonb not null,new_config jsonb not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default now()
);
create index if not exists ywi_447_accounting_audit_company on public.ywi_pms_accounting_config_audit_447(company_id,changed_at desc);
create table if not exists public.ywi_pms_accounting_drafts_447 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 category text not null check(category in ('receivable','payable','job_cost','ledger_note','tax_note')),
 title text not null check(char_length(btrim(title)) between 3 and 120),
 description text check(description is null or char_length(description)<=500),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 source_type text not null check(source_type in ('manual_review','quote_reference','job_reference','external_reference')),
 amount_cents bigint not null check(amount_cents between 0 and 10000000000),
 currency text not null default 'CAD' check(currency='CAD'),
 reported_status text not null check(reported_status in ('draft','for_review','blocked')),
 client_id uuid,site_id uuid,
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),
 constraint ywi_447_site_pair check((client_id is null and site_id is null) or
   (client_id is not null and site_id is not null)),
 foreign key(company_id,client_id,site_id)
  references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict
);
create index if not exists ywi_447_accounting_draft_timeline on public.ywi_pms_accounting_drafts_447(company_id,category,created_at desc,id desc);

alter table public.ywi_pms_accounting_config_447 enable row level security;
alter table public.ywi_pms_accounting_config_audit_447 enable row level security;
alter table public.ywi_pms_accounting_drafts_447 enable row level security;
revoke all on public.ywi_pms_accounting_config_447 from public,anon,authenticated;
revoke all on public.ywi_pms_accounting_config_audit_447 from public,anon,authenticated;
revoke all on public.ywi_pms_accounting_drafts_447 from public,anon,authenticated;

create or replace function public.ywi_447_assert_accounting_owner(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Both independent Admin-manage and Finance-manage are required, plus real
 -- company ownership and an active Auth profile; no role metadata shortcut.
 perform public.ywi_446_assert_payroll_owner(p_company_id);
end $$;

create or replace function public.ywi_447_assert_accounting_scope(p_company_id uuid,p_scope text)
returns void language plpgsql security definer set search_path='' as $$
declare v_config record;v_allowed boolean;
begin
 perform public.ywi_447_assert_accounting_owner(p_company_id);
 select * into v_config from public.ywi_pms_accounting_config_447
  where company_id=p_company_id and enabled=true;
 if not found then raise exception '447 company Accounting module OFF';end if;
 v_allowed:=case p_scope
   when 'receivables' then v_config.allow_receivables
   when 'payables' then v_config.allow_payables
   when 'costs' then v_config.allow_costs
   when 'reports' then v_config.allow_reports
   when 'payroll_reference' then v_config.allow_payroll_reference
   else false end;
 if not v_allowed then raise exception '447 company accounting field permission withheld';end if;
end $$;

-- Build 447 makes Accounting the parent security gate of Build 446. A payroll
-- switch alone cannot expose private rate/time/deduction figures when the
-- company turns Accounting or its Payroll field permission OFF.
create or replace function public.ywi_446_payroll_effective_enabled(p_company_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 perform public.ywi_446_assert_payroll_owner(p_company_id);
 return exists(select 1 from public.ywi_pms_payroll_config_446
   where company_id=p_company_id and enabled=true)
  and exists(select 1 from public.ywi_pms_accounting_config_447
   where company_id=p_company_id and enabled=true and allow_payroll_reference=true);
end $$;

create or replace function public.ywi_rpc_pms_accounting_snapshot_447(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cfg record;v_items jsonb;v_count integer;
begin
 perform public.ywi_447_assert_accounting_owner(p_company_id);
 select * into v_cfg from public.ywi_pms_accounting_config_447 where company_id=p_company_id;
 if not found or not v_cfg.enabled then
  return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
   'owner_guard','ywi_447_assert_accounting_owner','enabled',false,
   'access',jsonb_build_object('receivables',false,'payables',false,'costs',false,
     'reports',false,'payroll_reference',false,'bank',false),
   'drafts','[]'::jsonb,'draft_count',0,'ledger_posted',false,'payment_executed',false,
   'invoices_created',false,'tax_filing_available',false,'mutation_authorized',false);
 end if;
 select count(*) into v_count from public.ywi_pms_accounting_drafts_447 where company_id=p_company_id;
 if v_count>200 then raise exception '447 accounting drafts cap reached';end if;
 -- Hide unpermitted scope entries in the response even from a permitted
 -- company owner. All visible fields are non-posting operator draft amounts.
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_items
 from (select id,category,title,description,source_reference,source_type,amount_cents,
  currency,reported_status,client_id,site_id,created_at
  from public.ywi_pms_accounting_drafts_447 where company_id=p_company_id and
   ((category='receivable' and v_cfg.allow_receivables) or
    (category='payable' and v_cfg.allow_payables) or
    (category='job_cost' and v_cfg.allow_costs) or
    (category in ('ledger_note','tax_note') and v_cfg.allow_reports))
  order by created_at desc,id desc limit 200) t;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_447_assert_accounting_owner','enabled',true,
  'access',jsonb_build_object('receivables',v_cfg.allow_receivables,
    'payables',v_cfg.allow_payables,'costs',v_cfg.allow_costs,
    'reports',v_cfg.allow_reports,'payroll_reference',v_cfg.allow_payroll_reference,'bank',false),
  'drafts',v_items,'draft_count',jsonb_array_length(v_items),
  'ledger_posted',false,'payment_executed',false,
  'invoices_created',false,'tax_filing_available',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_accounting_config_447(
 p_company_id uuid,p_enabled boolean,p_receivables boolean,p_payables boolean,
 p_costs boolean,p_reports boolean,p_payroll_reference boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_prior jsonb;v_new jsonb;
begin
 perform public.ywi_447_assert_accounting_owner(p_company_id);
 if p_enabled is null or p_receivables is null or p_payables is null or
   p_costs is null or p_reports is null or p_payroll_reference is null then
  raise exception '447 explicit Accounting field matrix required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('accounting-config:'||p_company_id::text,447));
 select to_jsonb(t) into v_prior from (select enabled,allow_receivables,allow_payables,
   allow_costs,allow_reports,allow_payroll_reference
   from public.ywi_pms_accounting_config_447 where company_id=p_company_id) t;
 v_prior:=coalesce(v_prior,jsonb_build_object('enabled',false,'allow_receivables',false,
  'allow_payables',false,'allow_costs',false,'allow_reports',false,'allow_payroll_reference',false));
 v_new:=jsonb_build_object('enabled',p_enabled,'allow_receivables',p_receivables,
  'allow_payables',p_payables,'allow_costs',p_costs,'allow_reports',p_reports,
  'allow_payroll_reference',p_payroll_reference);
 if v_prior is distinct from v_new then
  insert into public.ywi_pms_accounting_config_447(company_id,enabled,allow_receivables,
   allow_payables,allow_costs,allow_reports,allow_payroll_reference,updated_by)
  values(p_company_id,p_enabled,p_receivables,p_payables,p_costs,p_reports,p_payroll_reference,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,
   allow_receivables=excluded.allow_receivables,allow_payables=excluded.allow_payables,
   allow_costs=excluded.allow_costs,allow_reports=excluded.allow_reports,
   allow_payroll_reference=excluded.allow_payroll_reference,
   updated_by=excluded.updated_by,updated_at=now();
  insert into public.ywi_pms_accounting_config_audit_447(company_id,previous_config,new_config,actor_id)
  values(p_company_id,v_prior,v_new,auth.uid());
 end if;
 return jsonb_build_object('company_id',p_company_id,'enabled',p_enabled,
  'access',jsonb_build_object('receivables',p_enabled and p_receivables,
   'payables',p_enabled and p_payables,'costs',p_enabled and p_costs,
   'reports',p_enabled and p_reports,'payroll_reference',p_enabled and p_payroll_reference,
   'bank',false),'ledger_posted',false,'payment_executed',false);
end $$;

create or replace function public.ywi_rpc_pms_accounting_append_447(
 p_company_id uuid,p_request_id uuid,p_category text,p_title text,
 p_source_type text,p_source_ref text,p_amount_cents bigint,
 p_status text,p_description text default null,p_client_id uuid default null,p_site_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;
 v_title text:=btrim(coalesce(p_title,''));v_ref text:=btrim(coalesce(p_source_ref,''));
 v_description text:=nullif(btrim(coalesce(p_description,'')),'');v_scope text;
begin
 v_scope:=case p_category
  when 'receivable' then 'receivables'
  when 'payable' then 'payables'
  when 'job_cost' then 'costs'
  when 'ledger_note' then 'reports'
  when 'tax_note' then 'reports' else null end;
 perform public.ywi_447_assert_accounting_scope(p_company_id,v_scope);
 if p_request_id is null or char_length(v_title) not between 3 and 120 or
  char_length(v_ref) not between 3 and 160 or
  p_source_type not in ('manual_review','quote_reference','job_reference','external_reference') or p_source_type is null or
  p_status not in ('draft','for_review','blocked') or p_status is null or
  p_amount_cents not between 0 and 10000000000 or p_amount_cents is null or
  char_length(coalesce(v_description,''))>500 or
  ((p_client_id is null)<>(p_site_id is null)) then
  raise exception '447 invalid non-posting Accounting draft';end if;
 if p_client_id is not null then
  perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('accounting-draft:'||p_company_id::text,447));
 select * into v_existing from public.ywi_pms_accounting_drafts_447
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.category is distinct from p_category or v_existing.title is distinct from v_title or
   v_existing.source_type is distinct from p_source_type or v_existing.source_reference is distinct from v_ref or
   v_existing.amount_cents is distinct from p_amount_cents or
   v_existing.reported_status is distinct from p_status or
   v_existing.description is distinct from v_description or
   v_existing.client_id is distinct from p_client_id or v_existing.site_id is distinct from p_site_id then
   raise exception '447 Accounting idempotency collision';end if;
  return v_existing.id;
 end if;
 if (select count(*) from public.ywi_pms_accounting_drafts_447 where company_id=p_company_id)>=200 then
  raise exception '447 accounting journal cap reached';end if;
 insert into public.ywi_pms_accounting_drafts_447(company_id,request_id,category,title,
  source_type,source_reference,amount_cents,reported_status,description,client_id,site_id,created_by)
 values(p_company_id,p_request_id,p_category,v_title,p_source_type,v_ref,p_amount_cents,
  p_status,v_description,p_client_id,p_site_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.ywi_447_assert_accounting_owner(uuid) from public,anon,authenticated;
revoke all on function public.ywi_447_assert_accounting_scope(uuid,text) from public,anon,authenticated;
revoke all on function public.ywi_446_payroll_effective_enabled(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_accounting_snapshot_447(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_accounting_config_447(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_accounting_append_447(uuid,uuid,text,text,text,text,bigint,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_accounting_snapshot_447(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_accounting_config_447(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.ywi_rpc_pms_accounting_append_447(uuid,uuid,text,text,text,text,bigint,text,text,uuid,uuid) to authenticated;
commit;
