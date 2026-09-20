# Next Steps and Sanity Check

## Restart checkpoint

Start every work session from current `dev` and `main`, then verify that their application trees are synchronized before opening another feature branch. Read current schema/release truth from I.T. Readiness rather than historical documentation.

When Production promotion is deliberately on hold, treat the resulting `dev`/`main` divergence as an explicit release boundary rather than silently force-synchronizing branches. New Development work must still start from the accepted `dev` head, and `main` must remain unchanged until promotion is separately authorized.

## Required sanity checks

Before new feature work, verify `dev`/`main` parity or an explicitly documented promotion hold, current schema drift, release authority separately from repository enforcement, intended Finance/provider fail-closed state, Current Admin To-Do truth, Auth security evidence freshness and provenance, next safe action classification, no accidental business-rail closure, repository/Help/SEO/browser gates, staging acceptance mutation lock state, and removal of temporary branches/workflows/files after release proof.

## Admin workspace sanity check

Treat Admin Home as an orientation surface, not permission to fetch or execute the entire administrative backend. On initial entry, the browser should load only the bounded Admin command-center scope. Deeper people/access, operations, safety/evidence, accounting, diagnostics/integrations, audit/security, selector and configuration reads should occur only after the operator opens the corresponding focused workspace.

The Admin home must keep **Needs Attention** first, followed by permission-aware cards for **People & Access**, **Business & Operations**, **Safety & Evidence**, **Finance & Accounting**, **Diagnostics & Integrations**, **Audit & Security**, and **I.T. & System**. Admin search may jump to a known workspace/panel. Focused workspaces retain a breadcrumb/back path, and large panels remain progressively disclosed so the page does not return to an unstructured long-scroll layout.

Verify that view-only Admin access cannot reveal manage-only cards, and remember that hiding a card is presentation only: all actual authorization remains server/module enforced. Opening I.T. Readiness must route to the dedicated I.T. screen rather than booting the heavy Admin Control Center. Status chips and Needs Attention summaries are advisory; they must not auto-close work, change permissions, enable Finance/provider execution, mutate Auth, sign off staging, or promote Production.

## Profile, Crew and reference data sanity check

Opening **My Profile** should show the authenticated profile record immediately when it is already available, then refresh the self profile and time-clock context only while the Profile route is active. Opening Profile must not preload Crew. **Crew** reads should occur only on the Crew route and only for an access profile that may view Crew. Repeated identical in-flight Profile, Crew, or time-clock reads should resolve through one shared request rather than producing duplicate network work.

Shared site, employee, supervisor, admin, position and trade reference data should be reused within its short bounded freshness window. Verify a forced refresh can bypass freshness when deliberately requested, changing identity or signing out invalidates the reference set, stale responses cannot overwrite a newer identity, and a successful profile save invalidates selectors for a later refresh. A reference refresh failure must leave an already usable screen usable. Auth-state callbacks must not wait on profile/API refresh work before returning control to the Supabase client lifecycle.

## Auth security evidence sanity check

Treat leaked-password protection and MFA as external Supabase Auth configuration. A secure result requires recent authoritative evidence from the **Supabase Dashboard** or **Supabase Management API**, a durable evidence reference, and the exact secure state for that control. Manual notes, screenshots or other supporting context may be retained, but `manual_external` evidence is non-authoritative and must never become `verified_secure`. Do not infer either setting from PostgreSQL catalogs, a current or historical security-advisor row, or the absence of an advisor warning. Stale evidence requires re-verification, and application source work must not change the Auth setting or auto-close its Current Admin To-Do item.

Before recording a new external observation, use `npm run auth:evidence:intake -- <input.json>`. The intake must target the exact registered project, accept only Dashboard/Management API provenance, require a current timestamp and durable reference, derive the database verification status from the control-specific state, reject operator-supplied status/authority/expiry fields, reject credential-bearing capture fields, and hash rather than copy the raw source capture into the candidate. Passing intake validates structure and freshness only: **source authenticity is not verified by the tool** and database recording is not authorized by the candidate itself. Never edit the derived `verification_status` by hand.

After genuine official-source authenticity is independently confirmed, use `npm run auth:evidence:record -- <candidate.json>` only with the exact Production Supabase URL/project ref, the service-role credential, `YWI_AUTH_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_AUTH_EVIDENCE_RECORD`, and `YWI_AUTH_EVIDENCE_SOURCE_AUTHENTICITY_CONFIRM=I_CONFIRM_OFFICIAL_SUPABASE_SOURCE`. The database recording RPC must independently validate provenance, project binding, freshness, evidence reference, capture digest and control-specific state, derive status/expiry, and be service-role-only. The recorder must immediately re-read the current evidence row and fail if the evidence id, project binding, capture digest, recording contract, or derived current status does not match. Recording the observation does not change the external Auth setting or authorize Production promotion.

## Next safe action sanity check

Use the current I.T. next safe action authority to rank unresolved work. A `staging_ready_candidate` means the rail is technically ready for dedicated staging evidence; it does **not** mean mutation is authorized. Re-verify both the non-production staging environment guard and **exact current-schema parity** immediately before any staging write.

Keep external Auth/GitHub follow-ups separate from source readiness, keep content/provider items pending until their actual human/test evidence exists, and keep blocked accounting acceptance blocked with Finance posting execution and payment-provider mutation OFF. The prioritization layer must never auto-close a rail, publish content, change Auth, or promote Production.

## Staging acceptance mutation sanity check

Treat Production staging-acceptance mutation as prohibited. Status/catalog reads may be available there, but Pass/Fail evidence, Finalize, and Signoff must remain locked.

Before any human staging evidence is recorded, verify all three current runtime conditions: `YWI_RUNTIME_ENVIRONMENT=staging`, `YWI_STAGING_PROJECT_REF` exactly matches the intended non-production Supabase project, and `YWI_STAGING_ACCEPTANCE_MUTATION_ENABLED=true`. The current project must not be the registered Production project. The I.T. staging panel must visibly report the environment guard as enabled before mutation controls are used.

Then verify the schema lock independently: the expected repository schema and latest applied staging schema must match exactly and the runtime schema authority must report current. The historical Schema 187 scenario catalog is retained as catalog history, not as the current runtime schema. A staging database that is behind or ahead of source must stay locked.

The manual staging runner has its own project-ref/confirmation guard and remains manual-only. Before it starts, `npm run staging:preflight` must derive the project ref from the HTTPS `SUPABASE_URL` hostname and require that value to exactly equal `YWI_STAGING_PROJECT_REF`. Merely configuring a ref that differs from Production is not enough: the URL-derived ref and configured staging ref must agree, and both the permanently known Production ref and any configured Production ref remain denied. Preflight diagnostics may report refs and credential presence but must never echo service-role keys, public keys, JWTs, or other secret values.

Never use a Production project, real customer data, Production payment, or Production provider mutation as staging evidence. Evidence/signoff does not auto-close the business rail.

For **quote/contact** staging acceptance, the runner may automate only uniquely labelled disposable evidence in the dedicated non-production project: invalid no-consent rejection, one STAGING request using an `example.invalid` contact, the matching created event, and verified deletion of only that exact staging request/event set. The workflow needs the staging public/anon key so this test follows the same unauthenticated contract as the public website. A blocking human review still follows the automated evidence before finalization/signoff. Operations Cockpit write-form evidence remains human-controlled.

If the connected Supabase account has no dedicated non-production project or development branch, do not run live staging acceptance and do not claim live evidence. Source-only runner improvements may continue, but creating billable staging infrastructure requires an explicit project/branch decision and Production must never be substituted.

## Job lifecycle sanity check

Treat **live update → execution proof → closeout** as one Jobs lifecycle even though the underlying tables/RPCs were introduced by separate historical migrations. A live update must preserve staff/customer visibility and approved-public-media rules. Execution proof must preserve supervisor decision authority and keep labour, material, equipment, margin and staff notes internal. Closeout must require approved proof plus the intended supervisor/customer signoff before invoice-readiness and follow-up state can advance.

For every lifecycle-related change, run the individual live update, execution proof and closeout contracts plus the combined job-lifecycle browser acceptance. Verify 390/430 phone layouts remain touch-usable and overflow-free, the desktop workbench keeps all three lifecycle stages readable, and the customer portal contains only customer-safe approved material with no internal costs, margin, staff notes or private review media.

Do not use historical feature metadata as current release/schema truth. Current schema identity comes from the current schema authority; numbered migrations remain history. Live staging evidence for these lifecycle rails still requires a dedicated non-production project and explicit human evidence where the scenario catalog says human.

## Customer notification delivery sanity check

Treat the customer notification path as consent-first. A customer-visible live update may enter the delivery path only when the customer has an **explicit opt-in** for email notifications. No consent means no delivery attempt. Keep notification preference, outbox and delivery-attempt records service-private, and keep the staff delivery queue bounded so customer email addresses and portal tokens are not exposed merely for operational review.

The dispatcher must remain fail-closed behind its explicit delivery-enable guard and run token, with provider idempotency on delivery attempts. Transport uncertainty must remain **manual review**, never automatic success and never automatic retry. Retry remains a deliberate staff action after review. Customer-facing notification content may link to the secure portal but must not contain staff-only notes, private images, access details, internal costing or margin information.

For notification-related changes, run the historical notification contract, the current release-enforcement gate and the rendered notification browser acceptance. Verify 390/430 customer preference controls remain touch-usable and overflow-free, desktop pending-consent/delivered/manual-review states remain readable, and customer/staff surfaces preserve the privacy boundary. Historical notification migration metadata is audit history rather than current schema identity.

## Public web and Help review

Every release that changes navigation, workflows, public pages, or public-search behavior must update `/help.html` in the same change. Public/indexable pages retain one H1, current metadata, canonical URLs on `https://yardweasels.ca`, crawler-ready content, canonical-only sitemap entries with truthful freshness, structured data that mirrors visible content, and responsive phone/desktop rendering. Portal and Help surfaces remain `noindex`.

Treat `https://ywiinc.com` as a separate established business website, not an automatic canonical destination. Noncanonical and preview application hosts remain `noindex` while pointing canonically to yardweasels.ca. Verify the canonical-host, canonical-conflict, and preview/noncanonical rendering cases in browser acceptance. A disagreement between approved route path, sitemap canonical, and rendered canonical fails closed to `noindex` until corrected.

Sitemap `lastmod` must represent meaningful source/content freshness rather than simply the deployment date and must never be future-dated. Public route structured data should expose matching WebPage, Service, and BreadcrumbList semantics without contradicting the visible H1, title, description, route or provider. External search-engine submission is a separately configured action; do not automatically call IndexNow or Search Console and never use submission as a substitute for content approval.

## Supabase Data API migration sanity check

Supabase is removing automatic Data API grants for newly created public tables. YW therefore treats implicit access as invalid source authority. For every guarded future migration that creates a `public` table, the creating migration must enable RLS, explicitly declare least-privilege table grants, and explicitly GRANT or REVOKE `anon` / `authenticated` access. Do not use `GRANT ALL` for client roles and do not assume historical default privileges will exist for a new table.

The repository smoke gate permanently runs `scripts/data-api-explicit-access-check.mjs`; a new guarded migration that omits RLS or its explicit access decision must fail source CI before merge. Historical migrations remain unchanged audit history. A read-only Production privilege audit is separate evidence: source linting must not mutate live grants, apply a schema migration, create staging infrastructure, or promote Production.

## SECURITY DEFINER execution sanity check

Treat every `SECURITY DEFINER` function as a privileged API surface, even when it is only intended as an internal helper. New public functions must not inherit `EXECUTE` from PostgreSQL/Supabase defaults. A new `SECURITY DEFINER` declaration must pin `search_path`, explicitly revoke `PUBLIC`, explicitly decide `anon`, `authenticated`, and `service_role` execution, and never grant `PUBLIC` execution.

Before promoting a schema that changes function privileges, inspect the actual intended caller: browser RPC, service-role Edge Function, trigger, pg_cron, nested RPC, or RLS helper. Do not blanket-revoke an intentionally exposed RPC and do not leave an internal trigger/scheduler/Finance/permission helper browser-callable merely because a historical default grant exists. Prefer invoker semantics when creator privileges are unnecessary.

The repository smoke gate permanently runs `scripts/security-definer-execute-boundary-check.mjs`. After this security convergence is eventually applied to an authorized database, verify the service-private `v_it_security_definer_execute_boundary` and `ywi_security_definer_execute_boundary_assertions()` results. Source-only acceptance does not prove the live database changed and does not authorize applying the migration to Production.

## Repository enforcement sanity check

Treat repository enforcement as an external GitHub control, separate from green source tests and separate from application release authority. The exact-main repository protection preflight runs only for a `push` to `refs/heads/main`; it reads GitHub's current `branches/main` evidence, requires `protected=true`, and requires the GitHub-reported main SHA to exactly match the workflow release SHA.

The preflight must fail closed when main is unprotected, the evidence is missing, the branch SHA is stale/different, the event is not an exact main push, or the ref is not `refs/heads/main`. A successful pull-request workflow is not branch-protection evidence. This source gate does not enable or alter GitHub branch protection/rulesets and must not auto-close `repository:main_protection`; the external follow-up remains open until GitHub itself reports enforcement.

## Exact-main release-source evidence sanity check

After the canonical source/browser job succeeds on an actual `main` push, a dependent release-source evidence job must independently re-read GitHub's current `branches/main` state and re-run the exact-main protection preflight. Only then may it write `release-source-evidence.json` and upload the run-scoped `ywi-main-release-source-<run-id>-<attempt>` GitHub Actions artifact. The artifact contains the exact source SHA, GitHub-reported main SHA, workflow run ID and attempt, workflow name, dynamically discovered repository schema version, source-check result, and the observed `main` protected state. GitHub artifact retention remains governed by repository/organization settings.

Treat this JSON as a **release-source candidate**, not as proof that Production was deployed. It intentionally keeps detailed `branch_policy_verified=false`, marks the database-record candidate `workflow_status=unknown`, and requires final workflow verification after the run completes. The workflow must not mark its own candidate passed while it is still running.

After the exact run has completed, use current GitHub evidence for that run plus a fresh current `branches/main` response and run `npm run release:evidence:verify` against the candidate. The verifier fails closed unless repository, workflow name/path, push event, `main` branch, run ID, run attempt, exact head SHA, current source schema, completed status, successful conclusion, current main SHA, and `protected=true` all agree exactly. A changed main SHA, failed/in-progress run, stale candidate, crossed run attempt, schema mismatch, wrong repository/workflow, or unprotected main must not produce verified evidence.

Only a successful final verification may write `release-source-evidence-verified.json` with the database-record candidate `workflow_status=passed`. Failure removes any stale verified output. Even in the verified file, `branch_policy_verified=false` remains unchanged because the protected flag does not prove detailed ruleset policy. The verifier does not write Supabase release evidence, mutate Production data, enable Finance/provider mutation, deploy Production, promote `main`, or auto-close any GitHub/release/business rail.

To persist a final verified payload, use `npm run release:evidence:record -- <verified.json>` only as a separate deliberate action. The recorder must do a **fresh** GitHub lookup of the exact workflow run and current `main` immediately before the database call; it must reject a moved SHA, a different run attempt, a failed/in-progress run, or `protected=false`. It also requires the exact Production Supabase URL/project, service-role credentials, `YWI_RELEASE_EVIDENCE_RECORD_CONFIRM=I_CONFIRM_RELEASE_EVIDENCE_RECORD`, a final verification no older than the recording window, and exact Production schema parity with the verified source schema.

The authorized database RPC derives `workflow_status=passed` itself; callers do not supply the status or `branch_policy_verified`. It records the repository, run attempt, canonical workflow path, verification-contract version, and SHA-256 digest of the verified payload, then the recorder immediately re-reads current release-source authority. Direct service-role INSERT/UPDATE/DELETE and the legacy permissive release recorder must remain disabled. A source-gate GREEN result still does not prove detailed GitHub ruleset policy and does not deploy or promote Production.

Recording the verified payload and any later Production promotion remain separate deliberate actions.

## Remaining work selection

Choose the next technical feature from a fresh I.T. Readiness / Current Admin To-Do review. Do not invent autonomous work merely to increase a score. Rails classified as human, accounting, provider, content or staging acceptance remain open until their actual evidence exists.

Repository protection remains a separate enforcement concern from application release authority and should stay visible until GitHub reports it as enforced.

## Module and Production boundary

The four top-level modules are **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** remains inside Admin rather than becoming another top-level module.

Production promotion remains deliberate/manual and separate from application source readiness.

## Forward build roadmap

This section is the durable forward plan that must be reviewed whenever YW build work is refreshed. It is a planning authority, not a historical release ledger and not permission to blindly execute the next number. Current source, I.T. Readiness, Current Admin To-Do, next-safe-action authority, schema drift, Finance/provider fail-closed state, and exact `main`/`dev` truth remain authoritative.

Before selecting an item, re-scan the exact current repository to prove the gap still exists. Skip, merge, split or reorder an item when current evidence shows it is already complete, obsolete, unsafe, blocked by prerequisites, or better combined with an adjacent scope. Do not invent a schema migration merely because the roadmap contains a numbered item. Finance posting, provider mutation, Production staging mutation, external Auth-control changes and destructive business-data changes remain fail-closed unless a later acceptance scope is separately authorized.

The intended direction is to finish the remaining bounded release/schema-width debt first, then emphasize Finance/accounting completion, job profitability, operator quality of life, and finally real staging/accounting/provider acceptance.

### 306 — Release-source evidence migration-width hardening

Harden exact-main release-source evidence generation so repository schema discovery accepts variable-width numbered migrations including Schema 1000+. Add 999/1000/12034 and malformed-filename regression coverage while preserving exact-main SHA, workflow, repository-enforcement and evidence semantics. Keep this source/release-evidence only unless current truth proves another tightly coupled gate must change.

### 307 — Release change-classification migration-width hardening

Harden the release-candidate manifest and shared release-change classifier so a future Schema 1000+ SQL migration is still classified as schema-changing and receives the required migration/runtime evidence profile. Preserve historical migration names and keep policy classification non-mutating.

### 308 — Staging runner migration-width completion

Remove fixed-width schema discovery from the guarded manual staging acceptance runner and lock the behavior into current staging runtime/schema authority checks. Preserve all dedicated non-Production project checks, exact-schema lock, manual-only behavior, disposable-fixture limits and Production denial. Do not create staging infrastructure or run live mutation without separate authorization.

### 309 — Final active migration-parser sweep

Fresh-search the exact Production tree for genuine executable fixed-width migration parsers still used for current schema/release authority, including notification/release gates if still present. Distinguish real parsers from historical examples, guard strings and fixture assertions. Add one bounded convergence check so future migration-width work becomes normal regression maintenance rather than a continuing micro-release stream.

### 310 — Finance Acceptance Command Center

Create one authoritative Finance/Admin surface answering **What prevents accounting from being GREEN?** Consolidate Finance hardening, reconciliation exceptions, mapping gaps, pending payment actions, bank-import review, period/close state, posting locks, remittance readiness and accountant-export readiness. Show blocker severity, owner, corrective action and deep link while preserving accounting acceptance as fail-closed.

### 311 — Bank Import Workbench v2

Deepen the existing bank CSV workflow with saved bank/account column templates, duplicate and rejected-row explanations, row-level approve/reject/correct controls, safe bounded bulk review, import history, source-file traceability and discard/undo before promotion or posting. No silent posting.

### 312 — Smart Reconciliation Workbench

Add confidence-ranked matching between bank rows and invoices, customer payments, vendor bills, transfers and deposits. Support one-to-one, one-to-many, many-to-one and partial matches where accounting rules allow. Explain each match score and keep ambiguous cases human-confirmed.

### 313 — Payment Application and A/R Completion

Complete the operator flow for applying receipts to invoices and handling deposits, unapplied cash, credits, discounts, approved write-offs and overpayments. Validate available balance, invoice balance, customer identity, source, date and open period before application; preserve idempotency and audit evidence.

### 314 — Account Mapping and Posting Preview

Present proposed debit/credit entries, source transaction, mapped accounts, tax treatment and evidence before posting can ever occur. Flag unmapped or ambiguous lines, support explicit row-level approval/rejection/reclassification, and maintain a complete preview-to-decision audit trail. Posting execution remains OFF unless separately authorized later.

### 315 — Reconciliation Exception Resolution

Turn reconciliation exceptions into owned work with severity, category, owner, age, evidence and explicit resolution reasons such as timing difference, duplicate, missing document, wrong account, amount mismatch, transfer pair, provider settlement or manual accounting review. Keep material unresolved exceptions visible to Finance readiness and month-end close.

### 316 — Month-End Close Cockpit

Make period close a guided and auditable workflow covering bank reconciliation, payment exceptions, mappings, journals, remittances, open A/R/A/P issues, provider settlement exceptions and export readiness. Lock periods only after required gates pass, block posting into locked periods, and require authority plus recorded reason for reopening.

### 317 — Accountant Export Package v2

Produce an accountant-friendly close package containing trial balance and GL detail, A/R and A/P summaries where available, bank/reconciliation summary, unresolved exceptions, tax/remittance schedules, mapping/posting exceptions, close/reopen state and a manifest proving period, source rows, generation time and included artifacts.

### Landscaping & yard-maintenance operating-system direction

YW is now intentionally focused on a landscaping, lawn-care and yard-maintenance business model rather than a generic business application.

The five permanent operating pillars are:

1. **Safety & Compliance**
2. **Jobs & Customers**
3. **Equipment & Fleet**
4. **Employment & Workforce**
5. **Finance & Profitability**

Admin, I.T. readiness, mobile, offline support, notifications, reporting, audit history and search support those pillars rather than becoming separate competing products.

The primary operating chain is:

**Customer → Property → Estimate → Job / Visit → Crew → Time → Equipment → Materials → Safety → Completion Evidence → Invoice → Payment → Profitability**

The application should preserve traceability across that chain so ownership and supervisors can answer practical questions such as:

- Which crews, routes and service types are profitable?
- Which recurring properties consistently exceed estimate?
- Which completed jobs have not been invoiced?
- Which equipment is unavailable, overdue for service or disproportionately expensive?
- Which employee needs training before operating a specific machine?
- Which jobs are at risk because of weather, equipment, materials or staffing?
- What unresolved Safety, Jobs, Equipment, Employment or Finance issue prevents the business from being operationally GREEN?

#### Safety & Compliance product direction

Safety is a first-class operational module rather than a checklist attached to Jobs.

The long-term system should support field-level hazard assessments, job/site safety plans, toolbox talks, PPE, incidents, near misses, corrective actions, equipment lockout, training/certification, supervisor review and durable evidence. It should be capable of supporting OHSA/OSHA-style workflows without falsely claiming regulatory compliance merely because a form exists.

#### Jobs & Customers product direction

Jobs should be property-aware and service-aware. The system should cover leads, customers, properties, estimates, recurring maintenance, scheduling, crew dispatch, route planning, weather/workability, field production, change orders, customer communication, quality control, completion evidence and invoice readiness.

#### Equipment & Fleet product direction

Equipment should be traceable from purchase through field use, maintenance and retirement. Support mowers, trimmers, blowers, saws, aerators, spreaders, tractors, trucks, trailers and specialty equipment with QR/barcode identity, inspections, lockout, service history, operating cost, preventive maintenance and lifecycle/replacement evidence.

#### Employment & Workforce product direction

Connect employees, crews, skills, availability, timekeeping, attendance, payroll evidence, onboarding, training, equipment authorization, seasonal staffing and performance/development while keeping safety-event truth independent from performance-management decisions.

#### Finance & Profitability product direction

Finance should answer practical operating questions while preserving accounting controls: job cost, estimate-vs-actual, labour/material/equipment/subcontract/fuel/disposal/travel cost, invoicing, collections, A/R/A/P, reconciliation, account mapping, posting preview, close, accountant export, cash position and true job margin.

Finance posting, provider/payment mutation and Production provider enablement remain separate deliberate controls.

### Future autonomous queue

The following sequence supersedes the older generic post-317 roadmap. Items 318–350 are the core autonomous landscaping operating-system program. Items 351–353 are controlled acceptance campaigns and retain external/human prerequisites.

#### 318 — Job Cost & Profitability Closeout

Make job profitability landscaping-specific. Join estimate/approved scope, invoiced and collected revenue, crew labour, travel where tracked, materials, consumables, equipment use, fuel, subcontract/vendor cost, disposal/tipping, rework, gross margin and estimate-to-actual variance. Preserve execution-proof provenance and keep internal cost/margin staff-only.

#### 319 — Landscaping Finance Dashboard & Cash Position

Provide ownership/management with an operational view of cash/bank position, receivables, overdue invoices, payroll/material/vendor commitments, tax/remittance readiness, current-period revenue/cost/margin, job-profitability exceptions, reconciliation blockers, seasonal comparisons and close readiness.

#### 320 — Operations Needs Attention

Create one prioritized cross-business queue for overdue/unassigned jobs, customer/property follow-up, equipment defects/lockouts, overdue maintenance, safety corrective actions, employee/training issues, missing timesheets, completed-not-invoiced work, overdue receivables and Finance/reconciliation exceptions. Include priority, owner, due date, source module, permission-aware navigation, snooze/defer and recently resolved history.

#### 321 — Crew Scheduling & Dispatch

Build a landscaping-specific daily/weekly scheduler covering crew composition, lead/supervisor, employee assignment, truck/trailer/equipment assignment, property/job, recurring visits, estimated duration, travel allowance, route order, staffing/equipment conflicts, weather/workability state and reschedule/cancellation reason.

#### 322 — Recurring Lawn & Yard Maintenance Engine

Support weekly/biweekly/custom mowing, garden/bed maintenance, hedge/shrub trimming, spring cleanup, fall cleanup, aeration, fertilizing and other seasonal programs. Handle recurrence rules, service windows, seasonal start/stop, skipped visits, weather delays, make-up visits, customer holds and cancellation.

#### 323 — Property & Site Intelligence

Make Property a first-class record with customer relationship, service address, lawn/garden zones, approximate serviceable area, gates/fences, access instructions, parking/trailer limits, pets, irrigation, slopes, drainage/wet areas, known hazards, utility/locate notes, tree/brush concerns, photos and recurring property-specific instructions.

#### 324 — Estimate → Job → Invoice Workflow

Make estimating landscaping-aware using service templates, labour-hour and crew-size assumptions, material quantities, equipment requirements, subcontract/vendor allowances, disposal, travel, markup/margin review, optional work, customer approval, deposits where applicable, work-order conversion, change orders and invoice readiness. Estimate assumptions must remain traceable into variance.

#### 325 — Landscape Production Tracking

Capture actual field execution: start/finish, crew members, labour hours, quantities, material use, equipment, disposal, delays, weather/workability impacts, notes, before/during/after photos, unfinished work, return visit requirements, customer/site issues and completion evidence.

#### 326 — Mobile Crew App v2

Optimize field use for 390/430-width phones with My Jobs / My Route, property access notes, clocking, job checklist, safety assessment, photos/live update, material use, equipment scan, inspection/defect, production quantities, execution proof, deficiency/rework, closeout request, customer signoff where appropriate and clear offline/pending sync state.

#### 327 — Safety & Compliance Command Centre

Provide one safety operating centre for open hazards, required assessments, toolbox talks, incidents/near misses, corrective actions, training expiries, PPE issues, equipment lockouts, unresolved site hazards, supervisor signoff and overdue safety actions.

#### 328 — Job Hazard & Site Safety Plans

Create reusable safety plans by landscaping work type such as mowing, trimming/edging, blowers, chainsaw/brush work, hedge work, loading/unloading, trailers/towing, roadside work, excavation/digging, underground-utility concern, fertilizer/application work where legally permitted, heat, cold, storms/lightning, slips/trips, slopes and public/pedestrian interaction. Templates must allow actual field conditions and controls to be recorded.

#### 329 — Incident & Near-Miss Investigation

Support immediate and auditable capture of incidents, injuries/illness where applicable, property damage, vehicle/equipment damage, environmental events and near misses with date/time/site/job, people involved, witnesses, equipment, photos, initial response, contributing/root factors, corrective actions, owner, due date, supervisor review and closure evidence.

#### 330 — Training & Certification Matrix

Create role/equipment-based training requirements for orientation, WHMIS where applicable, first aid/CPR where required, equipment authorization, chainsaw/brush equipment, mower/tractor authorization, pesticide/application credentials where required, trailer/towing, supervisor training, company SOPs and refresher/expiry dates. Internal records must not falsely imply legal authorization.

#### 331 — Equipment Registry & QR System v2

Give each significant asset an operational identity with asset code, QR/barcode, make/model/serial, purchase date/cost, assigned crew/location, status, manuals, photos, hours/meter where supported, accessories, current lockout state, latest inspection, next maintenance, lifecycle cost and replacement state.

#### 332 — Daily Equipment Inspection & Lockout

Create machine-specific pre-use/post-use inspections covering guards/safety systems, fluids, blades/cutting components, tires/wheels, fuel/battery, accessories, damage and defects. Safety-critical failure should create lockout, repair/service work, supervisor review and verified return to service.

#### 333 — Fleet, Trailer & Vehicle Operations

Manage trucks/trailers with identity, odometer, registration/insurance evidence, inspection, maintenance, tire status, towing assignment, hitch/trailer compatibility, crew/job assignment, trailer load/content readiness, fuel, damage and downtime.

#### 334 — Preventive Maintenance Engine

Schedule equipment/fleet maintenance by date, hours, kilometres and seasonal milestones. Track oil, filters, blades, sharpening, belts, lubrication, tires, batteries, winterization/storage, preseason setup, repairs, service history and downtime.

#### 335 — Fuel, Consumables & Materials Control

Track gasoline/diesel where applicable, oil, trimmer line, blades, fertilizer, seed, sod, mulch, soil, gravel/stone, plants, landscape fabric, disposal supplies and other consumables with stock, reorder, supplier, unit cost, job use, waste and variance.

#### 336 — Employee & Crew Management

Create practical workforce operations for employee status, role, supervisor, crew, skills, availability, privacy-aware contact/emergency information, assigned training, equipment authorization, seasonal status and active/inactive dates.

#### 337 — Timekeeping, Attendance & Payroll Evidence

Track shift time, job/visit time, travel time, breaks, overtime, missed punches, corrections, employee explanation, supervisor approval, job-cost allocation and payroll-ready export/evidence. Time corrections remain auditable.

#### 338 — Performance & Development

Support role expectations, coaching, recognition, attendance patterns, training/development plans, documented reviews, improvement actions and follow-up dates while keeping Safety incident truth separate from performance-management outcomes.

#### 339 — Hiring & Onboarding Workflow

Support Applicant → Interview → Offer → Hired → Documents → Orientation → Training → Equipment Authorization → Crew Assignment, including incomplete onboarding and pre-field readiness gates.

#### 340 — Customer & Property CRM

Unify leads, customers, multiple properties, estimates, active service plans, service history, communications, complaints, follow-ups, property preferences, renewals and appropriate upsell/cross-service opportunities.

#### 341 — Route Optimization & Territory Management

Support recurring-route planning by service area, property proximity, crew capacity, estimated duration, equipment needs, time windows, frequency, route order, travel efficiency and territory ownership. Optimization may suggest; operators retain dispatch authority.

#### 342 — Weather & Workability Controls

Add weather/workability decision support for rain delay, saturated ground, heat, cold, high wind, lightning/storm, visibility and service-type restrictions. Record supervisor decision, postponement/reschedule and customer-notification readiness rather than automatically making safety decisions.

#### 343 — Landscape Material Estimator

Add area/volume/quantity calculators for mulch, soil, sod, seed, fertilizer, gravel, stone, disposal and configurable materials. Record assumptions, unit conversions, waste factor and planned-vs-actual use.

#### 344 — Change Orders & Extras

Support field-discovered extra work using Crew identifies extra work → evidence/photos → office/supervisor review → price/scope → customer authorization → job budget/scope update → invoice evidence. No hidden customer billing or unaudited field-only price change.

#### 345 — Quality Control & Customer Signoff

Provide service-type completion templates, crew completion, supervisor QC where required, deficiencies, rework, before/after evidence, customer-safe completion summary, customer acknowledgement/signoff where appropriate and unresolved-issue tracking.

#### 346 — Seasonal Operations Centre

Coordinate spring startup, summer maintenance, fall cleanup, winter shutdown and optional winter/snow operations with recurring-customer rollover, seasonal staffing, equipment conversion/service, material stock, route activation, seasonal checklists and outstanding work.

#### 347 — Universal Activity & Audit Timeline

Create one permission-aware chronological history across Customer, Property, Estimate, Job/Visit, Employee, Equipment/Fleet, Safety and Invoice/Payment. Surface meaningful created/changed/assigned/approved/rejected/inspected/locked-out/trained/uploaded/notified/posted/reopened events with actor, timestamp, source module and evidence reference.

#### 348 — Offline & Conflict Recovery

Make field synchronization understandable. Where the record contract allows, show local versus server value and explicit Keep Mine, Keep Server, Merge, Retry or Discard actions. Preserve unsent work and never silently overwrite newer authoritative data.

#### 349 — Saved Views, Search & Command Centre

Add permission-aware operational views such as My Crew Today, My Route, Jobs Behind Schedule, Equipment Locked Out, Maintenance Due, Safety Actions Due, Training Expiring, Completed Not Invoiced, Overdue Receivables, Finance Exceptions and Assigned to Me. Add global search/navigation across customers, properties, jobs, invoices/payments, employees, equipment and Admin workspaces.

#### 350 — Owner / Management Command Centre

Create one practical business cockpit showing today's crews, scheduled/completed work, schedule risk, production/completion rate, revenue, job margin, labour utilization, recurring-route performance, Safety blockers, equipment downtime, training/workforce blockers, completed-not-invoiced work, receivables, cash/Finance readiness and operational needs attention. Deep-link to source workflows rather than becoming duplicate authority.

### Controlled acceptance campaigns

These items stay on the roadmap but are not ordinary autonomous feature releases.

#### 351 — Real Staging Acceptance Campaign

Run only when a dedicated non-Production Supabase project/branch exists and is explicitly authorized. Require exact environment identity, project-ref guard, exact current-schema parity immediately before mutation, approved disposable automated cases, required human Operations/Jobs/Safety/Equipment scenarios, recorded evidence and deliberate finalization/signoff. Never substitute Production business/provider data.

#### 352 — Accounting Acceptance Campaign

After the landscaping Finance workflow is complete and no critical Finance blockers remain, run controlled test transactions through estimates/jobs, job cost, bank import, reconciliation, payment application, account mapping, posting preview, exception handling, period close and accountant export. Verify idempotency, locked-period behavior, reopen audit, job-profitability linkage and expected outputs. Passing acceptance does not automatically enable Production posting.

#### 353 — Payment & Provider Acceptance

Only after internal accounting behavior is trustworthy, validate supported provider/payment paths including success, decline/failure, duplicate webhook/event, retry, idempotency, refund, partial refund and dispute/chargeback. Verify provider events link to the correct internal payment/accounting/job records and cannot double-settle, double-apply or double-post. Provider acceptance and Production provider enablement remain separate deliberate decisions.

Items **318 — Job Cost & Profitability Closeout**, **319 — Landscaping Finance Dashboard & Cash Position**, **320 — Operations Needs Attention**, **321 — Crew Scheduling & Dispatch**, **322 — Recurring Lawn & Yard Maintenance Engine**, **323 — Property & Site Intelligence**, and **324 — Estimate → Job → Invoice Workflow** are implemented by the current release. The next planned autonomous item is **325 — Landscape Production Tracking**.

### Roadmap selection rules

When the next YW technical item is requested, prefer the earliest still-valid roadmap item whose prerequisites are satisfied. A newly discovered release, security or data-integrity defect may take priority when it materially affects safe operation or release truth. Small adjacent fixes may be grouped when they share one authority/test surface, but unrelated business areas should remain separate.

After the first four roadmap items are complete, do not default to CI-only micro-releases merely to raise the release number. Prefer Finance completion, accounting usability, profitability and operator value unless a new release-safety defect is proven. Accounting/provider/staging acceptance remains blocked until its real prerequisites and external/human evidence exist.

The target is not the highest possible release number. The target is a landscaping and yard-maintenance operating system that releases with trustworthy exact-source evidence, keeps Safety, Jobs, Equipment, Employment and Finance connected, shows real crew/job profitability, reduces repetitive office and field work, remains usable on phones and during poor connectivity, preserves audit and regulatory/accounting boundaries, and eventually closes staging/accounting/provider acceptance with genuine evidence rather than source-only confidence.
