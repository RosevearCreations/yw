# Deployment Guide

Last refreshed: **2026-06-04b**

## Deploy order

1. Confirm the repaired schema **128** has applied successfully.
2. Apply schema **129** if not already applied.
3. Apply schema **130**.
4. Redeploy `admin-directory`.
5. Deploy `jobs-manage` and `jobs-directory` if the live functions are behind this zip.
6. Run `node scripts/repo-smoke-check.mjs` when local/online tooling is available.
7. Hard-refresh the app or clear the old service worker so **2026-06-04b** assets load.

## Important checks

- Confirm `v_schema_drift_status` expects **130**.
- Confirm Admin Production Readiness shows schema 130 execution queues.
- Confirm CSS/H1 checks pass before public deployment.
