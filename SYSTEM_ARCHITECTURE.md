# System Architecture

Last refreshed: **2026-05-17b**

## Frontend

Static app shell with route-based sections, service worker cache, Admin UI modules, Jobs/HSE/Reports modules, and local fallback/outbox helpers.

## Backend

Supabase database plus Edge Functions. Key functions updated in this pass:

- `admin-directory`: narrow fast paths for panel refreshes.
- `admin-manage`: job status/note actions from Admin Jobs review table.

## Admin loading strategy

The app should avoid one huge Admin reload when only one panel needs fresh data. Current fast paths:

- `people`
- `operations`
- `health`
- `accounting`
- `reporting`
