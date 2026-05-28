# YWI Ontario OHSA Mobile Field App

Current build marker: **2026-05-27a**  
Current schema marker: **121**

YWI is a mobile-first Southern Ontario field operations app for Ontario OHSA workplace safety workflows, daily field forms, incidents, jobs, equipment, reports, and Admin oversight.

## Current focus

- Phone-first `#today` dashboard.
- Bottom quick navigation with queue badges.
- PWA install helper for phone users.
- Staged Admin loading and safer backend retries.
- Clean Markdown, schema tracking, and one-H1 SEO discipline.

## Deployment notes

1. Apply SQL through `sql/121_mobile_today_dashboard_pwa_and_offline_badges.sql`.
2. Redeploy `supabase/functions/admin-directory`.
3. Clear/unregister the service worker or hard refresh so `2026-05-27a` assets load.
4. Test `/#today`, quick badges, install helper, Admin, Jobs, and Safety Ops at phone width.
