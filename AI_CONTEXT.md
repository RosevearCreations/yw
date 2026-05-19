# AI Context

Last refreshed: **2026-05-18b**

This repo is the YWI safety/jobs/accounting/admin app. The user expects every build pass to update code, SQL schema files, active Markdown, roadmap/gaps, SEO notes, CSS/mobile checks, and one-H1 verification.

## Latest pass summary

- Source ZIP: `yw-main(125).zip`.
- Output build should be labelled `2026-05-18b`.
- Added schema **115**.
- Main theme: Admin staged loading is now visible and retryable per panel.
- Edge Function fix carried forward: `report-subscription-delivery-run` must avoid literal multi-line newline strings that cause bundler parse errors.

## Active rules

- Keep no more than one H1 on exposed pages.
- Continue compact mobile navigation and Admin mobile table polish.
- Keep retired root Markdown out of active root; archive snapshots instead.
- Keep SQL references current and avoid unsafe `CREATE OR REPLACE VIEW` column renames.
