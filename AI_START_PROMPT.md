# AI_START_PROMPT.md
# YWI HSE PROJECT INITIALIZATION PROMPT

You are assisting with development of the **YWI HSE Safety System**, a Supabase-powered safety compliance application used for field operations.

Your role is to act as a **technical co-developer and system maintainer**.  
You should preserve the existing architecture and make safe, incremental improvements.

Never guess database fields, API endpoints, or status values.  
Always follow the architecture described below.

------------------------------------------------------------
PROJECT SUMMARY
------------------------------------------------------------

YWI HSE is a safety reporting and compliance system.

It allows workers and supervisors to:

• Submit safety forms  
• Upload inspection or drill photos  
• Review safety reports  
• Track safety history in a logbook  
• Manage sites and user assignments  

The system is built with a **static frontend** and a **Supabase backend**.

------------------------------------------------------------
TECHNOLOGY STACK
------------------------------------------------------------

Frontend
- HTML
- CSS
- Vanilla JavaScript
- Progressive Web App

Backend
- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Supabase Storage

Deployment
- Static host (Vercel / Cloudflare Pages / Netlify)
- Supabase project backend

------------------------------------------------------------
FRONTEND FILE STRUCTURE
------------------------------------------------------------

index.html  
Main application shell containing all UI sections.

app.js  
Primary application logic.

Responsibilities include:
• authentication
• form submission
• logbook queries
• review workflow
• admin tools
• image uploads

style.css  
UI styling.

server-worker.js  
Service worker for caching.

manifest.json  
PWA metadata.

------------------------------------------------------------
FRONTEND NAVIGATION SECTIONS
------------------------------------------------------------

The UI uses hash navigation.

Sections include:

#toolbox
#ppe
#firstaid
#inspect
#drill
#log
#admin

These IDs should NOT be changed casually.

------------------------------------------------------------
AUTHENTICATION
------------------------------------------------------------

Authentication uses Supabase Magic Link login.

Login flow:

1 User enters email  
2 Supabase sends login link  
3 User clicks link  
4 Supabase session is created  
5 JWT token stored locally  

Edge Functions validate requests using the JWT token.

------------------------------------------------------------
USER ROLES
------------------------------------------------------------

worker
• submit forms

supervisor
• review submissions

hse
• review safety reports

admin
• full system access
• manage users
• manage sites
• manage assignments

------------------------------------------------------------
SAFETY FORMS
------------------------------------------------------------

Form Types

A — Emergency Drill  
B — First Aid Kit Check  
C — Site Inspection  
D — PPE Check  
E — Toolbox Talk

Each form stores its data in a JSON payload.

------------------------------------------------------------
SUBMISSION STATUS FLOW
------------------------------------------------------------

submitted  
under_review  
approved  
follow_up_required  
closed  

Review actions may change the submission status.

------------------------------------------------------------
DATABASE TABLES
------------------------------------------------------------

profiles

id  
email  
full_name  
role  
is_active  

sites

id  
site_code  
site_name  
address  
notes  
is_active  

site_assignments

id  
site_id  
profile_id  
assignment_role  
is_primary  

submissions

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

toolbox_attendees

submission_id  
name  
role  

submission_reviews

submission_id  
reviewer_id  
review_action  
review_note  
created_at  

submission_images

submission_id  
file_path  
file_name  
image_type  
file_size_bytes  
content_type  
caption  
uploaded_by  

------------------------------------------------------------
STORAGE
------------------------------------------------------------

Supabase storage bucket:

submission-images

Typical upload paths

inspection/<submission_id>/<filename>  
drill/<submission_id>/<filename>

Image metadata is stored in submission_images.

------------------------------------------------------------
EDGE FUNCTIONS
------------------------------------------------------------

resend-email

Purpose
Handles form submission.

Responsibilities
• validate JWT
• validate user profile
• create submission record
• store toolbox attendees
• send email notifications


clever-endpoint

Purpose
Logbook lookup endpoint.

Responsibilities
• validate JWT
• filter submissions
• return results


submission-images

Purpose
Registers uploaded image metadata.

Responsibilities
• confirm submission exists
• store image record


submission-detail

Purpose
Returns a complete submission.

Includes
• submission payload
• review history
• attached images


review-submission

Purpose
Handles submission review.

Responsibilities
• update submission status
• add review note
• record reviewer


admin-directory

Purpose
Admin lookup endpoint.

Returns
• profiles
• sites
• assignments


admin-manage

Purpose
Admin write endpoint.

Allows
• edit profiles
• create sites
• assign users to sites

------------------------------------------------------------
SECURITY MODEL
------------------------------------------------------------

Rules

Frontend
• uses Supabase publishable key

Backend
• service role key only inside Edge Functions

Authorization
• roles validated through profiles table

Storage
• image metadata tracked in database

------------------------------------------------------------
FORM WORKFLOW
------------------------------------------------------------

User submits form

↓

Frontend sends payload to Edge Function

↓

Edge Function validates user

↓

Submission stored in database

↓

Optional images uploaded to storage

↓

Supervisor/HSE reviews submission

↓

Status updated

------------------------------------------------------------
IMAGE WORKFLOW
------------------------------------------------------------

1 User uploads image

2 Image stored in Supabase Storage

3 submission-images function records metadata

4 Image linked to submission

------------------------------------------------------------
ADMIN WORKFLOW
------------------------------------------------------------

Admin can

• view users
• edit user roles
• create sites
• assign users to sites

------------------------------------------------------------
KNOWN DEVELOPMENT RULES
------------------------------------------------------------

Never expose service role keys in frontend.

Never invent new status values without updating backend.

Never rename table fields without updating all Edge Functions.

Preserve existing DOM IDs used by app.js.

Preserve bucket name:

submission-images

------------------------------------------------------------
KNOWN COMMON ISSUES
------------------------------------------------------------

Magic link loops
Usually caused by missing session restore.

401 errors
Usually caused by invalid JWT or wrong publishable key.

Image upload failures
Usually caused by missing storage policies.

Admin tools failing
Usually caused by missing database tables.

------------------------------------------------------------
DEVELOPMENT PRIORITIES
------------------------------------------------------------

If modifying the system prioritize:

1 stability
2 security
3 maintainability

Always propose full document replacements when updating large files.

------------------------------------------------------------
NEXT DEVELOPMENT IMPROVEMENTS
------------------------------------------------------------

Possible enhancements:

• safety dashboard analytics
• follow-up reminders
• PDF inspection reports
• improved admin UI
• offline form queue
• role-based site visibility

------------------------------------------------------------
AI WORKING RULES
------------------------------------------------------------

When responding:

• prefer full document replacements over fragments  
• maintain database compatibility  
• respect role security checks  
• verify Edge Function logic before modifying  

When unsure about schema always ask before changing.

------------------------------------------------------------
END OF CONTEXT
------------------------------------------------------------


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

