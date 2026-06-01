# Project State

Last refreshed: **2026-06-01a**

## Current build

- Build label: **2026-06-01a**
- Current schema: **125**
- Current focus: deployment bundle parse repair, SEO/local wording guardrails, runtime fallback guardrails, and cleanup after the `jobs-manage` Supabase bundle failure.

## What changed most recently

- `jobs-manage` was repaired so the accessory-list fallback parser no longer contains a literal newline inside a regexp.
- Edge Function TypeScript parse checks were added to the smoke script.
- `jobs-directory` was repaired so job comment attachments are not duplicated.
- Service worker install fallback was improved.
- Schema 125 added DB-visible deployment, SEO, and fallback checks.

## Deploy order

1. Apply schema 125.
2. Deploy `jobs-manage`.
3. Deploy `jobs-directory`.
4. Deploy other changed functions if needed.
5. Hard-refresh or clear the old service worker.

## Main remaining depth areas

- Payment application editor.
- Bank CSV import preview and reconciliation scoring.
- HST/GST and payroll source-total drilldowns.
- Month-end close wizard and accountant package builder.
- Equipment QR/barcode scan, accessory templates, verifier-role enforcement, and service-task completion.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
