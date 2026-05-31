# System Architecture

Last refreshed: **2026-05-30a**

The app uses a static frontend, Supabase Postgres, and Supabase Edge Functions. Schema 124 expands the accounting/equipment domain:

- frontend: Jobs UI renders Accounting Depth Workbench and Equipment Accountability Workbench.
- Edge Functions: `jobs-directory` returns new views, `jobs-manage` writes equipment scan/accessory/service-task data, and `admin-manage` reviews accounting workbench rows.
- database: schema 124 adds accounting depth fields/views and equipment accountability/service-task tables/views.

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
