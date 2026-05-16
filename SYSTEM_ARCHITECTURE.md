# System Architecture

Last refreshed: **2026-05-15c**

## Current architecture focus

The app is a browser-based operations/HSE/admin system backed by Supabase tables, views, and Edge Functions.

## Main app layers

1. **Static frontend:** `index.html`, `style.css`, `app.js`, and files in `js/`.
2. **Service worker:** `server-worker.js`, currently versioned to `2026-05-15c`.
3. **Supabase Edge Functions:** admin and operations APIs in `supabase/functions/`.
4. **Database:** SQL migrations in `sql/`, latest schema **109**.
5. **Markdown handoff:** root Markdown files are active current docs; older docs are archived.

## Schema 109 architecture addition

Schema 109 adds production-style operational control tables for pagination, audit logging, guided close actions, bank CSV staging, backup rehearsal tracking, evidence action queues, and mobile action cards.
