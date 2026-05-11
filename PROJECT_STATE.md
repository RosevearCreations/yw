# Project State

Last refreshed: **2026-05-10**  
Latest schema marker: **105_repo_cleanup_and_roadmap_refresh**

## Current status

The repo is now cleaned into a smaller active Markdown set. Older root and docs Markdown files were archived, not deleted, so history remains available without cluttering the working handoff.

The app itself remains focused on:

- mobile-first HSE capture;
- Admin-backed operating records;
- jobs/work orders/estimates/service-session tracking;
- historical and management reporting;
- accounting-close workflow foundations;
- offline-aware fallbacks and safer error messaging.

## Latest meaningful app state

- Reports now lazy-load and should not time out while the user is simply opening `#admin`.
- Accounting-close admin controls exist in the schema/UI direction and need live Supabase verification after schema application.
- Admin manager screens have many DB-backed entities but still need a friendlier real-app dashboard layer over the raw manager lists.
- The backend accounting model now covers major close workflow records, but posting automation, reconciliation import/matching, and accountant package generation still need practical end-to-end testing.

## Cleanup decisions in this pass

### Removed from active build root

- `test_write.txt`
- `test_write2_OLD.txt`
- `test_write3.txt`
- `test_write_OLD.txt`

### Moved out of active root Markdown

- `AI_START_PROMPT.md`
- `PROJECT_BRAIN.md`
- `REPO_BASE.md`
- `RUNBOOK_AUTH_BOOTSTRAP.md`

These are now in `archive/markdown-retired-2026-05-10/root/`.

### Moved out of active docs Markdown

Older pass-specific docs were moved into `archive/markdown-retired-2026-05-10/docs/`. The active `docs/` folder now keeps only current reference docs.

### Retired old SQL verification helper

`sql/VerifyDB_24_04_2026.sql` was moved to `archive/sql-retired-2026-05-10/` because it is date-specific and no longer the current schema validation source.

## Active root Markdown set

- `README.md`
- `PROJECT_STATE.md`
- `NEW_CHAT_STATUS.md`
- `DEVELOPMENT_ROADMAP.md`
- `KNOWN_ISSUES_AND_GAPS.md`
- `DATABASE_STRUCTURE.md`
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `TESTING_CHECKLIST.md`
- `CHANGELOG.md`
- `AI_CONTEXT.md`

## Active docs set

- `docs/README.md`
- `docs/ACCOUNTING_CLOSE_END_TO_END_WORKFLOW.md`
- `docs/HISTORICAL_REPORTING.md`
- `docs/JOBS_COMMERCIAL_WORKFLOW.md`
- `docs/ONTARIO_ACCOUNTING_AND_TAX_GUARDRAILS.md`
- `docs/WORKFLOW_AUTOMATION_AND_EVIDENCE_REVIEW.md`

## Next work priority

Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md` as the source of truth for the next 20 steps.
