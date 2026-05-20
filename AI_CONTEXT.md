# AI Context

Last refreshed: **2026-05-19b**

This repository is the YWI/Rosie Dazzlers operations app. Continue every pass by updating schema files, active Markdown, CSS/mobile checks, one-H1 verification, and roadmap/gaps.

## Current state

- Latest schema: 117.
- Current asset/cache version: 2026-05-19b.
- Admin startup is now staged through split scopes, including Accounting Close, Banking, Tax/Payroll, and Evidence.
- Broad `all` and `accounting` scopes are still emergency fallbacks only.
- Retired root Markdown and `test_write` files should not remain active in the root.

## Next priority

Render the new deployment checklist and fast-path registry rows in the Admin Production Readiness panel, then add schema/function preflight warnings before showing actions that depend on newer migrations.
