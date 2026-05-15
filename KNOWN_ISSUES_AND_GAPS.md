# Known Issues and Gaps

Last refreshed: **2026-05-15a**

## Highest priority after this pass

### 1. Schema 106 needs live Supabase verification
The migration is in the repo and schema reference, but the live DB must be migrated before the new Admin Health/Task/Schema cards can show real rows.

### 2. Command Center cards need deeper drill-down
The new cards show counts and route/focus hints. Next step is exact filtering: open only unmatched bank items, only failed uploads, only open close periods, and so on.

### 3. Close Center is still a dashboard foundation, not a full wizard
Close blockers are visible, but the close workflow still needs step-by-step checks, approvals, lock/reopen controls, and export package delivery actions.

### 4. Payment application still needs detailed editing
AR/AP payment application counts are visible. The app still needs full forms for partial payments, overpayments, unapplied balances, and reversal handling.

### 5. Bank import and reconciliation remain incomplete
Manual review visibility exists. Import, match suggestions, accept/reject controls, and reviewed/locked reconciliation state still need UI and backend actions.

### 6. Health Center needs real dismiss/resolve workflow
Local diagnostics can be cleared in the browser, but backend health rows still need persistent dismissal, assignment, retry, and resolved status.

### 7. Large admin tables still need pagination
Some managers use broad payloads. The next stability step is server-side pagination and saved filters.

### 8. Role permissions need final practical review
The app has role concepts and dashboard presets, but every action still needs a visible permission matrix and live RLS review.

### 9. Evidence/media manager is not yet complete
Evidence appears in several places. A single manager for failed uploads, signatures, photos, receipts, job files, and HSE proof is still needed.

### 10. Public SEO depends on future public pages
The current app shell has one H1. Any future public pages need unique title/meta/H1/local wording, proof content, image alt text, and structured data where accurate.

## Recently addressed

- Added Admin Home Command Center.
- Added App Health and Schema Center.
- Added Admin Task Inbox.
- Added schema tracking table and schema status view.
- Added schema 106.
- Added role dashboard presets view.
- Updated `admin-directory` to load health/task/schema/command-center views.
- Added stronger local diagnostic dispatch for API timeouts/network failures.
- Retired reintroduced root legacy Markdown and test files again.
- Retired active `sql/VerifyDB_24_04_2026.sql` again.
- Updated smoke checks through schema 106.

## Watch items after deploy

- Confirm `#admin` does not timeout from reports.
- Confirm Command Center cards render.
- Confirm Health Center shows schema 106.
- Confirm Task Inbox does not error if there are zero rows.
- Confirm old `2026-05-10a` cache is gone after hard refresh.
- Confirm no missing script/style/icon asset appears in console.
