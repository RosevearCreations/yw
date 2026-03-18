# CHANGELOG.md

All notable changes to **YWI HSE** should be documented in this file.

This project is a Supabase-backed HSE web app with:
- magic-link authentication
- five structured safety/compliance forms
- image evidence uploads
- review workflow
- logbook search/export
- admin user/site/assignment management

---

## [Unreleased]

### Added
- Supabase magic-link authentication flow in the frontend.
- Session persistence using the Supabase client.
- Secure JWT-based requests from the frontend to Edge Functions.
- Submission intake flow for all current form types:
  - Form E — Toolbox Talk
  - Form D — PPE Check
  - Form B — First Aid Kit
  - Form C — Site Inspection
  - Form A — Emergency Drill
- Dynamic table row support for attendee, roster, item, participant, and hazard entry.
- Signature capture support for:
  - Site Inspection approval
  - Emergency Drill supervisor signoff
- Image upload support for:
  - Site Inspection
  - Emergency Drill
  - Toolbox Talk
- Submission detail panel showing:
  - submission metadata
  - payload
  - review history
  - attached images
- Review workflow panel for authorized users.
- Admin directory endpoint integration for:
  - profiles
  - sites
  - assignments
- Admin management endpoint integration for:
  - updating profiles
  - creating/updating sites
  - creating/updating/deleting assignments
- Selector-based admin tools for:
  - profile selection
  - site selection
  - assignment selection
- Admin Dashboard summary cards showing:
  - user count
  - site count
  - assignment count
  - current dashboard mode
- Click-to-load admin table rows that populate the matching admin editor.
- Role/status badge styling for admin and logbook displays.
- Auto-load behavior for the Admin Dashboard when entering the `#admin` route.
- Enter-to-search support on admin dashboard filters.
- Empty-state messaging in admin result tables.
- Outbox retry support for failed/offline submissions.

### Changed
- Admin UI updated from a raw utility layout to a clearer dashboard layout.
- Admin tools now preserve existing `ad_*` and `am_*` DOM hooks while improving usability.
- Role-aware frontend visibility now hides review tools from lower roles and locks admin management for non-admin users.
- Current signed-in role is reflected in the signed-in identity display.
- Admin dashboard visuals improved with:
  - grouped dashboard panels
  - summary cards
  - selector-first editing flow
  - reusable card layout
- Logbook status cells now support status chip rendering.
- Assignment and role data are displayed more clearly in admin tables.
- Hash navigation handling is aligned with the one-page app structure.

### Security
- Frontend continues to use the Supabase publishable key only.
- Edge Function calls continue to rely on JWT auth from the active session.
- Admin dashboard actions are frontend-locked for non-admin users.
- Review visibility is restricted in the UI based on role.
- Existing endpoint names, hash routes, status values, and storage bucket naming are preserved to avoid breaking deployed flows.

### Notes
- Current supported roles:
  - worker
  - site_leader
  - supervisor
  - hse
  - admin

- Current submission statuses:
  - submitted
  - under_review
  - approved
  - follow_up_required
  - closed

- Current review actions:
  - commented
  - under_review
  - approved
  - follow_up_required
  - closed
  - reopened

### Recommended next steps
- Add assignment-based site restrictions throughout the UI and backend flows.
- Verify deployed Edge Functions against repo versions.
- Verify SQL schema against the current migration set.
- Add print/PDF export support for review and submission packages.
- Add better image evidence gallery/review tools.
- Add reopen/edit workflow support where appropriate.
- Add audit logging.
- Enable and verify RLS across all required tables.

---

## [Project baseline]
### Initial platform direction
- Static frontend architecture:
  - `index.html`
  - `style.css`
  - `app.js`
- Supabase backend with Edge Functions for:
  - submission intake
  - logbook listing
  - submission detail
  - submission review
  - admin directory
  - admin management
- Storage bucket for submission images:
  - `submission-images`
