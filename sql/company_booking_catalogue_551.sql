-- YW 551: additive company-owned landscaping service, add-on and disposal fee catalogue.
-- Apply as an independently reviewed migration after company_service_offering_registry_420.sql.
-- This is pricing configuration, not authorization to book, charge or certify disposal.
create table if not exists public.ywi_company_booking_catalogue_551 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  item_type text not null check (item_type in ('service','addon','disposal')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  unit text not null check (unit in ('visit','hour','square_metre','cubic_yard','bag','load','item')),
  base_price_cents integer not null check (base_price_cents between 0 and 100000000),
  spring_price_cents integer check (spring_price_cents between 0 and 100000000),
  summer_price_cents integer check (summer_price_cents between 0 and 100000000),
  fall_price_cents integer check (fall_price_cents between 0 and 100000000),
  winter_price_cents integer check (winter_price_cents between 0 and 100000000),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique(company_id,code)
);
create index if not exists ywi_booking_catalogue_551_company_idx
 on public.ywi_company_booking_catalogue_551(company_id,active,item_type,name);

create table if not exists public.ywi_company_booking_catalogue_audit_551 (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  catalogue_id uuid not null references public.ywi_company_booking_catalogue_551(id) on delete restrict,
  action text not null check(action in ('created','updated')),
  actor_user_id uuid references auth.users(id) on delete set null,
  before_state jsonb,
  after_state jsonb not null,
  recorded_at timestamptz not null default now()
);
create index if not exists ywi_booking_catalogue_audit_551_company_idx
 on public.ywi_company_booking_catalogue_audit_551(company_id,id desc);

alter table public.ywi_company_booking_catalogue_551 enable row level security;
alter table public.ywi_company_booking_catalogue_audit_551 enable row level security;
revoke all on public.ywi_company_booking_catalogue_551 from public, anon, authenticated;
revoke all on public.ywi_company_booking_catalogue_audit_551 from public, anon, authenticated;
revoke all on sequence public.ywi_company_booking_catalogue_audit_551_id_seq from public, anon, authenticated;
grant select on public.ywi_company_booking_catalogue_551 to authenticated;
grant insert(company_id,code,item_type,name,description,unit,base_price_cents,
 spring_price_cents,summer_price_cents,fall_price_cents,winter_price_cents,active)
 on public.ywi_company_booking_catalogue_551 to authenticated;
grant update(name,description,unit,base_price_cents,
 spring_price_cents,summer_price_cents,fall_price_cents,winter_price_cents,active)
 on public.ywi_company_booking_catalogue_551 to authenticated;
grant select on public.ywi_company_booking_catalogue_audit_551 to authenticated;

drop policy if exists ywi_booking_catalogue_owner_read_551 on public.ywi_company_booking_catalogue_551;
create policy ywi_booking_catalogue_owner_read_551 on public.ywi_company_booking_catalogue_551
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));
drop policy if exists ywi_booking_catalogue_owner_create_551 on public.ywi_company_booking_catalogue_551;
create policy ywi_booking_catalogue_owner_create_551 on public.ywi_company_booking_catalogue_551
 for insert to authenticated with check (
  (select auth.uid()) is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid()))
 );
drop policy if exists ywi_booking_catalogue_owner_update_551 on public.ywi_company_booking_catalogue_551;
create policy ywi_booking_catalogue_owner_update_551 on public.ywi_company_booking_catalogue_551
 for update to authenticated
 using (exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check (exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_booking_catalogue_audit_owner_read_551 on public.ywi_company_booking_catalogue_audit_551;
create policy ywi_booking_catalogue_audit_owner_read_551 on public.ywi_company_booking_catalogue_audit_551
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));

create or replace function public.ywi_booking_catalogue_touch_551()
 returns trigger language plpgsql set search_path='' as $$
 begin
  if tg_op='UPDATE' and (old.id is distinct from new.id or old.company_id is distinct from new.company_id
    or old.code is distinct from new.code or old.item_type is distinct from new.item_type
    or old.created_at is distinct from new.created_at) then
   raise exception 'Catalogue company and item identity are immutable';
  end if;
  if (select auth.uid()) is null then raise exception 'Owner authentication required'; end if;
  new.updated_at=now();
  new.updated_by=(select auth.uid());
  return new;
 end;
 $$;
drop trigger if exists ywi_booking_catalogue_touch_551 on public.ywi_company_booking_catalogue_551;
create trigger ywi_booking_catalogue_touch_551
 before insert or update on public.ywi_company_booking_catalogue_551
 for each row execute function public.ywi_booking_catalogue_touch_551();

create or replace function public.ywi_booking_catalogue_audit_write_551()
 returns trigger language plpgsql security definer set search_path='' as $$
 begin
  insert into public.ywi_company_booking_catalogue_audit_551
  (company_id,catalogue_id,action,actor_user_id,before_state,after_state)
  values(new.company_id,new.id,case when tg_op='INSERT' then 'created' else 'updated' end,
    (select auth.uid()),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  return null;
 end;
 $$;
drop trigger if exists ywi_booking_catalogue_audit_551 on public.ywi_company_booking_catalogue_551;
create trigger ywi_booking_catalogue_audit_551
 after insert or update on public.ywi_company_booking_catalogue_551
 for each row execute function public.ywi_booking_catalogue_audit_write_551();
revoke all on function public.ywi_booking_catalogue_touch_551() from public,anon,authenticated;
revoke all on function public.ywi_booking_catalogue_audit_write_551() from public,anon,authenticated;

comment on table public.ywi_company_booking_catalogue_551 is
 'YW551: authenticated company-owner pricing drafts; disposal fees are estimates, never disposal receipts. No booking or payment writes.';
