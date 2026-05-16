# Accounting Workflow Automation

## Purpose
This document tracks the next active backend accounting workflow layer after the close/reconciliation foundation.

## Current active direction
1. Invoice candidate -> real AR invoice posting
2. Journal candidate -> GL batch posting
3. Sales tax prep from source transactions
4. Payroll remittance prep from payroll exports
5. Bank reconciliation matching assistance
6. Accountant handoff export bundle generation

## What schema 101 adds
- AR-linked job invoice postings
- GL-batch-linked job journal postings
- sales tax prep directory
- payroll remittance prep directory
- bank reconciliation match candidates
- accountant handoff export bundles and bundle items

## What still remains after schema 101
- automated GL journal entry line creation from ledger summary
- invoice payment application automation
- processor/bank match rules beyond near/exact amount suggestions
- sales tax filing generation by tax jurisdiction/profile
- payroll remittance formula/rule profiles by remitter type
- final accountant export packaging and delivery

## Practical operator value
This pass is meant to reduce the gap between Jobs completion/accounting markers and an actual back-office close workflow.

---

## 2026-05-15c update

Schema **109** added production-readiness foundations: admin list pagination settings, guided close step actions and event history, admin audit events, bank CSV import staging, evidence action queue, backup/restore rehearsal tracking, and worker/supervisor mobile action cards. Active roadmap and known gaps were refreshed, retired root Markdown was archived again, temp files were removed again, and the one-H1 rule was rechecked.
