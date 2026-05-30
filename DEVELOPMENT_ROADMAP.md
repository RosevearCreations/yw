# Development Roadmap

Last refreshed: **2026-05-29a**

## Completed in this pass

1. Added schema **123** and app schema marker for equipment transfer/arrival/return verification.
2. Added equipment current-site and destination-site fields.
3. Added checkout safety-test status and notes.
4. Added site-arrival verification status, condition, test status, verifier, and notes.
5. Added return destination, return test status, return test notes, and final return verification.
6. Added equipment transfer verification audit events.
7. Added transfer/return exception directory view.
8. Added operational-depth gate table/view so equipment, accounting, and SEO sanity checks remain visible.
9. Updated Equipment UI with Verify Arrival / Site Test and Mark Return Verified actions.
10. Added Equipment exception table for missing arrival, pending return verification, damage, and issue rows.
11. Added Equipment transfer history table.
12. Updated Jobs directory Edge Function to return transfer history, return exceptions, and depth gates.
13. Updated Jobs manage Edge Function to write checkout, arrival, return, and final verification states.
14. Updated notifications for arrival verification, return verification, and return exceptions.
15. Updated canonical schema reference through schema 123.
16. Updated smoke checks for schema 123, equipment verification UI, Edge Function handlers, and current cache marker.
17. Updated CSS for equipment verification panels, status pills, and mobile-safe exception/history tables.
18. Updated active Markdown files and added the equipment transfer/return workflow document.
19. Refreshed `index.html` and `server-worker.js` cache version to **2026-05-29a**.
20. Re-ran sanity checks for JavaScript parsing, CSS brace balance, H1 count, and repository smoke status.

## Next logical 20 steps

1. Live-test schema 123 on Supabase and confirm all new columns/views deploy cleanly against production data.
2. Add row-level permission checks so only the assigned supervisor/site leader/admin can verify arrival or final return.
3. Add mobile camera capture and photo quality checks directly inside the arrival and return verification steps.
4. Add photo compression and upload retry progress for equipment evidence.
5. Add barcode/QR scan lookup for equipment code so withdrawal and return are less error-prone.
6. Add a required accessory checklist per equipment type, including “missing parts” exception handling.
7. Add “arrival failed test” follow-up action that automatically locks out equipment and creates a service task.
8. Add maintenance cost capture tied to return issues so repairs flow into job profitability.
9. Add better applied-cost accounting for equipment use, repair, delay, fuel, disposal, materials, and subcontractor costs.
10. Add payment application screens that match incoming payments to invoices, credits, deposits, and write-offs.
11. Add stronger bank CSV import preview and reconciliation review before posting matches.
12. Add HST/GST filing review screens with source totals, adjustments, signoff, and export notes.
13. Add payroll/remittance review screens with source hours, deductions, employer costs, and signoff.
14. Add month-end close lock/reopen controls tied to accounting period and job close state.
15. Add accountant export packaging with CSV/Markdown manifest, attachments list, and review checklist.
16. Add public SEO smoke checks for sitemap, robots, title, H1, meta description, alt text, structured data, and local wording.
17. Add local service-area proof fields so public location pages only mention places we truly serve.
18. Split `js/admin-ui.js` and `js/jobs-ui.js` into smaller modules once this pass is live-tested.
19. Add mobile support snapshot export with queued items, drafts, panel status, browser info, and service-worker version.
20. Add server-side saved draft sync after local-device draft behavior is stable and permission rules are clear.

## Following 20 steps after that

1. Build a true mobile worker task inbox with today, overdue, drafts, and pending-sync tabs.
2. Add route/job start checklist shortcuts with large tap targets.
3. Add geofence/weather/context cards on the Today dashboard.
4. Add mobile signature-capture review improvements.
5. Add accessibility checks for touch target size, contrast, labels, and keyboard focus.
6. Add server-side page/sort/filter preferences per Admin user.
7. Normalize job/equipment statuses into lookup tables and migrate legacy status variants.
8. Add undo-safe job and equipment status/action history.
9. Add payroll close blockers to the Guided Close Center.
10. Add sales tax filing preview/signoff screens.
11. Add accountant handoff package manifest generation.
12. Add evidence attachment counts and source previews to Admin row cards.
13. Add customer-facing service FAQs with one-H1 checks.
14. Add local review/testimonial proof blocks for location pages.
15. Add image completeness scoring for public gallery/service images.
16. Add staging-vs-production schema drift comparison notes.
17. Add per-role onboarding checklists for phone users.
18. Add app install analytics events for installed vs browser sessions.
19. Add module-level JS splitting for Today, Admin, Jobs, Reports, and Safety Ops.
20. Add release comparison snapshots that show schema/docs/code changes per build.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
