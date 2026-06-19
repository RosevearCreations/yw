# Next Steps and Sanity Check — build 2026-06-18a / schema 151

## Completed in this pass

1. Added schema `151_transactional_rpc_accounting_reconciliation_quote_tests.sql`.
2. Converted approved payment posting to `ywi_rpc_post_payment_action`.
3. Converted confirmed bank CSV promotion to `ywi_rpc_promote_bank_csv_import`.
4. Converted reconciliation match/split/undo/signoff/reject writes to `ywi_rpc_apply_reconciliation_action`.
5. Converted quote acceptance/work-order conversion to `ywi_rpc_accept_quote_package`.
6. Converted customer deposit preparation and checkout attachment to `ywi_rpc_prepare_deposit_request` and `ywi_rpc_attach_deposit_checkout`.
7. Converted Stripe deposit paid/processing/failed/expired handling to `ywi_rpc_record_portal_deposit_paid` and `ywi_rpc_mark_deposit_checkout_status`.
8. Added role/rank helpers, exact-cent helpers, accounting-period lock checks, balanced-journal checks, explicit RPC grants, and a deployable permission matrix.
9. Added `scripts/operations-rpc-integration-test.mjs` for static RPC wiring checks and optional staging permission-matrix checks.
10. Updated build/cache markers to `2026-06-18a` and schema markers to `151`.
11. Rebuilt `sql/000_full_schema_reference.sql` as the ordered canonical schema from migration 030 through 151.
12. Retired superseded Markdown into `archive/retired-markdown-2026-06-18a/` and removed temporary write-test files from the active root.

## Sanity check result

The repository now uses transactional PostgreSQL RPCs for the highest-risk multi-row write paths. Edge Functions still provide request validation and user-friendly errors, but the database now owns the atomic transaction boundary for accounting, reconciliation, bank promotion, quote conversion, and deposit recording.

## Release blockers

These still need staging/live verification before production use:

1. Apply schema 151 to a staging Supabase database.
2. Deploy the updated `operations-manage`, `customer-portal`, and `stripe-webhook` Edge Functions.
3. Run `node scripts/operations-rpc-integration-test.mjs` with staging credentials.
4. Seed or use staging records for AR invoices/payments, AP bills/payments, bank CSV rows, reconciliation items, quote packages, and Stripe test Checkout sessions.
5. Confirm low-rank users cannot execute protected operations through the app or direct RPC calls.
6. Confirm all failed RPC cases roll back cleanly: locked period, missing proof, bad split total, wrong deposit amount, wrong Stripe currency, duplicate acceptance, duplicate deposit recognition, and repeated reversal.
7. Perform real phone/tablet/desktop browser inspection; static CSS checks are not a substitute for a rendered staging pass.

## Highest-value next work

1. Build seeded staging fixtures for the RPC integration suite so AR, AP, bank, reconciliation, quote, and deposit flows can run end-to-end without hand-created records.
2. Add role-permission UI badges beside each cockpit button so users know why a button is disabled before clicking.
3. Add a reconciliation review screen that shows the RPC’s exact split math and match explanation in plain language.
4. Add Stripe test-mode health cards showing webhook secret status, last received event, and last failed validation reason.
5. Add accountant export packaging after the RPC layer is proven with staging data.
6. Replace the most visible placeholders with approved real workshop, vehicle, product, and before/after photos.
7. Connect Search Console exports and Google Business Profile observations so route-page decisions use real search data.

## Packaging notes

Run before packaging:

```bash
node scripts/operations-rpc-integration-test.mjs
node scripts/repo-smoke-check.mjs
```

A pass without Supabase credentials confirms static wiring and migration readiness. A pass with staging credentials additionally confirms the deployed schema 151 permission matrix is readable.
