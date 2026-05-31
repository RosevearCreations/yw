# Deployment Guide

Last refreshed: **2026-05-30a**

## Current deploy order

1. Apply database migrations through `sql/124_accounting_cost_payment_reconciliation_remittance_equipment_depth.sql`.
2. Confirm `sql/000_full_schema_reference.sql` matches the live schema version target.
3. Deploy Supabase Edge Functions:
   - `jobs-directory`
   - `jobs-manage`
   - `admin-manage`
4. Deploy static assets with the `2026-05-30a` cache marker.
5. Hard-refresh or clear the service worker cache on test browsers.
6. Run the Testing Checklist live-test items.

## Important warning

Do not skip the Edge Function deploy after schema 124. The UI now requests accounting depth rows, payment review actions, reconciliation review actions, remittance signoff actions, month-end close actions, QR/barcode equipment fields, accessory checklist fields, and service-task rows.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
