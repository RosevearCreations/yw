# Yard Weasels Inc. Operations Platform

**Current source authority:** Schema `183` — Build 183 Finance mapping decision support **ACTIVE / source review**  
**Verified live database authority:** Schema `182 / 182` until Schema 183 passes source/browser gates and is deliberately applied  
**Current live release evidence:** Schema 182 on `main` at `e6d59abc4a6e870445321a7a8ca3cefa2c3cc6f8`, Run #123 (`33691541451`) — SUCCESS  
**Build 183 source branch:** `schema-183-finance-mapping-decision-support`  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Current live runtime:** `finance-account-mapping-review` v3 ACTIVE / JWT enabled; `admin-it-control` v12 ACTIVE / JWT enabled  
**Active documents:** this README, `docs/ACTIVE_PROJECT_HANDBOOK.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Yard Weasels has exactly four top-level staff modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin/manage control-plane section, never a fifth business module.

## Current architecture

- **Schemas 159–160:** module permissions, Admin break-glass access, and I.T. Readiness.
- **Schemas 161–163:** shared module contract, permission-driven lazy loading, and protected Shared Core reads.
- **Schemas 164–168:** fail-closed cross-module writes/events and canonical job-completion event wiring.
- **Schemas 169–172:** Finance completion intake, retry/observability, human disposition, and documentary draft candidates.
- **Schemas 173–174:** dependency contracts and canonical UUID convergence.
- **Schema 175:** separate posting approval, idempotency, provenance, and execution guards.
- **Schema 176:** read-only posting preflight mapped onto the existing AR/GL engine and accountant-approved account mappings.
- **Schema 177:** atomic AR/GL execution/recovery/reversal machinery behind a private server-owned execution release that remains **OFF**.
- **Schema 178:** completion-to-accounting lifecycle, blocker codes, reconciliation, and Admin → I.T. Finance readiness.
- **Schema 179:** Finance permission matrix, direct-bypass guards, synthetic non-persistent/browser-only acceptance, JWT hardening, and full release gate.
- **Schema 180 / Build 180 — COMPLETE:** human-controlled accountant mapping review over the existing `accountant_export_mapping_rules` → `chart_of_accounts` authority, immutable review audit, protected Finance-manage workflow, Admin → I.T. mapping readiness, and rendered acceptance.
- **Schema 181 / Build 181 — COMPLETE:** read-only human-review aging, mapping/account drift detection, posting-preflight reconciliation, Finance UI observability, Admin → I.T. guidance, and rendered acceptance.
- **Schema 182 — COMPLETE maintenance repair:** advances the release-authority schema marker that Schema 181 omitted without altering Build 181 business behavior.
- **Schema 183 / Build 183 — ACTIVE:** structural chart-account decision support and an approval compatibility guard around the existing human mapping authority.

## Build 183 scope

Build 183 addresses one specific safety gap: the human mapping UI previously offered every active chart account and the database only verified that the selected account existed and was active. Build 183 adds structural decision support without making accounting-policy decisions.

For the three existing canonical mappings, the expected structural account types are:

- `accounts_receivable` → **asset**;
- `service_revenue` → **revenue**;
- `sales_tax_payable` → **liability**.

Build 183 adds a private read-only candidate view that ranks active chart accounts as `CURRENT_SELECTION`, `SOURCE_IDENTITY_MATCH`, `TYPE_COMPATIBLE`, or `TYPE_MISMATCH`. Finance/manage users can compare the existing chart accounts, while lower Finance access levels retain the existing read-only review/observability surfaces. The browser does **not auto-select** an account and does **not auto-approve** a mapping.

The existing `ywi_finance_review_account_mapping(...)` RPC remains the mapping mutation authority. A human Finance/manage user may still save a mapping for review or reject it with a reason. Explicit approval now fails closed if the selected account's `account_type` does not match the canonical mapping's expected type. This is a structural safety guard, not an accountant recommendation and not a new chart-of-accounts policy engine.

Admin → I.T. Readiness receives a dedicated structural decision-support status and assertion family so it can distinguish a human review backlog from a true technical problem such as a current selection with the wrong account type or a mapping with no active compatible candidate.

## Current preserved live boundary

Until Schema 183 is source-proven and applied, live remains Schema `182 / 182` with:

- Schema 181 assertions: **8 / 8 PASS**;
- Schema 180 assertions: **8 / 8 PASS**;
- Schema 179 assertions: **12 / 12 PASS**;
- required Finance dependencies: **79 / 79 PASS**;
- all three canonical mapping account IDs unchanged and all three review states still `review`;
- mapping-review audit events: **0**;
- technical mapping drift: **0**;
- preflight contradiction: **0**;
- posting execution release: **OFF**;
- provider mutation: **OFF**;
- Finance completion/accounting Jobs writeback prohibited;
- Production promotion deliberate/manual.

Live mapping observability remains intentionally **AMBER** because the three unresolved accountant/bookkeeper reviews are stale. That is a human accounting decision backlog, not an application or migration failure.

Build 183 deliberately does **not** choose a live account, approve/reject a mapping, alter the current mapping rows during migration, enable posting execution, mutate Stripe/PayPal/provider truth, write Jobs state, invent tax/chart policy, or promote Production.

## Non-negotiable boundaries

- Server authorization is authoritative; hidden navigation is not security.
- Finance access remains `hidden < view < create < approve < manage`.
- Admin break-glass `manage` remains across all four modules.
- Shared Core identities remain centrally owned and read-only to consumers.
- Cross-module writes require declared ownership and fail closed when undeclared.
- Finance disposition, candidate generation, posting approval, preflight, execution, recovery, reversal, mapping review, mapping observability, and mapping decision support remain separate concerns.
- Posting execution release is server-owned and remains **OFF**.
- Accountant/chart mapping choices and approvals remain human decisions.
- Structural compatibility is a safety prerequisite for approval, not an automatic accounting decision.
- Finance completion/accounting flows do not write canonical Jobs state.
- Stripe, PayPal, provider, and payment truth remain outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and cannot manufacture release evidence through live business-data mutation.
- I.T. Readiness reports blockers; it does not auto-promote Production.
- Production promotion remains deliberate/manual.

## Database and repository authority

Every numbered migration in `sql/` is permanent audit history. The source migration chain now contains Schema 183, while the verified live database remains `182 / 182` until the new migration passes exact-source review and is applied. Git history is the archive; do not restore stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, or backup artifacts.

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
npm run test:finance-account-mapping-observability
npm run test:finance-account-mapping-decision-support
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
```

Rendered browser acceptance is mandatory before source-green. Schema 183 database application follows successful source/browser proof and never precedes it. Deployment evidence is separate from source correctness and must be freshly verified before deployment is called green.
