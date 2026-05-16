# Accounting Close End-to-End Workflow

Last refreshed: **2026-05-16a**

## Current state

The close workflow now has dashboard counts and schema 108 close-step metadata. The Admin UI renders close summary cards and step cards for:

1. Period review
2. Payment applications
3. Bank reconciliation
4. Tax and payroll
5. Journal preview
6. Accountant package delivery

## Still needed

- Step owner, due date, completion notes, and blocker drill-down.
- Posting preview with debit/credit/source/approval/locked-period validation.
- Bank CSV import and manual reconciliation controls.
- Payment application detail forms.
- Accountant package generation and delivery confirmation.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.


## 2026-05-16a update

- Added compact expandable mobile main navigation so the app no longer opens as a long route list on phones.
- Added compact expandable Admin section navigation for small screens.
- Added schema 110 frontend quality gates and updated active Markdown/schema references.
