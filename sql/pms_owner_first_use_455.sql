-- YW Item 455: private, append-only first-owner source intake. Evidence is an
-- operator report, NEVER approval of safety, invoicing, production or field use.
begin;
create table if not exists public.ywi_owner_first_use_entries_455 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 request_id uuid not null,
 checkpoint text not null check(checkpoint in
  ('company_verified','module_rechecked','customer_property_reviewed','jobs_draft_reviewed','field_observation')),
 module_key text check(module_key is null or module_key in
  ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture')),
 observed_enabled boolean,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 disposition text not null check(disposition in ('observed','needs_follow_up','blocked')),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(company_id,request_id),
 constraint ywi_455_module_pair check(
  (checkpoint='module_rechecked' and module_key is not null and observed_enabled is not null)
  or (checkpoint<>'module_rechecked' and module_key is null and observed_enabled is null))
);
create index if not exists ywi_455_company_timeline
 on public.ywi_owner_first_use_entries_455(company_id,created_at desc,id desc);
alter table public.ywi_owner_first_use_entries_455 enable row level security;
revoke all on public.ywi_owner_first_use_entries_455 from public,anon,authenticated;
drop policy if exists ywi_455_owner_read_defense on public.ywi_owner_first_use_entries_455;
create policy ywi_455_owner_read_defense on public.ywi_owner_first_use_entries_455
 for select to authenticated using(exists (
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));

create or replace function public.ywi_rpc_owner_first_use_455(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_entries jsonb;v_total integer;v_clients integer;v_sites integer;v_jobs integer;v_nav jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 v_nav:=public.ywi_rpc_pms_navigation_443(p_company_id);
 select count(*) into v_clients from public.ywi_company_client_links_422
 where company_id=p_company_id;
 select count(*) into v_sites from public.ywi_company_site_links_422
 where company_id=p_company_id;
 select count(*) into v_jobs from public.ywi_new_work_gate_receipts_421
 where company_id=p_company_id;
 select count(*) into v_total from public.ywi_owner_first_use_entries_455
 where company_id=p_company_id;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]'::jsonb)
 into v_entries from (
  select id,checkpoint,module_key,observed_enabled,source_reference,notes,
   disposition,created_at from public.ywi_owner_first_use_entries_455
  where company_id=p_company_id order by created_at desc,id desc limit 60
 ) t;
 return jsonb_build_object('company_id',p_company_id,'captured_at',statement_timestamp(),
  'owner_guard','ywi_422_assert_owner','services',v_nav->'services',
  'client_links',v_clients,'property_links',v_sites,'jobs_receipts',v_jobs,
  'evidence_total',v_total,'evidence_sample_capped',v_total>60,'entries',v_entries,
  'owner_field_accepted',false,'release_green',false,'outbound_actions',false,
  'synthetic',false,'mutation_authorized',false);
end $$;

create or replace function public.ywi_rpc_append_owner_first_use_455(
 p_company_id uuid,p_request_id uuid,p_checkpoint text,p_module_key text,
 p_observed_enabled boolean,p_reference text,p_notes text,p_disposition text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_old record;v_enabled boolean;v_reference text:=btrim(coalesce(p_reference,''));
 v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 if p_request_id is null or p_checkpoint is null or p_checkpoint not in
  ('company_verified','module_rechecked','customer_property_reviewed','jobs_draft_reviewed','field_observation')
  or p_disposition is null or p_disposition not in ('observed','needs_follow_up','blocked')
  or char_length(v_reference) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
  or (p_checkpoint='module_rechecked' and (p_module_key is null or p_observed_enabled is null))
  or (p_checkpoint<>'module_rechecked' and (p_module_key is not null or p_observed_enabled is not null)) then
  raise exception '455 invalid owner first-use evidence request';
 end if;
 if p_checkpoint='module_rechecked' then
  select enabled into v_enabled from public.ywi_company_service_modules
   where company_id=p_company_id and module_key=p_module_key for share;
  if not found or v_enabled is distinct from p_observed_enabled then
   raise exception '455 module changed or missing; refresh owner registry';
  end if;
 elsif p_checkpoint='customer_property_reviewed' then
  if not exists(select 1 from public.ywi_company_site_links_422 where company_id=p_company_id) then
   raise exception '455 no canonical company property exists';
  end if;
 elsif p_checkpoint='jobs_draft_reviewed' then
  if not exists(select 1 from public.ywi_new_work_gate_receipts_421 where company_id=p_company_id) then
   raise exception '455 no original 421 Jobs/estimate receipt exists';
  end if;
 end if;
 -- A bounded, serial append-only owner journal. Replayed request IDs must match
 -- exactly, and no UPDATE/DELETE is granted to the browser role.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,455));
 if (select count(*) from public.ywi_owner_first_use_entries_455 where company_id=p_company_id)>=200 then
  raise exception '455 evidence journal capacity reached; review pagination before further intake';
 end if;
 insert into public.ywi_owner_first_use_entries_455
  (company_id,request_id,checkpoint,module_key,observed_enabled,source_reference,notes,disposition,recorded_by)
 values(p_company_id,p_request_id,p_checkpoint,p_module_key,p_observed_enabled,v_reference,v_notes,p_disposition,auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_owner_first_use_entries_455
   where company_id=p_company_id and request_id=p_request_id;
  if not found or v_old.checkpoint is distinct from p_checkpoint
   or v_old.module_key is distinct from p_module_key
   or v_old.observed_enabled is distinct from p_observed_enabled
   or v_old.source_reference is distinct from v_reference
   or v_old.notes is distinct from v_notes or v_old.disposition is distinct from p_disposition
   or v_old.recorded_by is distinct from auth.uid() then
    raise exception '455 replay request has mismatched content';
  end if;
  v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'checkpoint',p_checkpoint,
  'recorded',true,'owner_field_accepted',false,'approval_granted',false,'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_owner_first_use_455(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_append_owner_first_use_455(uuid,uuid,text,text,boolean,text,text,text)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_owner_first_use_455(uuid) to authenticated;
grant execute on function public.ywi_rpc_append_owner_first_use_455(uuid,uuid,text,text,boolean,text,text,text)
 to authenticated;
comment on table public.ywi_owner_first_use_entries_455 is
 'Owner-only immutable evidence intake. Reported observations are never field, safety or production approvals.';
commit;
