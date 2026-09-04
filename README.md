# Yard Weasels Inc. Operations Platform

This repository contains the Yard Weasels Inc. staff operations application, customer portal, and approved public service-page publishing layer.

## Current product boundary

The staff application has four top-level modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin workspace, not a fifth top-level module. Module access is permission-driven and server-side write authority remains fail-closed.

The public layer consists of the home/contact surface and approved service/location routes. Customer quote links use the separate token-protected customer portal.

## Operator help

Current in-app guidance is maintained at **`/help.html`** and linked from the application header. Help covers sign-in/recovery, mobile workflow, the four modules, offline/sync behavior, customer portal privacy, and troubleshooting. The Help page is intentionally `noindex` so operational guidance does not compete with public service content in search.

## Public search and SEO contract

Public/indexable pages must have exactly one rendered page-level `H1`, responsive mobile and desktop layout without horizontal overflow, a useful title and meta description, an on-site canonical URL, index/follow directives only for genuinely public content, crawlable links, approved content, canonical-only sitemap entries with truthful `lastmod`, and accessible image alternative text. Customer portal and operational Help surfaces remain `noindex`.

The static public-route generator remains the preferred crawler path. The browser route renderer is a fallback and must preserve the same canonical, indexing, and one-H1 rules.

## Release truth

Do not copy release SHAs, workflow run numbers, or historical build numbers into active documentation. Current source/release authority belongs in GitHub and service-private I.T. release views. Current database version belongs in `v_schema_drift_status` / `app_schema_versions`.

Production promotion remains deliberate/manual. Finance posting execution and payment-provider mutation remain OFF unless a separately authorized release explicitly changes those controls. Human accounting/provider/content/staging acceptance work must not be auto-closed by source changes.

## Repository hygiene

Git history and numbered migrations are the audit trail. Do not recreate archive folders, temporary patch workflows, backup files, generated full-schema snapshots, or release-handoff Markdown. The active Markdown set is intentionally limited to this README plus the two files in `docs/`.

## Development checks

`npm run test:repo` verifies repository hygiene and durable documentation rules. `npm run test:help-seo` verifies Help/search/H1/static search controls. Rendered browser acceptance includes phone and desktop Help/app/public-page layout checks.
