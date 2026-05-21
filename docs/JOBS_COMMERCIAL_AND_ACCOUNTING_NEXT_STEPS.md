<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
<!-- Reviewed during 2026-05-05 migration compatibility and commercial-schema sync pass. -->
# Jobs Commercial and Accounting Next Steps

The next major build phase should turn the existing Jobs area into a full commercial workflow, then tie completed work into accounting-ready review.

## Current strengths already in the repo

The Jobs area already carries important groundwork:
- pricing fields
- tax rate fields
- discount mode and markup fields
- approval status fields
- change orders
- estimate and work-order structures
- job financial rollups
- payroll and material usage hooks

That means the next pass should expand and connect what already exists instead of starting over.

## Best next implementation order

1. Quote and estimate discipline
   - estimate header completeness
   - estimate line pricing and discounts
   - approval/request flow
   - conversion rules to agreement / work order / job

2. Commercial approval controls
   - discount approval thresholds
   - margin warnings
   - signoff audit trail
   - client-facing vs internal-only notes separation

3. Costing depth
   - labour, material, equipment, subcontract, delay, repair, tax, and change-order rollups
   - estimate vs actual variance reporting
   - completion profitability review

4. Job completion trigger
   - explicit completion review state
   - accounting-ready queue
   - invoice / receivable / journal trigger coordination
   - closeout evidence and supervisor signoff checks

5. Backend accounting follow-through
   - post-completion review queue
   - AR/AP coordination
   - completion package and summary export
   - margin/profit evaluation with variance explanation

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.


---
Pass 097 sync note (2026-04-26d): quote output, threshold enforcement on save/release, closeout evidence linkage to real records, posting-rule-aware invoice/journal candidates, accountant handoff enrichment, and extended profitability scorecards.


## Added accounting-close foundation
The backend accounting side now includes period close, sales-tax filing, payroll remittance, bank-account, statement-import, reconciliation-session, and reconciliation-item structures. The next commercial/accounting work should now concentrate on promotion and automation rather than more disconnected schema additions.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.

_Last refreshed: **2026-05-20b**_

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._
