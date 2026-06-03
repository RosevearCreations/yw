# Equipment Transfer, Arrival, Return, and Signoff Workflow

Last refreshed: **2026-06-02a**

## Purpose

Equipment should not simply disappear from the shop, appear on a job, and then return without proof. Schema 123 adds a clearer chain:

1. Equipment master record has Home Site, Current Site, and Destination Site.
2. Checkout records the job, intended site, supervisor, signatures, condition, checkout test, and transport notes.
3. Arrival verification confirms the equipment reached the right site and passed a safe-start or visual test.
4. Return receipt records return destination, return condition, test status, signatures, damage, and photos.
5. Final return verification separates “we received it” from “it is safe/ready to use again.”
6. Exception views show missing arrival verification, arrival issues, return issues, damage, and pending return review.

## UI changes

The Equipment panel now includes:

- Current Site and Destination Site selectors.
- Checkout Test and Checkout / Transport Notes.
- Arrival Verification panel with condition, test status, and notes.
- Return Test and Return Test Notes.
- Verify Arrival / Site Test button.
- Mark Return Verified button.
- Transfer / Return Exceptions table.
- Operational Depth Gates table.
- Transfer Verification History table.

## Database changes

Schema 123 adds:

- New fields on `equipment_items` for current/target site, last transfer status, arrival verification, and return verification.
- New fields on `equipment_signouts` for intended site, checkout site, checkout test, arrival test, return test, verification status, and final return verifier.
- `equipment_transfer_verification_events` audit table.
- `v_equipment_transfer_verification_directory`.
- `v_equipment_return_exception_directory`.
- `v_app_operational_depth_gates`.

## Sanity rules

- Checkout should be blocked if equipment is locked out or not available/reserved.
- Arrival should be verified before equipment is treated as safely on site.
- Return receipt should not automatically mean “ready.” Final return verification is separate.
- Failed/needs-service return tests or damage should keep the item in exception/lockout flow.
- Repair cost and delay cost should eventually flow to job profitability and accounting review.

## Remaining depth to add

- QR/barcode equipment scan.
- Required accessories checklist.
- Photo quality/compression for checkout, arrival, and return evidence.
- Role/permission checks for who can verify arrival or final return.
- Automatic maintenance/service task from failed return tests.
- Repair-cost posting to job profitability and accountant handoff.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
