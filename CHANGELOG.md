# Changelog

## 2026-05-30a

- Added schema **124** for accounting cost depth, payment application review, reconciliation review, HST/GST and payroll remittance review, month-end close controls, accountant package depth, and equipment accountability.
- Added QR/barcode, required verifier role, accessory checklist, and service-task structures for equipment checkout, site arrival, return, and failed-test follow-up.
- Updated `jobs-directory` to return accounting depth workbench rows and equipment accountability/service-task rows.
- Updated `jobs-manage` to save equipment scan/accessory fields and create service tasks from failed arrival/return tests.
- Updated `admin-manage` with review/update actions for payment applications, bank reconciliation, remittance filing review, month-end close, and accountant package status.
- Updated `js/jobs-ui.js` with Accounting Depth Workbench tables/buttons plus QR/barcode/accessory/service-task equipment controls.
- Updated canonical schema reference, smoke checks, cache marker, CSS/JS sanity checks, and Markdown documentation.

## 2026-05-29a

- Added schema **123** for equipment transfer, site-arrival verification, return verification, transfer event history, return exceptions, and operational-depth gates.
- Updated Equipment UI with Current Site, Destination Site, checkout safety test, arrival/site test, return test, exception list, transfer history, and final return verification.
- Updated `jobs-manage` with checkout destination handling, `verify_arrival`, return exception handling, and `verify_return_complete`.
- Updated `jobs-directory` to return equipment transfer history, return exceptions, and operational-depth gates.
- Updated canonical schema reference, smoke checks, CSS, cache marker, and active Markdown.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
