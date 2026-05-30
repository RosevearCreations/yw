# Project State

Last refreshed: **2026-05-29a**

- Repo build marker: **2026-05-29a**
- Current schema marker: **123**
- Current focus: equipment withdrawal, arrival verification, return testing, final return verification, exception visibility, and accounting/SEO depth tracking.

## What changed this pass

- Equipment can now track Home Site, Current Site, and Destination Site.
- Checkout records intended destination and checkout safety test details.
- Arrival verification records condition, test status, verifier, notes, and transfer event.
- Return receipt now separates “returned pending review” from final “return verified.”
- Damage or failed/needs-service return tests create return exception status and lockout/service attention.
- Jobs directory returns transfer history, return exceptions, and operational-depth gates for the UI.
- Smoke checks now expect schema 123 and current `2026-05-29a` cache assets.

## Live deployment notes

1. Apply schema 123.
2. Redeploy `jobs-directory` and `jobs-manage`.
3. Clear browser/service-worker cache.
4. Test an equipment item through Save → Check Out → Verify Arrival / Site Test → Return → Mark Return Verified.
5. Confirm exception/history/depth-gate rows display in the Equipment panel.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->
