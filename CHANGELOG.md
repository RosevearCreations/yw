# Changelog

## 2026-05-18a

- Changed Admin initial load to staged panel scopes: `health`, `people`, `operations`, and `accounting`.
- Kept heavy `scope: all` Admin load only as an emergency fallback with a 90-second timeout.
- Added partial panel warning text when one staged scope needs retry.
- Added schema 114 staged Admin load guardrails.
- Updated full schema reference and smoke checks.
- Fixed escaped newline strings in `report-subscription-delivery-run` so that Edge Function can bundle cleanly.
- Updated cache/script version to `2026-05-18a`.
- Archived active Markdown snapshot and retired old root Markdown again.
- Removed recurring temp test files again.
