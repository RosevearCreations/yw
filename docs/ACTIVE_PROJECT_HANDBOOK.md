# YWI Active Project Handbook

**Current schema source authority:** `184` — **Build 184 ACTIVE / source review**  
**Verified live database authority:** `183 / 183` until Build 184 source/browser proof succeeds and Schema 184 is deliberately applied  
**Last clean release evidence:** `main` `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 (`33697274220`) — application release authority GREEN  
**Build 184 source branch:** `schema-184-it-scorecard-truth-convergence`  
**Current live runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v13 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Vercel:** separately AMBER while build-rate-limited  
**Architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin/manage.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance/accounting workflows, and Admin/I.T. release controls. There are exactly four staff modules. A profile resolves to `hidden`, `view`, `create`, `approve`, or `manage`; server authorization remains authoritative. Active Admin profiles retain break-glass `manage` across all four modules.

## Architecture progression

- Schemas 159–174 established module permissions, Admin break-glass, I.T. Readiness, Shared Core, fail-closed cross-module contracts/events, canonical job completion, Finance intake/review, and dependency convergence.
- Schema 175 separated posting approval from completion disposition and added idempotency/provenance.
- Schema 176 mapped Finance candidates into the existing AR/GL accounting engine with read-only preflight.
- Schema 177 installed execution/recovery/reversal behind a private server-owned execution release that remains **OFF**.
- Schema 178 added lifecycle, blockers, reconciliation, and Admin → I.T. Finance health.
- Schema 179 / Build 179 — **COMPLETE**: Finance permissions, direct-bypass protection, synthetic non-persistent/browser-only acceptance, and release hardening.
- Schema 180 / Build 180 — **COMPLETE**: human accountant/bookkeeper mapping review and immutable audit over the existing canonical mapping table.
- Schema 181 / Build 181 — **COMPLETE**: human-review aging, technical drift, and posting-preflight reconciliation observability.
- Schema 182 — **COMPLETE maintenance repair**: release marker convergence without business mutation.
- Schema 183 / Build 183 — **COMPLETE**: structural chart-account decision support and DB-side approval compatibility enforcement.
- Schema 184 / Build 184 — **ACTIVE**: I.T. scorecard truth convergence and blocker classification.

## Build 184 authority

Build 184 fixes a control-plane truth problem rather than inventing new business behavior. Several old readiness rails still say ACTIVE even though current, later release proof has already superseded their historical next actions. Other rails are genuinely unfinished because they need staging acceptance, external provider testing, human accounting review, content approval, or additional feature work.

Build 184 separates those cases explicitly.

### Evidence-closable historical rails

Only these three rails may be automatically converged to `complete`, and the migration aborts unless their current proof is green:

1. `schema159_module_permissions` — requires current module-security assertions, rendered module acceptance, and zero Admin break-glass blockers.
2. `schema160_it_readiness` — requires current I.T. security assertions and zero Admin break-glass blockers.
3. `schema164_cross_module_boundaries` — requires current module write-boundary, cross-module boundary, event-wiring, and rendered module-acceptance assertions.

Each closure writes immutable private completion evidence and preserves the prior rail state inside metadata. The browser cannot create or alter completion evidence.

### Open work that must remain open

Build 184 classifies rather than completes the remaining work:

- `staging_acceptance`: Operations Cockpit, quote intake, live job updates, customer live-update email, service-execution proof/costing, supervisor closeout/signoff;
- `accounting_acceptance`: payment actions and bank CSV/reconciliation acceptance;
- `provider_acceptance`: customer portal Stripe test-mode acceptance;
- `content_approval`: route/visual approval and approved route generation;
- `feature_followup`: equipment barcode/QR camera scanning;
- `build_acceptance`: Build 184 until its own source/database/runtime/release evidence is complete.

A contract-level guard prohibits `auto_close_allowed=true` when a rail requires a human or external dependency. This means human/provider/accounting/content/staging work cannot be made green merely by changing a progress number.

## Admin → I.T. Readiness behavior

The Admin-only I.T. endpoint and UI receive two new private read-only surfaces:

- `v_it_scorecard_progress_truth` — per-rail resolution class, human/external requirement, immutable evidence count, truth status, and current action message;
- `v_it_scorecard_progress_truth_status` — structural summary including open/classified/unclassified counts, human/external pending counts, proof-closure drift, and overall scorecard-truth status.

`ywi_it_scorecard_truth_assertions()` becomes part of the I.T. security proof. Open classified work is a warning/AMBER work queue, not a release blocker. An unclassified open rail or a proof-closed rail that loses evidence is RED.

The I.T. browser UI exposes no `complete`, `close`, or `resolve` mutation. It only displays the control-plane truth and existing refresh/browser-smoke actions.

## Verified Build 183 baseline to preserve

- database `183 / 183` current;
- clean source `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 `33697274220` GREEN;
- application release authority GREEN;
- required dependency contracts `82 / 82` PASS;
- active Admin break-glass integrity `3 admins / 0 blockers`;
- Build 183 assertions `6 / 6`, Build 181 `8 / 8`, Build 180 `8 / 8`, Build 179 `12 / 12`;
- human-selected mapping rows remain unchanged and `review`;
- mapping-review audit count `0`;
- Finance posting execution release OFF;
- provider mutation OFF;
- canonical Jobs/work-order writeback prohibited;
- Production promotion manual.

## Security and ownership invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory.
- I.T. Readiness stays inside Admin/manage, never as a fifth module.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner/access/boundary contract.
- Posting approval is not execution release; the Finance execution release remains server-owned and OFF.
- Accountant/bookkeeper mapping selection and approval remain human decisions; Build 184 does not auto-select or auto-approve mappings.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Synthetic acceptance is non-persistent/browser-only.
- Human, external-provider, accounting, content, staging, and feature work remains open until actually completed.
- Production promotion remains deliberate/manual.

## Restart discipline during Build 184

1. Verify source branch descends from clean Build 183 `main` SHA `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`.
2. Verify live DB remains `183 / 183` until the full Build 184 source and rendered-browser gate is green.
3. Verify the three human Finance mappings remain unchanged unless a real accountant/bookkeeper changed them.
4. Verify execution release and provider mutation remain OFF.
5. Verify the Build 184 migration only closes Schemas 159/160/164 and only after current assertions pass.
6. Verify every other open rail has an explicit resolution class and is not auto-closed.
7. Verify Admin → I.T. remains Admin-only and the browser has no scorecard completion mutation.
8. After exact-main proof, apply Schema 184 deliberately, deploy the updated JWT-protected `admin-it-control`, verify live assertions/dependencies, then close the Build 184 rail and authority documents.
9. Keep Vercel rate-limit status separate from source correctness.
10. Keep Production manual.

## Repository hygiene

Git history is the archive. Numbered migrations are permanent audit history; source now contains Schema 184 while live remains Schema 183 during source review. The only active Markdown authorities are `README.md`, this handbook, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Do not retain archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, backup files, or one-time cleanup workflows after use.

## Human-gated items

Do not autonomously approve chart mappings, choose different live mapping accounts, enable Finance posting execution, mutate Stripe/PayPal/provider truth, conduct real-money tests, invent tax/chart policy, change pricing, approve public content, or promote Production.
