# YWI Next Steps and Sanity Check

**Current source/database boundary:** Schema `174`  
**Restart rule:** verify 174 remains current before beginning the next schema-changing build.

## Current checkpoint

The latest verified release corrected Schema 173's guessed Finance work-order dependency type. `job_completion_reviews.work_order_id` is canonical `uuid`, and Schema 174 extends the UUID identity contracts used by the Finance completion candidate chain.

At the last completed release checkpoint:

- source `main` was green on the exact Schema 174 merge SHA;
- Vercel deployment succeeded on that SHA;
- database schema drift was `174 / 174` and current;
- Finance schema-dependency failures were zero;
- Admin/I.T. release authority was green;
- Production promotion remained manual;
- GitHub `main` branch protection remained an infrastructure hardening item rather than a Schema 174 database blocker.

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
