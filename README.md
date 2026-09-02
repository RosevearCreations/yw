# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `174`  
**Database authority:** Schema `174` applied/current at the last verified release checkpoint  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels is organized around four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** remains an Admin/manage control-plane section, not a fifth business module.

## Current architecture

- **Schema 159–160:** module permissions, Admin break-glass access, and I.T. Readiness control plane.
- **Schema 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core read models.
- **Schema 164–168:** fail-closed cross-module write/event boundaries and real job-completion event wiring.
- **Schema 169–172:** Finance completion intake, observability/retry, and human review/disposition candidate authority.
- **Schema 173:** private schema-dependency contracts and Finance dependency preflight.
- **Schema 174:** repairs the Schema 173 guessed work-order type to canonical UUID and extends the Finance candidate identity-chain contracts.

Schema 174 is control-plane convergence only. It does not post invoices or journals, mutate Jobs state, change Stripe/PayPal truth, or auto-promote Production.

## Non-negotiable boundaries

- Hidden navigation is not authorization; protected server paths independently enforce module access.
- Active Admin profiles retain break-glass `manage` across Safety, Finance, Jobs, and Admin.
- Shared Core identity data remains read-only through its protected Core data service; business modules must not create duplicate identity directories.
- Cross-module writes must have an explicit owner/contract and fail closed when undeclared.
- Stripe paid status remains webhook/provider controlled.
- I.T. Readiness reports release blockers but does not automatically promote Production.
- Public SEO remains separate from private staff/customer data and retains one-H1, canonical, approved-image, alt-text, structured-data, and sitemap gates.

## Database and migration authority

Keep every numbered migration in `sql/` in numerical order. Applied migration files are historical database authority and must **not** be removed simply because a newer schema exists. The numbered migration chain is the sole source authority; generated full-schema snapshots are intentionally not tracked because they become stale duplicates of that chain.

## Repository hygiene

Historical snapshots and retired Markdown are intentionally **not** kept in the active tree. Git history is the archive. Do not add dated `archive/`, `retired-markdown-*`, `test_write*`, editor backup, generated schema snapshots, generated Playwright output, dependency, log, or temporary output back into source control.

The active authority set is deliberately small:

1. `README.md`
2. `docs/ACTIVE_PROJECT_HANDBOOK.md`
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

## Source verification

Run the current source gates from repository root:

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
npm run test:contrast
npm run test:navigation
```

Rendered browser acceptance remains part of the GitHub/Vercel release gate. Production promotion remains deliberate and manual.
