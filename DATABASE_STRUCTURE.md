# DATABASE_STRUCTURE.md
# YWI HSE Safety System — Database Structure Reference

This document describes the current database and storage structure expected by the YWI HSE Safety System.

It is intended to help developers, administrators, and AI assistants understand the data model used by the frontend and Supabase backend.

This document should stay aligned with the live schema and current frontend expectations.

---

# Database Platform

Database engine:

**Supabase Postgres**

Related services:

- Supabase Auth
- Supabase Storage
- Supabase Edge Functions

---

# Database Design Goals

The database supports:

- authenticated users
- role-based access
- site-based records
- form submissions
- review workflows
- evidence image tracking
- admin management of users, sites, and assignments

The current model is designed around a flexible `submissions` table with related supporting tables.

---

# Main Tables

Current expected main tables:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

---

# 1. profiles

Purpose:

Stores application-level user profile information tied to Supabase Auth users.

This table is the main source for:

- role
- active state
- display information
- future permission expansion

## Expected relationship

- linked to Supabase Auth user by `id`
- one profile per authenticated user

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | primary key, matches auth user id |
| `email` | text | user email |
| `full_name` | text | display name |
| `role` | text | application role |
| `is_active` | boolean | whether account is active |
| `created_at` | timestamptz | created timestamp |
| `updated_at` | timestamptz | last updated timestamp |

## Current role values

The current project direction uses these role values:

- `worker`
- `staff`
- `onsite_admin`
- `job_admin`
- `site_leader`
- `supervisor`
- `hse`
- `admin`

These values are already reflected in the frontend and should remain stable unless changed intentionally across the full stack.

---

# 2. sites

Purpose:

Stores worksite/location records used by submissions and assignments.

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | primary key |
| `site_code` | text | short site code |
| `site_name` | text | full site name |
| `address` | text | site address |
| `notes` | text | internal notes |
| `is_active` | boolean | active/inactive site |
| `created_at` | timestamptz | created timestamp |
| `updated_at` | timestamptz | last updated timestamp |

## Notes

- `site_code` should be treated as human-friendly
- `site_name` is what most users will recognize
- `is_active` is used by admin UI filtering and management

---

# 3. site_assignments

Purpose:

Links users to sites.

This table is the current basis for future site-based permission expansion.

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | primary key |
| `site_id` | uuid | references `sites.id` |
| `profile_id` | uuid | references `profiles.id` |
| `assignment_role` | text | role for that site assignment |
| `is_primary` | boolean | whether this is the user’s primary site |
| `created_at` | timestamptz | created timestamp |
| `updated_at` | timestamptz | last updated timestamp |

## Notes

- a user may have multiple site assignments
- assignment role may mirror or refine general profile role in future workflows
- admin UI currently supports create/update/delete for these rows

---

# 4. submissions

Purpose:

Stores the main submission records for all safety form types.

This is the core operational table in the system.

## Design approach

Rather than one large table per form type, the current system uses:

- one common `submissions` table
- related detail tables where needed
- structured payload storage for form-specific fields

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid or bigint | primary key |
| `form_type` | text | submission type code |
| `site` | text | site value captured on submission |
| `submission_date` | date | logical date of the form |
| `submitted_by` | text | submitter display text |
| `submitted_by_profile_id` | uuid | optional profile link |
| `payload` | jsonb | form-specific structured data |
| `status` | text | workflow status |
| `admin_notes` | text | internal notes |
| `reviewed_by` | text or uuid | who reviewed latest |
| `reviewed_at` | timestamptz | when latest review occurred |
| `created_at` | timestamptz | created timestamp |
| `updated_at` | timestamptz | updated timestamp |

## Current form type values

These values are already used throughout the project and must stay consistent:

- `A` = Emergency Drill
- `B` = First Aid Kit Check
- `C` = Site Inspection
- `D` = PPE Check
- `E` = Toolbox Talk

## Current status values

Current status values in active use:

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

These status values are used by:

- logbook filters
- detail view
- review panel
- admin/reviewer workflows

---

# 5. toolbox_attendees

Purpose:

Stores the attendee rows for Toolbox Talk submissions.

This table exists because attendee lists are naturally row-based and useful for reporting/searching.

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid or bigint | primary key |
| `submission_id` | uuid or bigint | references `submissions.id` |
| `name` | text | attendee name |
| `role` | text | role on site |
| `company` | text | optional company |
| `created_at` | timestamptz | created timestamp |

## Notes

- primarily used by Toolbox Talk form type `E`
- frontend may still also carry attendee details inside payload depending on function implementation
- if schema and payload both exist, backend should keep them in sync

---

# 6. submission_reviews

Purpose:

Stores review history for submissions.

This provides an audit trail of review actions and comments.

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid or bigint | primary key |
| `submission_id` | uuid or bigint | references `submissions.id` |
| `reviewer_id` | uuid | references `profiles.id` or auth-linked profile |
| `action` | text | review action taken |
| `note` | text | review note |
| `created_at` | timestamptz | created timestamp |

## Current review action values

Current review action values:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

## Notes

- every review action should ideally create one history row
- `submissions.status` holds current state
- `submission_reviews` holds historical changes/comments

---

# 7. submission_images

Purpose:

Stores metadata for uploaded evidence images.

This table tracks what was uploaded, where it lives in storage, and how it is categorized.

## Typical columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid or bigint | primary key |
| `submission_id` | uuid or bigint | references `submissions.id` |
| `file_path` | text | storage path |
| `file_name` | text | original or stored file name |
| `image_type` | text | image category |
| `file_size_bytes` | bigint | file size |
| `content_type` | text | MIME type |
| `caption` | text | user caption |
| `uploaded_by` | uuid | profile/user reference |
| `created_at` | timestamptz | created timestamp |

## Current image type values seen in frontend direction

- `general`
- `hazard`
- `status`
- `repair`
- `other`

These values appear in current forms and should remain aligned with UI options.

---

# Storage

## Bucket

Current bucket:

- `submission-images`

## Typical path conventions

Current frontend/backend direction suggests paths like:

- `inspection/<submission_id>/<filename>`
- `drill/<submission_id>/<filename>`

Other image categories may also be stored in the same bucket depending on current upload implementation.

## Important note

The current frontend uses an Edge Function path named:

- `upload-image`

Older docs may mention a different naming style, but the active frontend work is aligned to `upload-image`.

---

# Relationships Overview

```text
profiles
  └──< site_assignments >── sites

profiles
  └──< submissions (optional submitted_by_profile_id)

submissions
  ├──< toolbox_attendees
  ├──< submission_reviews
  └──< submission_images
