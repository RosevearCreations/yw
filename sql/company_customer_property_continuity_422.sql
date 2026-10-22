-- Item 422: company-owned links to the ORIGINAL CRM customer/property records.
-- Never auto-claim historical unscoped customers or infer ownership by name/address.
-- Apply after Items 420 and 421. Additive; not a numbered global schema migration.

create table if not exists public.ywi_company_client_links_422 (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  client_id uuid not null unique references public.clients(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (company_id,client_id)
);
create table if not exists public.ywi_company_site_links_422 (
  company_id uuid not null,
  client_id uuid not null,
  client_site_id uuid not null unique references public.client_sites(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (company_id,client_id,client_site_id),
  foreign key (company_id,client_id)
    references public.ywi_company_client_links_422(company_id,client_id) on delete restrict
);
create index if not exists ywi_422_site_company_idx
  on public.ywi_company_site_links_422(company_id,client_site_id);

alter table public.ywi_company_client_links_422 enable row level security;
alter table public.ywi_company_site_links_422 enable row level security;
revoke all on public.ywi_company_client_links_422 from public,anon,authenticated;
revoke all on public.ywi_company_site_links_422 from public,anon,authenticated;
-- Only RPCs may create ownership proofs. The read grant does not confer legacy CRM access.
grant select on public.ywi_company_client_links_422 to authenticated;
grant select on public.ywi_company_site_links_422 to authenticated;
drop policy if exists ywi_422_owner_client_read on public.ywi_company_client_links_422;
create policy ywi_422_owner_client_read on public.ywi_company_client_links_422
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));
drop policy if exists ywi_422_owner_site_read on public.ywi_company_site_links_422;
create policy ywi_422_owner_site_read on public.ywi_company_site_links_422
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));

create or replace function public.ywi_422_assert_owner(p_company_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_role text; v_level text;
begin
 if v_actor is null or p_company_id is null or
    not exists (select 1 from public.ywi_companies
                where id=p_company_id and owner_user_id=v_actor) then
   raise exception '422 authenticated company owner required';
 end if;
 select lower(role) into v_role from public.profiles
 where id=v_actor and is_active is true;
 if v_role is null then raise exception '422 active profile required'; end if;
 select coalesce(
  (select access_level from public.app_profile_module_permissions
   where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
   where role=v_role and module_key='jobs')) into v_level;
 if v_level not in ('view','create','approve','manage') or v_level is null then
   raise exception '422 Jobs read permission denied';
 end if;
end $$;

create or replace function public.ywi_422_assert_link(
 p_company_id uuid,p_client_id uuid,p_site_id uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_client_id is null or p_site_id is null then
   raise exception '422 both verified customer and property are required';
 end if;
 if not exists (
  select 1 from public.ywi_company_client_links_422 l
  join public.clients c on c.id=l.client_id and c.is_active is true
  join public.ywi_company_site_links_422 s
    on s.company_id=l.company_id and s.client_id=l.client_id and s.client_site_id=p_site_id
  join public.client_sites cs on cs.id=s.client_site_id
    and cs.client_id=l.client_id and cs.is_active is true
  where l.company_id=p_company_id and l.client_id=p_client_id
 ) then raise exception '422 customer/property not linked to this company'; end if;
end $$;

create or replace function public.ywi_422_assert_jobs_create()
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_role text; v_level text;
begin
 select lower(role) into v_role from public.profiles
 where id=v_actor and is_active is true;
 select coalesce(
  (select access_level from public.app_profile_module_permissions
   where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
   where role=v_role and module_key='jobs')) into v_level;
 if v_actor is null or v_level not in ('create','approve','manage') or v_level is null then
   raise exception '422 Jobs create permission required for canonical CRM writes';
 end if;
end $$;

-- Protection against changing the original site's customer after the link was recorded.
create or replace function public.ywi_422_protect_site_parent()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.client_id is distinct from new.client_id and exists
    (select 1 from public.ywi_company_site_links_422 where client_site_id=old.id) then
   raise exception '422 linked canonical property customer cannot be reassigned';
 end if;
 return new;
end $$;
drop trigger if exists ywi_422_site_parent_guard on public.client_sites;
create trigger ywi_422_site_parent_guard before update of client_id on public.client_sites
 for each row execute function public.ywi_422_protect_site_parent();

-- Preserve Item 421 owner/service/Jobs checks, but allow *verified* paired links.
create or replace function public.ywi_421_assert_company_new_work(
 p_company_id uuid,p_module text,p_client uuid,p_site uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_role text; v_level text;
begin
 if v_actor is null or p_company_id is null or p_module not in
   ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
   or p_module is null then
   raise exception '421 authenticated company and specialist service required';
 end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 if v_role is null then raise exception '421 active employee identity required'; end if;
 select coalesce(
  (select access_level from public.app_profile_module_permissions
    where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions
    where role=v_role and module_key='jobs')) into v_level;
 if v_level not in ('create','approve','manage') or v_level is null then
   raise exception '421 Jobs create permission denied';
 end if;
 if not exists (
   select 1 from public.ywi_companies c
   join public.ywi_company_service_modules s on s.company_id=c.id
   where c.id=p_company_id and c.owner_user_id=v_actor
   and s.module_key=p_module and s.enabled is true
 ) then raise exception '421 company service disabled or owner mismatch'; end if;
 if p_client is distinct from null or p_site is distinct from null then
   perform public.ywi_422_assert_link(p_company_id,p_client,p_site);
 end if;
end $$;

create or replace function public.ywi_421_before_new_work()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_key text; v_client uuid; v_site uuid;
begin
 if tg_op='INSERT' then
  perform public.ywi_421_assert_company_new_work(
   new.company_id,new.service_module_key,new.client_id,new.client_site_id);
 elsif old.company_id is distinct from new.company_id
    or old.service_module_key is distinct from new.service_module_key then
  raise exception '421 company/service immutable';
 elsif old.company_id is not null and
   (old.client_id is distinct from new.client_id or
    old.client_site_id is distinct from new.client_site_id) then
  if old.client_id is not null or old.client_site_id is not null or
     old.status <> 'draft' or new.status <> 'draft' then
    raise exception '422 cannot reassign or unlink customer/property';
  end if;
  perform public.ywi_421_assert_company_new_work(
    new.company_id,new.service_module_key,new.client_id,new.client_site_id);
 end if;
 if tg_table_name='work_orders' then
  if tg_op='UPDATE' and old.company_id is not null and
    (to_jsonb(old)->>'estimate_id') is distinct from
    (to_jsonb(new)->>'estimate_id') then
   raise exception '421 scoped source estimate cannot be reassigned';
  end if;
  if (to_jsonb(new)->>'estimate_id') is not null then
   select e.company_id,e.service_module_key,e.client_id,e.client_site_id
     into v_company,v_key,v_client,v_site from public.estimates e
     where e.id=(to_jsonb(new)->>'estimate_id')::uuid;
   if v_company is distinct from new.company_id or
      v_key is distinct from new.service_module_key or
      v_client is distinct from new.client_id or
      v_site is distinct from new.client_site_id then
    raise exception '422 work order/source estimate company/service/customer/site mismatch';
   end if;
  end if;
 end if;
 return new;
end $$;

-- New scoped records use the original CRM tables. Ownership is recorded in the same transaction.
create or replace function public.ywi_rpc_create_customer_422(
 p_company_id uuid,p_legal_name text,p_email text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid := gen_random_uuid();
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if char_length(btrim(coalesce(p_legal_name,''))) not between 2 and 120 or
    char_length(coalesce(p_email,''))>254 then
  raise exception '422 invalid customer name/email';
 end if;
 insert into public.clients(id,legal_name,billing_email)
 values(v_id,btrim(p_legal_name),nullif(btrim(p_email),''));
 insert into public.ywi_company_client_links_422(company_id,client_id,created_by)
 values(p_company_id,v_id,auth.uid());
 return v_id;
end $$;

create or replace function public.ywi_rpc_create_property_422(
 p_company_id uuid,p_client_id uuid,p_name text,p_address text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid := gen_random_uuid();
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if not exists (select 1 from public.ywi_company_client_links_422 l
   join public.clients c on c.id=l.client_id and c.is_active is true
   where l.company_id=p_company_id and l.client_id=p_client_id) then
   raise exception '422 customer not owned by this company';
 end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 120 or
    char_length(coalesce(p_address,''))>400 then
   raise exception '422 invalid property name/address';
 end if;
 insert into public.client_sites(id,client_id,site_name,service_address)
 values(v_id,p_client_id,btrim(p_name),nullif(btrim(p_address),''));
 insert into public.ywi_company_site_links_422
 (company_id,client_id,client_site_id,created_by)
 values(p_company_id,p_client_id,v_id,auth.uid());
 return v_id;
end $$;

create or replace function public.ywi_rpc_company_customers_422(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_data jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) into v_data
 from (select c.id,c.legal_name as name, c.is_active
  from public.ywi_company_client_links_422 l
  join public.clients c on c.id=l.client_id
  where l.company_id=p_company_id
  order by c.legal_name,c.id limit 101) t;
 return v_data;
end $$;

create or replace function public.ywi_rpc_attach_draft_customer_422(
 p_company_id uuid,p_kind text,p_target_id uuid,p_client_id uuid,p_site_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_row record;
begin
 if p_kind not in ('estimate','work_order') or p_target_id is null then
   raise exception '422 target must be an existing draft';
 end if;
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 if p_kind='estimate' then
  select id,company_id,service_module_key,status,client_id,client_site_id
    into v_row from public.estimates where id=p_target_id for update;
 else
  select id,company_id,service_module_key,status,client_id,client_site_id
    into v_row from public.work_orders where id=p_target_id for update;
 end if;
 if not found or v_row.company_id is distinct from p_company_id
   or v_row.status <> 'draft' or v_row.client_id is not null
   or v_row.client_site_id is not null then
   raise exception '422 target not an unlinked draft in this company';
 end if;
 perform public.ywi_421_assert_company_new_work(
  p_company_id,v_row.service_module_key,p_client_id,p_site_id);
 if p_kind='estimate' then
  update public.estimates set client_id=p_client_id,client_site_id=p_site_id
   where id=p_target_id;
 else
  update public.work_orders set client_id=p_client_id,client_site_id=p_site_id
   where id=p_target_id;
 end if;
 return p_target_id;
end $$;

-- Read-only owner-only per-customer service timeline; disabled services remain visible.
create or replace function public.ywi_rpc_customer_history_422(
 p_company_id uuid,p_client_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_client record; v_sites jsonb; v_estimates jsonb; v_work jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select c.id,c.legal_name,c.billing_email into v_client
 from public.ywi_company_client_links_422 l
 join public.clients c on c.id=l.client_id
 where l.company_id=p_company_id and l.client_id=p_client_id;
 if not found then raise exception '422 customer not owned by this company'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',cs.id,'name',cs.site_name,
   'address',cs.service_address) order by cs.site_name), '[]'::jsonb) into v_sites
 from public.ywi_company_site_links_422 l
 join public.client_sites cs on cs.id=l.client_site_id and cs.client_id=l.client_id
 where l.company_id=p_company_id and l.client_id=p_client_id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb) into v_estimates
 from (select e.id,e.estimate_number as number,e.service_module_key as service,
  e.status,e.client_site_id as property_id,e.created_at
  from public.estimates e
  where e.company_id=p_company_id and e.client_id=p_client_id
    and exists(select 1 from public.ywi_company_site_links_422 s
      where s.company_id=p_company_id and s.client_id=p_client_id
        and s.client_site_id=e.client_site_id)
  order by e.created_at desc,e.id desc limit 80) t;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb) into v_work
 from (select w.id,w.work_order_number as number,w.service_module_key as service,
  w.status,w.client_site_id as property_id,w.created_at
  from public.work_orders w
  where w.company_id=p_company_id and w.client_id=p_client_id
    and exists(select 1 from public.ywi_company_site_links_422 s
      where s.company_id=p_company_id and s.client_id=p_client_id
        and s.client_site_id=w.client_site_id)
  order by w.created_at desc,w.id desc limit 80) t;
 return jsonb_build_object('company_id',p_company_id,'client_id',v_client.id,
  'customer_name',v_client.legal_name,'properties',v_sites,
  'estimates',v_estimates,'work_orders',v_work,
  'history_limit_per_type',80,'legacy_unscoped_excluded',true);
end $$;

revoke all on function public.ywi_422_assert_owner(uuid) from public,anon,authenticated;
revoke all on function public.ywi_422_assert_link(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_422_assert_jobs_create() from public,anon,authenticated;
revoke all on function public.ywi_422_protect_site_parent() from public,anon,authenticated;
revoke all on function public.ywi_rpc_create_customer_422(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_create_property_422(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_attach_draft_customer_422(uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_customer_history_422(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_company_customers_422(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_create_customer_422(uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_create_property_422(uuid,uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_attach_draft_customer_422(uuid,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.ywi_rpc_customer_history_422(uuid,uuid) to authenticated;
grant execute on function public.ywi_rpc_company_customers_422(uuid) to authenticated;

comment on table public.ywi_company_client_links_422 is
 'Owner-verified company link to canonical clients; no automatic legacy customer claim.';
comment on table public.ywi_company_site_links_422 is
 'Owner-verified company link to canonical client_sites; no duplicate property authority.';
