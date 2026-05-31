# Admin Directory Pagination and Saved Views

Last refreshed: **2026-05-20b**

## Purpose

This pass starts moving Admin lists away from one large payload and toward production-style list loading.

## Staff Directory

The Staff Directory now has:

- search box
- role filter
- page-size selector
- Previous/Next controls
- visible page label

The UI sends these values to `admin-directory`, and the Edge Function returns `pagination_meta.people`.

## Jobs foundation

`admin-directory` now accepts:

- `jobs_page`
- `jobs_page_size`
- `jobs_search`

It returns `pagination_meta.jobs`. The visible Jobs/Operations table controls are still a next-step item.

## Saved views

Saved admin views now store and replay Staff Directory filters:

- `people_search`
- `people_role_filter`
- `people_page_size`

This makes saved views more useful than a simple section shortcut.

## Remaining work

- Add visible Jobs/Operations pagination controls.
- Add sort selectors.
- Add panel-specific refresh paths.
- Move more people filtering into direct SQL-side paging for admin-wide lists.

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-05-30a pass: schema 124 accounting depth, equipment accountability, SEO/H1/CSS/smoke, and roadmap refresh. -->
