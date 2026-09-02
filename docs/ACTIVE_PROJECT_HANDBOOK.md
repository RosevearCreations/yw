# YWI Active Project Handbook

**Current schema source authority:** `179`  
**Verified live database boundary before Schema 179 promotion:** `178`  
**Last clean-main Schema 178 checkpoint:** `400e559663d9d71ce07c8cac638a2ef7016320d0`, Run #95 (`33659172805`) — SUCCESS  
**Source:** `RosevearCreations/yw`  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. I.T. is a control-plane section inside Admin, not another business domain.

A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`. Server authorization is authoritative even when the browser hides a route. Active Admin profiles are the recovery exception and resolve to `manage` across all four modules.

## Architecture progression

### Schemas 159–174 — modular authority and Finance intake
Schemas 159–160 established module permissions, Admin break-glass, and I.T. Readiness. Schemas 161–163 established permission-driven module loading and protected Shared Core reads. Schemas 164–168 established fail-closed cross-module contracts/events and canonical job-completion events. Schemas 169–172 established Finance intake, observability/retry, human disposition, and documentary draft candidates. Schemas 173–174 added dependency contracts and repaired the work-order identity chain to canonical UUID.

### Schema 175 — posting safety
Posting approval is separate from completion disposition/candidate approval. It carries server-owned idempotency and immutable provenance.

### Schema 176 — existing accounting-engine preflight
The Finance candidate pair maps to the existing accounting authorities:

- invoice: `job_invoice_postings` → `ar_invoices`;
- journal: `job_journal_postings` → `gl_journal_batches` / `gl_journal_entries`;
- mappings: `accountant_export_mapping_rules` → `chart_of_accounts`.

Preflight is read-only. Amounts, account identities, and posting truth are server-owned, and required account mappings need explicit accountant/bookkeeper approval.

### Schema 177 — execution, recovery and reversal
Atomic AR + balanced GL execution, durable idempotency, recovery quarantine, and auditable reversal are installed. The execution release is server-owned and remains OFF; provider mutation remains OFF. No accounting posting was manufactured merely to prove the release.

### Schema 178 — operational control plane
One read-only lifecycle now spans intake → disposition → draft candidates → posting approval → preflight → execution/recovery → reversal. Reason-coded blockers, reconciliation/integrity diagnostics, dynamic dependency preflight, and Admin → I.T. Finance pipeline status expose impossible/orphan/duplicate states without introducing another accounting system.

Schema 178 is fully release-proven on final clean `main` SHA `400e559663d9d71ce07c8cac638a2ef7016320d0`, Run #95 (`33659172805`). Live Schema 178 was verified current with dependency and Finance assertion chains green, reconciliation clean, posting execution OFF, provider mutation OFF, and zero unintended Finance posting effects. The protected Finance posting and Admin I.T. Edge functions were aligned with JWT verification.

### Schema 179 — Finance permissions, synthetic acceptance and release hardening
Build 179 completes the autonomous Finance hardening sequence without releasing real accounting effects:

- explicit permission-matrix contracts for `hidden`, `view`, `create`, `approve`, `manage`, Admin break-glass, and server-control cases;
- protected Finance endpoints report their server-resolved access level and capability ladder;
- both Finance completion endpoints explicitly require JWT verification;
- direct browser attempts to supply totals, account identities, posting state, release state, or provider truth remain rejected;
- deterministic browser-only fixtures exercise review, candidate, approval, blocked preflight/release, recovery, posted and reversed rendering without persistent database or provider effects;
- rendered phone/desktop acceptance uses the real Finance and I.T. client code;
- Admin → I.T. adds Finance operational, reconciliation, and release-hardening evidence;
- a database release-hardening assertion family verifies permission order, service-only Finance RPCs, Admin break-glass, private/off execution controls, human mapping authority, dependency integrity, reconciliation integrity, prior Schema 175–178 assertions, no Jobs writeback, and provider mutation closure.

## Current release boundary

Until Schema 179 is merged and exact-main source acceptance passes, the verified live database remains Schema 178. Build 179 must then be applied and validated in order. The following remain deliberately outside Build 179:

- enabling Finance posting execution;
- approving the `accounts_receivable`, `service_revenue`, or conditional `sales_tax_payable` mappings;
- live Stripe/PayPal/provider mutation;
- real-money/payment testing;
- tax-policy or chart-of-accounts business decisions;
- Production promotion.

GitHub repository enforcement remains a separate infrastructure item because `main` is currently reported unprotected. It does not weaken application-level authorization, but Release Authority continues to report it separately as AMBER.

## Security and ownership invariants

- Admin break-glass `manage` across all four modules is mandatory until deliberately replaced.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner, access level and boundary mode.
- Finance review, candidate generation, posting approval, preflight, execution, recovery and reversal are distinct authorities.
- Posting execution release is private/server-owned and cannot be enabled by the browser.
- Accountant/chart mapping approval remains human-controlled.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- I.T. Readiness may report or block a release but cannot auto-promote Production.

## Release discipline

1. Start from exact current `main` plus verified live schema evidence.
2. Query live catalog types/relationships before adding schema dependencies; never guess identity types.
3. Preserve every applied numbered migration.
4. Run all source/security gates on a bounded feature branch.
5. Run rendered browser acceptance on real production client code with safe deterministic fixtures where live mutation is inappropriate.
6. Merge only an exact green PR head.
7. Run exact-main CI before applying the migration.
8. Apply the database migration in order, then verify drift, dependencies, release assertions and zero unintended side effects.
9. Deploy changed protected Edge functions after their database dependencies exist; verify JWT/version state.
10. Record exact-main release evidence, update the release rail, clean merged branches/workflows, and verify the final clean-main SHA.
11. Keep Production promotion deliberate/manual.

## Repository hygiene

Git history is the archive. Do not keep stale Markdown, dated archive trees, generated full-schema snapshots, Playwright output, dependencies, logs, temp or backup artifacts in the active tree. Numbered SQL migrations remain permanent audit authority.

The only active project authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Boundary after Build 179

Build 179 closes the previously defined 20-item autonomous Finance completion-to-accounting hardening sequence. After it is fully source/database/runtime/release proven, **do not automatically enable posting execution or approve accounting mappings**. The next YW build should be selected from safe non-financial infrastructure/business improvements unless the accounting policy gates are deliberately authorized separately.