# YWI application — build 2026-06-20a / schema 152

This repository is maintained from three active Markdown files only:

1. `README.md` — release marker and document policy.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — current product, architecture, data, SEO, operations, and release handoff.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — completed work, verification, detailed staging test steps, release blockers, and next priorities.

All superseded Markdown is preserved under `archive/retired-markdown-2026-06-20a/`. Archived files are historical reference only and must not override the active handbook or next-step document.

**Current focus:** schema 151 made accounting posting, bank promotion, reconciliation, quote conversion, and deposit recording transactional. Schema 152 makes that work safer to release: visible server-calculated role capabilities, explainable reconciliation review, verified Stripe webhook health, private accountant packages, durable staging-test records, and a fail-closed manual deposit-status path.
