# Known Issues and Gaps

Last refreshed: **2026-05-20a**

## Immediate issues

1. Live Admin must be tested after applying schema 118 and redeploying `admin-directory`; old cached scripts can hide the new checklist/function readiness tables.
2. The broad Admin `all` and `accounting` fallback scopes still exist and should be retired only after split scopes pass production testing.
3. Role-aware disabled states are not complete yet; confirmation prompts exist, but buttons can still appear enabled until clicked.
4. Per-panel retry/backoff rules still need to be added so failed panels do not repeatedly retry too aggressively.
5. Function readiness rows are tracking rows, not automatic live deploy verification yet.

## UX gaps

- Continue testing Admin on narrow phone widths after every new table/card is added.
- Add stronger skeleton placeholders for individual tables and cards.
- Add visible retry/backoff state for panels that fail repeatedly.
- Add offline queue badges beside action buttons.
- Keep replacing long tables with paged/filterable panel views.

## SEO/local gaps

- Keep one H1 per public page.
- Continue page title, meta description, local wording, alt text, and mobile layout checks each pass.
- Add local service/location content only when it matches real service coverage.
- Add structured metadata, sitemap, robots, and public route freshness checks to the smoke script.
- Add missing-image and missing-alt export rows for cleanup.

## Fixed during this pass

- Added DB-backed Admin fast-path registry use during startup.
- Added deployment checklist table rendering.
- Added function readiness table rendering.
- Added schema 118 and updated schema drift tracking to expected version 118.
- Removed retired root Markdown and temporary `test_write` files again.
