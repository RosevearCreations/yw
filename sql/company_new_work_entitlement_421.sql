-- Item 421. New canonical estimate and work order INSERTs fail closed unless company/
-- service identity, owner identity and independent Jobs permissions all agree.
-- Existing historical rows retain their original identities and read/update rights.
-- DDL is additive. This is deliberately not a global numbered-schema rail.
alter table public.estimates add column if not exists company_id uuid;
alter table public.estimates add column if not exists service_module_key text;
alter table public.work_orders add column if not exists company_id uuid;
alter table public.work_orders add column if not exists service_module_key text;

alter table public.estimates drop constraint if exists ywi_421_estimate_company_service_pair;
alter table public.estimates add constraint ywi_421_estimate_company_service_pair
 check ((company_id is null and service_module_key is null)
     or (company_id is not null and service_module_key is not null));
alter table public.work_orders drop constraint if exists ywi_421_work_order_company_service_pair;
alter table public.work_orders add constraint ywi_421_work_order_company_service_pair
 check ((company_id is null and service_module_key is null)
     or (company_id is not null and service_module_key is not null));
alter table public.estimates drop constraint if exists ywi_421_estimate_registry_fkey;
alter table public.estimates add constraint ywi_421_estimate_registry_fkey
 foreign key (company_id,service_module_key)
 references public.ywi_company_service_modules(company_id,module_key) on delete restrict;
alter table public.work_orders drop constraint if exists ywi_421_work_order_registry_fkey;
alter table public.work_orders add constraint ywi_421_work_order_registry_fkey
 foreign key (company_id,service_module_key)
 references public.ywi_company_service_modules(company_id,module_key) on delete restrict;

create index if not exists ywi_421_estimate_company_idx on public.estimates(company_id,service_module_key);
create index if not exists ywi_421_work_order_company_idx on public.work_orders(company_id,service_module_key);

create table if not exists public.ywi_new_work_gate_receipts_421 (
 id bigint generated always as identity primary key,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 service_module_key text not null,
 target_table text not null check (target_table in ('estimates','work_orders')),
 target_id uuid not null,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 checked_at timestamptz not null default now(),
 unique(target_table,target_id),
 foreign key (company_id,service_module_key)
 references public.ywi_company_service_modules(company_id,module_key) on delete restrict
);
alter table public.ywi_new_work_gate_receipts_421 enable row level security;
revoke all on public.ywi_new_work_gate_receipts_421 from public,anon,authenticated;
revoke all on sequence public.ywi_new_work_gate_receipts_421_id_seq from public,anon,authenticated;
grant select on public.ywi_new_work_gate_receipts_421 to authenticated;
drop policy if exists ywi_421_owner_receipts on public.ywi_new_work_gate_receipts_421;
create policy ywi_421_owner_receipts on public.ywi_new_work_gate_receipts_421
 for select to authenticated using (exists (
 select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));

create or replace function public.ywi_421_assert_company_new_work(
 p_company_id uuid,p_module text,p_client uuid,p_site uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid();
        v_role text;
        v_level text;
begin
 if v_actor is null or p_company_id is null
    or p_module is null or p_module not in
       ('landscape','construction','water_parks','snow_removal','snow_plowing','septic') then
    raise exception '421 new work requires authenticated company and specialist service';
 end if;
 if p_client is not null or p_site is not null then
    raise exception '421 customer/site linking withheld until company-scoped CRM authority is verified';
 end if;
 select lower(p.role) into v_role from public.profiles p
 where p.id=v_actor and p.is_active is true;
 if v_role is null then
   raise exception '421 active employee identity required';
 end if;
 select coalesce(
   (select m.access_level from public.app_profile_module_permissions m
     where m.profile_id=v_actor and m.module_key='jobs'),
   (select m.access_level from public.app_role_module_permissions m
     where m.role=v_role and m.module_key='jobs')
 ) into v_level;
 if v_level not in ('create','approve','manage') or v_level is null then
   raise exception '421 Jobs create permission denied';
 end if;
 if not exists (
 select 1 from public.ywi_companies c
 join public.ywi_company_service_modules s on s.company_id=c.id
 where c.id=p_company_id and c.owner_user_id=v_actor
 and s.module_key=p_module and s.enabled is true
 ) then
    raise exception '421 company offering disabled, absent, or owned by another user';
 end if;
end $$;

create or replace function public.ywi_421_before_new_work()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_link uuid;
        v_company uuid;
        v_key text;
begin
 if tg_op='INSERT' then
   perform public.ywi_421_assert_company_new_work(
     new.company_id,new.service_module_key,new.client_id,new.client_site_id
   );
   if tg_table_name='work_orders' then
     v_link := (to_jsonb(new)->>'estimate_id')::uuid;
     if v_link is not null then
       select e.company_id,e.service_module_key into v_company,v_key
       from public.estimates e where e.id=v_link;
       if v_company is distinct from new.company_id
        or v_key is distinct from new.service_module_key then
         raise exception '421 work order and source estimate company/service mismatch';
       end if;
     end if;
   end if;
 elsif tg_op='UPDATE' then
   -- Existing rows are never retroactively gated, cancelled or automatically assigned.
   if old.company_id is distinct from new.company_id
    or old.service_module_key is distinct from new.service_module_key then
      raise exception '421 work company/service identity is immutable';
   end if;
   if old.company_id is not null then
     if old.client_id is distinct from new.client_id
      or old.client_site_id is distinct from new.client_site_id then
       raise exception '421 company customer/site linking requires separate authority';
     end if;
     if tg_table_name='work_orders' and
       (to_jsonb(old)->>'estimate_id') is distinct from
       (to_jsonb(new)->>'estimate_id') then
       raise exception '421 scoped source estimate cannot be reassigned';
     end if;
   end if;
 end if;
 return new;
end $$;

create or replace function public.ywi_421_receipt_new_work()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ywi_new_work_gate_receipts_421
 (company_id,service_module_key,target_table,target_id,actor_user_id)
 values(new.company_id,new.service_module_key,tg_table_name,new.id,auth.uid());
 return null;
end $$;

drop trigger if exists ywi_421_guard_estimate on public.estimates;
create trigger ywi_421_guard_estimate before insert or update on public.estimates
 for each row execute function public.ywi_421_before_new_work();
drop trigger if exists ywi_421_guard_work_order on public.work_orders;
create trigger ywi_421_guard_work_order before insert or update on public.work_orders
 for each row execute function public.ywi_421_before_new_work();
drop trigger if exists ywi_421_audit_estimate on public.estimates;
create trigger ywi_421_audit_estimate after insert on public.estimates
 for each row execute function public.ywi_421_receipt_new_work();
drop trigger if exists ywi_421_audit_work_order on public.work_orders;
create trigger ywi_421_audit_work_order after insert on public.work_orders
 for each row execute function public.ywi_421_receipt_new_work();

-- Authenticated owner-only drafts; no autonomous customer, billing, deposit or dispatch.
create or replace function public.ywi_rpc_create_scoped_estimate_421(
 p_company_id uuid,p_module_key text,p_title text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid := gen_random_uuid();
begin
 if char_length(btrim(coalesce(p_title,''))) not between 3 and 120 then
   raise exception '421 estimate title must be 3 to 120 characters';
 end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,p_module_key,null,null);
 insert into public.estimates
 (id,estimate_number,estimate_type,quote_title,company_id,service_module_key,status,created_by_profile_id)
 values (v_id,'YW-EST-421-'||replace(v_id::text,'-',''),p_module_key,btrim(p_title),
 p_company_id,p_module_key,'draft',auth.uid());
 return v_id;
end $$;

create or replace function public.ywi_rpc_create_scoped_work_order_421(
 p_company_id uuid,p_module_key text,p_title text,p_estimate_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid := gen_random_uuid();
begin
 if char_length(btrim(coalesce(p_title,''))) not between 3 and 120 then
    raise exception '421 work title must be 3 to 120 characters';
 end if;
 perform public.ywi_421_assert_company_new_work(p_company_id,p_module_key,null,null);
 insert into public.work_orders
 (id,work_order_number,work_type,internal_notes,estimate_id,
  company_id,service_module_key,status,created_by_profile_id)
 values (v_id,'YW-WO-421-'||replace(v_id::text,'-',''),p_module_key,btrim(p_title),
 p_estimate_id,p_company_id,p_module_key,'draft',auth.uid());
 return v_id;
end $$;

revoke all on function public.ywi_421_assert_company_new_work(uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ywi_421_before_new_work() from public,anon,authenticated;
revoke all on function public.ywi_421_receipt_new_work() from public,anon,authenticated;
revoke all on function public.ywi_rpc_create_scoped_estimate_421(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_create_scoped_work_order_421(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_create_scoped_estimate_421(uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_create_scoped_work_order_421(uuid,text,text,uuid) to authenticated;

comment on function public.ywi_rpc_create_scoped_estimate_421(uuid,text,text)
 is 'Fail closed owner+Jobs+enabled-service gate. Creates draft without customer association or finance/dispatch.';
comment on function public.ywi_rpc_create_scoped_work_order_421(uuid,text,text,uuid)
 is 'Fail closed owner+Jobs+enabled-service gate. Existing work remains unaffected, no finance/dispatch.';
