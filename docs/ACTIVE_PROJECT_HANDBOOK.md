# YWI Active Project Handbook

**Current schema authority:** `176`  
**Source authority:** `RosevearCreations/yw`  
**Active architecture:** Safety / OHSA, Finance, Jobs, Admin; I.T. Readiness is inside Admin.

## System shape

Yard Weasels combines public quote/SEO surfaces, private customer workflows, Safety/OHSA records, Jobs execution, Finance review/accounting workflows, and Admin/I.T. release controls. The application deliberately has four top-level staff modules. I.T. is a control-plane section inside Admin rather than another business domain.

A profile receives an effective module level of `hidden`, `view`, `create`, `approve`, or `manage`. Server authorization remains authoritative even when the client hides a route. Active Admin profiles are a recovery exception and resolve to `manage` on all four modules.

## Architecture progression

### Schemas 159–160 — access and readiness

Established module permissions, permanent Admin break-glass access, protected Module Permissions management, and Admin → I.T. Readiness.

### Schemas 161–163 — modular runtime and Shared Core

Established the shared module contract, permission-driven lazy loading, and protected read-only Shared Core models. Canonical shared identities remain centrally owned.

### Schemas 164–168 — cross-module boundaries

Moved shared operations to fail-closed owner/action contracts, private versioned cross-module events, and real job-completion event wiring. Payment truth is not a staff-controlled shortcut.

### Schemas 169–172 — Finance completion consumer

Added the Finance job-completion intake path, I.T. observability, bounded execution/retry authority, and human review/disposition candidate authority. These stages prepare documentary draft accounting candidates; they do not post invoices, journals, or provider payments.

### Schemas 173–174 — schema convergence protection

Schema 173 introduced private dependency contracts and I.T. preflight checks. Schema 174 repaired the discovered work-order contract to canonical UUID and extended the Finance identity chain.

### Schema 175 — Finance posting safety foundation

Build 175 separated candidate approval from posting approval. Posting approval carries server-owned idempotency and immutable provenance, while database guards keep Schema 172 invoice/journal posting execution closed.

### Schema 176 — Finance posting preflight and accounting-engine mapping

Build 176 maps the approved Finance candidate pair onto the **existing** accounting authorities rather than creating parallel tables:

- invoice path: `job_invoice_postings` → `ar_invoices`;
- journal path: `job_journal_postings` → `gl_journal_batches` / `gl_journal_entries`;
- chart authority: `accountant_export_mapping_rules` → `chart_of_accounts`.

The protected Finance Edge function now exposes a read-only `preflight` action. Preflight verifies canonical intake/disposition/approval/candidate identity, draft state, invoice arithmetic, documentary journal arithmetic, paired revenue consistency, accounting readiness, prior-posting absence, and accountant-approved active mappings. It returns server-owned JSON plans only; `execution_authorized=false` and `provider_mutation_authorized=false` are invariant.

The existing Schema 175 approval queue is retained as a continuity authority underneath the new preflight queue. Build 176 therefore extends rather than replaces the prior posting-safety boundary.

## Current live checkpoint

Schema 176 is applied/current. Verified live evidence at the Build 176 product boundary:

- schema drift: `176 / 176`, current;
- Finance schema-dependency assertions: `63 / 63` passed;
- Schema 176 posting-preflight assertions: `8 / 8` passed;
- Schema 175 posting-safety assertions: `6 / 6` passed;
- posting approvals: `0`;
- posting-execution violations: `0`;
- Schema 172 invoice posting rows: `0`;
- Schema 172 journal posting rows: `0`;
- required Build 176 posting mappings: `3`, approved: `0`;
- posting execution authorization: `false`;
- provider mutation authorization: `false`;
- `finance-job-completion-posting-approval` Edge function: active v2 with JWT verification enabled.

The unapproved mapping state is intentional. I.T. does **not** auto-approve `accounts_receivable`, `service_revenue`, or `sales_tax_payable`; those remain accountant/bookkeeper decisions. A future posting execution release must remain blocked until required mappings are explicitly approved and all preflight checks pass.

## Security and ownership invariants

- Admin break-glass `manage` access across all four top-level modules remains mandatory until a replacement recovery authority exists.
- Shared Core data is read-only to consuming business modules.
- Cross-module writes require declared ownership, minimum permission, and an allowed boundary mode.
- Private event/dependency registries remain non-public and service-controlled.
- Finance review approval, posting approval, posting preflight, and posting execution are distinct authorities.
- Schema 175/176 does not authorize AR/GL/payment execution, Jobs writeback, or Stripe/PayPal/provider mutation.
- Accountant/chart-of-accounts decisions remain human accounting authority.
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

Git history is the archive. The active tree should not contain dated Markdown snapshots, retired copies, test-write artifacts, editor backup files, generated browser-test output, dependencies, logs, temporary files, or generated full-schema snapshots. Historical numbered SQL migrations are auditable database authority and remain in source.

The only active project authority documents are:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

## Next bounded build

The next engineering release is **Build 177 — controlled posting execution and recovery**, but live accounting effects must stay disabled unless the required accountant mappings are explicitly approved. Build 177 may implement service-only idempotent execution/recovery contracts behind that gate; it must not auto-approve chart mappings, mutate provider/payment truth, or promote Production.
