-- Item 420: additive, owner-scoped SaaS company service registry.
-- No legacy CRM/Jobs/Finance/Safety table or permission is changed.
-- Deploy via reviewed Supabase migration; Item 421 must separately enforce new-work creation.
create table if not exists public.ywi_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ywi_companies_owner_name_unique
 on public.ywi_companies (owner_user_id, lower(btrim(name)));
create index if not exists ywi_companies_owner_user_idx
 on public.ywi_companies (owner_user_id);

create table if not exists public.ywi_company_service_modules (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  module_key text not null check (module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(company_id,module_key)
);

create table if not exists public.ywi_company_service_module_audit (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  module_key text not null check(module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')),
  action text not null check(action in ('initialized','enabled','disabled')),
  previous_enabled boolean,
  next_enabled boolean not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint ywi_audit_initial_state check (
    (action='initialized' and previous_enabled is null and next_enabled=false)
    or (action='enabled' and previous_enabled=false and next_enabled=true)
    or (action='disabled' and previous_enabled=true and next_enabled=false)
  )
);
create index if not exists ywi_company_service_module_audit_company_idx
 on public.ywi_company_service_module_audit (company_id,id desc);

-- No anonymous, public or default authenticated write authority.
alter table public.ywi_companies enable row level security;
alter table public.ywi_company_service_modules enable row level security;
alter table public.ywi_company_service_module_audit enable row level security;
revoke all on public.ywi_companies from public,anon,authenticated;
revoke all on public.ywi_company_service_modules from public,anon,authenticated;
revoke all on public.ywi_company_service_module_audit from public,anon,authenticated;
revoke all on sequence public.ywi_company_service_module_audit_id_seq from public,anon,authenticated;

grant select on public.ywi_companies to authenticated;
grant insert(name),update(name) on public.ywi_companies to authenticated;
grant select on public.ywi_company_service_modules to authenticated;
grant update(enabled) on public.ywi_company_service_modules to authenticated;
grant select on public.ywi_company_service_module_audit to authenticated;

drop policy if exists ywi_company_owner_read_420 on public.ywi_companies;
create policy ywi_company_owner_read_420 on public.ywi_companies
 for select to authenticated using (owner_user_id = (select auth.uid()));
drop policy if exists ywi_company_owner_create_420 on public.ywi_companies;
create policy ywi_company_owner_create_420 on public.ywi_companies
 for insert to authenticated with check (
   owner_user_id = (select auth.uid()) and (select auth.uid()) is not null
   and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 );
drop policy if exists ywi_company_owner_update_420 on public.ywi_companies;
create policy ywi_company_owner_update_420 on public.ywi_companies
 for update to authenticated
 using (owner_user_id = (select auth.uid()))
 with check (owner_user_id = (select auth.uid()));

drop policy if exists ywi_company_modules_owner_read_420 on public.ywi_company_service_modules;
create policy ywi_company_modules_owner_read_420 on public.ywi_company_service_modules
 for select to authenticated
 using (exists (select 1 from public.ywi_companies c
               where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_company_modules_owner_toggle_420 on public.ywi_company_service_modules;
create policy ywi_company_modules_owner_toggle_420 on public.ywi_company_service_modules
 for update to authenticated
 using (exists (select 1 from public.ywi_companies c
               where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check (exists (select 1 from public.ywi_companies c
               where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_company_audit_owner_read_420 on public.ywi_company_service_module_audit;
create policy ywi_company_audit_owner_read_420 on public.ywi_company_service_module_audit
 for select to authenticated
 using (exists (select 1 from public.ywi_companies c
               where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_company_registry_touch_420()
 returns trigger language plpgsql set search_path = '' as $$
 begin
   new.updated_at=now();
   return new;
 end;
 $$;
drop trigger if exists ywi_company_touch_420 on public.ywi_companies;
create trigger ywi_company_touch_420 before update on public.ywi_companies
 for each row execute function public.ywi_company_registry_touch_420();

create or replace function public.ywi_company_service_touch_420()
 returns trigger language plpgsql set search_path = '' as $$
 begin
   if old.company_id is distinct from new.company_id or old.module_key is distinct from new.module_key
      or old.created_at is distinct from new.created_at then
     raise exception 'Service registry ownership and identity are immutable';
   end if;
   if old.enabled is distinct from new.enabled then
     if (select auth.uid()) is null then
       raise exception 'Authenticated owner identity required for changes';
     end if;
     new.updated_at=now();
     new.updated_by=auth.uid();
   end if;
   return new;
 end;
 $$;
drop trigger if exists ywi_company_service_touch_420 on public.ywi_company_service_modules;
create trigger ywi_company_service_touch_420 before update on public.ywi_company_service_modules
 for each row execute function public.ywi_company_service_touch_420();

-- Trigger-owned audit writes are immutable to Data API users.
create or replace function public.ywi_company_service_audit_420()
 returns trigger language plpgsql security definer set search_path = '' as $$
 begin
   if tg_op='INSERT' then
     insert into public.ywi_company_service_module_audit
       (company_id,module_key,action,previous_enabled,next_enabled,actor_user_id)
     values (new.company_id,new.module_key,'initialized',null,false,(select auth.uid()));
   elsif old.enabled is distinct from new.enabled then
     insert into public.ywi_company_service_module_audit
       (company_id,module_key,action,previous_enabled,next_enabled,actor_user_id)
     values (new.company_id,new.module_key,
       case when new.enabled then 'enabled' else 'disabled' end,
       old.enabled,new.enabled,(select auth.uid()));
   end if;
   return null;
 end;
 $$;
drop trigger if exists ywi_company_service_audit_insert_420 on public.ywi_company_service_modules;
create trigger ywi_company_service_audit_insert_420
 after insert on public.ywi_company_service_modules
 for each row execute function public.ywi_company_service_audit_420();
drop trigger if exists ywi_company_service_audit_update_420 on public.ywi_company_service_modules;
create trigger ywi_company_service_audit_update_420
 after update of enabled on public.ywi_company_service_modules
 for each row when (old.enabled is distinct from new.enabled)
 execute function public.ywi_company_service_audit_420();

-- Every new company gets exactly six DISABLED offerings, never inferred from pricing.
create or replace function public.ywi_company_service_seed_420()
 returns trigger language plpgsql security definer set search_path = '' as $$
 begin
   insert into public.ywi_company_service_modules(company_id,module_key,enabled)
   select new.id,x,false from unnest(array[
    'landscape','construction','water_parks','snow_removal','snow_plowing','septic'
   ]::text[]) as x;
   return null;
 end;
 $$;
drop trigger if exists ywi_company_service_seed_420 on public.ywi_companies;
create trigger ywi_company_service_seed_420
 after insert on public.ywi_companies
 for each row execute function public.ywi_company_service_seed_420();

revoke all on function public.ywi_company_registry_touch_420() from public,anon,authenticated;
revoke all on function public.ywi_company_service_touch_420() from public,anon,authenticated;
revoke all on function public.ywi_company_service_audit_420() from public,anon,authenticated;
revoke all on function public.ywi_company_service_seed_420() from public,anon,authenticated;

comment on table public.ywi_companies is 'Item 420 owner-scoped registry identity; NOT a tenant partition of older CRM/Jobs records.';
comment on table public.ywi_company_service_modules is 'Item 420 audited offering switches; Item 421 must independently enforce new-work authorization.';
comment on table public.ywi_company_service_module_audit is 'Append-only audited owner toggles, no authenticated writes.';
