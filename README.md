# YWI HSE Safety System

YWI HSE is a Supabase-backed safety, people, jobs, and equipment web app for construction and field operations.

## Current scope
- login with email/password and magic link fallback
- top-right session controls with signed-in user name, settings, and logout
- employee self-profile
- supervisor/admin crew visibility
- admin directory and management for profiles, sites, and assignments
- toolbox, PPE, first aid, inspection, and drill forms
- logbook and review workflow
- jobs and equipment planning scaffold

## Current frontend modules
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
- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

## New backend direction in this pass
- richer user hierarchy fields
- default and override supervisor/admin chains
- jobs and equipment schema
- new Edge Functions for `jobs-directory` and `jobs-manage`
- updated reference/admin functions to support richer profile and site data

## SQL added in this pass
- `043_user_hierarchy_and_strengths.sql`
- `044_jobs_equipment_and_reservations.sql`
- `045_directory_views_and_scope_helpers.sql`

## Current focus
1. finish user hierarchy and permissions
2. finish backend enforcement with SQL/RLS and Edge Functions
3. continue job creation and equipment reservation workflows
