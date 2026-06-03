# Project State

Last refreshed: **2026-06-02a**

- Build label: **2026-06-02a**
- Current schema: **126**
- App focus: YWI/HSE field operations, Admin readiness, accounting close, equipment accountability, mobile workflows, SEO/local guardrails, and robust fallback handling.
- Latest major change: schema 126 adds roadmap/depth/data-migration/schema-doc sync guardrails and makes them visible in Admin.

## Important current notes

- The schema 126 `jobs-manage` regex repair remains required for Supabase Edge Function deployment.
- The schema 126 pass repairs repo hygiene failures from missing archive snapshots and root `test_write` files.
- Admin readiness now has visible rows for deployment bundle checks, SEO/local checks, runtime fallbacks, roadmap steps, depth review, data migration, and schema/doc sync.

## Next live verification

1. Apply schema 126.
2. Redeploy `admin-directory`.
3. Confirm the Admin readiness tables load.
4. Redeploy `jobs-manage` and `jobs-directory` if not already live.
5. Clear old service worker cache and reload the app.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
