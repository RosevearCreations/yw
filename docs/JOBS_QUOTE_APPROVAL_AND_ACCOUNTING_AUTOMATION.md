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
