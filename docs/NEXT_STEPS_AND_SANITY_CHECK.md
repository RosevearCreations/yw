# YWI Next Steps and Sanity Check

**Current source authority:** Schema `184` — **Build 184 ACTIVE / source review**  
**Verified live database authority:** Schema `183 / 183` until Build 184 source/browser proof succeeds and Schema 184 is deliberately applied  
**Last clean release evidence:** `main` `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 (`33697274220`) — application release authority GREEN  
**Build 184 source branch:** `schema-184-it-scorecard-truth-convergence`  
**Current live runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v13 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Vercel:** separately AMBER while build-rate-limited.

## Current checkpoint

Build 183 is completely closed. Final Build 183 authority is Schema `183 / 183`, clean `main` SHA `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, exact-main Run #132 (`33697274220`) GREEN, and `v_it_release_authority_status` GREEN. Repository enforcement remains separately AMBER because `main` has no protection rule.

Build 184 — **I.T. scorecard truth convergence and blocker classification** — is ACTIVE in source review.

The problem is bounded: older readiness rails can remain marked ACTIVE after later builds have already supplied stronger proof, while genuinely unfinished staging/provider/accounting/content/feature work must not be called complete. Build 184 separates those states and makes them visible in Admin → I.T. Readiness.

## Build sequence

- **Build 175 — Finance posting safety foundation — COMPLETE**
- **Build 176 — Existing accounting-engine mapping and preflight — COMPLETE**
- **Build 177 — Posting execution and recovery — COMPLETE, execution release OFF**
- **Build 178 — Finance operational control plane — COMPLETE**
- **Build 179 — Permissions, synthetic non-persistent/browser-only acceptance and release hardening — COMPLETE**
- **Build 180 — Accountant/bookkeeper mapping review workflow — COMPLETE**
- **Build 181 — Mapping aging, drift, and preflight reconciliation observability — COMPLETE**
- **Schema 182 — Release-authority marker convergence — COMPLETE maintenance repair**
- **Build 183 — Mapping decision support and structural approval guard — COMPLETE**
- **Build 184 — I.T. scorecard truth convergence — ACTIVE / source review**

## Build 184 source scope

1. Adds private `it_scorecard_rail_resolution_contracts` with explicit resolution classes.
2. Adds private append-only/immutable `it_scorecard_rail_completion_evidence`.
3. Only three historical rails have `auto_close_allowed=true`: Schema 159 module permissions, Schema 160 I.T. readiness, and Schema 164 cross-module boundaries.
4. A database CHECK prohibits auto-close authority for human/external-dependent work.
5. Schema 159 closure requires current module-security assertions, rendered module acceptance, and zero Admin break-glass blockers.
6. Schema 160 closure requires current I.T. security assertions and zero Admin break-glass blockers.
7. Schema 164 closure requires current write-boundary, cross-module boundary, event-wiring, and rendered module-acceptance assertions.
8. The migration aborts before those rails are changed if any required proof fails.
9. Completion evidence is immutable; later corrections must append new authority rather than edit historical evidence.
10. Prior rail status/progress/current value/next-action are preserved in metadata when a proven historical rail closes.
11. `operations_cockpit_live` remains open as `staging_acceptance`.
12. `quote_intake_live` remains open as `staging_acceptance`.
13. `payment_actions_live` and `bank_csv_preview_live` remain open as `accounting_acceptance`.
14. `equipment_scan_custody_live` remains open as `feature_followup`.
15. `route_asset_approval_live` and `approved_route_generation` remain open as `content_approval`.
16. `customer_portal_live` remains open as human/external `provider_acceptance` for Stripe test mode.
17. `live_job_updates`, `customer_live_update_notifications`, `service_execution_proof_costing`, and `supervisor_closeout_signoff_invoice_followup` remain open as `staging_acceptance`.
18. Build 184 itself remains `build_acceptance` until database/runtime/exact-main proof closes it.
19. Adds private `v_it_scorecard_progress_truth` and `v_it_scorecard_progress_truth_status` views.
20. Adds `ywi_it_scorecard_truth_assertions()` and integrates the truth feed/assertions into Admin → I.T. Readiness.
21. Admin I.T. shows verified closures separately from classified pending work, including `human` and `external` qualifiers.
22. The browser has no scorecard `complete`, `close`, or `resolve` mutation control.
23. Adds dedicated source gate `test:it-scorecard-truth` and rendered phone/desktop gate `test:browser:it`.
24. Build 184 does not mutate business/accounting/Jobs records, approve mappings, enable posting/provider mutation, or promote Production.

## Current open-work classification

These are real outstanding tasks and must remain open until their actual acceptance occurs:

| Class | Rails / work |
| --- | --- |
| Staging acceptance | Operations Cockpit; quote intake; live job updates; live-update email; service-execution proof/costing; supervisor closeout/signoff |
| Accounting acceptance | Payment actions; bank CSV promotion/split/undo/sign-off/reconciliation |
| Provider acceptance | Customer portal Stripe test-mode checkout/webhook/status proof |
| Content approval | Route/visual approval; approved-route generation/sitemap |
| Feature follow-up | Equipment barcode/QR camera scanning |
| Build acceptance | Build 184 itself until source, DB, runtime and exact-main evidence are complete |

Build 184 does **not auto-complete** any of these human/provider/accounting/content/staging/feature items.

## Human Finance mapping state to preserve

- `accounts_receivable` → `be9a4805-7a6b-4066-b827-ea7f11b94171` / 1100 Accounts Receivable / asset / `review`;
- `sales_tax_payable` → `18a7d16b-d3a5-4f82-9b82-de7dfe197a70` / 2100 Sales Tax Payable / liability / `review`;
- `service_revenue` → `0210b0e0-d68e-444b-940d-fae9f17e9e9a` / 4000 Landscape Service Revenue / revenue / `review`.

Do **not** auto-approve these mappings to make a human queue green. Mapping selection/approval remains explicit accountant/bookkeeper authority.

## Build 183 baseline checks already satisfied

- one clean `main` branch before Build 184 work;
- exact-main Run #132 `33697274220` SUCCESS on SHA `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`;
- final Schema 183 source evidence recorded on the same SHA/run;
- application release authority GREEN;
- database `183 / 183` current;
- required dependencies `82 / 82` PASS;
- active Admin break-glass blockers `0`;
- current module security `4/4`, I.T. readiness `4/4`, module write-boundary `4/4`, cross-module boundary `5/5`, cross-module event wiring `11/11`, module acceptance `5/5` — all PASS;
- execution release/provider mutation OFF;
- mapping choices/review states unchanged;
- Vercel rate-limit separately AMBER.

## Restart checks during Build 184

1. Confirm feature branch descends from `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`.
2. Confirm live DB stays `183 / 183` until the full feature PR source/browser gate is GREEN.
3. Confirm Schema 184 auto-close set remains exactly `{159,160,164}` and all are current-assertion gated.
4. Confirm every other open rail remains explicitly classified and `auto_close_allowed=false`.
5. Confirm scorecard completion evidence is private and immutable.
6. Confirm Admin → I.T. remains Admin-only and has no completion mutation action/control.
7. Confirm human Finance mappings remain unchanged unless a real accountant/bookkeeper changed them.
8. Confirm Finance execution release and provider mutation remain OFF.
9. Confirm no Finance→Jobs/work-order mutation is introduced.
10. Keep synthetic/browser acceptance non-persistent.
11. Keep Vercel/account throttle separate from source correctness.
12. Keep Production promotion manual.

## Current source gates

```powershell
npm ci
npm run test:repo
npm run test:modules
npm run test:it
npm run test:it-scorecard-truth
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
npm run test:browser:it
```

Rendered browser acceptance remains mandatory before source-green.

## Architecture sanity rules

- Safety / OHSA, Finance, Jobs, and Admin are the only top-level staff modules.
- I.T. Readiness stays inside Admin/manage.
- Shared Core owns canonical identities.
- Finance access remains `hidden < view < create < approve < manage`.
- Client visibility never replaces protected server authorization.
- Posting approval is not execution release; execution release remains OFF.
- Preflight is read-only.
- Mapping review remains human accountant/bookkeeper authority.
- Scorecard truth classifies evidence and remaining work; it does not perform the work.
- Finance does not write canonical Jobs state through this pipeline.
- Stripe/PayPal/provider/payment mutation stays outside this Finance pipeline.
- Synthetic acceptance remains non-persistent/browser-only.
- Production promotion remains deliberate/manual.

## Repository sanity

Numbered migrations remain permanent audit history through Schema 184 in source. Git history is the archive. The active tree must retain only the three canonical Markdown authorities and exclude archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, backup artifacts, and completed one-time cleanup workflows.

## Human-gated items

Do not autonomously approve chart mappings, select different mapping accounts, enable Finance posting execution, mutate payment providers, conduct real-money tests, invent tax/chart policy, change pricing, approve public content, or promote Production.
