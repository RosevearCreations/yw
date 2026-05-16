# Project State

Last refreshed: **2026-05-16a**

## Current build

- Build label: `2026-05-16a`
- Latest schema: `110`
- Main focus: mobile navigation usability, responsive Admin section navigation, active-document cleanup, schema tracking, and continued production-readiness foundations.

## What is working in this build

- Main mobile navigation is collapsed behind one **Menu** button.
- The Menu button shows the current route and expands into touch-friendly links.
- The Admin section navigation is also collapsed on phones, with a current-section label and expandable section list.
- Desktop navigation remains visible and unchanged.
- Service worker cache version is bumped to `2026-05-16a`.
- Schema 110 records frontend quality gates for mobile navigation, cache version, one-H1, and Markdown readiness.

## Main caution

Apply schema **110** and hard refresh after deployment. Old service-worker cache can make the previous long mobile menu appear even when files are updated.
