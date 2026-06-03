# Deployment Guide

Last refreshed: **2026-06-02a**

## Current build

- Build: **2026-06-02a**
- Schema: **126**

## Deploy order

1. Apply SQL migrations through `sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql`.
2. Confirm `v_schema_drift_status` expects and reports schema **126**.
3. Redeploy `admin-directory` so the new Admin readiness views load.
4. Redeploy `jobs-manage` and `jobs-directory` if the live functions are not already on the repaired schema 126/126 code.
5. Redeploy any other changed Edge Functions if your deployment workflow packages all functions together.
6. Hard-refresh or clear the browser service worker so **2026-06-02a** assets load.
7. Open Admin → Production Readiness and confirm build guardrails, SEO guardrails, fallback checks, roadmap rows, depth rows, migration rows, and schema/doc sync rows load.

## Local/smoke checks before packaging

- `node --check js/admin-ui.js`
- `node --check js/jobs-ui.js`
- `node --check app.js`
- `node --check server-worker.js`
- `node scripts/repo-smoke-check.mjs`

## If you cannot run Node locally

Use the Admin readiness tables after deploy as the live checklist, and deploy one changed function at a time so failures are easier to isolate.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
