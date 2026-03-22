# Project State

## Current state

The app is in an active security and modularization pass.

## Recently completed

- extracted admin CRUD into `js/admin-actions.js`
- extracted outbox logic into `js/outbox.js`
- improved route/view guards with `js/security.js` + `js/router.js`
- improved account messaging for first-time password creation
- expanded profile editing direction for construction-company employee records
- synced markdown and added new SQL planning docs

## Next likely steps

- backend function updates for expanded profile fields
- stricter RLS policies tied to role/site helpers
- dedicated employee/self-service profile view
- supervisor drill-down views filtered to their crews/sites
