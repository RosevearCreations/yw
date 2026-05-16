# Project State

Last refreshed: **2026-05-15c**

## Current build

- Build label: `2026-05-15c`
- Latest schema: `109`
- Main focus: production-readiness foundations for admin workflow, accounting close, evidence handling, auditability, bank CSV staging, mobile cards, and recovery rehearsal tracking.

## What is working in this build

- Admin Command Center and Health Center are still the main operator entry points.
- Guided Close Center now has DB-backed step rows and complete/reopen actions.
- Evidence Manager now creates follow-up records and queues evidence actions.
- Readiness panel now displays deployment gates, SEO smoke checks, bank CSV import sessions, backup rehearsal rows, mobile action cards, permissions, and audit rows.
- Root Markdown cleanup is repeated because uploaded zips sometimes reintroduce retired docs and temp files.

## Main caution

Apply schema **109** before expecting the new Admin tables to fill with live data.
