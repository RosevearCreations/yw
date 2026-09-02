# YWI Active Project Handbook

**Current schema authority:** `183 / 183` — **Build 183 COMPLETE**  
**Merged product checkpoint:** `e0e4628594a66f10347cf4b7c915f65fce57da79`, exact-main Run #128 (`33696331201`) — SUCCESS  
**Runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v13 ACTIVE / JWT enabled  
**Repository enforcement:** AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`; server authorization remains authoritative. Active Admin profiles retain break-glass `manage` across all four modules.

## Finance architecture progression

- Schemas 159–174 established modular permissions, Shared Core, fail-closed cross-module events, canonical job completion, Finance intake/review, and dependency convergence.
- Schema 175 separated human posting approval from completion disposition and added idempotency/provenance.
- Schema 176 mapped Finance candidates into the existing AR/GL accounting engine with read-only preflight.
- Schema 177 installed execution/recovery/reversal behind a private server-owned execution release that remains **OFF**.
- Schema 178 added lifecycle, blocker, reconciliation, and Admin → I.T. Finance health.
- Schema 179 / Build 179 — **COMPLETE**: Finance permissions, direct-bypass protection, synthetic non-persistent/browser-only acceptance, and release hardening.
- Schema 180 / Build 180 — **COMPLETE**: human accountant/bookkeeper mapping review and immutable audit over the existing canonical mapping table.
- Schema 181 / Build 181 — **COMPLETE**: human-review aging, technical drift, and posting-preflight reconciliation observability.
- Schema 182 — **COMPLETE maintenance repair**: release marker convergence with no business mutation.
- Schema 183 / Build 183 — **COMPLETE**: structural chart-account decision support and DB-side approval compatibility enforcement.

## Build 183 authority

Build 183 did not add another mapping table or another mutation endpoint. It adds private read-only decision support over the existing `accountant_export_mapping_rules` → `chart_of_accounts` authority.

Canonical structural minimums are:

- Accounts Receivable → `asset`;
- Service Revenue → `revenue`;
- Sales Tax Payable → `liability`.

Active candidates are classified as `CURRENT_SELECTION`, `SOURCE_IDENTITY_MATCH`, `TYPE_COMPATIBLE`, or `TYPE_MISMATCH`. Finance/manage sees the candidate comparison; lower Finance access remains read-only without mapping-decision controls. The browser does **not auto-select** or auto-approve a chart account.

The existing `ywi_finance_review_account_mapping(...)` RPC remains the sole mapping mutation authority. Human `review` and `rejected` states remain valid. Human `approved` additionally requires the selected active account to have the expected structural `account_type`; incompatible approval fails closed in the DB even when the client is bypassed.

Admin → I.T. Readiness now includes structural decision-support status and assertions. A stale human decision queue remains AMBER; structural incompatibility or a missing compatible candidate is a true technical blocker.

## Verified Build 183 live state

- Schema `183 / 183` current.
- Build 183 assertions: **6 / 6 PASS**.
- Build 181 assertions: **8 / 8 PASS**.
- Build 180 assertions: **8 / 8 PASS**.
- Build 179 assertions: **12 / 12 PASS**.
- Required dependency contracts: **82 / 82 PASS**.
- Active Admin break-glass integrity: **3 admins / 0 blockers**.
- Compatible active chart-account candidates: **10**.
- Type-mismatch candidates visible for comparison: **38**.
- Incompatible current selections: **0**.
- Mappings without an eligible active account: **0**.
- Current human-selected mappings are unchanged:
  - `accounts_receivable` → 1100 Accounts Receivable / asset / `review`;
  - `sales_tax_payable` → 2100 Sales Tax Payable / liability / `review`;
  - `service_revenue` → 4000 Landscape Service Revenue / revenue / `review`.
- Mapping-review audit count remains **0**.
- Mapping observability remains AMBER only because all three human reviews are stale; technical drift **0**, preflight contradiction **0**.
- `finance-account-mapping-review` v4 and `admin-it-control` v13 are ACTIVE with JWT verification enabled.
- Posting execution release OFF; provider mutation OFF; canonical Jobs writeback prohibited; Production manual.

## Security and ownership invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory.
- I.T. Readiness stays inside Admin/manage, not as a fifth module.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner/access/boundary contract.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, mapping review, mapping observability, and decision support remain separate concerns.
- Accountant/bookkeeper mapping selection and approval remain human decisions.
- Structural compatibility is a safety floor, not automatic accounting policy.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only.
- Production promotion remains deliberate/manual.

## Restart discipline after Build 183

1. Start from the single clean `main` branch after closeout cleanup.
2. Verify the latest exact-main workflow is SUCCESS and matches the Schema 183 release-evidence row.
3. Verify live database remains `183 / 183`.
4. Verify Build 179–181 and 183 assertion families plus all required dependencies remain green.
5. Preserve the three human mapping decisions unless an accountant/bookkeeper explicitly changes them.
6. Verify decision support remains GREEN: 3 mappings, 0 incompatible current selections, and no mapping without an eligible candidate.
7. Treat stale mapping review as human AMBER unless true drift/compatibility/preflight contradiction appears.
8. Verify Finance mapping and Admin I.T. functions remain JWT protected.
9. Keep execution release/provider mutation OFF and Production manual unless explicitly authorized.
10. Define any next bounded build from this authority without silently expanding accounting/payment policy.

## Repository hygiene

Git history is the archive. Numbered migrations are permanent audit history through Schema 183. Do not keep archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup files in the active source tree.

The only active authority documents are `README.md`, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

The final exact clean-main source SHA/run is stored in `it_release_source_evidence` after branch cleanup and final CI.

## Human-gated items

Do not autonomously approve chart mappings, choose different live mapping accounts, enable Finance posting execution, mutate Stripe/PayPal/provider truth, run real-money tests, invent tax/chart policy, change pricing, or promote Production.
