# YWI Active Project Handbook

**Current schema source/database authority:** `180` — Build 180 COMPLETE  
**Schema 180 merged checkpoint:** `b37491932ac1d6dbac7917bd9848d8ca120fb6e9`, Run #109 (`33673018358`) — SUCCESS  
**Schema 180 release evidence:** ID `11`; Release Authority GREEN; repository enforcement separately AMBER  
**Next bounded build:** Build `181` — Finance mapping review aging, drift, and reconciliation observability  
**Source:** `RosevearCreations/yw`  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. I.T. is a control-plane section inside Admin, not another business domain.

A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`. Server authorization remains authoritative even when the browser hides a route. Active Admin profiles retain break-glass `manage` across all four modules.

## Architecture progression

### Schemas 159–174 — modular authority and Finance intake
Schemas 159–160 established module permissions, Admin break-glass, and I.T. Readiness. Schemas 161–163 established permission-driven lazy loading and protected Shared Core reads. Schemas 164–168 established fail-closed cross-module contracts/events and canonical job-completion events. Schemas 169–172 established Finance intake, observability/retry, human disposition, and documentary draft candidates. Schemas 173–174 added dependency contracts and repaired the work-order identity chain to canonical UUID.

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
Build 180 operationalized the existing accountant/chart mapping prerequisite without making accounting-policy decisions for the user.

Canonical facts and delivered authority:

- `accountant_export_mapping_rules` remains the mapping source of truth; no parallel mapping table was created;
- approval is `review_status='approved'`; there is no invented `is_approved` field;
- account selection remains `account_id uuid` → `chart_of_accounts(id)`;
- the review mutation is service-role-only with DB-side Finance `manage` defense in depth;
- only `accounts_receivable`, `service_revenue`, and `sales_tax_payable` are in the bounded posting-mapping workflow;
- selected accounts must exist and be active; approval requires an account;
- every human review action creates immutable private audit history;
- Finance view can inspect readiness; Finance manage can select/review through the protected endpoint/UI;
- Admin → I.T. exposes mapping readiness and the Schema 180 assertion family;
- deterministic rendered acceptance is non-persistent and does not touch live mapping/accounting/provider state.

## Build 180 release proof

Schema 180 is live at `180 / 180`. Exact-main Run #109 on `b37491932ac1d6dbac7917bd9848d8ca120fb6e9` passed all source/static and rendered browser gates before migration. Release evidence ID `11` binds that source to Schema 180.

Post-migration proof:

- Schema 180 mapping assertions: **8 / 8 PASS**;
- Schema 179 release-hardening assertions: **12 / 12 PASS**;
- required Finance dependency contracts through 180: **62 / 62 PASS**;
- all three active Admin profiles retain four-module break-glass `manage`;
- `accounts_receivable` retained account `be9a4805-7a6b-4066-b827-ea7f11b94171` and remains `review`;
- `sales_tax_payable` retained account `18a7d16b-d3a5-4f82-9b82-de7dfe197a70` and remains `review`;
- `service_revenue` retained account `0210b0e0-d68e-444b-940d-fae9f17e9e9a` and remains `review`;
- release-created mapping review audit events: **0**;
- release-created posting approvals, execution runs, reversals, invoice postings, and journal postings: **0**;
- posting execution release OFF; provider mutation OFF;
- `finance-account-mapping-review` v2 ACTIVE / JWT enabled;
- `admin-it-control` v10 ACTIVE / JWT enabled.

Mapping readiness remains intentionally **AMBER** because human accountant/bookkeeper review is still pending. Application Release Authority is GREEN. Repository enforcement is separately AMBER because `main` remains reported unprotected. Production promotion remains manual.

## Security and ownership invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory until deliberately replaced.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner, access level, and boundary mode.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, and accountant mapping review are distinct authorities.
- Posting execution release is private/server-owned and cannot be enabled by the browser.
- Accountant/chart mapping choices and approvals remain human-controlled.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only.
- I.T. Readiness may report or block a release but cannot auto-promote Production.

## Next bounded release — Build 181

Build 181 is limited to **read-only Finance mapping review aging, drift, and reconciliation observability**. Safe targets include pending-review age/staleness, detection of account/activity/status drift after a human review, immutable observation history, comparison against Finance preflight/release evidence, and reasoned Admin → I.T. guidance.

Build 181 must not choose an account, approve/reject a mapping for the user, enable Finance execution/provider mutation, write Jobs state, invent tax/chart policy, conduct real-money testing, or promote Production.

## Release discipline

1. Start from exact current `main` plus verified live schema evidence.
2. Query live catalog types/relationships before adding schema dependencies; never guess identity types.
3. Preserve every applied numbered migration.
4. Run all source/security gates on a bounded feature branch.
5. Use deterministic non-persistent fixtures where live mutation is inappropriate.
6. Merge only an exact green PR head.
7. Require exact-main CI before applying a migration.
8. Verify drift, dependencies, assertions, and zero unintended effects after migration.
9. Deploy changed protected Edge functions after DB dependencies exist and verify JWT/version state.
10. Record exact-main release evidence, update the release rail, clean merged branches/workflows, and verify final clean-main source.
11. Keep Production promotion deliberate/manual.

## Repository hygiene

Git history is the archive. Do not keep stale Markdown, archive trees, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts in the active tree. Numbered SQL migrations remain permanent audit authority.

The only active project authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate Stripe/PayPal/provider truth, run real-money tests, invent tax/chart policy, change pricing, or promote Production.