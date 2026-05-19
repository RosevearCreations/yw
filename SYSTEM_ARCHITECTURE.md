# System Architecture

Last refreshed: **2026-05-18b**

## Frontend

The static frontend loads versioned JS/CSS assets and uses a service worker cache. The Admin screen is still in `js/admin-ui.js`, but it now loads panels in staged scopes and shows per-panel timing status.

## Edge Functions

- `admin-directory` provides scoped read payloads for Admin panels.
- `admin-manage` handles write actions for Admin workflows.
- `report-subscription-delivery-run` handles scheduled report delivery and must deploy with escaped newline strings.

## Database

Schema migrations through **115** add operational tracking for Admin panel retry/timing and future persisted diagnostics.

## Current Admin load pattern

1. `command_center`
2. `health`
3. `people`
4. `operations`
5. `accounting`
6. `all` only if every staged request fails
