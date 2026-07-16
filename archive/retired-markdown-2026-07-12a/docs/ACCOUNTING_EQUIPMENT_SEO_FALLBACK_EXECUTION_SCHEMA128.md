# Accounting, Equipment, SEO, and Fallback Execution Queues — Schema 128

Build: **2026-06-03a**  
Schema: **128**

## Purpose

Schema 128 turns the previous roadmap gaps into Admin-visible execution queues. The goal is to stop important next steps from living only in Markdown and make them visible through database views and the Admin readiness screen.

## Added tables and views

- `app_payment_application_action_registry` / `v_app_payment_application_action_registry`
- `app_accounting_close_control_queue` / `v_app_accounting_close_control_queue`
- `app_equipment_accountability_action_queue` / `v_app_equipment_accountability_action_queue`
- `app_public_seo_publication_queue` / `v_app_public_seo_publication_queue`
- `app_fallback_observability_matrix` / `v_app_fallback_observability_matrix`

## What this pass improves

- Payment application work is now grouped into apply, reverse, adjustment, refund, and job-cost rollup actions.
- Accounting close work is now grouped into bank CSV preview, manual reconciliation, HST/GST proof, payroll remittance proof, close lock/reopen, and accountant export packaging.
- Equipment accountability work is now grouped into scanner support, accessory templates, verifier-role enforcement, failed-test work orders, and return-to-service signoff.
- Public SEO work is now grouped into sitemap/robots generation, broken-link checks, structured data, and image-alt scoring.
- Fallback handling is now grouped by surface, failure mode, user message, telemetry, retry policy, and owner.

## Deployment notes

Apply schema **128**, then redeploy `admin-directory`. Redeploy `jobs-manage` and `jobs-directory` as needed if the live project is behind the repaired schema 126/127 code. Hard-refresh or clear the old service worker so the **2026-06-03a** cache marker is loaded.

## Remaining work

The rows added in schema 128 are readiness/execution queues. The next pass should turn the highest-value rows into working UI actions, starting with payment application and bank CSV preview.


## Schema 134 pass marker

Reviewed during build **2026-06-06a / schema 134**. Keep this document aligned with the active roadmap and known gaps.
