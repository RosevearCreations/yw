# Payment Adjustment, Reconciliation Exceptions, Equipment Scan, SEO Depth, and Runtime Messages — Schema 134

Build: **2026-06-06a**  
Schema: **134**

This pass adds DB-visible Admin readiness queues for the next execution layer:

1. Payment adjustment workflows for deposits, credits, refunds, write-offs, overpayments, reversals, and closed-period guardrails.
2. Reconciliation exception controls for duplicates, split matches, and low-confidence/no-match rows.
3. Equipment scan rollout controls for camera/manual scan, accessory templates, verifier roles, and return-to-service lockout.
4. Local SEO content-depth gates for truthful page wording, internal links, one-H1 checks, sitemap/robots, and proof before publication.
5. Runtime error-message catalog rows so common failures have plain user text, operator hints, retry rules, and fallbacks.

## Deployment

Apply `sql/134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages.sql`, then redeploy `admin-directory`. Redeploy `jobs-manage` and `jobs-directory` only if the live functions are behind the schema 133/134 bundle.

## Sanity checks

The smoke script now checks for schema 134 markers, Admin Edge Function coverage, Admin UI render targets, cache marker **2026-06-06a**, `sitemap.xml`, `robots.txt`, one public H1, and CSS brace balance.

Reviewed during build **2026-06-06a / schema 134**. Keep this document aligned with the active roadmap and known gaps.
