# YWI Next Steps and Sanity Check

**Current source/database authority:** Schema `179`  
**Schema 179 release checkpoint:** `c86a373ce14c3aef89b59ba46a63709989eb8cd5`, Run #98 (`33664931778`) — SUCCESS  
**Release evidence:** ID `10`; Release Authority GREEN; repository enforcement separately AMBER  
**Next bounded build:** Build `180` — Finance accountant mapping readiness and review workflow  
**Restart rule:** verify live `179 / 179`, exact-main release evidence, protected function state, and execution/provider switches before extending Schema 180.

## Current checkpoint

Build 179 — Finance permissions, synthetic acceptance and release hardening — is COMPLETE and live.

Verified Schema 179 boundary:

- schema drift `179 / 179`, current;
- exact-main SHA `c86a373ce14c3aef89b59ba46a63709989eb8cd5`;
- Run #98 (`33664931778`) SUCCESS including rendered module and Finance browser suites;
- release evidence ID `10`;
- Release Authority GREEN;
- repository enforcement separately AMBER because `main` is unprotected;
- 12/12 Schema 179 release-hardening assertions passed;
- 16 private non-persistent acceptance scenarios across seven permission/server-control levels;
- zero critical Finance reconciliation issues;
- posting execution release OFF;
- provider mutation OFF;
- Production promotion manual;
- `finance-job-completion-review` v1 ACTIVE / JWT enabled;
- `finance-job-completion-posting-approval` v5 ACTIVE / JWT enabled;
- `admin-it-control` v9 ACTIVE / JWT enabled.

The original Build 175–179 autonomous Finance hardening sequence is complete. Its items 17–20 were: permission enforcement for `hidden`, `view`, `create`, `approve`, `manage` plus Admin break-glass/direct bypass; deterministic synthetic end-to-end acceptance; rendered phone/desktop acceptance; and the full completion-to-accounting release gate.

## Build 180 scope — ACTIVE/NEXT

Build 180 will make the existing accountant/chart mapping prerequisite operationally reviewable without making accounting policy decisions for the user.

Live catalog facts already verified:

- `accountant_export_mapping_rules` is the canonical mapping table;
- approval uses `review_status`; allowed values are `draft`, `review`, `approved`, `rejected`, `retired`;
- no `is_approved` column exists;
- account mapping uses `account_id uuid` referencing `chart_of_accounts(id)`;
- reviewer fields already exist: `reviewed_by_profile_id` and `reviewed_at`;
- Schema 176 considers an account mapping approved only when it is active, `review_status='approved'`, has a non-null account, and the linked chart account is active;
- `accounts_receivable`, `service_revenue`, and `sales_tax_payable` already have account IDs but remain `review` and therefore are not posting-ready;
- these existing account IDs and review states must not be changed merely to satisfy a test or turn the posting pipeline green.

### Build 180 implementation targets

1. Add an immutable mapping-review/audit history recording mapping key, prior/new account reference, prior/new review status, actor, reason, and timestamp.
2. Add protected service-owned mapping review RPCs over the existing canonical mapping table; do not create a parallel mapping authority.
3. Require Finance `manage` for mapping mutation; lower Finance levels may receive bounded read-only readiness according to their module access. Admin break-glass continues to resolve `manage`.
4. Validate account IDs against active `chart_of_accounts` and fail closed on invalid/inactive accounts. Approved account mappings must have a valid active account.
5. Add a read-only posting-mapping readiness view for `accounts_receivable`, `service_revenue`, and conditional `sales_tax_payable`, including reason-coded blocker/action guidance.
6. Add a dedicated protected Finance mapping-review endpoint rather than overloading accountant export/package generation.
7. Add Finance UI showing current mapping/account/review state and manage-only human review controls. Never auto-select or auto-approve an account.
8. Extend Admin → I.T. with mapping readiness/audit health and unresolved human decision visibility.
9. Add deterministic non-persistent/browser-only mapping fixtures and phone/desktop rendered acceptance for visibility, manage controls, denial, bypass rejection, and responsive behavior.
10. Add Schema 180 source/repository/release gates proving execution/provider mutation remain OFF, no Jobs writeback exists, existing mapping selections are not changed by migration/tests, and Production remains manual.

## Restart checks

1. Confirm current `main` exact SHA and any open Build 180 PR head before modifying source.
2. Confirm live DB is `179 / 179` before Schema 180 application, or `180 / 180` after it; never assume.
3. Confirm all schema-dependency contracts through the current expected version pass.
4. Confirm Schema 175–179 Finance assertion families remain green.
5. Confirm all active Admin profiles resolve `manage` on Safety, Finance, Jobs, and Admin.
6. Confirm Finance review, posting, and Admin I.T. protected functions retain JWT verification.
7. Confirm execution release and provider mutation remain OFF.
8. Confirm `accounts_receivable`, `service_revenue`, and `sales_tax_payable` mapping decisions remain human-controlled.
9. Confirm Finance reconciliation has no critical orphan/duplicate/incomplete-pair/reversal divergence.
10. Confirm synthetic/browser acceptance does not mutate live mappings, posting approvals, execution runs, reversals, AR/GL records, Jobs, or providers.
11. Keep Production promotion deliberate/manual.

## Current source gates

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

Build 180 will extend this list with its focused mapping-review and rendered acceptance gates. GitHub rendered-browser acceptance remains required before source-green. Database migration follows exact-main source proof.

## Architecture sanity rules

- Safety / OHSA, Finance, Jobs, and Admin are the only top-level staff modules.
- I.T. Readiness stays inside Admin/manage.
- Shared Core owns canonical identities; modules do not create parallel identity stores.
- Effective permission order is `hidden < view < create < approve < manage`.
- Client visibility never replaces protected server authorization.
- Completion disposition/candidate authority is not posting approval.
- Posting approval is not execution release.
- Preflight is read-only.
- Mapping review is a human accounting authority and is distinct from posting approval/execution.
- Execution remains behind a private server-owned release switch.
- Recovery-required state quarantines retry rather than duplicating accounting effects.
- Reversal preserves original history and creates auditable reversing records.
- Finance does not write back to Jobs through this completion/accounting pipeline.
- Stripe/PayPal/provider/payment mutation remains OFF/outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and must not manufacture proof by mutating business data.

## Database and repository sanity

Keep numbered migrations permanent and ordered through Schema 179 and onward. Do not edit old applied migrations to erase historical assumptions/repairs. Git history is the repository archive; the active tree retains only the three canonical Markdown authorities and excludes stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp and backup artifacts.

## Build sequence

- **Build 175 — Finance posting safety foundation — COMPLETE**
- **Build 176 — Existing accounting-engine mapping and preflight — COMPLETE**
- **Build 177 — Posting execution and recovery — COMPLETE, execution release OFF**
- **Build 178 — Finance operational control plane — COMPLETE**
- **Build 179 — Permissions, synthetic acceptance and release hardening — COMPLETE**
- **Build 180 — Accountant mapping readiness and review workflow — NEXT/ACTIVE**

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate payment providers, conduct real-money tests, invent tax/chart policy, change pricing, or promote Production.