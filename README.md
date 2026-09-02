# Yard Weasels Inc. Operations Platform

**Current source/database authority:** Schema `180` — Build 180 COMPLETE  
**Schema 180 merged checkpoint:** `b37491932ac1d6dbac7917bd9848d8ca120fb6e9`, Run #109 (`33673018358`) — SUCCESS  
**Schema 180 release evidence:** ID `11`; Release Authority GREEN; repository enforcement separately AMBER because `main` is unprotected  
**Next bounded build:** Build `181` — Finance mapping review aging, drift, and reconciliation observability  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin/manage control-plane section, never a fifth business module.

## Current architecture

- **Schemas 159–160:** module permissions, Admin break-glass access, and I.T. Readiness.
- **Schemas 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core reads.
- **Schemas 164–168:** fail-closed cross-module writes/events and canonical job-completion event wiring.
- **Schemas 169–172:** Finance completion intake, observability/retry, human disposition, and draft candidate authority.
- **Schemas 173–174:** dependency contracts and canonical UUID convergence.
- **Schema 175:** separate posting approval, idempotency identity, provenance, and execution guards.
- **Schema 176:** read-only posting preflight over the existing AR/GL engine and accountant-approved mapping prerequisites.
- **Schema 177:** atomic AR/GL execution/recovery/reversal machinery behind a server-owned execution release that remains OFF.
- **Schema 178:** unified completion-to-accounting lifecycle, blocker codes, reconciliation, and Admin → I.T. Finance readiness.
- **Schema 179:** Finance permission matrix, synthetic non-persistent/browser-only acceptance, direct-bypass guards, JWT hardening, and complete release gate.
- **Schema 180:** human-controlled accountant mapping review over the existing `accountant_export_mapping_rules` → `chart_of_accounts` authority, immutable review audit, Finance-manage endpoint/UI, Admin → I.T. mapping readiness, and rendered acceptance.

## Build 180 verified closure

Build 180 is **COMPLETE** and live at `180 / 180`. Exact-main Run #109 passed all source/static and rendered browser suites before the migration was applied. Post-migration verification proved:

- Schema 180 assertions: **8 / 8 PASS**;
- prior Schema 179 hardening assertions: **12 / 12 PASS**;
- required Finance dependencies through Schema 180: **62 / 62 PASS**;
- all active Admin profiles retain break-glass `manage` across Safety, Finance, Jobs, and Admin;
- `accounts_receivable`, `service_revenue`, and `sales_tax_payable` retained the exact pre-migration account IDs and remained `review`;
- mapping review audit events created by the release: **0**;
- release-created posting approvals/execution runs/reversals/invoice postings/journal postings: **0**;
- posting execution release: **OFF**;
- provider mutation: **OFF**;
- `finance-account-mapping-review` v2 — ACTIVE / JWT enabled;
- `admin-it-control` v10 — ACTIVE / JWT enabled.

Mapping readiness is intentionally **AMBER** because the three mappings still require an explicit human accountant/bookkeeper decision. That is accounting readiness, not a failed application release.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across all four modules.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, and mapping review are separate authorities.
- Posting execution release is server-owned and remains **OFF**.
- Accountant/chart mapping choices and approvals remain human decisions.
- Finance completion/accounting flows do not write canonical Jobs state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and cannot manufacture release evidence through business-data mutation.
- I.T. Readiness reports blockers; it does not auto-promote Production.
- Production promotion remains deliberate and manual.

## Next bounded build

**Build 181 — Finance mapping review aging, drift, and reconciliation observability** is next. It may add read-only stale/pending-review age, mapping/account drift observations, historical reconciliation evidence, and Admin → I.T. guidance. It must not choose accounts, approve mappings, enable execution/provider mutation, write Jobs state, change tax/chart policy, or promote Production.

## Database and repository authority

Every numbered migration in `sql/` is permanent audit history and remains ordered through Schema 180. Git history is the archive; do not restore stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

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
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
```

Rendered browser acceptance is mandatory before source-green. Database migration follows exact-main source proof. Deployment evidence is separate from source correctness and must be freshly verified before deployment is called green.