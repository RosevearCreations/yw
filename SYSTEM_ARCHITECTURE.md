# System Architecture

Last refreshed: **2026-06-03a**

The app uses a static/PWA frontend, Supabase database, and Supabase Edge Functions. Schema 127 adds Admin-visible guardrails for public route SEO, internal links, CSS token drift, mobile field actions, and release manifests.

Key Edge Functions touched by this pass:

- `admin-directory` loads schema 127 readiness views.
- `jobs-manage` remains the equipment/job write surface.
- `jobs-directory` remains the job/equipment/accounting read surface.

## 2026-06-03a / Schema 128 update

- Added schema 128 execution queues for payment application, accounting close controls, equipment accountability, public SEO publication, and fallback observability.
- Updated Admin readiness to show the new queues.
- Updated cache marker to 2026-06-03a and refreshed active Markdown.
- Archived prior Markdown and retired uploaded test_write files.

## Architecture update - schema 129

Schema 129 adds a DB-visible recovery and readiness layer above deployment/schema compatibility, accounting evidence packaging, equipment return-to-service enforcement targets, public asset smoke checks, and operator playbooks.
