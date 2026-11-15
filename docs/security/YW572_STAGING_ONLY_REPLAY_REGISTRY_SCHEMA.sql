-- YW572 STAGING-ONLY DESIGN DRAFT. NEVER AUTO-APPLY OR RUN ON PROD.
-- Prerequisites: authorized DBA, original migrations YW556/YW561/YW563/YW566
-- and YW567 restored/verified in order; separate staging project and PITR/backup.
-- No SECURITY DEFINER functions, no Data API exposure, no browser write path.
-- Apply only during an independently approved staging ceremony with schema advisor.
begin;
set local lock_timeout = '5s';
create schema if not exists ywi_security_572;
revoke all on schema ywi_security_572 from public, anon, authenticated;
-- Deployment is permitted only using a server-side database account with the
-- separately approved privilege. Never grant this schema to anon or frontend JWTs.
create table if not exists ywi_security_572.issuer_registry (
 registry_id uuid not null,
 version integer not null check (version > 0),
 registry_sha256 text not null check (registry_sha256 ~ '^[0-9a-f]{64}$'),
 manifest_json jsonb not null,
 owner_witness_id text not null,
 custodian_witness_id text not null,
 witnessed_at timestamptz not null,
 created_at timestamptz not null default now(),
 primary key (registry_id,version),
 unique(registry_sha256),
 check (owner_witness_id <> custodian_witness_id)
);
alter table ywi_security_572.issuer_registry enable row level security;
alter table ywi_security_572.issuer_registry force row level security;
revoke all on ywi_security_572.issuer_registry from public, anon, authenticated;
-- Independent governance signatures MUST be reverified by the server before INSERT.
-- The registry table does not itself confer signer authority or Master CONNECTED.
create table if not exists ywi_security_572.replay_custody (
 id bigint generated always as identity primary key,
 app_id text not null check (app_id in (
  'ai-data-platform','rosevear-ai-hub','rosevear-comms-hub',
  'iCamp','YW','devilndove','rosiedazzlers')),
 tenant_id uuid not null,
 issuer_id text not null,
 key_id text not null,
 nonce uuid not null,
 disposition_id uuid not null,
 payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
 registry_sha256 text not null check (registry_sha256 ~ '^[0-9a-f]{64}$'),
 source_revision text not null check (source_revision ~ '^[0-9a-f]{40}$'),
 recorded_at timestamptz not null default now(),
 unique(app_id,tenant_id,nonce),
 unique(app_id,tenant_id,disposition_id),
 unique(app_id,tenant_id,payload_sha256)
);
alter table ywi_security_572.replay_custody enable row level security;
alter table ywi_security_572.replay_custody force row level security;
revoke all on ywi_security_572.replay_custody from public, anon, authenticated;
revoke all on schema ywi_security_572 from public;
revoke all on all tables in schema ywi_security_572 from public;
-- No policies: public/anon/authenticated are denied. Trusted backend admission
-- uses an independently approved server-only DB role with explicit INSERT grant,
-- never owner browsers, Supabase anon/publishable keys, or a SECURITY DEFINER RPC.
-- INSERT ... ON CONFLICT DO NOTHING RETURNING payload_sha256 is atomic and does
-- not expose whether another tenant has a receipt. Caller sees only REPLAY/HOLD.
-- No UPDATE, DELETE or TRUNCATE grants; append-only retention and owner/DBA
-- recovery/retention decision must be explicitly approved. service_role bypasses
-- RLS and MUST remain server-side; do not deploy any public RPC for this table.
commit;

-- PRE-PRODUCTION APPROVAL CHECKLIST (not SQL instructions):
-- [ ] Verified independent issuer fingerprints and two human custody approvals
-- [ ] Dedicated authenticated *server-side* DB identity and least-privilege GRANT
-- [ ] No Data API exposure; RLS + no client grants tested using anon/authenticated
-- [ ] Original migration chain independently proven and applied in test-only staging
-- [ ] Concurrent same-nonce, same-disposition, duplicate-payload and different tenant
--     insert tests; no false INSERTED on a SQL error or connection failure
-- [ ] Retention, backup, recovery and incident reviewer sign-off
-- [ ] Production DBA explicitly authorizes a reviewed migration separately
