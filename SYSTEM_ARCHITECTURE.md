# System Architecture

Last refreshed: **2026-05-19a**

## Current direction

The Admin app is being split into smaller, safer panel scopes:

- `command_center`
- `health`
- `people`
- `operations`
- `accounting`

The legacy `all` scope remains only as an emergency fallback.

## New diagnostics flow

1. `js/admin-ui.js` loads Admin panels through staged scopes.
2. Each scope records timing, result, message, and stale age in browser state.
3. Failed scope loads are sent to `admin-manage` as `admin_panel_load_diagnostic` rows.
4. `admin-directory` returns `v_admin_panel_load_diagnostics` in Health/all scopes.
5. The Health panel shows both browser-session details and persisted database diagnostics.

## Mobile UX rule

Admin diagnostics, badges, tables, and action buttons must stack on small screens without horizontal overflow unless a table is intentionally inside a scroll container.
