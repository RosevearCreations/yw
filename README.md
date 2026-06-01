# YWI HSE App

Current build: **2026-06-01a**  
Current schema: **125**

This build repairs the `jobs-manage` Edge Function bundle failure, adds TypeScript parse checks to the smoke script, improves deployment/SEO/fallback guardrails, and keeps the accounting/equipment depth work from schema 124.

## Most important deploy note

Apply schema 125, then redeploy `jobs-manage` and `jobs-directory`. Clear the old service worker so the **2026-06-01a** assets load.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
