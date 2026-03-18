# CHANGELOG.md
# YWI HSE Safety System Change Log

This document records major structural changes to the YWI HSE Safety System.

It should be updated whenever architecture, database schema, authentication, Edge Functions, or major features are modified.

The goal is to provide a clear development history for developers, auditors, and AI assistants.

---

## Purpose

This file tracks:

- major backend changes
- database schema changes
- authentication changes
- storage changes
- frontend structural changes
- important bug fixes

It is meant to act as the historical record of the project.

---

## Version Format

Versions follow a simplified semantic format.

`MAJOR.MINOR.PATCH`

Example:

`1.2.0`

Meaning:

- **MAJOR** = breaking architecture change
- **MINOR** = new feature added
- **PATCH** = bug fix or small improvement

---

## Version 1.5.0
### System Documentation Expansion

**Date:** Current documentation phase

Major documentation added.

New documentation files:

- `README.md`
- `PROJECT_BRAIN.md`
- `AI_CONTEXT.md`
- `SYSTEM_ARCHITECTURE.md`
- `PROJECT_STATE.md`
- `CHANGELOG.md`

Purpose:

- improve maintainability
- improve onboarding
- improve future AI collaboration
- preserve system understanding between chats

---

## Version 1.4.0
### Admin Management System

Changes:

Added `admin-directory` Edge Function.

Added `admin-manage` Edge Function.

Admin users can now:

- edit user roles
- create new sites
- update sites
- create assignments
- update assignments
- delete assignments

Database structures used:

- `profiles`
- `sites`
- `site_assignments`

Impact:

- expanded admin control
- improved user and site management
- established the admin architecture for future scaling

---

## Version 1.3.0
### Submission Detail Viewer

Changes:

Added `submission-detail` Edge Function.

Users can now view:

- submission payload
- review history
- attached images

Logbook now links to a full submission detail view.

Impact:

- improved reviewer workflow
- improved audit visibility
- improved access to full submission history

---

## Version 1.2.0
### Image Upload Support

Changes:

Added `submission_images` table.

Created storage bucket:

`submission-images`

Inspection and drill forms now support photo uploads.

Images are linked to submissions through metadata records.

Impact:

- added visual evidence support
- improved inspection documentation
- improved drill verification workflow

---

## Version 1.1.0
### Review System Enhancements

Changes:

Added `review-submission` Edge Function.

Added new database table:

`submission_reviews`

Review actions added:

- `commented`
- `under_review`
- `approved`
- `follow_up_required`
- `closed`
- `reopened`

Submission status updates are now recorded with:

- reviewer ID
- timestamp
- notes

Impact:

- enabled formal review workflow
- improved traceability
- improved status tracking

---

## Version 1.0.0
### Initial Safety System Implementation

**Date:** Project initialization phase

Major components implemented:

Authentication:
- Supabase Magic Link login

Forms:
- Toolbox Talk
- PPE Check
- First Aid Kit Check
- Site Inspection
- Emergency Drill

Backend:
- Supabase Edge Functions

Database:
- core safety tables

Logbook:
- submission search and filtering

Review System:
- supervisor and HSE review capability

Admin Interface:
- user and site management foundation

Storage:
- image uploads for inspections and drills

Impact:

- established the complete initial application framework
- created the base architecture for all future work

---

## Known Issues

Minor issues currently observed:

- service worker may attempt to cache unsupported requests
- some admin UI fields still require manual ID entry instead of dropdowns
- calendar icon visibility can be weak on dark form fields

These do not prevent operation but should be improved in future releases.

---

## Planned Version 2.0.0

Major improvements planned:

Dashboard analytics:
- inspection statistics
- open hazard tracking
- safety activity overview

Follow-up reminder system:
- notifications for unresolved hazards

Improved admin UI:
- dropdown selectors instead of raw ID entry

Reporting system:
- PDF inspection reports

Offline capability:
- queued form submissions

Possible access improvements:
- role-based site visibility
- assignment-based permissions

---

## How To Update This File

When making changes:

1. Add a new version section near the top
2. Include the version number
3. Include the date or development phase
4. Summarize the change
5. Note the affected components
6. Keep entries concise but clear

Example:

```text
## Version 1.6.0
### Added dashboard analytics

Changes:
- added dashboard cards
- added hazard count summary
- added recent submission summary


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

