# YWI Next Steps and Sanity Check

**Current source/database boundary:** Schema `175`  
**Repository-cleanup baseline:** `main` at `ee49be76e378c1bb91d749d5534251227799deb6`  
**Build 175 source merge checkpoint:** `29a99d065a47776e4aa8e56ea1db6cb754954d92`  
**Restart rule:** verify Schema 175 remains current before beginning Build 176 or any later schema-changing work.

## Current checkpoint

Build 175 — Finance posting safety foundation — is complete at the database/runtime boundary.

Verified Build 175 evidence:

- exact merged `main` source SHA `29a99d065a47776e4aa8e56ea1db6cb754954d92` passed GitHub Run #67 (`33648494759`), including the dedicated posting-safety source gate and rendered Chromium module acceptance;
- Supabase schema drift reports `175 / 175` and `current`;
- all `24 / 24` required Finance schema-dependency contracts pass;
- all `6 / 6` Schema 175 Finance posting-safety assertions pass;
- posting execution violations = `0`;
- Schema 172 invoice posting rows = `0`;
- Schema 172 journal posting rows = `0`;
- the JWT-protected `finance-job-completion-posting-approval` Edge function is deployed and active;
- Vercel currently reports an account `build-rate-limit` failure, which is infrastructure throttling rather than a GitHub source-gate regression;
- Production promotion remains manual and was not performed.

Build 175 created a separate human posting-approval authority, durable idempotency identity, and immutable event → intake → disposition → candidate → approval provenance. It deliberately keeps accounting execution closed. No AR invoice, GL batch/entry, payment, Jobs writeback, Stripe/PayPal mutation, fifth module, or Production promotion was introduced.

## First checks on restart

1. Confirm `main` has not regressed from Schema 175.
2. Confirm database drift reports Schema `175` current before applying another migration.
3. Confirm all required Finance dependency contracts and Schema 175 posting-safety assertions remain green.
4. Confirm Admin remains break-glass `manage` across Safety, Finance, Jobs, and Admin.
5. Run the current source gates and rendered browser acceptance appropriate to the next change.
6. Keep I.T. Readiness inside Admin; do not create a fifth top-level module.
7. Keep Schema 175 posting execution closed while Build 176 adds mappings/preflight only.
8. Keep Production promotion deliberate/manual.

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
npm run test:finance-posting-safety
npm run test:contrast
npm run test:navigation
```

GitHub rendered-browser acceptance remains required before calling a resulting `main` checkpoint source-green. Vercel deployment evidence remains separately visible; account build-rate throttling is not permission to bypass source or database gates.

## Architecture sanity rules

- **Safety / OHSA, Finance, Jobs, Admin** remain the only top-level staff modules.
- Shared Core owns canonical shared identities; modules consume read models rather than create duplicates.
- Cross-module writes fail closed unless a declared contract identifies the owner and allowed operation.
- Finance job-completion review/candidate state is not posting approval.
- Finance posting approval is not posting execution authority.
- Schema 175 completion-candidate posting paths remain explicitly closed until a later reviewed release.
- Stripe/PayPal/provider truth remains provider/webhook controlled.
- Public SEO remains separate from private operations/customer evidence.
- One public H1, canonical URL, structured data, approved public image/alt text, and sitemap controls remain release requirements.

## Database sanity

Treat numbered files in `sql/` as permanent migration history. Do not delete or rewrite an applied migration because a later schema supersedes its runtime objects. Use a new ordered migration when database state must change.

Schema 173's historical dependency assumption, Schema 174's UUID correction, and Schema 175's posting-safety authority must all remain auditable in order. Do not collapse them into a generated full-schema snapshot.

## Repository sanity

The repository root should stay free of:

- dated `archive/` snapshots;
- `retired-markdown-*` directories;
- `test_write*` artifacts;
- generated full-schema snapshots;
- `node_modules/`, Playwright output, logs, temp files, and editor backups.

Git history is the historical archive. Keep only the three active authority documents and update them in place when the restart boundary changes.

## Next bounded development direction

Proceed to **Build 176 — Connect Finance to the existing accounting engine**. Build 176 covers roadmap items 5–8 only: map the existing Schema 172/175 candidate/approval chain into the existing invoice and journal posting authorities, add a non-mutating posting dry-run/preflight, and add paired invoice/journal consistency validation. Build 176 must **not** open actual accounting posting execution; that remains a separately reviewed Build 177 concern.

## Autonomous Build 175-179 execution queue

The following 20 items remain the canonical autonomous development sequence. Build 175 items 1–4 are now complete; Build 176 items 5–8 are next. The item wording is retained so the original approved plan remains stable and auditable.

### Build 175 — Finance posting safety foundation — COMPLETE

1. **Reverify Schema 174 source/database convergence.** Run the complete read-only schema drift, dependency-preflight, module-access, I.T. readiness, and release-authority checks before introducing 175.

2. **Create an explicit Finance posting-approval authority.** Candidate approval and accounting posting approval should be separate decisions. Schema 172 currently deliberately prevents a generated candidate from being posted.

3. **Add posting idempotency contracts.** One Finance candidate must be incapable of generating duplicate AR invoices, duplicate GL batches, or duplicate posting attempts even after retries.

4. **Add immutable posting provenance.** Every future accounting effect should retain the complete chain: Jobs completion event → Finance intake → Finance disposition → invoice/journal candidate → posting approval → accounting record → actor/timestamp.

### Build 176 — Connect Finance to the existing accounting engine — NEXT

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

All remaining items above can be developed without further business input while preserving the already-established rules: four modules only, Admin break-glass access, Shared Core ownership, fail-closed cross-module writes, manual Production promotion, and provider-controlled Stripe/PayPal truth.

Keep the following outside this autonomous batch unless separately authorized or required by an already-fixed existing contract:

- Stripe/PayPal live mutation;
- actual Production promotion;
- tax-policy changes;
- chart-of-accounts business decisions;
- pricing changes;
- real-money/payment testing.

The intended execution sequence remains **Build 175 → 176 → 177 → 178 → 179**, completing each build through migration/source work, regression gates, database convergence where required, exact-main CI, and authority-document updates before moving to the next.
