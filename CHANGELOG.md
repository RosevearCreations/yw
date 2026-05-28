# Changelog

Last refreshed: **2026-05-26a**

## 2026-05-26a

- Added schema 120: `sql/120_ontario_ohsa_mobile_first_app_guardrails.sql`.
- Added mobile-first quality gates and Ontario jurisdiction wording gates.
- Updated `v_schema_drift_status` expected version to 120.
- Updated `admin-directory` to return mobile-first and wording gate rows.
- Added mobile bottom quick-action navigation.
- Updated `js/mobile-menu.js` to sync mobile quick-action active state.
- Updated visible app copy from U.S. safety wording to Ontario OHSA / Ontario workplace safety wording.
- Updated app title, meta description, manifest, H1, Admin hub copy, HSE Ops copy, and Reports subtitle.
- Added `docs/ONTARIO_OHSA_AND_MOBILE_FIRST_APP_PASS.md`.
- Updated active Markdown, archived the previous Markdown snapshot, and removed retired/temp root files again.
- Bumped cache version to `2026-05-26a`.

## Recent prior passes

- `2026-05-20b`: Admin action permissions, schema preflight, and retry/backoff policy.
- `2026-05-20a`: Admin preflight registry and deployment/function readiness UI.
- `2026-05-19b`: split Admin accounting/evidence scopes and confirmation guardrails.
- `2026-05-19a`: Admin diagnostics drawer and stale-data badges.
- `2026-05-18b`: Admin panel retry timing and command-center scope.
