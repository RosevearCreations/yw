# Project State

Last refreshed: **2026-05-14b**

The app has moved another step toward a real production-style backend. The current focus is not adding flashy features; it is making the admin/backend reliable, traceable, recoverable, and easier to operate.

## Current foundations

- HSE forms and reporting modules exist.
- Jobs, operations, evidence, and accounting backbone data are increasingly DB-backed.
- Accounting close, reconciliation, remittance, tax filing, and accountant handoff structures exist.
- Admin has Command Center, Health/Schema Center, Task Inbox, Guided Close Center, Evidence Manager, and Readiness/Permissions panels.
- Schema tracking now has a live drift status view.

## Current risks

- Schema 107 must be applied live.
- Edge Functions must be redeployed after schema changes.
- Some admin panels are still read-only foundations.
- RLS/permission enforcement needs a role-by-role review.
- Large manager tables need pagination before heavy production use.
