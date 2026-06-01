# Admin Operations Pagination and Sorting

Last refreshed: **2026-06-01a**

## What changed

The Admin screen now has production-style list controls for both Staff Directory and Jobs/Operations.

## Staff Directory

Staff controls include search, role filter, sort, direction, row count, previous, and next. The UI sends `people_page`, `people_page_size`, `people_search`, `role_filter`, `people_sort`, and `people_sort_dir` to `admin-directory`.

## Jobs/Operations

Jobs controls include search, sort, direction, row count, previous, and next. The UI sends `jobs_page`, `jobs_page_size`, `jobs_search`, `jobs_sort`, and `jobs_sort_dir` to `admin-directory`.

## Saved views

Saved admin views now preserve and replay Staff Directory and Jobs/Operations filters.

## Backend guardrails

`admin-directory` uses allowlists for sort columns so the UI cannot send arbitrary database column names.

## Next work

Add true panel-only refresh buttons and a dedicated Jobs review table with row actions.

_Reviewed in the 2026-05-17a pass for schema 112 documentation consistency._

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
