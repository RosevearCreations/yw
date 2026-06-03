# YWI HSE App

Current build: **2026-06-02a**  
Current schema: **126**

This build adds DB-visible roadmap tracking, application-depth review rows, JSON/DB data-migration candidates, schema/documentation sync checks, and Admin readiness tables for build, SEO, fallback, roadmap, depth, migration, and sync guardrails.

## Most important deploy note

Apply schema **126**, redeploy `admin-directory`, then redeploy any Edge Functions not already on the repaired schema 126/126 code. Clear the old service worker so the **2026-06-02a** assets load.

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
