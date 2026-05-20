# Project State

Last refreshed: **2026-05-19b**

The app is moving from one large Admin load toward smaller production-style panel loads. Current work focuses on reliability, mobile usability, accounting close readiness, evidence review, and local SEO hygiene.

## Current state

- Admin first load uses staged scopes and keeps `scope: all` only as an emergency fallback.
- Accounting is now split into `accounting_close`, `banking`, and `tax_payroll` fast paths.
- Evidence Manager now has its own `evidence` fast path, retry button, and stale-data age badge.
- Admin panels have visible retry buttons, timing/status cards, diagnostics, and stale-data badges.
- Status-changing Admin actions now ask for confirmation before changing live data.
- Staff and Jobs lists support server-side paging/sorting foundations.
- Mobile main menu and Admin section menu are compact/expandable.
- SQL reference is current through schema **117**.

## Deployment focus

- Apply schema 117.
- Redeploy `admin-directory` and `admin-manage`.
- Clear browser/service worker cache.
- Test split Admin scopes, Evidence retry, confirmation prompts, and mobile table/card layout.
