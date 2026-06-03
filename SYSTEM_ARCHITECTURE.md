# System Architecture

Last refreshed: **2026-06-02a**

## Current architecture summary

- Frontend: static app shell with PWA service worker and **2026-06-02a** cache marker.
- Backend: Supabase Edge Functions for Admin, Jobs, uploads, reporting, scheduler, and notifications.
- Database: Supabase/Postgres migrations through schema **126**.
- Fallback model: optional views fail soft where possible; service worker caches app-shell assets one by one; offline drafts remain local-first.
- Admin readiness: DB-backed views now expose schema drift, deployment checks, SEO checks, runtime fallback checks, roadmap steps, depth review, data migration candidates, and schema/doc sync checks.

## Source-of-truth direction

- DB is preferred for reviewable operational state, accounting, equipment accountability, deployment readiness, SEO publishing checks, and migration decisions.
- JSON/static fallback remains appropriate for public app-shell assets, generated public pages, and offline-first mobile workflows.
- Local storage remains appropriate for unsynced drafts/outbox items, with conflict summaries surfaced in Admin after sync attempts.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
