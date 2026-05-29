# System Architecture

Last refreshed: **2026-05-28a**

## Current architecture direction

- Phone-first app shell with `#today` as the default entry point.
- Reusable mobile helpers layered on top of existing form modules instead of replacing stable submit flows.
- Offline outbox remains responsible for queued submissions/actions.
- Local draft helper is separate from the outbox and stores draft field values on the current device only.
- Admin loads through staged Edge Function scopes before the emergency broad fallback.
- Schema readiness and quality-gate tables document production expectations without forcing risky live-table changes.

## New mobile helper

`js/mobile-form-helper.js` watches for known field forms, adds step chips, and provides Save/Resume/Clear draft controls. It does not change the submit payload; existing form modules still own collection, upload, and outbox behavior.
