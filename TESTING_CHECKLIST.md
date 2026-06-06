# Testing Checklist

Build: **2026-06-05a**  
Schema: **131**

- Apply schema 131.
- Redeploy `admin-directory`.
- Redeploy `jobs-manage` and `jobs-directory` if live versions are behind.
- Hard-refresh or clear the service worker so `2026-06-05a` assets load.
- Confirm one H1 on public shell.
- Confirm CSS brace balance remains zero.
- Run `node scripts/repo-smoke-check.mjs`.
- Confirm Admin readiness can load schema 131 tables.
- Confirm missing optional views show empty-state fallback instead of breaking the page.

## Schema 132 Testing Checklist

- Apply schema 132 successfully.
- Confirm Admin Production Readiness displays five new schema 132 queues.
- Confirm `sitemap.xml` and `robots.txt` are reachable after deploy.
- Run `node scripts/repo-smoke-check.mjs`.
- Confirm one public H1 and CSS brace balance.
- Hard-refresh after service worker cache marker changes to `2026-06-05b`.
