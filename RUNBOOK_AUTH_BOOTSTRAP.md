
## 2026-04-04 login/auth shell repair and protected-screen recovery pass
- Reworked the visible login/logout flow toward a standard daily sign-in shell with clearer signed-in state, better section fallback content, and more obvious protected-screen guidance.
- Wrapped account and admin password inputs in real forms to remove browser password-field warnings and improve submission behavior.
- Hardened onboarding completion so it now validates missing username/password state, shows success/error feedback, refreshes auth state, and routes back into the standard app flow after completion.
- Added stronger 401 diagnostics in the frontend so protected request failures explain re-login/redeploy guidance instead of leaving screens feeling blank.
- Added `config.toml` with `verify_jwt = false` for the protected Edge Functions that already validate bearer tokens in code, aligning them with `account-maintenance` and addressing the repeated live 401 issue pattern.
- Added light shell placeholders so sections no longer appear completely blank while modules are loading or when a protected module fails.
- No new SQL migration was required in this pass; `sql/056_admin_password_resets_and_sales_accounting_stub.sql` remains the latest live migration and `sql/000_full_schema_reference.sql` was refreshed as the current snapshot.

### Best next live validation after deploy
1. Hard refresh / clear service worker once after deploy.
2. Sign in with username/email + password through the normal login form.
3. Complete onboarding and confirm the success notice + redirect back into the app.
4. Verify `admin-directory`, `jobs-directory`, and `reference-data` no longer return 401 in the deployed environment.
5. Confirm non-settings screens load their normal content instead of remaining blank.

## 2026-04-03 admin password control and order/accounting scaffold pass
- Added admin-managed password reset capability for any profile, including other admins, with audit logging in `admin_password_resets` and notification history.
- Added a basic sales-order and accounting scaffold so creating an order now also creates an initial accounting row for later cost, inventory, revenue, and tax workflows.
- Extended the Admin screen with password control, order creation, order list, and accounting list panels.
- Extended the admin directory/function layer so orders and accounting records are visible in the live app.
- Added migration `sql/056_admin_password_resets_and_sales_accounting_stub.sql` and refreshed `sql/000_full_schema_reference.sql`.
- Continued SEO/cache/CSS cleanup with updated shell versioning, homepage metadata tuning, and minor admin panel style tightening.
- Remaining live work before stress testing: deploy migration 056, deploy updated Edge Functions, then validate admin password reset and order/accounting creation in the real environment.

## 2026-03-31 session health and onboarding completion pass

## 2026-04-01 conflict review, CI smoke-check, and diagnostics timing pass
- Added visible conflict review panels in Settings and Admin so queued local actions can be compared, retried, kept local, or discarded instead of staying as opaque conflict rows.
- Added module/startup timing capture and exposed it through in-app diagnostics, support snapshot export, and smoke-check reporting for deeper boot troubleshooting.
- Added a repository smoke-check script plus GitHub Actions workflow so baseline release verification now runs automatically in CI/CD instead of being manual-only.
- No new SQL migration was required. `sql/000_full_schema_reference.sql` remains the current schema snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

### Remaining sign-off item
- Live deployed auth/runtime verification still needs to be confirmed against your actual environment because that cannot be completed from the zip alone. The codebase is now prepared with better conflict review, smoke automation, and timing diagnostics for that final live verification.

- Fixed the separate onboarding-complete path so it can also finalize `account_setup_completed_at` when username and password readiness are already satisfied.
- Added signed-in session health probing to the frontend API/smoke checks and added a Support & Session Health panel in Settings with exportable troubleshooting snapshots.
- No new SQL migration was required in this pass; `sql/000_full_schema_reference.sql` remains the refreshed reference snapshot and `055_storage_onboarding_identity_change_and_bootstrap.sql` remains the latest live migration.

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

## 2026-03-31 Runtime/Auth alignment pass

Current state after this pass:
- Frontend runtime config now prefers custom `SB_URL` and `SB_ANON_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- Edge Functions now prefer custom `SB_URL` and `SB_SERVICE_ROLE_KEY` first, while keeping `SUPABASE_*` as compatibility fallbacks.
- `account-maintenance` now uses the incoming bearer token with the service-role client and has `verify_jwt = false` configured so function auth is handled in-code instead of by the edge gateway.
- Remaining live verification after deploy should focus on `account-maintenance` save/update paths, then `admin-directory`, `reference-data`, and `jobs-directory` if any 401s remain.
- The next chat should start from verifying the live deployed `SB_*` runtime path, then checking the first failing function response body if any auth error remains.
