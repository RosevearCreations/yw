<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Jobs Quote Output and Posting Rules

This pass extends Jobs commercial workflow with:

- branded printable and email quote output from stored quote packages
- automatic commercial threshold evaluations before work-order release
- closeout evidence links tied to completion package items
- invoice and journal candidate posting rules
- accountant handoff exports with entity/tax-profile context
- profitability and variance scorecards by site, supervisor, route, and job family

## Best next checks

1. Render a quote package from an estimate and verify printable/email fields populate.
2. Mark the quote printed and then sent; verify output events exist.
3. Evaluate thresholds on a work order and verify pass/warn/block rows are stored.
4. Link one closeout evidence row to a completion package item.
5. Export an accountant handoff package for a completion review.
6. Verify profitability/variance rows appear for job, site, supervisor, route, and job family.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.


---
Pass 097 sync note (2026-04-26d): quote output, threshold enforcement on save/release, closeout evidence linkage to real records, posting-rule-aware invoice/journal candidates, accountant handoff enrichment, and extended profitability scorecards.

## 2026-05-05 sync note
The 096 migration in the repo is now the compatibility-safe canonical version. If this workflow evolves again, later passes should preserve view layouts instead of redefining them with fewer columns.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-06-01a**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
