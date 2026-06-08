# Schema 137 — Release Depth, Payment/Reconciliation Drills, Equipment Cost Recovery, Local SEO Prominence, CSS Fallbacks, Data Migration Validation, and Runtime Messages

Build marker: `2026-06-06d`  
Schema marker: `137`

This pass adds the next Admin-visible execution layer after schema 136. It focuses on practical release drills and source-of-truth decisions instead of only listing broad backlog items.

## Added queues

- `v_app_payment_reconciliation_cutover_drill_queue`
- `v_app_equipment_service_cost_recovery_queue`
- `v_app_local_seo_prominence_action_queue`
- `v_app_css_accessibility_fallback_queue`
- `v_app_data_migration_validation_queue`
- `v_app_runtime_release_message_queue`

## Completed this pass

1. Added schema 137 migration.
2. Updated the canonical full schema reference to expect schema 137.
3. Added Admin Directory loading for schema 137 views.
4. Added Admin Production Readiness tables for schema 137 queues.
5. Updated cache markers to `2026-06-06d`.
6. Restored required Markdown archive snapshots.
7. Retired active `test_write` files.
8. Retired helper Markdown from the active root.
9. Preserved `sitemap.xml` and `robots.txt`.
10. Preserved one public H1 rule.
11. Preserved CSS brace-balance checks.
12. Preserved Edge Function parse checks.
13. Added smoke coverage for schema 137.
14. Updated active Markdown with completed and next 20 steps.
15. Kept the schema 128 roadmap-column repair in the full schema path.
16. Added payment/reconciliation dry-run drill rows.
17. Added equipment service cost recovery rows.
18. Added local SEO prominence rows.
19. Added CSS/accessibility fallback rows.
20. Added data migration validation and runtime message rows.

## Next 20 direction

1. Turn payment drill rows into live apply/reverse buttons.
2. Add bank CSV preview upload UI.
3. Add reconciliation scoring display and manual match screen.
4. Add close-period lock/reopen UI.
5. Add accountant export manifest builder.
6. Add equipment accessory DB templates.
7. Add camera QR/barcode scanning.
8. Add return-to-service closeout proof upload.
9. Link equipment service costs into job financial events.
10. Add local proof blocks to service/location pages.
11. Generate sitemap/robots from approved route registry.
12. Add broken-link and image-alt smoke checks.
13. Add JSON-LD validation smoke checks.
14. Add mobile offline conflict resolver UI.
15. Add runtime fallback telemetry rows.
16. Add user-friendly error-message catalog usage in UI.
17. Add CSS accessibility/contrast checks.
18. Convert high-risk JSON data sources to DB-backed registries.
19. Add export/import proof checks for data migrations.
20. Add final release cutover checklist with live deployment proof.
