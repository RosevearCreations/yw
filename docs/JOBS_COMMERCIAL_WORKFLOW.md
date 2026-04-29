# Jobs Commercial Workflow Foundation

This pass expands the Jobs area toward a complete commercial and accounting workflow without replacing the existing jobs page.

## What is included in this pass

- DB-backed commercial estimate fields:
  - quote title
  - pricing basis label
  - discount mode/value
  - approval required/status
  - margin estimate totals
  - client/internal notes
  - conversion links to job and work order
- DB-backed work-order commercial fields:
  - pricing basis label
  - discount mode/value
  - approval required/status
  - completion review status
  - accounting trigger status
  - completion-ready flags
  - internal notes
- line-level estimate/work-order commercial fields:
  - cost total
  - discount amount/percent
  - margin total/percent
  - pricing basis label
  - client-visible toggle
- commercial approval history table
- job completion review table
- accounting completion event queue table
- views for:
  - estimate commercial directory
  - work-order commercial directory
  - job completion review directory
  - accounting-ready queue

## What the UI now does

Inside Jobs, the commercial panel now supports:

- create estimate from a selected job
- add estimate line to the active estimate
- convert estimate into a live job package
  - creates a linked work order
  - copies estimate lines into work-order lines
- create/update completion review
- queue completion review for accounting follow-through

## Why this direction matters

This preserves the strongest value of the application:
commercial workflow is connected directly to the live job, work order, completion, and downstream accounting review path.

That is more valuable than building a separate quoting tool that later has to be re-keyed into operations.

## Best next steps after this pass

1. client-ready quote rendering and estimate print/email package
2. commercial approval thresholds and margin warnings
3. work-order release / dispatch lock controls
4. completion package drilldown with evidence, signoff, and variance review
5. accounting follow-through:
   - invoice candidate creation
   - journal candidate creation
   - post-completion review queue
   - closeout summary export

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.


---
Pass 097 sync note (2026-04-26d): quote output, threshold enforcement on save/release, closeout evidence linkage to real records, posting-rule-aware invoice/journal candidates, accountant handoff enrichment, and extended profitability scorecards.
