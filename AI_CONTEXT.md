# AI Context

Last refreshed: **2026-05-15c**

This repo is the YWI HSE / operations app. The user wants every code pass to update Markdown, SQL schema references, smoke checks, CSS drift, SEO checks, and one-H1 status.

## Current state

- Latest build version: `2026-05-15c`
- Latest schema: `109`
- Latest focus: make the app backend feel more like a real production app by adding DB-backed workflow controls, auditability, recovery rehearsal tracking, bank CSV staging, evidence action queues, and mobile dashboard planning.

## Critical habits

- Do not reintroduce retired root Markdown into the active root.
- Remove `test_write` temp files from active root.
- Keep one H1 per exposed page.
- Keep roadmap and known gaps current after every pass.
- Apply SQL before relying on new Admin UI panels.
