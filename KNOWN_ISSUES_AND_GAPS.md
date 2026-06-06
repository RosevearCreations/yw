# Known Issues and Gaps

Build: **2026-06-05c**  
Schema: **133**

## Still needs depth

1. Payment write-path queues are visible, but real payment application tables and write actions still need implementation.
2. Payment reversal, credit, refund, write-off, and overpayment proof workflows still need posting logic.
3. Bank CSV preview/import staging still needs a real upload and rejected-row review screen.
4. Reconciliation scoring rows are planned, but match/split/undo/signoff UI still needs to be built.
5. Equipment accessory templates are queued, but real DB template tables and editor screens still need implementation.
6. Camera QR/barcode scanning still needs BarcodeDetector support with manual fallback and mismatch handling.
7. Return-to-service still needs stronger server-side verifier role and proof enforcement.
8. Equipment service costs still need automatic job profitability rollup.
9. Sitemap and robots exist as static baseline assets, but generation should move to approved DB route rows.
10. JSON-LD, image-alt, broken-link, local-proof, mobile-overflow, and component-drift smoke checks still need deeper implementation.
11. Mobile offline conflict resolution is queued, but forms still need retry/keep-local/discard choices.
12. Runtime fallback telemetry and drill result storage still need write screens.
13. HST/GST, payroll remittance, month-end close, and accountant export still need end-to-end proof and lock/reopen controls.

## Recently repaired

- Schema 128 compatibility issue with `source_document`, `target_route_hint`, and `completion_note` remains repaired to use `source_doc`, `route_hint`, and `implementation_notes`.
- Canonical full schema carries the repaired schema 128 path.
- Missing archive snapshot folders are restored so smoke checks do not fail on legacy hygiene checks.
- Active `test_write` files are retired into archive.
- Schema 133 now exposes payment write path, reconciliation scoring, equipment accessory templates, SEO generation, and offline conflict handling through Admin readiness queues.

## Next focus

The next strongest pass is to turn schema 133 queues into real write paths: payment application tables/actions, reconciliation CSV staging and scoring, equipment accessory templates, camera scan fallback, generated SEO assets, and mobile offline conflict choices.
