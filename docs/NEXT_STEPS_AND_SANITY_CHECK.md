# YWI Next Steps and Sanity Check

**Current source authority:** Schema `179` on the active Build 179 feature/release path  
**Verified live database boundary before promotion:** Schema `178`  
**Schema 178 final clean-main checkpoint:** `400e559663d9d71ce07c8cac638a2ef7016320d0`, Run #95 (`33659172805`) — SUCCESS  
**Restart rule:** verify the exact Build 179 source/PR/main SHA and live Schema 178/179 state before applying or extending another migration.

## Current checkpoint

Build 178 — Finance operational control plane — is fully closed and live. The verified boundary is:

- schema drift `178 / 178`, current;
- Finance dependency checks through Schema 178 green;
- Schema 169–178 Finance assertion chain green;
- Finance reconciliation issues `0`, critical `0` at closeout;
- posting execution release OFF;
- provider mutation OFF;
- required posting mappings `3`, approved `0`;
- no release-created Finance posting approvals, execution runs, reversals, invoice postings, or journal postings;
- protected Finance posting and Admin I.T. functions aligned with JWT verification;
- final exact-main source evidence SHA `400e559663d9d71ce07c8cac638a2ef7016320d0`, Run #95;
- Release Authority GREEN;
- repository enforcement separately AMBER because `main` is unprotected;
- Production promotion manual.

Build 179 — Finance permissions, synthetic acceptance and release hardening — is the active release. It completes items 17–20 of the autonomous Finance hardening sequence without enabling financial execution.

## Build 179 scope

17. **Permission enforcement:** test `hidden`, `view`, `create`, `approve`, `manage`, Admin break-glass and direct bypass behavior. Protected Finance endpoints expose server-resolved access and explicitly require JWT verification.
18. **Synthetic end-to-end acceptance:** deterministic browser-only fixtures represent Finance review → candidates → posting approval → blocked preflight/release → recovery → posted → reversed. They do not persist business/accounting data and never invoke payment providers.
19. **Rendered browser acceptance:** run the real Finance and I.T. client code on phone and desktop for visibility, action controls, blocker/recovery guidance, permission denial, responsive overflow and Admin I.T. evidence.
20. **Full release gate:** enforce dependency, permission, JWT, idempotency, mapping, balancing, recovery/reversal, reconciliation, Jobs-writeback prohibition, provider-mutation prohibition, browser acceptance and I.T. release-authority checks.

## Restart checks

1. Confirm Build 179 branch/PR exact SHA before modifying source.
2. Confirm live DB is `178 / 178` before Schema 179 application, or `179 / 179` after it; never assume.
3. Confirm all schema-dependency contracts through the live expected version pass.
4. Confirm Schema 175–179 Finance assertion families are green once 179 is live.
5. Confirm all active Admin profiles resolve `manage` on Safety, Finance, Jobs and Admin.
6. Confirm both `finance-job-completion-review` and `finance-job-completion-posting-approval` require JWT verification.
7. Confirm execution release and provider mutation remain OFF.
8. Confirm accountant mappings remain human-controlled and are not approved by migrations/tests.
9. Confirm Finance reconciliation has no critical orphan/duplicate/incomplete-pair/reversal divergence.
10. Confirm synthetic acceptance did not create Finance posting approvals, execution runs, reversals, AR invoices, GL batches, invoice postings, journal postings, or provider effects.
11. Keep Production promotion deliberate/manual.

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
npm run test:finance-release-hardening
npm run test:contrast
npm run test:navigation
npm run test:browser:modules
npm run test:browser:finance
```

GitHub rendered-browser acceptance is required before source-green. Apply Schema 179 only after its exact merged `main` SHA passes the source gate. Deployment evidence is separate and must be verified before calling runtime deployment green.

## Architecture sanity rules

- Safety / OHSA, Finance, Jobs and Admin are the only top-level staff modules.
- I.T. Readiness stays inside Admin/manage.
- Shared Core owns canonical identities; modules do not create parallel identity stores.
- Effective permission order is `hidden < view < create < approve < manage`.
- Client visibility never replaces protected server authorization.
- Completion disposition/candidate authority is not posting approval.
- Posting approval is not execution release.
- Preflight is read-only.
- Execution remains behind a private server-owned release switch.
- Recovery-required state quarantines retry rather than duplicating accounting effects.
- Reversal preserves original history and creates auditable reversing records.
- Accountant/chart mappings are human accounting decisions.
- Finance does not write back to Jobs through this completion/accounting pipeline.
- Stripe/PayPal/provider/payment mutation remains OFF/outside this Finance pipeline.
- Synthetic acceptance is non-persistent and must not manufacture proof by mutating business data.

## Database and repository sanity

Keep numbered migrations permanent and ordered through Schema 179. Do not edit old applied migrations to erase historical assumptions/repairs. Git history is the repository archive; the active tree retains only the three canonical Markdown authorities and excludes stale archive trees, retired Markdown, generated full-schema snapshots, Playwright output, dependencies, logs, temp and backup artifacts.

## Build sequence

- **Build 175 — Finance posting safety foundation — COMPLETE**
- **Build 176 — Existing accounting-engine mapping and preflight — COMPLETE**
- **Build 177 — Posting execution and recovery — COMPLETE, release OFF**
- **Build 178 — Finance operational control plane — COMPLETE**
- **Build 179 — Permissions, synthetic acceptance and release hardening — ACTIVE**

## After Build 179

Build 179 closes the 20-point autonomous Finance hardening set. After it is fully merged, database-validated, function-aligned, release-evidenced and cleaned, do **not** autonomously enable posting execution, approve chart mappings, mutate payment providers, conduct real-money tests, invent tax/chart policy, change pricing, or promote Production. The next autonomous YW build should move to a safe non-financial improvement area unless those human policy gates are separately authorized.