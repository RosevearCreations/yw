# DATABASE_STRUCTURE.md

Current database/storage expectations for YWI HSE.

## Main tables

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

## Current role values expected in docs/frontend

- `worker`
- `staff`
- `onsite_admin`
- `site_leader`
- `supervisor`
- `hse`
- `job_admin`
- `admin`

Important: some SQL files still focus on the narrower backend-enforced set (`worker`, `site_leader`, `supervisor`, `hse`, `admin`). Align backend rules deliberately before enabling broader UI-only roles everywhere.

## Current security helpers direction

SQL helpers are expected to support:

- role rank lookup
- site assignment rank lookup
- submission access checks
- review permission checks
- admin/system role checks

## Storage

Bucket:

- `submission-images`

Current frontend upload helper endpoint:

- `upload-image`
