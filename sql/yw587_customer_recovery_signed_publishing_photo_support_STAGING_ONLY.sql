-- YW587 • INDEPENDENT STAGING ONLY
-- Existing YW420–586 original records & owner-reviewed verification required.
-- DO NOT run on production without approved migration, backup, RLS trials,
-- real crew devices, private storage and tenant/DBA acceptance.
-- This staged ledger is NOT the canonical signed Master receiver.
begin;

create table if not exists public.ywi_587_customer_recovery_reviews (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,client_id uuid not null,customer_user_id uuid not null,
 requested_by_owner uuid not null references auth.users(id) on delete restrict,
 independent_reviewer_id uuid not null references auth.users(id) on delete restrict,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 review_state text not null default 'pending'
  check(review_state in ('pending','verified_staging_only','declined','expired')),
 account_reactivated boolean not null default false check(account_reactivated=false),
 external_notice_sent boolean not null default false check(external_notice_sent=false),
 session_reset_executed boolean not null default false check(session_reset_executed=false),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(company_id,client_id,customer_user_id) references
  public.ywi_585_customer_memberships(company_id,client_id,customer_user_id) on delete restrict,
 check(requested_by_owner<>customer_user_id and
       independent_reviewer_id<>customer_user_id and
       independent_reviewer_id<>requested_by_owner)
);
alter table public.ywi_587_customer_recovery_reviews enable row level security;
revoke all on public.ywi_587_customer_recovery_reviews from public,anon,authenticated;
grant select on public.ywi_587_customer_recovery_reviews to authenticated;
drop policy if exists ywi587_recovery_owner_read on public.ywi_587_customer_recovery_reviews;
create policy ywi587_recovery_owner_read
 on public.ywi_587_customer_recovery_reviews for select to authenticated using(
 exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid()))
);
-- Separate trusted owner-authorized server workflow must perform actual
-- account recovery, session invalidation and new sign-in enrollment.

create table if not exists public.ywi_587_publishing_reviews (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_584_company_site_drafts(company_id) on delete restrict,
 original_review_id uuid not null references public.ywi_586_site_publication_reviews(id) on delete restrict,
 source_sha text not null check(source_sha ~ '^[0-9a-f]{40}$'),
 site_digest_sha256 text not null check(site_digest_sha256 ~ '^[a-f0-9]{64}$'),
 signed_canonical_sha256 text not null check(signed_canonical_sha256 ~ '^[a-f0-9]{64}$'),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 owner_key_fingerprint_sha256 text not null check(owner_key_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_key_fingerprint_sha256 text not null check(reviewer_key_fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
 owner_signature_p1363 text not null check(char_length(owner_signature_p1363) between 84 and 90),
 reviewer_signature_p1363 text not null check(char_length(reviewer_signature_p1363) between 84 and 90),
 review_state text not null default 'signed_source_only' check(review_state='signed_source_only'),
 production_site_published boolean not null default false check(production_site_published=false),
 created_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null,
 unique(company_id,original_review_id,signed_canonical_sha256),
 check(owner_user_id<>reviewer_user_id)
);
alter table public.ywi_587_publishing_reviews enable row level security;
revoke all on public.ywi_587_publishing_reviews from public,anon,authenticated;
grant select on public.ywi_587_publishing_reviews to authenticated;
drop policy if exists ywi587_publishing_owner_read on public.ywi_587_publishing_reviews;
create policy ywi587_publishing_owner_read
 on public.ywi_587_publishing_reviews for select to authenticated using(
 exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid()))
);
-- Signatures MUST be verified using an independent preenrolled P-256 trust
-- registry. A client-supplied public key is NOT trusted. A signed review
-- does not authorize public DNS/site publication.

create table if not exists public.ywi_587_photo_support_cases (
 id uuid primary key,
 company_id uuid not null,client_id uuid not null,client_site_id uuid not null,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 attachment_id uuid not null,
 anonymous_device_reference uuid not null,
 failure_class text not null check(failure_class in
  ('upload_timeout','offline_reconnect','storage_permission_denied',
   'processing_delay','hash_mismatch','unknown')),
 original_event_id uuid not null,
 photo_original_sha256 text not null check(photo_original_sha256 ~ '^[a-f0-9]{64}$'),
 private_storage_required boolean not null default true check(private_storage_required=true),
 tenant_photo_consent_verified boolean not null default false,
 category text not null default 'photo_pending' check(category='photo_pending'),
 case_state text not null default 'reported' check(case_state='reported'),
 reported_at timestamptz not null,
 created_at timestamptz not null default statement_timestamp(),
 foreign key(company_id,client_id,client_site_id) references
  public.ywi_company_site_links_422(company_id,client_id,client_site_id) on delete restrict,
 unique(company_id,attachment_id,original_event_id),
 unique(company_id,id)
);
alter table public.ywi_587_photo_support_cases enable row level security;
revoke all on public.ywi_587_photo_support_cases from public,anon,authenticated;
grant select on public.ywi_587_photo_support_cases to authenticated;
drop policy if exists ywi587_photo_case_owner_only on public.ywi_587_photo_support_cases;
create policy ywi587_photo_case_owner_only
 on public.ywi_587_photo_support_cases for select to authenticated using(
 exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid()))
);
-- Before append, separately verify original work_order company_id, client_id,
-- client_site_id, active service entitlement, assigned crew + dispatcher
-- authority, photo consent, private bucket, evidence bytes and SHA-256.
-- Do NOT let a browser or vendor Shell provision case rows directly.

create table if not exists public.ywi_587_photo_case_events (
 id uuid primary key,
 company_id uuid not null,
 case_id uuid not null,
 event_key uuid not null,
 kind text not null check(kind in (
  'crew_photo_pending','dispatcher_case_opened','shell_incident_ack',
  'shell_fault_diagnosed','support_retry_requested','private_photo_receipt',
  'crew_photo_visible','dispatcher_recovery_confirmed','shell_incident_closed')),
 source_role text not null check(source_role in
  ('crew','dispatcher','shell_support','storage_worker')),
 source_actor_id uuid not null,
 recorded_at timestamptz not null,
 payload_redacted jsonb not null check(jsonb_typeof(payload_redacted)='object'),
 source_sha text not null check(source_sha ~ '^[a-f0-9]{40}$'),
 foreign key(company_id,case_id) references
  public.ywi_587_photo_support_cases(company_id,id) on delete restrict,
 unique(company_id,case_id,event_key),
 unique(company_id,case_id,kind)
);
alter table public.ywi_587_photo_case_events enable row level security;
revoke all on public.ywi_587_photo_case_events from public,anon,authenticated;
grant select on public.ywi_587_photo_case_events to authenticated;
drop policy if exists ywi587_photo_event_owner_only on public.ywi_587_photo_case_events;
create policy ywi587_photo_event_owner_only
 on public.ywi_587_photo_case_events for select to authenticated using(
 exists(select 1 from public.ywi_companies c where c.id=company_id
  and c.owner_user_id=(select auth.uid()))
);
-- REDACTED Shell inspection will require separately authenticated
-- Sysop, source-signed sanitized references, independent per-case owner,
-- SLA, last valid signal age, no PII/photo bytes/financial data and
-- signed Master delivery (separate future integration). NOT a public view.

create or replace function public.ywi_587_readonly_ledger_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'YW587 immutable review/incident evidence; use independently authorized append only';
end $$;
revoke all on function public.ywi_587_readonly_ledger_guard() from public,anon,authenticated;
drop trigger if exists ywi587_photo_case_no_mutation on public.ywi_587_photo_support_cases;
create trigger ywi587_photo_case_no_mutation before update or delete
 on public.ywi_587_photo_support_cases for each row execute function public.ywi_587_readonly_ledger_guard();
drop trigger if exists ywi587_photo_event_no_mutation on public.ywi_587_photo_case_events;
create trigger ywi587_photo_event_no_mutation before update or delete
 on public.ywi_587_photo_case_events for each row execute function public.ywi_587_readonly_ledger_guard();
drop trigger if exists ywi587_pub_review_no_mutation on public.ywi_587_publishing_reviews;
create trigger ywi587_pub_review_no_mutation before update or delete
 on public.ywi_587_publishing_reviews for each row execute function public.ywi_587_readonly_ledger_guard();
drop trigger if exists ywi587_recovery_review_no_mutation on public.ywi_587_customer_recovery_reviews;
create trigger ywi587_recovery_review_no_mutation before update or delete
 on public.ywi_587_customer_recovery_reviews for each row execute function public.ywi_587_readonly_ledger_guard();
comment on table public.ywi_587_photo_case_events is
 'STAGING-ONLY append-only original tenant technical event ledger; NOT accepted live photo custody';
commit;
