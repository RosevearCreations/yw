# YWI Operations Platform

**Current source handoff:** `2026-07-12a`  
**Database target:** schema `157`  
**Current focus:** service-execution proof, approved customer-safe evidence, and internal estimate-versus-actual job costing.

This repository is the active source package for the Yard Weasels Inc. operations platform. It combines quote intake, customer portal, deposits, dispatch, live job updates, consent-controlled customer email, media approval, accounting/reconciliation controls, accountant handoff, public route SEO, release evidence, and now service-execution proof.

## Active documentation

Only these Markdown files are active:

1. `README.md`
2. `docs/ACTIVE_PROJECT_HANDBOOK.md`
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md`

Historical Markdown files are preserved under `archive/retired-markdown-2026-07-12a/`.

## Schema 157 summary

Schema 157 adds service-execution proof and cost capture:

- site leaders can submit arrival, progress, completion, quality, material, equipment, expense, or note proof;
- supervisors approve or reject proof;
- approved proof updates internal labour, material, equipment, other cost, margin, and estimate-versus-actual dashboards;
- approved customer-visible proof can show a customer-safe summary and approved public images in the secure portal;
- staff notes, labour, material, equipment cost, margin, and internal variance never appear in the customer portal or public SEO routes.

## Release boundary

The source package is statically checked. Live Supabase migrations, RLS/storage behavior, Stripe/Resend delivery, and authenticated browser/device rendering still require staging credentials and the test process in `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.
