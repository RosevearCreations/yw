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
- **379 — Route Stop-Sequence Friction Hotspots by Season** (implemented)
- **380 — Recurring Retention Cohort & Renewal Lag** (implemented)
- **381 — Estimate Margin Drift & Change-Order Follow-through** (implemented)
- **382 — Invoice Aging Handoff & Receivables Leakage** (implemented)
- **383 — Labour Capture Exception Closure & Shift Readiness** (implemented)
- **384 — Fleet Maintenance Cost Trend & Downtime Concentration** (implemented)
- **385 — Material Demand vs Stockout Trend & Season Transition** (implemented)
- **386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging** (implemented)
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
Historical completed-item handoff: After item 378, the next is 379 — Route Stop-Sequence Friction Hotspots by Season.
Current direction: After item 379, the next is 380 — Recurring Retention Cohort & Renewal Lag.
Current direction: After item 380, the next is 381 — Estimate Margin Drift & Change-Order Follow-through.
Item 380 compares recorded agreement end-date quarterly cohorts and seasonal contexts against explicit renewed/declined decisions only, with signed decision lag, five-decision rate and lag thresholds, 365-day bounds and fail-closed query, coverage, permission and freshness states. Read-only, no messages or agreement changes.
Item 379 is a read-only 90-day route/season aggregation with full-production-start sequence completeness, two-day repeated-signal threshold, five-day percentage denominators, explicit permission/cap/freshness holds, and no GPS/rerouting authority.
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
After item 381, the next is 382 — Invoice Aging Handoff & Receivables Leakage.

After item 382, the next is 383 — Labour Capture Exception Closure & Shift Readiness.

After item 383, the next is 384 — Fleet Maintenance Cost Trend & Downtime Concentration.

After item 384, the next is 385 — Material Demand vs Stockout Trend & Season Transition.

After item 385, the next is 386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging.

After item 386, the next is 387 — Data-Quality Fix Recurrence & Source Freshness.

Item 387 implements bounded read-only source-key recurrence in the existing management command panel. It uses the canonical quality scan and private decision journal, dates non-overlapping 30-day and preceding 60-day cohorts, distinguishes recurrence after recorded fixes, shows Ontario decision-month seasonal context and rejects stale/partial/hidden/undated sources. Five unique quality keys are required per measured cohort. Recorded decisions are not historic scans, and this release has no destructive reconciliation authority or Production improvement claim.

After item 387, the next is **388 — Offline Conflict Closure & Device-Safe Reliability Cohorts**.

After item 388, the next is **389 — Four-Season Crew-Day Mix Constraint & Scenario Backtesting**.

Item 388 adds read-only, browser-local, profile-isolated evidence of conflicts awaiting explicit review and a capped 7/23-day record of manual recovery choices. Local removal is not server delivery, absent history is not zero incident risk, no central device tracking is introduced, and the existing replay read/write authority boundaries and budgets remain unchanged. Browser source acceptance, mobile UI acceptance and Help are required in the same release.

After item 389, the next is **390 — Production Learning & Autonomous Roadmap Renewal III**.

Item 389 adds a read-only current 14-day shared crew-day seasonal mix and constrained-date review plus a 90-day retrospective dated Dispatch-to-full-Production comparison. Multiple matches and capped/missing/stale/hidden sources are withheld. Current live calendars cannot be treated as archived forecast snapshots, mixed-season crew-days are review candidates rather than proven collisions, and no invented shift length or Profitability target is permitted. The next roadmap-renewal item must record real evidence and queue at least ten new bounded builds.

## Item 390 Production-learning renewal and first-use execution queue

Item 390 is implemented. Read `docs/production_learning_review_390.json` before accepting a new performance or profit-improvement assertion. Dated aggregate counts for ten inspected Production tables were zero on 2026-10-13; that is not a statement about all company activity or other uninspected systems. The outcome-evidence state is unknown and must be rechecked with authorized live sources at usage time. No synthetic Production records or fabricated ROI can fill these gaps.

Operator-facing explanation: `/help.html#production-learning-roadmap-renewal-iii`. Owner Management contains an informational link only, not a second data source. This item does not deploy new Supabase backend logic; the exact `main` Edge Function source must still be verified against the live function before GREEN.

Next queued: **391 — First-Use Readiness & Verified Data Intake**.

Renewed authorized queue:
- **391 — First-Use Readiness & Verified Data Intake** — Show an operator-facing first-use checklist driven by actual empty/nonempty canonical data and explicit module access. Recheck reads without fabricated sample rows; no writes. Boundary: Read-only readiness first; no auto-creation, default business seed or write bypass.
- **392 — Customer & Property Guided Record Creation** — Reuse authorized CRM customer/property forms and existing duplicate warnings; verify one save, edit, lookup and permission-denied browser flow against exact existing write authority, without automatic import. Boundary: Any create/edit must use existing authorized forms; no duplicate customer creation or external contact.
- **393 — Four-Season Service Template & Price Source Validation** — Expose season/service-specific existing price and unit source validation, missing-rate warnings and Canadian tax context; do not invent rates or publish prices. Boundary: Configuration review only; no live price change or invoice write.
- **394 — Crew Availability & Dispatch Conflict Gate** — Test job assignment against actual crew availability, overlapping dispatch, ready vehicles and configured schedules using the existing Jobs authority, no auto-rescheduling. Boundary: No automatic route editing, personnel reassignment or dispatch.
- **395 — Workability Safe Schedule Recheck** — Require recorded Ontario conditions, workability decisions and Safety permission for schedule-review readiness, never override a hold or automatically dispatch. Boundary: Safety and operator workability decision remain final; no autonomous scheduling.
- **396 — Job Start/Stop & Production Evidence Capture** — Make one mobile job session path legible with a pending/saved/retry/error acknowledgement and linked completion evidence; no duplicate sessions on repeated clicks. Boundary: Existing production writes only with explicit user action; immutable idempotency evidence.
- **397 — Safety & Equipment Readiness Preflight** — Before an active job, surface canonical site hazard, training and equipment lockout readiness, with explicit blocked/unavailable instead of auto-clearing. Boundary: No Safety approval, lockout removal or employment change through this layer.
- **398 — Material Issue & Return Reconciliation** — Link job-level estimated and actual material quantities to canonical stock issue/return actions; preserve unit, cost and audit provenance and no negative stock assumption. Boundary: No automatic purchase, receipt, stock adjustment or supplier interaction.
- **399 — Visit Completion, QC & Customer-Safe Evidence** — Guide crew proof capture through supervisor QC, customer-safe visibility and deficiency correction; never impersonate a customer or auto-approve signoff. Boundary: No automatic customer approval, external message or image disclosure.
- **400 — Estimate/Change Order to Invoice Readiness** — Connect recorded estimate, approved change-order application and work completion to a Finance review-ready invoice packet; Finance writes remain separately permissioned. Boundary: No posting, collection, external accounting provider or tax remittance.
- **401 — Receivables Aging & Payment Reconciliation** — Show authorized aging, deposit allocation and payment reconciliation exceptions from existing Finance records, without creating or posting payment transactions. Boundary: Finance authority and payment providers unchanged; reconciliation review only.
- **402 — Recurring Renewal & Season Rollover Readiness** — Review four-season agreement renewal dates, overlapping site work and winter rollover prerequisites; require operator confirmation for canonical renewal actions. Boundary: No unattended auto-renewal, communication or payment.
- **403 — Offline Replay Receipt & Provenance Confirmation** — Add profile-bound offline replay receipt evidence tied to canonical server acknowledgements; local queue removal alone is not server success, no cross-device identifiers. Boundary: No automatic conflict merge/retry or cross-profile replay.
- **404 — First Operational Cohort Measurement & Conversion Funnel** — Only with genuine samples and complete fresh sources, show first-job funnel denominators from customer intake through dispatch, session, closeout and invoice, and withhold small cohort comparisons. Boundary: No employee ranking or inferred customer effect; minimum-sample and freshness gates.
- **405 — Production Learning & Autonomous Roadmap Renewal IV** — Review measured first-use evidence and outcome gaps, publish the next >=10 bounded releases; never report improvement without dated comparable Production events. Boundary: No additional mutations or external authorization grants.
- **406 — First-Customer Intake Receipt & Duplicate-Safe Review** — Demonstrate permissioned first-customer intake receipt and existing duplicate review on a real operator-provided example; withhold status when no dated customer record exists. Boundary: No automatic customer creation, duplicate merge, or broad-profile disclosure.

Item 406 extends existing permission-scoped CRM reads with matched original `clients.id` and `created_at` intake receipts. A fresh complete query and exact directory ID match are required to display one; an empty authoritative read is not a synthetic first customer. The CRM operator may recheck and review exact-name/email candidates, but there is no automatic duplicate merge, user creation, message, role grant or payment. Creating an actual customer remains explicit through the existing authorized guided form. `admin-directory` must be published with unchanged JWT verification and compared byte-for-byte to the released GitHub source; the frontend-only Vercel deployment is insufficient.

- **407 — Property & Four-Season Coverage Evidence** — Reconcile one real customer-owned property to its seasonal work types without inferring winter or summer readiness from missing agreements. Boundary: No site mutation, enrollment or plan renewal without operator action.

Item 407 adds source-bounded, permission-scoped ownership joins and site-specific recurring service agreement evidence to the existing CRM. Only active, dated, site-linked agreements can be marked recorded by season; paused/draft/undated and customer-only plans do not prove coverage and no recorded agreement proves operational or winter readiness. The authenticated CRM panel is strictly read-only with explicit recheck; no property, schedule, Finance, communications or role writes. Its matching `admin-directory` Edge Function source and JWT verification are mandatory production gates.

- **408 — Estimate Acceptance to First Work Order Trace** — Show explicit customer acceptance, internal approval and first work-order identity with missing approvals marked unavailable. Boundary: No automatic estimate acceptance, pricing or work-order issuance.
Item 408 adds an operator-triggered, read-only estimate → work-order trace using three separate complete canonical source reads; a customer quote acceptance needs an actual dated quote-package receipt, requested internal approval needs a dated authorizer, and the first work-order identity must be the earliest dated, owner-matched original work order. Any failed/capped/stale, mismatched or ambiguous source withholds evidence, while status-only approval claims are held for review. Existing Jobs authorization and supervisor rank remain enforced; no estimate acceptance, pricing, issuance or other write is introduced. Verify the exact deployed admin-directory source with JWT enabled after release.

- **409 — First-Dispatch Schedule Receipt** — Match an authorized first work order to a dated noncancelled schedule; show unresolved resource/workability exceptions separately. Boundary: No unattended dispatch, weather override or staff assignment.
Item 409 adds a strictly read-only supervisor Jobs receipt across canonical estimate, first work-order, dispatch and Workability source reads. Only fresh, complete and identity-consistent dates and source-approved order evidence are eligible for a first noncancelled schedule receipt. It reports recorded crew and resource conflicts separately from workability restrictions, treats missing observations as unverified, and never assumes that a scheduled time means work was actually dispatched or safe. No personnel, weather, scheduling, customer, Finance or provider write is introduced. Deploy and compare matching `admin-directory` Edge Function source with JWT verification enabled before GREEN.

- **410 — Production Start and Return-Visit Proof** — Reconcile first-job scheduled visit to an actual dated started session, partial completion and return-visit evidence. Boundary: No synthetic session or automatic completion.
The first-job production evidence enhancement adds an authorized read-only receipt for the actual first started session tied to the first noncancelled dispatch, dated field capture, explicit partial work and independent return-visit recorded proof. All source reads must be uncapped, fresh and customer/site consistent; no fake start or automatic completion. The owner also requires service-specific modules for landscaping, small construction, water parks, snow removal, snow plowing and septic, sharing all existing CRM, Jobs, Finance, employees, equipment, inventory and other core services. The company service-entitlement architecture and staged adoption contract are described below; company-offering toggles are proposed and not yet implemented.


### Service-offering modules and integrated shared company backbone

**Owner architecture requirement:** One integrated, company-scoped service business platform with independently enabled or disabled services. These are desired business capabilities, NOT claims that new specialist modules or company-service switches are already operational.

## Service offerings (future independently selectable module keys)

| Key | Service module | Service-specific activities and controls |
|---|---|---|
| landscape | Landscaping, lawn and grounds | Mowing, planting, irrigation, recurring grounds maintenance, seasonal work |
| construction | Small construction and repairs | Estimates, phases, permits, change orders, subcontractors, construction safety |
| water_parks | Water parks and aquatic facilities | Inspections, cleaning, chemical/water checks, downtime and maintenance proof |
| snow_removal | Snow removal and de-icing | Walkway clearing, shoveling, ice treatment, snow events, salt usage |
| snow_plowing | Snow plowing | Trucks/plows, equipment hours, multi-site routes, site priorities, plow passes |
| septic | Septic and vacuum services | Tank visits, pumping volume, disposal/haulage receipts, vehicle and safety checks |

Snow plowing and snow removal are separate offerings but share equipment and dispatch where appropriate. No duplicate costs or invoices for one job/asset.

## Shared, authoritative backbone (must not fork by module)

- One customer/contact record, owned properties and site/zone history, even where multiple services are offered at the same property.
- One estimate/quote/approval/work-order/change-order lifecycle, consistent jobs, pricing templates, service codes, deposits, invoices, receivables, payments and Finance approvals.
- One dispatch calendar and route, workability, crew availability, timekeeping, seasonal coverage and incident/safety evidence authority, supplemented with module-specific requirements.
- One employee identity and role/permission backbone; module-specific competency, training and HSE attestations remain mandatory.
- One equipment, fleet, tools and consumables inventory. Shared asset IDs record assignment, inspection/lockout, checkouts, actual usage, material consumption, job cost, maintenance and inter-service availability. No implicit deductions, transfers or override.
- Shared job sessions, production quantities and execution proofs, completion/QC, return visits, safety checks, audit logs and customer-safe documents all reference canonical work-order and company/property IDs.

## Separate company offering switches (proposed — not deployed)

A company-level \`company_service_modules\` record should provide \`company_id\`, \`module_key\`, \`enabled\`, timestamps and auditing. Company offering availability controls *new* service bookings/forms and new module-specific writes, enforced in server authorization independently of employee module-role permissions. Disabling a service must not delete or conceal authorized historical customer/property records, change invoices, strand unfinished work or bypass safety/financial obligations. Ensure tenant isolation, migration of existing service availability, and rollback-safe cutover.

Existing Jobs/Finance/Safety role module permissions are not a substitute for these company offering flags. No new flags or tables are created by the current production evidence enhancement.

## Controlled rollout plan

1. Audit existing organisation/tenant identity, pricing templates, service names, work-order types and current cross-module dependencies.
2. Implement auditable company service-entitlement registry, owner toggles and enforcement with idempotent migrations and existing-service-safe defaults.
3. Bind public/private service catalog, quote wizard, admin navigation, staffing/roles and accounting codes to enabled services. Keep shared Customer, Equipment and Finance surfaces accessible based on their normal permissions.
4. Add specialist field forms and compliance requirements service by service: landscaping; small construction; water parks; snow removal; snow plowing; septic.
5. Acceptance tests: one customer with multiple services; seasonal work; shared truck/attachment usage; technician certification; stock consumption; disabling a service with open jobs; historic invoices and QC readback; separate approval boundaries.

**the current production evidence enhancement scope:** an authenticated read-only receipt showing actual first-session production starts, separate field capture/unfinished work and explicit return-visit proof. No synthetic work session, customer communication, automatic completion, service module toggles or Finance mutation.

- **411 — Material and Equipment First-Job Trace** — Distinguish recorded actual materials/equipment from estimates on the same first-job identity with caps and permission checks. Boundary: No inventory correction, lockout override or job-cost posting.
- **412 — Quality-Control Closeout Evidence** — Show first-job QC, supervisor approval and customer-safe proof completeness without substituting planned steps for completed evidence. Boundary: No automatic signoff, customer message or review request.
- **413 — Invoice Readiness and Candidate Provenance** — Link approved first-job closeout to Finance candidate identity with explicit missing and approval states. Boundary: No posting an invoice, collection, payment or external provider call.
- **414 — First Invoice Receivable Confidence** — Verify actual non-void first invoice presence and the authoritative receivable state only for permissioned, complete samples. Boundary: No charge, receipt allocation or customer follow-up automation.
- **415 — Seasonal First-Use Cohort Coverage** — Show season-specific first-use denominators only when dated, fully linked and sample-supported. Boundary: No performance attribution, staff ranking or zero assumption.
- **416 — Owner First-Use Trial Acceptance Workbench** — Provide a bounded owner acceptance checklist for each canonical first-use handoff and record unresolved evidence gaps without fake demo success. Boundary: No unattended seed data, external outreach, or account-role change.
- **417 — Production Learning & Autonomous Roadmap Renewal V** — Review actual comparable first-job outcomes, withhold claims when denominators are inadequate, and renew another bounded queue. Boundary: No autonomous business transactions or unauthorized data access.

Preserve the established protected-main exact-source GitHub/Vercel/Edge Function verification, final Development reconciliation and the original Jobs, Safety, Employment, CRM, Equipment and Finance write authorities. No unattended real customer/provider communications, payments, invoices, payroll posting or destructive reconciliation.

After item 391, the next is **392 — Customer & Property Guided Record Creation**.

Item 391 adds an Owner Management first-use record-presence checklist from existing authenticated, permission-scoped `source_freshness` evidence: CRM customers/properties, crews, equipment, jobs, dispatch, Production sessions and recurring visits. Fresh uncapped query-success `no_rows` is a truthful empty read at its retrieval timestamp, not proof of absent activity elsewhere or permission to auto-populate. Hidden/stale/expired/failed/capped/undated signals stay unverified. Refresh is disabled while in flight, reuses the existing backend, and never seeds or changes records. Phone Help and source/browser acceptance run in CI. Existing Jobs/CRM module authority is unchanged.

After item 392, the next is **393 — Four-Season Service Template & Price Source Validation**.

Item 392 adds CRM guided customer/property creation and editing through existing authenticated `crm_client_save` / `property_site_save` authoritative operations only. The frontend searches current CRM data for name/email and client-owned name/address potential duplicates; it blocks obvious matches but does NOT guarantee uniqueness under races or unknown source coverage. Submit buttons show Saving… and lock against extra requests until backend acknowledgment and readback; if acknowledgment/readback is uncertain the UI says so and asks for verification before retrying. Existing backend `jobs` approve/write boundary, profile rank and audit remain authoritative. It makes no automatic external messages, contract, work order or Finance records.


## Four-season pricing source review

The Admin read-only four-season review uses the authorized Jobs directory's `service_pricing_templates`, `tax_codes`, and `business_tax_settings`. Operators select spring/summer, fall, winter, or four-season, refresh authoritative current records, and inspect missing/nonpositive recorded charges, missing units/duration basis, pricing method, and tax source mismatches. Season classification is advisory from the currently recorded template name/code/job-family/scope/pattern, not a new canonical season. No template, estimate, invoice, price or tax record is written. Missing/denied sources fail closed; no invented prices or tax status.


## Workability schedule recheck boundary

The Admin workability recheck is read-only. It calls the authorized `workability` directory with a forced fresh read and correlates exact `dispatch_schedule_item_id` observations, latest canonical supervisor decisions, existing dispatch/workability holds, and linked HSE packet monitoring. Recorded Ontario conditions older than 24 hours or later than the present, missing source links, a blocking decision, or incomplete mandatory HSE monitoring produce HOLD. An explicitly loaded current-profile Safety module permission of `approve` or `manage` is required even for a favourable advisory result; role-only defaults never qualify. Caution and restriction guidance remain operator review. Even a complete result means operator recheck only, not safety approval, work authorization, dispatch, notice, or schedule mutation. No additional tables or write endpoints are introduced.


## Mobile production capture and retry authority

The Today mobile crew Start/Finish flow uses `mobile-production-transition`, a JWT-verified Supabase Edge Function that authenticates the current staff profile, requires Jobs create module access and an assigned dispatch, and calls the service-role-only `ywi_rpc_mobile_production_transition` (Schema 237). The RPC serializes work-order transitions, atomically writes to the existing canonical production session RPC, and stores immutable `intent_key` acknowledgements in an RLS-enabled service-only ledger. Repeated keys replay the original evidence; the start path also reuses an existing active work-order session. Finish requires the confirmed existing session ID, records the completion note, and is safe to retry. Mobile buttons display saving/saved/not confirmed, retain the key after a network ambiguity, and expose the canonical session ID and Execution Proof follow-up. The browser does not directly write the ledger and cannot authorize dispatch or lift workability holds. The migration and Edge Function must be verified active in YW Supabase before the mobile UI is released; the Vercel frontend deployment by itself does not deploy Supabase functions.


After item 405, the next is **406 — First-Customer Intake Receipt & Duplicate-Safe Review**.

Item 405 uses the dated, privacy-safe six-source count snapshot in `docs/production_learning_review_405.json`. All six inspected Production tables returned zero rows as of 2026-10-16; 90-day client creation count was zero. No outcome gains, conversion percentage, ROI or company-wide inactivity are claimed. The next 12 builds (406–417) remain bounded to original CRM, Jobs, Dispatch, Production, QC and Finance authorities. Item 405 introduced no database/RPC/permission changes or customer/provider actions.


## Item 417 — dated learning review and roadmap renewal V

Read-only YW Production inspection at 2026-10-19 23:27 Toronto: zero rows in six inspected operational tables and zero client entries in the prior 90 days. This is not a census of unrelated tables or external systems. Although Builds 406–416 have been merged to Production code, actual first-job conversion or ROI cannot be measured without genuine dated customer/job events. A guarded, descriptive-only cohort comparator rejects missing permissions, stale/incomplete/capped sources and denominators below ten. **No first-job improvement or ROI is claimed.** Exact count report: `docs/production_learning_review_417.json`; 12 bounded new releases: `docs/NEXT_STEPS_AND_SANITY_CHECK.md`. **Next queued: Item 418 — First Live Trial Source Coverage & Owner Acceptance.** No schema, user permissions, customer messages, Finance postings or source authority changed in Item 417.


## Item 418 — live first-use source coverage and manual owner review

A new Admin owner workbench uses only the already authorized `owner_first_use_trial_acceptance` scope. It verifies dated first-customer, owned-property, unique first-order and ten canonical handoff identities; caps, freshness and unresolved evidence are fail-closed. Operators may manually copy a **follow-up-with-gaps** receipt. Only if all ten source checks are verified, and an owner explicitly checks confirmation and types ACCEPT, can a **manual unsigned clipboard acceptance candidate** be copied. Nothing is stored, signed or approved by the server. An empty original CRM/Jobs source remains no live trial; no synthetic customer, dispatch or Finance changes. Read more in `/help.html#first-live-trial-418`.

Existing Safety, Finance, Jobs and Admin authority stays separate. No automatic Production action; all actual business changes require deliberate operator workflows, with provider calls and Finance posting fail-closed/OFF until separately authorized. **Next proposed item: 419 — Company Service Offering Entitlement Inventory.**


## Item 419 — Company Service Offering Entitlement Inventory (read-only)

The source-audited dated aggregate inspection is available at `public/data/company-service-inventory-419.json` and Admin → Management/Operations → Company Service Offering Entitlement Inventory; see `/help.html#company-service-inventory-419`. On October 20, 2026 22:53 UTC, sampled Production source facts were four enabled **permission-driven platform modules** (Admin/Jobs/Finance/Safety), four active service pricing templates, and zero customers, properties, work orders, estimates, recurring agreements and service contract documents in the inspected tables. The nine inspected CRM/Jobs/Pricing/contract/backbone tables expose no tested `company_id`, `tenant_id`, `organization_id` or `workspace_id` column. These bounded findings do not establish complete tenant isolation, all contracts or company service entitlement state.

All six proposed specialist offerings (`landscape`, `construction`, `water_parks`, `snow_removal`, `snow_plowing`, `septic`) have **company entitlement not verified**. The four platform module enable flags and active pricing template rows must not be misinterpreted as those six company flags. This is a static timestamped audit with no live company/tenant APIs, database writes, migrated data or role changes; no enabled offering is invented. **Next queued Item 420 — Audited Company Service Offering Registry:** explicit migration-reviewed owner company switches, tenant/RLS isolation, independent staff access, historical CRM/Jobs/Finance/Safety read continuity, rollback and audit before any new-work write enforcement. Normal Safety, Finance, Jobs and Admin authority remains unchanged.

 
## Item 420 — Audited Company Service Offering Registry

An additive, independently permissioned registry lives in the reviewed SQL file \`sql/company_service_offering_registry_420.sql\`. Owner-company identity is derived from the authenticated \`auth.uid()\`, not from browser role metadata. The company registry is deliberately **separate** from the unpartitioned existing Shared Core CRM, Jobs, Finance and Safety records. Six company-owned service offering rows are seeded **disabled by default**, and enabling/disabling one requires a deliberate owner action and a trigger-recorded append-only audit event. RLS grants only that company's owner selected read/create/toggle privileges; there are no anonymous grants or normal-client audit writes. A fresh, verified authenticated owner session and six complete source rows are required by the Admin frontend, which withholds on source failure or tenant mismatch.

The owner page is Admin → Company Service Registry, with help at \`help.html#company-service-registry-420\`. Migration rollback file \`sql/company_service_offering_registry_420_rollback.sql\` refuses destructive rollback after any business/audit history. Never automatically associate legacy customers/contracts/estimates/work orders with new company IDs: an owner switch is **not** a staff privilege or new-work authorization; Item 421 must implement separately audited company-scoped new-work authorization before routing specialist service creation. Existing jobs, agreements and invoices remain visible under their original permissions even after a company service is disabled.


## Item 421 — New-Work Service Entitlement Enforcement

The production SQL `sql/company_new_work_entitlement_421.sql` adds company + service identity to **new** canonical Estimates and Work Orders and installs BEFORE INSERT triggers that reject missing identity, disabled company offerings, the wrong owner, inactive profiles or missing independent Jobs permissions. No staff role or platform-module grant can substitute for the company service entitlement. When a work order references a source estimate, their company and service must match. Scoped rows cannot be silently reassigned. Every successful new draft produces a server-owned append-only new-work authorization receipt; disabled-company attempts fail atomically.

Existing historical unscoped estimates, jobs, contracts, customers, safety and finance data are not modified, partitioned or cancelled by the migration. The current legacy Shared Core customer/site records lack company ownership attributes, so **all new scoped estimate and work-order customer/site association is withheld** until Item 422 independently establishes tenant-scoped ownership and record continuity. In particular, the newly added Admin guided form creates owner-authorized, company-scoped drafts *without* customer/site, dispatch, invoices or payments. Older creation paths that omit the company and service are not compatible and are deliberately rejected for new work—do not weaken this check to regain convenience. Existing operational historical work stays on its original source authority. The guarded empty-only rollback is `sql/company_new_work_entitlement_421_rollback.sql`. User help is at `help.html#new-work-entitlement-421`; both static and rendered browser tests are CI-gated. Next queued Item 422 — Cross-Service Customer & Property Continuity.

## Item 422 — Cross-Service Customer & Property Continuity

The additive source `sql/company_customer_property_continuity_422.sql` retains canonical customer (`clients`) and property (`client_sites`) records, with small tenant-ownership *links*, not replacement CRM tables. Only authenticated, active company owners holding independent Jobs permissions can create new linked canonical records; browser reads are restricted by RLS and the server-owned links cannot be added or changed by arbitrary client writes. Existing unscoped customers, properties, jobs, agreements and invoices are not backfilled or claimed from matching names. The verified owner can explicitly attach the pair to a previously unlinked company draft, subject to the original enabled-service, Jobs-create and source-estimate guards. Linked customer/property assignment is one-time, immutable and requires the property belong to that customer; disabled services continue to show their original scoped history but cannot authorize new work. A bounded owner RPC returns verified property records and service-specific Estimate/Work Order history without exposing other companies or internal financial records. No dispatch, customer message, Finance posting or provider call follows these actions. The Admin panel is at `help.html#cross-service-continuity-422`; source and responsive browser tests are CI-gated. Next queued Item 423 — Shared Equipment & Materials Allocation Proof.

**Production promotion ancestry:** Merge the tested `dev` → protected `main` PR using a **merge commit**, not squash or rebase. A squash/rebase can leave both branches with identical application files but divergent ancestry; the exact-main post-promotion workflow must refuse force-pushing to repair that condition. If it occurs, submit a separate reviewed, protected merge-commit reconciliation PR; never rewrite branch history or bypass release evidence. The workflow now reports a specific identical-tree/divergent-history diagnostic while retaining its fail-closed behavior.

## Item 423 — Shared Equipment & Materials Allocation Proof

The additive SQL `sql/shared_equipment_material_allocation_proof_423.sql` creates only an owner-scoped, append-only allocation evidence receipt with unique source identities. The **authoritative** material source remains `material_issues` plus `material_issue_lines`; the authoritative equipment source remains `equipment_signouts` plus `equipment_items`. Server-verified company work orders must already have Item 422 linked original customers/properties. Recording requires active company ownership, Jobs create authorization, enabled specialist service, material job-use issue status/plan/quantity validation or a verified equipment checkout with no safety lockout or overlapping checkout. Subsequent changes in the original source turn the fingerprinted receipt into **HOLD**, never silent reallocation. A repeat unchanged receipt is idempotent; the same source cannot be attributed to another work order or company. The Admin owner screen is at `help.html#shared-allocation-proof-423`. The display's source issue amounts are **not** new job costs or a claim of field consumption; equipment evidence is **not** automatic hours/cost. This build makes no inventory movements, GL entries, invoice, dispatch, safety unlock, staff entitlement or legacy-data claim. Capped/foreign/partial data is withheld. All browser and source checks remain mandatory. **Next queued: Item 424 — Landscaping Field Production Evidence.**

Deployment note: The live Supabase connector required the reviewed SQL to be applied as ordered, successful migrations (`shared_allocation_423_receipt_and_guards`, `shared_allocation_423_record_authority`, `shared_allocation_423_owner_dashboard`, and `shared_allocation_423_immutable_receipt_guard`) after a single oversized migration call timed out without changing schema. The one-file source is complete/idempotent for new environments. Live verification confirmed RLS enabled, zero proof rows, browser INSERT/UPDATE denied, anonymous RPC denied, the immutable-receipt trigger and both owner RPC functions present. Operational acceptance remains synthetic until the first original issue/checkout is actually recorded; empty ledgers are not a fabricated successful allocation.

## Item 424 — Landscaping Field Production Evidence

Item 424 binds **owner-attested, dated field observations** to one original `job_session_production_quantities` source each. The canonical Jobs `work_orders`, Production `job_sessions`, measured work, original `client_site_zones`, Execution Proof and QC runs remain in their original tables. The owner-scoped `ywi_landscape_field_receipts_424` receipt saves the production source ID, session/date, original producing profile, zone, server-side attesting account/time, factual observation, optional matching-session existing proof/QC IDs and source fingerprint. One unique source receipt can be recorded; repeated identical evidence is idempotent. Later canonical source/zone/session edits display HOLD, never an automatic measured-work correction. Only an active company owner with Jobs create rights and an enabled **landscape** service can append an observation to an explicitly linked company property; other specialist modules cannot enter this workbench. The optional QC reference conveys **no QC acceptance**, and the owner attestation does not impersonate the field operator. The original production author must already be present. UI and Help live at `help.html#landscape-field-evidence-424`, SQL at `sql/landscaping_field_production_evidence_424.sql`; source and mobile-browser tests are release-gated. This build cannot complete jobs, approve QC, sign Safety requirements, change inventory/payroll, create Finance entries or issue invoices. Live empty-source cases remain unverified, not successful operations. **Next queued: Item 425 — Construction Phase, Permit & Change Control.**

## Item 425 — Construction Phase, Permit & Change Control

Construction companies can append a phase reference to the **original** company-scoped Jobs work order and original plan line; it is not a second job or authorization. An authenticated active owner with Jobs create permission and enabled construction service may append one immutable permit reference by phase, category and original reference, recording an observed date, factual field notes and a *reported*, independently unverified permit status. Optional original Safety plans and change orders must belong to that work order; site Safety must match its property. The dashboard shows original supervisor stop-work status, signed Finance release/threshold and real original change-order supervisor/customer approvals and budget applications. Missing approval produces HOLD; original-source changes yield a fingerprint HOLD requiring manual reconciliation. Even when an original source is marked reviewed, no permit certification, work release, price/contract change, Finance posting or invoice occurs. The reviewed SQL is `sql/construction_phase_permit_change_control_425.sql`, operator Help is `help.html#construction-phase-permit-425`, and source/mobile-browser tests are mandatory. Live original construction, change-order, Safety and release evidence counts were all zero during implementation; synthetic acceptance does not assert a live job was completed.

Item 426 adds a bounded Admin aquatic inspection and follow-up workbench (`help.html#water-park-inspection-426`) for original company-owned `water_parks` Jobs work orders, requiring original customer/property continuity, active service entitlement, independent Jobs create permission, and same-order/site optional Safety plan. Immutable dated inspections record factual areas, referenced source logs, reported concern/closure states and optional measured pH/sanitizer/temperature without automatic safety-threshold decisions. Immutable follow-up receipts capture original action references and operator-reported progress. The original Jobs/Safety fingerprint holds on changes; any reported closure or concern and missing/pending/stop-work Safety remain HOLD. Follow-ups do not clear closure, grant reopening, dose chemicals or certify regulatory compliance. Both tables deny direct client writes; RPCs are active-owner guarded and source-capped. Reviewed SQL: `sql/water_park_inspection_safety_evidence_426.sql`, browser/source regression mandatory. Synthetic fixtures never imply actual live aquatic inspections. **Next queued: Item 427 — Snow Removal & Plowing Event Separation.**

### Item 427 — Snow Removal & Plowing Event Separation

Original company Jobs work orders retain distinct `snow_removal` and `snow_plowing` entitlements and surfaces, while original `seasonal_storm_events` and storm-route activations remain a common historical event link. An append-only RLS receipt uniquely attributes one original `dispatch_schedule_items` row to one offering and a matching storm route, preventing duplicate source attribution across services. Workability/weather, Fleet truck readiness, same-property Safety and original Jobs/Dispatch/storm fingerprints remain source-owned; changed sources or missing approval surface HOLD, never an automatic crew dispatch, safety sign-off, job completion, weather exception or charge. Owner-scoped Admin and Help are at `help.html#snow-service-events-427`; source/mobile-browser release tests mandatory. Real Production snow events require independent field evidence before operational acceptance.

## Item 428 — Septic Haulage & Disposal Receipt Control

The canonical Jobs order must belong to an owned company with enabled `septic` entitlement and a linked customer/property. The original Dispatch provides the named operator/supervisor and assigned truck; measured tank volume in litres has a method, measurement source, waste stream and collection date. The disposal artifact is an **existing uploaded media record** attached to an original Jobs execution proof on that order/dispatch, paired with facility, disposal date and actual receipt number. Owner-reported evidence is immutable and deduplicated by source image and company/facility/receipt number; unchanged replay is idempotent. Snapshot fingerprints allow changed Jobs/Dispatch/Media/Fleet/Safety sources to become HOLD without rewriting original entries. Missing or blocked original truck readiness or unapproved Safety holds are explicit. Only owner READ is allowed on the receipt table, with an authenticated guarded RPC for recording and dashboard. The Admin/Help surface is `help.html#septic-disposal-428`; source/mobile-browser tests gate release. These artifacts do not certify facility or operator licensing, environmental regulatory compliance or actual legal waste disposal; no autonomous removal/dispatch, job completion, safety sign-off or Finance booking is made. Production has no genuine field cohort evidence yet. **Next queued: Item 429 — Production Learning & Cross-Service Trial Review VI.**

## Item 429 — Production Learning & Cross-Service Trial Review VI

A dated read-only Supabase Production SQL aggregate at **2026-10-23 16:00 UTC** found zero rows in **seventeen explicitly inspected** original CRM/Jobs/Production/Dispatch/AR/Company and 421–428 specialist evidence tables. Zero in these named sources is not a statement about every app module or external provider, and source-complete first-job trials have not yet occurred. Consequently, cross-service first-job conversion, staff effects, savings, safety compliance, and ROI are **not measured**. `docs/production_learning_review_429.json` contains source-by-source counts and withholding reasons, without retrieving any original customer, staff, property or receipt contents.

The pure comparator `js/cross-service-first-job-review-429.mjs` demands two fresh authorized complete uncapped nonoverlapping source periods for the **same original company**, original customer/property/Jobs work-order evidence, verified company service entitlement and distinct first-job identity. Six service streams (`landscape`, `construction`, `water_parks`, `snow_removal`, `snow_plowing`, `septic`) retain their own denominators and chronology. A service needs at least ten genuine first jobs **in each period** to show any descriptive stage-rate comparison; later stages below ten stay withheld. A bad source, foreign tenant, duplicate/repeated first job or stale/failed/capped/partial query fails closed. Differences are observations only, not causal improvement; there is no cross-service weighted ROI, employee score or automatic action. The Owner cockpit has a notice with Help at `help.html#production-learning-cross-service-429`, with source and phone browser tests in protected CI.

The next prioritized **13 bounded releases (430–442)** are in `docs/NEXT_STEPS_AND_SANITY_CHECK.md`, beginning with genuine operator trial/source coverage before expanding service-specific capture, scheduling, costing or customer billing. These are proposed scopes rather than already deployed functions or proof of measurable value. No database schema/RLS/role, company service toggle, work order, dispatch, Safety, Finance, messaging or payment changed here. **Next queued: Item 430 — Six-Service Owner Trial Intake & Source-Coverage Runbook.**

## Item 430 — Six-Service Owner Trial Intake & Source-Coverage Runbook

The authenticated Admin owner now has a read-only six-service trial screen. It uses the original Item 420 company/entitlement data and 422 guarded canonical customer and property/job history to guide one genuine, selected customer's intake. Sign in, set up a real company and its intentionally disabled-by-default service offerings in 420, create/select real CRM customer and property in 422, create an entitled original Jobs draft in 421 under independent server permission, attach existing customer and site in 422, and refresh the new 430 six-service source coverage. Each service independently holds for a disabled offering, missing customer/property or missing original work order. A linked work order remains **owner review required**, not completion, QC, regulatory Safety, dispatch or first-use success. Subsequent evidence belongs to 424 landscaping, 425 construction, 426 aquatic, 427 snow removal versus plowing and 428 septic disposal, with existing independent handoffs. Auth, foreign tenant, stale source, duplicate/capped original reads fail closed. No new SQL/schema, RLS, company toggle, customer/job, field proof, Finance, payment or email/SMS write was made by this screen. Phone browser and pure regression tests run through protected CI. The October 23 Production Item 429 sample still does not establish any genuine first-job outcome. Next is Item 431's canonical site intake review.

## Item 431 — Service-Specific Intake Templates & Verified Site Constraints

Admin Management's `431 · Service-Specific Intake & Verified Site Constraints` adds six factual, separately scoped intake guides after the 430 owner runbook. First refresh the authenticated 420 owner company/entitlements, choose an existing 422 owner-linked canonical customer, then choose one of that customer's **original `client_sites` property IDs**. The new `ywi_rpc_site_intake_431(company,client,site)` returns only bounded original site-profile/active-zone facts for a company owner whose Jobs view permission and exact original customer/property link were already proven by 422; its narrow `SECURITY DEFINER` bridge preserves the existing browser-denied property tables and does not expose unrelated customers or Safety detail. Operator controls never write the site, invent dimensions or create new work. A missing source is shown as MISSING, not a negative hazard finding. Recorded original `property_reviewed_at` and `access_last_verified_at` indicate recorded review events and are not fresh independent reinspection or Safety sign-off. Even if every field is present, independent Safety, permit, inspection, Dispatch, Fleet and specialist completion remain **UNVERIFIED/HOLD**. Owner must use original authorized Safety, CRM and specialist workflows for real decisions. A disabled service stays disabled. CI covers tenant boundary, source caps, missing facts, six templates, no business writes, mobile presentation and Help. New SQL must be separately deployed to the configured Supabase project and its owner-only callable behavior checked before the panel can display verified source records. Historic Item 429 sample did not evidence a genuine first job. Item 432 follows with canonical estimate/job reconciliation.

## Item 432 — Cross-Service Estimate-to-Authorized-Job Handoff Audit

Admin Management now exposes `432 · Cross-Service Estimate → Authorized Job Audit` for a selected actual company, original customer and linked original property. The authenticated read-only `ywi_rpc_estimate_job_handoff_432(company,customer,property)` uses 422 owner/Jobs/active CRM link guards and returns bounded original `estimates`, quote-package acceptance dates, internal approvals, canonical estimate line scope/price, recorded deposit status, 421 company/service creation receipts and the linked original `work_orders` with base lines and independent Jobs release reviews. The screen requires an enabled 420 service, dated original customer quote acceptance and terms-version record (not merely `estimates.status='accepted'`), any required internal approvals, deposit coverage, original conversion ID/time, exact company/service/customer/property continuity, line/price parity, non-draft work order and signed `released`/`pass` status. A missing, ambiguous or diverging source is HOLD; denied, stale, duplicate, capped or foreign identity is WITHHELD. The previous authorization still governs historical work when an offering is later disabled; the current disabled offering never authorizes *new* work. Green source alignment is only `SOURCE RELEASE TRACED` for review and does not sign a customer agreement, dispatch, work, Safety, permit, payment, Finance invoice or specialist certificate. Operator must use the original appropriate Jobs/Safety/Dispatch and 424–428 workbenches; no business data, signature or authorization is written by this audit. Supabase migration and narrow authenticated execute grant are release prerequisites. Source and 390px mobile browser checks protect these boundaries. No verified first-job outcome is claimed from the previously empty Production sample. **Next: Item 433 mobile field acceptance.**

## Item 433 — Mobile Field Evidence Capture & Offline Replay Acceptance (guarded candidate)

The Today screen now offers `433 · Field Photo & Document Capture / Offline Replay`: an authenticated field-worker control that obtains only original server-filtered Dispatch/Jobs assignments and keeps phone JPEG, PNG, WebP and PDF files in profile-isolated IndexedDB. Each local capture is bounded, SHA-256 fingerprinted against its original work order, and keyed with a single durable intent ID so repeated selection of the same file does not create a second local receipt. IndexedDB capture does not send a file to the server, change a job, or constitute a source receipt. Unconfirmed and confirmed states remain distinct, and signout clears the active assignment selector. This is device-local data that can disappear when browser storage is cleared.

**Release boundary:** A request timeout does not prove an upload failed. Existing binary-upload Edge Functions use newly generated paths and are not idempotent proof-media replay targets. The UI therefore **does not enable upload/replay** until the original `work_order_execution_proof_media` backend exposes a permissioned, verified idempotent lookup and upload adapter. A later adapter must reconcile by durable intent and file digest first, then return the owner, work order and existing execution-proof/media IDs, with no duplicates. The client guard refuses a noncanonical/missing/foreign acknowledgement and preserves the local file. Item 433 source/phone tests simulate this boundary without making business writes or asserting real device performance. Backend readiness and actual mobile-field capture/replay acceptance remain open operational requirements; releasing this guarded client does not claim that the complete server media flow is GREEN.
## Item 434 — Service Dispatch, Crew, Workability & Safety Preflight Review (release candidate)

In Admin Management, the owner selects a genuine 420 company, 422-linked customer/property and an original Jobs work order. The narrowly scoped `ywi_rpc_job_dispatch_preflight_434` reads up to 20 exact-work-order Dispatch records, original crew/crew-member directory, resource conflict count, linked assigned equipment and Fleet readiness/expiry, exact-dispatch weather observation, signed supervisor workability decision and work-order HSE packet. Source-side 422 owner, Jobs-view and active customer/property checks are not relaxed. The operator sees per-dispatch HOLD and REVIEW reasons, never an automated clearance. Missing or contradictory original work order release, schedule, crew, asset readiness, weather or HSE evidence cannot become a green authorization; foreign, denied, stale, malformed or capped source remains WITHHELD. Safety, permits, site restrictions and 424–428 specialist requirements are still independent. The added screen and SQL make no customer, dispatch, Jobs, Fleet, workability-decision, Safety, Finance or notification writes. Migration deployment and owner-authenticated source verification are prerequisites, followed by 390/430-width acceptance and protected main CI. Item 433 must finish its feature → dev → main release first; after successful 434 production promotion, Item 435 addresses shared resource allocation conflicts.

