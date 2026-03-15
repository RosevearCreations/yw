# DATABASE_STRUCTURE.md
# YWI HSE Safety System Database Structure

This document describes the database structure used by the YWI HSE Safety System.

It is intended to help developers, administrators, and AI assistants understand the purpose of each table, the expected columns, and how records relate to one another.

---

## Overview

The database is built around a central submission model.

Core ideas:

- users authenticate with Supabase Auth
- app-specific user data is stored in `profiles`
- safety forms are stored in `submissions`
- reviews are stored in `submission_reviews`
- uploaded image metadata is stored in `submission_images`
- sites and assignments support access management

---

## Core Tables

The current system uses these primary tables:

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

---

## Table: profiles

Purpose:

Stores application user profile information and role assignments.

This table is expected to map to Supabase Auth users by `id`.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key, matches Supabase Auth user id |
| `email` | text | User email address |
| `full_name` | text | User display or full name |
| `role` | text | App role |
| `is_active` | boolean | Whether the user is active |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time |

### Expected role values

- `worker`
- `supervisor`
- `hse`
- `admin`

---

## Table: sites

Purpose:

Stores safety site records.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `site_code` | text | Short site code |
| `site_name` | text | Full site name |
| `address` | text | Site address |
| `notes` | text | Internal notes |
| `is_active` | boolean | Whether the site is active |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time |

---

## Table: site_assignments

Purpose:

Connects users to sites.

This allows future access control by site assignment.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `site_id` | bigint | References `sites.id` |
| `profile_id` | uuid | References `profiles.id` |
| `assignment_role` | text | Role at that site |
| `is_primary` | boolean | Primary site assignment flag |
| `created_at` | timestamptz | Row creation time |

### Expected assignment role values

- `worker`
- `supervisor`
- `hse`
- `admin`

---

## Table: submissions

Purpose:

Stores all submitted safety forms.

This is the central table of the entire system.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `site` | text | Site identifier/name used at submission time |
| `form_type` | text | Form code |
| `date` | date or text | Submission date |
| `submitted_by` | text | Human-entered submitter name |
| `submitted_by_profile_id` | uuid | References `profiles.id` |
| `payload` | jsonb | Full form payload |
| `status` | text | Current submission status |
| `admin_notes` | text | Internal admin notes |
| `reviewed_by` | uuid | References `profiles.id` |
| `reviewed_at` | timestamptz | Last review timestamp |
| `created_at` | timestamptz | Row creation time |

### Expected form types

- `A` = Emergency Drill
- `B` = First Aid Kit Check
- `C` = Site Inspection
- `D` = PPE Check
- `E` = Toolbox Talk

### Expected status values

- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

---

## Table: toolbox_attendees

Purpose:

Stores attendance rows for Toolbox Talk submissions.

This separates attendee rows from the main submission payload for easier reporting if needed.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `submission_id` | bigint | References `submissions.id` |
| `name` | text | Attendee name |
| `role_on_site` | text | Worker role on site |
| `signature_png_base64` | text | Optional signature image data |
| `created_at` | timestamptz | Row creation time |

---

## Table: submission_reviews

Purpose:

Stores the review history for each submission.

Each row is one review event.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `submission_id` | bigint | References `submissions.id` |
| `reviewer_id` | uuid | References `profiles.id` |
| `review_action` | text | Review action taken |
| `review_note` | text | Optional note |
| `created_at` | timestamptz | Review timestamp |

### Expected review action values

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

---

## Table: submission_images

Purpose:

Stores metadata for uploaded images linked to a submission.

The actual files live in Supabase Storage.

### Expected columns

| Column | Type | Purpose |
|---|---|---|
| `id` | bigserial or bigint | Primary key |
| `submission_id` | bigint | References `submissions.id` |
| `image_type` | text | Type/category of image |
| `file_name` | text | Original file name |
| `file_path` | text | Storage path in bucket |
| `file_size_bytes` | bigint | File size |
| `content_type` | text | MIME type |
| `caption` | text | Optional caption |
| `uploaded_by` | uuid | References `profiles.id` |
| `created_at` | timestamptz | Upload record time |

### Expected image type values

- `hazard`
- `status`
- `repair`
- `other`

---

## Relationships

### profiles → submissions

- `submissions.submitted_by_profile_id` references `profiles.id`
- `submissions.reviewed_by` references `profiles.id`

### profiles → submission_reviews

- `submission_reviews.reviewer_id` references `profiles.id`

### profiles → submission_images

- `submission_images.uploaded_by` references `profiles.id`

### sites → site_assignments

- `site_assignments.site_id` references `sites.id`

### profiles → site_assignments

- `site_assignments.profile_id` references `profiles.id`

### submissions → toolbox_attendees

- `toolbox_attendees.submission_id` references `submissions.id`

### submissions → submission_reviews

- `submission_reviews.submission_id` references `submissions.id`

### submissions → submission_images

- `submission_images.submission_id` references `submissions.id`

---

## Storage Structure

The database stores only image metadata.

Image files are stored in Supabase Storage bucket:

`submission-images`

Typical paths:

- `inspection/<submission_id>/<filename>`
- `drill/<submission_id>/<filename>`

The `file_path` column in `submission_images` should match the path stored in the bucket.

---

## Submission Payload Notes

The `payload` column in `submissions` stores full JSON data for each form.

### Form E — Toolbox Talk

Usually contains:

- `site`
- `date`
- `submitted_by`
- `topic_notes`
- `attendees[]`

### Form D — PPE Check

Usually contains:

- `site`
- `date`
- `checked_by`
- `roster[]`
- `nonCompliant`

### Form B — First Aid Kit Check

Usually contains:

- `site`
- `date`
- `checked_by`
- `items[]`
- `flagged`

### Form C — Site Inspection

Usually contains:

- `site`
- `date`
- `inspector`
- `roster[]`
- `hazards[]`
- `openHazards`
- `approved`
- `approver_name`
- `approver_signature_png`

### Form A — Emergency Drill

Usually contains:

- `site`
- `date`
- `supervisor`
- `drill_type`
- `start_time`
- `end_time`
- `scenario_notes`
- `participants[]`
- `evaluation`
- `follow_up_actions`
- `next_drill_date`
- `issues`

---

## Recommended Indexes

Recommended indexes for performance:

### submissions

- index on `status`
- index on `(site, date desc)`
- index on `(form_type, date desc)`
- index on `submitted_by_profile_id`

### submission_reviews

- index on `submission_id`
- index on `reviewer_id`
- index on `created_at desc`

### submission_images

- index on `submission_id`
- index on `uploaded_by`
- index on `created_at desc`

### site_assignments

- index on `site_id`
- index on `profile_id`

---

## Row Level Security Notes

The current architecture expects secure logic to be enforced mostly inside Edge Functions using the service role.

However, if direct table reads are later needed from the frontend, RLS should be applied carefully.

Recommended pattern:

- workers can view only their own related submissions
- supervisors, hse, and admin can view broader records
- admin can manage profiles, sites, and assignments

---

## Operational Assumptions

The current system assumes:

- `profiles.id` matches the authenticated Supabase user id
- `submitted_by_profile_id` is populated on submissions
- image records are linked only after successful storage upload
- review history is append-only
- status changes are controlled by review actions

---

## Schema Change Rules

When changing schema:

1. update SQL migration files
2. update this document
3. update Edge Functions
4. update frontend code if field names changed
5. update README and AI context files if architecture changed

---

## Maintainers

YWI HSE Development Team

---

End of Database Structure Document
