-- PMS 446: confidential payroll-readiness evidence, not a pay run or tax calculation.
-- Company-owned, append-only, operator-reported time/rates/corrections only.
begin;
create table if not exists public.ywi_pms_payroll_config_446 (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict
);
create table if not exists public.ywi_pms_payroll_audit_446 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 previous_enabled boolean not null,new_enabled boolean not null,
 changed_at timestamptz not null default now(),
 actor_id uuid not null references auth.users(id) on delete restrict
);
create index if not exists ywi_446_payroll_audit_company on public.ywi_pms_payroll_audit_446(company_id,changed_at desc);
create table if not exists public.ywi_pms_payroll_lines_446 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 employee_id uuid not null,
 request_id uuid not null,
 pay_period_start date not null,
 pay_period_end date not null,
 reported_minutes integer not null check(reported_minutes between 0 and 60000),
 rate_cents integer not null check(rate_cents between 0 and 1000000),
 reported_deductions_cents integer not null check(reported_deductions_cents between 0 and 100000000),
 planned_benefits_cents integer not null check(planned_benefits_cents between 0 and 100000000),
 planned_vacation_cents integer not null check(planned_vacation_cents between 0 and 100000000),
 time_approval_source_ref text not null check(char_length(btrim(time_approval_source_ref)) between 3 and 160),
 reported_status text not null check(reported_status in ('draft','reviewed_for_planning','disputed')),
 correction_of uuid,
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,employee_id) references public.ywi_pms_hr_people_445(company_id,id) on delete restrict,
 foreign key(company_id,correction_of) references public.ywi_pms_payroll_lines_446(company_id,id) on delete restrict,
 constraint ywi_446_period_check check(pay_period_end>=pay_period_start and pay_period_end<=pay_period_start+31)
);
create index if not exists ywi_446_payroll_timeline on public.ywi_pms_payroll_lines_446(company_id,employee_id,pay_period_end desc,id desc);
create unique index if not exists ywi_446_one_correction_successor
 on public.ywi_pms_payroll_lines_446(company_id,correction_of) where correction_of is not null;

alter table public.ywi_pms_payroll_config_446 enable row level security;
alter table public.ywi_pms_payroll_audit_446 enable row level security;
alter table public.ywi_pms_payroll_lines_446 enable row level security;
revoke all on public.ywi_pms_payroll_config_446 from public,anon,authenticated;
revoke all on public.ywi_pms_payroll_audit_446 from public,anon,authenticated;
revoke all on public.ywi_pms_payroll_lines_446 from public,anon,authenticated;

create or replace function public.ywi_446_assert_payroll_owner(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_role text;v_level text;
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=auth.uid() and is_active=true;
 select coalesce((select access_level from public.app_profile_module_permissions
   where profile_id=auth.uid() and module_key='finance'),
   (select access_level from public.app_role_module_permissions
   where role=v_role and module_key='finance')) into v_level;
 if v_role is null or v_level is distinct from 'manage' then
  raise exception '446 active owner, Admin manage and separate Finance manage required';end if;
end $$;

create or replace function public.ywi_446_payroll_effective_enabled(p_company_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 perform public.ywi_446_assert_payroll_owner(p_company_id);
 return exists(select 1 from public.ywi_pms_payroll_config_446
  where company_id=p_company_id and enabled=true);
end $$;

create or replace function public.ywi_rpc_pms_payroll_snapshot_446(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_enabled boolean;v_effective boolean;v_items jsonb;v_count integer;
begin
 perform public.ywi_446_assert_payroll_owner(p_company_id);
 select exists(select 1 from public.ywi_pms_payroll_config_446
  where company_id=p_company_id and enabled=true) into v_enabled;
 select public.ywi_446_payroll_effective_enabled(p_company_id) into v_effective;
 if not v_effective then
  return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
   'owner_guard','ywi_446_assert_payroll_owner','enabled',v_enabled,'effective',false,
   'lines','[]'::jsonb,'line_count',0,'rates_exposed',false,'payroll_executed',false,
   'direct_deposit_available',false,'tax_filing_available',false,'mutation_authorized',false);
 end if;
 select count(*) into v_count from public.ywi_pms_payroll_lines_446 where company_id=p_company_id;
 if v_count>200 then raise exception '446 payroll planning cap exceeded';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb) into v_items
 from (select id,employee_id,pay_period_start,pay_period_end,reported_minutes,rate_cents,
   reported_deductions_cents,planned_benefits_cents,planned_vacation_cents,
   round(reported_minutes::numeric*rate_cents::numeric/60)::bigint as gross_projection_cents,
   time_approval_source_ref,reported_status,correction_of,notes,created_at
  from public.ywi_pms_payroll_lines_446 where company_id=p_company_id
  order by created_at desc,id desc limit 200) t;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_446_assert_payroll_owner','enabled',true,'effective',true,
  'lines',v_items,'line_count',v_count,'rates_exposed',true,
  'payroll_executed',false,'direct_deposit_available',false,
  'tax_filing_available',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_payroll_switch_446(p_company_id uuid,p_enabled boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_old boolean;
begin
 perform public.ywi_446_assert_payroll_owner(p_company_id);
 if p_enabled is null then raise exception '446 explicit payroll switch required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll-switch:'||p_company_id::text,446));
 select exists(select 1 from public.ywi_pms_payroll_config_446
  where company_id=p_company_id and enabled=true) into v_old;
 if v_old is distinct from p_enabled then
  insert into public.ywi_pms_payroll_config_446(company_id,enabled,updated_by)
  values(p_company_id,p_enabled,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,
   updated_at=now(),updated_by=excluded.updated_by;
  insert into public.ywi_pms_payroll_audit_446(company_id,previous_enabled,new_enabled,actor_id)
  values(p_company_id,v_old,p_enabled,auth.uid());
 end if;
 return jsonb_build_object('company_id',p_company_id,'enabled',p_enabled,
  'effective',public.ywi_446_payroll_effective_enabled(p_company_id),
  'payroll_executed',false,'bank_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_payroll_append_446(
 p_company_id uuid,p_employee_id uuid,p_request_id uuid,p_start date,p_end date,
 p_minutes integer,p_rate_cents integer,p_deductions_cents integer,
 p_benefits_cents integer,p_vacation_cents integer,p_source_ref text,
 p_status text,p_correction_of uuid default null,p_notes text default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;v_prior record;
 v_ref text:=btrim(coalesce(p_source_ref,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_446_assert_payroll_owner(p_company_id);
 if not public.ywi_446_payroll_effective_enabled(p_company_id) then
  raise exception '446 payroll or its parent Accounting switch OFF';end if;
 if p_request_id is null or p_employee_id is null or p_start is null or p_end is null or
  p_end<p_start or p_end>p_start+31 or p_minutes not between 0 and 60000 or
  p_rate_cents not between 0 and 1000000 or
  p_deductions_cents not between 0 and 100000000 or
  p_benefits_cents not between 0 and 100000000 or
  p_vacation_cents not between 0 and 100000000 or
  p_minutes is null or p_rate_cents is null or p_deductions_cents is null or
  p_benefits_cents is null or p_vacation_cents is null or
  char_length(v_ref) not between 3 and 160 or
  p_status not in ('draft','reviewed_for_planning','disputed') or p_status is null or
  char_length(coalesce(v_notes,''))>500 then
  raise exception '446 invalid confidential payroll planning request';end if;
 if not exists(select 1 from public.ywi_pms_hr_people_445
  where company_id=p_company_id and id=p_employee_id) then
  raise exception '446 company HR employee not verified';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll-line:'||p_company_id::text,446));
 select * into v_existing from public.ywi_pms_payroll_lines_446
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.employee_id is distinct from p_employee_id or
   v_existing.pay_period_start is distinct from p_start or v_existing.pay_period_end is distinct from p_end or
   v_existing.reported_minutes is distinct from p_minutes or v_existing.rate_cents is distinct from p_rate_cents or
   v_existing.reported_deductions_cents is distinct from p_deductions_cents or
   v_existing.planned_benefits_cents is distinct from p_benefits_cents or
   v_existing.planned_vacation_cents is distinct from p_vacation_cents or
   v_existing.time_approval_source_ref is distinct from v_ref or
   v_existing.reported_status is distinct from p_status or
   v_existing.correction_of is distinct from p_correction_of or
   v_existing.notes is distinct from v_notes then
   raise exception '446 payroll retry collision';end if;
  return v_existing.id;
 end if;
 if p_correction_of is not null then
  select * into v_prior from public.ywi_pms_payroll_lines_446
   where company_id=p_company_id and id=p_correction_of;
  if not found or v_prior.employee_id<>p_employee_id or
    v_prior.pay_period_start<>p_start or v_prior.pay_period_end<>p_end or
    exists(select 1 from public.ywi_pms_payroll_lines_446
      where company_id=p_company_id and correction_of=p_correction_of) then
   raise exception '446 correction must cite unmatched prior company/period line';end if;
 end if;
 if (select count(*) from public.ywi_pms_payroll_lines_446 where company_id=p_company_id)>=200 then
  raise exception '446 payroll planning cap reached';end if;
 insert into public.ywi_pms_payroll_lines_446(company_id,employee_id,request_id,
  pay_period_start,pay_period_end,reported_minutes,rate_cents,
  reported_deductions_cents,planned_benefits_cents,planned_vacation_cents,
  time_approval_source_ref,reported_status,correction_of,notes,created_by)
 values(p_company_id,p_employee_id,p_request_id,p_start,p_end,p_minutes,p_rate_cents,
  p_deductions_cents,p_benefits_cents,p_vacation_cents,v_ref,p_status,p_correction_of,v_notes,auth.uid())
 returning id into v_id;
 return v_id;
end $$;

revoke all on function public.ywi_446_assert_payroll_owner(uuid) from public,anon,authenticated;
revoke all on function public.ywi_446_payroll_effective_enabled(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_payroll_snapshot_446(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_payroll_switch_446(uuid,boolean) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_payroll_append_446(uuid,uuid,uuid,date,date,integer,integer,integer,integer,integer,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_payroll_snapshot_446(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_payroll_switch_446(uuid,boolean) to authenticated;
grant execute on function public.ywi_rpc_pms_payroll_append_446(uuid,uuid,uuid,date,date,integer,integer,integer,integer,integer,text,text,uuid,text) to authenticated;
commit;
