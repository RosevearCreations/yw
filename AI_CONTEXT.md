# AI_CONTEXT.md

## Mission for any AI assistant
You are working on a Supabase-backed HSE web app called **YWI HSE**. Your first priority is to preserve working auth, submission intake, review flows, and admin tools. Do not casually refactor working IDs, DOM hooks, function names, storage bucket names, or status values.

## Repo purpose
This repo contains a static frontend plus Supabase backend functions for:
- site safety forms
- image evidence uploads
- review + approval workflows
- logbook search/export
- admin user/site/assignment management

## Frontend architecture
This project is intentionally simple:
- `index.html` contains all app sections on one page
- sections are shown/hidden using hash navigation
- `app.js` contains nearly all logic
- `style.css` handles layout and styling

### Important frontend sections / hashes
- `#toolbox`
- `#ppe`
- `#firstaid`
- `#inspect`
- `#drill`
- `#log`
- `#admin`

### Critical frontend IDs that should not be changed casually
Auth:
- `loginView`
- `loginForm`
- `loginEmail`
- `authInfo`
- `whoami`
- `logoutBtn`

Forms:
- `toolboxForm`, `ppeForm`, `faForm`, `inspForm`, `drForm`
- many JS handlers depend on exact IDs in `app.js`

Logbook / review / detail:
- `lg_*`
- `rv_*`
- `sd_*`

Admin:
- `ad_*`
- `am_*`

## Backend architecture
Supabase Edge Functions are the API layer.

### Current expected functions
- `resend-email`
- `clever-endpoint`
- `submission-images`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`

### Function behavior summary
#### `resend-email`
Secure submission intake.
- Validates JWT
- Validates active profile
- Creates submission
- Seeds initial review entry
- Inserts toolbox attendees when needed
- Sends notification emails when required

#### `clever-endpoint`
Secure list endpoint for logbook.
- Validates JWT
- Returns filtered submissions
- Returns current role
- Supports filters by site, form, date range, status

#### `submission-images`
Accepts image metadata after storage upload.
- Validates JWT
- Validates access to the submission
- Inserts rows into `submission_images`

#### `submission-detail`
Returns one submission plus related review and image history.

#### `review-submission`
Adds review history and can update:
- `status`
- `admin_notes`
- `reviewed_by`
- `reviewed_at`

#### `admin-directory`
Read endpoint for:
- profiles
- sites
- assignments

#### `admin-manage`
Write endpoint for:
- updating profiles
- creating/updating sites
- creating/updating/deleting assignments

## Database model
Main tables expected:
- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

### Important column expectations
#### `profiles`
- `id`
- `email`
- `full_name`
- `role`
- `is_active`

#### `sites`
- `id`
- `site_code`
- `site_name`
- `address`
- `notes`
- `is_active`

#### `site_assignments`
- `id`
- `site_id`
- `profile_id`
- `assignment_role`
- `is_primary`

#### `submissions`
- `id`
- `site`
- `form_type`
- `date`
- `submitted_by`
- `submitted_by_profile_id`
- `payload`
- `status`
- `admin_notes`
- `reviewed_by`
- `reviewed_at`

#### `submission_reviews`
- `id`
- `submission_id`
- `reviewer_id`
- `review_action`
- `review_note`
- `created_at`

#### `submission_images`
- `id`
- `submission_id`
- `image_type`
- `file_name`
- `file_path`
- `file_size_bytes`
- `content_type`
- `caption`
- `uploaded_by`
- `created_at`

## Auth model
- Auth is Supabase magic link
- Frontend uses publishable key, never service role key
- Edge Functions should use Verify JWT ON
- Functions validate user identity with `auth/v1/user`
- Role checks are done using the `profiles` table

## Storage model
Bucket name:
- `submission-images`

Typical upload paths:
- `inspection/<submission_id>/...`
- `drill/<submission_id>/...`

Frontend uploads binary files directly to storage, then records metadata through `submission-images`.

## Status vocabulary
Do not invent new status strings unless the database and UI are updated everywhere.
Current statuses:
- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

## Review action vocabulary
Do not invent new action strings unless the database and UI are updated everywhere.
Current actions:
- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

## Safe working rules for AI
1. Preserve IDs and endpoint names unless explicitly doing a coordinated migration.
2. Preserve payload shapes unless frontend + backend + DB are all updated together.
3. Prefer full-document replacements over fragment edits when this repo is being updated conversationally.
4. When modifying backend logic, keep role checks explicit.
5. When modifying auth, never expose service role credentials to the frontend.
6. When modifying uploads, keep the storage bucket name aligned with the frontend.
7. When fixing logbook/review issues, check both:
   - `clever-endpoint`
   - `review-submission`
   - `submission-detail`
8. When fixing image issues, check both:
   - storage policies
   - `submission-images`
   - frontend upload path generation

## Common failure points
- Wrong Supabase publishable key in frontend
- Verify JWT ON but frontend not sending valid session token
- Missing table columns such as `submitted_by_profile_id` or `status`
- Missing storage bucket or storage policies
- Hash router breaking because auth callback tokens stay in URL hash
- Service worker trying to cache unsupported POST / extension requests

## Best workflow for any new AI chat
1. Read `README.md`
2. Read `docs/PROJECT_BRAIN.md`
3. Read `docs/REPO_BASE.md`
4. Read `docs/DATABASE_STRUCTURE.md`
5. Inspect `index.html`, `app.js`, and the relevant Edge Function(s)
6. Confirm whether the user wants a full-document replacement or patch
7. Make coordinated changes only

## What to suggest next if asked
Strong next improvements:
- selector-based admin tools instead of raw IDs
- dashboard summary cards
- assignment-based site permissions
- PDF export / print package
- reopen/edit flows
- better image gallery and evidence review tools
- automated reminders for follow-up-required submissions


---

## 🔐 Recent Security & System Updates (Auto-Added)

### Authentication
- Supabase Magic Link login implemented
- Session persistence via localStorage
- JWT-based validation in Edge Functions

### Role-Based Access (RBAC)
Supported roles:
- worker
- site_leader
- supervisor
- hse
- admin

### Backend Security
- Edge Functions now validate JWT
- Admin-only endpoints enforced
- `can_access_submission()` used for data protection

### New Features Added
- Image upload system (`upload-image`)
- Submission review system (`review-submission`)
- Admin management endpoint
- Site + Assignment management
- Storage integration for job images

### Recommended Next Steps
- Enable RLS on all tables
- Add audit logging
- Add session timeout
- Add UI role-based visibility

