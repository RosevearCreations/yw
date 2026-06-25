# Next Steps and Sanity Check — build 2026-06-23a / schema 153

## Completed in this pass

1. Physically consolidated the repository to exactly three active Markdown files and preserved historical files under `archive/retired-markdown-2026-06-23a/`.
2. Moved temporary write/test artifacts out of the active root into `archive/retired-test-files-2026-06-23a/`.
3. Rebuilt `sql/000_full_schema_reference.sql` from the ordered 030–153 migrations, including the schema 153 accountant-readiness view compatibility fix.
4. Added the protected `.github/workflows/staging-browser-integration.yml` scaffold. It runs source contracts by default and deployed staging checks only when manually selected in the protected `staging` environment.
5. Reworked the Operations Cockpit from the legacy light card surface into the application’s dark-navy design system.
6. Added explicit high-contrast colours for Cockpit text, labels, details summaries, status/retry notices, buttons, form fields, queues, scorecards, private-media placeholders, reconciliation cards, health cards, release-proof cards, and all status badges.
7. Added visible keyboard focus, dark native control rendering, improved mobile action wrapping, and forced-colors support.
8. Added `scripts/operations-cockpit-contrast-check.mjs`, which validates the required local styling and colour-pair ratios for normal, supporting, muted, success, warning, and error text.
9. Updated cache/build markers to `2026-06-23a`. Database schema remains `153`.

## Current sanity result

The exact Cockpit problem reported—text disappearing against a similarly coloured background—was caused by a light Cockpit surface inheriting the dark application’s light foreground. The revised Cockpit now uses a self-contained dark surface and explicit foreground colours, so it no longer depends on inherited text colour or browser-default button/select rendering.

Static checks prove source wiring, colour-token contrast calculations, documentation archive state, full-schema consistency, syntax, cache markers, and release scaffolding. They cannot prove a deployed Supabase project, Edge Function secret configuration, real RLS/storage behavior, Stripe delivery, or browser-specific rendering. Those remain staging checks.

## Detailed Operations Cockpit visual test

Use these steps after deploying the updated static assets to **staging**. Do this before production.

### A. Open the Cockpit as job admin

1. Sign in with the staging `job_admin` or `admin` account.
2. Open the **Admin** area and scroll to **Operations Cockpit**.
3. Confirm the overall Cockpit background is dark navy, visually consistent with the main admin cards.
4. Confirm the heading, subtitle, Schema badge, graphic-placeholder title, and placeholder help text are clearly readable without selecting text.
5. Expand every Cockpit section at least once. Check that closed summaries and open summaries both remain readable.

### B. Check the text/background states

1. In **role capability**, confirm allowed/restricted pills show readable light text against dark green/gold/rose backgrounds.
2. In a normal queue card, verify title, labels, values, status pill, and action buttons are all readable.
3. Create or use one harmless staging validation failure. Confirm the red error banner has clearly readable text.
4. Trigger a harmless successful refresh. Confirm the green success banner has clearly readable text.
5. Open a record needing review. Confirm yellow/gold warning text remains readable.
6. Check the private-media placeholder. It should say **Private review** clearly and must not look like a broken public image.

### C. Check inputs and keyboard focus

1. Click each input, select, textarea, upload field, checkbox, and button in the Cockpit.
2. Confirm text entered into fields is white/light and readable against the dark input background.
3. Confirm placeholders are visible but visually secondary.
4. Use the `Tab` key through the Cockpit. Every active control needs a visible blue focus outline.
5. Open each select menu. Its choices should use dark backgrounds and light text; no white-on-white or black-on-black text should appear.

### D. Check phone, tablet, and desktop widths

Use browser responsive mode or actual devices:

1. **Phone:** 390 × 844.
2. **Tablet:** 768 × 1024.
3. **Desktop:** 1440 × 960.

At each size:

1. Hard refresh once so build `2026-06-23a` loads rather than a cached CSS file.
2. Confirm no page-wide horizontal scroll appears.
3. Confirm queue cards, release-proof cards, status messages, and forms stay readable.
4. At phone width, confirm Cockpit action buttons stack full width rather than squeezing text together.
5. Confirm the Operations Cockpit graphic placeholder does not cover text or push controls off-screen.
6. With operating-system reduced motion enabled, confirm the Cockpit remains usable without motion-dependent cues.
7. With high-contrast/forced-colours enabled where available, confirm text and focus outlines remain visible.

### E. Record outcome

Record a staging result as **pass** only if all text is readable at all three widths, every keyboard focus target is visible, all select/input text is readable, and no unexpected horizontal scrolling occurs. Capture a screenshot for any failing card and note its browser, screen size, and user role.

## Existing schema 153 staging gate

Before production use, also follow the full schema 153 process:

1. Use a dedicated non-production Supabase project.
2. Apply migrations through `153_release_fixture_policy_mapping_seo_alerts.sql`.
3. Confirm `public.v_schema_drift_status` reports version 153 and `current`.
4. Deploy `operations-manage`, `upload-public-asset`, `stripe-webhook`, `accountant-export`, `customer-portal`, and `public-content`.
5. Use staging-only Supabase service credentials and Stripe test-mode values. Never put them in Git, browser code, public files, or chat messages.
6. Run:

```powershell
node scripts/operations-rpc-integration-test.mjs
node scripts/security-policy-assertions.mjs
node scripts/operations-cockpit-contrast-check.mjs
node scripts/repo-smoke-check.mjs
```

7. Run the disposable `STAGING-` fixture flow and the live staging harness only after its explicit staging interlocks are set.
8. Verify job-admin allow/worker deny, private-media approval, payment posting, bank promotion, one-cent split rejection, quote reuse, verified Stripe webhook payment updates, accountant-package generation, route signal decisioning, and the visual test above.
9. Clean the tracked fixture set after testing.

## Release blockers

Do not move toward production until all are true:

- schema 153 is current in a dedicated staging project;
- changed functions and static front-end are deployed;
- staging-only Stripe keys/webhook secret are configured;
- server-side job-admin allow and worker deny tests pass;
- storage/policy assertion summary passes;
- unapproved review media cannot be fetched publicly;
- duplicate posts, locked periods, invalid exact splits, duplicate quote acceptance, wrong Stripe session/amount/currency, and invalid webhook signatures fail safely;
- accountant/bookkeeper approves chart-of-accounts/tax mapping before use of export data;
- the Cockpit contrast test passes at phone/tablet/desktop widths;
- original approved vehicle/workshop/before-after media replaces visible placeholders before public launch;
- Search Console and Google Business Profile evidence is reviewed by a person before route-priority changes.

## Highest-value next work

1. Deploy the corrected static build and schema 153 to staging, then complete the recorded browser and policy proof.
2. Resolve every live RLS/storage/migration discrepancy found during staging; do not paper over it in client code.
3. Replace the most valuable public placeholders with original, consent-approved before/after/service media, complete descriptive alt text, and publish only approved route records.
4. Have the accountant/bookkeeper approve mapping rules and define the exact month-end close checklist.
5. Load real Search Console/GBP observations by controlled manual import or review process; avoid storing third-party credentials in app tables.
6. After staging proof, add a concise release dashboard for schema status, last backup, RLS assertion status, Stripe endpoint health, latest staging proof, and outstanding visual/SEO content approvals.
