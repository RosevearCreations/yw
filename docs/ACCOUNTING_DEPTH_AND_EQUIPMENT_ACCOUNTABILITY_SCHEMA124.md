# Accounting Depth and Equipment Accountability — Schema 124

Last refreshed: **2026-05-30a**

## Purpose

Schema **124** deepens the areas that still needed operational weight:

- job profitability and applied cost depth,
- payment application review,
- bank reconciliation review,
- HST/GST and payroll remittance review,
- month-end close lock/reopen controls,
- accountant handoff package metadata,
- equipment QR/barcode accountability,
- accessory checklist tracking,
- failed-test service-task creation.

## Accounting depth added

Schema 124 extends job financial events with cost category, billable-charge status, linked equipment/signout, accounting close period, posting status, and profitability notes. The new `v_job_cost_depth_directory` view summarizes revenue, cost, profit, equipment cost, fuel/disposal cost, material/subcontract cost, and open financial events by job.

Payment applications now include credit, discount, write-off, overpayment, reconciliation source, review status, reviewer, review timestamp, and payload metadata. The new payment workbench view combines AR and AP application rows.

Bank reconciliation items now include raw CSV/import context, suggested match target, match score, match reason, manual review status, reviewer, undo link, and review notes.

Sales tax filings and payroll remittance runs now include source totals, adjustment notes, proof URL, signoff, filed/remitted references, and review step status.

Month-end close rows now include AR/AP/GL/payroll/tax lock state, close checklist, package manifest, accountant package reference, close signoff, and reopen reason.

## Equipment accountability added

Equipment items now support QR code value, barcode value, required verifier role, and accessory checklist requirement.

Equipment signouts now support accessory checklist snapshots and accessory status at checkout, arrival, and return. Missing/damaged accessory notes travel with the signout.

Failed arrival tests, failed return tests, damaged returns, and return issues can now create `equipment_service_tasks`. These rows are meant to become the supervisor follow-up list before equipment returns to service.

## UI added

The Jobs UI now includes:

- Accounting Depth Workbench,
- payment application review rows,
- reconciliation review rows,
- remittance/filing review rows,
- month-end close rows,
- QR/barcode fields,
- accessory checklist fields,
- equipment accountability table,
- equipment service-task table.

## Still next

The next pass should add per-row review buttons, real payment-application editor screens, bank CSV preview, camera scan lookup, verifier-role enforcement, service-task assignment/completion, and accountant export package generation from live close data.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
