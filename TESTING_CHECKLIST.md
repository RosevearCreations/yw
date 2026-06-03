# Testing Checklist

Last refreshed: **2026-06-02a**

## Required smoke checks

- `node scripts/repo-smoke-check.mjs`
- Confirm index has no more than one H1.
- Confirm `style.css` brace balance is clean.
- Confirm all Supabase Edge Function `index.ts` files parse.
- Confirm `index.html` and `server-worker.js` use **2026-06-02a**.
- Confirm schema reference includes `126_roadmap_depth_data_migration_seo_css_fallback_guardrails`.
- Confirm no root `test_write` files remain.
- Confirm archive snapshots contain README files.

## Manual live checks after deploy

1. Admin loads without console-breaking errors.
2. Production Readiness shows schema 126 build/SEO/fallback rows.
3. Production Readiness shows schema 126 roadmap, depth, data migration, and schema/doc sync rows.
4. Schema drift reports current after schema 126 is applied.
5. `jobs-manage` deploys without regexp parse errors.
6. `jobs-directory` deploys and job comment attachments do not duplicate.
7. Old service worker cache is cleared and **2026-06-02a** assets load.
8. Main public shell still has one H1.
9. Mobile Today, Admin, Jobs, and Equipment screens remain usable on phone width.
10. Optional missing views fail soft with visible empty/gap messages rather than a full 500.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
