# Changelog

## Current pass

### Security and account improvements
- kept magic-link recovery flow
- kept password login and reset flow
- added stronger first-time password messaging in the account panel
- kept support for log out everywhere
- added guarded route handling so restricted sections redirect cleanly

### Modularization
- added `js/admin-actions.js`
- added `js/outbox.js`
- kept `js/api.js`, `js/security.js`, and `js/router.js` as shared foundation modules
- reduced `app.js` back toward shell/init responsibilities

### Workforce profile model
- expanded the admin profile editor to include richer construction-company profile fields
- added SQL planning for employee/supervisor/admin profile expansion in `sql/036_employee_profile_expansion.sql`

### Backend/RLS planning
- added `sql/037_security_rls_verification_notes.sql`
- updated docs to call out backend enforcement requirements for role/site security
