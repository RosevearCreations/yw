# Project State

Last refreshed: **2026-05-18b**

## Current build

The app is now aligned through schema **115**. The most important operational improvement is the Admin loader: it no longer depends on one heavy first request. Admin starts with smaller staged panel calls and now shows panel timing cards so operators can see what loaded live versus what needs retry.

## Stable areas

- Public app shell keeps one visible `<h1>`.
- Mobile main menu remains compact and expandable.
- Admin Staff and Jobs lists support paging, filtering, sorting, and panel-only refresh.
- Admin has command-center, health/schema, close center, evidence, readiness, and jobs review panels.
- Report delivery function has the newline escaping fix needed for bundle deployment.

## Current deployment target

- Static assets/cache version: **2026-05-18b**.
- Latest schema file: `sql/115_admin_panel_retry_timing_and_command_scope.sql`.
- Edge Functions to redeploy: `admin-directory`, `admin-manage`, `report-subscription-delivery-run`.
