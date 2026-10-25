-- PMS 445: first-party, company-owned employee dossiers and append-only HR evidence.
-- These are operator-created HR records, NOT copied Supabase Auth identities or wages.
begin;
create table if not exists public.ywi_pms_hr_people_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 display_name text not null check(char_length(btrim(display_name)) between 2 and 120),
 job_title text not null check(char_length(btrim(job_title)) between 2 and 100),
 employment_status text not null check(employment_status in ('prospect','onboarding','active','leave','inactive')),
 start_date date,
 created_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,id),unique(company_id,request_id)
);
create index if not exists ywi_445_hr_people_company on public.ywi_pms_hr_people_445(company_id,created_at desc,id desc);

create table if not exists public.ywi_pms_hr_entries_445 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 employee_id uuid not null,
 request_id uuid not null,
 entry_kind text not null check(entry_kind in ('onboarding','certification','training','shift','leave','retention')),
 title text not null check(char_length(btrim(title)) between 2 and 120),
 notes text check(notes is null or char_length(notes)<=600),
 source_reference text check(source_reference is null or char_length(source_reference)<=200),
 reported_status text not null check(reported_status in ('planned','in_progress','completed','expired','approved','denied','review_due','on_hold')),
 effective_from date,
 effective_until date,
 created_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 unique(company_id,request_id),
 foreign key(company_id,employee_id) references public.ywi_pms_hr_people_445(company_id,id) on delete restrict,
 constraint ywi_445_hr_dates check(effective_until is null or (effective_from is not null and effective_until>=effective_from)),
 constraint ywi_445_hr_provenance check(reported_status not in ('approved','completed') or nullif(btrim(source_reference),'') is not null)
);
create index if not exists ywi_445_hr_timeline on public.ywi_pms_hr_entries_445(company_id,employee_id,created_at desc,id desc);

alter table public.ywi_pms_hr_people_445 enable row level security;
alter table public.ywi_pms_hr_entries_445 enable row level security;
revoke all on public.ywi_pms_hr_people_445 from public,anon,authenticated;
revoke all on public.ywi_pms_hr_entries_445 from public,anon,authenticated;
-- No direct table access, even for authenticated browsers. Owner RPCs enforce
-- the original 422 company ownership + independent Admin manage permission.

create or replace function public.ywi_445_assert_hr_owner(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_role text;v_access text;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=auth.uid() and is_active=true;
 select coalesce((select access_level from public.app_profile_module_permissions
    where profile_id=auth.uid() and module_key='admin'),
   (select access_level from public.app_role_module_permissions
    where role=v_role and module_key='admin')) into v_access;
 if v_role is null or v_access is distinct from 'manage' then
  raise exception '445 private company HR requires active Admin manage permission';
 end if;
end $$;

create or replace function public.ywi_rpc_pms_hr_snapshot_445(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_people jsonb;v_entries jsonb;v_count integer;v_event_count integer;
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 select count(*) into v_count from public.ywi_pms_hr_people_445 where company_id=p_company_id;
 select count(*) into v_event_count from public.ywi_pms_hr_entries_445 where company_id=p_company_id;
 if v_count>100 or v_event_count>200 then raise exception '445 HR bounded dossier exceeded';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into v_people from (select id,display_name,job_title,employment_status,start_date,created_at
  from public.ywi_pms_hr_people_445 where company_id=p_company_id
  order by created_at desc,id desc limit 100) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into v_entries from (select id,employee_id,entry_kind,title,notes,source_reference,
  reported_status,effective_from,effective_until,created_at
  from public.ywi_pms_hr_entries_445 where company_id=p_company_id
  order by created_at desc,id desc limit 200) t;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_445_assert_hr_owner','people',v_people,'entries',v_entries,
  'people_count',v_count,'entries_count',v_event_count,
  'wages_included',false,'payroll_authorized',false,'identity_cloned',false,
  'documents_uploaded',false,'automatic_record_purge',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_pms_hr_create_person_445(
 p_company_id uuid,p_request_id uuid,p_display_name text,p_job_title text,
 p_employment_status text,p_start_date date default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;
 v_name text:=btrim(coalesce(p_display_name,''));v_title text:=btrim(coalesce(p_job_title,''));
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 if p_request_id is null or char_length(v_name) not between 2 and 120 or
  char_length(v_title) not between 2 and 100 or p_employment_status not in
  ('prospect','onboarding','active','leave','inactive') or p_employment_status is null then
  raise exception '445 invalid company HR person request';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hr-people:'||p_company_id::text,445));
 select * into v_existing from public.ywi_pms_hr_people_445
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.display_name is distinct from v_name or v_existing.job_title is distinct from v_title or
    v_existing.employment_status is distinct from p_employment_status or
    v_existing.start_date is distinct from p_start_date then
   raise exception '445 HR request ID collision';end if;
  return v_existing.id;
 end if;
 if (select count(*) from public.ywi_pms_hr_people_445 where company_id=p_company_id)>=100 then
  raise exception '445 HR people cap requires pagination';end if;
 insert into public.ywi_pms_hr_people_445(company_id,request_id,display_name,job_title,
  employment_status,start_date,recorded_by)
 values(p_company_id,p_request_id,v_name,v_title,p_employment_status,p_start_date,auth.uid())
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.ywi_rpc_pms_hr_append_445(
 p_company_id uuid,p_employee_id uuid,p_request_id uuid,p_kind text,p_title text,
 p_status text,p_notes text default null,p_source_ref text default null,
 p_effective_from date default null,p_effective_until date default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_existing record;v_title text:=btrim(coalesce(p_title,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
 v_ref text:=nullif(btrim(coalesce(p_source_ref,'')),'');
begin
 perform public.ywi_445_assert_hr_owner(p_company_id);
 if p_request_id is null or p_employee_id is null or
  p_kind not in ('onboarding','certification','training','shift','leave','retention') or p_kind is null or
  p_status not in ('planned','in_progress','completed','expired','approved','denied','review_due','on_hold') or p_status is null or
  char_length(v_title) not between 2 and 120 or char_length(coalesce(v_notes,''))>600 or
  char_length(coalesce(v_ref,''))>200 or (p_status in ('approved','completed') and v_ref is null) or
  (p_effective_until is not null and (p_effective_from is null or p_effective_until<p_effective_from)) then
  raise exception '445 invalid HR evidence request';end if;
 if not exists(select 1 from public.ywi_pms_hr_people_445
  where company_id=p_company_id and id=p_employee_id) then
  raise exception '445 employee not owned by company';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hr-entries:'||p_company_id::text,445));
 select * into v_existing from public.ywi_pms_hr_entries_445
  where company_id=p_company_id and request_id=p_request_id;
 if found then
  if v_existing.employee_id is distinct from p_employee_id or v_existing.entry_kind is distinct from p_kind or
   v_existing.title is distinct from v_title or v_existing.reported_status is distinct from p_status or
   v_existing.notes is distinct from v_notes or v_existing.source_reference is distinct from v_ref or
   v_existing.effective_from is distinct from p_effective_from or
   v_existing.effective_until is distinct from p_effective_until then
    raise exception '445 HR event request ID collision';end if;
  return v_existing.id;
 end if;
 if (select count(*) from public.ywi_pms_hr_entries_445 where company_id=p_company_id)>=200 then
  raise exception '445 HR timeline requires pagination';end if;
 insert into public.ywi_pms_hr_entries_445(company_id,employee_id,request_id,entry_kind,title,
  notes,source_reference,reported_status,effective_from,effective_until,recorded_by)
 values(p_company_id,p_employee_id,p_request_id,p_kind,v_title,v_notes,v_ref,p_status,
  p_effective_from,p_effective_until,auth.uid()) returning id into v_id;
 return v_id;
end $$;

revoke all on function public.ywi_445_assert_hr_owner(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_hr_snapshot_445(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_hr_create_person_445(uuid,uuid,text,text,text,date) from public,anon,authenticated;
revoke all on function public.ywi_rpc_pms_hr_append_445(uuid,uuid,uuid,text,text,text,text,text,date,date) from public,anon,authenticated;
grant execute on function public.ywi_rpc_pms_hr_snapshot_445(uuid) to authenticated;
grant execute on function public.ywi_rpc_pms_hr_create_person_445(uuid,uuid,text,text,text,date) to authenticated;
grant execute on function public.ywi_rpc_pms_hr_append_445(uuid,uuid,uuid,text,text,text,text,text,date,date) to authenticated;
commit;
