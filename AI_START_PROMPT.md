# AI_START_PROMPT.md

Use this when resuming work on the YWI HSE repo in a new session:

Read `AI_CONTEXT.md` and `PROJECT_BRAIN.md` first.

Current focus:
- login/logout/account security
- tiered access for employees, supervisors, job admins, HSE, and admins
- modular separation of shared logic into smaller files
- full markdown sync with the real codebase

Current important modules:
- `js/security.js`
- `js/account-ui.js`
- `js/api.js`
- `js/admin-ui.js`
- `js/logbook-ui.js`

Important caution points:
- do not break Supabase callback recovery
- do not remove `js/api.js` or `js/security.js` from script loading
- do not trust frontend-only role checks for real security
- keep docs updated whenever code or security behavior changes
