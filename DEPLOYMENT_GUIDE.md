# Deployment Guide

Last refreshed: **2026-05-29a**

## Deploy order for this build

1. Apply SQL migrations through `sql/123_equipment_transfer_arrival_return_accounting_seo_guardrails.sql`.
2. Deploy `supabase/functions/jobs-directory`.
3. Deploy `supabase/functions/jobs-manage`.
4. Deploy upload functions if their live versions are older than this repo.
5. Upload/deploy the static files with cache marker **2026-05-29a**.
6. Clear/unregister the old service worker on test devices, then reload.
7. Run the repo smoke check and live test equipment Save → Check Out → Verify Arrival → Return → Mark Return Verified.

## Rollback note

If schema 123 is not applied, the new Equipment UI will still load, but arrival/return verification writes will fail because the expected columns/views will be missing. Apply the schema before relying on the new equipment workflow.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
