# PROJECT_BRAIN.md

## What this project is
YWI HSE is a Supabase-backed safety/compliance web app for field and site use. It supports authenticated staff, structured daily forms, review workflows, image evidence, logbook lookup, and admin management.

## Primary stack
- Frontend: static HTML + CSS + vanilla JavaScript
- Auth: Supabase magic-link auth
- Backend: Supabase Edge Functions (Deno + supabase-js)
- Database: Postgres in Supabase
- File storage: Supabase Storage bucket `submission-images`

## Core user flows
1. User signs in with magic link.
2. User submits one of five forms:
   - E = Toolbox Talk
   - D = PPE Check
   - B = First Aid Kit
   - C = Site Inspection
   - A = Emergency Drill
3. Submission is written to `public.submissions` with default status `submitted`.
4. Some forms trigger email notification rules.
5. Inspection and drill submissions can attach images.
6. Reviewers load the logbook, inspect submissions, and update status / notes.
7. Admin users manage profiles, sites, and assignments.

## Current frontend files
- `index.html` → main app shell and all page sections
- `app.js` → auth, form logic, logbook, admin tools, submission detail, uploads
- `style.css` → layout/theme/presentation
- `server-worker.js` → service worker
- `manifest.json` → PWA metadata

## Current Edge Functions
- `resend-email` → secure submission intake + email routing
- `clever-endpoint` → secure logbook list endpoint
- `submission-images` → attach uploaded image metadata to a submission
- `submission-detail` → fetch one submission with review/image detail
- `review-submission` → write review actions, status, and admin notes
- `admin-directory` → list users / sites / assignments
- `admin-manage` → create/update/delete profiles/sites/assignments

## Main database tables
- `profiles` → app user profile, role, active flag
- `sites` → sites that forms can reference
- `site_assignments` → links users to sites
- `submissions` → main form records
- `toolbox_attendees` → toolbox sign-in rows
- `submission_reviews` → review history trail
- `submission_images` → image metadata linked to submissions

## Roles
- `worker`
- `supervisor`
- `hse`
- `admin`

## Submission statuses
- `submitted`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`

## Form payload conventions
### Form E — Toolbox Talk
Payload normally includes:
- `site`
- `date`
- `submitted_by`
- `topic_notes`
- `attendees[]`

### Form D — PPE Check
Payload normally includes:
- `site`
- `date`
- `checked_by`
- `roster[]`
- `nonCompliant`

### Form B — First Aid Kit
Payload normally includes:
- `site`
- `date`
- `checked_by`
- `items[]`
- `flagged`

### Form C — Site Inspection
Payload normally includes:
- `site`
- `date`
- `inspector`
- `roster[]`
- `hazards[]`
- `openHazards`
- `approver_name`
- `approver_signature_png`

### Form A — Emergency Drill
Payload normally includes:
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

## Security model right now
- Frontend uses Supabase auth session.
- Edge Functions are expected to run with Verify JWT ON.
- Functions validate the JWT by calling `auth/v1/user`.
- Functions then load `profiles` and enforce role/active checks.
- Service role key is used only inside Edge Functions.

## Storage model right now
- Bucket: `submission-images`
- Upload paths look like:
  - `inspection/<submission_id>/<file>`
  - `drill/<submission_id>/<file>`
- Metadata is stored in `submission_images`

## What is already working conceptually
- Authenticated access
- Submission intake
- Dynamic form rows
- Signature capture
- Image uploads
- Logbook filters
- Review workflow
- Submission detail viewer
- Admin directory
- Admin management

## Must-check deployment items
- All Edge Functions deployed and current
- Bucket exists and storage policies are active
- SQL migrations are applied
- Frontend points to the correct Supabase project URL and publishable key
- Service worker is not caching unsupported requests

## Known implementation assumptions
- `profiles.id` matches Supabase auth user id
- `submissions.submitted_by_profile_id` exists
- `submission_reviews` and `submission_images` exist
- `submissions.status` exists with expected values

## Best next actions in a new chat
1. Verify deployed functions against repo versions.
2. Verify SQL schema against `sql/000_full_schema_reference.sql` and later migration files.
3. Run end-to-end tests:
   - submit each form
   - upload images
   - review submission
   - inspect detail
   - manage users/sites/assignments
4. Improve admin UI by replacing raw ID entry with selector dropdowns.
5. Add dashboards and assignment-based access restrictions.


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

