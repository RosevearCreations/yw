# Repo Base

## Main frontend files
- `index.html`
- `style.css`
- `app.js`

## Shared modules
- `js/bootstrap.js`
- `js/security.js`
- `js/auth.js`
- `js/api.js`
- `js/ui-auth.js`
- `js/account-ui.js`
- `js/profile-ui.js`
- `js/reference-data.js`
- `js/jobs-ui.js`
- `js/admin-ui.js`
- `js/admin-actions.js`
- `js/outbox.js`
- `js/logbook-ui.js`

## Backend folders
- `sql/`
- `supabase/functions/`

## Current repo direction
Prepare the app for:
- richer people hierarchy
- scoped visibility
- admin-maintained populated reference data
- jobs and equipment planning


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
