> Current pass update — accounting templates now live alongside statement-import, reconciliation-exception, fixed-asset, and vendor-statement review groundwork in the main app workflow.

# Current pass update — 2026-04-24

- `general_ledger_accounts.csv` now includes starter GIFI staging columns: `parent_group`, `normal_balance`, `sort_order`, `gifi_code`, `gifi_label`, `gifi_section`, and `tax_deductibility_percent`.
- These starter mappings are for accountant review and T2/GIFI staging, not a claim that the site is now full tax software.

# Accounting Templates

Use these starter templates to seed the accounting backend with general ledger accounts, expenses, write-offs, and product unit costs.

- `accounting_overhead_allocations.csv` — starter monthly overhead allocations used for rough P&L and later product-cost allocation.
- The current pass also treats electricity, gas, internet, phone, insurance, software, and rent allocation as first-class monthly shortcuts in the admin accounting UI so recurring T2-style overhead capture is faster.

- `general_ledger_accounts.csv` now also carries starter review fields: `gifi_review_state` and `gifi_review_note`, including a reviewed/finalized starter mapping for common Devil n Dove accounts.
