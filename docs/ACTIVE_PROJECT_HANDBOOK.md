# YWI Active Project Handbook

**Current schema authority:** `184 / 184` — **Build 184 COMPLETE**  
**Merged product checkpoint:** `613118f52fcbad147a56226ccdeabf3a64a1c8b0`, exact-main Run #136 (`33698631685`) — SUCCESS  
**Previous clean release evidence:** Build 183 `main` `2f4e4fa25299dd285718c2bb78cc40fc05c55ebf`, Run #132 (`33697274220`) — GREEN  
**Runtime:** `finance-account-mapping-review` v4 ACTIVE / JWT enabled; `admin-it-control` v14 ACTIVE / JWT enabled  
**Repository enforcement:** separately AMBER because `main` is unprotected  
**Finance execution release:** **OFF**; provider mutation OFF; Production promotion manual  
**Vercel:** separate infrastructure/account status and must be freshly verified  
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
- Schema 184 / Build 184 — **COMPLETE**: I.T. scorecard truth convergence and blocker classification.

## Build 184 authority

Build 184 resolves a control-plane truth problem without inventing business completion. It distinguishes historical readiness rails already superseded by stronger current proof from genuinely unfinished work that still requires staging acceptance, provider testing, accounting review, content approval, or implementation.

### Evidence-backed historical closures

Exactly three rails were converged to `complete`, and only after current fail-closed proof passed:

1. `schema159_module_permissions` — current module-security assertions, rendered module acceptance, and zero Admin break-glass blockers.
2. `schema160_it_readiness` — current I.T. security assertions and zero Admin break-glass blockers.
3. `schema164_cross_module_boundaries` — current module write-boundary, cross-module boundary, event-wiring, and rendered module-acceptance assertions.

Each is now **100% / verified_complete** with one private immutable completion-evidence record. Prior status/progress/current value/next action are retained in metadata. The browser cannot create, alter, close, or resolve scorecard evidence.

### Real open work remains real

After Build 184 closeout the scorecard has **38 rails: 26 complete / 12 open**. Every open rail is explicitly classified, with **0 unclassified** and **0 proof-closure drift**:

- `staging_acceptance` — 6: Operations Cockpit, quote intake, live job updates, customer live-update notifications, service-execution proof/costing, supervisor closeout/signoff;
- `accounting_acceptance` — 2: payment actions and bank CSV/reconciliation acceptance;
- `provider_acceptance` — 1: customer portal Stripe test-mode checkout/webhook/status acceptance;
- `content_approval` — 2: route/visual approval and approved-route generation;
- `feature_followup` — 1: equipment barcode/QR camera scanning.

Human pending count is **11** and external pending count is **1**. A contract-level guard prohibits automatic closure for human/external-dependent work.

## Verified live Build 184 state

- Schema `184 / 184` current.
- Build 184 assertions **6 / 6 PASS**.
- Required dependency contracts **85 / 85 PASS**.
- Scorecard truth **GREEN**.
- Open/classified/unclassified: **12 / 12 / 0**.
- Proof-closure drift: **0**.
- Active Admin break-glass integrity: **3 admins / 0 blockers**.
- Build 184 rail: **complete / 100% / 10 of 10**.
- `admin-it-control` **v14 ACTIVE / JWT enabled**.
- Human-selected Finance mappings remain unchanged in `review`; mapping-review audit count **0**.
- Posting execution release OFF; provider mutation OFF; canonical Jobs writeback prohibited; Production manual.

The existing mapping decisions remain explicit human accountant/bookkeeper authority. Build 184 does **not auto-select** or auto-approve a mapping and structural compatibility remains only a safety floor, not an accounting recommendation engine.

## Next autonomous build

**Build 185 — Equipment barcode/QR camera scanning and custody evidence hardening** is next. It is selected because `equipment_scan_custody_live` is the only remaining open rail classified `feature_followup` with neither a human nor an external-provider dependency.

Before Build 185 changes source or schema:

1. Verify the final post-Build184 clean `main` SHA/run and Schema184 release evidence agree.
2. Inspect live canonical equipment/custody tables, types, constraints, indexes, audit/evidence relations, and current module/write-boundary contracts.
3. Inspect existing equipment UI, scan/custody actions, upload-equipment-evidence, Operations/Jobs endpoints, and mobile patterns.
4. Reuse canonical equipment identity; do not create a parallel equipment table.
5. Determine the owning module from existing contracts rather than guessing.
6. Preserve a manual identifier fallback when camera/barcode APIs are unavailable or permission is denied.
7. Require protected server authorization for custody mutations; browser scanning alone is never authority.
8. Add phone-first rendered acceptance and release gating before closing the feature rail.

## Security and ownership invariants

- Admin break-glass `manage` across Safety, Finance, Jobs, and Admin remains mandatory.
- I.T. Readiness stays inside Admin/manage, never as a fifth module.
- Shared Core identities are centrally owned and consumed read-only.
- Cross-module writes require an explicit owner/access/boundary contract.
- Posting approval is not execution release; the Finance execution release remains server-owned and OFF.
- Accountant/bookkeeper mapping selection and approval remain human decisions.
- Finance completion/accounting RPCs do not write canonical Jobs/work-order state.
- Stripe/PayPal/provider/payment truth remains outside this Finance pipeline.
- Synthetic Finance acceptance is non-persistent/browser-only.
- Production promotion remains deliberate/manual.

## Restart discipline after Build 184

1. Start from the single clean `main` branch after authority closeout/branch pruning.
2. Verify latest exact-main `YWI source and staging checks` is SUCCESS and matches Schema 184 release evidence.
3. Verify live DB remains `184 / 184` and Build184 assertions/dependencies remain `6/6` and `85/85`.
4. Verify scorecard truth remains GREEN with 12 classified open rails, 0 unclassified and 0 proof drift.
5. Verify Admin break-glass remains 3/0 blockers.
6. Verify `admin-it-control` remains ACTIVE and JWT protected.
7. Preserve the three human Finance mapping decisions unless a real accountant/bookkeeper changes them.
8. Keep Finance execution release/provider mutation OFF.
9. Keep Vercel status separate from source correctness.
10. Keep Production manual.

## Repository hygiene

Git history is the archive. Numbered migrations are permanent audit history through Schema 184. The only active Markdown authorities are `README.md`, this handbook, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

Do not retain archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp, backup files, or one-time cleanup workflows after use.

The final exact clean-main source SHA/run is stored in `it_release_source_evidence` after branch cleanup and final CI.

## Human-gated items

Do not autonomously approve chart mappings, choose different live mapping accounts, enable Finance posting execution, mutate Stripe/PayPal/provider truth, conduct real-money tests, invent tax/chart policy, change pricing, approve public content, or promote Production.
