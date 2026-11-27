-- Disposable PostgreSQL CI only, never a linked project.
\set ON_ERROR_STOP on
\ir yw599-isolated-postgres-check.sql
\ir ../sql/yw600_independent_failover.sql
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

insert into public.ywi_599_provider_enrollments(id,company_id,owner_id,reviewer_id,provider_id,recipient_ref,config_sha256,owner_signature,expires_at)
values ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','fixture-primary','fixture-recipient',repeat('a',64),repeat('b',64),now()+interval '1 day'),
('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','fixture-secondary','fixture-recipient',repeat('a',64),repeat('b',64),now()+interval '1 day');
insert into public.ywi_599_provider_approvals(enrollment_id,reviewer_id,reviewer_signature) select id,reviewer_id,repeat('c',64) from public.ywi_599_provider_enrollments;
insert into public.ywi_599_notification_claims(id,company_id,enrollment_id,alert_id,attempt,source_sha256,claimed_at)
select ('00000000-0000-4000-8000-00000000005'||i)::uuid,'00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000030',i,repeat('d',64),now()-interval '10 minutes'+i*interval '5 minutes' from generate_series(1,3) i;
-- SQL tests check durable bindings; cryptographic verification tested in Node.
do $$begin
 if has_function_privilege('authenticated','public.ywi_600_claim_failover(uuid,uuid,uuid,uuid,text,uuid[],text)','EXECUTE') or has_function_privilege('anon','public.ywi_600_claim_failover(uuid,uuid,uuid,uuid,text,uuid[],text)','EXECUTE') then raise exception 'public failover RPC';end if;
 if has_table_privilege('service_role','public.ywi_600_failover_claims','INSERT') or has_table_privilege('authenticated','public.ywi_600_failover_results','SELECT,INSERT,UPDATE,DELETE') then raise exception 'bad failover grants';end if;
 if (select count(*) from pg_class where relname in ('ywi_600_failover_claims','ywi_600_failover_results') and relrowsecurity)<>2 then raise exception 'RLS missing';end if;
end$$;
set local request.jwt.claim.role='service_role';
set local role service_role;
do $$declare ids uuid[]:=array['00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000053']::uuid[];c uuid:='00000000-0000-4000-8000-000000000010';a uuid:='00000000-0000-4000-8000-000000000030';p uuid:='00000000-0000-4000-8000-000000000040';s uuid:='00000000-0000-4000-8000-000000000041';begin
 if (public.ywi_600_claim_failover(c,a,p,s,repeat('d',64),ids,repeat('e',64))->>'state')<>'HOLD_PRIMARY_NOT_DEFINITIVE' then raise exception 'in-flight failover';end if;
end$$;
reset role;
insert into public.ywi_599_notification_results(claim_id,state,provider_receipt_id,request_digest,receipt_payload,receipt_signature)
select x.id,'DEFINITIVE_FAILURE','fixture-receipt-'||x.attempt,repeat('f',64),jsonb_build_object('status','NOT_DELIVERED','nonce',x.id,'companyId',x.company_id,'alertId',x.alert_id,'enrollmentId',x.enrollment_id,'providerId','fixture-primary','recipientRef','fixture-recipient','sourceSha256',x.source_sha256,'requestDigest',repeat('f',64),'receiptId','fixture-receipt-'||x.attempt),repeat('a',64) from public.ywi_599_notification_claims x;
set local role service_role;
do $$declare ids uuid[]:=array['00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000053']::uuid[];c uuid:='00000000-0000-4000-8000-000000000010';a uuid:='00000000-0000-4000-8000-000000000030';p uuid:='00000000-0000-4000-8000-000000000040';s uuid:='00000000-0000-4000-8000-000000000041';r jsonb;begin
 if (public.ywi_600_claim_failover(c,a,p,s,repeat('d',64),array[ids[2],ids[1],ids[3]],repeat('e',64))->>'state')<>'HOLD_PRIMARY_NOT_DEFINITIVE' then raise exception 'wrong evidence order';end if;
 r:=public.ywi_600_claim_failover(c,a,p,s,repeat('d',64),ids,repeat('e',64));
 if r->>'state'<>'ATOMIC_CLAIMED' then raise exception 'claim not admitted';end if;
 if (public.ywi_600_claim_failover(c,a,p,s,repeat('d',64),ids,repeat('e',64))->>'state')<>'HOLD_FAILOVER_ALREADY_CLAIMED' then raise exception 'duplicate alternate claim';end if;
 insert into public.ywi_600_failover_results(claim_id,state,request_digest) values((r->>'nonce')::uuid,'UNKNOWN',repeat('a',64));
 if (public.ywi_600_claim_failover(c,a,p,s,repeat('d',64),ids,repeat('e',64))->>'state')<>'HOLD_FAILOVER_ALREADY_CLAIMED' then raise exception 'unknown duplicate';end if;
end$$;
reset role;
rollback;
select 'YW600 isolated SQL migration and bounded claim regressions passed; no production data' as result;
