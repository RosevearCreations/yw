# Auth Bootstrap Runbook

Use this runbook for safe account bootstrap, password reset, and recovery-email maintenance.

## Goals
- keep Auth users and profiles aligned
- prefer recovery email over stale profile email for reset flows
- avoid committing reusable bootstrap passwords

## Minimum checks
1. Confirm the user exists in Supabase Auth.
2. Confirm `profiles.id` matches the Auth user id.
3. Confirm `profiles.email` and `profiles.recovery_email` are current.
4. Run the onboarding session health check from the live shell after sign-in.

## Reset workflow
1. Update stale email fields first if needed.
2. Send password reset to `recovery_email` when available.
3. Clear cached service worker/site storage before retesting old recovery links.

## Operational note
Move any bootstrap-user scripts into CI-only or secured internal operations over time.
