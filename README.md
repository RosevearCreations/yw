# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `181` — Build 181 ACTIVE  
**Verified live database authority:** Schema `180 / 180` until exact-main Schema 181 proof is green and the migration is deliberately applied  
**Final clean Schema 180 checkpoint:** `02fa56d7ef456b613278a9ecae568262c3c2410a`, Run #113 (`33687575034`) — SUCCESS  
**Schema 180 release evidence:** ID `12`; Release Authority GREEN; repository enforcement separately AMBER because `main` is unprotected  
**Active build:** Build `181` — Finance mapping review aging, drift, and reconciliation observability  
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
- **Schema 177:** atomic AR/GL execution/recovery/reversal machinery behind a private release switch that remains OFF.
- **Schema 178:** completion-to-accounting lifecycle, blocker codes, reconciliation, and Admin → I.T. Finance readiness.
- **Schema 179:** Finance permission matrix, direct-bypass guards, synthetic non-persistent/browser-only acceptance, JWT hardening, and full release gate.
- **Schema 180:** human-controlled accountant mapping review over the existing `accountant_export_mapping_rules` → `chart_of_accounts` authority, immutable human-review audit, protected Finance-manage workflow, Admin → I.T. mapping readiness, and rendered acceptance.
- **Schema 181 source:** read-only mapping review aging, canonical account/review drift detection, posting-preflight reconciliation, Finance UI observability, and Admin → I.T. guidance. It creates no second mapping authority and no new mapping mutation path.

## Build 180 verified closure

Build 180 is **COMPLETE** and live at `180 / 180`. The final post-prune source is `02fa56d7ef456b613278a9ecae568262c3c2410a`; exact-main Run #113 passed all source and rendered-browser gates and release evidence ID `12` binds that clean checkpoint to Schema 180.

Live invariants remain:

- Schema 180 assertions: **8 / 8 PASS**;
- prior Schema 179 hardening assertions: **12 / 12 PASS**;
- required Finance dependencies through Schema 180: **62 / 62 PASS**;
- all active Admin profiles retain break-glass `manage` across Safety, Finance, Jobs, and Admin;
- `accounts_receivable`, `service_revenue`, and `sales_tax_payable` retain their exact pre-migration account IDs and remain `review`;
- release-created mapping-review audit events: **0**;
- release-created posting effects: **0**;
- posting execution release: **OFF**;
- provider mutation: **OFF**;
- Production promotion: manual.

Mapping readiness is intentionally **AMBER** because the three account choices still require an explicit human accountant/bookkeeper decision. That is accounting readiness, not a failed application release.

## Build 181 — ACTIVE

Build 181 makes that human decision queue operationally observable without making the decision. The source release adds:

- review age anchored to the canonical review/update timestamps, with recent, aging (7+ days), and stale (30+ days) classifications;
- true technical drift detection for inactive/missing account state, immutable-review/current-state disagreement, and invalid approved-review evidence;
- a separate recheck warning when chart-account metadata changes after a human approval;
- reconciliation between the canonical mapping state and Schema 176 generated-pair preflight blocker codes;
- neutral `NO_GENERATED_PAIR_SAMPLE` evidence where no current completion pair exercises a mapping;
- reason-coded Finance and Admin → I.T. guidance that keeps human backlog AMBER while reserving RED for actual technical contradictions;
- deterministic non-persistent/browser-only acceptance on phone and desktop across `hidden`, `view`, `create`, `approve`, and `manage`.

Build 181 does **not** create a new mapping table, choose accounts, approve/reject mappings, write the Schema 180 immutable human-review audit, add another mutation endpoint, enable posting execution, mutate Stripe/PayPal/provider truth, write Jobs state, change tax/chart policy, or promote Production.

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
- Production promotion remains deliberate and manual.

## Database and repository authority

Every numbered migration in `sql/` is permanent audit history and the source migration chain is now ordered through Schema 181. The live database remains at Schema 180 until exact-main Schema 181 source proof is green. Git history is the archive; do not restore stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

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

Rendered browser acceptance is mandatory before source-green. Database migration follows exact-main source proof, never precedes it. Deployment evidence is separate from source correctness and must be freshly verified before deployment is called green.
