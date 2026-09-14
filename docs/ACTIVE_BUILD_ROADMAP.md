# Active Build Roadmap

## Purpose

This file is the durable forward build plan for the Yard Weasels Inc. application. It is intentionally separate from historical release narration. Completed build history belongs in Git/GitHub and current release/schema truth belongs in I.T. Readiness and the current repository/database authorities.

Every fresh YW build session must review this roadmap together with `docs/NEXT_STEPS_AND_SANITY_CHECK.md` **before selecting the next build**.

This roadmap is a prioritized planning authority, not permission to blindly execute a numbered item. Before starting any build:

1. Verify current `main` and `dev` application-tree parity or a deliberately documented promotion hold.
2. Verify the exact current Production/source SHA, branch protection/repository enforcement state, and canonical CI result.
3. Read current I.T. Readiness, Current Admin To-Do, next-safe-action authority, Finance/provider fail-closed state, and schema drift.
4. Re-scan the exact current repository to confirm the proposed defect or feature gap still exists.
5. Skip, merge, split, or reorder a planned build when current evidence proves its scope is already complete, obsolete, unsafe, or better handled with an adjacent build.
6. Keep Finance posting, payment-provider mutation, Production staging mutation, Auth-control changes, destructive business-data changes, and other guarded operations fail-closed unless a build explicitly reaches the separately authorized acceptance stage.
7. Do not invent a schema migration merely because a planned build has a number. Keep the current schema unless implementation evidence proves a migration is genuinely required.
8. Preserve the canonical promotion sequence: feature → exact feature GREEN → Development → fresh exact Development GREEN → protected `main` → exact-main repository/source/browser/release proof → non-force `dev` synchronization.

## Direction after Build 305

Builds through 305 substantially strengthened release mechanics, current-schema fixture handling, repository enforcement, browser acceptance, Auth evidence separation, and exact-main release proof. The next phase should stop spending most releases on tiny CI-only hardening. Finish the remaining high-value release/schema-width debt, then emphasize **Finance completion, accounting acceptance, job profitability, operator speed, and practical quality of life**.

The intended grouping is:

- **Builds 306–309:** finish bounded release/schema-width technical debt.
- **Builds 310–317:** complete the practical Finance/accounting operator workflow.
- **Builds 318–327:** profitability, Admin/operator quality of life, mobile efficiency, and cross-module visibility.
- **Builds 328–330:** deliberate real staging, accounting, and payment/provider acceptance campaigns.

## Phase 1 — Finish bounded release technical debt

### Build 306 — Release-source evidence migration-width hardening

**Goal:** Remove the remaining fixed-width migration assumption from exact-main release-source evidence generation.

**Primary scope:**
- Harden `scripts/release-source-evidence-bundle.mjs` so repository schema discovery accepts variable-width numbered migrations, including Schema 1000+.
- Add explicit regression coverage for representative values such as 999, 1000, and 12034 plus malformed/non-migration filenames.
- Preserve exact-main SHA, workflow, repository-protection, schema and evidence semantics.

**Boundary:** Source/release-evidence only unless current repository truth proves another tightly coupled gate must change. No schema or Production mutation.

### Build 307 — Release change-classification migration-width hardening

**Goal:** Ensure a future Schema 1000+ SQL migration is still classified as schema-changing by release policy.

**Primary scope:**
- Harden `scripts/release-candidate-manifest.mjs`.
- Harden the shared release-change policy/runtime classifier where it still recognizes only three-digit SQL migration names.
- Add regression fixtures proving Schema 1000+ receives database/schema risk classification and cannot bypass schema-changing release controls.

**Boundary:** Source/policy classification only. Do not alter historical migration filenames.

### Build 308 — Staging runner migration-width completion

**Goal:** Remove fixed-width schema discovery from the guarded manual staging acceptance runner.

**Primary scope:**
- Harden `scripts/operations-rpc-staging-e2e-core.mjs` current-schema discovery.
- Lock the behavior into the existing staging runtime/schema authority checks.
- Preserve all dedicated non-Production project checks, exact-schema lock, manual-only behavior, disposable-fixture limits, and Production denial.

**Boundary:** Source runner/test hardening only. Do not create staging infrastructure or run live mutation unless separately authorized and all environment guards are current.

### Build 309 — Final active migration-parser sweep

**Goal:** Close the Schema-1000 hardening campaign rather than extending it indefinitely one file at a time.

**Primary scope:**
- Fresh-search the exact Production tree for **genuine executable** fixed-width migration parsers still used for current schema/release authority.
- Prioritize active gates such as customer-notification/release enforcement and similar business checks if still present.
- Distinguish real parsers from historical examples, guard strings, fixture assertions and provenance text.
- Add one bounded convergence gate proving no active current-schema parser remains dependent on `slice(0,3)` or exact-three-digit-only parsing.

**Exit condition:** Future migration-width work becomes normal regression maintenance rather than a planned build stream.

## Phase 2 — Finance and accounting completion

### Build 310 — Finance Acceptance Command Center

**Goal:** Give Finance/Admin one authoritative answer to: **What prevents accounting from being GREEN?**

**Primary scope:**
- Consolidate Finance hardening status, reconciliation exceptions, account-mapping gaps, pending payment actions, bank-import review, period/close status, posting locks, remittance readiness, and accountant-export readiness.
- Show blocker severity, owner, corrective action and source evidence.
- Deep-link each blocker to the correct focused workspace.
- Preserve current accounting-acceptance fail-closed logic and never equate a dashboard status with posting authorization.

### Build 311 — Bank Import Workbench v2

**Goal:** Make bank CSV intake efficient enough for real recurring bookkeeping.

**Primary scope:**
- Saved column-mapping templates per bank/account.
- Clear duplicate/rejected-row explanations.
- Row-level approve/reject/correct and bounded bulk review.
- Import history and source-file traceability.
- Safe undo/discard before promotion/posting.
- Explicit account/date/amount/reference validation and operator-visible exception reasons.

**Boundary:** Preview/review first. No silent posting.

### Build 312 — Smart Reconciliation Workbench

**Goal:** Reduce manual matching while keeping human accounting judgment explicit.

**Primary scope:**
- Confidence-ranked suggestions between bank rows and invoices, customer payments, vendor bills, transfers and deposits.
- One-to-one, one-to-many, many-to-one and partial-match support where accounting rules allow it.
- Explain the score: amount, date, reference, customer/vendor, document identity and prior linkage.
- Separate suggested, confirmed, ambiguous and exception states.
- Require deliberate operator confirmation for ambiguous matches.

### Build 313 — Payment Application and A/R Completion

**Goal:** Complete the operator workflow for receipts and customer balances.

**Primary scope:**
- Apply receipts to one or more invoices.
- Handle deposits, unapplied cash, credits, discounts, approved write-offs and overpayments.
- Show available balance, invoice balance, customer identity, source, date and open-period validation before application.
- Provide preview/confirmation and complete audit evidence.
- Preserve idempotency and prohibit accidental double application.

### Build 314 — Account Mapping and Posting Preview

**Goal:** Make every future posting understandable before execution is ever enabled.

**Primary scope:**
- Present proposed debit/credit entries, source transaction, mapped accounts, tax treatment and evidence.
- Flag unmapped/ambiguous lines and prevent them from becoming posting-ready.
- Allow row-level approve/reject/reclassify decisions with reasons.
- Maintain a complete preview-to-decision audit trail.

**Boundary:** Posting preview and readiness only unless a later separately authorized acceptance build explicitly enables test execution.

### Build 315 — Reconciliation Exception Resolution

**Goal:** Turn reconciliation exceptions from counts into owned work.

**Primary scope:**
- Exception severity, category, owner, age and evidence.
- Resolution reasons such as timing difference, duplicate, missing document, wrong account, amount mismatch, transfer pair, provider settlement or manual accounting review.
- Required evidence/notes for material exceptions.
- Distinguish resolved, waived-with-reason and unresolved states.
- Surface critical unresolved exceptions in Finance readiness and month-end close.

### Build 316 — Month-End Close Cockpit

**Goal:** Make period close a guided, auditable workflow rather than scattered checks.

**Primary scope:**
- Checklist for bank reconciliation, payment exceptions, account mappings, journals, remittances, open A/R/A/P issues, provider settlement exceptions and export readiness.
- Period lock when all required gates are satisfied.
- Reopen only with explicit authority and recorded reason.
- Preserve immutable close/reopen audit evidence.
- Prevent posting into locked periods.

### Build 317 — Accountant Export Package v2

**Goal:** Produce a clean package an external accountant can actually review.

**Primary scope:**
- Trial balance and GL detail.
- A/R and A/P summaries/aging where available.
- Bank/reconciliation summary and unresolved exception report.
- Tax/remittance schedules.
- Posting/account-mapping exceptions.
- Period-close status and reopen history.
- Export manifest proving period, source rows, generation time and included artifacts.

## Phase 3 — Profitability and quality of life

### Build 318 — Job Cost and Profitability Closeout

**Goal:** Present estimate-to-actual profitability for every job.

**Primary scope:**
- Estimate/revenue versus actual labour, materials, equipment and subcontract/vendor costs.
- Invoiced/collected amount, gross margin and variance.
- Approved execution-proof evidence and cost provenance.
- Supervisor review before final profitability closeout.
- Clear separation between staff-only cost/margin information and customer-safe closeout data.

### Build 319 — Finance Dashboard and Cash Position

**Goal:** Give ownership/management a practical financial operating view.

**Primary scope:**
- Cash/bank position from available authoritative data.
- Receivables and overdue invoices.
- Near-term payables/commitments where supported.
- Taxes/remittances due.
- Current-period revenue, cost and margin.
- Reconciliation/accounting blockers and close readiness.

**Boundary:** Operational decision support, not a replacement for formal accountant-reviewed statements.

### Build 320 — Admin Needs Attention v2

**Goal:** Turn Admin Home into an effective daily action list.

**Primary scope:**
- Priority, owner, due date and source area.
- Permission-aware **Take me there** action.
- Snooze/defer without resolving the underlying item.
- Recently resolved history.
- Distinguish informational, action-required and blocked items.
- Never let acknowledgement/snooze auto-close business or readiness rails.

### Build 321 — Saved Views and Operator Preferences

**Goal:** Reduce repetitive setup across large workbenches.

**Primary scope:**
- Saved filters such as My Open Jobs, Finance Exceptions, Today, Assigned to Me and Awaiting Review.
- Remember safe table column visibility, sort order, density/page size and workspace preferences per user.
- Provide reset-to-default.
- Keep permission filtering server-authoritative regardless of saved presentation preferences.

### Build 322 — Safe Bulk Operations

**Goal:** Make repetitive queue work faster without weakening auditability.

**Primary scope:**
- Multi-select and bounded bulk actions for appropriate non-destructive workflows.
- Preview affected rows before execution.
- Per-row result and audit evidence.
- Partial-failure handling.
- No bulk destructive/accounting/provider action unless explicitly designed with stronger confirmation and authorization.

### Build 323 — Universal Activity and Audit Timeline

**Goal:** Make troubleshooting and business-history review dramatically easier.

**Primary scope:**
- One chronological activity surface for customer, job, invoice/payment, employee and equipment entities where identifiers permit it.
- Created/changed/approved/rejected/notified/uploaded/posted/reopened actions.
- Actor, timestamp, source module and evidence link.
- Permission-aware redaction of private/security/accounting details.

### Build 324 — Offline and Conflict Recovery UX

**Goal:** Make offline/sync recovery understandable to field users.

**Primary scope:**
- Human-readable conflict cause.
- Local versus server value comparison where safe.
- Explicit actions such as Keep Mine, Keep Server, Merge, Retry or Discard when the record contract supports them.
- Preserve unsent work until the operator deliberately resolves or discards it.
- Never silently overwrite a newer authoritative record.

### Build 325 — Mobile Supervisor Quick Actions

**Goal:** Optimize the common field workflow for phones.

**Primary scope:**
- One/two-tap access to assigned job, clock action, live update/photo, safety item, material use, execution proof, closeout request and customer signoff.
- 390/430-width touch targets and no horizontal overflow.
- Offline-safe draft behavior where already supported.
- Permission-aware actions and clear pending-sync state.

### Build 326 — Global Command and Search Palette

**Goal:** Let authorized users reach the right record or action without navigating several modules.

**Primary scope:**
- Permission-aware search across customers, jobs, invoices/payments, employees, equipment and Admin workspaces.
- Direct navigation to known entity/workspace records.
- Keyboard and mobile-friendly invocation.
- No data leakage from hidden modules; search results must honor server/module authority.

### Build 327 — Notification Centre and Daily Digest

**Goal:** Consolidate cross-module work requiring attention.

**Primary scope:**
- Approvals, overdue follow-up, failed/manual-review notification delivery, reconciliation exceptions, safety items, closeouts and Finance reviews.
- Read/acknowledge/snooze for the notification itself without resolving the source business record.
- Per-user relevance and permission filtering.
- Optional daily summary surface inside the application before considering external delivery.

## Phase 4 — Deliberate acceptance campaigns

### Build 328 — Real Staging Acceptance Campaign

**Goal:** Convert technically ready staging rails into genuine bounded evidence.

**Prerequisites:**
- A dedicated non-Production Supabase project/branch exists and is explicitly authorized for the exercise.
- Environment identity, project-ref guard and exact current-schema parity are all proven immediately before mutation.
- Production customer/business/provider data is never substituted for staging evidence.

**Primary scope:**
- Run approved disposable automated cases.
- Complete required human Operations/quote/job lifecycle cases.
- Record evidence, finalize and sign off only according to the existing scenario authority.
- Keep evidence/signoff separate from automatic rail closure unless the authoritative resolution contract explicitly permits it.

### Build 329 — Accounting Acceptance Campaign

**Goal:** Prove the Finance workflow end-to-end before considering Finance posting readiness.

**Prerequisites:** Builds 310–317 or equivalent current functionality are complete and current Finance hardening has no unresolved critical blockers.

**Primary scope:**
- Controlled test transactions through bank import, reconciliation, payment application, account mapping, posting preview, exception handling, period close and accountant export.
- Verify idempotency, locked-period behavior, reopen audit, evidence completeness and expected accounting outputs.
- Obtain required human/accounting review.

**Boundary:** Passing acceptance does not automatically enable Production posting or provider mutation.

### Build 330 — Payment and Provider Acceptance

**Goal:** Validate provider/payment behavior only after internal accounting behavior is trustworthy.

**Primary scope:**
- Test success, decline/failure, duplicate webhook/event, retry, idempotency, refund, partial refund and dispute/chargeback paths supported by the chosen provider integration.
- Verify provider events link to the correct internal payment/accounting records.
- Confirm no duplicate settlement/application/posting.
- Prove degraded/uncertain provider outcomes remain manual review rather than falsely successful.

**Boundary:** Provider acceptance and Production provider enablement are separate deliberate decisions.

## Build-selection rules after this roadmap

When the user asks for the **next YW build**:

1. Start from exact current source/release truth and read this file plus `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.
2. Prefer the earliest still-valid roadmap item whose prerequisites are satisfied.
3. A newly discovered release/security/data-integrity defect may take priority over the roadmap when it materially affects safe operation or release truth.
4. Small adjacent fixes may be grouped when they share one authority/test surface; do not combine unrelated business areas merely to increase build size.
5. Once Builds 306–309 are complete, do **not** keep creating CI-only micro-builds by default. Prefer Finance completion and operator/business value unless a new release-safety defect is proven.
6. Accounting/provider/staging acceptance builds must remain blocked until their explicit prerequisites exist. Do useful source/UI work instead of fabricating acceptance evidence.
7. At the end of every completed build, update this roadmap only when the planned sequence materially changes. Do not turn the file into a historical completion ledger.

## Expected long-term outcome

The target is not an application with the highest possible build number. The target is an application that:

- can be released with trustworthy exact-source evidence;
- makes Finance/accounting exceptions visible and resolvable;
- can produce accountant-ready close/export evidence;
- shows real job profitability;
- minimizes repetitive navigation and operator setup;
- remains usable in the field on phones and during connectivity problems;
- preserves privacy, authorization and fail-closed provider/accounting boundaries; and
- eventually closes staging/accounting/provider acceptance with real evidence rather than source-only confidence.
