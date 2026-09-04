# Active Project Handbook

## Purpose

This is the durable operating handbook for the Yard Weasels Inc. application. It describes current architecture and release rules only. Historical release narration belongs in Git/database history, not in this file.

## Application architecture

The protected staff application has four top-level modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. I.T. Readiness is inside Admin. Shared Core owns authentication, profile/session state, common data contracts, navigation, offline behavior and permission-driven module loading.

## Permission and safety boundary

A hidden screen is not a security boundary. Reads and writes remain server-enforced. Admin break-glass is explicit. Finance posting and provider mutation are fail-closed. Human accounting decisions, provider acceptance, content approval and staging acceptance stay human/external when their contracts require it.

## Online Help

`/help.html` is the maintained operator guide. It must remain usable on phone and desktop, contain exactly one H1, and stay `noindex`. The app header must expose a Help link. When workflows, public-search boundaries, or important operator actions change materially, Help changes in the same source release.

## Public web/search boundary

The home page and approved service/location pages are search-oriented surfaces. Customer portal tokens, operational Help and internal application routes are not search landing pages.

`https://yardweasels.ca` is the canonical public authority for the operations application and its approved public routes. `https://ywiinc.com` is an established separate business website and must not become an automatic cross-domain canonical target. A future authority change requires deliberate page-equivalence review rather than a domain substitution.

Public pages require one H1, descriptive metadata, a canonical on the configured public authority, index/follow only on the canonical host, responsive layout, crawlable links, accessible images, approved content, and canonical-only sitemap entries with accurate freshness. Preview and other noncanonical hosts remain `noindex` while pointing canonically to the public authority. Vercel Preview `X-Robots-Tag: noindex` is an extra platform safeguard; application policy must still be correct independently.

The canonical origin and browser host-index policy are centralized in `js/app-config.js`. The static public-route generator reads that source and does not accept a deployment-time canonical-domain override. Static public route HTML is preferred so crawlers do not depend on client-side requests for primary content.

Search discovery must fail closed when route path, sitemap canonical, and rendered canonical disagree. Sitemap `lastmod` is a freshness signal and must reflect meaningful source/content change rather than merely a deployment timestamp; future-dated freshness is invalid. Structured data must mirror the visible page and current authority, including WebPage, Service, and BreadcrumbList semantics. Phone and desktop browser acceptance verifies these signals together with the one-H1 and no-overflow rules. External search-engine submission is explicit and separate from publication; IndexNow or Search Console submission must not be automatic and cannot bypass route/content approval.

## Mobile, PC application and webpage layout

- **Phone:** bottom module shortcuts, Today-first workflow, touch-friendly forms, local draft/offline guidance and no horizontal overflow.
- **Desktop application:** full module navigation, wider workspaces, readable tables/cards and the same permission model as mobile.
- **Public webpage:** responsive content/contact paths, one H1, stable canonical/metadata, crawlable content, canonical-host indexing only, accurate sitemap freshness, visible-content structured data, and no internal planning copy.

## Data and release authority

Numbered SQL migrations are retained permanently as schema history. Live schema state is read from database authority views rather than copied here. GitHub source checks and service-private release-source evidence hold exact source/run proof.

Production promotion is deliberate/manual. Source work must not enable Finance execution, provider mutation, publish unapproved content, submit search URLs externally, or close human/external acceptance rails unless that specific change is separately authorized and evidenced.

## Hygiene rules

Keep only active files in the working tree. Temporary workflows, test-write files, backup/log files, retired Markdown, archive directories and generated schema snapshots are prohibited. Historical comments inside migrations are audit evidence and are not rewritten merely to remove old wording.
