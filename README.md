# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `178`  
**Database authority:** Schema `177` remains the verified live boundary until the merged Schema 178 migration is deliberately applied and validated  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels is organized around four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** remains an Admin/manage control-plane section, not a fifth business module.

## Current architecture

- **Schemas 159–160:** module permissions, Admin break-glass access, and I.T. Readiness control plane.
- **Schemas 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core read models.
- **Schemas 164–168:** fail-closed cross-module write/event boundaries and real job-completion event wiring.
- **Schemas 169–172:** Finance completion intake, observability/retry, and human review/disposition candidate authority.
- **Schemas 173–174:** private dependency contracts plus convergence of the Finance work-order identity chain to canonical UUID.
- **Schema 175:** separate Finance posting approval, durable idempotency identity, immutable provenance, and explicit posting-execution guards.
- **Schema 176:** read-only Finance posting preflight mapped onto the existing `job_invoice_postings`/AR and `job_journal_postings`/GL authorities, paired invoice/journal consistency, and accountant-approved account-mapping prerequisites.
- **Schema 177:** service-authorized atomic AR/GL posting machinery, durable idempotent retry/recovery detection, and auditable reversal/void authority, installed behind a server-owned execution release that remains OFF.
- **Schema 178:** unified Finance completion-to-accounting lifecycle, reason-coded blockers, reconciliation/integrity diagnostics, dynamic current-schema dependency preflight, and expanded Admin → I.T. Finance pipeline readiness.

Schema 178 is an **operational control-plane release**, not permission to turn on accounting effects. It exposes one lifecycle from intake → human disposition → draft candidates → separate posting approval → preflight → execution/recovery → reversal, while preserving the existing accounting authorities. The required `accounts_receivable`, `service_revenue`, and conditional `sales_tax_payable` mappings remain human accountant/bookkeeper decisions.

## Non-negotiable boundaries

- Hidden navigation is not authorization; protected server paths independently enforce module access.
- Active Admin profiles retain break-glass `manage` across Safety, Finance, Jobs, and Admin.
- Shared Core identity data remains read-only through its protected Core data service; business modules must not create duplicate identity directories.
- Cross-module writes must have an explicit owner/contract and fail closed when undeclared.
- Finance candidate approval, posting approval, posting preflight, posting execution, recovery, and reversal remain distinct authorities.
- Posting execution release remains server-owned and OFF at the current verified live checkpoint; the browser cannot enable it.
- No Finance control-plane path may mutate Jobs or Stripe/PayPal/provider/payment truth.
- Accountant/chart-of-accounts approvals are human accounting decisions and are not auto-approved by I.T. migrations.
- I.T. Readiness reports release and Finance-pipeline blockers but does not automatically promote Production.
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
npm run test:finance-posting-safety
npm run test:finance-posting-preflight
npm run test:finance-posting-execution-recovery
npm run test:finance-operational-control-plane
npm run test:contrast
npm run test:navigation
```

Rendered browser acceptance remains part of the GitHub release gate. Vercel deployment evidence is tracked separately from source correctness; an account build-rate-limit or unavailable connector context is an infrastructure/evidence issue, not permission to bypass source gates. Production promotion remains deliberate and manual.
