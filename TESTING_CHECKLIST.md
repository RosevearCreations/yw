# TESTING_CHECKLIST.md
# YWI HSE Safety System Testing Checklist

This document provides a complete testing checklist for the YWI HSE Safety System.

It is intended for:

- development testing
- deployment verification
- regression testing
- production readiness checks

The goal is to make sure every major system component works as expected.

---

## Testing Goals

The testing process should confirm that:

- authentication works correctly
- forms submit correctly
- database records are written correctly
- images upload correctly
- review workflows work correctly
- admin tools work correctly
- logbook filters and export work correctly

---

## Test Environments

Testing should ideally be performed in:

- local development
- staging environment
- production environment

If only one environment exists, run the full checklist there after each major change.

---

## Section 1 — Authentication Testing

### Test 1.1 — Magic Link Login

Steps:

1. Open the application
2. Enter a valid email address
3. Request a magic link
4. Open the email
5. Click the login link

Expected result:

- the app opens successfully
- the user is authenticated
- the main interface appears
- the email address is shown in the app header or auth info area

---

### Test 1.2 — Session Persistence

Steps:

1. Log in successfully
2. Reload the page
3. Navigate to another section
4. Return to the app

Expected result:

- the session remains active
- the login form does not reappear immediately
- the user stays logged in until logout or session timeout

---

### Test 1.3 — Logout

Steps:

1. Log in
2. Click logout

Expected result:

- the user is signed out
- the login form reappears
- protected features are no longer available

---

### Test 1.4 — Invalid or Expired Login Link

Steps:

1. Use an old magic link
2. Attempt login again

Expected result:

- invalid or expired links do not create a valid session
- the app does not break
- the user can request a new login link

---

## Section 2 — Toolbox Talk Form Testing

### Test 2.1 — Basic Submission

Steps:

1. Open Toolbox Talk
2. Fill site
3. Fill date
4. Fill discussion leader
5. Fill notes
6. Add attendee rows
7. Submit form

Expected result:

- submission succeeds
- database row created in `submissions`
- form type is `E`
- payload stored correctly

---

### Test 2.2 — Attendee Rows

Steps:

1. Add multiple attendee rows
2. Remove one row
3. Submit form

Expected result:

- only remaining attendees are saved
- no removed rows are saved

---

### Test 2.3 — Signature Handling

Steps:

1. Draw a signature for one or more attendees
2. Submit form

Expected result:

- signature data is preserved in the payload or attendee table
- no JavaScript errors occur

---

## Section 3 — PPE Check Form Testing

### Test 3.1 — Basic Submission

Steps:

1. Open PPE Check
2. Fill site
3. Fill date
4. Fill checked by
5. Add workers
6. Submit

Expected result:

- submission succeeds
- database row created in `submissions`
- form type is `D`

---

### Test 3.2 — Non-Compliance Detection

Steps:

1. Uncheck one or more PPE items for a worker
2. Submit

Expected result:

- `nonCompliant` becomes true
- payload reflects the failed PPE item state
- email trigger logic can execute if configured

---

## Section 4 — First Aid Kit Check Testing

### Test 4.1 — Basic Submission

Steps:

1. Open First Aid Kit Check
2. Fill site
3. Fill date
4. Fill checked by
5. Add items
6. Submit

Expected result:

- submission succeeds
- database row created in `submissions`
- form type is `B`

---

### Test 4.2 — Flagged Item Logic

Steps:

1. Enter quantity lower than minimum
2. Or use an expiry within 30 days
3. Submit

Expected result:

- `flagged` becomes true
- payload stores flagged condition correctly

---

## Section 5 — Site Inspection Testing

### Test 5.1 — Basic Submission

Steps:

1. Open Site Inspection
2. Fill site
3. Fill date
4. Fill inspector
5. Add roster rows
6. Add hazards
7. Sign approval
8. Submit

Expected result:

- submission succeeds
- database row created in `submissions`
- form type is `C`

---

### Test 5.2 — Open Hazard Logic

Steps:

1. Add one hazard not marked complete
2. Submit

Expected result:

- `openHazards` is true
- payload stores hazard details correctly

---

### Test 5.3 — Approval Signature Required

Steps:

1. Complete form without approval signature
2. Submit

Expected result:

- form submission is blocked
- validation message appears

---

### Test 5.4 — Inspection Image Uploads

Steps:

1. Add one or more images
2. Submit inspection

Expected result:

- files upload to storage bucket `submission-images`
- metadata row(s) created in `submission_images`
- linked to correct submission id

---

## Section 6 — Emergency Drill Testing

### Test 6.1 — Basic Submission

Steps:

1. Open Emergency Drill
2. Fill site
3. Fill date
4. Fill supervisor
5. Add participants
6. Submit

Expected result:

- submission succeeds
- database row created in `submissions`
- form type is `A`

---

### Test 6.2 — Participant Signatures

Steps:

1. Add signatures to participants
2. Submit form

Expected result:

- signature data is preserved
- no JavaScript errors occur

---

### Test 6.3 — Drill Image Uploads

Steps:

1. Add one or more images
2. Submit drill

Expected result:

- files upload to storage
- metadata recorded in `submission_images`
- images linked to correct submission

---

## Section 7 — Logbook Testing

### Test 7.1 — Load Last 100

Steps:

1. Open logbook
2. Click load

Expected result:

- recent submissions appear
- rows show date, form type, site, status, and summary

---

### Test 7.2 — Filter by Site

Steps:

1. Enter a site
2. Load logbook

Expected result:

- only matching site records appear

---

### Test 7.3 — Filter by Form Type

Steps:

1. Select a form type
2. Load logbook

Expected result:

- only matching form records appear

---

### Test 7.4 — Filter by Date Range

Steps:

1. Set from and to dates
2. Load logbook

Expected result:

- only records in range appear

---

### Test 7.5 — Filter by Status

Steps:

1. Select a status
2. Load logbook

Expected result:

- only matching status records appear

---

### Test 7.6 — CSV Export

Steps:

1. Load logbook
2. Click export

Expected result:

- CSV downloads successfully
- CSV contains expected columns
- data matches current results

---

## Section 8 — Submission Detail Testing

### Test 8.1 — View Submission Detail

Steps:

1. Load logbook
2. Click view detail on a row

Expected result:

- submission detail panel loads
- correct submission id appears
- payload is visible
- review history appears
- image list appears if available

---

### Test 8.2 — Clear Detail

Steps:

1. Load a submission detail
2. Click clear

Expected result:

- detail fields reset
- old data disappears

---

## Section 9 — Review Workflow Testing

### Test 9.1 — Load Review Panel

Steps:

1. Load logbook
2. Click review on a row

Expected result:

- review panel fills with the selected submission id
- current status appears
- admin notes appear if present

---

### Test 9.2 — Save Review Note

Steps:

1. Select a submission
2. Add a review note
3. Save

Expected result:

- new row inserted into `submission_reviews`
- no data corruption occurs

---

### Test 9.3 — Change Submission Status

Steps:

1. Select a submission
2. Change status
3. Save review

Expected result:

- `submissions.status` updates correctly
- `reviewed_by` updates
- `reviewed_at` updates

---

### Test 9.4 — Refresh Detail After Review

Steps:

1. Save a review
2. Reload detail

Expected result:

- updated review appears in history
- updated status appears in detail panel

---

## Section 10 — Admin Directory Testing

### Test 10.1 — Load Users

Steps:

1. Open admin section
2. Set mode to users
3. Load

Expected result:

- profiles table rows appear

---

### Test 10.2 — Load Sites

Steps:

1. Set mode to sites
2. Load

Expected result:

- sites table rows appear

---

### Test 10.3 — Load Assignments

Steps:

1. Set mode to assignments
2. Load

Expected result:

- assignment rows appear
- user and site relationships display correctly

---

## Section 11 — Admin Management Testing

### Test 11.1 — Update Profile

Steps:

1. Enter a profile id
2. Change name or role
3. Save

Expected result:

- profile updates in database
- admin summary confirms success

---

### Test 11.2 — Create Site

Steps:

1. Enter new site code and site name
2. Click create site

Expected result:

- site created in database
- new id returned

---

### Test 11.3 — Update Site

Steps:

1. Enter an existing site id
2. Edit site fields
3. Click update

Expected result:

- site updates correctly

---

### Test 11.4 — Create Assignment

Steps:

1. Enter site id
2. Enter profile id
3. Choose role
4. Create assignment

Expected result:

- assignment row created
- appears in assignments view

---

### Test 11.5 — Update Assignment

Steps:

1. Enter assignment id
2. Change role or primary flag
3. Save

Expected result:

- assignment updates correctly

---

### Test 11.6 — Delete Assignment

Steps:

1. Enter assignment id
2. Delete

Expected result:

- assignment removed
- no unrelated records affected

---

## Section 12 — Storage Testing

### Test 12.1 — Bucket Exists

Verify:

- bucket `submission-images` exists

Expected result:

- bucket is visible in Supabase Storage

---

### Test 12.2 — Upload Permissions

Verify:

- authenticated users can upload supported images

Expected result:

- uploads succeed
- unsupported behavior is rejected correctly

---

### Test 12.3 — Image Metadata Linkage

Verify:

- image records reference the correct submission

Expected result:

- `submission_images.submission_id` matches the created submission

---

## Section 13 — Security Testing

### Test 13.1 — Unauthenticated Access

Attempt:

- logbook load without login
- form submission without login
- review save without login

Expected result:

- access blocked
- no protected data returned

---

### Test 13.2 — Worker Restriction

Login as worker.

Attempt:

- admin functions
- unauthorized review actions

Expected result:

- access denied

---

### Test 13.3 — Reviewer Access

Login as supervisor or HSE.

Attempt:

- load logbook
- review submission

Expected result:

- access allowed

---

### Test 13.4 — Admin Access

Login as admin.

Attempt:

- all admin directory functions
- all admin manage functions

Expected result:

- full access allowed

---

## Section 14 — UI Testing

### Test 14.1 — Navigation

Verify:

- all nav links switch sections correctly

---

### Test 14.2 — Table Rows Visible

Verify:

- starter rows appear in every form table
- rows do not disappear after navigation

---

### Test 14.3 — Calendar Inputs Visible

Verify:

- date fields are usable
- calendar icon is visible enough
- fallback works if native date picker is unavailable

---

### Test 14.4 — Signature Canvases

Verify:

- signature backgrounds are white
- signatures can be cleared
- canvases remain visible on mobile and desktop

---

## Section 15 — Service Worker Testing

### Test 15.1 — App Loads Cleanly

Verify browser console.

Expected result:

- no cache errors for POST requests
- no cache errors for chrome-extension or unsupported scheme requests

---

### Test 15.2 — Static Asset Cache

Verify:

- CSS and JS load correctly
- reload does not break core app

---

## Section 16 — Regression Testing After Any Major Change

After changing:

- database schema
- app.js
- Edge Functions
- storage rules
- authentication logic

Run at minimum:

- login
- one form submission
- one image upload
- logbook load
- one review action
- one admin update

---

## Test Completion Sign-Off

Before considering a deployment complete, confirm:

- all auth tests passed
- all form tests passed
- all upload tests passed
- all logbook tests passed
- all review tests passed
- all admin tests passed
- no critical console errors remain

---

## Maintainers

YWI HSE Development Team

---

End of Testing Checklist


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

