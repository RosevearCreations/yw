# YWI HSE Safety System

A Supabase-powered safety compliance application for field and site operations.

This system allows teams to submit safety forms, attach evidence images, review submissions, track safety activity, and manage users and sites through an admin interface.

The application is designed to run as a **lightweight static frontend with Supabase providing authentication, database, storage, and backend functions.**

---

# System Overview

The YWI HSE system provides the following capabilities:

- Secure login via **Supabase Magic Link authentication**
- Structured digital safety forms
- Image uploads for inspections and drills
- Submission review and approval workflow
- Logbook lookup and CSV export
- Admin management of users, sites, and assignments
- Email notifications for important events

The architecture keeps the frontend simple while moving all secure logic to **Supabase Edge Functions**.

---

# Technology Stack

Frontend

- HTML
- CSS
- Vanilla JavaScript
- Progressive Web App support

Backend

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Supabase Storage

Deployment

- Static hosting (Vercel / Cloudflare Pages / Netlify)
- Supabase backend

---

# Core System Workflow

1. User signs in using a **magic email login link**
2. User fills out a safety form
3. Submission is stored in the database
4. Optional images are uploaded to storage
5. Supervisors or HSE staff review the submission
6. Review actions update submission status
7. Logbook shows historical safety activity

---

# Supported Safety Forms

The system currently supports five safety form types.

## Toolbox Talk

Used for documenting safety meetings.

Includes

- meeting topic
- discussion notes
- attendee sign-in list

Form code: `E`

---

## PPE Check

Used to verify workers are wearing required protective equipment.

Includes

- worker list
- PPE compliance
- non-compliant flag

Form code: `D`

---

## First Aid Kit Check

Ensures site medical kits are stocked.

Includes

- item checklist
- missing items
- flagged issues

Form code: `B`

---

## Site Inspection

Full site hazard inspection.

Includes

- hazard list
- open hazards count
- inspector details
- approval signature
- image evidence

Form code: `C`

---

## Emergency Drill

Records evacuation or safety drills.

Includes

- drill type
- start and end time
- participants
- evaluation
- follow-up actions
- image evidence

Form code: `A`

---

# Authentication

Authentication uses **Supabase magic link login**.

User flow

1. Enter email
2. Receive login link
3. Click link
4. Supabase session is created

The session token is used by Edge Functions to validate requests.

---

# User Roles

Roles control access to features.

### Worker

- submit forms
- view personal submissions

### Supervisor

- review submissions
- comment on reports

### HSE

- review safety reports
- request follow-up actions

### Admin

- full access
- manage users
- manage sites
- manage assignments

---

# Submission Status Flow

Submissions move through the following status states.


submitted
under_review
approved
follow_up_required
closed


Review actions can move a submission between these states.

---

# Database Structure

Main tables used by the system.

## profiles

Stores application user profiles.

Important fields


id
email
full_name
role
is_active


---

## sites

List of safety sites.

Fields


id
site_code
site_name
address
notes
is_active


---

## site_assignments

Links users to sites.

Fields


id
site_id
profile_id
assignment_role
is_primary


---

## submissions

Main safety form records.

Fields


id
site
form_type
date
submitted_by
submitted_by_profile_id
payload
status
admin_notes
reviewed_by
reviewed_at
created_at


---

## toolbox_attendees

Stores toolbox talk attendance.

Fields


submission_id
name
role


---

## submission_reviews

Tracks review history.

Fields


submission_id
reviewer_id
review_action
review_note
created_at


---

## submission_images

Metadata for uploaded evidence images.

Fields


submission_id
image_type
file_path
file_name
content_type
file_size_bytes
caption
uploaded_by
created_at


---

# Storage

Images are stored in Supabase Storage.

Bucket


submission-images


Typical upload paths


inspection/<submission_id>/<filename>
drill/<submission_id>/<filename>


Image metadata is stored in `submission_images`.

---

# Edge Functions

Edge Functions act as the secure backend API.

Current functions

| Function | Purpose |
|--------|--------|
| resend-email | Submission intake + email routing |
| clever-endpoint | Logbook query endpoint |
| submission-images | Register uploaded image metadata |
| submission-detail | Fetch a submission with reviews/images |
| review-submission | Add review actions and update status |
| admin-directory | Read users/sites/assignments |
| admin-manage | Create/update/delete admin records |

All functions validate JWT tokens and check the user's profile.

---

# Frontend Files


index.html
app.js
style.css
manifest.json
server-worker.js


### index.html

Main application interface and page sections.

### app.js

Application logic including

- authentication
- form submission
- logbook queries
- review workflow
- admin tools
- image upload logic

### style.css

UI layout and styling.

### server-worker.js

PWA caching service worker.

---

# Deployment

Frontend deployment


Vercel
Cloudflare Pages
Netlify


Backend


Supabase project


---

# Setup Instructions

## 1 Install Supabase CLI


npm install -g supabase


---

## 2 Link project


supabase link --project-ref YOUR_PROJECT_ID


---

## 3 Deploy Edge Functions


supabase functions deploy resend-email
supabase functions deploy clever-endpoint
supabase functions deploy submission-images
supabase functions deploy submission-detail
supabase functions deploy review-submission
supabase functions deploy admin-directory
supabase functions deploy admin-manage


---

## 4 Create Storage Bucket

Create bucket


submission-images


Configure appropriate access policies.

---

## 5 Configure Environment Variables

Edge functions require:


SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY


---

## 6 Update Frontend Keys

Set these in `app.js`.


SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY


Never expose the service role key in frontend code.

---

# Testing Checklist

Before production deployment verify

Authentication

- magic link login works
- session persists across reloads

Forms

- toolbox talk submits
- PPE check submits
- first aid check submits
- site inspection submits
- drill submits

Uploads

- images upload successfully
- images appear in submission detail

Review

- reviewers can change status
- review notes appear in history

Admin

- profiles can be edited
- sites can be created
- assignments can be created

Logbook

- filters work
- CSV export works

---

# Security Model

Security rules

- frontend never uses service role keys
- Edge Functions validate user sessions
- role checks performed via `profiles`
- image uploads recorded in database

---

# Future Improvements

Potential enhancements

- dashboard safety metrics
- follow-up reminders
- PDF safety report exports
- offline form submissions
- assignment-based site permissions
- improved admin interface

---

# Documentation

Important repository documentation files


README.md
PROJECT_BRAIN.md
AI_CONTEXT.md
DATABASE_STRUCTURE.md
REPO_BASE.md


These documents allow new developers or AI assistants to understand the system quickly.

---

# License

Internal company use.

---

# Maintainers

YWI HSE Development Team
