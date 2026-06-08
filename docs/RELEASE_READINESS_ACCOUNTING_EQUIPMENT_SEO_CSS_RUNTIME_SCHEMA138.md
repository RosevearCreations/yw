# Release Readiness, Accounting, Equipment, SEO, CSS, Runtime — Schema 138

Build: 2026-06-07a

This document records the schema 138 pass. It adds Admin-visible release readiness queues for signoff, accounting exception closure, equipment service verification, local SEO refresh, CSS/mobile regression, and runtime observability.

## Completed

- Added `sql/138_release_readiness_accounting_equipment_seo_css_runtime_migration_controls.sql`.
- Updated `sql/000_full_schema_reference.sql` through schema 138.
- Updated Admin directory and Admin UI so schema 138 queues are visible with optional-view fallbacks.
- Updated smoke checks, cache marker, sitemap lastmod, and active Markdown.
- Retired root helper Markdown and temporary test files into archive.

## Sanity focus

- One H1 remains required for the public shell.
- CSS brace-balance remains part of the smoke pass.
- Sitemap and robots assets remain present and fresh.
- Schema 128 roadmap-column compatibility remains preserved.

## Next focus

Turn the readiness queues into working write-path screens for payment application, reconciliation, equipment return-to-service, local SEO publication, and runtime recovery.
