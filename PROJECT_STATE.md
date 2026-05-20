# Project State

Last refreshed: **2026-05-19a**

The app is moving from one large Admin load toward smaller production-style panel loads. Current work focuses on reliability, mobile usability, accounting close readiness, and local SEO hygiene.

## Current state

- Admin first load uses staged scopes and keeps `scope: all` only as an emergency fallback.
- Admin panels have visible retry buttons and timing/status cards.
- This pass adds diagnostics drawer, stale-data age badges, and persisted failure tracking.
- Staff and Jobs lists support server-side paging/sorting foundations.
- Mobile main menu and Admin section menu are compact/expandable.
- SQL reference is current through schema 116.

## Deployment focus

- Apply schema 116.
- Redeploy `admin-directory` and `admin-manage`.
- Clear browser/service worker cache.
- Test the Admin Health drawer and mobile badge layout.
