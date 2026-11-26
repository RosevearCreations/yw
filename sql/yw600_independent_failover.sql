begin;
-- Additive, no live enrollment, result or notification seeded.
create table public.ywi_600_failover_claims(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.ywi_companies(id),
 alert_id uuid not null references public.ywi_597_health_alerts(id),
 primary_enrollment_id uuid not null,secondary_enrollment_id uuid not null,
 primary_claim_ids uuid[] not null check(cardinality(primary_claim_ids)=3 and array_position(primary_claim_ids,null) is null),
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 claimed_at timestamptz not null default now(),
 foreign key(company_id,primary_enrollment_id) references public.ywi_599_provider_enrollments(company_id,id),
 foreign key(company_id,secondary_enrollment_id) references public.ywi_599_provider_enrollments(company_id,id),
 unique(company_id,alert_id),check(primary_enrollment_id<>secondary_enrollment_id)
);
create table public.ywi_600_failover_results(
 claim_id uuid primary key references public.ywi_600_failover_claims(id),
 state text not null check(state in ('VERIFIED_DELIVERY','DEFINITIVE_FAILURE','UNKNOWN')),
 provider_receipt_id text unique,
 request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),
 receipt_payload jsonb,receipt_signature text,recorded_at timestamptz not null default now(),
 check((state='UNKNOWN' and provider_receipt_id is null and receipt_payload is null and receipt_signature is null)
 or (state<>'UNKNOWN' and provider_receipt_id is not null and receipt_payload is not null and receipt_signature ~ '^[0-9a-f]{64}$' and receipt_signature is not null))
);
do $$declare t text;begin
 foreach t in array array['ywi_600_failover_claims','ywi_600_failover_results'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to service_role',t);
 execute format('create trigger yw600_immutable before update or delete on public.%I for each row execute function public.ywi_591_forbid_change()',t);
 end loop;
end$$;
grant insert on public.ywi_600_failover_results to service_role;
-- Edge verifies exact signed non-delivery before this RPC. SQL locks the same
-- company row as YW599 consent and claim creation, rechecks immutable evidence,
-- and inserts a single alternate attempt for the entire tenant/alert lifetime.
create function public.ywi_600_claim_failover(p_company uuid,p_alert uuid,p_primary uuid,p_secondary uuid,p_source_sha text,p_primary_claim_ids uuid[],p_evidence_sha text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare p record;s record;a record;c record;ids uuid[];n integer;
begin
 perform public.ywi_591_source_role_assert();
 perform 1 from public.ywi_companies where id=p_company for update;
 if exists(select 1 from public.ywi_600_failover_claims where company_id=p_company and alert_id=p_alert) then return jsonb_build_object('state','HOLD_FAILOVER_ALREADY_CLAIMED');end if;
 select * into p from public.ywi_599_provider_enrollments where company_id=p_company and id=p_primary;
 select * into s from public.ywi_599_provider_enrollments where company_id=p_company and id=p_secondary;
 select * into a from public.ywi_597_health_alerts where company_id=p_company and id=p_alert;
 if p.id is null or s.id is null or a.id is null or p.id=s.id or p.provider_id=s.provider_id
 or p.owner_id<>s.owner_id or p.reviewer_id<>s.reviewer_id or s.expires_at<=now()
 or a.detected_at<now()-interval '24 hours' or a.detected_at>now()
 or not exists(select 1 from public.ywi_597_health_enrollments x where x.id=a.enrollment_id and x.company_id=p_company and x.owner_user_id=s.owner_id)
 or not exists(select 1 from public.ywi_599_provider_approvals x where x.enrollment_id=s.id and x.reviewer_id=s.reviewer_id)
 or exists(select 1 from public.ywi_599_provider_revocations x where x.enrollment_id=s.id)
 or not exists(select 1 from public.ywi_companies x where x.id=p_company and x.owner_user_id=s.owner_id)
 or not exists(select 1 from public.ywi_591_tenant_pilots x where x.company_id=p_company and x.owner_user_id=s.owner_id and x.reviewer_user_id=s.reviewer_id and x.state='APPROVED' and x.expires_at>now())
 or (select count(*) from public.profiles x where x.id in(s.owner_id,s.reviewer_id) and x.is_active=true)<>2
 then raise exception 'YW600 authority HOLD';end if;
 select count(*),array_agg(x.id order by x.attempt) into n,ids
 from public.ywi_599_notification_claims x join public.ywi_599_notification_results y on y.claim_id=x.id
 where x.company_id=p_company and x.alert_id=p_alert and x.enrollment_id=p_primary and x.source_sha256=p_source_sha
 and y.state='DEFINITIVE_FAILURE' and y.receipt_payload->>'status'='NOT_DELIVERED'
 and y.receipt_payload->>'nonce'=x.id::text and y.receipt_payload->>'companyId'=p_company::text and y.receipt_payload->>'alertId'=p_alert::text
 and y.receipt_payload->>'enrollmentId'=p_primary::text and y.receipt_payload->>'providerId'=p.provider_id
 and y.receipt_payload->>'recipientRef'=p.recipient_ref and y.receipt_payload->>'sourceSha256'=p_source_sha
 and y.receipt_payload->>'requestDigest'=y.request_digest and y.receipt_payload->>'receiptId'=y.provider_receipt_id;
 if n<>3 or ids is distinct from p_primary_claim_ids or (select count(*) from public.ywi_599_notification_claims where company_id=p_company and alert_id=p_alert)<>3 then return jsonb_build_object('state','HOLD_PRIMARY_NOT_DEFINITIVE');end if;
 insert into public.ywi_600_failover_claims(company_id,alert_id,primary_enrollment_id,secondary_enrollment_id,primary_claim_ids,source_sha256,evidence_sha256)
 values(p_company,p_alert,p_primary,p_secondary,ids,p_source_sha,p_evidence_sha) returning * into c;
 return jsonb_build_object('state','ATOMIC_CLAIMED','companyId',p_company,'alertId',p_alert,'enrollmentId',s.id,'nonce',c.id,'attempt',1,'claimedAt',c.claimed_at,'sourceSha256',c.source_sha256,'providerId',s.provider_id,'recipientRef',s.recipient_ref,'issueCode',a.issue_code);
end;$fn$;
revoke all on function public.ywi_600_claim_failover(uuid,uuid,uuid,uuid,text,uuid[],text) from public,anon,authenticated;
grant execute on function public.ywi_600_claim_failover(uuid,uuid,uuid,uuid,text,uuid[],text) to service_role;
commit;
