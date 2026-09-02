# YWI Active Project Handbook

**Current schema authority:** `174`  
**Source authority:** `RosevearCreations/yw`  
**Active architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance review/accounting workflows, and Admin/I.T. release controls. The application deliberately has four top-level staff modules. I.T. is a control-plane section inside Admin rather than another business domain.

A profile receives an effective module level of `hidden`, `view`, `create`, `approve`, or `manage`. Server authorization remains authoritative even when the client hides a route. Active Admin profiles are a recovery exception and resolve to `manage` on all four modules.

## Architecture progression

### Schemas 159–160 — access and readiness

Established module permissions, permanent Admin break-glass access, protected Module Permissions management, and Admin → I.T. Readiness. I.T. consolidates schema drift, preflight, security/access integrity, deployment readiness, function readiness, recovery evidence, runtime health, SEO release checks, and browser-smoke evidence.

### Schemas 161–163 — modular runtime and Shared Core

Established the shared module contract, permission-driven lazy loading, and protected read-only Shared Core models. Canonical shared identities remain owned centrally; module code consumes them through the Core read service rather than recreating local copies.

### Schemas 164–168 — cross-module boundaries

Moved shared operations to fail-closed owner/action contracts, private versioned cross-module events, and real job-completion event wiring. Unknown or disabled shared actions are rejected before business handlers run. Payment truth is not a staff-controlled shortcut.

### Schemas 169–172 — Finance completion consumer

Added the Finance job-completion intake path, I.T. observability, bounded execution/retry authority, and human review/disposition candidate authority. These stages prepare accounting candidates; they do not silently post invoices, journals, or provider payments.

### Schemas 173–174 — schema convergence protection

Schema 173 introduced private dependency contracts and I.T. preflight checks for Finance schema assumptions. That guard exposed an incorrect guessed `bigint` contract for `job_completion_reviews.work_order_id`. Schema 174 deliberately repairs the contract to canonical `uuid` and adds the UUID identity chain used by the Finance candidates.

This is the current database/source boundary. Schema 174 is control-plane convergence only and does not write back into Jobs, post accounting entries, or change Stripe/PayPal truth.

## Security and ownership invariants

- Admin break-glass `manage` access across all four top-level modules remains mandatory until a replacement recovery authority exists.
- Shared Core data is read-only to consuming business modules.
- Cross-module writes require declared ownership, minimum permission, and an allowed boundary mode.
- Private event/dependency registries remain non-public and service-controlled.
- Finance review/candidate flows do not become automatic invoice/journal/payment posting without a separately reviewed release.
- Stripe/PayPal/provider truth must remain provider/webhook controlled.
- I.T. Readiness may block or report a release but may not auto-promote Production.
- Private job/customer evidence must never be reused as public SEO material without explicit approval.

## Release discipline

For each release:

1. Start from the current `main` source and current database schema evidence.
2. Keep migrations additive and ordered; never edit old applied migration history merely to make a later migration unnecessary.
3. Run source/unit boundary gates before merge.
4. Run rendered browser acceptance where applicable.
5. Verify the exact merged `main` SHA in GitHub Actions and the matching deployment.
6. Apply database migrations only when the release requires them, in order, then verify schema drift/preflight.
7. Keep Production promotion deliberate and manual.
8. Update the three active authority documents when the restart boundary materially changes.

## Repository hygiene policy

Git history is the archive. The active tree should not contain dated Markdown snapshots, retired copies, test-write artifacts, editor backup files, generated browser-test output, dependencies, logs, or temporary files. Historical numbered SQL migrations are **not stale files**; they are the auditable database migration chain and must remain.

The only active project authority documents are:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

When those files disagree with a verified newer source/database checkpoint, update them rather than creating another dated handoff file.

## Current checkpoint

Schema 174 is the current verified source/database authority. The Schema 174 Finance dependency preflight is green after correcting the work-order identity contract to UUID. The next product build should begin only after confirming this checkpoint remains current and should extend the existing four-module architecture rather than create duplicate services or a fifth module.
