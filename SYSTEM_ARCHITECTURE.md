# System Architecture

Last refreshed: **2026-06-04b**

## Current shape

- Static app shell: `index.html`, `style.css`, `app.js`, and `js/*`.
- Service worker: `server-worker.js` with cache marker **2026-06-04b**.
- Supabase Edge Functions: Admin/Jobs/Upload/Reporting functions under `supabase/functions`.
- Database migrations: `sql/001...` through `sql/130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks.sql`.
- Canonical schema reference: `sql/000_full_schema_reference.sql`.

## Schema 130 additions

- Payment execution queue.
- Bank reconciliation execution queue.
- Equipment scan/template registry.
- Local SEO execution queue.
- Fallback drill queue.

## Guardrails

- One H1 per exposed public page.
- CSS brace balance check.
- Edge Function TypeScript parse checks.
- Cache marker alignment.
- Repaired schema 128 roadmap columns must remain `source_doc`, `route_hint`, and `implementation_notes`.
