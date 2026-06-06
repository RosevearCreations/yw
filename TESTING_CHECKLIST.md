# Testing Checklist

Build: **2026-06-05c**  
Schema: **133**

## Required checks

- Run `node scripts/repo-smoke-check.mjs`.
- Confirm one public H1 in `index.html`.
- Confirm CSS brace balance in `style.css`.
- Confirm Edge Function TypeScript parse checks pass.
- Confirm schema 133 migration and full schema reference are present.
- Confirm Admin directory loads schema 133 views with safe fallbacks.
- Confirm Admin UI contains schema 133 readiness tables.
- Confirm sitemap.xml and robots.txt are present.
