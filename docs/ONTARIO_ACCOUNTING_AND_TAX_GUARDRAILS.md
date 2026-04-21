<!-- Reviewed during schema 086 HSE ops performance and site-activity rollup pass on 2026-04-20. -->
<!-- Reviewed during schema 080 recurring agreements / payroll / asset history / login tracking pass on 2026-04-17. -->
# Ontario accounting and tax guardrails

Last synchronized: April 14, 2026

## Current direction
- Default the operating jurisdiction to Ontario, Canada for the landscaping and field-service workflow.
- Treat CAD as the default currency.
- Treat HST as the default sales tax for taxable Ontario supplies unless a zero-rated, exempt, or place-of-supply exception applies.
- Keep pricing and jobs able to run standalone for now, but keep every pricing path ready to feed AR/AP/GL records later.

## Immediate application guardrails
- Show clear tax labels in pricing and accounting screens instead of generic “Tax” wording where the default is known.
- Keep tax amount editable because not every job or supply follows the Ontario default.
- Preserve subtotal, tax total, and total amount separately on estimates, work orders, invoices, bills, and order stubs.
- Keep source records linked to accounting rows so later audit, filing, and reconciliation work can trace back to the originating job, dispatch, or material flow.

## Ontario / CRA reminders to keep in scope
- Ontario is a participating province for HST and the default Ontario rate is 13% on taxable supplies.
- Place-of-supply rules matter; not every supply should automatically use the Ontario default.
- Corporations generally file the T2 return within six months of year-end.
- For tax years starting after 2023, corporations generally have to file the T2 electronically unless an exception applies.

## Next build candidates
1. Add DB-backed business tax settings instead of keeping Ontario defaults only in UI helpers.
2. Add tax code / tax class support for taxable, exempt, zero-rated, and out-of-province work.
3. Add invoice/bill tax validation so totals are recalculated consistently and auditable.
4. Add Ontario-facing customer invoice wording and registration-number display controls.
5. Add month-end and year-end accounting review checklists for CRA-oriented closeout.

## 2026-04-16 implementation note
This repo now has the start of a labor-aware profitability model. Ontario tax guardrails should now be applied together with:
- signed session completion,
- labor-rate-based cost review,
- job financial adjustment events,
- uninvoiced completed-job review before final billing.
> Synchronized for the 2026-04-16 accounting-profitability and job-financial-rollup pass.


## 2026-04-19 employee time clock and attendance pass

- Added DB-backed `site_activity_events`, `v_site_activity_recent`, and `v_site_activity_summary` so Admin can review durable activity for staff creation/updates, new jobs, equipment changes, agreements, payroll exports, contracts, and related operational changes.
- Admin now loads and renders a Recent Site Activity table directly from the backend instead of relying only on login traces or per-screen notices.
- `admin-manage`, `jobs-manage`, and `account-maintenance` now record key activity events while still failing safely if the audit trail insert itself has a problem.
- Current schema target is now 082.
