# YWI application — build 2026-06-22a / schema 153

This repository has exactly **three active Markdown files**:

1. `README.md` — release marker and document policy.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — the current product, architecture, operating controls, SEO rules, and handoff.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — completed work, test instructions, release blockers, and next priorities.

All prior Markdown plans are retained for traceability under:

`archive/retired-markdown-2026-06-22a/`

Retired test/write artifacts are retained under:

`archive/retired-test-files-2026-06-22a/`

Archived material is historical context only. It must not override the active handbook or the next-step document without a deliberate review.

## Current release focus

Schema 151 made payment posting, bank promotion, reconciliation, quote conversion, and deposit status updates transactional PostgreSQL RPC workflows. Schema 152 added role cues, Stripe-webhook health, accountant ZIP packaging, and durable staging-test records. Schema 153 makes that release evidence repeatable and safer:

- disposable `STAGING-` fixture creation and cleanup;
- private review media that is copied to public delivery only after approval;
- database/storage policy assertions;
- accountant chart-of-accounts mapping and close-checklist snapshots;
- Search Console / Google Business Profile observation decisions;
- actionable Stripe delivery-failure and stale-delivery alerts;
- browser-contract test and CI workflow scaffolding.

**Release boundary:** this ZIP is source-checked, not deployed. Apply migrations through schema 153 and complete the staging guide before production use.
