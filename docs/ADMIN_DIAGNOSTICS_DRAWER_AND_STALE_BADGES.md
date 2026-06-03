# Admin Diagnostics Drawer and Stale Badges

Last refreshed: **2026-06-02a**

## Purpose

This pass makes staged Admin loading easier to understand without opening the browser console.

## Added behavior

- App Health now includes an expandable diagnostics drawer.
- Scope timing cards still show live/pending/retry state.
- Stale-data age badges show whether each staged panel is fresh, stale, or failed.
- Failed staged panel loads are written through `admin-manage` into `admin_panel_load_diagnostics`.
- `admin-directory` returns persisted diagnostics in Health/all scopes.

## Tables and views

- `admin_panel_load_diagnostics`
- `v_admin_panel_load_diagnostics`
- `app_frontend_quality_gates`
- `admin_panel_refresh_preferences`
- `v_schema_drift_status`

## Next work

- Split Accounting into smaller fast paths.
- Split Evidence Manager into its own fast path.
- Add skeleton loaders so staged loading feels more intentional.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
