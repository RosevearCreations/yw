# Yard Weasels Inc. Operations Platform

**Current authority:** Schema `183 / 183` — **Build 183 COMPLETE**  
**Merged product checkpoint:** `e0e4628594a66f10347cf4b7c915f65fce57da79`, exact-main Run #128 (`33696331201`) — SUCCESS  
**Runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v13 ACTIVE / JWT enabled  
**Repository enforcement:** AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** stays inside Admin/manage and is never a fifth module.

## Architecture through Schema 183

- Schemas 159–174: module permissions, Admin break-glass, I.T. Readiness, Shared Core, fail-closed cross-module contracts, canonical job-completion events, Finance intake/review, and dependency convergence.
- Schema 175: separate posting approval, idempotency, provenance, and execution guards.
- Schema 176: read-only posting preflight over the existing AR/GL engine and canonical chart mappings.
- Schema 177: paired AR/GL execution/recovery/reversal machinery behind a private execution release that remains **OFF**.
- Schema 178: Finance lifecycle/reconciliation and Admin → I.T. pipeline health.
- Schema 179 / Build 179 — **COMPLETE**: Finance permission matrix, direct-bypass guards, synthetic non-persistent/browser-only acceptance, JWT hardening, and release gate.
- Schema 180 / Build 180 — **COMPLETE**: human accountant/bookkeeper mapping review over `accountant_export_mapping_rules` → `chart_of_accounts`, immutable review audit, and protected Finance/manage workflow.
- Schema 181 / Build 181 — **COMPLETE**: mapping aging, technical drift, and posting-preflight reconciliation observability.
- Schema 182 — **COMPLETE maintenance repair**: release-authority marker convergence only.
- Schema 183 / Build 183 — **COMPLETE**: structural chart-account decision support plus a database approval-compatibility guard.

## Build 183 verified closure

Build 183 closes one bounded safety gap without making accounting-policy decisions for the user. The three canonical mapping roles now have structural expectations:

- `accounts_receivable` → **asset**;
- `service_revenue` → **revenue**;
- `sales_tax_payable` → **liability**.

The private decision-support surface classifies active chart accounts as `CURRENT_SELECTION`, `SOURCE_IDENTITY_MATCH`, `TYPE_COMPATIBLE`, or `TYPE_MISMATCH`. It provides human decision support only: it does **not auto-select** an account and does **not auto-approve** a mapping.

The existing human mapping RPC remains the sole mapping mutation authority. Finance/manage may still save a mapping for review or reject it with a reason. Explicit human approval now fails closed in the database when the selected active account has the wrong structural `account_type`, including direct API attempts that bypass the browser.

Live Build 183 proof:

- database: **183 / 183 current**;
- Schema 183 decision-support assertions: **6 / 6 PASS**;
- Schema 181 observability assertions: **8 / 8 PASS**;
- Schema 180 mapping assertions: **8 / 8 PASS**;
- Schema 179 hardening assertions: **12 / 12 PASS**;
- all required schema dependency contracts: **82 / 82 PASS**;
- active Admin profiles with four-module break-glass `manage`: **3 / 3**;
- structurally compatible active candidates across the three mappings: **10**;
- incompatible current selections: **0**;
- mappings without a compatible active candidate: **0**;
- current mapping account IDs remain unchanged and all three review states remain `review`;
- release-created mapping-review audit events: **0**;
- technical mapping drift: **0**;
- posting-preflight contradictions: **0**;
- posting execution release: **OFF**;
- provider mutation: **OFF**;
- Production promotion: manual.

Mapping observability remains intentionally **AMBER** because all three accountant/bookkeeper reviews are stale human decisions. Structural decision support is **GREEN**. Human backlog is not an I.T. migration failure.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across Safety, Finance, Jobs, and Admin.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, mapping review, mapping observability, and mapping decision support remain separate concerns.
- Accountant/bookkeeper chart mapping choices and approvals remain explicit human decisions.
- Structural compatibility is only a minimum safety prerequisite for approval, not an accounting recommendation engine.
- Finance completion/accounting flows do not write canonical Jobs state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic acceptance remains non-persistent/browser-only.
- I.T. Readiness reports blockers; it cannot auto-promote Production.
- Production promotion remains deliberate/manual.

## Repository and release authority

Every numbered migration in `sql/` is permanent audit history and the source/live chain is ordered through Schema 183. Git history is the archive; do not restore stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

The final clean-main SHA/run is recorded in `it_release_source_evidence` after post-closeout branch cleanup and exact-main CI. That database evidence is the canonical source binding, avoiding a self-referential SHA in this file.

## Source verification

```powershell
npm ci
npm run test:repo
npm run test:modules
npm run test:it
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
```

Rendered browser acceptance is mandatory before source-green. Deployment evidence is separate from source correctness and must be freshly verified before deployment is called green.
