# Schema 145 Sanity Check and Value-Added Breakdown

Build: **2026-06-13a**  
Schema: **145**

## Executive sanity check

The application has moved from a simple HSE form shell into a broad operations platform. It now contains a desktop website/admin surface, a mobile field-app surface, Supabase-backed schema migrations, Admin readiness queues, PWA/offline shell support, safety forms, job/equipment/accounting/reporting modules, and repeated smoke checks for one H1, CSS drift, cache markers, schema markers, Admin view wiring, sitemap, robots, and public visual strips.

The strongest current value is not adding more passive tracking queues. The strongest value is turning the most important queues into working actions:

1. Payment application, reversal, refund, write-off, overpayment, proof, and closed-period controls.
2. Bank CSV import preview, match scoring, split matching, undo, exception export, and accountant closeout package.
3. Equipment checkout, site-arrival, return, return-to-service, accessory checks, camera/QR scanning, service tasks, and cost recovery.
4. Local SEO route registry with proof-backed service pages, one clear H1, clean title/meta, internal links, and conversion CTAs.
5. Approved visual asset registry with image proof, alt text, compression, consent/permission, route assignment, and fallback copy.
6. Runtime fallback event logging so offline conflicts, optional-view misses, stale cache, failed uploads, and blocked accounting actions become measurable.

## Current application state

### Strong foundations already in place

- Desktop website shell exists with public SEO baseline, PWA manifest, service worker, public proof strips, and one H1 on the exposed page.
- Mobile navigation and field-app modules exist for Today actions, safety forms, incidents, inspections, drills, PPE, first aid, jobs, equipment, profile, reports, and admin access.
- Admin has a large readiness/workbench surface with many schema-backed queues and safe optional-view loading patterns.
- SQL schema history is deep and now reaches schema 145, with the repaired schema 140 and 141 paths preserved in the canonical full schema reference.
- Runtime fallback thinking is present in several layers: cached Admin data, safe optional DB view fallbacks, service worker install fallback, offline banner, local drafts, and runtime config fallback.
- SEO hygiene is improving: one-H1 guardrail, sitemap/robots baseline, cache-marker checks, local wording discipline, and controlled visual/proof strips.
- CSS drift is actively checked with brace-balance smoke checks and responsive sections for desktop/mobile visual proof.

### Main weakness

The app has many excellent queues and readiness tables, but several are still passive. Production value now depends on connecting the highest-value rows to real write paths, reviewer decisions, proof uploads, exports, and locked audit trails.

## Production-readiness breakdown

### Desktop website/admin surface

Current state: strong for monitoring, readiness, schema health, and future management workflows.  
Needs: fewer raw tables and more guided actions, summary scorecards, filters, action buttons, proof upload controls, and export packages.

Best next value:

1. Admin deploy checklist that shows schema order, function redeploy order, cache clear, and smoke status.
2. Accounting close dashboard with blockers, proofs, unapplied cash, bank exceptions, HST/GST status, payroll remittance status, and accountant export readiness.
3. Equipment accountability dashboard with checkout/arrival/return/service/cost timeline.
4. SEO/visual approval dashboard with route proof, visual asset approval, alt text, image weight, and publish status.

### Mobile field-app surface

Current state: strong navigation and form foundations with offline/PWA direction.  
Needs: conflict-resolution cards, QR/camera equipment scanning, job proof uploads, supervisor approvals, and fast Today-action workflows.

Best next value:

1. Offline conflict actions: Retry sync, Keep local, Reload server, Discard local after confirmation.
2. Equipment QR/barcode scan plus manual-code fallback.
3. Mobile job proof bundle: arrival, photo, notes, equipment, completion, and signature.
4. Mobile safety reminders tied to Today actions and job/site context.

### Accounting and reconciliation

Current state: strong schema and queue design.  
Needs: real posting actions, proof attachment, period lock/reopen, bank CSV import, match scoring, split matching, undo, and accountant export.

Best next value:

1. Payment apply/reverse/refund/write-off/overpayment actions.
2. Bank CSV preview and rejected-row handling.
3. Match/split/undo/reviewer signoff workflow.
4. Close package with unresolved exception export.

### Equipment and job operations

Current state: equipment and job flows are well represented in schema and UI direction.  
Needs: real custody actions, accessory template editor, verifier role enforcement, service task closure, and cost rollups.

Best next value:

1. Equipment custody timeline.
2. Accessory template registry by equipment type.
3. Camera/QR scanning and manual fallback.
4. Automatic service task and cost recovery path for failed return checks.

### SEO and public trust

Current state: homepage shell has clean one-H1 structure, sitemap/robots baseline, local wording, and professional proof strips.  
Needs: proof-backed service pages, internal links, route registry, JSON-LD checks, image alt/compression checks, and conversion CTA validation.

Best next value:

1. Approved public route registry.
2. Service-area proof checklist before sitemap inclusion.
3. Trust FAQ and internal links that help visitors choose a service or request a quote.
4. Visual proof gallery after asset approval and alt/compression checks.

### Visual polish and professional sharpness

Current state: CSS-only visual strips improve professionalism without image dependency.  
Needs: approved image pipeline, visual registry, motion guardrails, contrast checks, scorecards, and route-specific proof visuals.

Best next value:

1. Approved job-photo gallery cards.
2. Subtle button/card/status micro-interactions with reduced-motion support.
3. Admin dashboard scorecards and progress rails.
4. Route-specific trust visuals and proof blocks.

## Value-added modifications to continue adding

1. Public quote/contact intake path with service choice and local proof.
2. Customer-facing service pages only after proof and route registry approval.
3. Admin action buttons for the top accounting and equipment queues.
4. Mobile equipment scan workflow.
5. Visual asset approval workflow.
6. Runtime fallback event logging.
7. Accountant export package and month-end lock/reopen controls.
8. Mobile offline conflict cards.
9. Admin dashboard scorecards and progress rails.
10. Local SEO smoke checks for title/meta/H1/internal links/CTA/image alt/route proof.

## Schema 145 added

Schema 145 adds Admin-visible tracking queues for:

- Sanity-check snapshot.
- Value-added modification priorities.
- Desktop/mobile value gaps.
- Visual professional backlog.
- Local-search value items.
- Source-of-truth migration value items.

These tables intentionally separate **what exists**, **what adds business value**, and **what should be built next**.
