-- Ephemeral PostgreSQL CI only. NEVER execute against a linked/live project.
-- Minimal predecessor schema contract; no real tenant, provider or receipt.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() <> 'yw599_ci' or to_regclass('public.ywi_companies') is not null then
 raise exception 'isolated empty yw599_ci database required'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key references auth.users, is_active boolean not null);
create table public.ywi_companies(id uuid primary key, owner_user_id uuid not null references auth.users);
create table public.ywi_591_tenant_pilots(company_id uuid,owner_user_id uuid,reviewer_user_id uuid,state text,expires_at timestamptz);
create table public.ywi_597_health_enrollments(id uuid primary key,company_id uuid,owner_user_id uuid);
create table public.ywi_597_health_alerts(id uuid primary key,company_id uuid,enrollment_id uuid,detected_at timestamptz,issue_code text);
create table public.ywi_598_execution_receipts(id uuid primary key,company_id uuid,unique(company_id,id));
create table public.ywi_598_rollback_drills(id uuid primary key,company_id uuid,unique(company_id,id));
create function public.ywi_591_forbid_change() returns trigger language plpgsql set search_path='' as $$begin raise exception 'YW591 immutable source event'; end;$$;
create function public.ywi_591_source_role_assert() returns void language plpgsql set search_path='' as $$begin if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')) is distinct from 'service_role' then raise exception 'YW591 service-only original custody transition'; end if; end;$$;
grant select,update on public.ywi_companies to service_role;
\ir ../sql/yw599_independent_notification_custody.sql
begin;
-- Fixture IDs are intentionally synthetic and only ever inserted inside this
-- disposable CI transaction. No provider traffic, production credentials or API.
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
insert into public.profiles select id,true from auth.users;
insert into public.ywi_companies values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000003');
insert into public.ywi_591_tenant_pilots values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','APPROVED',now()+interval '1 day');
insert into public.ywi_597_health_enrollments values ('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001');
insert into public.ywi_597_health_alerts values ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',now(),'NO_SIGNED_MASTER_ACK_30M');
insert into public.ywi_598_execution_receipts values ('00000000-0000-4000-8000-000000000060','00000000-0000-4000-8000-000000000011');
insert into public.ywi_598_rollback_drills values ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000011');
do $$declare t record; begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ywi_599_%' and c.relkind='r' and c.relrowsecurity)<>7 then raise exception 'seven RLS tables required'; end if;
 for t in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ywi_599_%' and c.relkind='r' loop
 if has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') or not has_table_privilege('service_role',t.oid,'SELECT') or not has_table_privilege('service_role',t.oid,'INSERT') or has_table_privilege('service_role',t.oid,'UPDATE,DELETE') then raise exception 'bad grants: %',t.relname; end if;
 end loop;
 if has_function_privilege('authenticated','public.ywi_599_claim_notification(uuid,uuid,uuid,text)','EXECUTE') or has_function_privilege('anon','public.ywi_599_claim_notification(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'public RPC access'; end if;
end $$;
set local role service_role;
set local request.jwt.claim.role='service_role';
insert into public.ywi_599_provider_enrollments(id,company_id,owner_id,reviewer_id,provider_id,recipient_ref,config_sha256,owner_signature,expires_at)
select x,'00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','fixture-provider','fixture-recipient',repeat('a',64),repeat('b',64),now()+interval '1 day' from unnest(array['00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000042']::uuid[]) x;
insert into public.ywi_599_provider_approvals(enrollment_id,reviewer_id,reviewer_signature) values ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000002',repeat('c',64)),('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000002',repeat('c',64));
do $$declare c uuid:='00000000-0000-4000-8000-000000000010'; e uuid:='00000000-0000-4000-8000-000000000040'; a uuid:='00000000-0000-4000-8000-000000000030'; r jsonb; begin
 r:=public.ywi_599_claim_notification(c,e,a,repeat('d',64));
 if r->>'state'<>'ATOMIC_CLAIMED' then raise exception 'first claim failed'; end if;
 if (public.ywi_599_claim_notification(c,e,a,repeat('d',64))->>'state')<>'HOLD_NO_RETRY' then raise exception 'in-flight retry allowed'; end if;
 insert into public.ywi_599_notification_results(claim_id,state,request_digest) values ((r->>'nonce')::uuid,'UNKNOWN',repeat('e',64));
 if (public.ywi_599_claim_notification(c,e,a,repeat('d',64))->>'state')<>'HOLD_NO_RETRY' then raise exception 'unknown retry allowed'; end if;
 if (public.ywi_599_claim_notification(c,'00000000-0000-4000-8000-000000000041',a,repeat('d',64))->>'state')<>'HOLD_PREVIOUS_ENROLLMENT_RECONCILIATION' then raise exception 'renewal bypass'; end if;
 insert into public.ywi_599_provider_revocations(enrollment_id,actor_id) values ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000001');
 begin
 insert into public.ywi_599_provider_approvals(enrollment_id,reviewer_id,reviewer_signature) values ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000002',repeat('c',64));
 raise exception 'revoked approval unexpectedly succeeded';
 exception when raise_exception then if sqlerrm not like 'YW599 approval HOLD%' then raise; end if; end;
 begin
 perform public.ywi_599_claim_notification(c,'00000000-0000-4000-8000-000000000042',a,repeat('d',64));
 raise exception 'revoked claim unexpectedly succeeded';
 exception when raise_exception then if sqlerrm not like 'YW599 authority HOLD%' then raise; end if; end;
 begin
 insert into public.ywi_599_final_cutover_receipts(company_id,execution_id,rollback_drill_id,owner_id,reviewer_id,auditor_id,challenge_nonce,remote_receipt_id,source_receipt_ref,challenge,response_payload,old_signature,next_signature,verified_at) values(c,'00000000-0000-4000-8000-000000000060','00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000070','fixture-cutover','fixture-source','{}','{"state":"NEXT_ACTIVE_OLD_ACCEPTED"}',repeat('a',64),repeat('b',64),now());
 raise exception 'cross-tenant cutover unexpectedly succeeded';
 exception when foreign_key_violation then null; end;
end $$;
reset role;
do $$begin
 begin update public.ywi_599_provider_enrollments set expires_at=now()+interval '2 days';
 raise exception 'immutable update unexpectedly succeeded';
 exception when raise_exception then if sqlerrm not like 'YW591 immutable source event%' then raise; end if; end;
end $$;
rollback;
select 'YW599 isolated PostgreSQL migration, RLS, grants, immutable events, unknown delivery and cross-tenant rejection passed' as result;
