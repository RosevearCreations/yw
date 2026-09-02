# YWI Active Project Handbook

**Current schema source authority:** `178`  
**Verified live database boundary before Schema 178 promotion:** `177`  
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
Build 175 separated candidate approval from posting approval. Posting approval carries server-owned idempotency and immutable provenance, while database guards keep Finance accounting effects behind explicit execution authority.

### Schema 176 — Finance posting preflight and accounting-engine mapping
Build 176 maps the approved Finance candidate pair onto the **existing** accounting authorities rather than creating parallel tables:

- invoice path: `job_invoice_postings` → `ar_invoices`;
- journal path: `job_journal_postings` → `gl_journal_batches` / `gl_journal_entries`;
- chart authority: `accountant_export_mapping_rules` → `chart_of_accounts`.

The protected Finance Edge function exposes read-only preflight. It verifies canonical identity, draft state, invoice/journal arithmetic, paired revenue consistency, accounting readiness, prior-posting absence, and accountant-approved active mappings. Account identities and amounts remain server-owned.

### Schema 177 — controlled posting execution and recovery
Build 177 added service-authorized atomic AR + GL execution, durable idempotency, retry/recovery quarantine and explicit reversal/void authority. Existing posted history is preserved; reversals create a separate reversing GL batch rather than rewriting prior history.

Schema 177 was release-proven on exact-main SHA `4ee81b16fc78221adc4ccefd2f488c17f1a18da0`, GitHub Run #83 (`33654967250`), and release-evidence ID `7`. The protected `finance-job-completion-posting-approval` Edge function is active v3 with JWT verification.

The execution machinery is installed **fail-closed**. The server-owned execution release remains OFF, provider mutation remains OFF, and required posting mappings remain `0 / 3` approved. No Finance AR/GL posting was created merely to prove the release.

### Schema 178 — Finance operational control plane
Build 178 adds one read-only operational lifecycle across the existing Schema 169–177 authorities:

- intake / human disposition;
- draft candidate generation;
- separate posting approval;
- reason-coded posting preflight;
- execution / recovery state;
- AR + GL identity links;
- reversal state and recovery guidance.

It also adds reconciliation diagnostics for orphan/impossible candidate/posting/execution/reversal states, a Finance pipeline I.T. status view, and operational assertions. Admin → I.T. Readiness consumes those private service-role views. The historical Admin schema-preflight dependency row is also corrected to follow the current schema marker dynamically rather than stopping at Schema 173.

Build 178 is a control-plane/visibility release. It does not enable the Schema 177 execution switch, approve chart mappings, mutate Jobs, mutate Stripe/PayPal/provider truth, create another accounting system, add a fifth module, or promote Production.

## Current release boundary

Before applying Schema 178, the verified live database remains Schema 177 with:

- Schema drift `177 / 177`, current;
- exact-main source evidence Run #83 / SHA `4ee81b16…` recorded;
- Release Authority GREEN;
- repository enforcement separately AMBER because GitHub reports `main` unprotected;
- protected Finance posting Edge function ACTIVE v3 / JWT enabled;
- posting execution release OFF;
- provider mutation OFF;
- accountant mappings `0 / 3` approved;
- posting approvals `0`;
- posting execution runs `0`;
- reversals `0`;
- Finance invoice postings `0`;
- Finance journal postings `0`.

After Schema 178 merges, apply it only after exact-main CI passes, then verify drift, dependency contracts, Schema 175–178 assertions, reconciliation status, and zero unintended financial side effects before recording new release evidence.

## Security and ownership invariants

- Admin break-glass `manage` access across all four top-level modules remains mandatory until a replacement recovery authority exists.
- Shared Core data is read-only to consuming business modules.
- Cross-module writes require declared ownership, minimum permission, and an allowed boundary mode.
- Private event/dependency/Finance operational registries remain non-public and service-controlled.
- Finance review approval, posting approval, posting preflight, posting execution, recovery, and reversal are distinct authorities.
- Posting execution release is server-owned; no browser control may enable it.
- Accountant/chart-of-accounts decisions remain human accounting authority.
- Finance does not write back to Jobs and does not mutate Stripe/PayPal/provider/payment truth through this pipeline.
- I.T. Readiness may block/report a release but may not auto-promote Production.
- Private job/customer evidence must never be reused as public SEO material without explicit approval.

## Release discipline

For each release:

1. Start from the current `main` source and current database schema evidence.
2. Query live catalog types/relationships before adding dependent schema contracts; do not guess identities.
3. Keep migrations additive and ordered; never edit old applied migration history merely to make a later migration unnecessary.
4. Run source/unit boundary gates before merge.
5. Run rendered browser acceptance where applicable.
6. Verify the exact merged `main` SHA in GitHub Actions and inspect deployment evidence separately.
7. Apply database migrations only when the release requires them, in order, then verify schema drift/dependencies/release-specific assertions.
8. Deploy protected Edge functions only after their database dependencies exist and keep JWT verification on.
9. Keep Production promotion deliberate and manual.
10. Update these three active authority documents when the restart boundary materially changes.

## Repository hygiene policy

Git history is the archive. The active tree should not contain dated Markdown snapshots, retired copies, test-write artifacts, editor backup files, generated browser-test output, dependencies, logs, temporary files, or generated full-schema snapshots. Historical numbered SQL migrations are auditable database authority and remain in source.

The only active project authority documents are:

- `README.md`
- `docs/ACTIVE_PROJECT_HANDBOOK.md`
- `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

## Next bounded build

After Schema 178 is fully merged, applied, runtime-verified and release-evidenced, the next engineering release is **Build 179 — Finance permissions, synthetic acceptance and release hardening**. Build 179 may test permission tiers, safe synthetic fixtures/cleanup, browser behavior and the full completion-to-accounting safety gate, but it must not auto-approve accountant mappings, enable live payment/provider mutation, invent tax/chart policy, or promote Production.
