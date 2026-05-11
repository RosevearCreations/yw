# Development Roadmap

Last refreshed: **2026-05-10**

This roadmap is the active forward plan after the Markdown cleanup. The goal is to make the site and backend feel less like a prototype and more like a real operations app.

## Next logical 20 steps

### 1. Build an Admin Home Command Center
Create a real admin landing dashboard with health cards for overdue HSE items, open jobs, pending reports, accounting close status, failed uploads, scheduler status, and auth/function errors.

### 2. Add an App Health and Error Center
Centralize frontend errors, failed API calls, timeout events, upload failures, scheduler failures, and Supabase function status into one admin screen with retry/dismiss controls.

### 3. Add schema migration tracking inside the DB
Create a `schema_migrations` or `app_schema_versions` table so the UI can show exactly which migrations have been applied instead of only relying on files.

### 4. Turn Accounting Close into a guided Close Center
Create one workflow screen for period open/close status, trial balance checks, AR/AP review, sales tax review, payroll remittance review, bank reconciliation, lock/reopen, and accountant export.

### 5. Finish payment application UI
Add practical screens for applying customer payments to invoices and vendor payments to bills, with partial payment, overpayment, unapplied balance, and void/reversal handling.

### 6. Build bank import and reconciliation matching
Add CSV/import support, match scoring, manual match controls, exceptions, difference reasons, and a reviewed/locked reconciliation state.

### 7. Harden journal-line generation
Make posting candidates visible before posting, require balanced debits/credits, show source document links, and block period posting when the period is locked.

### 8. Finish accountant handoff export packaging
Generate a downloadable package index covering trial balance, GL detail, AR/AP aging, tax filing support, payroll remittance support, bank reconciliation, receipts, and adjustment notes.

### 9. Add role-based dashboard presets
Show different default dashboards for Admin, Supervisor, Crew/Worker, Accounting, and Read-only/Accountant roles.

### 10. Add pagination/search/filtering to heavy Admin managers
Many managers will become too large. Add consistent search, status filters, date filters, saved filters, and pagination for every large entity list.

### 11. Improve Jobs Center workflow
Create a real jobs dashboard: estimates, accepted quotes, scheduled sessions, crew assignment, route execution, completion proof, invoice candidates, and callback/warranty follow-up.

### 12. Improve HSE Review Center workflow
Create one review lane for incidents, inspections, corrective actions, training/SDS acknowledgements, equipment hazards, overdue reviews, and evidence attachments.

### 13. Add media/evidence manager
Centralize uploaded photos, signatures, files, failed uploads, retry status, linked job/HSE context, and image completeness scoring.

### 14. Add mobile field-worker polish
Make the phone experience faster: larger buttons, fewer form fields per screen, save progress indicators, offline outbox status, and one-tap resume last form.

### 15. Add notification/task inbox
Use DB-backed tasks for admin follow-up: failed upload, payroll review, close review, incident follow-up, expiring training, overdue report, and reconciliation exception.

### 16. Add service-area SEO landing pages if this app becomes public-facing
If public pages are added, create clean local landing pages for key services and towns. Keep one H1 per page and match wording to real customer searches.

### 17. Add structured data and proof content for public pages
Add Organization/LocalBusiness structured data where appropriate, plus reviews, before/after proof, service-area clarity, and complete contact/business details.

### 18. Add deployment smoke checks to CI
Run `node --check`, the repo smoke check, H1 checks, missing-asset checks, and basic HTML/script reference checks before every deploy.

### 19. Add backup/export/restore plan
Document and test database export, attachment backup, restore steps, and archive retention for accounting, HSE evidence, and job history.

### 20. Add production readiness checklist
Before calling the app production-ready, verify security rules, environment variables, function timeouts, CORS, rate limits, backups, admin audit trails, and role permissions.

## SEO direction to keep applying

Google recommends clear, descriptive page titles, and Google Business Profile local ranking depends mainly on relevance, distance, and prominence. Every public build pass should keep titles/headings clear, use local service wording, show proof, and avoid confusing title/headline structure.

References:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://support.google.com/business/answer/7091

## Development rule

Do not add a new feature without also updating:

- schema migration files when DB shape changes;
- `sql/000_full_schema_reference.sql`;
- active Markdown docs;
- smoke checks when a new critical file or workflow is added.
