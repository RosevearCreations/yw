# YWI HSE

YWI HSE is a Supabase-backed safety and compliance web app for site reporting, reviews, and administration.

## What the app currently does

The current application supports:

- Email magic-link sign-in with Supabase Auth
- Daily Toolbox Talk submissions
- PPE Compliance Check submissions
- First Aid Kit daily check submissions
- Site Inspection submissions with required approval signature
- Emergency Drill submissions
- Optional image uploads for inspections and drills
- Offline outbox retry support for failed submissions
- Logbook filtering by site, date, form type, and status
- Submission review workflow with status changes and admin notes
- Submission detail view with review history and images
- Admin directory for users, sites, and assignments
- Admin management tools for profiles, sites, and assignments

## Current repo structure

```text
.
├─ app.js
├─ index.html
├─ manifest.json
├─ server-worker.js
├─ style.css
├─ docs/
│  ├─ REPO_BASE.md
│  └─ DATABASE_STRUCTURE.md
└─ sql/
   └─ 000_full_schema_reference.sql
```

## Frontend files

### `index.html`
Main single-page interface for:

- authentication view
- all submission forms
- logbook
- submission detail panel
- review panel
- admin directory
- admin management

### `app.js`
Client-side application logic for:

- Supabase auth session handling
- Edge Function calls
- offline outbox retries
- dynamic form rows
- image upload flow
- logbook loading
- submission detail loading
- admin management actions

### `style.css`
UI theme, responsive layout, tables, signatures, cards, and form styling.

### `server-worker.js`
Service worker for basic PWA/offline support.

### `manifest.json`
PWA metadata.

## Supabase pieces expected by the app

### Auth
- Magic link email sign-in
- Persisted browser session

### Edge Functions
The current app expects these functions:

- `resend-email`
- `clever-endpoint`
- `submission-images`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `submission-detail`

### Storage
Bucket expected:

- `submission-images`

### Database tables expected

- `profiles`
- `sites`
- `site_assignments`
- `submissions`
- `toolbox_attendees`
- `submission_reviews`
- `submission_images`

See `docs/DATABASE_STRUCTURE.md` and `sql/000_full_schema_reference.sql` for the full structure.

## Required Supabase client values in `app.js`

```js
const SB_URL  = 'https://YOUR_PROJECT.supabase.co';
const SB_KEY  = 'YOUR_PUBLISHABLE_KEY';
```

## Expected server-side secrets

Typical secrets used by the Edge Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` or `SB_ANON_PUBLISHABLE`
- `RESEND_API_KEY`
- `HSE_EMAIL`
- `CHRIS_EMAIL`

## Recommended deployment order

1. Build database tables
2. Create storage bucket and policies
3. Deploy Edge Functions
4. Set function secrets
5. Confirm Supabase Auth magic links work
6. Deploy frontend
7. Test each form end to end
8. Test review workflow
9. Test admin management

## Immediate priorities

1. Confirm every Edge Function is deployed and JWT-protected
2. Confirm database tables match the schema file
3. Confirm storage bucket exists and uploads succeed
4. Confirm the service worker only caches supported requests
5. Add full image viewing/download UX in submission detail
6. Add create-user/admin invitation workflow if needed

## Useful companion docs

- `docs/REPO_BASE.md`
- `docs/DATABASE_STRUCTURE.md`
- `sql/000_full_schema_reference.sql`
