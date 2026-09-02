# YWI Active Project Handbook

**Current schema source authority:** `183` — Build 183 Finance mapping decision support **ACTIVE / source review**  
**Verified live database authority:** `182 / 182` until Schema 183 source/browser proof succeeds and the migration is deliberately applied  
**Current live release evidence:** Schema 182 on `main` at `e6d59abc4a6e870445321a7a8ca3cefa2c3cc6f8`, Run #123 (`33691541451`) — SUCCESS  
**Build 183 source branch:** `schema-183-finance-mapping-decision-support`  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Current live runtime:** `finance-account-mapping-review` v3 ACTIVE / JWT enabled; `admin-it-control` v12 ACTIVE / JWT enabled  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
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
Atomic AR + balanced GL execution, durable idempotency, recovery quarantine, and auditable reversal are installed behind a private server-owned release. Posting execution and provider mutation remain **OFF**.

### Schema 178 — operational control plane
One read-only lifecycle spans intake → disposition → candidates → posting approval → preflight → execution/recovery → reversal, with reason-coded blockers, reconciliation, and Admin → I.T. Finance health.

### Schema 179 — permissions, synthetic acceptance and release hardening — COMPLETE
Build 179 completed the Finance hardening sequence with permission-matrix contracts, direct-bypass guards, JWT protection, deterministic synthetic non-persistent/browser-only fixtures, rendered phone/desktop acceptance, Admin → I.T. evidence, and a 12-assertion release-hardening family. Posting execution/provider mutation remained OFF and Jobs writeback prohibited.

### Schema 180 / Build 180 — accountant mapping review — COMPLETE
`accountant_export_mapping_rules` remains canonical. Mapping review is a human accounting action, protected by service-role transport plus DB-side Finance `manage`. Every actual human review action writes immutable private audit history. Build 180 did not choose or approve the user's mappings.

### Schema 181 / Build 181 — mapping observability — COMPLETE
Build 181 adds derived read-only human-review aging, mapping/account/audit drift detection, posting-preflight reconciliation, Finance UI evidence, and Admin → I.T. reason codes. Human backlog is separated from technical failure.

### Schema 182 — release-authority convergence — COMPLETE maintenance repair
Schema 182 advances the hard-coded schema marker that Schema 181 omitted. It changes only release-control-plane authority and does not alter Finance mappings, accounting records, Jobs state, providers, or Production.

### Schema 183 / Build 183 — Finance mapping decision support — ACTIVE

Build 183 closes a bounded safety gap around the existing Schema 180 human mapping workflow. Previously, Finance/manage could see every active chart account and the DB approval RPC verified only that the selected account existed and was active. Build 183 adds structural account-type decision support and a fail-closed compatibility requirement for explicit human approval.

Canonical structural expectations are intentionally narrow and derived from the existing posting roles:

- `accounts_receivable` requires an **asset** account;
- `service_revenue` requires a **revenue** account;
- `sales_tax_payable` requires a **liability** account.

The private `v_finance_account_mapping_decision_support` surface compares each canonical mapping with active chart accounts and classifies candidates as `CURRENT_SELECTION`, `SOURCE_IDENTITY_MATCH`, `TYPE_COMPATIBLE`, or `TYPE_MISMATCH`. It also exposes an ordering/rank to help a human compare candidates. The ranking is decision support only; it does **not auto-select** an account, does not recommend accounting policy as truth, and cannot auto-approve a mapping.

The existing `ywi_finance_review_account_mapping(...)` RPC remains the sole mapping mutation authority. Review and reject actions remain human-controlled. On explicit `approved`, the DB now additionally requires the selected active account to have the canonical expected `account_type`. A structurally incompatible approval fails closed even if a browser attempts to bypass the UI.

Admin → I.T. Readiness receives a dedicated decision-support health status and assertion family. A human mapping review may remain AMBER/pending while structural support remains GREEN. I.T. turns RED only for a real condition such as an incompatible current selection, a mapping with no active compatible account candidate, or an unexpected execution/provider release.

Build 183 adds no parallel mapping table and no additional mapping mutation endpoint.

## Current preserved live state before Schema 183 application

Live remains Schema `182 / 182` with:

- Schema 181 assertions `8 / 8` PASS;
- Schema 180 assertions `8 / 8` PASS;
- Schema 179 assertions `12 / 12` PASS;
- required Finance dependency contracts `79 / 79` PASS;
- current mapping rows unchanged:
  - Accounts Receivable → account `1100`, `review`;
  - Sales Tax Payable → account `2100`, `review`;
  - Service Revenue → account `4000`, `review`;
- mapping-review audit events `0`;
- technical mapping drift `0`;
- preflight contradiction `0`;
- posting execution release **OFF**;
- provider mutation OFF;
- Finance completion/accounting Jobs writeback prohibited;
- Production promotion manual.

The three stale human reviews remain an accounting decision backlog, not a migration/I.T. error.

## Build 183 security and ownership rules

- Human account selection and approval remain Finance/manage decisions.
- Build 183 does not choose, auto-select, or auto-approve a live account.
- Structural type compatibility is a minimum safety prerequisite for approval, not a substitute for accountant judgment.
- A client-side compatibility warning is convenience only; the DB RPC is the authoritative approval guard.
- Server-owned compatibility/rank fields are rejected if supplied in a mutation request.
- Read-only candidate detail is restricted to Finance/manage; lower Finance levels retain read-only mapping readiness/observability without account-choice controls.
- No new mapping authority table is introduced.
- No AR/GL posting records are created by Build 183.
- Posting execution release remains OFF and provider mutation remains OFF.
- Finance does not write canonical Jobs/work-order state through this pipeline.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Production promotion remains deliberate/manual.

## System-wide invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory until deliberately replaced.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner, access level, and boundary mode.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, accountant mapping review, mapping observability, and mapping decision support remain separate concerns.
- Synthetic acceptance is non-persistent/browser-only.
- I.T. Readiness may report or block a release but cannot auto-promote Production.

## Restart discipline during Build 183

1. Verify the Build 183 source branch descends from the proven Schema 182 `main` SHA.
2. Keep live DB at `182 / 182` until Build 183 PR/static/rendered acceptance is green.
3. Preserve all three human mapping account IDs/review states unless a real accountant/bookkeeper explicitly changes them.
4. Verify new decision-support source gates and existing Schema 179–181 gates remain green.
5. After source proof, merge the exact feature source to `main`, obtain exact-main proof, then apply Schema 183.
6. Verify Schema 183 structural assertions, prior assertions, dependency contracts, and current mapping preservation live.
7. Deploy the updated JWT-protected Finance mapping and Admin I.T. functions only after source/schema convergence.
8. Keep posting execution/provider mutation OFF and Production manual.
9. Record exact-final-main release evidence only after the final clean-main CI succeeds.
10. Prune completed feature/temporary branches and leave one clean `main`.

## Repository hygiene

Git history is the archive. Do not keep stale Markdown, archive trees, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts in the active tree. Numbered SQL migrations remain permanent audit authority. The source chain now includes Schema 183; the verified live chain remains Schema 182 until this build is applied.

The only active project authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate Stripe/PayPal/provider truth, run real-money tests, invent tax/chart policy, change pricing, or promote Production.
