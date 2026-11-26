begin;
-- Private service-only ledger. No provider enrollment or notification is seeded.
create table public.ywi_599_provider_enrollments(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id),
 owner_id uuid not null references auth.users(id),
 reviewer_id uuid not null references auth.users(id),
 provider_id text not null check(provider_id ~ '^[A-Za-z0-9_-]{8,128}$'),
 recipient_ref text not null check(recipient_ref ~ '^[A-Za-z0-9_-]{8,128}$'),
 config_sha256 text not null check(config_sha256 ~ '^[0-9a-f]{64}$'),
 owner_signature text not null check(owner_signature ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 unique(company_id,id), check(owner_id<>reviewer_id),
 check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
create table public.ywi_599_provider_approvals(
 enrollment_id uuid primary key references public.ywi_599_provider_enrollments(id),
 reviewer_id uuid not null references auth.users(id),
 reviewer_signature text not null check(reviewer_signature ~ '^[0-9a-f]{64}$'),
 approved_at timestamptz not null default now()
);
create table public.ywi_599_provider_revocations(
 enrollment_id uuid primary key references public.ywi_599_provider_enrollments(id),
 actor_id uuid not null references auth.users(id),
 revoked_at timestamptz not null default now()
);
create table public.ywi_599_notification_claims(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 enrollment_id uuid not null,
 alert_id uuid not null references public.ywi_597_health_alerts(id),
 attempt integer not null check(attempt between 1 and 3),
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 claimed_at timestamptz not null default now(),
 foreign key(company_id,enrollment_id) references public.ywi_599_provider_enrollments(company_id,id),
 unique(enrollment_id,alert_id,attempt),
 unique(company_id,alert_id,attempt), unique(company_id,id)
);
create table public.ywi_599_notification_results(
 claim_id uuid primary key references public.ywi_599_notification_claims(id),
 state text not null check(state in ('VERIFIED_DELIVERY','DEFINITIVE_FAILURE','UNKNOWN')),
 provider_receipt_id text unique,
 request_digest text not null check(request_digest ~ '^[0-9a-f]{64}$'),
 receipt_payload jsonb,
 receipt_signature text,
 recorded_at timestamptz not null default now(),
 check((state='UNKNOWN' and provider_receipt_id is null and receipt_payload is null and receipt_signature is null)
 or (state<>'UNKNOWN' and provider_receipt_id is not null and receipt_payload is not null and receipt_signature is not null and receipt_signature ~ '^[0-9a-f]{64}$'))
);
do $block$
declare t text;
begin
 foreach t in array array['provider_enrollments','provider_approvals','provider_revocations','notification_claims','notification_results'] loop
 execute format('alter table public.%I enable row level security','ywi_599_'||t);
 execute format('revoke all on public.%I from public,anon,authenticated','ywi_599_'||t);
 execute format('grant select,insert on public.%I to service_role','ywi_599_'||t);
 execute format('create trigger yw599_immutable before update or delete on public.%I for each row execute function public.ywi_591_forbid_change()','ywi_599_'||t);
 end loop;
end;$block$;
-- Serialize revocation and approval with the same company lock as claim creation.
-- A claim committed before revocation is already authorized/in flight; revocation
-- prevents subsequent claims, not cancellation of an external network operation.
create function public.ywi_599_lock_consent_change() returns trigger
language plpgsql security invoker set search_path='' as $lock$
declare e record;
begin
 select * into e from public.ywi_599_provider_enrollments where id=new.enrollment_id;
 if e.id is null then raise exception 'YW599 enrollment HOLD'; end if;
 perform 1 from public.ywi_companies where id=e.company_id for update;
 if tg_table_name='ywi_599_provider_approvals' then
  if new.reviewer_id<>e.reviewer_id or e.expires_at<=now() or exists(select 1 from public.ywi_599_provider_revocations where enrollment_id=e.id) then raise exception 'YW599 approval HOLD'; end if;
 elsif new.actor_id not in(e.owner_id,e.reviewer_id) then raise exception 'YW599 revocation HOLD';
 end if;
 return new;
end;$lock$;
revoke all on function public.ywi_599_lock_consent_change() from public,anon,authenticated;
grant execute on function public.ywi_599_lock_consent_change() to service_role;
create trigger yw599_serialize_approval before insert on public.ywi_599_provider_approvals for each row execute function public.ywi_599_lock_consent_change();
create trigger yw599_serialize_revocation before insert on public.ywi_599_provider_revocations for each row execute function public.ywi_599_lock_consent_change();

-- Caller must first cryptographically reverify both approvals, pinned provider
-- configuration, and original alert digest. This transaction rechecks authority
-- and serializes attempts. No network operation occurs in SQL.
create function public.ywi_599_claim_notification(p_company uuid,p_enrollment uuid,p_alert uuid,p_source_sha text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare e record; a record; prev record; n integer; c record;
begin
 perform public.ywi_591_source_role_assert();
 -- Serialize all enrollment attempts for the same tenant, even if consent is renewed.
 perform 1 from public.ywi_companies where id=p_company for update;
 select * into e from public.ywi_599_provider_enrollments where id=p_enrollment and company_id=p_company for update;
 select * into a from public.ywi_597_health_alerts where id=p_alert and company_id=p_company;
 if e.id is null or a.id is null or e.expires_at<=now() or a.detected_at<now()-interval '24 hours' or a.detected_at>now()
 or not exists(select 1 from public.ywi_597_health_enrollments x where x.id=a.enrollment_id and x.company_id=p_company and x.owner_user_id=e.owner_id)
 or not exists(select 1 from public.ywi_599_provider_approvals x where x.enrollment_id=e.id and x.reviewer_id=e.reviewer_id)
 or exists(select 1 from public.ywi_599_provider_revocations x where x.enrollment_id=e.id)
 or not exists(select 1 from public.ywi_companies x where x.id=p_company and x.owner_user_id=e.owner_id)
 or not exists(select 1 from public.ywi_591_tenant_pilots x where x.company_id=p_company and x.owner_user_id=e.owner_id and x.reviewer_user_id=e.reviewer_id and x.state='APPROVED' and x.expires_at>now())
 or (select count(*) from public.profiles x where x.id in(e.owner_id,e.reviewer_id) and x.is_active=true)<>2
 then raise exception 'YW599 authority HOLD'; end if;
 if exists(select 1 from public.ywi_599_notification_claims where company_id=p_company and alert_id=a.id and enrollment_id<>e.id) then return jsonb_build_object('state','HOLD_PREVIOUS_ENROLLMENT_RECONCILIATION'); end if;
 select count(*) into n from public.ywi_599_notification_claims where company_id=p_company and alert_id=a.id;
 if n>=3 then return jsonb_build_object('state','HOLD_RETRY_EXHAUSTED'); end if;
 if n>0 then
 select x.claimed_at,y.state,x.source_sha256 into prev from public.ywi_599_notification_claims x left join public.ywi_599_notification_results y on y.claim_id=x.id where x.enrollment_id=e.id and x.alert_id=a.id order by x.attempt desc limit 1;
 if prev.source_sha256<>p_source_sha then raise exception 'YW599 source digest HOLD'; end if;
 if prev.state is distinct from 'DEFINITIVE_FAILURE' then return jsonb_build_object('state','HOLD_NO_RETRY'); end if;
 if prev.claimed_at+case when n=1 then interval '1 minute' else interval '5 minutes' end>now() then return jsonb_build_object('state','WAIT_BACKOFF'); end if;
 end if;
 insert into public.ywi_599_notification_claims(company_id,enrollment_id,alert_id,attempt,source_sha256) values(p_company,e.id,a.id,n+1,p_source_sha) returning * into c;
 return jsonb_build_object('state','ATOMIC_CLAIMED','companyId',p_company,'enrollmentId',e.id,'alertId',a.id,'nonce',c.id,'attempt',c.attempt,'claimedAt',c.claimed_at,'sourceSha256',c.source_sha256,'providerId',e.provider_id,'recipientRef',e.recipient_ref,'issueCode',a.issue_code);
end;$fn$;
revoke all on function public.ywi_599_claim_notification(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_599_claim_notification(uuid,uuid,uuid,text) to service_role;

-- Fresh final readback after the original separately witnessed rollback.
create table public.ywi_599_final_cutover_receipts(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id),
 execution_id uuid not null references public.ywi_598_execution_receipts(id),
 rollback_drill_id uuid not null references public.ywi_598_rollback_drills(id),
 owner_id uuid not null references auth.users(id),
 reviewer_id uuid not null references auth.users(id),
 auditor_id uuid not null references auth.users(id),
 challenge_nonce uuid not null unique,
 remote_receipt_id text not null unique check(remote_receipt_id ~ '^[A-Za-z0-9_-]{8,128}$'),
 source_receipt_ref text not null,
 challenge jsonb not null,
 response_payload jsonb not null,
 old_signature text not null check(old_signature ~ '^[0-9a-f]{64}$'),
 next_signature text not null check(next_signature ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null,
 check(owner_id<>reviewer_id and owner_id<>auditor_id and reviewer_id<>auditor_id),
 check(response_payload->>'state'='NEXT_ACTIVE_OLD_ACCEPTED'),
 unique(company_id,id)
);
alter table public.ywi_599_final_cutover_receipts enable row level security;
revoke all on public.ywi_599_final_cutover_receipts from public,anon,authenticated;
grant select,insert on public.ywi_599_final_cutover_receipts to service_role;
create trigger yw599_final_cutover_immutable before update or delete on public.ywi_599_final_cutover_receipts for each row execute function public.ywi_591_forbid_change();

create table public.ywi_599_tenant_recovery_audits(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id),
 owner_id uuid not null references auth.users(id),
 reviewer_id uuid not null references auth.users(id),
 cutover_id uuid not null references public.ywi_599_final_cutover_receipts(id),
 notification_claim_id uuid not null references public.ywi_599_notification_claims(id),
 audit_payload jsonb not null,
 audit_signature text not null check(audit_signature ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null,
 foreign key(company_id,cutover_id) references public.ywi_599_final_cutover_receipts(company_id,id),
 foreign key(company_id,notification_claim_id) references public.ywi_599_notification_claims(company_id,id),
 unique(cutover_id,notification_claim_id), check(owner_id<>reviewer_id)
);
alter table public.ywi_599_tenant_recovery_audits enable row level security;
revoke all on public.ywi_599_tenant_recovery_audits from public,anon,authenticated;
grant select,insert on public.ywi_599_tenant_recovery_audits to service_role;
create trigger yw599_recovery_audit_immutable before update or delete on public.ywi_599_tenant_recovery_audits for each row execute function public.ywi_591_forbid_change();
commit;
