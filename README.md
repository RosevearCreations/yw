# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `179` Build 179 release path  
**Verified live database boundary:** Schema `178` until merged Schema 179 is deliberately applied and validated  
**Last clean-main Schema 178 checkpoint:** `400e559663d9d71ce07c8cac638a2ef7016320d0`, Run #95 (`33659172805`) — SUCCESS  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin/manage control-plane section, never a fifth business module.

## Current architecture

- **Schemas 159–160:** module permissions, Admin break-glass access, and I.T. Readiness.
- **Schemas 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core reads.
- **Schemas 164–168:** fail-closed cross-module writes/events and canonical job-completion event wiring.
- **Schemas 169–172:** Finance completion intake, observability/retry, human disposition, and draft candidate authority.
- **Schemas 173–174:** dependency contracts and convergence of the Finance work-order identity chain to canonical UUID.
- **Schema 175:** separate posting approval, idempotency identity, provenance, and execution guards.
- **Schema 176:** read-only posting preflight over the existing AR/GL accounting engine and accountant-approved mapping prerequisites.
- **Schema 177:** atomic AR/GL execution/recovery/reversal machinery behind a server-owned release switch that remains OFF.
- **Schema 178:** unified completion-to-accounting lifecycle, blocker codes, reconciliation, and Admin → I.T. Finance pipeline readiness.
- **Schema 179:** Finance permission-matrix contracts, deterministic non-persistent synthetic browser acceptance, direct-bypass guards, explicit JWT protection for both Finance completion endpoints, and a full release-hardening gate.

Build 179 is **verification and hardening**, not permission to create accounting effects. Synthetic Finance fixtures are browser-only and never write invoices, journals, payments, mappings, Jobs state, or provider state.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Effective Finance levels remain `hidden < view < create < approve < manage`.
- Active Admin profiles retain break-glass `manage` on Safety, Finance, Jobs, and Admin.
- Shared Core identities remain centrally owned and read-only to consuming modules.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Finance human disposition, candidate generation, posting approval, preflight, execution, recovery, and reversal remain distinct authorities.
- Posting execution release is server-owned and remains **OFF**. The browser cannot enable it.
- Required chart/account mappings remain human accountant/bookkeeper decisions.
- Finance completion/accounting flows do not write back to Jobs.
- Stripe, PayPal, payment-provider, and payment truth mutation remain outside this Finance pipeline.
- I.T. Readiness reports blockers; it does not auto-promote Production.
- Production promotion remains deliberate and manual.

## Database and repository authority

Every numbered migration in `sql/` is permanent audit history and must remain in sequence. Generated full-schema snapshots are not tracked because the numbered migration chain is the schema authority. Git history is the archive; do not restore `archive/`, `retired-markdown-*`, `test_write*`, generated Playwright output, dependencies, logs, backup/temp files, or generated schema snapshots.

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
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
```

GitHub rendered-browser acceptance is mandatory before a release is source-green. Database migration follows exact-main source proof, never precedes it. Vercel deployment evidence is separate from source correctness and must be verified before claiming deployment green.