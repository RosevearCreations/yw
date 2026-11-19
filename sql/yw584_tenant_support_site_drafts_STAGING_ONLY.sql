-- YW584: STAGING-ONLY candidate. Never apply to existing production without
-- independent isolated staging migration, owner + DBA signoff and recovery test.
-- Original 420→421→422→443→451 service ownership and Jobs authority intact.
begin;
create table if not exists public.ywi_584_company_site_drafts (
 company_id uuid primary key references public.ywi_companies(id) on delete restrict,
 site_slug text not null check(site_slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
 display_name text not null check(char_length(btrim(display_name)) between 2 and 110),
 headline text not null check(char_length(btrim(headline)) between 8 and 180),
 public_description text not null check(char_length(public_description) between 20 and 1200),
 theme_name text not null default 'standard'
  check(theme_name in ('standard','futuristic','angular','forest','gilded')),
 publication_state text not null default 'draft' check(publication_state='draft'),
 last_edited_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 updated_at timestamptz not null default statement_timestamp()
);
alter table public.ywi_584_company_site_drafts enable row level security;
revoke all on public.ywi_584_company_site_drafts from public,anon,authenticated;
grant select,insert(company_id,site_slug,display_name,headline,public_description,theme_name),
 update(site_slug,display_name,headline,public_description,theme_name) on
 public.ywi_584_company_site_drafts to authenticated;
drop policy if exists ywi584_company_site_owner_select on public.ywi_584_company_site_drafts;
create policy ywi584_company_site_owner_select on public.ywi_584_company_site_drafts
 for select to authenticated using(exists(
 select 1 from public.ywi_companies c where c.id=company_id
 and c.owner_user_id=(select auth.uid()) and (select auth.uid()) is not null));
drop policy if exists ywi584_company_site_owner_insert on public.ywi_584_company_site_drafts;
create policy ywi584_company_site_owner_insert on public.ywi_584_company_site_drafts
 for insert to authenticated with check(last_edited_by=(select auth.uid()) and
 publication_state='draft' and exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi584_company_site_owner_update on public.ywi_584_company_site_drafts;
create policy ywi584_company_site_owner_update on public.ywi_584_company_site_drafts
 for update to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check(publication_state='draft' and exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create or replace function public.ywi_584_site_update_guard()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.company_id is distinct from new.company_id or
    old.publication_state is distinct from new.publication_state or
    old.last_edited_by is distinct from new.last_edited_by then
  raise exception 'YW584 site draft identity and publish status are immutable';
 end if;
 new.last_edited_by=(select auth.uid());
 new.updated_at=statement_timestamp();
 return new;
end $$;
revoke all on function public.ywi_584_site_update_guard() from public,anon,authenticated;
drop trigger if exists ywi584_site_update_guard on public.ywi_584_company_site_drafts;
create trigger ywi584_site_update_guard before update on public.ywi_584_company_site_drafts
 for each row execute function public.ywi_584_site_update_guard();

create table if not exists public.ywi_584_company_offering_drafts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 kind text not null check(kind in ('addon','rental','event')),
 title text not null check(char_length(btrim(title)) between 3 and 110),
 description text not null check(char_length(btrim(description)) between 8 and 800),
 begins_at timestamptz,ends_at timestamptz,
 state text not null default 'draft' check(state in ('draft','archived')),
 created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 constraint ywi_584_event_schedule_check check(
   (kind='event' and begins_at is not null and ends_at>begins_at)
   or (kind<>'event' and begins_at is null and ends_at is null)),
 unique(company_id,id)
);
create index if not exists ywi584_company_offering_recent
 on public.ywi_584_company_offering_drafts(company_id,created_at desc);
alter table public.ywi_584_company_offering_drafts enable row level security;
revoke all on public.ywi_584_company_offering_drafts from public,anon,authenticated;
grant select,insert(company_id,kind,title,description,begins_at,ends_at),
 update(title,description,begins_at,ends_at,state)
 on public.ywi_584_company_offering_drafts to authenticated;
drop policy if exists ywi584_offering_owner_select on public.ywi_584_company_offering_drafts;
create policy ywi584_offering_owner_select on public.ywi_584_company_offering_drafts
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi584_offering_owner_insert on public.ywi_584_company_offering_drafts;
create policy ywi584_offering_owner_insert on public.ywi_584_company_offering_drafts
 for insert to authenticated with check(created_by=(select auth.uid()) and
 state='draft' and exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi584_offering_owner_update on public.ywi_584_company_offering_drafts;
create policy ywi584_offering_owner_update on public.ywi_584_company_offering_drafts
 for update to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
create or replace function public.ywi_584_offering_guard()
 returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.id is distinct from new.id or old.company_id is distinct from new.company_id
    or old.kind is distinct from new.kind or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at or
    (old.state='archived' and new.state<>'archived') then
  raise exception 'YW584 offering identity or archived state immutable';
 end if;
 new.updated_at=statement_timestamp();
 return new;
end $$;
revoke all on function public.ywi_584_offering_guard() from public,anon,authenticated;
drop trigger if exists ywi584_offering_guard on public.ywi_584_company_offering_drafts;
create trigger ywi584_offering_guard before update on public.ywi_584_company_offering_drafts
 for each row execute function public.ywi_584_offering_guard();

create table if not exists public.ywi_584_company_support_cases (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 case_kind text not null check(case_kind in
  ('complaint','platform_lockout','performance','traffic','local_maintenance','other')),
 summary text not null check(char_length(btrim(summary)) between 5 and 160),
 detail text not null check(char_length(btrim(detail)) between 10 and 2000),
 priority text not null default 'normal' check(priority in ('normal','high')),
 status text not null default 'open' check(status='open'),
 opened_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default statement_timestamp(),
 unique(company_id,id)
);
create index if not exists ywi584_support_cases_recent
 on public.ywi_584_company_support_cases(company_id,created_at desc);
alter table public.ywi_584_company_support_cases enable row level security;
revoke all on public.ywi_584_company_support_cases from public,anon,authenticated;
grant select,insert(company_id,case_kind,summary,detail,priority)
 on public.ywi_584_company_support_cases to authenticated;
drop policy if exists ywi584_case_owner_select on public.ywi_584_company_support_cases;
create policy ywi584_case_owner_select on public.ywi_584_company_support_cases
 for select to authenticated using(exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi584_case_owner_insert on public.ywi_584_company_support_cases;
create policy ywi584_case_owner_insert on public.ywi_584_company_support_cases
 for insert to authenticated with check(opened_by=(select auth.uid()) and
 status='open' and exists(select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Platform Sysop receives COARSE, read-only aggregate support counts, never
-- another tenant's subject, details, personally identifying metadata or writes.
create or replace function public.ywi_584_platform_support_overview()
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer;v_high integer;v_lock integer;v_perf integer;
begin
 if (select auth.uid()) is null or
    not (select public.ywi_is_platform_administrator_489()) then
  raise exception 'YW584 verified platform Sysop membership required';
 end if;
 select count(*)::integer,
   count(*) filter(where priority='high')::integer,
   count(*) filter(where case_kind='platform_lockout')::integer,
   count(*) filter(where case_kind in ('performance','traffic'))::integer
 into v_total,v_high,v_lock,v_perf from public.ywi_584_company_support_cases;
 return jsonb_build_object(
  'scope','aggregate_only','total_cases',v_total,'high_priority',v_high,
  'lockout_cases',v_lock,'performance_or_traffic_cases',v_perf,
  'source','ywi_584_company_support_cases','private_case_details_exposed',false,
  'runtime_telemetry_verified',false,'sysop_action_authorized',false,
  'captured_at',statement_timestamp());
end $$;
revoke all on function public.ywi_584_platform_support_overview()
 from public,anon,authenticated;
grant execute on function public.ywi_584_platform_support_overview() to authenticated;

comment on table public.ywi_584_company_site_drafts is
 'YW584 private company-owned site drafts. No public route or publication authority.';
comment on table public.ywi_584_company_offering_drafts is
 'YW584 private draft rental/event/add-on catalog; does not modify Jobs/Finance or publish products.';
comment on table public.ywi_584_company_support_cases is
 'YW584 immutable company complaint/support intake; external ticket triage and response authority not yet connected.';
commit;
