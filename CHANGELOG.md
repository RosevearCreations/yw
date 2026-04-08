## 2026-04-05d session-integrity and logbook proxy pass
- Hardened session/profile application so stale async profile or boot responses can no longer overwrite a newer authenticated user after screen changes.
- Made logout deterministic by clearing local auth identity first, then completing remote sign-out without letting protected screen reloads rehydrate stale user fragments.
- Added stronger effective-role resolution using profile role, staff tier, and auth metadata so Admin/Supervisor identities are less likely to collapse back to employee semantics when legacy rows still exist.
- Added a same-origin `/api/logbook/review-list` proxy fallback and updated the frontend logbook loader to fall back there when the direct Supabase Edge Function path hits CORS/preflight failure.
- Reduced post-logout protected-fetch noise by ignoring profile/reference-data reload failures when logout or session removal is already in progress.

# Changelog

Last synchronized: April 7, 2026

## April 7, 2026 documentation and direction pass
- Rewrote the Markdown set to reflect the current product direction as a landscaping-led field operations + HSE platform.
- Added a clearer product path for landscaping services, project/construction jobs, and subcontract dispatch work.
- Updated roadmap and gaps/risk documentation to prioritize session integrity, admin backbone completion, database-first shared data, and mobile-first field use.
- Updated database documentation to recommend deeper support for estimates, work orders, routes, materials, costing, and standalone-to-linked HSE records.
- Refreshed deployment, testing, architecture, and runbook documentation so the documentation set is usable again for future build passes.
