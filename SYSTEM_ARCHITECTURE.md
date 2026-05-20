# System Architecture

Last refreshed: **2026-05-19b**

## Current architecture direction

The app is moving from one large Admin payload toward smaller app-like panel requests:

- `command_center`
- `health`
- `people`
- `operations`
- `accounting_close`
- `banking`
- `tax_payroll`
- `evidence`

The old `all` scope remains only as an emergency fallback. The old broad `accounting` scope remains temporarily while split accounting scopes are tested live.

## Frontend

- Static app shell with versioned assets.
- Admin UI now stages multiple panel requests and records timing/failure state.
- Mobile menu and Admin section menu are compact/expandable.
- Admin status-changing actions now ask for confirmation first.

## Backend

- Supabase Edge Functions provide Admin directories and write actions.
- SQL schema files remain the canonical history and include low-risk tracking tables/views for readiness and diagnostics.
