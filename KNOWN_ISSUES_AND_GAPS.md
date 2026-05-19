# Known Issues and Gaps

Last refreshed: **2026-05-18b**

## Immediate issues

1. Live Admin must be tested after redeploying `admin-directory`; old cached scripts can still hide the new retry buttons.
2. The Admin `all` scope still exists as an emergency fallback and should eventually be retired after all panels have dedicated scopes.
3. `admin_panel_load_diagnostics` is created for future persisted diagnostics, but frontend writes are not wired yet.
4. Job actions still need live permission/RLS testing against production data.
5. Accounting close screens still need real-data validation for bank, tax, payroll, and accountant export flows.

## UX gaps

- Continue testing Admin on narrow phone widths.
- Add stale-data age badges to every panel header.
- Add skeleton loaders so staged panel loading feels intentional.
- Keep replacing long tables with paged/filterable panel views.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.

## Fixed during this pass

- Added retry buttons and timing cards so partial Admin load failures are visible and recoverable.
- Added a smaller `command_center` Edge Function fast path.
- Kept the report subscription delivery function deploy-safe with escaped newline strings.
