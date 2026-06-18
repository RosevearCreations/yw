# Next Steps and Sanity Check — build 2026-06-14a / schema 147

## Sanity check

The app has a strong platform foundation but still needs fewer planning queues and more real write actions. The new visual placeholders make the app look more professional without risking broken images. The Markdown set is now consolidated around two main docs while keeping historical Markdown for context.

## Completed in this pass

1. Archived retired root helper Markdown and temporary `test_write` files.
2. Added `docs/ACTIVE_PROJECT_HANDBOOK.md` as the main compact project source of truth.
3. Added this next-step sanity file as the second main working doc.
4. Added schema 147 with Markdown consolidation, visual placeholder, competitive SEO, desktop/mobile polish, and next-step sanity registries.
5. Added graphic placeholders to the public shell.
6. Added graphic placeholders to key app sections: Toolbox, PPE, First Aid, Incident, Inspection, Jobs, Equipment, and Admin.
7. Updated cache markers to `2026-06-14a`.
8. Updated sitemap lastmod to 2026-06-14.
9. Preserved one H1 on the public shell.
10. Preserved CSS-only visual enrichment so there are no unapproved image dependencies.

## Next highest-value build steps

1. Build real quote/contact submit Edge Function and DB write path.
2. Build payment application action write path with approval and reversal rules.
3. Build bank CSV preview screen with upload, validation, and rejected-row table.
4. Build reconciliation candidate matching, split, undo, and signoff actions.
5. Build equipment QR/barcode scan capture with manual fallback.
6. Build equipment custody timeline UI from checkout to return-to-service.
7. Create visual asset approval screen before adding real images.
8. Create public route approval screen before publishing more sitemap pages.
9. Add Admin scorecard/progress rail summary above readiness tables.
10. Add persistent runtime fallback event logging.
11. Add mobile offline conflict resolution storage and cards.
12. Add route-specific SEO smoke checks for title, meta, H1, internal link, CTA, and proof.
13. Add image placeholder-to-approved-image replacement workflow.
14. Add CSS overlap/visual regression smoke checks for the new placeholder sections.
15. Add accountant export packaging for unresolved payment/reconciliation exceptions.
16. Add month-end close lock/reopen proof controls.
17. Add HST/GST review and remittance proof screens.
18. Add payroll remittance proof/signoff screens.
19. Migrate remaining repeated JSON/catalog configuration into DB-backed registries.
20. Convert more passive schema queues into real Admin buttons with rollback/fallback.

---

## 2026-06-14b — Schema 148 Real Write-Action Layer

This pass shifts the app from readiness-only queues into real operational write paths.

Completed:

1. Added `sql/148_real_write_actions_quote_payment_bank_recon_equipment_assets_routes_mobile_scorecards.sql`.
2. Appended schema 148 to `sql/000_full_schema_reference.sql` and updated schema drift to expect 148.
3. Added public `quote_contact_requests` and `quote_contact_request_events` tables.
4. Added `quote-contact-submit` Edge Function with validation, spam scoring, and DB insert.
5. Converted the public quote/contact form from preview-only to live submit.
6. Added `YWIAPI.submitQuoteContact()`.
7. Added `operations-manage` Edge Function for authenticated write actions.
8. Added payment action request write target for apply/reverse/refund/write-off/overpayment workflows.
9. Added bank CSV preview tables for accepted/rejected/duplicate row review.
10. Added bank CSV preview parser helper in `js/api.js`.
11. Added reconciliation match/split/undo/signoff request table.
12. Added equipment manual/QR/barcode scan event table.
13. Added equipment custody timeline table from checkout/site/return/service stages.
14. Added visual asset approval item table before real galleries/images.
15. Added public route approval table before sitemap expansion.
16. Added mobile offline conflict card table.
17. Added Admin scorecard progress rail table.
18. Added Admin-readable views for schema 148 operational rows.
19. Added schema 148 safe-list loading in `admin-directory`.
20. Added `Schema 148 live action layer` public visual section with responsive CSS.

Next highest-value actions:

1. Add Admin UI button/form for payment action requests.
2. Add Admin UI bank CSV upload and preview screen.
3. Add accepted/rejected/duplicate row preview with import confirmation.
4. Add reconciliation match/split/undo/signoff UI connected to `operations-manage`.
5. Add mobile manual equipment scan card connected to `operations-manage`.
6. Add QR/barcode camera scan where browser support is available.
7. Add equipment custody timeline display on job/equipment pages.
8. Add visual asset approval screen with alt text, consent, compression, and route assignment.
9. Add public route approval screen with title/H1/meta/proof/CTA checks.
10. Add Admin scorecard dashboard cards using `v_admin_scorecard_progress_rails`.
11. Add email notification for new quote/contact request.
12. Add duplicate quote/contact suppression and follow-up owner assignment.
13. Add payment proof attachment references.
14. Add month-end lock checks before payment posting.
15. Add bank CSV import confirmation that promotes preview rows to reconciliation workbench.
16. Add accountant export inclusion for unresolved payment/reconciliation exceptions.
17. Add visual placeholder replacement only after asset approval.
18. Add sitemap generation from approved public routes only.
19. Add persistent runtime fallback events for failed write actions.
20. Add smoke checks for each new Edge Function deployment.
