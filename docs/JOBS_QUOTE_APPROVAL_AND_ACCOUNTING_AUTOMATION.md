<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Jobs Quote Approval and Accounting Automation

This pass adds the next commercial layer on top of the Jobs workflow:

- client-ready estimate quote package rendering
- approval thresholds with discount and margin guardrails
- work-order release controls
- completion closeout package drilldown
- invoice and journal candidates
- AR/AP coordination queue
- business-entity and tax-profile mapping for corporation and LLC style filing handoff

## Tax and entity mapping

The business tax settings profile now supports:

- legal entity type
- legal entity name
- federal return type
- provincial return type
- U.S. entity type
- U.S. tax classification
- business number / corporation number / EIN
- default commercial accounting account references

This is bookkeeping and accountant-handoff mapping, not tax advice.

## Commercial workflow additions

### Quote package
- `estimate_quote_packages`
- render status, sent/accepted timestamps, tax profile mapping
- public token reserved for later client-facing delivery flow

### Approval thresholds
- `commercial_approval_thresholds`
- discount caps
- fixed-discount caps
- minimum margin warnings / blocks
- required signoff role

### Work-order release control
- `work_order_release_reviews`
- release gate with pass / warn / block threshold status

### Completion package
- `job_completion_closeout_items`
- evidence, supervisor signoff, client signoff, variance explanation, materials/equipment closeout

### Accounting follow-through
- `job_invoice_candidates`
- `job_journal_candidates`
- `job_ar_ap_review_queue`

## Best next build after this pass

1. branded printable / email quote output
2. automated threshold evaluation before release
3. invoice and journal candidate posting rules
4. closeout evidence upload linkage into package items
5. profitability scorecards by site, supervisor, route, and job family
6. accountant-handoff exports for T2 / corporation and LLC-style bookkeeping review


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.


---
Pass 097 sync note (2026-04-26d): quote output, threshold enforcement on save/release, closeout evidence linkage to real records, posting-rule-aware invoice/journal candidates, accountant handoff enrichment, and extended profitability scorecards.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-05-20b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._
