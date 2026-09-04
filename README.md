# Yard Weasels Inc. Operations Platform

This repository contains the Yard Weasels Inc. staff operations application, customer portal, and approved public service-page publishing layer.

## Current product boundary

The staff application has four top-level modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** is an Admin workspace, not a fifth top-level module. Module access is permission-driven and server-side write authority remains fail-closed.

The public layer consists of the home/contact surface and approved service/location routes. Customer quote links use the separate token-protected customer portal.

## Operator help

Current in-app guidance is maintained at **`/help.html`** and linked from the application header. Help covers sign-in/recovery, mobile workflow, the four modules, offline/sync behavior, customer portal privacy, public-search authority, staging safety, Auth security evidence, and troubleshooting. The Help page is intentionally `noindex` so operational guidance does not compete with public service content in search.

## Public search and SEO contract

**`https://yardweasels.ca` is the canonical public authority for this application and its approved service/location routes.** The established `https://ywiinc.com` business website remains a separate public presence; do not point application canonicals there unless a deliberate future mapping proves that an equivalent destination page exists and the authority decision is intentionally changed.

Public/indexable pages must have exactly one rendered page-level `H1`, responsive mobile and desktop layout without horizontal overflow, a useful title and meta description, a canonical URL on the configured public authority, index/follow directives only on the canonical public host, crawlable links, approved content, canonical-only sitemap entries with truthful freshness in `lastmod`, and accessible image alternative text. Customer portal and operational Help surfaces remain `noindex`. Preview/noncanonical hosts must remain `noindex` while retaining canonicals to the public authority. Vercel Preview protection is treated as an additional platform safeguard, not the sole indexing control.

The canonical origin and rendered host-index policy are centralized in `js/app-config.js`. The static public-route generator reads that authority rather than accepting a deployment-time canonical-domain override. Static public route HTML remains the preferred crawler path; the browser route renderer is a fallback and must preserve the same canonical, indexing, and one-H1 rules.

Sitemap discovery must agree with the approved route path and canonical URL. Home freshness is derived from source/content history rather than simply stamping the deployment date, and published route `lastmod` values must be valid and non-future. Public structured data mirrors the visible page using WebPage, Service, and BreadcrumbList semantics. A route/canonical disagreement fails closed to `noindex` until corrected. External search-engine submission is a separate explicit action; this application does not automatically submit URLs to IndexNow or Search Console and must never use submission to bypass route/content approval.

## Staging acceptance safety boundary

Human staging evidence is allowed only in a deliberately configured non-production Supabase project. The Admin staging-acceptance status/catalog may be read in Production, but staging acceptance mutation must remain locked there.

A staging acceptance mutation requires all three runtime conditions at once: `YWI_RUNTIME_ENVIRONMENT=staging`, `YWI_STAGING_PROJECT_REF` matching the exact current non-production project ref, and `YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED=true`. The known Production project is an explicit deny even if staging variables are misconfigured. Pass/Fail evidence, finalization, and signoff remain unavailable while the guard is locked.

The manual staging runner independently refuses the Production project ref and still requires its existing staging confirmation variables. Staging acceptance evidence never auto-closes a scorecard rail; human signoff and later release closure remain separate deliberate actions.

## Auth security evidence contract

Leaked-password protection and MFA are Supabase Auth control-plane settings and therefore require **recent authoritative external evidence** before either follow-up can be treated as secure. Historical advisor rows, advisor snapshots, and the absence of an advisor warning are not sufficient proof of the current setting. Auth security evidence is service-private, freshness-aware, and remains separate from application release authority; source changes do not mutate these external Auth settings or auto-close their Current Admin To-Do items.

## Release and readiness truth

Do not copy release SHAs, workflow run numbers, or historical build numbers into active documentation. Current source/release authority belongs in GitHub and service-private I.T. release views. Current database version belongs in `v_schema_drift_status` / `app_schema_versions`.

The I.T. **Production readiness** panel is a current derived authority, not a manually maintained prerelease checklist. It derives from live schema drift, exact-source release authority, repository enforcement, scorecard classification, Current Admin To-Do, public Help/search authority, and Finance/provider execution safety. Retired production-readiness/foundation rows remain available only through historical readiness audit so old instructions cannot become current work again.

Production promotion remains deliberate/manual. Finance posting execution and payment-provider mutation remain OFF unless a separately authorized release explicitly changes those controls. Human accounting/provider/content/staging acceptance work must not be auto-closed by source changes.

## Repository hygiene

Git history and numbered migrations are the audit trail. Do not recreate archive folders, temporary patch workflows, backup files, generated full-schema snapshots, or release-handoff Markdown. The active Markdown set is intentionally limited to this README plus the two files in `docs/`.

## Development checks

`npm run test:repo` verifies repository hygiene and durable documentation rules. `npm run test:it` verifies I.T. authority, including current-readiness versus historical-audit separation. `npm run test:auth-security-evidence` verifies the Auth security evidence authority, freshness rules, advisor-versus-authoritative proof boundary, Current Admin To-Do derivation, and safety invariants. `npm run test:staging-environment-guard` verifies Production denial, explicit staging enablement, endpoint/UI lock behavior, durable guidance, and preservation of human-gated rails. `npm run test:help-seo` verifies Help/search/H1/static search controls. `npm run test:search-discovery` verifies canonical/sitemap parity, freshness, structured data, fail-closed conflicts, and the no-automatic-submission boundary. Rendered browser acceptance includes phone and desktop Help/app/public-page layout checks plus canonical-host, canonical-conflict, noncanonical-preview indexing behavior, and staging environment lock behavior.
