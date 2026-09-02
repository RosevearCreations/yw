# YWI Next Steps and Sanity Check

**Current source authority:** Schema `178` on the active Build 178 feature/release path  
**Verified live database boundary before promotion:** Schema `177`  
**Schema 177 exact-main checkpoint:** `main` `4ee81b16fc78221adc4ccefd2f488c17f1a18da0`, Run #83 (`33654967250`) — SUCCESS  
**Restart rule:** if Build 178 is not fully closed, verify live Schema 177/178 state and exact-main evidence before applying or extending another migration.

## Current checkpoint

Build 177 — controlled posting execution and recovery — is fully closed. Release evidence ID `7` records exact-main Run #83, Release Authority is GREEN, and `finance-job-completion-posting-approval` is ACTIVE v3 with JWT verification.

Verified Schema 177 safety boundary:

- schema drift `177 / 177`, current;
- Schema 177 release rail `100%` complete;
- posting execution release = OFF;
- provider mutation = OFF;
- required posting mappings = `3`, approved = `0`;
- posting approvals = `0`;
- execution runs = `0`;
- reversals = `0`;
- Finance invoice postings = `0`;
- Finance journal postings = `0`;
- Production promotion remains manual;
- GitHub `main` remains unprotected, reported separately as repository-enforcement AMBER.

Build 178 — Finance operational control plane — is the active release. It adds the unified completion-to-accounting lifecycle, reason-coded blocker/action guidance, Finance reconciliation/integrity views, expanded Admin → I.T. Finance pipeline readiness, and dynamic current-schema dependency preflight. It reuses the existing Schema 169–177 Finance/accounting authorities and does not create another accounting system.

The `0 / 3` approved posting mappings are **not a migration failure**. They remain deliberate accountant/bookkeeper decisions. Build 178 must not turn them on or enable posting execution merely to make a queue look green.

## First checks on restart

1. Confirm `main` and any open Build 178 PR exact SHA before making source changes.
2. Confirm live database drift is either verified Schema `177` before Build 178 application or `178 / 178` after it; never assume.
3. Confirm all registered schema-dependency contracts through the live expected schema pass.
4. Confirm Schema 175 posting-safety, Schema 176 preflight, Schema 177 execution/recovery, and Schema 178 operational assertions are green when Schema 178 is live.
5. Confirm Admin remains break-glass `manage` across Safety, Finance, Jobs, and Admin.
6. Confirm execution release/provider mutation remain OFF unless a separately reviewed future authority deliberately changes them.
7. Confirm accountant mappings remain human-controlled and are not silently approved by I.T.
8. Confirm Finance reconciliation has no critical orphan/duplicate/accounting-divergence issues before any future execution release.
9. Confirm protected Finance and Admin I.T. Edge functions have JWT verification enabled and versions matching current source.
10. Keep Production promotion deliberate/manual.

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
npm run test:finance-posting-preflight
npm run test:finance-posting-execution-recovery
npm run test:finance-operational-control-plane
npm run test:contrast
npm run test:navigation
```

GitHub rendered-browser acceptance remains required before calling a resulting `main` checkpoint source-green. Vercel deployment evidence remains separate from source correctness; infrastructure throttling or unavailable connector context is not permission to bypass source/database gates.

## Architecture sanity rules

- **Safety / OHSA, Finance, Jobs, Admin** remain the only top-level staff modules.
- I.T. Readiness remains inside Admin/manage, not a fifth module.
- Shared Core owns canonical shared identities; modules consume read models rather than create duplicates.
- Cross-module writes fail closed unless a declared contract identifies the owner and allowed operation.
- Finance completion review/candidate state is not posting approval.
- Finance posting approval is not posting execution authority.
- Finance posting preflight is read-only validation and not a browser-controlled release switch.
- Posting execution is service-authorized/idempotent but remains behind a server-owned release gate.
- Recovery-required states quarantine retry rather than creating duplicate accounting effects.
- Reversal/void preserves original history and creates auditable reversing effects.
- Accountant/chart mapping approval remains a human accounting decision.
- Finance does not write back to Jobs through completion accounting.
- Stripe/PayPal/provider/payment truth remains provider/webhook controlled and OFF in this Finance pipeline.
- Public SEO remains separate from private operations/customer evidence.

## Database and repository sanity

Treat numbered files in `sql/` as permanent migration history. Do not delete or rewrite an applied migration because a later schema supersedes its runtime objects. Schema 173's historical assumption, Schema 174's UUID repair, Schema 175's posting-safety authority, Schema 176's mapping/preflight authority, Schema 177's execution/recovery authority, and Schema 178's operational control plane must remain auditable in order.

Git history is the repository archive. Keep only the three active Markdown authorities; do not restore `archive/`, `retired-markdown-*`, `test_write*`, generated full-schema snapshots, `node_modules/`, Playwright output, logs, temp files, or editor backups.

## Build sequence

### Build 175 — Finance posting safety foundation — COMPLETE
1. Reverify prior source/database convergence.
2. Separate Finance posting approval from candidate approval.
3. Add posting idempotency contracts.
4. Add immutable posting provenance.

### Build 176 — Existing accounting-engine mapping and preflight — COMPLETE
5. Map invoice candidates to `job_invoice_postings` / AR authority.
6. Map journal candidates to `job_journal_postings` / GL authority.
7. Add read-only posting dry-run/preflight.
8. Add paired invoice/journal consistency validation.

### Build 177 — Posting execution and recovery — COMPLETE
9. Controlled invoice posting authority implemented behind the disabled release gate.
10. Controlled balanced GL posting implemented using existing accounting authority.
11. Partial/orphan state recovery quarantine and idempotent retry protection implemented.
12. Auditable reversal/void authority implemented without rewriting posted history.

### Build 178 — Finance operational control plane — ACTIVE
13. Complete Finance lifecycle UI: intake → disposition → candidates → posting approval → preflight → execution/recovery → reversal.
14. Add reason-coded blockers and actionable operator guidance.
15. Extend Admin → I.T. Readiness across the Finance pipeline.
16. Add reconciliation views for orphan, duplicate, missing-counterpart and impossible accounting states.

### Build 179 — Permissions, acceptance and release hardening — NEXT AFTER 178 CLOSEOUT
17. Complete Finance permission enforcement testing for `hidden`, `view`, `create`, `approve`, `manage`, plus Admin break-glass and direct API bypass attempts.
18. Build safe synthetic end-to-end Finance acceptance fixtures with deterministic cleanup and no provider/payment effects.
19. Expand rendered browser acceptance for Finance lifecycle, approval, preflight, blocked/recovery, responsive layouts, I.T. readiness and permission denial.
20. Make the full completion-to-accounting safety chain a release gate: dependencies, permissions, idempotency, balancing, reversal safeguards, Jobs-writeback prohibition, provider-mutation prohibition, browser acceptance and I.T. release authority.

## Autonomous execution boundary

Build 178–179 engineering can continue autonomously **behind fail-closed gates**. Keep these outside autonomous mutation unless separately authorized:

- accountant approval of chart-of-accounts mapping decisions;
- enabling the Finance posting execution release;
- Stripe/PayPal live mutation;
- real-money/payment testing;
- tax-policy/chart-of-accounts business decisions;
- pricing changes;
- actual Production promotion.
