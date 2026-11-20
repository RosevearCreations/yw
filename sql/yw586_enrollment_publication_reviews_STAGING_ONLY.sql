-- YW586: STAGING-ONLY owner + independent reviewer enrollment and
-- tenant site publication-review proposals. NO PRODUCTION MIGRATION.
-- No customer access, publishing, Job, photo, payment, media, or automation grants.
-- Original YW585 customer membership and YW584 company site sources required.
-- Owner's $0 additional-staging-cost instruction forbids provisioning a new paid branch.
begin;

create table if not exists public.ywi_586_customer_enrollment_reviews (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 client_id uuid not null,
 customer_user_id uuid not null,
 owner_reviewer_id uuid not null references auth.users(id) on delete restrict,
 independent_reviewer_id uuid references auth.users(id) on delete restrict,
 review_state text not null default 'awaiting_second_review'
  check(review_state in ('awaiting_second_review','rejected','approved_for_staging_only')),
 original_link_evidence_digest text not null check(original_link_evidence_digest ~ '^[0-9a-f]{64}$'),
 source_sha text not null check(source_sha ~ '^[0-9a-f]{40}$'),
 review_request_id uuid not null unique,
 expires_at timestamptz not null,
 created_at timestamptz not null default statement_timestamp(),
 reviewed_at timestamptz,
 foreign key(company_id,client_id,customer_user_id) references
  public.ywi_585_customer_memberships(company_id,client_id,customer_user_id) on delete restrict,
 constraint ywi586_identity_second_witness check (
   (review_state='awaiting_second_review' and independent_reviewer_id is null and reviewed_at is null) or
   (review_state in ('rejected','approved_for_staging_only')
    and independent_reviewer_id is not null
    and owner_reviewer_id <> independent_reviewer_id
    and reviewed_at is not null)
 ),
 constraint ywi586_enrollment_not_self_approved check (
  owner_reviewer_id <> customer_user_id and
  (independent_reviewer_id is null or independent_reviewer_id <> customer_user_id)
 )
);
create index if not exists ywi586_customer_review_scope
 on public.ywi_586_customer_enrollment_reviews(company_id,created_at desc);
alter table public.ywi_586_customer_enrollment_reviews enable row level security;
revoke all on public.ywi_586_customer_enrollment_reviews from public,anon,authenticated;
grant select on public.ywi_586_customer_enrollment_reviews to authenticated;
drop policy if exists ywi586_customer_review_owner_read on public.ywi_586_customer_enrollment_reviews;
create policy ywi586_customer_review_owner_read
 on public.ywi_586_customer_enrollment_reviews for select to authenticated
 using (
  exists(select 1 from public.ywi_companies c
   where c.id=ywi_586_customer_enrollment_reviews.company_id
   and c.owner_user_id=(select auth.uid()))
 );
-- NO customer insert/update/delete privileges or RPC. Independent
-- server custodian must verify Auth identity, YW422 original company/client
-- binding, actual company owner, independent human review and current
-- account revocation before any membership activation in staging.

create table if not exists public.ywi_586_site_publication_reviews (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_584_company_site_drafts(company_id) on delete restrict,
 reviewer_owner_id uuid not null references auth.users(id) on delete restrict,
 independent_reviewer_id uuid references auth.users(id) on delete restrict,
 review_state text not null default 'pending'
  check(review_state in ('pending','rejected','approved_for_staging_only')),
 reviewed_snapshot_sha256 text not null check(reviewed_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
 approved_theme text not null check(approved_theme in
  ('standard','futuristic','angular','forest','gilded')),
 review_request_id uuid not null unique,
 checked_external_url boolean not null default false,
 domain_ownership_verified boolean not null default false,
 privacy_notice_verified boolean not null default false,
 content_consents_verified boolean not null default false,
 production_publication_authorized boolean not null default false
  check(production_publication_authorized=false),
 created_at timestamptz not null default statement_timestamp(),
 reviewed_at timestamptz,
 constraint ywi586_publish_independent_review check(
  (review_state='pending' and independent_reviewer_id is null and reviewed_at is null) or
  (review_state in ('rejected','approved_for_staging_only')
   and independent_reviewer_id is not null and
   independent_reviewer_id <> reviewer_owner_id and reviewed_at is not null)
 )
);
create index if not exists ywi586_publish_company_latest
 on public.ywi_586_site_publication_reviews(company_id,created_at desc);
alter table public.ywi_586_site_publication_reviews enable row level security;
revoke all on public.ywi_586_site_publication_reviews from public,anon,authenticated;
grant select on public.ywi_586_site_publication_reviews to authenticated;
drop policy if exists ywi586_publish_owner_read on public.ywi_586_site_publication_reviews;
create policy ywi586_publish_owner_read
 on public.ywi_586_site_publication_reviews for select to authenticated
 using(exists(select 1 from public.ywi_companies c
  where c.id=ywi_586_site_publication_reviews.company_id
  and c.owner_user_id=(select auth.uid())));
-- Even an approved staging-only review does NOT publish a tenant website;
-- no public route, domain assignment, global index, sponsored listing,
-- booking, pricing, consent override or external DNS write exists here.

create or replace function public.ywi_586_review_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'YW586 review ledger append-only; independent custodian required';
end $$;
revoke all on function public.ywi_586_review_immutable()
 from public,anon,authenticated;
drop trigger if exists ywi586_customer_review_no_mutation
 on public.ywi_586_customer_enrollment_reviews;
create trigger ywi586_customer_review_no_mutation
 before update or delete on public.ywi_586_customer_enrollment_reviews
 for each row execute function public.ywi_586_review_immutable();
drop trigger if exists ywi586_site_review_no_mutation
 on public.ywi_586_site_publication_reviews;
create trigger ywi586_site_review_no_mutation
 before update or delete on public.ywi_586_site_publication_reviews
 for each row execute function public.ywi_586_review_immutable();

comment on table public.ywi_586_customer_enrollment_reviews is
 'Staging-only owner/independent-review audit; NO membership activation, no public signup.';
comment on table public.ywi_586_site_publication_reviews is
 'Staging-only website content review; NO public publication or DNS authority.';
commit;
