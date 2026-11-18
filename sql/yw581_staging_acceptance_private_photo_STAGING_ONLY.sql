-- YW581 · STAGING-ONLY candidate. NOT a production migration.
-- Prerequisites: original 420/421/422/443 CRM/Jobs and YW580 specialty tables.
-- Apply only to an isolated Supabase staging database with independently audited
-- backup, RLS-negative tests and separate owner + DBA signoff.
begin;
create table if not exists public.ywi_581_service_acceptance (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  service_key text not null check(service_key in
    ('landscape','snow_removal','snow_plowing','septic','arboriculture',
     'construction','water_parks','ponds','skateparks')),
  environment text not null default 'staging' check(environment='staging'),
  owner_witness uuid not null references auth.users(id) on delete restrict,
  independent_reviewer uuid not null references auth.users(id) on delete restrict,
  source_revision text not null check(source_revision ~ '^[0-9a-f]{40}$'),
  migration_digest text not null check(migration_digest ~ '^[0-9a-f]{64}$'),
  isolation_test_digest text not null check(isolation_test_digest ~ '^[0-9a-f]{64}$'),
  signed_acceptance_reference text not null check(length(signed_acceptance_reference) between 16 and 240),
  accepted_at timestamptz not null,
  valid_until timestamptz not null,
  primary key(company_id,service_key),
  constraint ywi_581_distinct_reviewers check(owner_witness<>independent_reviewer),
  constraint ywi_581_bounded_acceptance check(valid_until>accepted_at and valid_until<=accepted_at+interval '72 hours')
);
alter table public.ywi_581_service_acceptance enable row level security;
revoke all on public.ywi_581_service_acceptance from public,anon,authenticated;
grant select on public.ywi_581_service_acceptance to authenticated;
drop policy if exists ywi_581_acceptance_owner_read on public.ywi_581_service_acceptance;
create policy ywi_581_acceptance_owner_read on public.ywi_581_service_acceptance
 for select to authenticated using(exists(
   select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- No authenticated INSERT/UPDATE/DELETE or owner-written attestation RPC.
-- Independent reviewer must provision genuine staging acceptance via separately
-- governed database change management. Neither witness is inferred from UI role.

create table if not exists public.ywi_581_job_photo_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid not null,
  client_site_id uuid not null,
  job_id uuid not null references public.work_orders(id) on delete restrict,
  service_key text not null check(service_key in
    ('landscape','snow_removal','snow_plowing','septic','arboriculture',
     'construction','water_parks','ponds','skateparks')),
  request_id uuid not null,
  private_object_key text not null unique
    check(private_object_key !~ '(\.\.|[?&#])' and length(private_object_key)<220),
  reported_sha256 text not null check(reported_sha256 ~ '^[0-9a-f]{64}$'),
  hash_server_verified boolean not null default false check(hash_server_verified=false),
  media_type text not null check(media_type in('image/jpeg','image/png','image/webp')),
  consent_scope text not null check(consent_scope='job_documentation'),
  consent_recorded boolean not null check(consent_recorded=true),
  retained_until timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  unique(company_id,request_id),
  foreign key(company_id,client_id)
    references public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
  foreign key(company_id,client_id,client_site_id)
    references public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
  constraint ywi_581_retention_window check(retained_until>created_at and retained_until<=created_at+interval '3 years')
);
create index if not exists ywi_581_photo_job_review on
 public.ywi_581_job_photo_evidence(company_id,job_id,created_at desc);
alter table public.ywi_581_job_photo_evidence enable row level security;
revoke all on public.ywi_581_job_photo_evidence from public,anon,authenticated;
grant select on public.ywi_581_job_photo_evidence to authenticated;
drop policy if exists ywi_581_photo_owner_read on public.ywi_581_job_photo_evidence;
create policy ywi_581_photo_owner_read on public.ywi_581_job_photo_evidence
 for select to authenticated using(exists(
   select 1 from public.ywi_companies c
    where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Read metadata only; object retrieval requires separate authorized signed access.
-- Private object path: company UUID/job UUID/random photo UUID.(jpg|jpeg|png|webp).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ywi-private-job-photos-581','ywi-private-job-photos-581',
 false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$
begin
 if not exists(select 1 from storage.buckets b
  where b.id='ywi-private-job-photos-581' and b.public=false
    and b.file_size_limit<=10485760
    and b.allowed_mime_types<@array['image/jpeg','image/png','image/webp']) then
  raise exception 'YW581 bucket must be private, max 10 MB and images only';
 end if;
end $$;

create or replace function public.ywi_581_may_upload(p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_company uuid; v_job uuid; v_key text; v_service text;
begin
 if auth.uid() is null or p_path is null or p_path !~
  '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
 then return false; end if;
 begin
  v_company:=split_part(p_path,'/',1)::uuid;
  v_job:=split_part(p_path,'/',2)::uuid;
 exception when invalid_text_representation then return false;
 end;
 select w.service_module_key into v_service from public.work_orders w
  join public.ywi_companies c on c.id=w.company_id and c.owner_user_id=auth.uid()
  join public.ywi_company_site_links_422 s
   on s.company_id=w.company_id and s.client_id=w.client_id
   and s.client_site_id=w.client_site_id
  join public.ywi_company_client_links_422 l
   on l.company_id=s.company_id and l.client_id=s.client_id
  where w.id=v_job and w.company_id=v_company;
 if v_service is null then return false; end if;
 return exists(select 1 from public.ywi_581_service_acceptance a
  where a.company_id=v_company and a.service_key=v_service
   and a.environment='staging' and a.accepted_at<=statement_timestamp()
   and a.valid_until>statement_timestamp());
end $$;
revoke all on function public.ywi_581_may_upload(text) from public,anon,authenticated;
grant execute on function public.ywi_581_may_upload(text) to authenticated;
drop policy if exists ywi_581_owner_upload on storage.objects;
create policy ywi_581_owner_upload on storage.objects for insert to authenticated
 with check(bucket_id='ywi-private-job-photos-581'
   and public.ywi_581_may_upload(name));
-- No direct UPDATE/DELETE or unscoped SELECT policy on this bucket. Storage
-- retention cleanup and server-side content hash verification require a
-- separately privileged, audited worker and are not declared completed here.

create or replace function public.ywi_rpc_record_photo_581(
 p_company_id uuid,p_client_id uuid,p_site_id uuid,p_job_id uuid,
 p_request_id uuid,p_path text,p_reported_sha256 text,p_media_type text,
 p_consent boolean,p_retained_until timestamptz
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_service text; v_id uuid; v_original record;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_422_assert_jobs_create();
 perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
 select w.service_module_key into v_service from public.work_orders w
  where w.id=p_job_id and w.company_id=p_company_id
   and w.client_id=p_client_id and w.client_site_id=p_site_id;
 if v_service is null or p_request_id is null or p_path is null
   or p_reported_sha256 !~ '^[0-9a-f]{64}$' or p_media_type not in
   ('image/jpeg','image/png','image/webp') or p_consent is distinct from true
   or p_retained_until<=statement_timestamp()
   or p_retained_until>statement_timestamp()+interval '3 years'
   or not public.ywi_581_may_upload(p_path)
   or split_part(p_path,'/',1)<>p_company_id::text
   or split_part(p_path,'/',2)<>p_job_id::text
   or not exists(select 1 from storage.objects o
     where o.bucket_id='ywi-private-job-photos-581' and o.name=p_path
      and o.metadata->>'mimetype'=p_media_type)
 then raise exception '581 original job, consent, private storage or staging approval not verified'; end if;
 insert into public.ywi_581_job_photo_evidence(
  company_id,client_id,client_site_id,job_id,service_key,request_id,
  private_object_key,reported_sha256,media_type,consent_scope,
  consent_recorded,retained_until,recorded_by)
 values(p_company_id,p_client_id,p_site_id,p_job_id,v_service,p_request_id,
  p_path,p_reported_sha256,p_media_type,'job_documentation',true,
  p_retained_until,auth.uid())
 on conflict(company_id,request_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_original from public.ywi_581_job_photo_evidence
   where company_id=p_company_id and request_id=p_request_id;
  if v_original.private_object_key is distinct from p_path
    or v_original.job_id is distinct from p_job_id
    or v_original.reported_sha256 is distinct from p_reported_sha256
    or v_original.client_id is distinct from p_client_id
    or v_original.client_site_id is distinct from p_site_id
  then raise exception '581 replay conflict; original metadata is immutable'; end if;
  v_id:=v_original.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'job_id',p_job_id,
  'storage_recorded',true,'content_hash_independently_verified',false,
  'new_work_authorized',false,'financial_activation',false);
end $$;
revoke all on function public.ywi_rpc_record_photo_581(
 uuid,uuid,uuid,uuid,uuid,text,text,text,boolean,timestamptz)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_photo_581(
 uuid,uuid,uuid,uuid,uuid,text,text,text,boolean,timestamptz) to authenticated;

create or replace function public.ywi_rpc_staging_acceptance_581(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_services jsonb; v_photos bigint;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 with nine(service_key) as (
  values ('landscape'),('snow_removal'),('snow_plowing'),('septic'),
   ('arboriculture'),('construction'),('water_parks'),('ponds'),('skateparks')
 ), checked as (
  select n.service_key,
   case when n.service_key in ('ponds','skateparks') then sp.enabled else svc.enabled end as enabled,
   case when n.service_key in ('ponds','skateparks') then sp.company_id is not null else svc.company_id is not null end as registry_present,
   a.accepted_at is not null and a.accepted_at<=statement_timestamp()
    and a.valid_until>statement_timestamp() as staging_accepted
  from nine n
  left join public.ywi_company_service_modules svc
   on svc.company_id=p_company_id and svc.module_key=n.service_key
  left join public.ywi_company_specialty_modules_580 sp
   on sp.company_id=p_company_id and sp.module_key=n.service_key
  left join public.ywi_581_service_acceptance a
   on a.company_id=p_company_id and a.service_key=n.service_key
 )
 select jsonb_agg(jsonb_build_object(
  'key',service_key,'enabled',coalesce(enabled,false),
  'registry_present',registry_present,'staging_accepted',staging_accepted,
  'new_work_authorized',false) order by service_key)
 into v_services from checked;
 select count(*) into v_photos from public.ywi_581_job_photo_evidence
  where company_id=p_company_id;
 return jsonb_build_object('company_id',p_company_id,
  'captured_at',statement_timestamp(),'owner_guard','ywi_422_assert_owner',
  'source','YW581_STAGING_ONLY','synthetic',false,
  'services',v_services,'photo_records',v_photos,'digest_independently_verified',false,
  'mutation_authorized',false,'production_activation_authorized',false,
  'customer_messaging_authorized',false,'financial_activation_authorized',false);
end $$;
revoke all on function public.ywi_rpc_staging_acceptance_581(uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_staging_acceptance_581(uuid) to authenticated;
commit;
