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
