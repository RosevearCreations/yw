# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `184` — **Build 184 ACTIVE / source review**  
**Verified live database authority:** Schema `183 / 183` until Build 184 source/browser proof is green and Schema 184 is deliberately applied  
**Last clean release evidence:** `main` at `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 (`33697274220`) — application release authority GREEN  
**Build 184 source branch:** `schema-184-it-scorecard-truth-convergence`  
**Current live runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v13 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Vercel:** separately AMBER while the account is build-rate-limited  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** stays inside Admin/manage and is never a fifth module.

## Architecture through Build 184

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
- Schema 184 / Build 184 — **ACTIVE**: I.T. scorecard truth convergence and explicit blocker classification.

## Build 184 scope

The current scorecard still contains older rails whose historical next-action text was superseded by later release proof. Build 184 makes the scorecard reflect current truth without pretending that genuine acceptance work is complete.

Only three historical rails may be proof-closed automatically, and only after current fail-closed assertions prove them green:

- `schema159_module_permissions` — current module-security + rendered module acceptance + Admin break-glass proof;
- `schema160_it_readiness` — current I.T. security + active Admin four-module `manage` integrity;
- `schema164_cross_module_boundaries` — current write-boundary, boundary/event-wiring, and rendered module acceptance proof.

Their completion evidence is private, immutable, and append-only. If the required current proof is not green, Schema 184 aborts rather than changing the rail.

All genuinely unfinished rails remain open and receive an explicit current resolution class instead of being auto-completed:

- **staging acceptance:** Operations Cockpit, quote intake, live job updates, customer live-update email, service-execution proof/costing, supervisor closeout/signoff;
- **accounting acceptance:** payment actions and bank CSV/reconciliation acceptance;
- **provider acceptance:** customer portal Stripe test-mode checkout/webhook/status acceptance;
- **content approval:** route/visual approval and approved-route generation;
- **feature follow-up:** equipment barcode/QR camera scanning;
- **build acceptance:** Build 184 itself until live DB/runtime/exact-main evidence closes it.

Admin → I.T. Readiness gains a private scorecard-truth feed showing verified historical closures, classified open work, unclassified-open count, human/external requirements, and proof-closure drift. The browser has no control for completing a rail.

## Verified Build 183 boundary being preserved

- live database: **183 / 183 current**;
- final clean source: `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 `33697274220` — GREEN;
- Schema 183 assertions: **6 / 6 PASS**;
- Schema 181 assertions: **8 / 8 PASS**;
- Schema 180 assertions: **8 / 8 PASS**;
- Schema 179 assertions: **12 / 12 PASS**;
- required dependency contracts: **82 / 82 PASS**;
- active Admin break-glass integrity: **3 admins / 0 blockers**;
- current mapping choices unchanged and all three review states remain `review`;
- mapping-review audit count **0**;
- posting execution release **OFF**;
- provider mutation **OFF**;
- canonical Jobs writeback prohibited;
- Production promotion manual.

The existing mapping decisions remain human accountant/bookkeeper authority. Build 184 does **not auto-select**, auto-approve, reject, or change a chart mapping merely to turn an I.T. status green.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across Safety, Finance, Jobs, and Admin.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Posting approval is not execution release; posting execution release stays server-owned and **OFF**.
- Accountant/bookkeeper mapping choices and approvals remain human decisions.
- Finance completion/accounting flows do not write canonical Jobs/work-order state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic acceptance remains non-persistent/browser-only.
- Human/provider/accounting/content/staging work is not auto-completed by Build 184.
- I.T. Readiness reports blockers; it cannot auto-promote Production.
- Production promotion remains deliberate/manual.

## Repository and release authority

Numbered migrations are permanent audit history and source now includes Schema 184 while live remains Schema 183 until the Build 184 source/browser gate succeeds. Git history is the archive; do not restore archive trees, retired Markdown, generated schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

The last completed release is bound in `it_release_source_evidence` to exact clean `main` SHA `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf` / Run `33697274220`. Build 184 will receive its own final exact-main evidence only after migration/runtime proof, authority closeout, branch cleanup, and final CI.

## Source verification

```powershell
npm ci
npm run test:repo
npm run test:modules
npm run test:it
npm run test:it-scorecard-truth
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
```

Rendered browser acceptance remains mandatory before source-green. Deployment/Vercel evidence is separate from source correctness and must be reported separately.
