# YWI Next Steps and Sanity Check

**Current source/database boundary:** Schema `174`  
**Current clean source checkpoint:** `main` at `ee49be76e378c1bb91d749d5534251227799deb6`  
**Restart rule:** verify 174 remains current before beginning the next schema-changing build.

## Current checkpoint

The latest verified release corrected Schema 173's guessed Finance work-order dependency type. `job_completion_reviews.work_order_id` is canonical `uuid`, and Schema 174 extends the UUID identity contracts used by the Finance completion candidate chain.

At the current cleaned repository checkpoint:

- source `main` is `ee49be76e378c1bb91d749d5534251227799deb6`;
- GitHub reports exactly one branch: `main`;
- exact-main source/browser gate Run #63 completed successfully after repository and branch cleanup;
- database schema authority remains Schema `174` because repository cleanup did not change database state;
- Finance schema-dependency failures were zero at the Schema 174 convergence checkpoint;
- Admin/I.T. release authority was green;
- Production promotion remains manual;
- GitHub `main` branch protection remains an infrastructure hardening item rather than a Schema 174 database blocker.

## First checks on restart

1. Confirm `main` has not regressed from Schema 174.
2. Confirm database drift/preflight still reports Schema 174 current before applying another migration.
3. Confirm Admin remains break-glass `manage` across Safety, Finance, Jobs, and Admin.
4. Run the current source gates and rendered browser acceptance appropriate to the next change.
5. Keep I.T. Readiness inside Admin; do not create a fifth top-level module.
6. Keep Production promotion deliberate/manual.

## Current source gates

```powershell
npm ci
npm run test:repo
npm run test:modules
npm run test:it
npm run test:runtime
npm run test:boundaries
npm run test:acceptance
npm run test:release-authority
npm run test:event-wiring
npm run test:job-completion-event
npm run test:finance-completion-consumer
npm run test:consumer-observability
npm run test:finance-consumer-execution
npm run test:finance-completion-review
npm run test:finance-schema-dependencies
npm run test:contrast
npm run test:navigation
```

GitHub/Vercel rendered-browser acceptance remains required before calling the resulting `main` checkpoint green.

## Architecture sanity rules

- **Safety / OHSA, Finance, Jobs, Admin** remain the only top-level staff modules.
- Shared Core owns canonical shared identities; modules consume read models rather than create duplicates.
- Cross-module writes fail closed unless a declared contract identifies the owner and allowed operation.
- Finance job-completion review/candidate state is not permission to auto-post invoices, journals, or payments.
- Stripe/PayPal/provider truth remains provider/webhook controlled.
- Public SEO remains separate from private operations/customer evidence.
- One public H1, canonical URL, structured data, approved public image/alt text, and sitemap controls remain release requirements.

## Database sanity

Treat numbered files in `sql/` as permanent migration history. Do not delete or rewrite an applied migration because a later schema supersedes its runtime objects. Use a new ordered migration when database state must change.

Schema 173's dependency guard must remain reproducible because Schema 174 explicitly demonstrates and repairs the historical `bigint` assumption to `uuid`. Removing either migration would weaken the audit trail.

## Repository sanity

The repository root should stay free of:

- dated `archive/` snapshots;
- `retired-markdown-*` directories;
- `test_write*` artifacts;
- `node_modules/`, Playwright output, logs, temp files, and editor backups.

Git history is the historical archive. Keep only the three active authority documents and update them in place when the restart boundary changes.

## Next bounded development direction

Resume from the existing Finance completion-review/candidate architecture rather than starting a parallel accounting path. Before adding automatic accounting effects, explicitly define and test the human approval, idempotency, posting, reversal, provider-truth, and audit boundaries. Any new schema work starts at **Schema 175** only after Schema 174 source/database preflight is reverified.

## Autonomous Build 175-179 execution queue

The following 20 items are the canonical next autonomous development sequence. They may be implemented without additional business input as long as the existing architecture and safety boundaries remain unchanged.

### Build 175 — Finance posting safety foundation

1. **Reverify Schema 174 source/database convergence.** Run the complete read-only schema drift, dependency-preflight, module-access, I.T. readiness, and release-authority checks before introducing 175.

2. **Create an explicit Finance posting-approval authority.** Candidate approval and accounting posting approval should be separate decisions. Schema 172 currently deliberately prevents a generated candidate from being posted.

3. **Add posting idempotency contracts.** One Finance candidate must be incapable of generating duplicate AR invoices, duplicate GL batches, or duplicate posting attempts even after retries.

4. **Add immutable posting provenance.** Every future accounting effect should retain the complete chain: Jobs completion event → Finance intake → Finance disposition → invoice/journal candidate → posting approval → accounting record → actor/timestamp.

### Build 176 — Connect Finance to the existing accounting engine

5. **Map invoice candidates into the existing `job_invoice_postings` / AR invoice architecture.** Do not create another invoice table.

6. **Map journal candidates into the existing `job_journal_postings` / `gl_journal_batches` architecture.** YW already has balanced-journal controls and draft/review/posted/void states.

7. **Create a posting dry-run/preflight service.** It should validate customer, site, work order, totals, taxes, accounting references, permissions and ledger balance without changing accounting state.

8. **Add paired invoice/journal consistency validation.** A completion should not reach an accounting-complete state when one side succeeds and the other side is invalid or missing.

### Build 177 — Posting execution and recovery

9. **Implement controlled invoice posting from an explicitly approved Finance candidate.** Service-authorized only, idempotent, auditable and fail-closed.

10. **Implement controlled journal-batch creation/posting.** Require balanced debit/credit entries and the existing GL authority rather than allowing the completion candidate to invent accounting truth.

11. **Add safe partial-failure recovery.** If invoice creation succeeds but journal creation fails—or vice versa—the system should identify the incomplete transaction and prevent silent duplication on retry.

12. **Implement reversal/void authority.** Corrections should produce an auditable reversal/void record rather than editing historical posted accounting records.

### Build 178 — Finance operational control plane

13. **Build the complete Finance completion lifecycle UI.** One queue should show: awaiting review → approved/rejected → candidates generated → posting approval → ready → posted/blocked/reversed.

14. **Add reason codes and actionable blocker explanations.** Instead of simply saying “blocked,” show exactly what dependency, permission, amount, identity or accounting prerequisite failed.

15. **Extend Admin → I.T. Readiness for the full Finance pipeline.** Show intake health, consumer failures, stale reviews, candidate failures, duplicate-prevention status, posting failures, accounting divergence and recovery actions. I.T. remains inside Admin, not a fifth module.

16. **Add Finance pipeline reconciliation views.** Detect orphan candidates, candidates without dispositions, postings without candidates, duplicate accounting references, posted invoices without GL counterparts, and other impossible states.

### Build 179 — Permissions, acceptance and release hardening

17. **Complete Finance permission enforcement testing.** Explicitly verify `hidden`, `view`, `create`, `approve`, and `manage`, including Admin break-glass access and direct API attempts that bypass the UI.

18. **Build synthetic end-to-end Finance acceptance fixtures.** Automatically create a safe test job/completion/intake/review/candidate/posting scenario, exercise success and failure paths, and restore the test state afterward.

19. **Expand rendered browser acceptance.** Test Finance review, approval, candidate creation, posting preflight, blocked cases, responsive layouts, Admin/I.T. visibility, permission denial and recovery behavior.

20. **Make the entire Finance completion-to-accounting chain a release gate.** GitHub CI should refuse a release if schema dependencies, idempotency, permissions, balancing, reversal safeguards, Jobs-writeback prohibition, provider-mutation prohibition, browser acceptance or I.T. release authority fail.

## Autonomous execution boundary

All 20 items above can be developed without further business input while preserving the already-established rules: four modules only, Admin break-glass access, Shared Core ownership, fail-closed cross-module writes, manual Production promotion, and provider-controlled Stripe/PayPal truth.

Keep the following outside this autonomous batch unless separately authorized or required by an already-fixed existing contract:

- Stripe/PayPal live mutation;
- actual Production promotion;
- tax-policy changes;
- chart-of-accounts business decisions;
- pricing changes;
- real-money/payment testing.

The intended execution sequence is **Build 175 → 176 → 177 → 178 → 179**, completing each build through migration/source work, regression gates, database convergence where required, exact-main CI, and authority-document updates before moving to the next.
