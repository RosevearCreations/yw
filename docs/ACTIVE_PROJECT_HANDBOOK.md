# YWI Active Project Handbook

**Current schema source authority:** `180` on the active Build 180 feature path  
**Verified live database authority:** `179 / 179` pending exact-main Schema 180 proof and deliberate migration  
**Last clean-main Schema 179 checkpoint:** `d6110236d84c21a6cb3f799b3f2bb14001ce610b`, Run #104 (`33666237217`) — SUCCESS  
**Schema 179 release evidence:** ID `10`; Release Authority GREEN; repository enforcement separately AMBER  
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
One read-only lifecycle spans intake → disposition → draft candidates → posting approval → preflight → execution/recovery → reversal. Reason-coded blockers, reconciliation diagnostics, dynamic dependency preflight, and Admin → I.T. Finance pipeline status expose impossible/orphan/duplicate states without introducing another accounting system.

### Schema 179 — Finance permissions, synthetic acceptance and release hardening — COMPLETE
Build 179 completed the original 20-item Finance hardening sequence without releasing real accounting effects:

- permission-matrix contracts for `hidden`, `view`, `create`, `approve`, `manage`, Admin break-glass, and server-control cases;
- server-resolved Finance access/capability reporting;
- explicit JWT verification for both Finance completion endpoints;
- direct browser rejection of server-owned totals, account identities, posting/release state, and provider truth;
- deterministic browser-only/non-persistent lifecycle fixtures;
- rendered phone/desktop acceptance using the real Finance and I.T. clients;
- Admin → I.T. operational, reconciliation, and release-hardening evidence;
- a 12-assertion database hardening family covering permissions, service-only RPCs, Admin break-glass, private/off execution controls, human mapping authority, dependency integrity, reconciliation integrity, prior Schema 175–178 assertions, no Jobs writeback, and provider closure.

Schema 179 is live at `179 / 179`. Exact-main Run #98 on SHA `c86a373ce14c3aef89b59ba46a63709989eb8cd5` is GREEN and release evidence ID `10` records that source. `v_it_finance_release_hardening_status` is GREEN with 12/12 assertions, 16 acceptance scenarios over seven authority levels, zero critical reconciliation issues, posting execution OFF, and provider mutation OFF.

Protected runtime alignment at the Schema 179 checkpoint:

- `finance-job-completion-review` v1 — ACTIVE / JWT enabled;
- `finance-job-completion-posting-approval` v5 — ACTIVE / JWT enabled;
- `admin-it-control` v9 — ACTIVE / JWT enabled.

GitHub repository enforcement remains separately AMBER because `main` is still reported unprotected. Production promotion remains manual.

## Build 180 — accountant mapping readiness and review workflow

The active bounded release is a **human-controlled mapping review control plane** over the existing accounting authorities, not an accounting-policy automation release.

Live catalog facts already verified before design:

- canonical mapping table: `accountant_export_mapping_rules`;
- approval state is `review_status` with allowed states `draft`, `review`, `approved`, `rejected`, `retired`;
- there is no `is_approved` column;
- account selection is `account_id uuid` → `chart_of_accounts(id)`;
- reviewer identity/timestamp already exist as `reviewed_by_profile_id` / `reviewed_at`;
- the three Schema 176 posting mappings — `accounts_receivable`, `service_revenue`, and `sales_tax_payable` — already have account IDs selected but remain in `review`, not `approved`;
- current live mapping selections must not be changed or approved merely to make the pipeline green.

Build 180 adds immutable audit/history, a protected Finance-manage review RPC/endpoint, read-only readiness views, a separately lazy-loaded Finance mapping UI, Admin → I.T. mapping evidence, reasoned review actions, and non-persistent browser acceptance. It must preserve the existing table as canonical rather than creating a parallel mapping authority.

## Security and ownership invariants

- Admin break-glass `manage` across all four modules remains mandatory until deliberately replaced.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner, access level, and boundary mode.
- Finance review, candidate generation, posting approval, preflight, execution, recovery, reversal, and accountant mapping review remain distinct authorities.
- Posting execution release is private/server-owned and cannot be enabled by the browser.
- Accountant/chart mapping approval remains human-controlled; Build 180 may provide the workflow but not make the business decision.
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
8. Apply the database migration in order, then verify drift, dependencies, release assertions, and zero unintended side effects.
9. Deploy changed protected Edge functions after their database dependencies exist; verify JWT/version state.
10. Record exact-main release evidence, update the release rail, clean merged branches/workflows, and verify the final clean-main SHA.
11. Keep Production promotion deliberate/manual.

## Repository hygiene

Git history is the archive. Do not keep stale Markdown, dated archive trees, generated full-schema snapshots, Playwright output, dependencies, logs, temp or backup artifacts in the active tree. Numbered SQL migrations remain permanent audit authority.

The only active project authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate Stripe/PayPal/provider truth, run real-money tests, invent tax/chart policy, change pricing, or promote Production.