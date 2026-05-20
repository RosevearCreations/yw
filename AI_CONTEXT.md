# AI Context

Last refreshed: **2026-05-19a**

This repo is the YWI safety/jobs/accounting/admin app. Every pass must update code, SQL schema files, active Markdown, roadmap/gaps, SEO notes, CSS/mobile checks, and one-H1 verification.

## Latest pass summary

- Source ZIP: `yw-main(126).zip`.
- Output build label: `2026-05-19a`.
- Added schema **116**.
- Main theme: Admin staged loading now has an expandable diagnostics drawer, mobile-safe stale-data age badges, and failed panel load persistence through `admin-manage`.
- Carried forward previous deploy fix: `report-subscription-delivery-run` must avoid literal multi-line newline strings that cause bundler parse errors.

## Active rules

- Keep no more than one H1 on exposed pages.
- Continue compact mobile navigation and Admin mobile table polish.
- Keep retired root Markdown out of active root; archive snapshots instead.
- Keep SQL references current and avoid unsafe `CREATE OR REPLACE VIEW` column renames.
- Prefer small Edge Function scopes over the heavy Admin `all` scope.
