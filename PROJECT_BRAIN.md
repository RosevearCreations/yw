# Project Brain

## What YWI HSE is
A construction safety and operations app built on Supabase with a modular frontend.

## Main user areas
- safety forms
- my profile
- crew view
- settings/session
- admin directory
- jobs
- equipment
- logbook/review

## Role model
- worker
- staff
- onsite_admin
- site_leader
- supervisor
- hse
- job_admin
- admin

## Current hierarchy model
Profiles now need to support:
- employee number
- start date
- strengths
- default supervisor
- override supervisor
- default admin
- override admin

Sites also support:
- site supervisor
- signing supervisor
- admin lead
- region
- client
- project metadata

## Next major domain
Jobs and equipment:
- create job records
- attach site leadership
- reserve required equipment
- track equipment sign-out to jobs

## Files to keep aligned
All main markdown files plus SQL and Edge Function folders.


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.
