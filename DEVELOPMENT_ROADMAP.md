# Development Roadmap

Last refreshed: **2026-05-15a**

The previous 20-step plan has now been partly converted into real app structure. This pass completed the foundation for Admin Home, App Health, schema tracking, task inbox, mobile dashboard polish, cleanup guardrails, and stronger smoke checks.

## Completed or partially completed from the previous 20

1. **Admin Home Command Center** — added frontend cards and DB view.
2. **App Health and Error Center** — added Health and Schema Center plus diagnostics feed.
3. **Schema migration tracking inside DB** — added `app_schema_versions` and status view.
4. **Guided Accounting Close Center foundation** — Command Center now surfaces close blockers, reconciliation, tax/remittance, and packages.
5. **Payment application UI visibility** — Command Center now surfaces AR/AP payment application attention counts.
6. **Bank reconciliation matching visibility** — Command Center and task inbox surface reconciliation review items.
7. **Journal-line generation hardening direction** — documented and kept in accounting queue; full posting validation still next.
8. **Accountant handoff export packaging visibility** — Command Center surfaces package delivery attention.
9. **Role-based dashboard presets** — added DB view for role dashboard defaults.
10. **Heavy manager guardrails** — smoke checks and dashboard summaries were strengthened; deeper pagination still next.
11. **Jobs Center workflow visibility** — Command Center links open job count to Jobs.
12. **HSE Review Center visibility** — Command Center links HSE/safety reviews to HSE Ops.
13. **Media/evidence manager direction** — failed upload and evidence review stay visible; fuller manager still next.
14. **Mobile field-worker polish** — added mobile card/table spacing improvements.
15. **Notification/task inbox foundation** — added DB-backed Admin Task Inbox.
16. **Public SEO landing-page rule** — preserved one-H1 check and SEO docs.
17. **Structured data/proof content direction** — documented for future public pages.
18. **Deployment smoke checks** — updated smoke check for schema 106 and cleanup guardrails.
19. **Backup/export/restore direction** — added current docs and next-step plan.
20. **Production readiness checklist direction** — added current docs and next-step plan.

## Next logical 20 steps

### 1. Add drill-down actions to Command Center cards
Each Command Center card should jump to the correct manager, selected entity, and filter state instead of only opening a broad screen.

### 2. Build a real Close Center screen
Create a single guided close workflow showing open period, AR/AP aging, payment applications, reconciliation, tax filing, payroll remittance, lock/reopen, and export package status.

### 3. Add posting candidate preview and validation
Before posting invoices, bills, or journal batches, show generated debit/credit lines, source links, balance check, locked-period check, and approval status.

### 4. Add bank import UI
Create CSV upload/import UI for bank statements with preview, duplicate detection, import session status, and rejected-row handling.

### 5. Add reconciliation manual review screen
Turn reconciliation exceptions into a review queue with match suggestions, accept/reject/manual match, difference reason, and reviewed-by tracking.

### 6. Add payment application detail forms
Support partial payments, overpayments, unapplied balances, invoice/bill selection, reversal/void flow, and audit trail.

### 7. Add accountant export download bundle
Generate a package index plus CSV/JSON support files for trial balance, GL detail, AR/AP aging, tax support, payroll remittance support, reconciliation, and receipts.

### 8. Add attachment/evidence manager
One screen for photos, signatures, failed uploads, report files, receipt files, job evidence, HSE proof, retry/replace/archive status, and image completeness scoring.

### 9. Add live schema drift check
Compare `app_schema_versions` against expected repo migration numbers and show a clear warning if the database is behind the deployed app.

### 10. Add admin pagination and saved filters
Every large admin table should get search, status/date filters, saved filter presets, pagination, and export current view.

### 11. Add role permission matrix screen
Show who can view/create/edit/approve/delete/close/reopen/export for each major workflow.

### 12. Add worker mobile dashboard
Give workers a simple phone-first home screen: clock in/out, assigned forms, open training/SDS, last saved draft, offline outbox, and contact/admin help.

### 13. Add supervisor daily dashboard
Show active crews, no-show/late risk, evidence needing review, open incidents, route execution, and payroll exceptions.

### 14. Add notification delivery retry lane
Show failed email/SMS/push notifications with retry, dead-letter reason, provider response, and mark-resolved controls.

### 15. Add backup and restore runbook automation
Create scripts/checklists for Supabase export, storage/media export, restore test, and retention schedule.

### 16. Add audit log viewer
Centralize security, admin changes, accounting close/reopen, posting, exports, and permission changes.

### 17. Add public-page SEO checklist automation
If any public marketing pages are added, smoke check titles, meta descriptions, one H1, missing alt text, local terms, and broken assets.

### 18. Add structured data support for public pages
For marketing pages, add Organization/LocalBusiness/Service structured data only where accurate.

### 19. Add CI-style deployment gate
Run `node --check`, smoke check, H1 check, asset reference check, schema marker check, and service-worker version check before packaging.

### 20. Add production readiness sign-off screen
Create an Admin checklist covering RLS, auth, CORS, env vars, backups, schema drift, logs, monitoring, rate limits, roles, and recovery steps.

## SEO rule to keep applying

Use words people actually search for in prominent places like titles and main headings, keep titles descriptive and concise, and for local ranking keep relevance, distance, and prominence in mind. Every exposed page should have one clear H1.

References:

- https://developers.google.com/search/docs/essentials
- https://developers.google.com/search/docs/appearance/title-link
- https://support.google.com/business/answer/7091
