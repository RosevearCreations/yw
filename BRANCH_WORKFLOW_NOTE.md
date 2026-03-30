> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.
# Rosie Dazzlers — Branch Workflow Note

This document explains how branch usage should be treated during active Rosie Dazzlers development.

---

## Source of truth rule

For current active development work, use:

- `dev`

Do not assume:

- `main`

is current.

`main` may be behind while active work continues on `dev`.

---

## Practical meaning

When reviewing or updating the project:

- read files from `dev`
- compare new work to `dev`
- update docs based on `dev`
- treat `dev` as the current working branch unless explicitly told otherwise

---

## Why this matters

The project has been evolving quickly in areas like:

- admin/detailer APIs
- role-aware access patterns
- jobsite workflows
- time tracking
- customer/staff/promo admin
- token-based progress

If someone checks `main` first, they may get an outdated picture of the project.

---

## Recommended workflow

### During active build phase
- make changes against `dev`
- test against `dev`
- update docs against `dev`

### When stabilizing
- review `dev`
- confirm docs/code match
- merge or promote to `main` only when ready

---

## Documentation rule

When docs are refreshed, they should describe the branch that is actually being developed.

Right now, that means:
- `README.md`
- `PROJECT_BRAIN.md`
- `DEVELOPMENT_ROADMAP.md`
- `REPO_GUIDE.md`
- `SANITY_CHECK.md`
- related supporting docs

should reflect the state of `dev`, not an older `main`.

---

## Future session rule

If a future AI/dev session starts and there is any doubt:

1. check which branch is current
2. default to `dev` for active Rosie Dazzlers work unless told otherwise

---

## One-line takeaway

For Rosie Dazzlers active development, **`dev` is the working source of truth and `main` should not be assumed current**.

## Current migration note

The dev branch now expects the newer client/staff profile migration file as part of the active auth rollout:
- `sql/2026-03-21_customer_auth_and_profile_fields.sql`


## Current snapshot — March 21, 2026

Latest pass completed:
- fixed booking add-on checkbox/text layout pressure
- improved service/package image fallback with extra photo cards
- expanded staff management toward richer Admin/Detailer profile editing
- added customer tier discount support in the UI/data model direction
- added/confirmed garage, gift, and redemption visibility in client/admin screens
- added current SQL for tier discounts and richer staff/customer fields

Current next priorities:
- picture-first observation interface
- richer client/detailer threaded comments UI
- manual scheduling / app-management rules UI completion
- final layout polish across booking and internal screens
