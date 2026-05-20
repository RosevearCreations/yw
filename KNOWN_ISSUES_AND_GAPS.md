# Known Issues and Gaps

Last refreshed: **2026-05-19b**

## Immediate issues

1. Live Admin must be tested after redeploying `admin-directory` and `admin-manage`; old cached scripts can hide the new split scopes and Evidence retry button.
2. The broad Admin `all` and `accounting` fallback scopes still exist and should be retired only after the split scopes pass production testing.
3. The new schema 117 registry/checklist rows are DB-ready, but the Production Readiness panel still needs a dedicated renderer for `v_admin_deployment_checklist`.
4. Confirmation prompts are now present, but role-aware disabled button states still need to be added.
5. Accounting close, bank, tax, payroll, and evidence screens still need live data validation after schema/function deployment.

## UX gaps

- Continue testing Admin on narrow phone widths after the split scopes are live.
- Add stronger skeleton placeholders for individual tables and cards.
- Add visible retry/backoff state for panels that fail repeatedly.
- Add offline queue badges beside action buttons.
- Keep replacing long tables with paged/filterable panel views.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.

## Fixed during this pass

- Split Admin accounting and evidence into smaller fast paths.
- Added Evidence retry and stale-data badge controls.
- Added confirmation guardrails for status-changing Admin actions.
- Added lightweight Admin loading skeletons.
- Added schema 117 and updated schema drift tracking to expected version 117.
