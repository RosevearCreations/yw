# AI Context

Last refreshed: **2026-05-28a**

## Build context

- Latest build/cache marker: **2026-05-28a**
- Latest schema marker: **122**
- Current priority: mobile-first usage, Ontario OHSA-friendly safety wording, staged Admin loads, and production-readiness guardrails.
- Retired root Markdown should stay in `archive/`.

## Important current behavior

- `#today` is the default route.
- `js/mobile-form-helper.js` adds phone step chips and local draft controls to known field forms.
- Local drafts do not restore file inputs; users must reselect photos before final submit.
- Admin should prefer staged scopes and use `scope: all` only as emergency fallback.
- Keep one H1 per exposed page/shell.
