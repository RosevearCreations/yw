# Known Issues and Gaps

Last refreshed: **2026-05-10**

This is the active issue list. Older historical notes were archived so this file stays useful.

## Highest-priority gaps

### 1. Admin still feels like raw database management
Many screens expose records directly. The next value step is dashboard workflows: Admin Home, Close Center, Jobs Center, HSE Review Center, and Error/Health Center.

### 2. Accounting close needs live end-to-end verification
The schema and UI direction exist for payment application, journal generation, reconciliation, filing/remittance review, close/reopen, and accountant export. It still needs live Supabase testing with real records.

### 3. Reporting can still be heavy
Reports lazy-load now, but large reporting datasets still need pagination, narrower date ranges, and better cached rollups.

### 4. Error handling is better but not yet centralized
Timeouts and failed uploads have more fallbacks, but operators need one Error/Health Center instead of hunting through screens or console messages.

### 5. Role-based access needs practical review
The app has role concepts, but every manager/action should be reviewed for who can view, create, edit, approve, close, reopen, export, and delete.

### 6. Mobile field experience needs simplification
Forms work, but longer admin and operations screens still need phone-first grouping, save progress, outbox status, and fewer fields per step.

### 7. Migration state is file-based
The repo has SQL migrations, but the app should expose DB-applied schema status so live drift is easier to diagnose.

### 8. Media/evidence storage needs a manager
Uploads, failed uploads, signatures, photos, and evidence records need one admin view with retry, replace, link, and archive controls.

### 9. Backup and restore process is not fully operationalized
Production readiness needs a documented, tested restore process for DB records and evidence/media files.

### 10. Public SEO work depends on which public pages remain exposed
The app shell has one H1. If public marketing pages are added, each page needs a unique title, meta description, one H1, local/service wording, and proof content.

## Recently addressed

- Reports no longer auto-load from the Admin route.
- The active Markdown set was cleaned and archived.
- Obvious test-write files were removed from the active build.
- Old date-specific SQL verification helper was retired to archive.
- Schema marker 105 documents the cleanup/roadmap refresh.

## Watch items after deploy

- Confirm `#admin` opens without a Reports timeout.
- Confirm `#reports` loads only when opened or reloaded.
- Confirm accounting-close views exist after migrations 100–105.
- Confirm service worker cache updates to `2026-05-10a`.
- Confirm no missing script/style/icon assets in the browser console.
