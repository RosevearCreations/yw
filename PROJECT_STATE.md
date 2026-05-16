# Project State

Last refreshed: **2026-05-15b**

## Current build state

- Frontend build/cache version: `2026-05-15b`.
- Latest schema marker: **108**.
- Active Admin focus: Command Center, Health Center, Guided Close Center, Evidence Manager, saved views, deployment gates, and readiness/SEO checks.
- Root legacy Markdown was moved back into `archive/markdown-retired-2026-05-15b/root/`.
- Active temp `test_write` files were removed.

## Newly added this pass

- Writable saved admin filters.
- Saved-filter scope summary view.
- Close wizard step table and view.
- Health resolution notes table and queue view.
- Deployment gate check table and view.
- Public SEO smoke-check table and view.
- Admin UI for saved views, close steps, health resolve buttons, evidence follow-up buttons, deployment gates, and SEO smoke rows.

## Important live deployment order

1. Apply SQL through schema 108.
2. Redeploy `admin-directory`.
3. Redeploy `admin-manage`.
4. Clear/hard refresh old service worker cache.
5. Open Admin Health and confirm schema drift is current.
