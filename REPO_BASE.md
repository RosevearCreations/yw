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
