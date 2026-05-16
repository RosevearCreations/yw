# System Architecture

Last refreshed: **2026-05-16a**

## Current architecture focus

The app is a browser-based operations/HSE/admin system backed by Supabase tables, views, and Edge Functions. This pass adds a small frontend UX controller for mobile navigation and DB-backed frontend quality gates.

## Main app layers

1. **Static frontend:** `index.html`, `style.css`, `app.js`, and files in `js/`.
2. **Mobile navigation controller:** `js/mobile-menu.js`, responsible for compact expandable phone navigation.
3. **Service worker:** `server-worker.js`, currently versioned to `2026-05-16a`.
4. **Supabase Edge Functions:** admin and operations APIs in `supabase/functions/`.
5. **Database:** SQL migrations in `sql/`, latest schema **110**.
6. **Markdown handoff:** root Markdown files are active current docs; older docs are archived.

## Schema 110 architecture addition

Schema 110 adds frontend quality gate tracking for mobile navigation, one-H1 status, cache version, and active Markdown readiness.
