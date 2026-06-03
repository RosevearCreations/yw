# Mobile Form Steppers and Drafts

Last refreshed: **2026-06-02a**

## Purpose

The common field forms were becoming long scrolling pages on phones. This pass adds a reusable helper that makes them feel more like a mobile app without rewriting the existing submit/outbox logic.

## Added files and behavior

- `js/mobile-form-helper.js`
- Mobile guide cards above each known form
- Step chips for Basics, Details, Photos, Submit, and form-specific middle steps
- Back/Next buttons for phone use
- Save Draft, Resume Draft, and Clear buttons
- Local-device draft storage with Today dashboard draft counts

## Forms covered

- Toolbox Talk
- PPE Check
- First Aid Kit
- Incident / Near Miss
- Site Inspection
- Emergency Drill

## Important limitation

Browsers do not allow JavaScript to restore file input values. Draft text/select/checkbox values can be resumed, but users must reselect image files before final submit.

## Schema support

Schema **122** adds quality-gate metadata only. It does not alter live submission tables.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
