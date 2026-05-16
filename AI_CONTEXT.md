# AI Context

Last refreshed: **2026-05-16a**

This repo is the YWI HSE / operations app. The user wants every code pass to update Markdown, SQL schema references, smoke checks, CSS drift, SEO checks, and one-H1 status.

## Current state

- Latest build version: `2026-05-16a`
- Latest schema: `110`
- Latest focus: compact mobile navigation, responsive Admin section navigation, frontend quality gates, and continued production-readiness cleanup.

## Critical habits

- Do not reintroduce retired root Markdown into the active root.
- Remove `test_write` temp files from active root.
- Keep one H1 per exposed page.
- Keep roadmap and known gaps current after every pass.
- Bump service-worker/static asset versions when changing frontend files.
- Apply SQL before relying on new Admin UI/schema health rows.
