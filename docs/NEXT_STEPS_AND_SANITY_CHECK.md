# YWI Next Steps and Sanity Check

**Release:** `2026-09-01b`  
**Schema:** `160`  
**Primary acceptance goal:** prove Admin full-access integrity, repaired Module Permissions profile loading, and the new Admin → I.T. Readiness cockpit before starting another major feature.

## Current control-plane state

The connected YardWeasels Supabase project has migrations 159 and 160 applied. Read-only verification already confirms:

- `v_schema_drift_status` is `160 / 160` and current;
- `it` is registered as an Admin `manage` route;
- all Schema 160 I.T. security assertions pass;
- all active Admin profiles resolve to `manage` on Safety, Finance, Jobs, and Admin;
- Admin access-integrity issue count is zero;
- the protected `admin-it-control` Edge Function is deployed with JWT verification enabled.

The remaining acceptance is the rendered/authenticated application path.

## Deployment / source order

1. Keep migrations ordered: schema 159 must exist before 160.
2. Deploy the static Schema 160 application together with `admin-it-control` and matching protected functions/source.
3. Confirm `supabase/config.toml` retains `[functions.admin-it-control] verify_jwt = true`.
4. Hard-refresh or use an incognito session after the static deployment.
5. Run the source checks below before treating the release as green.
6. Do not start another schema-changing feature until the Admin acceptance below passes.

## Database sanity checks

Run read-only checks:

```sql
select * from public.v_schema_drift_status;

select section_id, module_key, minimum_access_level, is_enabled
from public.app_module_routes
where section_id = 'it';

select *
from public.ywi_it_readiness_security_assertions();

select profile_label, role,
       safety_access, finance_access, jobs_access, admin_access,
       all_modules_manage, integrity_issue_count
from public.v_admin_module_access_integrity
where role = 'admin';
```

Expected:

- schema 160/current;
- `it | admin | manage | true`;
- every I.T. assertion `passed`;
- every active Admin row shows `manage` four times, `all_modules_manage=true`, and `integrity_issue_count=0`.

## Admin Module Permissions acceptance — highest priority

1. Sign in using an active Admin account.
2. Open **Admin → Admin Control Center**.
3. Locate **Module permissions**.
4. Confirm the profile selector populates active profiles. The screen should not remain on “No profiles were returned.”
5. Select each Admin profile.
6. Confirm Safety, Finance, Jobs, and Admin all show effective `manage`.
7. Confirm the four access selectors are disabled for Admin targets and the screen explains **Admin break-glass**.
8. Refresh and repeat once to prove the dedicated `admin-it-control` endpoint is stable.
9. Open browser DevTools Network and confirm the module load calls the protected `admin-it-control` function, not the old `admin-directory?scope=module_permissions` path.

Do **not** continue to new feature work if any active Admin lacks full access or if the profile selector does not populate.

## Admin → I.T. Readiness acceptance

1. While signed in as Admin, click **Admin** in the top navigation.
2. In the Admin sub-navigation, click **I.T. Readiness**.
3. Confirm I.T. Readiness becomes the main visible routed card under the sticky header; no large static block should sit above it.
4. Confirm the hero summary shows:
   - schema applied / expected;
   - active Admin count;
   - Admin access blockers;
   - readiness/security blocker count.
5. Confirm the access-integrity panel lists Admin profiles and shows green/passed full-access status.
6. Confirm the security assertion panel loads.
7. Confirm contained panels exist for database/preflight, deployment, functions, production readiness, recovery, runtime/Admin tasks, and public SEO.
8. Click **Run browser smoke check** and confirm the safe client/config/session/one-H1 checks render without changing business data.
9. Treat any red blocker as a release hold; I.T. Readiness must not auto-promote or auto-fix release state.

### Visual placeholder check

The I.T. panel intentionally includes an **I.T. readiness map placeholder**. It must clearly remain labelled as a future graphic and must not imply a completed dependency diagram or live evidence that does not exist.

## Safety-only regression test

Use a clearly labelled non-production profile.

1. As Admin, open Module Permissions and select the non-admin fixture.
2. Click **Set Safety-only**.
3. Sign out completely and sign in as that fixture.
4. Confirm Safety / OHSA is available.
5. Confirm Finance, Jobs, and Admin are absent from the top navigation.
6. Confirm a permitted Toolbox/PPE test action succeeds.
7. Manually enter `#finance`, `#jobs`, `#equipment`, `#admin`, and `#it`.
8. Confirm every hidden route redirects to an allowed screen and does not expose the protected card.
9. Direct API requests to protected Finance/Jobs/Admin endpoints must return 403 even if the user’s historical role rank would otherwise qualify.
10. Reset the fixture to role defaults after the test.

## Admin override rejection test

Admin module access is immutable break-glass manage.

1. Select an Admin profile in Module Permissions and confirm there is no enabled save/preset path for reducing access.
2. Do not mutate the database merely to test this in Production.
3. In a dedicated staging database, a service-side attempt to call `ywi_admin_set_profile_module_permissions` against an Admin target should fail with the break-glass override message.
4. A direct insert/update into `app_profile_module_permissions` for an Admin target should also be rejected by `trg_prevent_admin_module_override`.

## Mobile and desktop checks

Test approximately 390px, 768px, and desktop widths:

- four top-level modules do not overlap;
- Admin sub-navigation exposes Admin Control Center and I.T. Readiness only to allowed Admin/manage sessions;
- Module Permissions profile/select controls remain usable and do not run off-screen;
- I.T. readiness hero collapses to one column cleanly;
- readiness metric cards, status chips, rows, and action buttons do not overlap;
- mobile I.T. actions become full width;
- routed cards remain the main visible content below the sticky header;
- no horizontal page overflow;
- forced-colors/high-contrast behavior remains understandable.

## Source checks

From repository root:

```powershell
npm ci
npm run test:modules
npm run test:it
npm run test:repo
npm run test:contrast
npm run test:navigation
```

Expected: every suite green. Do not use Production service-role credentials for local or PR tests.

## Supabase post-migration sanity

After Schema 160 is committed/deployed, run the Supabase security and performance advisors. New warnings/errors introduced by this release are blockers. Existing unrelated warnings should be recorded in I.T. Readiness/next work rather than silently ignored.

## Sanity status after Schema 160

- Four top-level modules: retained.
- I.T. Readiness inside Admin/manage: implemented.
- Live database schema 160: applied/current.
- Admin full-access database invariant: implemented and currently green.
- Dedicated Module Permissions endpoint: implemented and deployed.
- Module Permissions active-profile loading repair: source/runtime control path implemented; browser acceptance pending.
- Atomic module permission writes: implemented.
- Admin module override prevention: implemented DB + UI.
- I.T. readiness aggregation: implemented.
- Browser smoke integration: implemented.
- Responsive I.T. CSS and truthful visual placeholder: implemented.
- Public SEO/private portal separation: retained.
- Authenticated rendered browser/device proof: pending.

## Highest-value work after Schema 160 acceptance

1. Physically split the remaining large Admin and Jobs client/server files into module folders so source bundles match the permission architecture.
2. Move more generic Admin scopes behind domain-specific endpoints (`/safety`, `/jobs`, `/finance`, `/admin`) and let I.T. readiness report their release status.
3. Add automated role × module authenticated fixtures across every access level, not only Safety-only.
4. Add a focused Admin permission audit/diff view showing who changed access, why, and when.
5. Turn the I.T. readiness placeholder into an approved dependency/status graphic sourced only from real readiness data.
6. Continue public SEO/service content separately; never reuse private operational/customer evidence publicly without explicit approval.

## Schema 163 restart point — 2026-09-01e
1. Verify Schema 163 source/runtime gates and exact preview deployment.
2. Verify denied modules make zero `core-data-read` requests and profile/permission changes invalidate Core caches.
3. Keep Schema 162 lazy module loading green.
4. Next release: Schema 164 cross-module event and write boundaries; shared identities remain Core-owned and read-only through `core-data-read`.

## Schema 164 restart point — 2026-09-01f
1. Verify all 35 `operations-manage` handlers match both the source write-boundary manifest and Schema 164 database registry.
2. Verify unknown actions resolve to no contract and are rejected before authorization/handler execution.
3. Verify manual `deposit_status_update` is disabled at the boundary and Stripe webhook/customer checkout remain payment-truth authorities.
4. Verify cross-module effects emit only private contract/status event metadata and Shared Core remains read-only.
5. After Schema 164 is fully green on `main`, begin Schema 165: module-local Finance/Jobs write-service extraction from `operations-manage`, retaining the same action contracts during the move.
6. Verify `test:boundaries` passes: versioned cross-module contracts/outbox are private, publication is service-role-only, producer/domain assertions resolve, and no Shared Core identity is duplicated.
