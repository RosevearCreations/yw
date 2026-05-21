# Testing Checklist

Last refreshed: **2026-05-20a**

## Automated checks run during build

- JavaScript syntax checks for key frontend modules.
- Repo smoke check.
- Public H1 count check.
- CSS brace balance check.

## Manual checks after deploy

1. Open the public home page and verify only one visible main heading is used.
2. Test mobile width and confirm the main menu is compact until expanded.
3. Open `#admin` and confirm staged scope cards show live/failed/pending state.
4. Confirm the Production Readiness panel includes:
   - readiness checks
   - permissions matrix
   - deployment gates
   - deployment checklist rows
   - function readiness rows
   - SEO smoke rows
5. Click Refresh Staff Only and Refresh Jobs Only.
6. Click Retry Evidence.
7. Test one safe Jobs note action.
8. Confirm no old `test_write` files or retired root Markdown are present in the active root.
