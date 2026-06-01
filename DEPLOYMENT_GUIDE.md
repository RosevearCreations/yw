# Deployment Guide

Last refreshed: **2026-06-01a**

## Current deploy target

- Build: **2026-06-01a**
- Schema: **125**

## Deploy order

1. Apply SQL migrations through `sql/125_deployment_bundle_parse_seo_fallback_guardrails.sql`.
2. Confirm `v_schema_drift_status` expects and reports schema 125.
3. Deploy `jobs-manage`.
4. Deploy `jobs-directory`.
5. Deploy any other changed functions normally.
6. Publish static files.
7. Hard-refresh or clear the browser service worker so **2026-06-01a** files load.

## Why `jobs-manage` should be deployed first

The previous deploy failed because `jobs-manage` had an unterminated regexp literal. This build repairs that specific file and adds smoke checks to catch similar TypeScript parse issues before deploy.

## Post-deploy verification

- `jobs-manage` bundles successfully.
- Jobs page loads.
- Equipment page loads.
- Equipment checkout/arrival/return forms still submit.
- Accounting Depth tables still load with fallback empty states.
- No duplicate comment attachments appear on job comments.

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
