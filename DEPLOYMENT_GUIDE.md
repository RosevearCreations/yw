# Deployment Guide

Last refreshed: **2026-05-20a**

## Standard order for this build

1. Apply migrations through schema **118**.
2. Redeploy `admin-directory`.
3. Redeploy `admin-manage` if the currently deployed function predates the schema 117/118 Admin action work.
4. Redeploy `report-subscription-delivery-run` if the live deploy still fails with newline/regex parse errors.
5. Deploy the static site.
6. Clear or unregister the service worker cache.
7. Open `#admin` and verify the Readiness panel.

## Expected checks after deploy

- Command Center loads live.
- Health loads live.
- Readiness shows deployment checklist rows.
- Readiness shows function readiness rows.
- Staff and Jobs panel-only refresh buttons work.
- Evidence retry works.
- Public app shell has one H1.
- Mobile menu remains compact and expandable.

## Cache note

This build uses `2026-05-20a`. If the old Admin UI appears, clear the browser service worker cache before retesting.
