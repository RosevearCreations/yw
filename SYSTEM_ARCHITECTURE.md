# SYSTEM_ARCHITECTURE.md

System architecture documentation for the **YWI HSE Safety Application**

This document explains how the frontend, Supabase backend, database, storage, and Edge Functions work together.

It is written to help developers, administrators, and AI assistants quickly understand the system.

---

# System Overview

The YWI HSE application is a **static frontend safety system backed by Supabase services**.

The architecture separates responsibilities clearly:

Frontend  
Handles user interaction and form entry.

Supabase Auth  
Handles authentication and session management.

Edge Functions  
Handle secure backend logic and validation.

Postgres Database  
Stores safety records and system data.

Supabase Storage  
Stores uploaded inspection and drill images.

---

# High-Level Architecture


User Browser
│
│
▼
Frontend Application
(index.html + app.js)
│
│
├──────────────► Supabase Auth
│ │
│ ▼
│ User Session JWT
│
│
▼
Edge Functions API
(resend-email, clever-endpoint, etc)
│
│
▼
Postgres Database
(submissions, profiles, sites, reviews)
│
│
▼
Supabase Storage
(submission-images bucket)


---

# Frontend Architecture

The frontend is intentionally simple and lightweight.

Files


index.html
app.js
style.css
manifest.json
server-worker.js


### index.html

Contains all application sections.

Sections are shown or hidden based on navigation hash values.

Example sections


#toolbox
#ppe
#firstaid
#inspect
#drill
#log
#admin


---

### app.js

Handles almost all application logic.

Responsibilities include

Authentication

- login via magic link
- session detection
- logout

Forms

- toolbox talk
- PPE check
- first aid check
- site inspection
- emergency drill

Logbook

- search filters
- CSV export

Review workflow

- submission detail viewer
- status updates
- review notes

Admin tools

- manage users
- manage sites
- manage assignments

Image uploads

- inspection photos
- drill photos

---

### style.css

Provides layout and styling.

Includes

- form layout
- table styling
- responsive UI
- dark theme support

---

### server-worker.js

Provides Progressive Web App caching.

Caches static resources.

Should **not cache POST requests or Edge Function calls**.

---

# Authentication Flow

The system uses **Supabase Magic Link authentication**.

### Login Process

1 User enters email address

2 Frontend calls Supabase Auth

3 Supabase sends login link

4 User clicks email link

5 Supabase creates a session

6 Session token is stored locally

---

### Authentication Diagram


User
│
│ enter email
▼
Frontend
│
│ request login
▼
Supabase Auth
│
│ email magic link
▼
User Email
│
│ click link
▼
Supabase Session Created
│
│ JWT returned
▼
Frontend stores session


---

# Backend Architecture

The backend is implemented using **Supabase Edge Functions**.

These functions act as the secure API layer.

All critical operations run through these functions.

---

# Edge Functions

## resend-email

Purpose

Handles form submissions.

Responsibilities

- validate authenticated user
- validate profile role
- insert submission record
- insert toolbox attendees
- send email notifications

---

## clever-endpoint

Purpose

Logbook query endpoint.

Responsibilities

- validate JWT
- filter submissions
- return logbook results
- return current user role

---

## submission-images

Purpose

Registers uploaded image metadata.

Responsibilities

- validate authenticated user
- confirm submission exists
- record uploaded image path
- store metadata

---

## submission-detail

Purpose

Returns a full submission record.

Responsibilities

- return submission payload
- return review history
- return image attachments

---

## review-submission

Purpose

Handles submission review.

Responsibilities

- add review history record
- update submission status
- update admin notes
- record reviewer

---

## admin-directory

Purpose

Admin lookup endpoint.

Returns

- profiles
- sites
- assignments

---

## admin-manage

Purpose

Admin write endpoint.

Allows

- create or edit profiles
- create or edit sites
- manage site assignments

---

# Database Architecture

The database stores structured safety information.

---

## profiles

Application user accounts.

Fields


id
email
full_name
role
is_active
created_at


---

## sites

Safety locations.

Fields


id
site_code
site_name
address
notes
is_active
created_at


---

## site_assignments

Links users to sites.

Fields


id
site_id
profile_id
assignment_role
is_primary
created_at


---

## submissions

Primary safety records.

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

Toolbox meeting participants.

Fields


submission_id
name
role
created_at


---

## submission_reviews

Review history.

Fields


submission_id
reviewer_id
review_action
review_note
created_at


---

## submission_images

Image metadata.

Fields


submission_id
file_path
file_name
image_type
file_size_bytes
content_type
caption
uploaded_by
created_at


---

# Image Storage Architecture

Images are stored in Supabase Storage.

Bucket name


submission-images


---

### Example Storage Paths

Inspection photos


inspection/<submission_id>/<filename>


Drill photos


drill/<submission_id>/<filename>


---

# Submission Workflow

### Step 1

User fills out form.

---

### Step 2

Frontend sends data to


resend-email Edge Function


---

### Step 3

Function validates user.

---

### Step 4

Submission stored in database.

---

### Step 5

Optional image uploads stored in Storage.

---

### Step 6

Reviewers examine submissions.

---

### Step 7

Review action updates status.

---

### Workflow Diagram


User submits form
│
▼
Edge Function validates user
│
▼
Submission stored
│
▼
Images uploaded
│
▼
Review performed
│
▼
Submission status updated


---

# Security Model

Security protections include

Authentication

- Supabase JWT sessions

Authorization

- role validation via profiles table

Backend isolation

- service role key used only inside Edge Functions

Storage protection

- image metadata tracked in database

---

# Deployment Architecture

Frontend


Vercel
Cloudflare Pages
Netlify


Backend


Supabase Project


---

# Operational Checklist

Before deploying confirm

Authentication

- magic link works

Forms

- all 5 forms submit correctly

Uploads

- images upload successfully

Logbook

- filters work
- CSV export works

Review

- status updates work
- notes are saved

Admin

- profiles editable
- sites manageable
- assignments manageable

---

# Future Architecture Improvements

Recommended enhancements

Dashboard analytics

- open safety issues
- hazard tracking

Follow-up automation

- reminders
- overdue safety actions

Reporting

- PDF safety reports
- inspection reports

Offline capability

- queued submissions

Role-based site permissions

- restrict site visibility by assignment

---

# Documentation Map

Important documents


README.md
PROJECT_BRAIN.md
AI_CONTEXT.md
SYSTEM_ARCHITECTURE.md
DATABASE_STRUCTURE.md
REPO_BASE.md


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

