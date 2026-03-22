# CHANGELOG.md

## Current pass

### Security improvements

- added `js/security.js` to centralize role ranks and permission helpers
- added `js/account-ui.js` for password change and global logout
- added `changePassword()` and `logoutEverywhere()` to `js/auth.js`
- changed admin UI from single admin-only gate to tiered read-only vs manage access
- changed logbook review visibility to use shared security helpers

### Modular cleanup

- confirmed `app.js` now consumes `js/api.js`
- fixed the missing `js/api.js` script load in `index.html`
- added `js/security.js` and `js/account-ui.js` to script loading and service worker cache
- continued reducing hardcoded role checks spread across modules

### Documentation sync

Updated all markdown docs to reflect:

- the new modules
- the current account security features
- the current tier model
- the current next steps
