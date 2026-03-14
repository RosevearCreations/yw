# YWI HSE Database Structure

This document describes the database structure expected by the current app and Edge Functions.

## Core tables

### 1. `profiles`

Stores user profile and role information.

Suggested columns:

- `id uuid primary key` — should match Supabase Auth user id
- `email text unique not null`
- `full_name text`
- `role text not null default 'worker'`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Used for:

- role checks
- activity checks
- admin directory
- submission ownership
- review identity

### 2. `sites`

Stores managed site records.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `site_code text unique not null`
- `site_name text not null`
- `address text`
- `notes text`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Used for:

- site lookup
- assignment linkage
- future dropdowns and validation

### 3. `site_assignments`

Joins users to sites.

Suggested columns:

- `id bigserial primary key`
- `site_id uuid not null references sites(id) on delete cascade`
- `profile_id uuid not null references profiles(id) on delete cascade`
- `assignment_role text not null default 'worker'`
- `is_primary boolean not null default false`
- `created_at timestamptz not null default now()`

Used for:

- admin directory
- future site-based access control
- future filtered site pickers

### 4. `submissions`

Main table for all report/form records.

Suggested columns:

- `id bigserial primary key`
- `site text not null`
- `form_type text not null`
- `date date not null`
- `submitted_by text`
- `submitted_by_profile_id uuid references profiles(id) on delete set null`
- `status text not null default 'submitted'`
- `admin_notes text`
- `reviewed_by uuid references profiles(id) on delete set null`
- `reviewed_at timestamptz`
- `payload jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Used for:

- all five forms
- logbook
- review workflow
- detail view

Recommended valid `status` values:

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

### 5. `toolbox_attendees`

Stores expanded attendee rows for Toolbox Talk entries.

Suggested columns:

- `id bigserial primary key`
- `submission_id bigint not null references submissions(id) on delete cascade`
- `name text not null`
- `role_on_site text`
- `signature_png_base64 text`
- `created_at timestamptz not null default now()`

Used for:

- normalized toolbox attendee list

### 6. `submission_reviews`

Stores review history and audit trail.

Suggested columns:

- `id bigserial primary key`
- `submission_id bigint not null references submissions(id) on delete cascade`
- `reviewer_id uuid references profiles(id) on delete set null`
- `review_action text not null`
- `review_note text`
- `created_at timestamptz not null default now()`

Recommended valid `review_action` values:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

Used for:

- review history table
- audit trail

### 7. `submission_images`

Stores metadata for files uploaded to Supabase Storage.

Suggested columns:

- `id bigserial primary key`
- `submission_id bigint not null references submissions(id) on delete cascade`
- `image_type text not null default 'status'`
- `file_name text not null`
- `file_path text not null`
- `file_size_bytes bigint`
- `content_type text`
- `caption text`
- `uploaded_by uuid references profiles(id) on delete set null`
- `created_at timestamptz not null default now()`

Recommended valid `image_type` values:

- `hazard`
- `status`
- `repair`
- `other`

Used for:

- submission detail image panel
- proof/status photos

## Storage

### Bucket: `submission-images`

Expected storage bucket:

- bucket id: `submission-images`
- private preferred
- max 10 MB per file recommended
- image mime types only recommended

Current app upload patterns:

- `inspection/<submission_id>/<generated-file>`
- `drill/<submission_id>/<generated-file>`

## Relationships overview

```text
profiles 1---* submissions
profiles 1---* submission_reviews
profiles 1---* submission_images
profiles 1---* site_assignments

sites    1---* site_assignments

submissions 1---* toolbox_attendees
submissions 1---* submission_reviews
submissions 1---* submission_images
```

## Role model

Suggested app roles:

- `worker`
- `supervisor`
- `hse`
- `admin`

### Typical access pattern

#### worker
- create own submissions
- view own submissions
- attach images to own submissions

#### supervisor
- view broader operational submissions
- review/update statuses
- manage some assignments if desired

#### hse
- review all safety content
- approve/follow-up/close submissions
- see images and detail records

#### admin
- full access
- manage profiles, sites, assignments

## Index recommendations

Recommended indexes:

- `submissions(status)`
- `submissions(site, date desc)`
- `submissions(form_type, date desc)`
- `submissions(submitted_by_profile_id)`
- `submission_reviews(submission_id)`
- `submission_reviews(reviewer_id)`
- `submission_images(submission_id)`
- `submission_images(uploaded_by)`
- `site_assignments(site_id)`
- `site_assignments(profile_id)`

## Notes on design choices

### Why `payload jsonb` exists
Each form type has different fields, so a shared `payload` keeps the frontend flexible while still allowing a unified submission table.

### Why separate review and image tables exist
They support one-to-many relationships cleanly:

- one submission can have many reviews
- one submission can have many images

### Why `submitted_by_profile_id` matters
It gives a reliable ownership link for security. Free-text names alone are not enough for access control.

## Files in repo related to database

- `sql/000_full_schema_reference.sql`
- this document: `docs/DATABASE_STRUCTURE.md`

## Minimum viable database for current app

At minimum, the app needs these working pieces:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`
- storage bucket `submission-images`

Without those, the current frontend will not be fully functional.
