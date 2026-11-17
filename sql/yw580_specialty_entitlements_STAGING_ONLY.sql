-- YW580: company-owned Ponds and Skateparks service entitlements.
-- SOURCE CANDIDATE ONLY: apply on independent isolated staging, verify RLS,
-- callbacks, backups and tests, then obtain owner/DBA approval BEFORE production.
-- Never auto-enable a service or authorize booking, payment or dispatch.
begin;
create table if not exists public.ywi_company_specialty_modules_580(
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 module_key text not null check (module_key in ('ponds','skateparks')),
 enabled boolean not null default false,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 updated_by uuid references auth.users(id) on delete set null,
 primary key(company_id,module_key)
);
alter table public.ywi_company_specialty_modules_580 enable row level security;
revoke all on table public.ywi_company_specialty_modules_580 from public,anon,authenticated;
grant select on table public.ywi_company_specialty_modules_580 to authenticated;
drop policy if exists ywi_580_specialty_owner_read on public.ywi_company_specialty_modules_580;
create policy ywi_580_specialty_owner_read
 on public.ywi_company_specialty_modules_580 for select to authenticated
 using(exists(select 1 from public.ywi_companies c
   where c.id=company_id and c.owner_user_id=(select auth.uid())));

create table if not exists public.ywi_580_specialty_audit(
 id bigint generated always as identity primary key,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 module_key text not null check (module_key in ('ponds','skateparks')),
 old_enabled boolean not null,
 new_enabled boolean not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 changed_at timestamptz not null default statement_timestamp(),
 foreign key(company_id,module_key) references public.ywi_company_specialty_modules_580(company_id,module_key)
);
alter table public.ywi_580_specialty_audit enable row level security;
revoke all on table public.ywi_580_specialty_audit from public,anon,authenticated;
revoke all on sequence public.ywi_580_specialty_audit_id_seq from public,anon,authenticated;
grant select on table public.ywi_580_specialty_audit to authenticated;
drop policy if exists ywi_580_specialty_audit_owner_read on public.ywi_580_specialty_audit;
create policy ywi_580_specialty_audit_owner_read on public.ywi_580_specialty_audit
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

-- Ensure every existing/new company starts with both specialty services OFF.
insert into public.ywi_company_specialty_modules_580(company_id,module_key,enabled)
 select c.id,v.module_key,false from public.ywi_companies c
 cross join (values('ponds'::text),('skateparks'::text)) v(module_key)
on conflict (company_id,module_key) do nothing;

create or replace function public.ywi_580_initialize_specialties()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ywi_company_specialty_modules_580(company_id,module_key,enabled)
 values (new.id,'ponds',false),(new.id,'skateparks',false)
 on conflict (company_id,module_key) do nothing;
 return new;
end $$;
revoke all on function public.ywi_580_initialize_specialties() from public,anon,authenticated;
drop trigger if exists ywi_580_company_specialties_default_off on public.ywi_companies;
create trigger ywi_580_company_specialties_default_off
 after insert on public.ywi_companies
 for each row execute function public.ywi_580_initialize_specialties();

-- Owner assertion uses original security-definer registry (not user_metadata).
create or replace function public.ywi_rpc_specialty_entitlements_580(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb; v_count integer;
begin
 if auth.uid() is null then raise exception '580 authenticated owner identity required'; end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*),coalesce(jsonb_agg(jsonb_build_object(
  'company_id',s.company_id,'module_key',s.module_key,'enabled',s.enabled)
  order by s.module_key),'[]'::jsonb)
 into v_count,v_rows from public.ywi_company_specialty_modules_580 s
 where s.company_id=p_company_id;
 if v_count<>2 then raise exception '580 specialty register incomplete'; end if;
 return jsonb_build_object('company_id',p_company_id,
  'captured_at',statement_timestamp(),'owner_guard','ywi_422_assert_owner',
  'privacy_minimized',true,'synthetic',false,'mutation_authorized',false,
  'services',v_rows,'new_work_authorized',false);
end $$;

-- Audited CAS toggle: an explicit real owner action is needed; no Sysop,
-- background automation or company-admin text field grants entitlement.
create or replace function public.ywi_rpc_specialty_update_580(
 p_company_id uuid,p_module_key text,p_expected boolean,p_enabled boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before boolean; v_actor uuid:=auth.uid();
begin
 if v_actor is null or p_company_id is null or p_module_key not in ('ponds','skateparks')
   or p_enabled is null or p_expected is null then
   raise exception '580 signed-in owner, scoped company and explicit boolean decision required';
 end if;
 perform public.ywi_422_assert_owner(p_company_id);
 select s.enabled into v_before from public.ywi_company_specialty_modules_580 s
 where s.company_id=p_company_id and s.module_key=p_module_key for update;
 if not found or v_before is distinct from p_expected then
   raise exception '580 stale/foreign/absent company service; reverify';
 end if;
 if v_before is distinct from p_enabled then
   update public.ywi_company_specialty_modules_580
    set enabled=p_enabled,updated_at=statement_timestamp(),updated_by=v_actor
    where company_id=p_company_id and module_key=p_module_key;
   insert into public.ywi_580_specialty_audit
    (company_id,module_key,old_enabled,new_enabled,actor_id)
    values(p_company_id,p_module_key,v_before,p_enabled,v_actor);
 end if;
 return jsonb_build_object('company_id',p_company_id,'module_key',p_module_key,
  'enabled',p_enabled,'audited',v_before is distinct from p_enabled,
  'new_work_authorized',false,'finance_authorized',false);
end $$;
revoke all on function public.ywi_rpc_specialty_entitlements_580(uuid)
 from public,anon,authenticated;
revoke all on function public.ywi_rpc_specialty_update_580(uuid,text,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_specialty_entitlements_580(uuid) to authenticated;
grant execute on function public.ywi_rpc_specialty_update_580(uuid,text,boolean,boolean) to authenticated;
comment on function public.ywi_rpc_specialty_entitlements_580(uuid) is
 'YW580 2-service owner-bound navigation only; no Jobs/Finance mutation';
comment on function public.ywi_rpc_specialty_update_580(uuid,text,boolean,boolean) is
 'YW580 explicit owner-controlled, audited Ponds/Skateparks entitlement toggle; no new-work authorization';
commit;
