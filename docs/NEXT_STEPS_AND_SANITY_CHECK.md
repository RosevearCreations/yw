# YWI Next Steps and Sanity Check

**Release:** `2026-09-01a`  
**Schema:** `159`  
**Primary staging goal:** prove module isolation with a real Safety-only test profile.

## Deployment order

1. Use a dedicated non-production Supabase project.
2. Confirm schema 158 is already applied.
3. Apply `sql/159_module_boundaries_permission_gated_navigation.sql` once.
4. Deploy the matching static application and changed Edge Functions together.
5. Hard-refresh the staging site or use an incognito window so the `2026-09-01a` cache marker loads.

Changed/protected functions include `admin-directory`, `admin-selectors`, `admin-manage`, `jobs-directory`, `jobs-manage`, `operations-manage`, `resend-email`, `review-list`, `review-submission`, `submission-detail`, `upload-image`, `upload-hse-packet-proof`, `upload-public-asset`, and `accountant-export`. Customer portal/Stripe/notification functions carry the schema 159 release marker but retain their existing private-token/webhook boundaries.

## Database sanity checks

Run in Supabase SQL Editor:

```sql
select * from public.v_schema_drift_status;

select module_key, module_name, default_section_id, sort_order
from public.app_modules
order by sort_order;

select role, module_key, access_level
from public.app_role_module_permissions
order by role, module_key;

select * from public.ywi_module_security_assertions();
```

Expected: schema 159/current, four modules, role defaults populated, and every module security assertion `passed`.

## Safety-only acceptance test

Create/use a clearly labelled non-production user such as `STAGING-SAFETY-ONLY`.

1. Sign in as an Admin.
2. Open **Admin → Module Permissions**.
3. Select the staging user.
4. Click **Set Safety-only** and enter a reason.
5. Sign out completely.
6. Sign in as the Safety-only user.
7. Confirm the first/top module is **Safety / OHSA**.
8. Confirm Finance, Jobs, and Admin top-menu items are absent.
9. Confirm the Safety sub-menu shows only Safety screens permitted by that profile's effective level.
10. Submit a Toolbox/PPE test record using a `STAGING-` label and confirm the permitted Safety workflow succeeds.

### Direct route bypass test

While still signed in as the Safety-only user, manually enter these hashes:

```text
#finance
#jobs
#equipment
#admin
```

Each request must redirect to an allowed Safety screen (or Profile if no Safety route is allowed). It must not expose the hidden module card.

### Direct API bypass test

Use browser DevTools Console while signed in as the Safety-only user:

```js
await YWIAPI.loadAdminDirectory({ scope: 'accounting' })
```

Expected: HTTP 403 / Finance module access required.

```js
await YWIAPI.loadAdminDirectory({ scope: 'all' })
```

Expected: HTTP 403 / Admin module access required.

If the staging user is Supervisor+ and would historically qualify for Jobs, call the Jobs directory through the app's Jobs loader or direct function request. Expected: HTTP 403 / Jobs module access required. This proves module denial is stronger than the old role-only rule.

## Finance separation test

Use a Supervisor or Job Admin test profile with Jobs access. Temporarily set Finance to `hidden` while leaving Jobs allowed. Load Jobs. Job/crew/equipment data may load, but Finance-only arrays such as accounting-ready queues, payment/reconciliation workbenches, tax/payroll review and profitability data must be empty/redacted.

Restore the profile to role defaults after the test.

## Admin permission manager test

1. As Admin, set one profile's Finance level to `view`.
2. Refresh the profile's session/sign in again.
3. Confirm Finance appears.
4. Set Finance back to `hidden`.
5. Confirm Finance disappears after auth refresh.
6. Use **Reset all to role defaults** and confirm the role matrix is restored.
7. Confirm an Admin profile itself cannot be module-locked by the UI/API.

## Mobile and desktop checks

Test approximately 390px, 768px, and desktop widths:

- Four top modules do not overlap.
- Mobile quick navigation shows only allowed modules.
- The second-level module menu wraps/scrolls cleanly without horizontal page overflow.
- Selecting a module makes its permitted section the main visible card under the sticky header.
- Finance/Admin hidden users do not see empty placeholder shells for those modules.
- Existing Operations Cockpit dark-theme contrast remains readable.

## Source checks

From the repository root:

```powershell
npm ci
npm run test:modules
npm run test:repo
npm run test:contrast
npm run test:navigation
```

Do not run live staging tests against Production credentials.

## Sanity status after schema 159

Source target after this build:

- Module separation: implemented.
- Safety-only navigation: implemented.
- Server-side module enforcement: implemented on primary Safety/Jobs/Finance/Admin endpoints.
- Admin per-profile overrides and audit trail: implemented.
- Finance redaction from Jobs payload when Finance is hidden: implemented.
- Customer portal/payment/SEO privacy boundaries: retained.
- Production proof: pending staging acceptance.

## Highest-value work after schema 159 passes staging

1. Split the remaining large legacy Admin and Jobs JavaScript files physically into module folders so deployment bundles mirror the permission architecture.
2. Move shared domain services behind module-specific APIs (`/safety`, `/jobs`, `/finance`, `/admin`) rather than continuing to grow generic Admin endpoints.
3. Add automated role × module integration fixtures covering every access level, not only Safety-only.
4. Add an Admin permission-diff/audit screen showing who changed access, why, and when.
5. Continue approved public SEO/service pages separately; never reuse private operational content as public SEO copy without explicit approval.
