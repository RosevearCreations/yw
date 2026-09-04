# Next Steps and Sanity Check

## Restart checkpoint

Start every work session from current `dev` and `main`, then verify that their application trees are synchronized before opening another feature branch. Read current schema/release truth from I.T. Readiness rather than historical documentation.

## Required sanity checks

Before new feature work, verify `dev`/`main` parity, current schema drift, release authority separately from repository enforcement, intended Finance/provider fail-closed state, Current Admin To-Do truth, Auth security evidence freshness, no accidental business-rail closure, repository/Help/SEO/browser gates, staging acceptance mutation lock state, and removal of temporary branches/workflows/files after release proof.

## Auth security evidence sanity check

Treat leaked-password protection and MFA as external Supabase Auth configuration. Verify each setting with recent authoritative external evidence before considering its follow-up resolved. Do not infer either setting from PostgreSQL catalogs, a historical security-advisor row, or the absence of a current advisor warning. Stale evidence requires re-verification, and application source work must not change the Auth setting or auto-close its Current Admin To-Do item.

## Staging acceptance mutation sanity check

Treat Production staging-acceptance mutation as prohibited. Status/catalog reads may be available there, but Pass/Fail evidence, Finalize, and Signoff must remain locked.

Before any human staging evidence is recorded, verify all three current runtime conditions: `YWI_RUNTIME_ENVIRONMENT=staging`, `YWI_STAGING_PROJECT_REF` exactly matches the intended non-production Supabase project, and `YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED=true`. The current project must not be the registered Production project. The I.T. staging panel must visibly report the environment guard as enabled before mutation controls are used.

The manual staging runner has its own project-ref/confirmation guard and remains manual-only. Never use a Production project, real customer data, Production payment, or Production provider mutation as staging evidence. Evidence/signoff does not auto-close the business rail.

## Public web and Help review

Every release that changes navigation, workflows, public pages, or public-search behavior must update `/help.html` in the same change. Public/indexable pages retain one H1, current metadata, canonical URLs on `https://yardweasels.ca`, crawler-ready content, canonical-only sitemap entries with truthful freshness, structured data that mirrors visible content, and responsive phone/desktop rendering. Portal and Help surfaces remain `noindex`.

Treat `https://ywiinc.com` as a separate established business website, not an automatic canonical destination. Noncanonical and preview application hosts remain `noindex` while pointing canonically to yardweasels.ca. Verify the canonical-host, canonical-conflict, and preview/noncanonical rendering cases in browser acceptance. A disagreement between approved route path, sitemap canonical, and rendered canonical fails closed to `noindex` until corrected.

Sitemap `lastmod` must represent meaningful source/content freshness rather than simply the deployment date and must never be future-dated. Public route structured data should expose matching WebPage, Service, and BreadcrumbList semantics without contradicting the visible H1, title, description, route or provider. External search-engine submission is a separately configured action; do not automatically call IndexNow or Search Console and never use submission as a substitute for content approval.

## Remaining work selection

Choose the next technical feature from a fresh I.T. Readiness / Current Admin To-Do review. Do not invent autonomous work merely to increase a score. Rails classified as human, accounting, provider, content or staging acceptance remain open until their actual evidence exists.

Repository protection remains a separate enforcement concern from application release authority and should stay visible until GitHub reports it as enforced.

## Module and Production boundary

The four top-level modules are **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** remains inside Admin rather than becoming another top-level module.

Production promotion remains deliberate/manual and separate from application source readiness.
