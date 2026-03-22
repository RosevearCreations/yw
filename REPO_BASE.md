# REPO_BASE.md

Repository structure overview for YWI HSE.

## Main frontend files

- `index.html`
- `style.css`
- `app.js`
- `manifest.json`
- `server-worker.js`

## Shared JS modules

- `js/router.js`
- `js/bootstrap.js`
- `js/security.js`
- `js/auth.js`
- `js/api.js`
- `js/ui-auth.js`
- `js/account-ui.js`
- `js/admin-ui.js`
- `js/logbook-ui.js`

## Form modules

- `js/forms-toolbox.js`
- `js/forms-ppe.js`
- `js/forms-firstaid.js`
- `js/forms-inspection.js`
- `js/forms-drill.js`

## SQL folder

Contains schema, role model, selector, and site-access helper SQL documents.

## Working rule

Keep logic separated by responsibility:

- auth/session in auth/bootstrap
- role checks in security
- API calls in api
- account password/session tools in account-ui
- directory UI in admin-ui
- logbook/review in logbook-ui
- form behavior in individual form files
