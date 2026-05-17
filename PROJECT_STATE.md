# Project State

Last refreshed: **2026-05-16b**

## Current state

The app is moving from prototype/admin shell toward a more real operations backend. The newest pass focuses on reducing Admin payload weight and making Staff Directory usable on phones and desktops.

## Working areas

- Authenticated app shell and service worker.
- Compact mobile main navigation and compact mobile Admin section navigation.
- Admin Command Center, Health/Schema Center, Task Inbox, Guided Close Center, Evidence Manager, and Readiness panels.
- Accounting close foundation through payment application, reconciliation, filing/remittance, export packaging, and close wizard tracking.
- Staff/user management with stronger mobile layout and new paged Staff Directory controls.
- Admin saved views with section and Staff Directory filter replay.
- Schema tracking through **111**.

## Still needs live deployment/testing

- Apply SQL through schema 111.
- Redeploy changed Edge Function `admin-directory`.
- Clear old service worker cache.
- Test Staff Directory paging with real production data.
- Confirm saved views replay Staff Directory filters after real DB reload.

## Current release label

`2026-05-16b-admin-directory-pagination-saved-view-replay`
