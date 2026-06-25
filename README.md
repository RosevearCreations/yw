# YWI application — build 2026-06-23a / schema 153

This repository has exactly **three active Markdown files**:

1. `README.md` — release marker and document policy.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — current product, architecture, operating controls, SEO rules, and handoff.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — completed work, detailed test instructions, release blockers, and next priorities.

All prior Markdown plans are retained for traceability under:

`archive/retired-markdown-2026-06-23a/`

Retired temporary write/test artifacts are retained under:

`archive/retired-test-files-2026-06-23a/`

Archived material is historical context only. It must not override the active handbook or next-step document without a deliberate review.

## Current release focus

Schema 151 made payment posting, bank promotion, reconciliation, quote conversion, and deposit status updates transactional PostgreSQL RPC workflows. Schema 152 added role cues, Stripe-webhook health, accountant ZIP packaging, and durable staging-test records. Schema 153 made release evidence repeatable, protected review-stage media, and added accountant/SEO/payment operational controls.

Build `2026-06-23a` corrects the Operations Cockpit contrast regression: it now uses the same dark navy design language as the rest of the admin application, with explicit accessible foreground/background pairs for forms, queue cards, scorecards, statuses, badges, messages, private-media placeholders, and mobile actions. No database migration is required for this CSS/UX correction.

**Release boundary:** this ZIP is source-checked, not deployed. Apply migrations through schema 153, complete the staging guide, and then confirm the Cockpit in a real browser before production use.
