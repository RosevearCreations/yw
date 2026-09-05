# Active Project Handbook

## Purpose

This is the durable operating handbook for the Yard Weasels Inc. application. It describes current architecture and release rules only. Historical release narration belongs in Git/database history, not in this file.

## Application architecture

The protected staff application has four top-level modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. I.T. Readiness is inside Admin. Shared Core owns authentication, profile/session state, common data contracts, navigation, offline behavior and permission-driven module loading.

## Permission and safety boundary

A hidden screen is not a security boundary. Reads and writes remain server-enforced. Admin break-glass is explicit. Finance posting and provider mutation are fail-closed. Human accounting decisions, provider acceptance, content approval and staging acceptance stay human/external when their contracts require it.

## Online Help

`/help.html` is the maintained operator guide. It must remain usable on phone and desktop, contain exactly one H1, and stay `noindex`. The app header must expose a Help link. When workflows, public-search boundaries, staging mutation rules, Auth security evidence rules, next safe action rules, or important operator actions change materially, Help changes in the same source release.

## Auth security evidence boundary

Leaked-password protection and MFA options are controlled by the external Supabase Auth control plane. Current readiness may treat either control as secure only when recent authoritative evidence identifies the actual current state from the **Supabase Dashboard** or **Supabase Management API**, retains a durable evidence reference, and matches the secure state for that specific control. Manual notes, screenshots or other supporting context may be retained, but `manual_external` evidence is non-authoritative and cannot produce `verified_secure`. Advisor history, advisor snapshots, database catalogs, and absence of an advisor warning are also not substitutes for control-plane proof. Evidence is service-private and freshness-aware; stale evidence reopens verification. Application source changes must not mutate these Auth settings or auto-close their Current Admin To-Do follow-ups.

Before an external Auth observation is considered for recording, run `npm run auth:evidence:intake -- <input.json>`. The intake contract accepts only Supabase Dashboard or Management API provenance for the exact registered project, requires a recent observation and durable reference, derives the verification status from the control-specific observed state, rejects operator-supplied authority/status/expiry overrides, rejects secret-bearing capture fields, and stores only a SHA-256 digest of the supplied source capture in the record candidate. The candidate does **not** verify source authenticity, authorize a database write, mutate Auth, or close a follow-up. Genuine source provenance must still be confirmed.

After genuine official-source authenticity is separately confirmed, record only through `npm run auth:evidence:record -- <candidate.json>`. The recorder is intentionally fail-closed: it requires the exact Production Supabase URL/project binding, a service-role credential, `YWI_AUTH_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_AUTH_EVIDENCE_RECORD`, and `YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM=I_CONFIRM_OFFICIAL_SUPABASE_SOURCE`. The database RPC independently re-validates official provenance, project authority, freshness, reference, capture digest and control-specific state, derives status/expiry, writes idempotently, and the recorder immediately re-reads current Auth evidence authority. The command records evidence only; it does not change the Auth setting, auto-close a business rail, enable Finance/provider mutation, run staging acceptance, or promote Production.

## Next safe action authority

Current Admin To-Do is the unresolved-work authority. The derived next safe action queue may prioritize technically ready staging-acceptance items ahead of external, content/provider, and blocked accounting items, but priority is not permission to mutate.

A staging-ready candidate still requires the dedicated non-production staging environment guard and **exact current-schema parity** immediately before mutation and remains subject to human signoff. External Auth/GitHub follow-ups require current control-plane evidence. Content/provider work remains pending until its explicit approval/test evidence exists. Accounting acceptance remains blocked while Finance posting execution and payment-provider mutation are OFF. The priority layer must never auto-close a business rail, change Auth, publish content, enable Finance/provider mutation, or promote Production.

## Staging acceptance environment boundary

Staging acceptance is evidence collection, not Production business activity. Status/catalog information may be viewed from Production, but staging acceptance mutation must fail closed unless the running edge function proves that it is operating against the intended dedicated staging project.

Human staging acceptance mutation requires `YWI_RUNTIME_ENVIRONMENT=staging`, an exact `YWI_STAGING_PROJECT_REF` match to the current non-production project, and `YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED=true`. The registered Production project remains denied regardless of those variables. The UI must expose the current guard state and hide Pass/Fail, Finalize, and Signoff controls whenever mutation is locked.

Environment identity is only the first lock. The expected repository schema and latest applied staging schema must also match exactly before mutation is available. The historical Schema 187 scenario catalog remains the accepted case catalog, but it is not the current execution schema label. A staging database that is behind or ahead of source is not current and must remain fail-closed.

The manual runner retains an independent project-ref/confirmation guard, so a UI or environment misconfiguration does not become the only line of defense. Staging evidence, finalization, and human signoff never auto-close the underlying business rail.

For **quote/contact** staging acceptance, the runner may own only bounded disposable runtime evidence on the dedicated non-production project: reject an invalid no-consent request, create exactly one uniquely labelled STAGING request using an `example.invalid` contact, prove its matching created event, and delete only the exact verified staging row/event set. The public-key call must exercise the same unauthenticated quote/contact contract used by the website. A blocking human review remains required after runner evidence, and finalization/signoff stay explicit. The Operations Cockpit write-form round trip remains human-controlled rather than being replayed automatically.

If no dedicated non-production Supabase project or branch exists, source work may improve the runner but no live staging evidence may be claimed. Do not substitute the Production project, Production customer data, or a Production provider for missing staging infrastructure.

## Job lifecycle authority

Jobs follows a single operational sequence: **live update → execution proof → closeout**. The live update stage records field progress with explicit staff/customer visibility and an approved-public-media gate for customer-visible material. The execution proof stage captures arrival/completion evidence and internal labour, material and equipment context for authorized review. The closeout stage turns approved proof into a customer-safe summary/gallery, requires supervisor/customer decisions, and controls invoice-readiness, review-request and maintenance follow-up state.

The phone application must keep these stages touch-usable without horizontal overflow. The desktop application must keep the lifecycle reviewable as a coherent workbench while preserving internal decision context. The customer portal may display only customer-safe updates, approved proof and approved closeout material; internal costs, margin, staff notes and private review media remain staff-only.

Lifecycle feature migrations are permanent historical authority for the tables/RPCs they introduced. Current release/schema identity comes from the current database/release authority and must not be inferred from an older build or feature metadata stamp. The release workflow must run the live update, execution proof, closeout and combined job-lifecycle gates on every applicable change.

## Customer notification delivery authority

The customer notification delivery path for customer-visible live updates requires **explicit opt-in** before any email delivery attempt. Customer preference changes flow through the protected customer portal action. Notification preference, outbox and delivery-attempt records remain service-private; browser roles do not receive direct table access, and the Operations delivery queue must stay bounded so customer email addresses and portal tokens are not exposed merely to review delivery status.

Delivery is fail-closed. The dispatcher requires its explicit enable guard and run token, uses provider idempotency, and treats uncertain transport as **manual review** rather than success or an automatic retry. Retry is a deliberate staff action after review. Customer notification content may link back to the secure portal but must not include staff-only notes, private media, access details, internal costing or margin context.

Phone acceptance verifies that the customer consent preference remains understandable, touch-usable and overflow-free. Desktop acceptance verifies pending-consent, delivered and manual-review states without exposing private delivery identifiers. The historical notification migration remains feature history; current schema/release authority remains separate and current-derived.

## Public web/search boundary

The home page and approved service/location pages are search-oriented surfaces. Customer portal tokens, operational Help and internal application routes are not search landing pages.

`https://yardweasels.ca` is the canonical public authority for the operations application and its approved public routes. `https://ywiinc.com` is an established separate business website and must not become an automatic cross-domain canonical target. A future authority change requires deliberate page-equivalence review rather than a domain substitution.

Public pages require one H1, descriptive metadata, a canonical on the configured public authority, index/follow only on the canonical host, responsive layout, crawlable links, accessible images, approved content, and canonical-only sitemap entries with accurate freshness. Preview and other noncanonical hosts remain `noindex` while pointing canonically to the public authority. Vercel Preview `X-Robots-Tag: noindex` is an extra platform safeguard; application policy must still be correct independently.

The canonical origin and browser host-index policy are centralized in `js/app-config.js`. The static public-route generator reads that source and does not accept a deployment-time canonical-domain override. Static public route HTML is preferred so crawlers do not depend on client-side requests for primary content.

Search discovery must fail closed when route path, sitemap canonical, and rendered canonical disagree. Sitemap `lastmod` is a freshness signal and must reflect meaningful source/content change rather than merely a deployment timestamp; future-dated freshness is invalid. Structured data must mirror the visible page and current authority, including WebPage, Service, and BreadcrumbList semantics. Phone and desktop browser acceptance verifies these signals together with the one-H1 and no-overflow rules. External search-engine submission is explicit and separate from publication; IndexNow or Search Console submission must not be automatic and cannot bypass route/content approval.

## Mobile, PC application and webpage layout

- **Phone:** bottom module shortcuts, Today-first workflow, touch-friendly forms, local draft/offline guidance and no horizontal overflow. Today must distinguish offline, pending, conflict, and current sync states and must never auto-overwrite a local or server copy during conflict handling.
- **Desktop application:** full module navigation, wider workspaces, readable tables/cards and the same permission model as mobile. The Jobs workbench may search/filter rendered Saved Jobs for review, but those controls are presentation-only and must not mutate job records.
- **Public webpage:** responsive content/contact paths, one H1, stable canonical/metadata, crawlable content, canonical-host indexing only, accurate sitemap freshness, visible-content structured data, and no internal planning copy.

A restored network connection is not proof that local work synchronized. Queued forms, drafts, actions, and conflicts remain visible until server confirmation or deliberate operator review. Conflict review must preserve both local and current server state until a deliberate resolution path is chosen.

## Data and release authority

Numbered SQL migrations are retained permanently as schema history. Live schema state is read from database authority views rather than copied here. GitHub source checks and service-private release-source evidence hold exact source/run proof.

Release-source evidence has three separate stages: the exact-main workflow writes a candidate, final verification proves the completed successful run plus current protected `main`, and deliberate recording persists that already-verified proof. After final verification, `npm run release:evidence:record -- <verified.json>` must perform a **fresh** GitHub run and current-main re-check, require the exact Production Supabase URL/project, service-role credentials, `YWI_RELEASE_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_RELEASE_EVIDENCE_RECORD`, exact current Production schema parity, and then use only the verified service-role recording RPC. The database derives `passed`; callers do not supply workflow status or detailed branch-policy truth. Raw release-evidence table writes and the legacy permissive recorder are not valid recording paths. The recorder hashes the verified payload, records run attempt and workflow path, immediately re-reads current release authority, and keeps detailed branch-policy verification false until separately proven.

Recording release-source evidence is not deployment or Production promotion. A verified/recorded source gate may coexist with repository-policy AMBER, external Auth follow-ups, human/provider/content acceptance, and staging/accounting blockers. Those rails stay separate and evidence-driven.

Production promotion is deliberate/manual. Source work must not enable Finance execution, provider mutation, mutate external Auth controls, publish unapproved content, submit search URLs externally, run staging acceptance against Production, or close human/external acceptance rails unless that specific change is separately authorized and evidenced.

## Hygiene rules

Keep only active files in the working tree. Temporary workflows, test-write files, backup/log files, retired Markdown, archive directories and generated schema snapshots are prohibited. Historical comments inside migrations are audit evidence and are not rewritten merely to remove old wording.
