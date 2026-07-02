# YWI application — build 2026-06-30a / schema 154

This repository has exactly **three active Markdown files**:

1. `README.md` — release marker and document policy.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — current product direction, architecture, operating controls, SEO rules, and handoff.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — completed work, detailed testing steps, release blockers, and next priorities.

All previous plans, audits, and historical working notes are retained for traceability under:

`archive/retired-markdown-2026-06-30a/`

Archived material is historical context only. It must not override the active handbook or next-step document without a deliberate review.

## Current release focus

Schema 151 moved high-risk accounting, reconciliation, quote-conversion, and deposit writes into transactional PostgreSQL RPCs. Schema 152 added role cues, Stripe webhook health, accountant ZIP handling, and durable staging-test records. Schema 153 made proof repeatable, protected review-stage media, and added accountant, SEO, and payment review queues. Schema 154 now combines those independent checks into a **human-reviewed release-readiness dashboard** and captures a time-stamped evidence snapshot only when an authorized administrator types `REVIEW ONLY`.

A snapshot does not deploy code, publish a route, charge a customer, change a payment, override a failed gate, or declare the site production-ready. It preserves the evidence available at the time of review.

**Release boundary:** this ZIP is source-checked, not deployed. Apply migrations through schema 154 to a dedicated staging project, deploy the updated protected functions and static build, then complete the exact staging test guide before considering production use.
