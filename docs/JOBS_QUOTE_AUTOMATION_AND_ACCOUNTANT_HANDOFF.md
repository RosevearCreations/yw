<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Jobs Quote Automation and Accountant Handoff

Pass 097 deepens the Jobs commercial/accounting path beyond the earlier foundation passes.

## What this pass adds

- richer branded quote rendering from stored quote packages
- threshold evaluations on save and again before release
- closeout evidence links that can resolve to real source records such as:
  - `job_comment_attachments`
  - `submission_images`
  - `equipment_evidence_assets`
- invoice candidate creation that respects posting rules
- journal candidate creation that respects posting rules
- accountant handoff exports that carry:
  - legal entity metadata
  - filing profile mapping
  - quote package context
  - closeout items and closeout evidence counts
  - invoice and journal candidate counts
- expanded profitability scorecards with quoted, estimated, and variance context

## Why this matters

This keeps the project moving toward one connected operational spine:

- field-safe capture and approvals on one side
- commercial closeout and accounting preparation on the other

Instead of building a disconnected quoting tool, this lets Jobs, work orders, closeout, and accountant handoff all stay tied to the same records.

## Best next checks

1. Render a quote package from an estimate and verify:
   - printable HTML
   - email subject/body
   - brand/legal-entity metadata
2. Save a work-order release review and confirm a threshold evaluation row is written automatically.
3. Attempt release with a warn-level threshold and no signoff, and confirm release is blocked until signoff is provided.
4. Link closeout evidence using:
   - direct URL
   - `job_comment_attachments`
   - `submission_images`
   - `equipment_evidence_assets`
5. Create invoice and journal candidates from a completion review and confirm posting-rule data is stored in payload.
6. Generate an accountant handoff export and verify corporation/T2 vs LLC-style mapping shows in the export content.

## Best next pass after this

- real email delivery of quote packages
- stricter threshold policy by role/client/job family
- completion closeout package signoff drilldown
- invoice/journal candidate posting into fuller AR/AP and GL workflows
- profitability and variance dashboards directly on the Jobs page

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-05-20b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
