> Last synchronized: April 7, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Auth Bootstrap Runbook

Last synchronized: April 7, 2026

## Purpose
Use this runbook when a fresh Admin account or role reset is needed.

## Preferred remote-first approach
1. create the user in Supabase Auth dashboard
2. run the SQL promotion/update query in SQL Editor
3. verify `profiles.role`, `staff_tier`, and onboarding/account-setup timestamps

## Validation after bootstrap
- sign in
- confirm header identity
- confirm Settings data matches the same account
- confirm Admin selectors/jobs/staff screens load
- confirm logout works
