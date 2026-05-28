# Project State

Last refreshed: **2026-05-27a**

The project is now focused on making the app behave like a practical mobile-first field tool while keeping the Admin backend staged, safer, and easier to debug.

## Current build marker

- Current schema marker: **121**
- Current cache marker: **2026-05-27a**
- Latest focus: **mobile Today dashboard, PWA install helper, and offline queue badges**

## Current app direction

- Use Ontario **OHSA** / Ontario workplace safety wording for visible Ontario procedures.
- Keep the app phone-first because most field usage is expected on mobile.
- Keep Admin loading split into staged scopes instead of one heavy all-scope request.
- Keep root Markdown clean and archive older handoff files.
- Keep one exposed H1 in the app shell.

## Current deployment expectation

1. Apply SQL through schema 121.
2. Redeploy `admin-directory`.
3. Hard refresh or clear/unregister the service worker so `2026-05-27a` assets load.
4. Test `/#today`, quick-action badges, install helper, Admin, Jobs, and Safety Ops on a phone-width viewport.
