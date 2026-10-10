# Active Project Handbook

## Purpose

This is the durable operating handbook for the Yard Workers Inc. application. It describes current architecture and release rules only. Historical release narration belongs in Git/database history, not in this file.

## Application architecture

The protected staff application has four top-level modules: **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. I.T. Readiness is inside Admin. Shared Core owns authentication, profile/session state, common data contracts, navigation, offline behavior and permission-driven module loading.

## Profile, crew and reference-data lifecycle

Profile and crew reads are route-scoped rather than global startup work. **My Profile** may render the authenticated profile already held by Shared Core immediately, then refresh the self profile and time-clock context only while the Profile route is active. **Crew** reads occur only while the Crew route is active and the current access profile allows Crew visibility. Identical in-flight profile, crew, or time-clock reads are coalesced instead of duplicated.

Shared site, employee, supervisor, admin, position, and trade reference data uses a short bounded freshness window. Identical concurrent reference refreshes share one request; signing out or changing identity invalidates the cached set; a successful self-profile save invalidates it so future selectors can refresh. A failed refresh must not blank an already usable screen. Supabase auth-state callbacks must return control promptly; profile/API refresh work is deferred so application work does not hold the Auth callback lifecycle.

## Admin workspace architecture

Admin is a focused control center rather than one continuously loaded long-form page. Its home surface starts with **Needs Attention**, then permission-aware cards for **People & Access**, **Business & Operations**, **Safety & Evidence**, **Finance & Accounting**, **Diagnostics & Integrations**, **Audit & Security**, and **I.T. & System**. The Admin search control may jump directly to a known workspace or panel, and focused workspaces retain a breadcrumb/back path to Admin Home. Large legacy panels are progressively disclosed and may remember their open/closed state locally for operator convenience.

Admin presentation does not replace authorization. Cards are filtered by the current Admin access level, while every underlying read/write remains server/module enforced. Initial Admin entry loads only the bounded command-center scope; deeper directories, selectors, accounting, evidence, health, audit and configuration data are requested only when the operator opens the relevant workspace. I.T. Readiness remains a dedicated Admin route and must not initialize the heavy Admin Control Center merely because I.T. is opened.

The Admin home status language is concise and action-oriented: READY for current bounded evidence, ACTION when operator review is required, BLOCKED for failed/degraded runtime authority, and OPEN TO LOAD when evidence has not yet been requested. Needs Attention and recent audit activity are orientation aids only; they do not auto-resolve a task, change permissions, enable Finance/provider execution, mutate external Auth controls, close a release rail, or authorize Production promotion.

## Permission and safety boundary

A hidden screen is not a security boundary. Reads and writes remain server-enforced. Admin break-glass is explicit. Finance posting and provider mutation are fail-closed. Human accounting decisions, provider acceptance, content approval and staging acceptance stay human/external when their contracts require it.

## Online Help

`/help.html` is the maintained operator guide. It must remain usable on phone and desktop, contain exactly one H1, and stay `noindex`. The app header must expose a Help link. When workflows, public-search boundaries, staging mutation rules, Auth security evidence rules, next safe action rules, or important operator actions change materially, Help changes in the same source release.

## Auth security evidence boundary

Leaked-password protection and MFA options are controlled by the external Supabase Auth control plane. Current readiness may treat either control as secure only when recent authoritative evidence identifies the actual current state from the **Supabase Dashboard** or **Supabase Management API**, retains a durable evidence reference, and matches the secure state for that specific control. Manual notes, screenshots or other supporting context may be retained, but `manual_external` evidence is non-authoritative and cannot produce `verified_secure`. Advisor history, advisor snapshots, database catalogs, and absence of an advisor warning are also not substitutes for control-plane proof. Evidence is service-private and freshness-aware; stale evidence reopens verification. Application source changes must not mutate these Auth settings or auto-close their Current Admin To-Do follow-ups.

Before an external Auth observation is considered for recording, run `npm run auth:evidence:intake -- <input.json>`. The intake contract accepts only Supabase Dashboard or Management API provenance for the exact registered project, requires a recent observation and durable reference, derives the verification status from the control-specific observed state, rejects operator-supplied authority/status/expiry overrides, rejects secret-bearing capture fields, and stores only a SHA-256 digest of the supplied source capture in the record candidate. The candidate does **not** verify source authenticity, authorize a database write, mutate Auth, or close a follow-up. Genuine source provenance must still be confirmed.

### Auth evidence operator runbook

The preferred operator path uses the two manually separated GitHub workflows already in source. First, manually run **YWI Auth security evidence capture** from canonical `main` using `.github/workflows/auth-security-evidence-capture.yml`, wait for a successful completion, and retain the exact `capture_run_id` and `capture_run_attempt`. Independently confirm that the capture is genuine current official Supabase Management API evidence for the registered YardWeasels Production project before recording anything.

Then manually run **YWI Auth evidence authorized recording** from canonical `main` using `.github/workflows/auth-security-evidence-authorized-record.yml`. Recording is **one control per dispatch**: select exactly one of `leaked_password_protection` or `mfa_options`, supply the exact capture run ID and attempt, and provide `I_CONFIRM_AUTH_EVIDENCE_RECORD` plus `I_CONFIRM_OFFICIAL_SUPABASE_SOURCE` only after the source-authenticity decision is complete. Repeat the recording workflow separately for the second control when required. The workflow downloads only the exact encrypted capture artifact, decrypts and re-binds the selected candidate on the ephemeral runner, invokes the existing service-private recorder, and destroys the downloaded/decrypted workspace. Capture and recording must not automatically chain into each other.

After each recording, refresh **I.T. Readiness** under Admin → I.T. & System → Access & Security and confirm the freshness-aware current evidence authority reflects the expected control state. Do not mark a follow-up complete merely because a workflow ran. A successful workflow is evidence-processing execution, not independent proof that the external control is secure.

After genuine official-source authenticity is separately confirmed, the lower-level recorder remains `npm run auth:evidence:record -- <candidate.json>`. The recorder is intentionally fail-closed: it requires the exact Production Supabase URL/project binding, a service-role credential, `YWI_AUTH_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_AUTH_EVIDENCE_RECORD`, and `YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM=I_CONFIRM_OFFICIAL_SUPABASE_SOURCE`. The database RPC independently re-validates official provenance, project authority, freshness, reference, capture digest and control-specific state, derives status/expiry, writes idempotently, and the recorder immediately re-reads current Auth evidence authority. The command records evidence only; it does not change the Auth setting, auto-close a business rail, enable Finance/provider mutation, run staging acceptance, or promote Production.

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

## Supabase Data API access contract

YW must not depend on Supabase automatically granting new `public` tables to Data API roles. Every migration that creates a new `public` table from the current guarded migration boundary forward must declare its access posture in that same migration: enable RLS, explicitly GRANT only the privileges actually required, and explicitly GRANT or REVOKE `anon` / `authenticated` access so client exposure is intentional rather than inherited from platform defaults. Broad `GRANT ALL` to client roles is prohibited.

The permanent repository smoke gate runs `scripts/data-api-explicit-access-check.mjs` and fails closed for any guarded migration that creates a public table without RLS plus an explicit least-privilege access decision. Historical migrations remain audit history rather than being rewritten merely to satisfy the new source rule. Current Production privilege posture is checked separately from source migration linting; neither the lint nor a read-only privilege audit applies a schema change or authorizes Production promotion.

## SECURITY DEFINER function boundary

Database functions are part of the Data API permission surface. `SECURITY DEFINER` is exceptional because it runs with the function owner's authority and therefore must never become callable merely because PostgreSQL or Supabase supplied a default `EXECUTE` grant. New public functions use explicit opt-in execution: default `EXECUTE` is revoked for `PUBLIC`, `anon`, `authenticated`, and `service_role`, and each migration must make deliberate caller-role decisions.

Every new `SECURITY DEFINER` function in `public` must pin `search_path`, explicitly revoke `PUBLIC` execution, explicitly decide `anon`, `authenticated`, and `service_role` execution, and must not grant `PUBLIC` execution. Internal trigger, scheduler, permission, Finance, and service helpers stay non-browser-callable unless a separately reviewed API contract requires otherwise. Prefer `SECURITY INVOKER` where owner privileges are unnecessary; RLS or nested RPC use is not evidence that a helper itself needs a browser-callable Data API endpoint.

The permanent repository smoke gate runs `scripts/security-definer-execute-boundary-check.mjs`. Runtime verification is service-private through `v_it_security_definer_execute_boundary` and `ywi_security_definer_execute_boundary_assertions()`. A source gate does not alter Production by itself, and Production promotion remains deliberate.

## Data and release authority

Numbered SQL migrations are retained permanently as schema history. Live schema state is read from database authority views rather than copied here. GitHub source checks and service-private release-source evidence hold exact source/run proof.

Release-source evidence has three separate stages: the exact-main workflow writes a candidate, final verification proves the completed successful run plus current protected `main`, and deliberate recording persists that already-verified proof. After final verification, `npm run release:evidence:record -- <verified.json>` must perform a **fresh** GitHub run and current-main re-check, require the exact Production Supabase URL/project, service-role credentials, `YWI_RELEASE_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_RELEASE_EVIDENCE_RECORD`, exact current Production schema parity, and then use only the verified service-role recording RPC. The database derives `passed`; callers do not supply workflow status or detailed branch-policy truth. Raw release-evidence table writes and the legacy permissive recorder are not valid recording paths. The recorder hashes the verified payload, records run attempt and workflow path, immediately re-reads current release authority, and keeps detailed branch-policy verification false until separately proven.

Recording release-source evidence is not deployment or Production promotion. A verified/recorded source gate may coexist with repository-policy AMBER, external Auth follow-ups, human/provider/content acceptance, and staging/accounting blockers. Those rails stay separate and evidence-driven.

Production promotion is deliberate/manual. Source work must not enable Finance execution, provider mutation, mutate external Auth controls, publish unapproved content, submit search URLs externally, run staging acceptance against Production, or close human/external acceptance rails unless that specific change is separately authorized and evidenced.


## Production-learning renewal authority

Item 362 closes the 351–361 learning cycle. The durable review is `docs/production_learning_review_362.json`. Future autonomous releases should prefer measurable outcome loops over new disconnected dashboards: recommendation closure/recurrence, schedule recovery, route plan-versus-actual, renewal/churn, estimate accuracy, invoice/cash cycle time, labour capture completeness, downtime economics, material-use variance, communication outcomes, data-quality recurrence, mobile/read-budget trend, and four-season capacity/profitability mix.

The outcome-learning layer is never permission to mutate its source authority. A learning release may record bounded decision/outcome metadata when necessary, but it must not silently resolve Jobs/Safety/Equipment/Employment/CRM/Finance records, change customer/vendor commitments, send provider messages, post accounting, or weaken exact-source release evidence.

Item 363 implements that rule with a private Admin-manage decision/outcome journal keyed to canonical source identity. It stores recommendation/decision/outcome/recurrence/follow-up evidence only; source business payloads and source mutation remain outside the journal. Item 364 adds read-only Workability-to-Schedule recovery outcomes from existing Workability, Dispatch and Production evidence; missing recovery evidence remains unresolved, recorded Production duration is the only completed-capacity measure, and Workability/dispatch authority is unchanged.

Item 376 is implemented. The capability-level 363–375 review and the 14-item 377–390 queue are in `docs/production_learning_review_376.json`. Source-contract proof is not equivalent to measured Production improvement. Follow the revised active queue (starting 377) with real-denominator/missing-data gates and without new source-record write authority.

## Cross-AI autonomous handoff

When another AI system takes over YW, treat this handbook and `docs/NEXT_STEPS_AND_SANITY_CHECK.md` as the durable project authority. Resolve the live `dev` and `main` heads from GitHub at task start rather than trusting copied commit identifiers.

**351 — Management Metric Freshness & Confidence** is implemented. **352 — Autonomous Exception Triage & Next-Safe-Action** is implemented. **353 — Four-Season Capacity & Workability Forecast** is implemented. **354 — Route & Crew Efficiency Evidence** is implemented. **355 — Recurring Service Renewal & Retention Workbench** is implemented. **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented. **357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented. **358 — Materials, Consumables & Seasonal Stock Readiness** is implemented. **359 — Customer Communication Readiness & Queue Quality** is implemented. **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented. **361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented. **362 — Production Learning & Autonomous Roadmap Renewal** is implemented. **363 — Management Decision Outcome Journal & Learning Loop** is implemented. **364 — Workability-to-Schedule Recovery Outcomes** is implemented. **365 — Route Plan-vs-Actual & Stop-Sequence Learning** is implemented. **366 — Recurring Renewal Conversion & Churn Outcomes** is implemented. **367 — Estimate Accuracy & Change-Order Margin Calibration** is implemented. **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion** is implemented. **369 — Labour Capture Completeness & Payroll Exception Reduction** is implemented. **370 — Equipment Downtime Cost & Replacement Readiness** is implemented. **371 — Material Usage Variance & Reorder Calibration** is implemented. **372 — Customer Communication Outcome & Follow-Up Effectiveness** is implemented. **373 — Data Quality Remediation Outcome & Recurrence Prevention** is implemented.

Recently completed:
- **364 — Workability-to-Schedule Recovery Outcomes** (implemented)
- **365 — Route Plan-vs-Actual & Stop-Sequence Learning** (implemented)
- **366 — Recurring Renewal Conversion & Churn Outcomes** (implemented)
- **367 — Estimate Accuracy & Change-Order Margin Calibration** (implemented)
- **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion** (implemented)
- **369 — Labour Capture Completeness & Payroll Exception Reduction** (implemented)
- **370 — Equipment Downtime Cost & Replacement Readiness** (implemented)
- **371 — Material Usage Variance & Reorder Calibration** (implemented)
- **372 — Customer Communication Outcome & Follow-Up Effectiveness** (implemented)
- **373 — Data Quality Remediation Outcome & Recurrence Prevention** (implemented)
- **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes** (implemented)
- **375 — Four-Season Capacity Mix & Profitability Scenario Evidence** (implemented)
- **376 — Production Learning & Autonomous Roadmap Renewal II** (implemented)

The current autonomous queue continues with:

<!-- Historical item 370 queue marker retained for regression provenance: - **371 — Material Usage Variance & Reorder Calibration** -->
<!-- Historical item 371 queue marker retained for regression provenance: - **372 — Customer Communication Outcome & Follow-Up Effectiveness** -->
<!-- Historical item 372 queue marker retained for regression provenance: - **373 — Data Quality Remediation Outcome & Recurrence Prevention** -->
<!-- Historical item 373 queue marker retained for regression provenance: - **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes** -->
<!-- Historical item 374 queue marker retained for regression provenance: - **375 — Four-Season Capacity Mix & Profitability Scenario Evidence** -->
<!-- Historical item 362 queue marker: - **376 — Production Learning & Autonomous Roadmap Renewal II** -->
<!-- Historical item 376 queue marker: - **377 — Management Outcome Confidence & Cohort Trend** -->
- **377 — Management Outcome Confidence & Cohort Trend** (implemented)
- **378 — Workability Forecast-vs-Recovery Calibration** (implemented)
- **379 — Route Stop-Sequence Friction Hotspots by Season**
- **380 — Recurring Retention Cohort & Renewal Lag**
- **381 — Estimate Margin Drift & Change-Order Follow-through**
- **382 — Invoice Aging Handoff & Receivables Leakage**
- **383 — Labour Capture Exception Closure & Shift Readiness**
- **384 — Fleet Maintenance Cost Trend & Downtime Concentration**
- **385 — Material Demand vs Stockout Trend & Season Transition**
- **386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging**
- **387 — Data-Quality Fix Recurrence & Source Freshness**
- **388 — Offline Conflict Closure & Device-Safe Reliability Cohorts**
- **389 — Four-Season Crew-Day Mix Constraint & Scenario Backtesting**
- **390 — Production Learning & Autonomous Roadmap Renewal III**

The last queue item must again write at least ten further bounded autonomous items before promotion so the queue does not run out.

Ordinary roadmap work is non-interactive. Do not require the user to create a staging environment, provide provider credentials, execute manual acceptance scenarios, approve synthetic cases, send real messages, run real payments/refunds/disputes, enable Production provider rails, or manually sign off routine releases. If an external dependency is unavailable, keep external/provider mutation disabled and complete the safest repository-owned scope using existing operational evidence, deterministic source checks, synthetic fixtures and browser acceptance.

When the user says only `continue`, select the earliest still-valid unimplemented roadmap item. Historical handoff: After item 363, that item is 364 — Workability-to-Schedule Recovery Outcomes. Item 364 is now implemented; After item 364, that item is 365 — Route Plan-vs-Actual & Stop-Sequence Learning.
Current direction: After item 365, that item is 366 — Recurring Renewal Conversion & Churn Outcomes.
Current direction: After item 366, that item is 367 — Estimate Accuracy & Change-Order Margin Calibration.
Current direction: After item 367, that item is 368 — Completed-to-Invoiced Cycle-Time & Cash Conversion.
Current direction: After item 368, that item is 369 — Labour Capture Completeness & Payroll Exception Reduction.
Current direction: After item 369, that item is 370 — Equipment Downtime Cost & Replacement Readiness.
Current direction: After item 370, that item is 371 — Material Usage Variance & Reorder Calibration.
Current direction: After item 371, that item is 372 — Customer Communication Outcome & Follow-Up Effectiveness.
Current direction: After item 372, that item is 373 — Data Quality Remediation Outcome & Recurrence Prevention.
Current direction: After item 373, that item is 374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes. A proven security, data-integrity or release-truth defect may temporarily take priority, but repair it as a bounded prerequisite and then resume the queue.
Current direction: After item 374, that item is 375 — Four-Season Capacity Mix & Profitability Scenario Evidence. A proven security, data-integrity or release-truth defect may temporarily take priority, but repair it as a bounded prerequisite and then resume the queue.
Current direction: After item 375, that item is 376 — Production Learning & Autonomous Roadmap Renewal II. A proven security, data-integrity or release-truth defect may temporarily take priority, but repair it as a bounded prerequisite and then resume the queue.
Current direction: After item 376, that item is 377 — Management Outcome Confidence & Cohort Trend.
Historical completed-item handoff: After item 377, that item is 378 — Workability Forecast-vs-Recovery Calibration.
Current direction: After item 378, the next is 379 — Route Stop-Sequence Friction Hotspots by Season.
The current item is a 90-day, fail-closed, Jobs-permissioned aggregate comparison of proposed reschedule dates against actual full completion. At least five valid completed pairs are required for percentages and absolute day gap; no historical forecast snapshots exist, so outcomes are not forecast accuracy. No source writes or externally billed services. Larger SaaS expansion is sequenced in `docs/LANDSCAPING_SAAS_EXPANSION_377.txt` as non-active implementation work until each separate secure release. The 14-item renewal runs through item 390; missing Production outcome evidence is not success evidence.

For every ordinary release, use this sequence:

1. Verify current `dev` / `main` parity or understand an explicit promotion hold.
2. Inspect existing schema, functions, authority boundaries and tests before adding a parallel source of truth.
3. Branch from the accepted Development/Production baseline.
4. Implement one bounded operator/economic/reliability/seasonal improvement.
5. Add or update source acceptance and rendered/browser acceptance where behavior changes.
6. Update Help and roadmap authority in the same source release.
7. Open the feature PR into `dev` and follow the exact feature source through the canonical checks.
8. Repair failures without weakening branch protection, release evidence, security, permission or browser gates.
9. Merge the GREEN feature PR to `dev`.
10. Confirm the exact Development source is GREEN and preview deployment succeeds.
11. Open `dev` → protected `main` with no extra code changes.
12. Merge only after required Production PR checks pass.
13. Verify the exact resulting `main` merge source through source checks, repository enforcement, release-source evidence and release-truth summary.
14. Verify Vercel Production success on that exact Production source.
15. Verify authorized release-evidence recording, repository-policy evidence recording and post-promotion Development reconciliation.
16. Confirm final `dev` and `main` are identical before declaring the release GREEN.

Do not call a release GREEN because only Vercel succeeded. Exact-source GitHub evidence, browser acceptance, policy evidence and final branch reconciliation are part of release completion.

Keep the four-season Ontario model explicit: spring/summer landscaping and lawn work, fall cleanup/leaf collection, winter snow/storm/ice operations, and general four-season business functions. Do not claim a service is workable when source rules/evidence say conditions are unsuitable.

Preserve authority boundaries: Safety stays Safety authority; routing/dispatch stays Jobs authority; equipment lockout/return-to-service stays controlled; employee/private workforce information stays permission-scoped; Finance posting/payment/provider execution stays Finance/provider authority; read-only management/search/advisory layers must not silently become write authority. Do not infer employee performance from Safety incidents.

Do not modify Rosie Dazzlers or Devil n Dove while executing YW work unless the user explicitly switches projects.

## Hygiene rules

Keep only active files in the working tree. Temporary workflows, test-write files, backup/log files, retired Markdown, archive directories and generated schema snapshots are prohibited. Historical comments inside migrations are audit evidence and are not rewritten merely to remove old wording.