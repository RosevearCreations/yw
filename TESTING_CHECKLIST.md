# Testing Checklist

Last refreshed: **2026-05-19b**

## Local/static checks

- Run JavaScript syntax checks.
- Run `node scripts/repo-smoke-check.mjs`.
- Confirm `index.html` has no more than one H1.
- Confirm CSS braces are balanced.

## Admin live checks

- Open `#admin` after hard refresh.
- Confirm staged scope status cards appear for Command Center, Health, People, Operations, Accounting Close, Banking, Tax/Payroll, and Evidence.
- Press Retry Evidence and confirm only evidence rows reload.
- Press Retry Accounting and confirm Accounting Close rows reload without a full Admin reload.
- Confirm failed panel loads are visible in diagnostics.
- Confirm status-changing buttons show a confirmation prompt.

## Mobile checks

- Compact main menu expands/collapses.
- Admin section menu remains compact.
- Scope cards, age badges, Jobs row actions, Evidence tables, and Guided Close rows do not create awkward horizontal overflow beyond intentional table scrolling.
