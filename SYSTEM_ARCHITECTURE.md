# System Architecture

Last refreshed: **2026-06-01a**

The app uses a static frontend, Supabase Postgres, and Supabase Edge Functions. Schema 125 adds deployment-quality guardrails on top of the schema 124 accounting/equipment foundation.

## Current architecture notes

- Frontend: static app shell with service worker fallback and **2026-06-01a** cache marker.
- Database: schema 125 adds deployment bundle, public SEO/local wording, and runtime fallback checks.
- Edge Functions: `jobs-manage` and `jobs-directory` are the main changed functions in this pass.
- Smoke checks: `scripts/repo-smoke-check.mjs` now parses all Edge Function TypeScript files before packaging.
- Mobile/PWA: service worker caches shell assets individually so one stale static asset does not block installation.

## Important schema layers

- Schema 123: equipment transfer, arrival verification, return verification, and operational depth gates.
- Schema 124: accounting cost depth, payment application, reconciliation, remittance, month-end close, and equipment accountability.
- Schema 125: deployment bundle parse checks, SEO/local wording checks, runtime fallback checks, and repaired deploy safety.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
