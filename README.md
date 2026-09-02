# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `182` — maintenance-only Schema 181 release-authority convergence repair  
**Current feature authority:** Build 181 — COMPLETE  
**Verified live database authority:** Schema `182 / 182`  
**Published Build 181 product checkpoint:** `f8875bc3e1c479c8c78ab563bb46ef1b20a15c1d`, Run #117 (`33689829209`) — SUCCESS  
**Schema 182 repair source checkpoint:** `cf0b732b6421c67e3323ebc87885cfccb3322342`, Run #122 (`33691165229`) — SUCCESS  
**Repository state:** `main` is the single active branch; repository enforcement remains separately AMBER because `main` is unprotected  
**Runtime:** `finance-account-mapping-review` v3 ACTIVE / JWT enabled; `admin-it-control` v12 ACTIVE / JWT enabled  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin/manage control-plane section, never a fifth business module.

## Current architecture

- **Schemas 159–160:** module permissions, Admin break-glass access, and I.T. Readiness.
- **Schemas 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core reads.
- **Schemas 164–168:** fail-closed cross-module writes/events and canonical job-completion event wiring.
- **Schemas 169–172:** Finance completion intake, retry/observability, human disposition, and documentary draft candidates.
- **Schemas 173–174:** dependency contracts and canonical UUID convergence.
- **Schema 175:** separate posting approval, idempotency, provenance, and execution guards.
- **Schema 176:** read-only posting preflight mapped onto the existing AR/GL engine and accountant-approved account mappings.
- **Schema 177:** atomic AR/GL execution/recovery/reversal machinery behind a private server-owned execution release that remains **OFF**.
- **Schema 178:** completion-to-accounting lifecycle, blocker codes, reconciliation, and Admin → I.T. Finance readiness.
- **Schema 179:** Finance permission matrix, direct-bypass guards, synthetic non-persistent/browser-only acceptance, JWT hardening, and full release gate.
- **Schema 180 / Build 180 — COMPLETE:** human-controlled accountant mapping review over the existing `accountant_export_mapping_rules` → `chart_of_accounts` authority, immutable human-review audit, protected Finance-manage workflow, Admin → I.T. mapping readiness, and rendered acceptance.
- **Schema 181 / Build 181 — COMPLETE:** read-only mapping review aging, canonical account/review drift detection, posting-preflight reconciliation, Finance UI observability, Admin → I.T. guidance, and rendered acceptance. It creates no second mapping authority and no new mapping mutation path.
- **Schema 182:** maintenance-only convergence repair. Schema 181 correctly inserted its ledger row but omitted the hard-coded `v_schema_drift_status` marker advance from 180. Schema 182 advances that release-control-plane marker and records the maintenance ledger/readiness/scorecard authority without changing Build 181 business behavior.

## Build 181 + Schema 182 verified boundary

Build 181 is **COMPLETE**. Schema 182 repairs only its release-authority marker and is live at `182 / 182`.

Verified invariants:

- Schema 181 assertions: **8 / 8 PASS**;
- prior Schema 180 mapping assertions: **8 / 8 PASS**;
- prior Schema 179 hardening assertions: **12 / 12 PASS**;
- required Finance schema dependencies: **79 / 79 PASS**;
- all active Admin profiles retain break-glass `manage` across Safety, Finance, Jobs, and Admin;
- `accounts_receivable`, `service_revenue`, and `sales_tax_payable` retain their pre-Build-181 account IDs and remain `review`;
- release-created mapping-review audit events: **0**;
- posting execution release: **OFF**;
- provider mutation: **OFF**;
- Finance completion/accounting Jobs writeback remains prohibited;
- Production promotion remains deliberate/manual.

Live mapping observability is intentionally **AMBER** because all three unresolved human accountant/bookkeeper reviews are stale. Technical drift is **0** and preflight contradiction is **0**. That is a human accounting decision backlog, not an I.T. migration failure.

Build 181 and Schema 182 deliberately do **not** choose accounts, approve/reject mappings, modify the immutable human-review audit, add another mapping mutation endpoint, enable posting execution, mutate Stripe/PayPal/provider truth, write Jobs state, change tax/chart policy, or promote Production.

The final exact-main release-evidence SHA/run is stored in `it_release_source_evidence` and surfaced by `v_it_release_source_evidence_current`; that database record is the canonical self-consistent source proof rather than embedding a self-referential final closeout SHA here.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across all four modules.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, mapping review, and mapping observability remain separate concerns.
- Posting execution release is server-owned and remains **OFF**.
- Accountant/chart mapping choices and approvals remain human decisions.
- Finance completion/accounting flows do not write canonical Jobs state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and cannot manufacture release evidence through live business-data mutation.
- I.T. Readiness reports blockers; it does not auto-promote Production.
- Production promotion remains deliberate/manual.

## Database and repository authority

Every numbered migration in `sql/` is permanent audit history and the source migration chain is ordered through Schema 182. The live database is `182 / 182`. Git history is the archive; do not restore stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

The only active Markdown authorities are:

1. `README.md`
2. `docs/ACTIVE_PROJECT_HANDBOOK.md`
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

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
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
```

Rendered browser acceptance is mandatory before source-green. Future database migrations follow exact-main source proof, never precede it. Deployment evidence is separate from source correctness and must be freshly verified before deployment is called green.