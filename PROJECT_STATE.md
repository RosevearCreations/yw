# Project State

## Current pass complete
- top-right user/session controls
- self profile and crew view retained and expanded
- richer hierarchy fields added to profile model
- admin profile/site/assignment forms expanded
- jobs/equipment planning screens added
- backend SQL and Edge Function scaffolding added for jobs and hierarchy

## Still required for live enforcement
- run new SQL files
- deploy updated/new Edge Functions
- verify RLS and view outputs against live schema

## Main gaps after this pass
- full equipment checkout lifecycle UI
- deeper supervisor-scoped crew filtering by direct reporting lines
- production-ready notifications around jobs and equipment reservations


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
