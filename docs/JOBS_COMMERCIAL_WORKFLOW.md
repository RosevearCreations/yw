# Jobs and Commercial Workflow

Last refreshed: **2026-05-10**

## Target workflow

1. Lead/client/site record.
2. Estimate or quote package.
3. Approval/release rules.
4. Customer acceptance/signoff.
5. Job/work order creation.
6. Schedule service sessions.
7. Assign crew/equipment/materials.
8. Execute route/session.
9. Capture evidence and completion notes.
10. Generate invoice candidate.
11. Feed accounting and close workflows.
12. Track callbacks, warranty, and follow-up.

## Next app-level improvement

Create a Jobs Center that shows the above workflow as cards and queues instead of only raw admin tables.

## DB-first rule

Any data reused by quotes, jobs, accounting, reports, or admin review should be DB-backed instead of duplicated in JSON.
