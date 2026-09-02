# YWI Active Project Handbook

**Current schema source authority:** `181` — Build 181 ACTIVE  
**Verified live database authority:** `180 / 180` pending exact-main Schema 181 proof and deliberate migration  
**Final clean Schema 180 checkpoint:** `02fa56d7ef456b613278a9ecae568262c3c2410a`, Run #113 (`33687575034`) — SUCCESS  
**Schema 180 release evidence:** ID `12`; Release Authority GREEN; repository enforcement separately AMBER  
**Source:** `RosevearCreations/yw`  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. I.T. is a control-plane section inside Admin, not another business domain.

A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`. Server authorization remains authoritative even when the browser hides a route. Active Admin profiles retain break-glass `manage` across all four modules.

## Architecture progression

### Schemas 159–174 — modular authority and Finance intake
Schemas 159–160 established module permissions, Admin break-glass, and I.T. Readiness. Schemas 161–163 established permission-driven loading and protected Shared Core reads. Schemas 164–168 established fail-closed cross-module contracts/events and canonical job-completion events. Schemas 169–172 established Finance intake, retry/observability, human disposition, and documentary draft candidates. Schemas 173–174 added dependency contracts and repaired the work-order identity chain to canonical UUID.

### Schema 175 — posting safety
Posting approval is separate from completion disposition/candidate approval and carries server-owned idempotency and immutable provenance.

### Schema 176 — existing accounting-engine preflight
Finance candidates map onto existing `job_invoice_postings` → `ar_invoices`, `job_journal_postings` → `gl_journal_batches` / `gl_journal_entries`, and `accountant_export_mapping_rules` → `chart_of_accounts`. Preflight is read-only; accountant/bookkeeper mapping approval remains required.

### Schema 177 — execution, recovery and reversal
Atomic AR + balanced GL execution, durable idempotency, recovery quarantine, and auditable reversal are installed behind a server-owned release. Posting execution and provider mutation remain OFF.

### Schema 178 — operational control plane
One read-only lifecycle spans intake → disposition → candidates → posting approval → preflight → execution/recovery → reversal, with reason-coded blockers, reconciliation, and Admin → I.T. Finance health.

### Schema 179 — Finance permissions, synthetic acceptance and release hardening — COMPLETE
Build 179 completed the original Finance hardening sequence with permission-matrix contracts, direct-bypass guards, JWT protection, deterministic synthetic non-persistent/browser-only fixtures, rendered phone/desktop acceptance, Admin → I.T. evidence, and a 12-assertion release-hardening family. Posting execution/provider mutation remained OFF and Jobs writeback prohibited.

### Schema 180 — accountant mapping readiness and review workflow — COMPLETE
Build 180 operationalized the existing accountant/chart mapping prerequisite without making accounting-policy decisions for the user. `accountant_export_mapping_rules` remains canonical; approval is `review_status='approved'`; human review mutation is protected by service-role plus DB-side Finance `manage`; selected accounts must resolve to active `chart_of_accounts`; every actual review action writes immutable private human-review audit history.

The final post-prune Schema 180 source checkpoint is `02fa56d7ef456b613278a9ecae568262c3c2410a`, Run #113 (`33687575034`) SUCCESS, release evidence ID `12`. The database is `180 / 180`, Schema 180 assertions are 8/8, prior Schema 179 assertions are 12/12, and Finance dependencies are 62/62. All three posting mappings retain their original selected account IDs and remain `review`; release-created review audit/posting effects remain zero. Posting execution and provider mutation remain OFF.

### Schema 181 — mapping aging, drift and reconciliation observability — ACTIVE

Build 181 adds **derived read-only observability**, not another accounting authority. Its source design is bounded to:

- human-review age derived from canonical `reviewed_at`, mapping `updated_at`, and `created_at`;
- technical classification of pending review as recent, aging at 7+ days, or stale at 30+ days without treating that human backlog as an I.T. failure;
- true drift detection for inactive/missing account state, immutable-review/current-state disagreement, and approved mappings without valid review evidence;
- a separate recheck warning when an approved chart account changes after the recorded human review;
- reconciliation of each canonical mapping with Schema 176 generated-pair blocker codes (`AR_ACCOUNT_MAPPING_NOT_APPROVED`, `REVENUE_ACCOUNT_MAPPING_NOT_APPROVED`, and conditional `TAX_ACCOUNT_MAPPING_NOT_APPROVED`);
- neutral `NO_GENERATED_PAIR_SAMPLE` status when no current generated pair exercises a mapping;
- Finance UI and Admin → I.T. reason codes separating **human decision backlog (AMBER)** from **technical contradictions (RED)**;
- deterministic synthetic non-persistent/browser-only acceptance across `hidden`, `view`, `create`, `approve`, and `manage` on phone and desktop.

Build 181 deliberately creates **no new table** and **no new mutation endpoint**. The existing Schema 180 `review_mapping` workflow remains the only mapping mutation authority. Build 181 does not insert into the immutable human-review audit, modify `accountant_export_mapping_rules` or `chart_of_accounts`, enable execution/provider mutation, write Jobs state, invent tax/chart policy, or promote Production.

## Security and ownership invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory until deliberately replaced.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner, access level, and boundary mode.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, accountant mapping review, and mapping observability remain separate concerns.
- Posting execution release is private/server-owned and cannot be enabled by the browser.
- Accountant/chart mapping choices and approvals remain human-controlled.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only.
- I.T. Readiness may report or block a release but cannot auto-promote Production.
- Production promotion remains deliberate/manual.

## Build 181 release discipline

1. Start from the clean Schema 180 `main` checkpoint `02fa56d7ef456b613278a9ecae568262c3c2410a` and verified live `180 / 180` evidence.
2. Query live catalog types and existing preflight/lifecycle columns before adding Schema 181 dependencies; never guess types.
3. Preserve all existing mapping account IDs/review states during source tests and migration.
4. Run the dedicated `test:finance-account-mapping-observability` plus every existing source/security gate on the bounded feature branch.
5. Run rendered mapping acceptance on real client code using deterministic non-persistent fixtures.
6. Merge only an exact green PR head.
7. Require a separate exact-main green run before applying Schema 181.
8. Apply Schema 181 with the canonical migration applicator, then verify schema drift, dependencies, Schema 180/181 assertions, mapping identity preservation, zero new review-audit/posting effects, and both execution switches OFF.
9. Deploy only the changed protected functions (`finance-account-mapping-review` and `admin-it-control`) after database dependencies exist; verify JWT/version state.
10. Record exact-main release evidence, complete the Schema 181 rail, synchronize these three canonical documents, prune completed branches, and prove final clean-main CI.
11. Keep Production promotion deliberate/manual.

## Repository hygiene

Git history is the archive. Do not keep stale Markdown, archive trees, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts in the active tree. Numbered SQL migrations remain permanent audit authority and the source chain is now ordered through Schema 181; the live DB remains Schema 180 until migration proof is complete.

The only active project authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate Stripe/PayPal/provider truth, run real-money tests, invent tax/chart policy, change pricing, or promote Production.
