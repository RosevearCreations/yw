# System Architecture

Last refreshed: **2026-05-10**

## Current architecture

YWI HSE is a static frontend app backed by Supabase services.

```text
Browser / PWA shell
  index.html
  style.css
  app.js
  js/*.js modules
  service worker cache

Supabase
  Postgres schema
  Edge Functions
  Storage/evidence uploads
  Auth/session handling

Compatibility API routes
  api/auth/*.js
  api/logbook/*.js
```

## Main modules

| Module | Responsibility |
| --- | --- |
| `js/api.js` | Shared API calls, timeout handling, compatibility fallback routing |
| `js/admin-ui.js` | Admin manager shell and workflow controls |
| `js/reports-ui.js` | Lazy-loaded reporting screens |
| `js/jobs-ui.js` | Jobs/commercial screens |
| `js/hse-ops-ui.js` | HSE operations dashboard |
| `js/forms-*.js` | Field form capture |
| `js/outbox.js` | Offline/save-later behavior |
| `server-worker.js` | App shell caching and offline fallback |

## Current reliability pattern

- Direct Supabase function calls are preferred.
- Host compatibility routes return JSON instead of HTML when direct calls fail or stall.
- Reports are lazy-loaded to avoid Admin route timeouts.
- Service worker avoids caching API/auth callback traffic.
- Error handling should now move into a central Error/Health Center.

## Architecture direction

The next version should introduce workflow-specific dashboards over the raw manager screens:

- Admin Home Command Center
- Accounting Close Center
- Jobs Center
- HSE Review Center
- Media/Evidence Manager
- Error/Health Center

These screens should use narrow API scopes, pagination, cached rollups, and clear fallback messages.
