# YWI Active Project Handbook

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

**Current live schema authority:** `186 / 186` — **Build 186 COMPLETE**  
**Build 186 product checkpoint:** `046b9289acbe79c2a4feb4606a42dc50a8cad33d`, exact-main Run #154 (`33710506232`) — GREEN  
**Build 186 final clean release evidence:** row `20` in `it_release_source_evidence`  
**Runtime:** `equipment-scan-manage` v1 ACTIVE / JWT enabled; `admin-it-control` v14 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider/payment mutation OFF; Production promotion manual  
**Build 186:** **COMPLETE** on `main`; live database is Schema 186 / 186 CURRENT  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin/manage.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`; protected server authorization remains authoritative. Active Admin profiles retain break-glass `manage` across all four modules.

## Architecture progression

- Schemas 159–174 established module permissions, Admin break-glass, I.T. Readiness, Shared Core, fail-closed cross-module contracts/events, canonical job completion, Finance intake/review, and dependency convergence.
- Schema 175 separated posting approval from completion disposition and added idempotency/provenance.
- Schema 176 mapped Finance candidates into the existing AR/GL accounting engine with read-only preflight.
- Schema 177 installed execution/recovery/reversal behind a private server-owned execution release that remains **OFF**.
- Schema 178 added lifecycle, blockers, reconciliation, and Admin → I.T. Finance health.
- Schema 179 / Build 179 — **COMPLETE**: Finance permissions, direct-bypass protection, synthetic non-persistent/browser-only acceptance, and release hardening.
- Schema 180 / Build 180 — **COMPLETE**: human accountant/bookkeeper mapping review and immutable audit over the existing canonical mapping table.
- Schema 181 / Build 181 — **COMPLETE**: human-review aging, technical drift, and posting-preflight reconciliation observability.
- Schema 182 — **COMPLETE maintenance repair**: release marker convergence without business mutation.
- Schema 183 / Build 183 — **COMPLETE**: structural chart-account decision support and DB-side approval compatibility enforcement.
- Schema 184 / Build 184 — **COMPLETE**: I.T. scorecard truth convergence and blocker classification.
- Schema 185 / Build 185 — **COMPLETE**: barcode/QR camera scanning, canonical equipment identity convergence, exact identifier resolution, and scan/custody evidence hardening.
- Schema 186 / Build 186 — **COMPLETE**: staging acceptance control plane, service-private evidence hardening, exact source/schema binding, explicit human signoff, and Admin I.T. acceptance evidence.
- Schema 187 / Build 187 — **ACTIVE SOURCE WORK**: six-rail staging scenario catalog, pending-case seeding, prerequisite truth, explicit human case evidence and fail-closed finalization.

## Build 185 authority

Build 185 closed equipment scanning without creating a parallel equipment system. Physical Jobs equipment now links explicitly to canonical UUID `equipment_master`; exact private identifier resolution covers equipment code, asset tag, serial number, QR and barcode values; collisions fail closed; and scan/custody provenance is idempotent and auditable.

Final Build 185 proof:

- Schema `185 / 185` current;
- exact clean `main` `d126ddfb403d31faba1d9826df3e0ad1e0d58fd7`;
- exact-main Run #149 / `33705924533` GREEN;
- release evidence row 18;
- Build 185 equipment assertions **7 / 7 PASS**;
- `equipment_scan_event` remains Jobs/create;
- phone camera and desktop/manual fallback rendered acceptance passed;
- raw camera/manual values remain untrusted until protected exact server resolution;
- `equipment-scan-manage` v1 ACTIVE / JWT enabled;
- no equipment fixture/business rows were persisted during release proof;
- `equipment_scan_custody_live` and the Build 185 rail are complete;
- repository cleanup returned the project to one branch: `main`.

Finance, payment providers, accounting truth, and Production were untouched.

## Scorecard truth after Build 186

Live scorecard truth remains GREEN:

- **40** total rails;
- **29 complete / 11 open**;
- all **11 / 11** open rails classified;
- unclassified open **0**;
- proof-closure drift **0**;
- human pending **11**;
- external pending **1**;
- feature follow-up pending **0**.

The remaining open work is real acceptance/approval work:

- `staging_acceptance` — 6: Operations Cockpit, quote intake, live job updates, customer live-update notifications, service-execution proof/costing, supervisor closeout/signoff;
- `accounting_acceptance` — 2: payment actions and bank CSV/reconciliation acceptance;
- `provider_acceptance` — 1: customer portal Stripe test-mode checkout/webhook/status acceptance;
- `content_approval` — 2: route/visual approval and approved-route generation.

A contract-level guard prohibits automatic completion of human/external-dependent work.

## Build 186 delivered authority and scope

Build 186 was selected because the roadmap had reached a different phase: no autonomous feature-followup rail remains. The next valuable work is making human staging evidence safe, repeatable, source-bound, and auditable.

Schema 186 reused the existing staging authorities rather than creating parallel tables:

- `operations_staging_test_runs`;
- `operations_staging_test_results`;
- `operations_staging_fixture_sets`;
- `operations_staging_fixture_records`.

The existing run/result/fixture tables are currently empty in the live YardWeasels database, so the control plane can be hardened before real staging evidence exists.

### Build 186 security findings

Preflight found two inherited staging-authority weaknesses worth correcting before staging execution:

1. `operations_staging_test_runs` and `operations_staging_test_results` have RLS enabled and no policies, but still retain broad `anon`/`authenticated` table grants. Schema 186 removes those grants and keeps the tables service-private.
2. `ywi_rpc_create_staging_fixture_set` and `ywi_rpc_cleanup_staging_fixture_set` are `SECURITY DEFINER` functions that accept an explicit actor profile ID and were executable by `anon`/`authenticated`. Schema 186 revokes browser execution and makes staging fixture mutation service-role-only.

### Build 186 evidence contract

New staging evidence binds each run to:

- one current `staging_acceptance` scorecard rail;
- exact 40-character source SHA;
- optional source workflow run ID;
- current schema version;
- optional tracked disposable fixture set;
- automated/runtime/browser/manual evidence cases;
- blocking/non-blocking outcome;
- explicit human signoff when the rail requires it.

Automated pass returns `awaiting_human_signoff` for human-required rails. Explicit approve/reject signoff records evidence but **does not update `admin_scorecard_progress_rails`**. Scorecard completion remains a separate deliberate release decision.

### Dedicated staging boundary

The modernized staging runner requires:

- manual GitHub `workflow_dispatch`;
- `environment: staging`;
- dedicated staging Supabase URL/service key;
- `YWI_STAGING_PROJECT_REF` matching that URL;
- hard refusal if the target ref equals YardWeasels Production `jmqvkgiqlimdhcofwkxr`;
- explicit `YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY`;
- staging Admin profile ID/JWT and lower-rank worker JWT;
- exact source SHA/workflow run binding.

There is currently no dedicated YW Supabase staging project in the connected project list. Build 186 therefore prepares and gates the system but does **not** create a paid Supabase branch/project automatically and does not fall back to Production.

The first live suite is deliberately bounded to `operations_cockpit_live`: authorized Cockpit load/capabilities/Stripe-health evidence plus lower-rank denial, with disposable fixtures optional and cleanup tracked.

## Historical release boundaries that remain binding

- Build 179 — **COMPLETE**: permissions/release hardening; synthetic Finance acceptance remains non-persistent/browser-only.
- Build 180 — **COMPLETE**: accountant/bookkeeper mapping workflow; mappings remain human authority.
- Build 181 — **COMPLETE**: mapping aging, drift, and reconciliation observability.
- Build 183 — **COMPLETE**: decision support/compatibility does not choose accounting policy.
- Build 184 — **COMPLETE**: scorecard truth classifies work but does not perform human/external work.
- Build 185 — **COMPLETE**: barcode/QR equipment scanning/custody hardening.

Posting approval is not execution release. Finance posting execution release remains server-owned and **OFF**. Provider/payment mutation remains OFF. Production promotion remains manual.

## Restart discipline during Build 186

1. Start from Build 185 clean-main `d126ddfb403d31faba1d9826df3e0ad1e0d58fd7` / Run #149 / evidence row 18.
2. Confirm live database remains `185 / 185` until Schema 186 source/browser proof is GREEN.
3. Continue only on `schema-186-staging-acceptance-control-plane` until its PR is proven.
4. Confirm Build 185 equipment assertions remain 7/7 and `equipment-scan-manage` remains ACTIVE/JWT protected.
5. Confirm scorecard truth remains GREEN with 11 classified open rails and no feature-followup rail.
6. Do not create or mutate a dedicated staging project without deliberate setup/cost approval.
7. Never aim staging automation at project ref `jmqvkgiqlimdhcofwkxr`.
8. Keep Finance posting execution/provider mutation OFF.
9. Keep accountant/bookkeeper mapping decisions human.
10. Keep Production promotion manual.

## Repository hygiene

Git history is the archive. Numbered migrations are permanent audit history through live Schema 185; Schema 186 is proposed source until applied. The only active Markdown authorities are `README.md`, this handbook, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Do not retain archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, backup files, or completed one-time cleanup workflows.

## Human-gated items

Do not autonomously approve chart mappings, choose different live mapping accounts, enable Finance posting execution, mutate Stripe/PayPal/provider truth, conduct real-money tests, invent tax/chart policy, change pricing, approve public content, create paid staging infrastructure, or promote Production.