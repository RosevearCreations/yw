# Project Brain

## What the app is

YWI HSE is a modular safety and workforce app for a construction-style company.

## Main current goals

- secure sign-in/sign-out experience
- password creation after first magic-link login
- employee/supervisor/admin workforce records
- cleaner role tiers and visibility
- smaller reusable modules instead of a large `app.js`

## Current module map

- `bootstrap.js`, `auth.js`, `ui-auth.js`, `account-ui.js`
- `security.js`, `router.js`
- `api.js`, `outbox.js`
- `admin-ui.js`, `admin-actions.js`
- `logbook-ui.js`
- form modules per form
- `app.js`

## Workforce visibility direction

- employee sees their own working screens
- supervisor can inspect employee information and employee-facing operational records where permitted
- admin can see supervisors, employees, and admins
- final truth for security must remain backend-enforced

## Important warning

Do not treat frontend hiding as real security. Edge Functions and SQL/RLS must validate the same tier rules.
