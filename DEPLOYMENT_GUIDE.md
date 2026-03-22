# DEPLOYMENT_GUIDE.md

Deployment guide for YWI HSE.

## Core deployment checklist

### Frontend

Deploy these current frontend files together:

- `index.html`
- `style.css`
- `app.js`
- `manifest.json`
- `server-worker.js`
- all files in `js/`

Important: `index.html` must load `js/api.js`, `js/security.js`, and `js/account-ui.js` in addition to the older files.

### Supabase configuration

Required values:

- project URL
- anon/publishable key
- redirect URLs

Important: the service role key must never be placed in frontend code.

### Auth setup

Enable email auth.

Current frontend supports:

- magic link login
- password login
- password reset
- password change after sign-in
- global sign-out

### Backend

Deploy current functions expected by the frontend:

- `resend-email`
- `clever-endpoint`
- `submission-detail`
- `review-submission`
- `admin-directory`
- `admin-manage`
- `admin-selectors`
- `upload-image`

### Security deployment note

Frontend role gating is not enough.

Before production, verify:

- SQL helper functions
- RLS or function-level checks
- admin-only write protection
- review permission checks
- site/submission access checks
