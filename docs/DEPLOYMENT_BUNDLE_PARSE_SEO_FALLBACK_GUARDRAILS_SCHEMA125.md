# Schema 125: Deployment Bundle Parse, SEO, and Fallback Guardrails

Last refreshed: **2026-06-02b**

## Why this pass exists

The latest deployment attempt showed that `jobs-manage` could fail Supabase bundling before it ever reached runtime. The immediate error was an unterminated regexp literal in `normalizeJsonArray`, caused by a literal newline inside `value.split(/[ ... ])`.

Schema 125 makes that class of problem visible and repeatable through smoke checks and database-visible guardrails.

## Code repairs completed

- Repaired `supabase/functions/jobs-manage/index.ts` so `normalizeJsonArray` uses `split(/[\n,]/)`.
- Added TypeScript parser diagnostics to `scripts/repo-smoke-check.mjs` for every `supabase/functions/*/index.ts` file.
- Added a smoke check that specifically blocks literal-newline regexp split patterns in `jobs-manage`.
- Fixed `jobs-directory` so job comment attachments are not pushed twice into the same attachment list.
- Updated the service worker to cache shell assets one by one with `Promise.allSettled`, so one stale or missing asset does not block the repaired worker from installing.
- Updated the cache marker to **2026-06-02a**.

## Schema 125 tables/views

New tables:

- `app_deployment_bundle_checks`
- `app_public_seo_checks`
- `app_runtime_fallback_checks`

New views:

- `v_app_deployment_bundle_checks`
- `v_app_public_seo_checks`
- `v_app_runtime_fallback_checks`

Updated:

- `v_schema_drift_status` now expects schema **125**.
- `app_operational_depth_gates` includes deployment bundle, regex repair, SEO/local wording, and runtime fallback guardrails.

## Deployment checklist

1. Apply schema **125** after schema 124.
2. Deploy `jobs-manage` first because it was the function with the parse failure.
3. Deploy `jobs-directory` next because it includes the attachment dedupe fix.
4. Deploy any other Edge Functions normally.
5. Hard-refresh the browser or clear the old service worker so **2026-06-02a** assets load.
6. Run the Admin/Jobs screens and confirm equipment/accounting tables still load.

## Next depth targets

- Add a visible Admin deployment-readiness table from the new schema 125 guardrail views.
- Add function-level deploy status fields once live deploy logs can be stored.
- Add public SEO smoke checks for sitemap, robots, title, meta description, one-H1, local wording, and image alt text.
- Add a browser-side fallback banner when the app is running cached JS against a newer database schema.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->
