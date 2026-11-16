# YW574 — Ordered YW556–573 Migration Provenance, Staging Safety and Production Parity Ceremony
2026-11-16 | Yard Workers | Source-only design and review gate

## Build status and authority boundary

Predecessor YW573 reached GitHub main/dev commit 2d0097dc03e4e83fcd6cbd69ddae16ca07266940; the live yw-alpha.vercel.app Production alias returned Vercel READY at that same SHA when checked. YW574 code and documentation release is NOT a SQL migration ceremony. A Vercel GREEN code release is separate from verified database provenance, original signers, owner/DBA migration authority, master CONNECTED and customer delivery. All of those require independent original evidence.

**Verified live database inspection on 2026-11-16 (read-only Supabase account YardWeasels):**
- Only the known YardWeasels production project was present on that connected Supabase account; no independently registered YW staging project was identified. A different connected account lists iCamp and RosevearCreations projects; do NOT treat either as YW staging by default.
- Supabase migration history exists for older baseline schema, but an exact authorized YW556–573 migration lineage was not established.
- Read-only pg_class query for relations tagged 556, 561, 563, 566, 567 and private security_572/_573 schemas returned no objects. This is a *negative discovery*, not proof of every earlier schema's state.
- The private ywi_security_572.replay_custody and ywi_security_573.original_disposition relations are not installed. Do NOT auto-apply the SQL designs.

## Source inventory and order

YW556–YW567 each have original SQL files in sql/landscape_*; YW568–YW571 are source-only/readback builds (no new SQL artifact in the ordered inventory). YW572 and YW573 are DESIGN ONLY private staging schema drafts, never automatic migrations. The reviewer MUST preserve all historical application migrations and check dependencies before attempting replay.

The read-only Node script scripts/yw574-migration-provenance.mjs computes SHA-256 for each of these exact source paths, in order. The check script scripts/yw574-migration-provenance-check.mjs deliberately fails any reversed, duplicated, missing, altered or unregistered source, even with otherwise valid shape.

## Required *staging-only* ceremony (not performed by this build)

1. Provision and register a truly isolated staging Supabase project (NOT the YW Production project, Rosie, iCamp or RosevearCreations). Have the authorized owner/DBA record its exact ref, environment registration, hosting region and non-production snapshot.
2. Independently inventory current production database objects and exact migration history; do NOT infer from repository filenames that files were applied. Obtain a backup and independently demonstrate PITR/restore in an isolated environment, with time-stamped evidence.
3. Review the original YW556–YW567 SQL (plus earlier YW553–555 dependencies) in source order, with schema advisor, permission, RLS, owner tenant, function EXECUTE, role grants, replay/unique constraints and privileges. Record and resolve any schema/hash drift instead of force applying.
4. Validate YW572/YW573 private SQL plans on paper. After independent approval, execute only the explicitly reviewed staging-only migration through an authorized DBA controlled process. This repository build intentionally NEVER runs migrations, Supabase SQL writes, CI migration commands, or secret-bearing scripts.
5. On isolated staging: prove anon/authenticated cannot access private ledger schemas, prove a dedicated least-privilege server identity, immutable append-only receipt custody, two independently pinned human witnesses, fresh signed source and renewal observations, cross-tenant denial, nonce/revision replay rejection and transaction rollback on failure. No test signature can authorize real closure.
6. Compare staging parity with production schema and backup baseline; record original signer fingerprints, reviewer identity, exact source commit, SHA256 per source file, environment-ref proof, SQL logs, migration history, schema drift review, PITR/restore proof and explicit independent owner/DBA written decision. State all missing evidence as HOLD.
7. **Separate production decision only:** a production migration requires new explicitly authorized signed ceremony, independent security review and fresh re-read. No production write is authorized by any YW574 source package, CI pass, preview READY, or staging review.

## Build 408 independent synchronization contract

YW574 supports **1.1** additive protocol alongside **1.0** peers, without seven-app lockstep. Two independent layers exist:
- Contract negotiation is pure local function negotiateIndependentSync574. Only exact known capability IDs, audience and tenant, current authorization, purpose-bound consent, compatible major version and available peer can allow *contract-compatible* state. It DOES NOT send traffic or infer delivery/ACK.
- Real authenticated, encrypted and signed cross-app communication still requires the original Build407/408 independently enrolled service issuer, audience, nonce custody, role/capability and tenant checks; no raw secret or direct peer database synchronization.

If YW/iCamp/AI Data Platform are held by Vercel quotas, unrelated Rosevear AI Hub, Rosevear Comms Hub, Devil n Dove and Rosie Dazzlers **may release independently**. A missing peer holds only that dependent operation. No Vercel or GitHub secrets are mirrored between apps. Breaking contract changes require a major version bump and explicit peer handoff.

## Deployment and acceptance

Only release this source-only build through reviewed feature → dev → main with GitHub protected source/auth/browser test success, exact Vercel preview READY at each reviewed SHA, exact live main Vercel Production READY alias match, post-push release truth and no-force dev/main convergence. If Vercel quota blocks any gate, leave main on the last verified release.

A reviewer may run these **without network and without secrets**:
- node scripts/yw574-migration-provenance.mjs
- node scripts/yw574-migration-provenance-check.mjs
- npm run test:yw574-migration-provenance

Do not run SQL listed in old migrations on production. The file docs/security/YW574_STAGING_PARITY_READ_ONLY.sql provides SELECT-only catalog inspection examples, not an authority to apply anything.

**Next proposed:** YW575 — Unified Product/Company Role Segregation, Admin HR Identity Review and Cross-Device Session Revocation. Proposed YW575–YW581 remain seven numbered items, not a claim of overall app completion.
