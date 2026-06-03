# Changelog

## 2026-06-02a

- Added schema **126**: `126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql`.
- Added DB-visible roadmap rows for the completed 20 steps and the next 20 steps.
- Added depth review rows for accounting costs, payment application, reconciliation, remittance, month-end close, equipment accountability, SEO, CSS, mobile, and fallback gaps.
- Added data-migration candidate rows for JSON/DB duplication and source-of-truth decisions.
- Added schema/documentation sync rows to keep SQL, Markdown, smoke checks, cache markers, and service-worker state aligned.
- Updated `admin-directory` so `command_center` and `health` scopes load schema 125/126 guardrail views.
- Updated `admin-ui` to render build guardrails, public SEO guardrails, runtime fallback checks, roadmap rows, depth reviews, data migration candidates, and schema/doc sync checks.
- Updated `scripts/repo-smoke-check.mjs` for schema 126, cache marker **2026-06-02a**, CSS brace balance, Admin readiness visibility, archive snapshots, and no root test files.
- Updated `index.html` and `server-worker.js` cache markers to **2026-06-02a**.
- Retired temporary `test_write` files into archive.
- Updated active Markdown files and added schema 126 documentation.

## 2026-06-02a

- Repaired `jobs-manage` Edge Function bundle failure from an unterminated regexp literal.
- Added Edge Function TypeScript parse checks to smoke testing.
- Fixed duplicate job comment attachment rows in `jobs-directory`.
- Added schema 125 deployment bundle, public SEO, and runtime fallback guardrails.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
