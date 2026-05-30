# System Architecture

Last refreshed: **2026-05-29a**

## Current architecture

- Static frontend: `index.html`, `style.css`, `app.js`, and modular files in `js/`.
- Service worker: `server-worker.js` with cache marker **2026-05-29a**.
- Supabase database: schema migrations through **123**.
- Supabase Edge Functions: Admin, Jobs, upload, scheduler, reporting, and analytics functions.

## Equipment workflow architecture

- `js/jobs-ui.js` captures equipment master data, checkout, arrival verification, return receipt, final return verification, exceptions, and transfer history.
- `supabase/functions/jobs-manage/index.ts` writes equipment state changes and transfer/return notifications.
- `supabase/functions/jobs-directory/index.ts` reads directory rows, transfer verification events, return exceptions, and operational-depth gates.
- Schema 123 adds the columns/views needed to separate simple return receipt from final return verification.

## Reliability pattern

The app keeps staged/safe loading, smoke checks, service-worker cache markers, visible exception tables, and depth gates so incomplete features do not silently disappear.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
