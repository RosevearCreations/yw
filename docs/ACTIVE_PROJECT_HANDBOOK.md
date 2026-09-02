# YWI Active Project Handbook

**Current schema authority:** `175`  
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

### Schema 175 — Finance posting safety foundation

Build 175 separates **candidate approval** from **posting approval**. A posting approval may be recorded only for an approved Finance disposition with both canonical Schema 172 draft candidates. The approval carries a server-owned idempotency identity and immutable provenance linking the Jobs completion event, Finance intake, Finance disposition, invoice candidate, journal candidate, approver, and timestamp.

Schema 175 also adds independent uniqueness contracts for future invoice/journal posting retries and database guards that explicitly reject posting rows for Schema 172 completion candidates. Therefore Build 175 does **not** post an AR invoice or GL journal, alter Jobs state, mutate Stripe/PayPal/provider truth, or authorize Production promotion.

This is the current database/source boundary.

## Security and ownership invariants

- Admin break-glass `manage` access across all four top-level modules remains mandatory until a replacement recovery authority exists.
- Shared Core data is read-only to consuming business modules.
- Cross-module writes require declared ownership, minimum permission, and an allowed boundary mode.
- Private event/dependency registries remain non-public and service-controlled.
- Finance review/candidate approval and Finance posting approval are distinct human authorities.
- A Schema 175 posting approval retains `execution_status='not_released'`; it is not permission to create AR/GL/payment effects.
- Stripe/PayPal/provider truth must remain provider/webhook controlled.
- I.T. Readiness may block or report a release but may not auto-promote Production.
- Private job/customer evidence must never be reused as public SEO material without explicit approval.

## Release discipline

For each release:

1. Start from the current `main` source and current database schema evidence.
2. Keep migrations additive and ordered; never edit old applied migration history merely to make a later migration unnecessary.
3. Run source/unit boundary gates before merge.
4. Run rendered browser acceptance where applicable.
5. Verify the exact merged `main` SHA in GitHub Actions and inspect deployment evidence separately.
6. Apply database migrations only when the release requires them, in order, then verify schema drift/preflight and release-specific assertions.
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

Schema 175 is the current verified database authority. Live verification reports `175 / 175` current, all 24 required Finance dependency contracts passing, all six Schema 175 posting-safety assertions passing, zero posting-execution violations, and zero Schema 172 invoice/journal posting rows. The JWT-protected `finance-job-completion-posting-approval` Edge function is deployed and active.

The next bounded product build is **Build 176 — connect Finance to the existing accounting engine**, beginning with mappings into the existing `job_invoice_postings` / AR invoice and `job_journal_postings` / `gl_journal_batches` authorities, followed by a read-only posting preflight and paired invoice/journal consistency validation. Posting execution itself remains closed until the later explicit Build 177 authority.
