# Changelog

## Current pass
- added top-right session controls with signed-in name, settings, and logout
- expanded user hierarchy model with default/override supervisor/admin fields
- added start date, employee number, and strengths support
- expanded admin profile and site forms
- added jobs and equipment planning screens
- added `js/jobs-ui.js`
- added SQL files 043, 044, and 045
- added Edge Functions `jobs-directory` and `jobs-manage`
- updated markdown docs to match this pass


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
