# AI Context

Read this first in any new session.

## Current focus

1. stronger login/logout and password security
2. employee/supervisor/admin profile model
3. separating app shell logic into smaller units
4. route/view guards
5. full markdown sync whenever architecture changes

## Current module structure

- auth: `bootstrap.js`, `auth.js`, `ui-auth.js`, `account-ui.js`
- security/routing: `security.js`, `router.js`
- data/helpers: `api.js`, `outbox.js`
- admin: `admin-ui.js`, `admin-actions.js`
- logbook: `logbook-ui.js`
- forms: `forms-toolbox.js`, `forms-ppe.js`, `forms-firstaid.js`, `forms-inspection.js`, `forms-drill.js`
- shell: `app.js`

## Security tiers

- employees/workers: only their normal screens
- supervisors/HSE/job admins: can inspect employee information and review flows; directory access is tiered
- admins: can see and manage supervisors, employees, and other admins

## Rich employee record direction

Profiles now need to support construction-company data such as contact info, address, vehicle, years employed, current position, previous employee flag, certifications, trade/specialty, and feature preferences.
