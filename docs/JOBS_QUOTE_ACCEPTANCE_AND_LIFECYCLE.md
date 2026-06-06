<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Jobs Quote Acceptance and Accounting Lifecycle

Pass 099 adds the next commercial/accounting layer on top of the quote, release, completion, and posting foundations.

## What this pass adds

- Quote engagement tracking
  - first viewed at
  - last viewed at
  - open count
  - accepted / declined markers
  - client engagement event history
- Stronger release evaluation state
  - last evaluated at
  - evaluation count
  - last threshold message
- Completion readiness rollup
  - required closeout counts
  - signoff completion counts
  - evidence asset counts
  - ready-for-accounting boolean
- Accounting lifecycle events
  - completion signoff events
  - invoice posting events
  - journal posting events
  - accountant handoff events

## Why this matters

This moves the Jobs page from isolated actions into a clearer management workflow:
- quote engagement can be seen without leaving the commercial panel
- release reviews now preserve evaluation history and the latest threshold message
- completion reviews can be judged for accounting readiness using signoff, closeout, and evidence state together
- posted invoice/journal actions now leave a visible accounting lifecycle trail

## Best next steps after this pass

1. Public or client-safe quote acceptance/open tracking from a shareable quote view
2. Automatic threshold checks on every commercial save path, not only release review paths
3. Deeper completion package signoff and evidence workflow
4. Fuller AR/AP and GL lifecycle beyond manual posting markers
5. Profitability and variance scorecards that can be filtered by site, supervisor, route, and job family

## 2026-05-05 sync note
The quote engagement lifecycle now assumes the repaired 099 migration and the synced full schema reference. Client name resolution should come from `public.clients`, not a raw `estimates.client_name` column.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-06-02b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
