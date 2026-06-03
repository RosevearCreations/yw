<!-- Reviewed during 2026-05-06 accounting close, reconciliation, and backend accounting coverage pass. -->
# Accounting close and reconciliation foundation

## What this pass adds
- backend close-period records
- sales-tax filing records
- payroll remittance records
- bank accounts and statement-import records
- bank reconciliation sessions and reconciliation items
- AR aging detail view
- AP aging detail view
- GL trial balance summary view
- sales-tax filing summary view
- payroll remittance summary view
- bank reconciliation summary view
- accounting close dashboard
- chart-of-accounts fields for GIFI / accountant export grouping

## Why this matters
The repo already had quote, release, completion, invoice-candidate, journal-candidate, AR/AP queue, and accountant-handoff foundations. This pass starts closing the remaining backend-accounting gaps by adding the structures needed for:
- month-end and year-end close
- GST/HST filing review
- payroll remittance review
- bank and processor reconciliation workflows
- accountant-ready grouping of accounts for corporation/T2 and LLC-style bookkeeping review

## Immediate next implementation order
1. Post invoice candidates into the existing AR invoice lifecycle with real invoice numbering and due-date handling.
2. Post journal candidates into balanced GL journal batches with batch controls and reversal support.
3. Add payment application and customer/vendor aging drilldowns in the UI.
4. Add sales-tax filing prep helpers from source invoices and bills.
5. Add payroll-remittance prep helpers from payroll export runs.
6. Add bank statement import parsing and reconciliation matching helpers.
7. Add accountant-handoff export bundles with trial balance, AR aging, AP aging, sales-tax, payroll, and close checklist coverage.

## Backend accounting coverage now
### Strong foundation already present
- chart of accounts
- GL journal batches and entries
- AR invoices and payments
- AP bills and payments
- tax codes and business tax settings
- quote / estimate / work-order / completion / posting candidate workflow
- accountant handoff export records

### Still not complete
- full invoice posting lifecycle and receipt application automation
- full journal posting engine with reversal / correction workflow
- filing-date and remittance automation
- bank / processor reconciliation matching logic
- period lock and reopen audit workflow in the UI
- accountant-facing export bundle packaging and delivery
- fixed-asset / CCA / depreciation support

## Value-added next steps to keep in scope
1. Public quote acceptance flow.
2. Hard threshold enforcement on every save/release path.
3. Completion-to-accounting automation.
4. Invoice candidate -> AR invoice posting automation.
5. Journal candidate -> GL batch posting automation.
6. Sales-tax prep and filing workflows.
7. Payroll remittance workflows.
8. Bank reconciliation matching helpers.
9. Month-end / year-end close checklists and locks.
10. Accountant handoff package generation.
11. GIFI / T2 export grouping by account.
12. LLC / INC entity-profile aware exports and reviews.

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
