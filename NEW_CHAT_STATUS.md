# New Chat Status

Last refreshed: **2026-05-19a**

## Current build

- Latest source ZIP used: `yw-main(126).zip`.
- Current output label: `2026-05-19a`.
- Latest schema marker: **116**.
- Main theme: Admin staged loading is now visible, retryable, and diagnosable with mobile-safe stale-data badges and persisted failure rows.

## Release health summary

| Area | Status | Notes |
| --- | --- | --- |
| JavaScript syntax | Passed | `node --check` completed for core browser files. |
| Edge TypeScript parse | Passed with expected Deno/module warnings | `tsc --noEmit --noResolve` reached type/environment warnings only. |
| Smoke check | Passed | `scripts/repo-smoke-check.mjs` passed after schema/docs updates. |
| H1 check | Passed | `index.html` still has one H1. |
| CSS drift | Passed | CSS opening/closing braces are balanced. |
| Admin diagnostics | Added | Drawer, badges, and persisted failure write path added. |

## Deploy notes for next chat

1. Apply SQL through `sql/116_admin_diagnostics_drawer_and_stale_data_badges.sql`.
2. Redeploy Supabase functions:
   - `admin-directory`
   - `admin-manage`
   - `report-subscription-delivery-run` if not already redeployed from the previous fix.
3. Hard refresh or unregister the service worker so `2026-05-19a` assets load.
4. Test Admin on mobile width and verify the diagnostics drawer, badges, and retry buttons display cleanly.
