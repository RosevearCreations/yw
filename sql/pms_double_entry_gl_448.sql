-- PMS 448: company-private, double-entry accounting simulation and period close.
-- NO recognized ledger postings, bank feeds, payments, tax filing or live balances.
begin;
create table if not exists public.ywi_pms_gl_config_448 (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict
);
create table if not exists public.ywi_pms_gl_periods_448 (
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 period_start date not null check(extract(day from period_start)=1),
 locked boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict,
 primary key(company_id,period_start)
);
create table if not exists public.ywi_pms_gl_events_448 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 event_kind text not null check(event_kind in ('module_on','module_off','period_lock','period_unlock')),
 period_start date,
 previous_value boolean not null,new_value boolean not null,
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 actor_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint ywi_448_event_period check((event_kind in ('module_on','module_off') and period_start is null)
  or (event_kind in ('period_lock','period_unlock') and period_start is not null))
);
create index if not exists ywi_448_event_history on public.ywi_pms_gl_events_448(company_id,created_at desc);
create table if not exists public.ywi_pms_gl_journals_448 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 period_start date not null,
 effective_on date not null,
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 narration text not null check(char_length(btrim(narration)) between 3 and 240),
 reversal_of uuid,
 test_mode boolean not null default true check(test_mode=true),
 currency text not null default 'CAD' check(currency='CAD'),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,period_start) references public.ywi_pms_gl_periods_448(company_id,period_start) on delete restrict,
 foreign key(company_id,reversal_of) references public.ywi_pms_gl_journals_448(company_id,id) on delete restrict,
 constraint ywi_448_journal_period check(date_trunc('month',effective_on::timestamp)::date=period_start)
);
create unique index if not exists ywi_448_one_reversal on public.ywi_pms_gl_journals_448(company_id,reversal_of)
 where reversal_of is not null;
create index if not exists ywi_448_journal_period_history on public.ywi_pms_gl_journals_448(company_id,period_start,created_at desc);
create table if not exists public.ywi_pms_gl_lines_448 (
 company_id uuid not null,
 journal_id uuid not null,
 line_no integer not null check(line_no between 1 and 12),
 account_code text not null check(account_code in ('1000','1100','2000','2100','2200','4000','5000')),
 side text not null check(side in ('debit','credit')),
 amount_cents bigint not null check(amount_cents between 1 and 10000000000),
 primary key(company_id,journal_id,line_no),
 foreign key(company_id,journal_id) references public.ywi_pms_gl_journals_448(company_id,id) on delete restrict
);
create index if not exists ywi_448_line_account on public.ywi_pms_gl_lines_448(company_id,account_code,journal_id);
create table if not exists public.ywi_pms_gl_reviews_448 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 journal_id uuid not null,
 request_id uuid not null,
 review_status text not null check(review_status in ('reviewed_for_simulation','needs_correction','rejected')),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 created_at timestamptz not null default now(),
 actor_id uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),
 foreign key(company_id,journal_id) references public.ywi_pms_gl_journals_448(company_id,id) on delete restrict
);
create index if not exists ywi_448_review_history on public.ywi_pms_gl_reviews_448(company_id,journal_id,created_at desc);

alter table public.ywi_pms_gl_config_448 enable row level security;
alter table public.ywi_pms_gl_periods_448 enable row level security;
alter table public.ywi_pms_gl_events_448 enable row level security;
alter table public.ywi_pms_gl_journals_448 enable row level security;
alter table public.ywi_pms_gl_lines_448 enable row level security;
alter table public.ywi_pms_gl_reviews_448 enable row level security;
revoke all on public.ywi_pms_gl_config_448 from public,anon,authenticated;
revoke all on public.ywi_pms_gl_periods_448 from public,anon,authenticated;
revoke all on public.ywi_pms_gl_events_448 from public,anon,authenticated;
revoke all on public.ywi_pms_gl_journals_448 from public,anon,authenticated;
revoke all on public.ywi_pms_gl_lines_448 from public,anon,authenticated;
revoke all on public.ywi_pms_gl_reviews_448 from public,anon,authenticated;

create or replace function public.ywi_448_assert_gl_owner(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_447_assert_accounting_scope(p_company_id,'reports');
end $$;
create or replace function public.ywi_448_assert_gl_enabled(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_448_assert_gl_owner(p_company_id);
 if not exists(select 1 from public.ywi_pms_gl_config_448
   where company_id=p_company_id and enabled=true) then
  raise exception '448 company GL simulation OFF';end if;
end $$;

-- DEFERRABLE: journal header and child lines are inserted atomically by the only
-- browser-authorized RPC. The invariant is checked at COMMIT even for DB-owner edits.
create or replace function public.ywi_448_assert_balanced_journal()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_company uuid;v_journal uuid;v_debit numeric;v_credit numeric;v_count integer;
begin
 if tg_op='DELETE' then
  v_company:=old.company_id;
  v_journal:=case when tg_table_name='ywi_pms_gl_journals_448' then old.id else old.journal_id end;
 else
  v_company:=new.company_id;
  v_journal:=case when tg_table_name='ywi_pms_gl_journals_448' then new.id else new.journal_id end;
 end if;
 if not exists(select 1 from public.ywi_pms_gl_journals_448 where company_id=v_company and id=v_journal) then
  return null;end if;
 select count(*),coalesce(sum(amount_cents) filter(where side='debit'),0),
   coalesce(sum(amount_cents) filter(where side='credit'),0)
 into v_count,v_debit,v_credit from public.ywi_pms_gl_lines_448
 where company_id=v_company and journal_id=v_journal;
 if v_count<2 or v_count>12 or v_debit<>v_credit or v_debit<=0 then
  raise exception '448 incomplete or unbalanced simulation journal';end if;
 return null;
end $$;
create constraint trigger ywi_448_header_balance after insert or update on public.ywi_pms_gl_journals_448
 deferrable initially deferred for each row execute function public.ywi_448_assert_balanced_journal();
create constraint trigger ywi_448_line_balance after insert or update or delete on public.ywi_pms_gl_lines_448
 deferrable initially deferred for each row execute function public.ywi_448_assert_balanced_journal();

create or replace function public.ywi_rpc_pms_gl_snapshot_448(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_on boolean;v_count integer;v_periods jsonb;v_journals jsonb;v_accounts jsonb;
 v_total_debits bigint;v_total_credits bigint;v_reviews integer;
begin
 perform public.ywi_448_assert_gl_owner(p_company_id);
 select exists(select 1 from public.ywi_pms_gl_config_448
  where company_id=p_company_id and enabled=true) into v_on;
 if not v_on then
  return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
   'owner_guard','ywi_448_assert_gl_owner','enabled',false,'test_mode',true,
   'periods','[]'::jsonb,'journals','[]'::jsonb,'accounts','[]'::jsonb,
   'journal_count',0,'period_count',0,'total_debits_cents',0,'total_credits_cents',0,
   'posting_available',false,'bank_access',false,'tax_filing_available',false,
   'real_balance_changed',false);
 end if;
 select count(*) into v_count from public.ywi_pms_gl_journals_448 where company_id=p_company_id;
 if v_count>100 or (select count(*) from public.ywi_pms_gl_periods_448 where company_id=p_company_id)>24 or
  (select count(*) from public.ywi_pms_gl_reviews_448 where company_id=p_company_id)>200 then
  raise exception '448 bounded GL preview capacity exceeded';end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.period_start desc),'[]'::jsonb) into v_periods
 from (select period_start,locked from public.ywi_pms_gl_periods_448
  where company_id=p_company_id order by period_start desc limit 24) p;
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'period_start',j.period_start,
  'effective_on',j.effective_on,'source_reference',j.source_reference,'narration',j.narration,
  'reversal_of',j.reversal_of,'created_at',j.created_at,'test_mode',j.test_mode,
  'review_status',(select review_status from public.ywi_pms_gl_reviews_448 r
    where r.company_id=j.company_id and r.journal_id=j.id
    order by r.created_at desc,r.id desc limit 1),
  'lines',(select coalesce(jsonb_agg(jsonb_build_object('account',l.account_code,
    'side',l.side,'cents',l.amount_cents) order by l.line_no),'[]'::jsonb)
    from public.ywi_pms_gl_lines_448 l where l.company_id=j.company_id and l.journal_id=j.id))
  order by j.created_at desc,j.id desc),'[]'::jsonb) into v_journals
 from (select * from public.ywi_pms_gl_journals_448 where company_id=p_company_id
  order by created_at desc,id desc limit 100) j;
 select coalesce(jsonb_agg(jsonb_build_object('account',a.account_code,'net_debit_cents',a.net_debit_cents,
    'liability_debit_warning',(a.account_code in ('2000','2100','2200') and a.net_debit_cents>0))
    order by a.account_code),'[]'::jsonb) into v_accounts
 from (select account_code,sum(case when side='debit' then amount_cents else -amount_cents end)::bigint
   as net_debit_cents from public.ywi_pms_gl_lines_448 where company_id=p_company_id
  group by account_code) a;
 select coalesce(sum(l.amount_cents) filter(where l.side='debit'),0),
  coalesce(sum(l.amount_cents) filter(where l.side='credit'),0)
 into v_total_debits,v_total_credits from public.ywi_pms_gl_lines_448 l where l.company_id=p_company_id;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_448_assert_gl_owner','enabled',true,'test_mode',true,
  'periods',v_periods,'period_count',jsonb_array_length(v_periods),
  'journals',v_journals,'journal_count',v_count,'accounts',v_accounts,
  'total_debits_cents',v_total_debits,'total_credits_cents',v_total_credits,
  'posting_available',false,'bank_access',false,'tax_filing_available',false,
  'real_balance_changed',false);
end $$;

create or replace function public.ywi_rpc_pms_gl_toggle_448(
 p_company_id uuid,p_enabled boolean,p_reference text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_old boolean;v_ref text:=btrim(coalesce(p_reference,''));
begin
 perform public.ywi_448_assert_gl_owner(p_company_id);
 if p_enabled is null or char_length(v_ref) not between 3 and 160 then raise exception '448 explicit source and switch required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pms-gl:'||p_company_id::text,448));
 select exists(select 1 from public.ywi_pms_gl_config_448
  where company_id=p_company_id and enabled=true) into v_old;
 if v_old is distinct from p_enabled then
  insert into public.ywi_pms_gl_config_448(company_id,enabled,updated_by)
  values(p_company_id,p_enabled,auth.uid()) on conflict(company_id) do update
   set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
  insert into public.ywi_pms_gl_events_448(company_id,event_kind,previous_value,new_value,source_reference,actor_id)
  values(p_company_id,case when p_enabled then 'module_on' else 'module_off' end,v_old,p_enabled,v_ref,auth.uid());
 end if;
 return jsonb_build_object('company_id',p_company_id,'enabled',p_enabled,
  'posting_available',false,'bank_access',false);
end $$;

create or replace function public.ywi_rpc_pms_gl_lock_448(
 p_company_id uuid,p_period_start date,p_locked boolean,p_reference text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_prev boolean;v_ref text:=btrim(coalesce(p_reference,''));
begin
 perform public.ywi_448_assert_gl_enabled(p_company_id);
 if p_locked is null or p_period_start is null or extract(day from p_period_start)<>1 or
  char_length(v_ref) not between 3 and 160 then raise exception '448 invalid period close instruction';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pms-gl:'||p_company_id::text,448));
 insert into public.ywi_pms_gl_periods_448(company_id,period_start,updated_by)
 values(p_company_id,p_period_start,auth.uid()) on conflict do nothing;
 select locked into v_prev from public.ywi_pms_gl_periods_448
  where company_id=p_company_id and period_start=p_period_start for update;
 if v_prev is distinct from p_locked then
  update public.ywi_pms_gl_periods_448 set locked=p_locked,updated_by=auth.uid(),updated_at=now()
   where company_id=p_company_id and period_start=p_period_start;
  insert into public.ywi_pms_gl_events_448(company_id,event_kind,period_start,
   previous_value,new_value,source_reference,actor_id)
  values(p_company_id,case when p_locked then 'period_lock' else 'period_unlock' end,
   p_period_start,v_prev,p_locked,v_ref,auth.uid());
 end if;
 return jsonb_build_object('company_id',p_company_id,'period_start',p_period_start,
  'locked',p_locked,'test_mode',true);
end $$;

create or replace function public.ywi_rpc_pms_gl_append_448(
 p_company_id uuid,p_request_id uuid,p_effective_on date,p_source_ref text,
 p_narration text,p_lines jsonb,p_reversal_of uuid default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_prev record;v_period date;v_entry jsonb;v_number integer:=0;
 v_debit numeric:=0;v_credit numeric:=0;v_cents bigint;v_account text;v_side text;
 v_prior jsonb;v_lines jsonb;v_ref text:=btrim(coalesce(p_source_ref,''));
 v_narration text:=btrim(coalesce(p_narration,''));
begin
 perform public.ywi_448_assert_gl_enabled(p_company_id);
 if p_request_id is null or p_effective_on is null or char_length(v_ref) not between 3 and 160 or
  char_length(v_narration) not between 3 and 240 or jsonb_typeof(p_lines) is distinct from 'array' or
  jsonb_array_length(p_lines) not between 2 and 12 then raise exception '448 invalid simulated journal';end if;
 v_period:=date_trunc('month',p_effective_on::timestamp)::date;
 for v_entry in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(v_entry) is distinct from 'object' or
   (select count(*) from jsonb_object_keys(v_entry))<>3 or
   jsonb_typeof(v_entry->'cents') is distinct from 'number' or
   (v_entry->>'cents') !~ '^[0-9]{1,11}$' or
   coalesce(v_entry->>'account','') not in ('1000','1100','2000','2100','2200','4000','5000') or
   coalesce(v_entry->>'side','') not in ('debit','credit') then
   raise exception '448 invalid GL line type or account';end if;
  v_cents:=(v_entry->>'cents')::bigint;v_account:=v_entry->>'account';v_side:=v_entry->>'side';
  if v_cents<1 or v_cents>10000000000 then raise exception '448 invalid GL cents';end if;
  if v_side='debit' then v_debit:=v_debit+v_cents;else v_credit:=v_credit+v_cents;end if;
 end loop;
 if v_debit<>v_credit or v_debit<=0 then raise exception '448 debit/credit simulation must balance';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pms-gl:'||p_company_id::text,448));
 select * into v_prev from public.ywi_pms_gl_journals_448
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  select coalesce(jsonb_agg(jsonb_build_object('account',account_code,'side',side,'cents',amount_cents)
   order by line_no),'[]'::jsonb) into v_prior from public.ywi_pms_gl_lines_448
    where company_id=p_company_id and journal_id=v_prev.id;
  if v_prev.effective_on is distinct from p_effective_on or
   v_prev.source_reference is distinct from v_ref or v_prev.narration is distinct from v_narration or
   v_prev.reversal_of is distinct from p_reversal_of or v_prior is distinct from p_lines then
   raise exception '448 journal request key reused for different simulation';end if;
  return v_prev.id;
 end if;
 insert into public.ywi_pms_gl_periods_448(company_id,period_start,updated_by)
 values(p_company_id,v_period,auth.uid()) on conflict do nothing;
 if (select locked from public.ywi_pms_gl_periods_448
  where company_id=p_company_id and period_start=v_period for update) then
  raise exception '448 period locked; journal simulation rejected';end if;
 if (select count(*) from public.ywi_pms_gl_journals_448 where company_id=p_company_id)>=100 or
  (select count(*) from public.ywi_pms_gl_periods_448 where company_id=p_company_id)>24 then
  raise exception '448 GL preview bounded capacity reached';end if;
 if p_reversal_of is not null then
  select * into v_prev from public.ywi_pms_gl_journals_448
   where company_id=p_company_id and id=p_reversal_of;
  if not found or v_prev.period_start<>v_period or v_prev.reversal_of is not null or
   exists(select 1 from public.ywi_pms_gl_journals_448
    where company_id=p_company_id and reversal_of=p_reversal_of) then
    raise exception '448 reversal requires same-company, same-period unreversed original';end if;
  select coalesce(jsonb_agg(jsonb_build_object('account',account_code,
   'side',case when side='debit' then 'credit' else 'debit' end,'cents',amount_cents)
   order by line_no),'[]'::jsonb) into v_prior from public.ywi_pms_gl_lines_448
   where company_id=p_company_id and journal_id=p_reversal_of;
  if v_prior is distinct from p_lines then raise exception '448 reversal must exactly invert original simulated lines';end if;
 end if;
 insert into public.ywi_pms_gl_journals_448(company_id,request_id,period_start,effective_on,
  source_reference,narration,reversal_of,created_by)
 values(p_company_id,p_request_id,v_period,p_effective_on,v_ref,v_narration,p_reversal_of,auth.uid())
 returning id into v_id;
 for v_entry in select value from jsonb_array_elements(p_lines) loop
  v_number:=v_number+1;
  insert into public.ywi_pms_gl_lines_448(company_id,journal_id,line_no,account_code,side,amount_cents)
  values(p_company_id,v_id,v_number,v_entry->>'account',v_entry->>'side',(v_entry->>'cents')::bigint);
 end loop;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_gl_review_448(
 p_company_id uuid,p_journal_id uuid,p_request_id uuid,p_status text,p_source_ref text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_prev record;v_ref text:=btrim(coalesce(p_source_ref,''));
begin
 perform public.ywi_448_assert_gl_enabled(p_company_id);
 if p_request_id is null or p_journal_id is null or
  p_status not in ('reviewed_for_simulation','needs_correction','rejected') or p_status is null or
  char_length(v_ref) not between 3 and 160 then raise exception '448 invalid simulated journal review';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pms-gl:'||p_company_id::text,448));
 select * into v_prev from public.ywi_pms_gl_reviews_448
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_prev.journal_id is distinct from p_journal_id or v_prev.review_status is distinct from p_status or
   v_prev.source_reference is distinct from v_ref then raise exception '448 review key collision';end if;
  return v_prev.id;end if;
 if not exists(select 1 from public.ywi_pms_gl_journals_448
  where company_id=p_company_id and id=p_journal_id) or
  (select count(*) from public.ywi_pms_gl_reviews_448 where company_id=p_company_id)>=200 then
  raise exception '448 journal unavailable or review capacity reached';end if;
 insert into public.ywi_pms_gl_reviews_448(company_id,journal_id,request_id,
  review_status,source_reference,actor_id)
 values(p_company_id,p_journal_id,p_request_id,p_status,v_ref,auth.uid()) returning id into v_id;
 return v_id;
end $$;

-- Reconciliation is an UNSAVED comparison to a source-referenced operator figure.
-- It never imports bank data, settles liabilities or posts a GL adjustment.
create or replace function public.ywi_rpc_pms_gl_reconcile_448(
 p_company_id uuid,p_period_start date,p_account text,p_expected_net_debit_cents bigint,p_source_ref text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actual bigint;v_locked boolean;v_ref text:=btrim(coalesce(p_source_ref,''));
begin
 perform public.ywi_448_assert_gl_enabled(p_company_id);
 if p_period_start is null or extract(day from p_period_start)<>1 or
  p_account not in ('1000','1100','2000','2100','2200','4000','5000') or p_account is null or
  p_expected_net_debit_cents is null or abs(p_expected_net_debit_cents::numeric)>100000000000 or
  char_length(v_ref) not between 3 and 160 then raise exception '448 invalid reconciliation source/period';end if;
 if not exists(select 1 from public.ywi_pms_gl_periods_448 where company_id=p_company_id
  and period_start=p_period_start) then raise exception '448 unknown simulation period';end if;
 select locked into v_locked from public.ywi_pms_gl_periods_448
  where company_id=p_company_id and period_start=p_period_start;
 select coalesce(sum(case when l.side='debit' then l.amount_cents else -l.amount_cents end),0)::bigint
 into v_actual from public.ywi_pms_gl_lines_448 l join public.ywi_pms_gl_journals_448 j
  on j.company_id=l.company_id and j.id=l.journal_id
 where l.company_id=p_company_id and j.period_start=p_period_start and l.account_code=p_account;
 return jsonb_build_object('company_id',p_company_id,'period_start',p_period_start,
  'account',p_account,'period_locked',v_locked,'source_reference',v_ref,
  'reported_expected_net_debit_cents',p_expected_net_debit_cents,
  'simulated_actual_net_debit_cents',v_actual,
  'variance_cents',v_actual-p_expected_net_debit_cents,
  'matched',v_actual=p_expected_net_debit_cents,'test_mode',true,'reconciliation_saved',false,
  'bank_verified',false,'posting_available',false);
end $$;

revoke all on function public.ywi_448_assert_gl_owner(uuid) from public,anon,authenticated;
revoke all on function public.ywi_448_assert_gl_enabled(uuid) from public,anon,authenticated;
revoke all on function public.ywi_448_assert_balanced_journal() from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_snapshot_448(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_toggle_448(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_lock_448(uuid,date,boolean,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_append_448(uuid,uuid,date,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_review_448(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_gl_reconcile_448(uuid,date,text,bigint,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_gl_snapshot_448(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_gl_toggle_448(uuid,boolean,text) to authenticated;
grant execute on function public.ywi_rpc_pms_gl_lock_448(uuid,date,boolean,text) to authenticated;
grant execute on function public.ywi_rpc_pms_gl_append_448(uuid,uuid,date,text,text,jsonb,uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_gl_review_448(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_pms_gl_reconcile_448(uuid,date,text,bigint,text) to authenticated;
commit;
