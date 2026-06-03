# Admin Split Scopes and Confirmation Guardrails

Last refreshed: **2026-06-02a**

## What changed

Admin loading now uses smaller panel scopes so a slow accounting or evidence query does not make the entire Admin screen fall back to cached data.

Initial staged scopes:

- Command Center
- Health
- People
- Operations
- Accounting Close
- Banking
- Tax/Payroll
- Evidence

## Why it matters

The Admin app had grown into a large live payload. Smaller scopes make the app feel more like a real production application: faster first paint, clearer retry buttons, and better mobile reliability.

## Confirmation guardrails

The frontend now asks before status-changing actions such as job complete/cancel, close step complete/reopen, health resolve, deployment gate updates, and evidence follow-up creation.

## Remaining work

- Render DB-backed deployment checklist rows.
- Add role-aware disabled states.
- Add retry/backoff behavior for repeatedly failing panels.
- Retire broad fallback scopes after live testing.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
