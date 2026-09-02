# YWI Next Steps and Sanity Check

**Current source authority:** Schema `183` — Build 183 Finance mapping decision support **ACTIVE / source review**  
**Verified live database authority:** Schema `182 / 182` until Schema 183 source/browser proof succeeds and the migration is deliberately applied  
**Current live release evidence:** Schema 182 on `main` at `e6d59abc4a6e870445321a7a8ca3cefa2c3cc6f8`, Run #123 (`33691541451`) — SUCCESS  
**Build 183 source branch:** `schema-183-finance-mapping-decision-support`  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Current live runtime:** `finance-account-mapping-review` v3 ACTIVE / JWT enabled; `admin-it-control` v12 ACTIVE / JWT enabled  
**Restart rule:** verify the Build 183 source branch, live `182 / 182`, preserved human mapping decisions, closed execution/provider switches, and exact source/browser proof before applying Schema 183.

## Current checkpoint

Build 183 — **Finance mapping decision support and structural approval compatibility guard** — is ACTIVE in source review. It begins from the completed Schema 182 release-authority boundary and does not expand accounting policy.

The exact problem being fixed is bounded: the existing human mapping screen exposed every active `chart_of_accounts` row for all three mappings, while the Schema 180 RPC required only that an account exist and be active. Build 183 makes structural compatibility explicit and fails closed on incompatible human approval without choosing the account for the user.

Expected structural types:

- `accounts_receivable` → `asset`;
- `service_revenue` → `revenue`;
- `sales_tax_payable` → `liability`.

## Build 183 delivered source scope

1. Adds private read-only `v_finance_account_mapping_decision_support` over the existing canonical mapping rules and active chart accounts.
2. Classifies candidates as `CURRENT_SELECTION`, `SOURCE_IDENTITY_MATCH`, `TYPE_COMPATIBLE`, or `TYPE_MISMATCH` with a deterministic display rank.
3. Adds `approval_eligible` structural evidence without creating another mapping authority or automatic chooser.
4. Keeps detailed chart-account candidate comparison restricted to Finance `manage`; lower Finance levels remain read-only without mapping controls.
5. Extends the existing mapping UI with expected account type, compatible/mismatch labels, candidate counts, and structural health.
6. The browser does **not auto-select** or auto-approve an account and cannot submit server-owned compatibility/rank fields as authoritative mutation data.
7. Adds a client-side warning that prevents sending an explicit approval for a known type mismatch.
8. Replaces the existing Schema 180 mapping-review RPC definition only to add the DB-side approval guard; human `review` and `rejected` decisions remain available.
9. Explicit human `approved` now fails closed if selected `account_type` differs from the canonical expected type, including direct API attempts that bypass the UI.
10. Adds private `v_it_finance_account_mapping_decision_support_status` and a six-assertion decision-support family for structural health.
11. Integrates decision-support status/assertions into Admin → I.T. Readiness without creating a fifth module.
12. Extends deterministic non-persistent/browser-only acceptance across phone/desktop and the full Finance permission ladder.
13. Adds `test:finance-account-mapping-decision-support` to CI and repository smoke authority.
14. Adds Schema 183 dependency contracts for `chart_of_accounts.account_type`, `chart_of_accounts.system_code`, and canonical mapping `source_key`.
15. Adds the Schema 183 I.T. readiness registry item and progress rail.
16. Advances the source schema marker to 183 inside the new migration.
17. Does not mutate current mapping account IDs/review states during migration.
18. Does not create AR/GL postings or write canonical Jobs/work-order state.
19. Keeps posting execution and Stripe/PayPal/provider mutation OFF.
20. Keeps Production promotion deliberate/manual.

## Preserved live decision state

Until Schema 183 is applied, live remains Schema `182 / 182` and the user/accountant decision state remains unchanged:

- `accounts_receivable` → `be9a4805-7a6b-4066-b827-ea7f11b94171` / 1100 Accounts Receivable / `review`;
- `sales_tax_payable` → `18a7d16b-d3a5-4f82-9b82-de7dfe197a70` / 2100 Sales Tax Payable / `review`;
- `service_revenue` → `0210b0e0-d68e-444b-940d-fae9f17e9e9a` / 4000 Landscape Service Revenue / `review`.

Those current account types already align structurally with the Build 183 minimum rules, but Build 183 still does **not** approve them. Mapping-review audit count remains zero. The three unresolved reviews remain stale human accountant/bookkeeper decisions, so mapping observability remains intentionally AMBER while technical drift and preflight contradiction remain zero.

## Build and schema sequence

- **Build 175 — Finance posting safety foundation — COMPLETE**
- **Build 176 — Existing accounting-engine mapping and preflight — COMPLETE**
- **Build 177 — Posting execution and recovery — COMPLETE, execution release OFF**
- **Build 178 — Finance operational control plane — COMPLETE**
- **Build 179 — Permissions, synthetic non-persistent/browser-only acceptance and release hardening — COMPLETE**
- **Build 180 — Accountant mapping readiness and review workflow — COMPLETE**
- **Build 181 — Mapping review aging, drift, and reconciliation observability — COMPLETE**
- **Schema 182 — Release-authority marker convergence — COMPLETE maintenance repair**
- **Build 183 / Schema 183 — Mapping decision support and structural approval guard — ACTIVE**

## Build 183 release sequence

1. Finish source review on `schema-183-finance-mapping-decision-support`.
2. Run the full pull-request CI including the new decision-support source gate and all three rendered browser suites.
3. Repair any source/browser failures on the feature branch; do not touch the live DB while source is red or in progress.
4. Merge only an exact green feature source to `main`.
5. Require exact-main source/browser proof containing Schema 183 before applying the DB migration.
6. Apply `sql/183_finance_account_mapping_decision_support.sql` through Supabase migration authority.
7. Verify live `183 / 183`, Schema 183 assertions, existing Schema 179–181 assertions, and required Finance dependency contracts.
8. Verify the current three mapping account IDs/review states are unchanged and mapping-review audit count did not move as a side effect of release.
9. Verify live decision-support health: exactly three canonical mappings, zero incompatible current selections, and at least one active compatible candidate for each mapping.
10. Deploy the updated JWT-protected `finance-account-mapping-review` and `admin-it-control` functions.
11. Verify runtime versions/status/JWT and live Finance/Admin I.T. reads.
12. Mark the Schema 183 scorecard rail complete only after runtime/schema/source proof agrees.
13. Synchronize these three canonical Markdown authorities from ACTIVE to COMPLETE.
14. Merge final closeout source, prune completed branches, and leave one clean `main`.
15. Require a final exact-main CI proof after cleanup.
16. Record matching Schema 183 release evidence against that final exact SHA/run.
17. Reverify release authority GREEN while repository enforcement may remain separately AMBER if branch protection is still absent.
18. Check Vercel fresh; do not call it green if account/build throttling remains.
19. Keep posting execution/provider mutation OFF and Production manual.
20. Only then select another bounded build.

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
npm run test:finance-account-mapping-review
npm run test:finance-account-mapping-observability
npm run test:finance-account-mapping-decision-support
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
```

Rendered browser acceptance remains mandatory before source-green. Schema 183 DB application follows exact-main source proof.

## Architecture sanity rules

- Safety / OHSA, Finance, Jobs, and Admin are the only top-level staff modules.
- I.T. Readiness stays inside Admin/manage.
- Shared Core owns canonical identities; modules do not create parallel identity stores.
- Effective permission order is `hidden < view < create < approve < manage`.
- Client visibility never replaces protected server authorization.
- Completion disposition/candidate authority is not posting approval.
- Posting approval is not execution release.
- Preflight is read-only.
- Mapping review is a human accounting authority.
- Mapping observability reports aging/drift; it does not make the decision.
- Mapping decision support reports structural compatibility; it does not choose or approve an account.
- Explicit mapping approval requires an active structurally compatible account, enforced by the DB authority.
- Execution remains behind a private server-owned release switch and is **OFF**.
- Finance does not write canonical Jobs state through this completion/accounting pipeline.
- Stripe/PayPal/provider/payment mutation remains OFF/outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and must not manufacture proof by mutating business data.
- Production promotion is deliberate/manual.

## Database and repository sanity

Keep numbered migrations permanent and ordered. Source now includes Schema 183; verified live remains Schema 182 until source gates pass and migration is applied. Do not edit old applied migrations to erase historical assumptions or repairs. Git history is the archive; the active tree retains only the three canonical Markdown authorities and excludes archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, and backup artifacts.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate payment providers, conduct real-money tests, invent tax/chart policy, change pricing, or promote Production.
