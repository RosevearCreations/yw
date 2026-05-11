# YWI HSE Operations App

Last refreshed: **2026-05-10**  
Current schema marker: **105_repo_cleanup_and_roadmap_refresh**

YWI HSE is a mobile-first operations, safety, jobs, reporting, and backend accounting app for field work. The app currently runs as a static frontend with Supabase Edge Functions, Supabase Postgres, and offline-friendly browser modules.

## Current working direction

The app is moving from a prototype-style admin shell into a real operations backend:

- HSE forms, inspections, first aid, PPE, incidents, drills, logbook, and evidence review.
- Jobs, service sessions, schedules, work orders, estimates, route execution, and commercial workflow records.
- Admin directory, staff/profile controls, role-aware manager screens, and compatibility fallbacks for stalled functions.
- Backend accounting foundation for AR/AP, GL, payment application, reconciliation, sales tax review, payroll remittance review, close/reopen controls, and accountant handoff exports.
- Reporting screens that lazy-load only when opened so Admin no longer times out loading heavy report datasets.

## Important active files

| Area | Active files |
| --- | --- |
| App shell | `index.html`, `style.css`, `app.js`, `server-worker.js` |
| Frontend modules | `js/*.js` |
| Supabase functions | `supabase/functions/*/index.ts` |
| Cloudflare/Vercel compatibility API | `api/auth/*.js`, `api/logbook/*.js` |
| Current schema reference | `sql/000_full_schema_reference.sql` |
| Latest migration marker | `sql/105_repo_cleanup_and_roadmap_refresh.sql` |
| Main roadmap | `DEVELOPMENT_ROADMAP.md` |
| Current gaps | `KNOWN_ISSUES_AND_GAPS.md` |
| New chat handoff | `NEW_CHAT_STATUS.md` |

## Markdown cleanup completed

Older Markdown was archived instead of being left mixed into the active root:

- Snapshot copies of active docs before refresh: `archive/markdown-current-snapshot-2026-05-10/`
- Retired root Markdown: `archive/markdown-retired-2026-05-10/root/`
- Retired older pass notes from `docs/`: `archive/markdown-retired-2026-05-10/docs/`
- Retired older `docs/archive` content: `archive/markdown-retired-2026-05-10/docs-archive-folder/`

The root now keeps only the active handoff docs we expect to use each pass.

## SEO/local-search rule for every pass

Continue checking exposed public pages for:

- one clear `<h1>` per exposed page;
- clear page titles and meta descriptions;
- locally relevant words in headings and body copy;
- service-area wording that matches what customers search for;
- helpful proof content, reviews, before/after media, and complete business details.

Google’s SEO Starter Guide says page titles should be unique, clear, concise, and accurately describe the page, and Google Business Profile guidance says local ranking is mainly based on relevance, distance, and prominence:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://support.google.com/business/answer/7091

## Validation commands

Run these before packaging:

```bash
node --check js/api.js
node --check js/reports-ui.js
node --check js/admin-ui.js
node --check js/jobs-ui.js
node --check app.js
node --check server-worker.js
node scripts/repo-smoke-check.mjs
```

## Deployment notes

1. Apply new SQL migrations in order through `sql/105_repo_cleanup_and_roadmap_refresh.sql`.
2. Redeploy Supabase Edge Functions when their code changes.
3. Deploy the frontend after bumping app-shell cache versions.
4. Hard-refresh the browser or unregister the old service worker if stale JS remains visible.
5. Test `#admin`, `#reports`, `#jobs`, `#hseops`, and login/account flows before calling the build good.
