# System Architecture

Last refreshed: **2026-06-02b**

The app uses a static/PWA frontend, Supabase database, and Supabase Edge Functions. Schema 127 adds Admin-visible guardrails for public route SEO, internal links, CSS token drift, mobile field actions, and release manifests.

Key Edge Functions touched by this pass:

- `admin-directory` loads schema 127 readiness views.
- `jobs-manage` remains the equipment/job write surface.
- `jobs-directory` remains the job/equipment/accounting read surface.
