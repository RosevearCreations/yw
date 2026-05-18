# AI Context

Last refreshed: **2026-05-17b**

The current baseline is a YWI operations/HSE/accounting app with static frontend, Supabase database, and Supabase Edge Functions. The user expects every build pass to update Markdown and SQL schema references, keep one H1 per exposed page, watch CSS drift, add robust fallback/error handling, improve mobile usability, and keep roadmap/gap files current.

Latest pass: schema 113, panel-only Admin refreshes, Jobs review table, job status/note actions, admin-directory fast paths, refreshed Markdown.

Do not reintroduce retired root Markdown into the active root. Keep historical copies in `archive/`.
