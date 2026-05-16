# AI Context

Last refreshed: **2026-05-14b**

The user expects every build pass to update Markdown and schema files, preserve one H1 per exposed page, keep SEO/local search habits in mind, and continue moving duplicated/failure-prone data toward the DB where sensible.

## Current build context

- Use `DEVELOPMENT_ROADMAP.md` and `KNOWN_ISSUES_AND_GAPS.md` first.
- Latest schema is 107.
- The previous live SQL errors were:
  - `public.app_schema_versions` did not exist.
  - `jobs.job_status` did not exist; live DB uses `jobs.status`.
- Both are now addressed in repo files.
- Admin has read-only foundations for close, evidence, production readiness, schema drift, and permission matrix.

## Response preference

Keep explanations brief and practical. Provide complete files/code blocks when requested. For build tasks, produce a ZIP unless the user asks for code only.
