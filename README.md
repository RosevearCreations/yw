# YWI application — build 2026-06-18a / schema 151

This repository is now maintained from three active Markdown files only:

1. `README.md` — this pointer and release marker.
2. `docs/ACTIVE_PROJECT_HANDBOOK.md` — current product, architecture, SEO, database, and operations handoff.
3. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — current completion notes, verification, release blockers, and next work.

Older roadmaps, schema notes, and superseded handoff files are preserved under `archive/retired-markdown-2026-06-18a/`. They are historical reference only and must not override the two active documents above.

Current focus: schema 151 moves accounting posting, bank CSV promotion, reconciliation actions, quote acceptance, and portal deposit recording into transactional PostgreSQL RPCs. Edge Functions should collect context, validate the user/session, and then delegate multi-row writes to those RPCs.
