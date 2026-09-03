# Yard Weasels Inc. Operations Platform

**Current authority:** Schema `184 / 184` — **Build 184 COMPLETE**  
**Merged product checkpoint:** `613118f52fcbad147a56226ccdeabf3a64a1c8b0`, exact-main Run #136 (`33698631685`) — SUCCESS  
**Previous clean release evidence:** Build 183 `main` `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 (`33697274220`) — GREEN  
**Runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v14 ACTIVE / JWT enabled  
**Repository enforcement:** AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Vercel:** separate infrastructure status; do not call deployment green unless a fresh exact-main check succeeds  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** stays inside Admin/manage and is never a fifth module.

## Architecture through Schema 184

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

## Build 184 verified closure

Build 184 fixes control-plane truth without inventing business completion. It closes only historical rails whose later, stronger proof is already green and keeps real acceptance work visible.

Verified live state:

- database **184 / 184 CURRENT**;
- Build 184 scorecard-truth assertions **6 / 6 PASS**;
- required schema dependency contracts **85 / 85 PASS**;
- Admin break-glass integrity **3 admins / 0 blockers**;
- scorecard truth **GREEN**;
- **38** total rails: **26 complete / 12 open**;
- open rails classified **12 / 12**; unclassified open rails **0**;
- proof-closure drift **0**;
- `schema159_module_permissions`, `schema160_it_readiness`, and `schema164_cross_module_boundaries` are each **100% / verified_complete** with one immutable evidence record;
- Build 184 rail itself is **100% complete**;
- `admin-it-control` **v14 ACTIVE / JWT enabled**;
- human Finance mapping choices remain unchanged, all three remain `review`, and mapping-review audit count remains **0**;
- Finance posting execution release **OFF**;
- provider mutation **OFF**;
- Production promotion **manual**.

The 12 remaining rails are genuine work and remain open: six staging-acceptance items, two accounting-acceptance items, one provider-acceptance item, two content-approval items, and one feature follow-up. Human/provider/accounting/content/staging work is not auto-completed merely to make the dashboard green.

## Current next autonomous build

**Build 185 — Equipment barcode/QR camera scanning and custody evidence hardening** is the next bounded autonomous feature candidate. `equipment_scan_custody_live` is the only remaining open rail classified `feature_followup` that requires neither a human decision nor an external provider. Before implementation, inspect the canonical equipment/custody schema, current scanner UI, module ownership and write-boundary contracts; do not create a parallel equipment identity system.

All other open rails retain their real gates: staging acceptance, accountant/bookkeeper review, content approval, or Stripe/provider acceptance.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across Safety, Finance, Jobs, and Admin.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Posting approval is not execution release; posting execution release stays server-owned and **OFF**.
- Accountant/bookkeeper chart mapping choices and approvals remain human decisions. Build 184 does **not auto-select** or auto-approve a mapping.
- Finance completion/accounting flows do not write canonical Jobs/work-order state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic Finance acceptance remains non-persistent/browser-only.
- I.T. Readiness reports blockers; it cannot auto-promote Production.
- Production promotion remains deliberate/manual.

## Repository and release authority

Numbered migrations are permanent audit history through Schema 184. Git history is the archive; do not restore archive trees, retired Markdown, generated schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

Build 184 product proof is bound to merged `main` SHA `613118f52fcbad147a56226ccdeabf3a64a1c8b0` / Run `33698631685`. The final post-authority-closeout clean-main SHA/run is recorded in `it_release_source_evidence` after branch pruning and the final exact-main workflow, avoiding a self-referential SHA in this document.

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

Rendered browser acceptance remains mandatory before source-green. Deployment/Vercel evidence is separate from source correctness and must be freshly verified before deployment is called green.
