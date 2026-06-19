# Next Steps and Sanity Check — build 2026-06-17b / schema 150

## Overall finding

The requested highest-value implementation layer is now present in the repository. The application has moved beyond request-only forms into live work queues and linked operational records. The next release should focus on controlled deployment, live data mapping, transaction hardening, and end-to-end evidence—not another broad expansion of tables.

## Completed in this pass

1. Added live queues below every Operations Cockpit area with row-level approval, rejection, posting, promotion, matching, service, recovery, publication, assignment, scheduling, deposit, and job-cost actions.
2. Linked approved payment requests to real AR/AP applications and balanced journal entries with proof, period-lock, bank, control-account, idempotency, posting-claim, deposit-release, refund-limit, and reversal guards.
3. Promoted accepted bank CSV rows into real statement, import, session, and reconciliation-item records.
4. Added explainable reconciliation scoring and exact cent-level split validation.
5. Resolved scan codes against real equipment records with manual and camera fallback.
6. Created service tasks, lockouts, and cost-recovery actions from failed equipment returns.
7. Added browser image optimization, thumbnail creation, server dimension/size/checksum validation, storage, approval, and controlled placeholder replacement.
8. Added approved public route records, publication gates, public content API, static HTML generation, Service JSON-LD, and sitemap generation.
9. Added quote owner assignment, due alerts, event history, Admin notification records, and optional Resend email delivery.
10. Added a token customer portal with single-claim quote acceptance, deterministic work-order linkage, server-calculated exact deposits, reusable Stripe Checkout, paid-only webhook validation, dispatch visibility, follow-up requests, and live job-cost snapshots.
11. Added responsive queue, portal, and public route CSS for desktop, tablet, phone, and reduced-motion users.
12. Updated cache/build markers to `2026-06-17b` and rebuilt the canonical schema as 121 ordered migrations from 030 through 150.
13. Consolidated active project documentation to this file and the handbook; older Markdown is archived.
14. Passed the repository smoke suite, JavaScript/TypeScript syntax checks, schema field audit, approved-route generation test, one-H1 check, sitemap check, and reserved-path rejection test.

## Sanity matrix

| Area | Repository status | Live-release gate |
|---|---|---|
| Schema 150 | Implemented and merged into full reference | Apply to staging/live and verify drift view |
| Cockpit queues | Implemented | Confirm roles and real queue data |
| AR/AP + journals | Implemented with safeguards | Map accounts; test success, lock, duplicate, reversal |
| Bank promotion | Implemented | Test at least two real bank CSV formats |
| Reconciliation scoring/splits | Implemented | Confirm sign conventions and cent balance |
| Equipment scan/service/recovery | Implemented | Test real codes, accessories, photos, failed return |
| Image pipeline | Implemented | Confirm bucket policies and mobile upload limits |
| Public route publication | Implemented | Approve proof/visual, run generator, inspect output |
| Quote assignment/alerts | Implemented | Configure Resend or accept in-app-only alerts |
| Customer portal | Implemented with single acceptance claim and reusable exact-balance checkout | Test token lifecycle, duplicate clicks, and privacy behaviour |
| Stripe deposits | Paid-only webhook with exact session/amount/currency checks | Configure test keys/webhook; never use live first |
| Dispatch/job cost | Implemented | Map jobs/work orders/cost sources and compare totals |
| Mobile/desktop CSS | Implemented | Device/browser visual regression pass |
| SEO | Guardrails and generator implemented | Internal links, Search Console, real proof, performance |
| Documentation | Two active detailed files | Keep archived files inactive |

## Release blockers

These are deployment blockers, not new product ideas:

1. Apply schema 150 to a staging database and resolve any live-schema naming differences.
2. Deploy the five changed/new Edge Functions with correct JWT settings.
3. Confirm the `public-assets` bucket and object policies.
4. Configure Stripe test secrets, webhook endpoint, and success/cancel URLs.
5. Confirm chart-of-account mappings and at least one open bank account.
6. Verify an open and a locked accounting period.
7. Test one AR payment, one AP payment, one reversal/refund/write-off path, and one duplicate idempotency attempt.
8. Test a clean bank CSV, rejected rows, duplicate rows, one exact match, and one split match.
9. Test a real equipment code, unknown code, failed return, service task, lockout, and cost recovery.
10. Upload one real consent-cleared image from a phone, approve it, assign it to a route, publish the route, and generate the static page/sitemap.
11. Accept one quote through the portal, create a Stripe test deposit, confirm the webhook, schedule dispatch, and refresh job cost.
12. Run browser checks at approximately 360px, 768px, 1024px, and wide desktop widths.

## Highest-value work after staging proves schema 150

1. Replace sequential accounting/reconciliation posting writes with transactional PostgreSQL RPC functions so a failure rolls back the whole operation.
2. Add automated integration tests against a disposable Supabase project for the ten workflows listed above.
3. Add permission/RLS tests for worker, supervisor, HSE, Job Admin, and Admin roles.
4. Connect dispatch changes and quote follow-up alerts to the existing notification delivery worker, including customer/staff preferences and retry/dead-letter handling.
5. Add real-time Supabase subscriptions or a safe polling interval so queue cards update across multiple Admin sessions without manual refresh.
6. Add upload progress, cancellation, resumable retry, and weak-connection recovery for large field evidence, while keeping public images within the current optimized limits.
7. Add immutable posting batches and a formal correction/reversal workflow rather than editing posted accounting records.
8. Reconcile job-cost source mappings against payroll/time, material issues, equipment usage, subcontract bills, and approved change orders.
9. Generate an internal-link block from approved route relationships so every important published route is crawlable from another page.
10. Replace the most visible placeholders with approved real crew, equipment, process, and completed-work photography.

## SEO sanity check

The new route layer follows current Google guidance by using descriptive titles/meta, one visible H1, relevant approved images with alt text/dimensions, visible content-backed structured data, crawlable CTAs, and an approved-only sitemap. A sitemap helps discovery but does not guarantee crawling, indexing, or ranking. Real local proof and internal links remain essential.

Before publishing each route, verify:

- the service and location are genuinely offered;
- the page has unique useful information, not only swapped place names;
- the title/H1/meta read naturally;
- the image is relevant, approved, compressed, and consent-cleared;
- the page links to a real conversion path;
- the route is linked from another useful public page;
- the canonical URL is correct;
- the generated HTML contains one H1 and valid JSON-LD;
- Search Console URL Inspection and Rich Results Test show no blocking issues.

## Recommended release decision

Use this build for a staging deployment. Do not post real accounting transactions or accept live deposits until the schema, account mappings, Stripe webhook, storage policies, and rollback tests pass. Do not bulk-publish location pages until each has real local proof, an approved visual, and an internal-link path.
