-- YW582 · SOURCE-ONLY staging candidate. DO NOT APPLY TO PRODUCTION.
-- Depends on actual, independently accepted YW580/YW581 migrations.
-- No dynamic DDL, no production RLS/Storage alteration and no worker auto-enabled.
begin;
create table if not exists public.ywi_582_photo_integrity_receipts (
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null references public.ywi_581_job_photo_evidence(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 job_id uuid not null references public.work_orders(id) on delete restrict,
 private_object_key text not null,
 observed_sha256 text not null check(observed_sha256 ~ '^[0-9a-f]{64}$'),
 reported_sha256 text not null check(reported_sha256 ~ '^[0-9a-f]{64}$'),
 observed_bytes bigint not null check(observed_bytes between 16 and 10485760),
 verified_match boolean not null check(verified_match = (observed_sha256=reported_sha256)),
 observed_at timestamptz not null default statement_timestamp(),
 worker_id text not null check(length(worker_id) between 12 and 128),
 independent_receipt_ref text not null unique check(length(independent_receipt_ref) between 16 and 240),
 source_revision text not null check(source_revision ~ '^[a-f0-9]{40}$'),
 unique(photo_id,observed_sha256,worker_id),
 constraint ywi_582_private_path check(private_object_key ~
  '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);
create index if not exists ywi_582_integrity_by_company_job
 on public.ywi_582_photo_integrity_receipts(company_id,job_id,observed_at desc);
alter table public.ywi_582_photo_integrity_receipts enable row level security;
revoke all on public.ywi_582_photo_integrity_receipts from public,anon,authenticated;
grant select on public.ywi_582_photo_integrity_receipts to authenticated;
drop policy if exists ywi_582_receipt_owner_read on public.ywi_582_photo_integrity_receipts;
create policy ywi_582_receipt_owner_read on public.ywi_582_photo_integrity_receipts
 for select to authenticated using (exists(
 select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- Integrity bytes must be read in a separate private server-side worker, with
-- original photo record and original job rechecked in the SAME company before
-- a privileged service actor writes the receipt. Never trust client SHA alone.

create table if not exists public.ywi_582_retention_reviews (
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null references public.ywi_581_job_photo_evidence(id) on delete restrict,
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 job_id uuid not null references public.work_orders(id) on delete restrict,
 action text not null default 'review_only' check(action='review_only'),
 legal_hold boolean not null default true,
 active_dispute boolean not null default true,
 proposed_at timestamptz not null default statement_timestamp(),
 proposed_by text not null check(length(proposed_by) between 12 and 128),
 independent_review_ref text not null unique check(length(independent_review_ref) between 16 and 240),
 -- This is a non-destructive review candidate, NOT deletion authority.
 delete_authorized boolean not null default false check(delete_authorized=false)
);
alter table public.ywi_582_retention_reviews enable row level security;
revoke all on public.ywi_582_retention_reviews from public,anon,authenticated;
grant select on public.ywi_582_retention_reviews to authenticated;
drop policy if exists ywi_582_retention_owner_read on public.ywi_582_retention_reviews;
create policy ywi_582_retention_owner_read on public.ywi_582_retention_reviews
 for select to authenticated using (exists(
 select 1 from public.ywi_companies c
 where c.id=company_id and c.owner_user_id=(select auth.uid())));
-- No browser insert/update/delete, no public Storage read, no automatic
-- retention delete. Independent custodian must verify legal holds, refunds,
-- safety records, audit scope and documented authorization before ANY purge.

create or replace function public.ywi_582_guard_append_only()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'YW582 immutable custody history; create a new review receipt';
end $$;
revoke all on function public.ywi_582_guard_append_only()
 from public,anon,authenticated;
drop trigger if exists ywi_582_no_change_photo_integrity
 on public.ywi_582_photo_integrity_receipts;
create trigger ywi_582_no_change_photo_integrity
 before update or delete on public.ywi_582_photo_integrity_receipts
 for each row execute function public.ywi_582_guard_append_only();
drop trigger if exists ywi_582_no_change_retention_review
 on public.ywi_582_retention_reviews;
create trigger ywi_582_no_change_retention_review
 before update or delete on public.ywi_582_retention_reviews
 for each row execute function public.ywi_582_guard_append_only();
commit;
