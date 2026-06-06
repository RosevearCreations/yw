# Admin Preflight Registry and Readiness UI

Last refreshed: **2026-06-02b**

## Purpose

Schema 118 and this UI pass make deployment state visible inside Admin instead of leaving it only in Markdown notes.

## What changed

- Admin loads `command_center` first.
- `admin-directory` returns the fast-path scope registry when the deployed function and database are current.
- Admin uses the registry to decide the remaining staged scopes.
- Production Readiness now shows deployment checklist rows.
- Production Readiness now shows function readiness rows.

## Safety behavior

If the registry is missing because schema 118 or the updated `admin-directory` function has not been deployed yet, the UI keeps using the built-in safe staged scope list. If every staged scope fails, the broad `scope: all` fallback still exists.

## Live validation

After deployment, open `#admin` and confirm:

1. Command Center loads first.
2. Scope timing cards populate.
3. Deployment checklist rows appear.
4. Function readiness rows appear.
5. No cached-data warning appears after hard refresh.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->

<!-- 2026-06-02a pass: schema 126 roadmap depth, data migration candidates, SEO/CSS/fallback guardrails, Admin readiness visibility, archive hygiene, cache marker, and Markdown refresh. -->
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->


## Schema 133 pass marker

Reviewed during build **2026-06-05c / schema 133**. Keep this document aligned with the active roadmap and known gaps.
