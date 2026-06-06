# Known Issues and Gaps

Build: **2026-06-06a**  
Schema: **134**

## Still needs depth

1. Payment adjustment queues are visible, but real payment application tables and write actions still need implementation.
2. Payment reversal, credit, refund, write-off, and overpayment proof workflows still need posting logic and GL mapping.
3. Closed-period payment/reversal blocking is queued, but not yet enforced by Edge write actions.
4. Bank CSV preview/import staging still needs real upload handling and rejected-row review.
5. Reconciliation duplicate, split, and no-match exception queues are visible, but match/split/undo/signoff UI still needs to be built.
6. Equipment scan rollout is queued, but real BarcodeDetector/camera scanning still needs implementation.
7. Equipment accessory templates are queued, but DB template tables and editor screens still need implementation.
8. Return-to-service still needs stronger server-side verifier role, proof, and service-task closeout enforcement.
9. Equipment service costs still need automatic job profitability rollup.
10. Sitemap and robots exist as static baseline assets, but generation should move to approved DB route rows.
11. JSON-LD, image-alt, broken-link, local-proof, mobile-overflow, and component-drift smoke checks still need deeper implementation.
12. Mobile offline conflict resolution is queued, but forms still need retry/keep-local/reload-server/discard choices.
13. Runtime fallback telemetry and drill-result storage still need write screens.
14. HST/GST, payroll remittance, month-end close, and accountant export still need end-to-end proof and lock/reopen controls.

## Recently repaired

- Schema 128 compatibility issue with `source_document`, `target_route_hint`, and `completion_note` remains repaired to use `source_doc`, `route_hint`, and `implementation_notes`.
- Canonical full schema carries the repaired schema 128 path.
- Missing archive snapshot folders are restored so smoke checks do not fail on legacy hygiene checks.
- Active `test_write` files are retired into archive.
- Schema 134 now exposes payment adjustment workflows, reconciliation exception resolution, equipment scan rollout, local SEO content depth, and runtime error-message catalog rows through Admin readiness.
- Admin readiness HTML around the SEO smoke / bank CSV table boundary was corrected to reduce layout drift.

## Next focus

The next strongest pass is to turn schema 134 queues into real write paths: payment application/reversal actions, reconciliation CSV staging and exception resolution, equipment accessory templates, camera scan fallback, generated SEO assets, runtime telemetry, and mobile offline conflict choices.
