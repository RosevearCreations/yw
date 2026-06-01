# Admin Panel Refresh and Job Actions

Last refreshed: **2026-06-01a**

## Purpose

The Admin app was growing into a full backend manager, but many controls still reloaded the full Admin directory. This pass adds narrower refresh paths and a dedicated Jobs review table.

## Added behavior

- Staff Directory can refresh with `scope: people`.
- Jobs/Operations can refresh with `scope: operations`.
- Health/Command Center can refresh with `scope: health`.
- Guided Close can refresh with `scope: accounting`.
- Jobs review rows expose Open, Complete, Cancel, and Add Note actions.

## Mobile requirement

Jobs row actions must stack cleanly on phone-width screens and avoid a long horizontal action strip.

## Deploy requirement

Redeploy `admin-directory` and `admin-manage` after applying schema 113.

<!-- 2026-05-29a pass: Schema 123 equipment verification, accounting-depth, SEO/H1, CSS, fallback, and roadmap sanity refresh. -->

<!-- 2026-06-01a pass: schema 125 deployment bundle parse repair, SEO/local checks, fallback guardrails, jobs-manage fix, jobs-directory attachment dedupe, cache marker, and roadmap refresh. -->
