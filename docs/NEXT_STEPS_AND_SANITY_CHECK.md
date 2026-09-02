# YWI Next Steps and Sanity Check

**Current source authority:** Schema `181` — Build 181 ACTIVE  
**Verified live database authority:** Schema `180 / 180` until exact-main Schema 181 proof and deliberate migration  
**Final clean Schema 180 checkpoint:** `02fa56d7ef456b613278a9ecae568262c3c2410a`, Run #113 (`33687575034`) — SUCCESS  
**Schema 180 release evidence:** ID `12`; Release Authority GREEN; repository enforcement separately AMBER  
**Active bounded build:** Build `181` — Finance mapping review aging, drift, and reconciliation observability  
**Restart rule:** verify the current Build 181 branch/PR head, live `180 / 180` or `181 / 181` state, mapping decisions, release switches, and protected function versions before changing source or applying the migration.

## Current checkpoint

Build 180 — Finance accountant mapping readiness and review workflow — is **COMPLETE** and live.

Final clean Schema 180 boundary:

- schema drift `180 / 180`, current;
- clean-main SHA `02fa56d7ef456b613278a9ecae568262c3c2410a`;
- Run #113 (`33687575034`) SUCCESS including all source gates and rendered module, Finance lifecycle, and Finance mapping browser suites;
- release evidence ID `12`;
- Release Authority GREEN;
- repository enforcement separately AMBER because `main` is unprotected;
- Schema 180 mapping assertions `8 / 8` PASS;
- prior Schema 179 hardening assertions `12 / 12` PASS;
- required Finance dependencies through Schema 180 `62 / 62` PASS;
- all active Admin profiles retain `manage` on Safety, Finance, Jobs, and Admin;
- posting execution release OFF;
- provider mutation OFF;
- Production promotion manual;
- `finance-account-mapping-review` v2 ACTIVE / JWT enabled;
- `admin-it-control` v10 ACTIVE / JWT enabled;
- completed Schema 180 branches pruned; one clean `main` branch existed at the Build 181 start boundary.

## Mapping decision preservation proof

Build 180 did not make accounting decisions on the user's behalf. The live decision state entering Build 181 remains:

- `accounts_receivable` = `be9a4805-7a6b-4066-b827-ea7f11b94171`, `review`;
- `sales_tax_payable` = `18a7d16b-d3a5-4f82-9b82-de7dfe197a70`, `review`;
- `service_revenue` = `0210b0e0-d68e-444b-940d-fae9f17e9e9a`, `review`.

All three linked chart accounts are active. Reviewer identity/timestamp remain null and release-created mapping audit count is zero. Their mapping rows were last updated June 25, 2026, so Build 181 should classify the unresolved human review as stale while keeping true technical drift at zero if no canonical state changed.

Mapping readiness is intentionally **AMBER** because explicit human accountant/bookkeeper approval is pending. This is not an I.T. migration failure and does not turn application Release Authority red.

## Build sequence

- **Build 175 — Finance posting safety foundation — COMPLETE**
- **Build 176 — Existing accounting-engine mapping and preflight — COMPLETE**
- **Build 177 — Posting execution and recovery — COMPLETE, execution release OFF**
- **Build 178 — Finance operational control plane — COMPLETE**
- **Build 179 — Permissions, synthetic non-persistent/browser-only acceptance and release hardening — COMPLETE**
- **Build 180 — Accountant mapping readiness and review workflow — COMPLETE**
- **Build 181 — Mapping review aging, drift, and reconciliation observability — ACTIVE**

## Build 181 implementation scope

Schema 181 is deliberately **read-only derived observability** over existing authorities. It does not create another mapping table or mutation path.

1. Derive pending human-review age from canonical review/update timestamps.
2. Classify unresolved review as recent, aging at 7+ days, or stale at 30+ days without treating age alone as a technical failure.
3. Detect true technical drift: inactive canonical mapping/account, immutable human-review/current-state mismatch, or an approved mapping missing valid review evidence.
4. Flag chart-account metadata changes after a human approval as a recheck warning, not an automatic invalidation or reapproval.
5. Reconcile canonical mapping approval with Schema 176 generated-pair blocker codes for AR, service revenue, and conditional non-zero-tax sales-tax mappings.
6. Return neutral `NO_GENERATED_PAIR_SAMPLE` when there is no live generated pair to compare against preflight.
7. Expose reason-coded Finance UI and Admin → I.T. evidence distinguishing human backlog (AMBER) from technical contradiction (RED).
8. Extend the existing protected `finance-account-mapping-review` **list** action only; `review_mapping` remains the sole mapping mutation authority.
9. Add deterministic non-persistent/browser-only phone/desktop acceptance across `hidden`, `view`, `create`, `approve`, and `manage`.
10. Keep posting execution/provider mutation OFF, prohibit Jobs writeback, preserve Stripe/PayPal/provider truth, and keep Production manual.

## Current Build 181 source artifacts

- `sql/181_finance_account_mapping_observability.sql`
- `scripts/finance-account-mapping-observability-check.mjs`
- `v_finance_account_mapping_observability` source definition
- `v_it_finance_account_mapping_observability_status` source definition
- `ywi_finance_account_mapping_observability_assertions()` source definition
- protected Finance mapping endpoint list integration
- Finance mapping observability UI
- Admin → I.T. source/assertion integration
- deterministic mapping observability fixtures and rendered acceptance
- CI/repository smoke integration

## Restart checks

1. Confirm exact current Build 181 branch/PR head and `main`; never assume the previous SHA is still current.
2. Confirm live database is `180 / 180` until Schema 181 is deliberately applied, or `181 / 181` afterward.
3. Before migration, confirm the three canonical mapping IDs/account IDs/review states still match the captured Build 180 boundary or document a real human change.
4. Confirm Schema 175–180 Finance assertion families remain green and Finance dependency contracts through 180 pass.
5. Confirm all active Admin profiles retain four-module break-glass `manage`.
6. Confirm Finance review/posting/mapping and Admin I.T. functions retain JWT verification.
7. Confirm execution release and provider mutation remain OFF.
8. Confirm Finance reconciliation has no critical orphan/duplicate/incomplete-pair/reversal divergence.
9. Confirm synthetic/browser acceptance is non-persistent and cannot mutate mappings, audit history, accounting, Jobs, or providers.
10. Require full PR CI and rendered acceptance before merge, then a separate exact-main green run before Schema 181 migration.
11. Keep Production promotion manual.

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
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
npm run test:browser:finance-mapping
```

Rendered browser acceptance remains mandatory before source-green. Database migration follows exact-main source proof.

## Architecture sanity rules

- Safety / OHSA, Finance, Jobs, and Admin are the only top-level staff modules.
- I.T. Readiness stays inside Admin/manage.
- Shared Core owns canonical identities; modules do not create parallel identity stores.
- Effective permission order is `hidden < view < create < approve < manage`.
- Client visibility never replaces protected server authorization.
- Completion disposition/candidate authority is not posting approval.
- Posting approval is not execution release.
- Preflight is read-only.
- Mapping review is a human accounting authority; mapping observability does not make the decision.
- Execution remains behind a private server-owned release switch and is **OFF**.
- Recovery-required state quarantines retry rather than duplicating accounting effects.
- Reversal preserves original history and creates auditable reversing records.
- Finance does not write canonical Jobs state through this completion/accounting pipeline.
- Stripe/PayPal/provider/payment mutation remains OFF/outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only and must not manufacture proof by mutating business data.
- Production promotion is deliberate/manual.

## Database and repository sanity

Keep numbered migrations permanent and ordered through Schema 181 and onward. Do not edit old applied migrations to erase historical assumptions or repairs. Git history is the archive; the active tree retains only the three canonical Markdown authorities and excludes archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, and backup artifacts.

## Human-gated items outside autonomous mutation

Do not autonomously approve chart mappings, choose a different live account mapping, enable Finance posting execution, mutate payment providers, conduct real-money tests, invent tax/chart policy, change pricing, or promote Production.
