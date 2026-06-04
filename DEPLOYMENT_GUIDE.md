# Deployment Guide

Last refreshed: **2026-06-03a**

## Deploy order

1. Apply SQL migrations through **127**.
2. Deploy `admin-directory`.
3. Deploy `jobs-manage` and `jobs-directory` if the live functions are behind this zip.
4. Run `node scripts/repo-smoke-check.mjs` when local/online tooling is available.
5. Hard-refresh the app or clear the old service worker so **2026-06-03a** assets load.

## Important checks

- Confirm `v_schema_drift_status` expects **127**.
- Confirm Admin Production Readiness shows route SEO, internal-link, CSS token, mobile action, and release manifest tables.
- Confirm the Equipment page shows the manual **Scan / Enter Code** fallback button.

## 2026-06-03a / Schema 128 update

- Added schema 128 execution queues for payment application, accounting close controls, equipment accountability, public SEO publication, and fallback observability.
- Updated Admin readiness to show the new queues.
- Updated cache marker to 2026-06-03a and refreshed active Markdown.
- Archived prior Markdown and retired uploaded test_write files.
