-- YW573 STAGING-ONLY DESIGN DRAFT. NEVER AUTO-APPLY TO PRODUCTION.
-- Requires separate DBA/owner approval, verified migrations YW556,561,563,566,567,572,
-- real backup, RLS review, role design and *staging-only* concurrency/replay tests.
-- Private server-only transaction, no browser/anon/authenticated or SECURITY DEFINER RPC.
begin;
set local lock_timeout = '5s';
create schema if not exists ywi_security_573;
revoke all on schema ywi_security_573 from public, anon, authenticated;
create table if not exists ywi_security_573.original_disposition (
 id bigint generated always as identity primary key,
 app_id text not null check (app_id = 'YW'),
 tenant_id uuid not null,
 request_id uuid not null,
 provider_receipt_id uuid not null,
 disposition_id uuid not null,
 witness_receipt_id uuid not null,
 source_payload_sha256 text not null check (source_payload_sha256 ~ '^[0-9a-f]{64}$'),
 witness_sha256 text not null check (witness_sha256 ~ '^[0-9a-f]{64}$'),
 registry_sha256 text not null check (registry_sha256 ~ '^[0-9a-f]{64}$'),
 source_revision text not null check (source_revision ~ '^[0-9a-f]{40}$'),
 recorded_at timestamptz not null default now(),
 unique(app_id,tenant_id,disposition_id),
 unique(app_id,tenant_id,witness_receipt_id),
 unique(app_id,tenant_id,witness_sha256),
 unique(app_id,tenant_id,source_payload_sha256),
 foreign key (app_id,tenant_id,source_payload_sha256)
  references ywi_security_572.replay_custody (app_id,tenant_id,payload_sha256)
  on delete restrict
);
alter table ywi_security_573.original_disposition enable row level security;
alter table ywi_security_573.original_disposition force row level security;
revoke all on ywi_security_573.original_disposition from public, anon, authenticated;
revoke all on all tables in schema ywi_security_573 from public;
-- No RLS policies or grants for public/anon/authenticated.
-- Only separately enrolled backend role with narrowly scoped INSERT/SELECT authority
-- may verify an already durably committed ywi_security_572 source row and insert
-- a disposition in ONE transaction; identities remain company-scoped.
-- Two independently pinned signed witness receipts and exact original source binding
-- must be verified server-side before any INSERT. Database schema alone does not
-- perform signature verification or create an owner/master closure decision.
-- No UPDATE / DELETE / TRUNCATE grants; append-only evidence.
commit;
-- REQUIRED EXTERNAL APPROVAL:
-- [ ] Verified preceding migrations, backup/PITR and DB provenance
-- [ ] Independent original owner and custodian signer fingerprints from trusted registry
-- [ ] App/tenant RLS and least-privilege grants for a dedicated server identity
-- [ ] Concurrency tests: exact source receipt and independent two signatures
-- [ ] Replay, foreign company, revoked signer, expired witness, invalid SLA pair
-- [ ] Confirm no Data API, browser RPC, PUBLIC/anon/authenticated access
-- [ ] Separate owner/DBA written production approval AFTER staging acceptance
