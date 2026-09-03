# Yard Weasels Inc. Operations Platform

## Build 187 active authority

**Build 187 — Staging acceptance scenario catalog + prerequisite truth convergence — ACTIVE IN SOURCE ONLY.**

Current release boundary:

- live database remains **Schema 186 / 186 CURRENT**;
- final clean Build 186 `main` is **`02734b2168511b4faa54bf5f7fdea92b1d8f5b3d`**, exact-main **Run #160 / `33711102071` GREEN**, release evidence **row 20**;
- original Build 186 product merge proof remains `046b9289acbe79c2a4feb4606a42dc50a8cad33d`, Run #154 / `33710506232`, evidence row 19;
- Build 187 source branch is **`schema-187-staging-scenario-catalog`**;
- exact 43,674-byte first Schema 187 migration commit `9483d9fb38143ce602bc406a6ca02cf22490ac2b` passed an outer-transaction rollback proof with SHA-256 `a3758b9733487cb90e6dee6652045a47c8c29d0cd30f9c7a5f824dbd73d6404e`;
- the rollback proof seeded all six Operations catalog cases pending, rejected premature finalization, prevented callers from weakening blocking/evidence metadata, allowed explicit evidence -> finalize -> human signoff, and verified `operations_cockpit_live` stayed open;
- Schema 187 has **not** been applied live yet;
- Finance posting execution remains **OFF**; provider/payment mutation remains **OFF**; Production promotion remains **manual**.

Build 187 converts the six real `staging_acceptance` rails into machine-readable, fail-closed evidence checklists without inventing a separate evidence database. New Schema 187 runs seed every enabled catalog case as `pending`; runner-controlled cases may be recorded by the dedicated staging runner, human cases can only be recorded explicitly through Admin > I.T., finalization refuses pending cases and treats skipped blocking cases as failures, and signoff remains evidence only. **No Build 187 path auto-closes a business rail.**

The six cataloged rails are Operations Cockpit, quote/contact intake, live job updates, customer live-update notifications, service-execution proof/costing, and supervisor closeout/customer signoff/invoice follow-up. A dedicated non-production YardWeasels Supabase project is still not configured, so real staging execution remains closed rather than falling back to Production.

## Build 186 final release authority

**Build 186 — Staging acceptance control plane + evidence runner modernization — COMPLETE.**

Final verified product authority:

- live database **Schema 186 / 186 CURRENT**;
- merged `main` product SHA **`046b9289acbe79c2a4feb4606a42dc50a8cad33d`**;
- exact-main **Run #154 / `33710506232` — GREEN** across all static gates and six rendered browser suites;
- canonical release-source evidence **row 19**;
- `admin-staging-acceptance` **v1 ACTIVE / JWT enabled**;
- Schema 186 staging-security assertions **7 / 7 PASS**;
- application release authority **GREEN**; repository enforcement remains separately **AMBER** because `main` is unprotected;
- Finance posting execution remains **OFF**; provider/payment mutation remains **OFF**; Production promotion remains **manual**;
- Build 186 evidence and human signoff **never auto-close business staging rails**.

Current scorecard truth after Build 186: **40 rails / 29 complete / 11 open**, all **11 / 11 classified**, **0 unclassified**, **0 proof drift**. Remaining open work is **6 staging acceptance**, **2 accounting acceptance**, **1 provider acceptance**, and **2 content approval** rails. Human pending remains **11** and external pending **1**; autonomous feature-followup pending is **0**.

No separate YardWeasels Supabase staging project is currently configured, so Build 186 did not fabricate live staging evidence or fall back to Production. Build 187 is the selected technical follow-up: it catalogs the evidence/prerequisite truth needed to execute those six staging rails safely without auto-completing them.

## Historical release anchors retained for audit

- **Build 184 / Schema 184 — COMPLETE product proof:** `main` `613118f52fcbad147a56226ccdeabf3a64a1c8b0`, exact-main Run #136 (`33698631685`) — SUCCESS.
- **Build 183 / Schema 183 — COMPLETE prior clean authority:** `main` `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, exact-main Run #132 (`33697274220`) — GREEN.

These historical anchors remain audit evidence only; current live authority is Build 186 / Schema 186 with exact-main release proof recorded.

**Current live authority:** Schema `186 / 186` — **Build 186 COMPLETE**  
**Build 186 product checkpoint:** `046b9289acbe79c2a4feb4606a42dc50a8cad33d`, exact-main Run #154 (`33710506232`) — GREEN  
**Build 186 final clean release evidence:** row `20` in `it_release_source_evidence`  
**Runtime:** `equipment-scan-manage` v1 ACTIVE / JWT enabled; `admin-it-control` v14 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider/payment mutation OFF; Production promotion manual  
**Build 186:** **COMPLETE** on `main`; final clean Run #160 and release evidence row 20 are GREEN  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** stays inside Admin/manage and is never a fifth module.

## Architecture progression

- Schemas 159–174 established module permissions, Admin break-glass, I.T. Readiness, permission-driven loading, Shared Core, fail-closed cross-module contracts/events, canonical job-completion events, Finance intake/review, and dependency convergence.
- Schema 175 added separate posting approval, idempotency, provenance, and execution guards.
- Schema 176 mapped Finance candidates into the existing AR/GL accounting engine with read-only preflight.
- Schema 177 installed paired execution/recovery/reversal behind a private execution release that remains **OFF**.
- Schema 178 added Finance lifecycle, blocker, reconciliation, and Admin → I.T. pipeline health.
- Schema 179 / Build 179 — **COMPLETE**: Finance permission matrix, direct-bypass guards, synthetic non-persistent/browser-only acceptance, JWT hardening, and release gate.
- Schema 180 / Build 180 — **COMPLETE**: human accountant/bookkeeper mapping review and immutable audit over the canonical mapping table.
- Schema 181 / Build 181 — **COMPLETE**: human-review aging, technical drift, and posting-preflight reconciliation observability.
- Schema 182 — **COMPLETE maintenance repair**: release-authority marker convergence only.
- Schema 183 / Build 183 — **COMPLETE**: chart-account decision support and DB-side structural approval compatibility guard.
- Schema 184 / Build 184 — **COMPLETE**: I.T. scorecard truth convergence, immutable historical completion evidence, and explicit blocker classification.
- Schema 185 / Build 185 — **COMPLETE**: equipment barcode/QR camera scanning, canonical equipment-master linkage, exact identifier resolution, idempotent scan/custody provenance, and phone/desktop rendered acceptance.

## Build 185 verified closure

Build 185 closed the only autonomous `feature_followup` rail without inventing equipment data or bypassing Jobs ownership.

Verified final state:

- database **185 / 185 CURRENT**;
- exact clean `main` **`d126ddfb403d31faba1d9826df3e0ad1e0d58fd7`**;
- exact-main Run **#149 / `33705924533` GREEN**;
- final release evidence row **18**;
- equipment scanning/custody security assertions **7 / 7 PASS**;
- `equipment_scan_event` remains **Jobs/create**;
- physical `equipment_items` link explicitly to canonical UUID `equipment_master`;
- exact private identifier registry covers equipment code, asset tag, serial number, QR and barcode values;
- identifier collisions fail closed rather than selecting a first match;
- scan and custody idempotency/provenance are enforced;
- camera input is untrusted until protected server resolution;
- permanent desktop/manual fallback remains available;
- `equipment-scan-manage` **v1 ACTIVE / JWT enabled**;
- equipment operational tables remained empty during release proof; no fake business records were persisted;
- Build 185 and `equipment_scan_custody_live` rails are complete with immutable I.T. evidence;
- repository returned to exactly one branch: `main`.

Finance posting execution stayed OFF, Stripe/PayPal/provider/payment mutation stayed OFF, and Production was not promoted.

## Build 186 delivered boundary

**Build 186 — Staging acceptance control plane + evidence runner modernization** is complete on `main`.

Build 185 removed the last autonomous feature-followup rail. Remaining business readiness items require real staging, accounting, provider, or content evidence. Build 186 therefore improves how that evidence is executed and recorded instead of pretending those human gates are complete.

The bounded design reuses the existing `operations_staging_test_runs`, `operations_staging_test_results`, `operations_staging_fixture_sets`, and `operations_staging_fixture_records` authorities. It does not create a parallel acceptance database.

Build 186 delivered:

1. exact target-rail, source-SHA, workflow-run and schema binding for staging evidence;
2. service-private staging run/result/fixture tables;
3. service-role-only staging fixture and acceptance RPCs;
4. a production-project-ref guard so staging automation cannot target the YardWeasels Production Supabase project;
5. automated/runtime/browser evidence recording with blocking-case status;
6. explicit human approve/reject evidence when the rail requires human staging acceptance;
7. **no automatic scorecard rail closure**, even after automated and human evidence pass;
8. Admin → I.T. visibility through a protected Admin/manage surface;
9. a current Schema 186 marker in the same migration so release authority cannot lag the feature schema;
10. source and rendered browser gates before Schema 186 is applied.

The first live acceptance suite remains intentionally bounded to `operations_cockpit_live`. Real execution still requires a **dedicated non-production Supabase project**, a staging admin identity/JWT, a lower-rank worker JWT, and manual GitHub workflow dispatch. That separate staging target does not currently exist, so business staging acceptance remains open rather than falling back to Production.

## Remaining human-gated work

After Build 185, remaining readiness work is deliberately human/external:

- **staging acceptance:** Operations Cockpit, quote intake, live job updates, customer live-update notifications, service-execution proof/costing, supervisor closeout/signoff;
- **accounting acceptance:** payment actions and bank CSV/reconciliation acceptance;
- **provider acceptance:** customer portal Stripe test-mode checkout/webhook/status proof;
- **content approval:** route/visual approval and approved-route generation.

Build 186 improves evidence mechanics. It does **not** auto-complete these rails.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across Safety, Finance, Jobs, and Admin.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Posting approval is not execution release; posting execution release stays server-owned and **OFF**.
- Accountant/bookkeeper chart mapping choices and approvals remain human decisions.
- Finance completion/accounting flows do not write canonical Jobs/work-order state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic Finance acceptance remains non-persistent/browser-only.
- Staging evidence and signoff never auto-close a readiness rail.
- I.T. Readiness reports blockers; it cannot auto-promote Production.
- Production promotion remains deliberate/manual.

## Repository and release authority

Numbered migrations are permanent audit history through Schema 186; Schema 186 is live and release-authority GREEN. Git history is the archive. Do not restore archive trees, retired Markdown, generated schema snapshots, Playwright output, dependencies, logs, temp, backup artifacts, or completed one-time cleanup workflows.

Build 186 product release proof is recorded in database release evidence row 19; the final documentation-closeout SHA/run is recorded separately after this closeout merges. Repository protection remains separately AMBER while `main` is unprotected. Vercel/deployment state is separate from source correctness and must be freshly verified before deployment is called green.

## Source verification

```powershell
npm ci
npm run test:repo
npm run test:modules
npm run test:it
npm run test:it-scorecard-truth
npm run test:equipment-scan
npm run test:staging-acceptance
npm run test:runtime
npm run test:boundaries
npm run test:acceptance
npm run test:release-authority
npm run test:event-wiring
npm run test:job-completion-event
npm run test:finance-completion-consumer
npm run test:consumer-observability
npm run test:finance-consumer-execution
npm run test:finance-completion-review
npm run test:finance-schema-dependencies
npm run test:finance-posting-safety
npm run test:finance-posting-preflight
npm run test:finance-posting-execution-recovery
npm run test:finance-operational-control-plane
npm run test:finance-release-hardening
npm run test:finance-account-mapping-review
npm run test:finance-account-mapping-observability
npm run test:finance-account-mapping-decision-support
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
npm run test:browser:it
npm run test:browser:equipment-scan
npm run test:browser:staging-acceptance
```

Rendered browser acceptance remains mandatory before source-green. Live staging acceptance is a separate manually dispatched evidence run and must never default to the Production project.