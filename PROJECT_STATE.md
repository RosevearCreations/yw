# Project State

Last refreshed: **2026-05-30a**

Current build marker: **2026-05-30a / schema 124**.

The current pass advances the YWI/HSE app from equipment transfer verification into deeper accounting and equipment accountability. Schema 124 adds job-cost depth, payment application review, bank reconciliation review, HST/GST and payroll remittance review, month-end close controls, accountant export package metadata, equipment QR/barcode fields, accessory checklists, and automatic service-task creation from failed equipment arrival/return tests.

The repaired schema 123 equipment-transfer migration remains in place. Schema 124 builds on it instead of replacing it.

Important live-test items: apply schema 124 in Supabase, redeploy `jobs-directory`, `jobs-manage`, and `admin-manage`, hard-refresh the browser/service worker, then test Jobs, Equipment, Accounting Depth Workbench, and equipment return/signoff flows with real rows.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
