# REPO_BASE.md
# YWI HSE Safety System Repository Base Guide

This document explains the repository structure of the YWI HSE Safety System.

Its purpose is to help developers, maintainers, and AI assistants understand:

- what files exist
- what each file is responsible for
- how the frontend and backend connect
- where to make changes safely

---

## Repository Purpose

The repository contains the frontend application and the backend function source code for the YWI HSE safety system.

The system is designed as:

- a simple static frontend
- a Supabase backend
- Edge Functions for secure server-side logic
- Storage for images
- Postgres for structured safety records

---

## Recommended Repository Layout

A typical repository layout for this system should look like this:

```text
/
├── index.html
├── app.js
├── style.css
├── manifest.json
├── server-worker.js
├── README.md
├── CHANGELOG.md
├── PROJECT_BRAIN.md
├── AI_CONTEXT.md
├── PROJECT_STATE.md
├── DATABASE_STRUCTURE.md
├── REPO_BASE.md
├── SYSTEM_ARCHITECTURE.md
├── docs/
│   └── additional supporting documents
├── sql/
│   ├── 028_submission_review_and_images.sql
│   ├── 029_storage_submission_images.sql
│   └── other migration files
└── supabase/
    └── functions/
        ├── resend-email/
        │   └── index.ts
        ├── clever-endpoint/
        │   └── index.ts
        ├── submission-images/
        │   └── index.ts
        ├── submission-detail/
        │   └── index.ts
        ├── review-submission/
        │   └── index.ts
        ├── admin-directory/
        │   └── index.ts
        └── admin-manage/
            └── index.ts


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

