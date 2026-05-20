# Known Issues and Gaps

Last refreshed: **2026-05-19a**

## Immediate issues

1. Live Admin must be tested after redeploying `admin-directory` and `admin-manage`; old cached scripts can hide the new diagnostics drawer and badges.
2. The Admin `all` scope still exists as an emergency fallback and should eventually be retired after all panels have dedicated scopes.
3. Persisted panel diagnostics are now wired, but they need live production testing to confirm failures insert into `admin_panel_load_diagnostics`.
4. Job actions still need live permission/RLS testing against production data.
5. Accounting close screens still need real-data validation for bank, tax, payroll, and accountant export flows.

## UX gaps

- Add skeleton loaders so staged panel loading feels intentional.
- Continue testing Admin on narrow phone widths.
- Keep replacing long tables with paged/filterable panel views.
- Add confirmation dialogs before destructive or status-changing actions.
- Add offline queue badges beside action buttons.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.

## Fixed during this pass

- Added Admin diagnostics drawer and local/persisted panel load details.
- Added stale-data age badges for staged panel loads.
- Wired failed staged panel load persistence through `admin-manage`.
- Added schema 116 and updated schema drift tracking to expected version 116.
