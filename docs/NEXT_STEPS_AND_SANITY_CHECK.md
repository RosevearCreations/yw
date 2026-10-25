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

The following sequence supersedes the older generic post-317 roadmap. Items 318–350 established the core landscaping operating-system program. Items 351–362 extend it with bounded autonomous improvement releases that must be implementable and verifiable without user interaction, external provider enablement, real-payment execution or human acceptance campaigns.

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

#### **332 — Daily Equipment Inspection & Lockout** is implemented

Create machine-specific pre-use/post-use inspections covering guards/safety systems, fluids, blades/cutting components, tires/wheels, fuel/battery, accessories, damage and defects. Safety-critical failure should create lockout, repair/service work, supervisor review and verified return to service.

#### **333 — Fleet, Trailer & Vehicle Operations** is implemented

Manage trucks/trailers with identity, odometer, registration/insurance evidence, inspection, maintenance, tire status, towing assignment, hitch/trailer compatibility, crew/job assignment, trailer load/content readiness, fuel, damage and downtime.

#### **334 — Preventive Maintenance Engine** is implemented

Schedule equipment/fleet maintenance by date, hours, kilometres and seasonal milestones. Track oil, filters, blades, sharpening, belts, lubrication, tires, batteries, winterization/storage, preseason setup, repairs, service history and downtime.

#### **335 — Fuel, Consumables & Materials Control** is implemented

Track gasoline/diesel where applicable, oil, trimmer line, blades, fertilizer, seed, sod, mulch, soil, gravel/stone, plants, landscape fabric, disposal supplies and other consumables with stock, reorder, supplier, unit cost, job use, waste and variance.

#### **336 — Employee & Crew Management** is implemented

Create practical workforce operations for employee status, role, supervisor, crew, skills, availability, privacy-aware contact/emergency information, assigned training, equipment authorization, seasonal status and active/inactive dates.

#### **337 — Timekeeping, Attendance & Payroll Evidence** is implemented

Track shift time, job/visit time, travel time, breaks, overtime, missed punches, corrections, employee explanation, supervisor approval, job-cost allocation and payroll-ready export/evidence. Time corrections remain auditable. This release reuses the canonical employee time, break, attendance review, job-session crew-hour and Finance payroll-export authorities; correction evidence records before/after snapshots and explicit review.

#### **338 — Performance & Development** is implemented

Support role expectations, coaching, recognition, attendance patterns, training/development plans, documented reviews, improvement actions and follow-up dates while keeping Safety incident truth separate from performance-management outcomes. This release reuses canonical profiles, workforce skills, existing training/certification truth and existing timekeeping evidence; Safety incidents and near misses are not joined into performance-management outcomes.

#### **339 — Hiring & Onboarding Workflow** is implemented

Support Applicant → Interview → Offer → Hired → Documents → Orientation → Training → Equipment Authorization → Crew Assignment, including incomplete onboarding and pre-field readiness gates. Candidate records link into the canonical employee profile, training/certification, internal equipment/task authorization and crew-membership authorities instead of duplicating them. Season-aware onboarding explicitly supports spring/summer landscaping and mowing, fall cleanup and leaf collection, and winter snow clearing/removal.

### Four-season Ontario operating model

YW operates year-round in Ontario. All remaining autonomous releases must treat spring/summer landscaping and lawn mowing, fall cleanup/leaf collection, and winter snow clearing/removal as first-class operating modes where the feature is relevant. Winter service must not be modeled as an optional side path. Scheduling, CRM/service history, weather/workability, materials, quality evidence, saved views, staffing, equipment/fleet readiness, finance/management reporting and acceptance evidence should preserve service type and season context without creating duplicate authorities.

#### **340 — Customer & Property CRM** is implemented

Unify leads, customers, multiple properties, estimates, active service plans, service history, communications, complaints, follow-ups, property preferences, renewals and appropriate upsell/cross-service opportunities. Preserve season/service context across mowing and landscaping, fall cleanup/leaf collection, and winter snow clearing/removal so a property can carry year-round service history without splitting the customer record.

#### **341 — Route Optimization & Territory Management** is implemented

Support recurring-route planning by service area, property proximity, crew capacity, estimated duration, equipment needs, time windows, frequency, route order, travel efficiency and territory ownership across mowing/landscaping routes, fall-cleanup routes and winter snow routes. Winter routing must support storm-event activation and service-priority context while optimization remains advisory; operators retain dispatch authority.

#### **342 — Weather & Workability Controls** is implemented

Add weather/workability decision support for rain delay, saturated ground, heat, cold, high wind, lightning/storm, visibility, snowfall, freezing rain/ice and service-type restrictions. Support mowing/landscaping, fall cleanup and winter snow-clearing/removal workability context. Record supervisor decision, postponement/reschedule and customer-notification readiness rather than automatically making safety decisions.

#### **343 — Landscape Material Estimator** is implemented

Add area/volume/quantity calculators for mulch, soil, sod, seed, fertilizer, gravel, stone, disposal and configurable materials, plus winter consumables such as salt/de-icer and traction material where used. Record service/season context, assumptions, unit conversions, waste factor and planned-vs-actual use.

#### **344 — Change Orders & Extras** is implemented

Support field-discovered extra work using Crew identifies extra work → evidence/photos → office/supervisor review → price/scope → customer authorization → job budget/scope update → invoice evidence. No hidden customer billing or unaudited field-only price change.

#### **345 — Quality Control & Customer Signoff** is implemented

Provide season- and service-type completion templates, crew completion, supervisor QC where required, deficiencies, rework, before/after evidence, customer-safe completion summary, customer acknowledgement/signoff where appropriate and unresolved-issue tracking. Include mowing/landscaping, fall cleanup and winter snow clearing/removal evidence patterns without creating separate QC systems.

#### **346 — Seasonal Operations Centre** is implemented

Coordinate spring startup, summer mowing/landscaping maintenance, fall cleanup/leaf collection and full winter snow-clearing/removal operations with recurring-customer rollover, seasonal staffing, equipment conversion/service, salt/de-icer or traction-material stock, storm-route activation, seasonal checklists and outstanding work. Winter service is a core operating season, not optional.

#### **347 — Universal Activity & Audit Timeline** is implemented

Create one permission-aware chronological history across Customer, Property, Estimate, Job/Visit, Employee, Equipment/Fleet, Safety and Invoice/Payment. Surface meaningful created/changed/assigned/approved/rejected/inspected/locked-out/trained/uploaded/notified/posted/reopened events with actor, timestamp, source module and evidence reference.

#### **348 — Offline & Conflict Recovery** is implemented

Field synchronization now keeps conflict work visible on the current device, compares the retained local payload with a server snapshot when the record contract supplies one, and exposes explicit Keep Mine, Keep Server, Merge, Retry or Discard recovery choices. Merge requires deliberate operator-edited JSON; no automatic merge or silent overwrite is allowed. Newly queued action conflicts are bound to the signed-in profile for recovery display, while normal server validation remains authoritative.

#### **349 — Saved Views, Search & Command Centre** is implemented

This release adds a permission-aware, read-only command-centre index across customers, properties, jobs, employees, equipment, routes, crew/dispatch context, seasonal work, storm events, maintenance, Safety actions, training/certification, receivables/payments and Finance exceptions. Built-in operational views cover My Crew Today, My Route, Snow Route / Storm Event, Fall Cleanup Queue, Jobs Behind Schedule, Equipment Locked Out, Maintenance Due, Safety Actions Due, Training Expiring, Completed Not Invoiced, Overdue Receivables, Finance Exceptions and Assigned to Me.

Saved views are browser-local preferences scoped to the signed-in profile. They preserve search, domain, season, service context and the selected operational view, but they never become business authority and never mutate jobs, routing, equipment, Safety, Finance, invoicing or source records. Global result navigation deep-links to the existing authoritative module/workspace. Spring/summer, fall, winter and four-season context remain explicit.

Items **350 — Owner / Management Command Centre**, **351 — Management Metric Freshness & Confidence**, **352 — Autonomous Exception Triage & Next-Safe-Action**, **353 — Four-Season Capacity & Workability Forecast**, **354 — Route & Crew Efficiency Evidence**, **355 — Recurring Service Renewal & Retention Workbench**, **356 — Estimate-to-Cash Leakage & Margin Recovery**, **357 — Labour, Equipment & Fleet Utilization Decision Support**, **358 — Materials, Consumables & Seasonal Stock Readiness**, **359 — Customer Communication Readiness & Queue Quality**, and **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** are implemented. The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **350 — Owner / Management Command Centre** is implemented

This release adds one permission-aware, read-only four-season business cockpit for management. It summarizes today's crews and work, schedule/workability risk, production completion, revenue and gross margin, recorded labour utilization, recurring-route performance, winter storm/snow-route status, fall-cleanup progress, Safety blockers, equipment/maintenance downtime, training/workforce blockers, completed-not-invoiced work, receivables, latest reconciled cash/bank position, Finance readiness and current needs attention.

Every metric is derived from existing canonical source workflows and is hidden or marked unavailable when its module is not visible. Deep links open Jobs, Finance or the appropriate Admin workspace; the cockpit cannot dispatch, change routes, approve Safety, unlock equipment, edit training, invoice work, collect payment, post accounting or close periods.

The autonomous queue continues below. Every item is intentionally designed so an AI system can implement, test, promote and verify it without asking the user to perform acceptance steps, provide provider credentials, execute real payments, or manually sign off. Where an external dependency is unavailable, the release must remain on repository-owned evidence, synthetic/browser fixtures, existing stored operational data and clearly labelled readiness/advisory behavior rather than blocking on human interaction.

#### **351 — Management Metric Freshness & Confidence** is implemented

The Owner / Management Command Centre now carries repository-owned evidence quality alongside high-value metrics. Each canonical management source exposes permission visibility, query success, row coverage/query-limit signal, latest authoritative update when the source exposes one, configured freshness window, current/stale/missing/error/timestamp-unavailable state, confidence and a plain-language reason.

Metric-level confidence combines only the authoritative sources required for that metric. Hidden sources, failed queries and no-row source responses no longer become authoritative-looking zero facts; the UI shows unavailable or no source evidence. Stale timestamps, missing timestamps and possible query-cap coverage remain visible and reduce confidence without mutating the underlying Jobs, Safety, Equipment, Workforce or Finance authority.

Item **352 — Autonomous Exception Triage & Next-Safe-Action** is implemented below; item **353 — Four-Season Capacity & Workability Forecast** is also implemented below, and the next planned autonomous item is **354 — Route & Crew Efficiency Evidence**.

#### **352 — Autonomous Exception Triage & Next-Safe-Action** is implemented

Operations Needs Attention now collapses duplicate candidates by canonical source key and enriches every visible exception with deterministic triage score, plain-language priority reason, due/age state, assigned/unassigned owner state, source read authority, source mutation authority and an advisory next-safe-action.

The score uses the existing source severity as the dominant signal, then bounded overdue age and an explicit unassigned-owner signal. Stable source-key ordering breaks any remaining ties. Suggested actions only navigate to or prepare review in the authoritative source workflow; they do not auto-dispatch, auto-resolve Safety, unlock equipment, change Finance, send customer messages, collect payment or mutate provider state.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **353 — Four-Season Capacity & Workability Forecast** is implemented

The Owner / Management Command Centre now provides seven- and fourteen-day advisory readiness from existing dispatch schedules, recurring visits, active crews, equipment registry readiness, stored workability observations/rules, storm-route evidence and seasonal operations work. Each day shows planned work, recorded demand minutes, crew assignment coverage, equipment readiness, workability restrictions/reviews, dispatch conflicts and separate spring/summer, fall, winter and four-season load counts.

Recorded demand uses only source durations and travel allowances that already exist; the release does not invent jobs-per-crew targets, productivity assumptions or missing durations. Workability is based only on YW-stored evidence and does not add an external weather provider. The forecast remains read-only and cannot dispatch crews, rewrite routes, change workability decisions, unlock equipment, send messages or mutate provider state.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **354 — Route & Crew Efficiency Evidence** is implemented

The Owner / Management Command Centre now carries a 90-day read-only comparison of dispatch planning and recorded execution. It links planned service duration and travel allowance with production duration, crew hours, return visits, delay/workability effects and the route order implied by recorded production start times. Missing execution evidence remains missing rather than becoming a zero-value fact.

Route-day evidence uses existing configured `daily_capacity_minutes` only when that route has one. Same-day city overlap across existing routes is surfaced as a clustering review candidate, and repeated friction means the same route has one or more recorded friction signals on at least two loaded service dates. These are advisory observations only: this release does not rewrite route membership or stop order, mutate dispatch, invent missing capacity, or score/rank/infer individual employee performance.

Planned travel allowance and linked crew travel minutes are intentionally shown as different measures. Crew-time travel is not treated as vehicle elapsed travel, so the release does not fabricate a direct travel variance.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **355 — Recurring Service Renewal & Retention Workbench** is implemented

The Owner / Management Command Centre now includes a read-only renewal and retention queue using canonical recurring agreements, 180-day recurring visit-event history, CRM renewal and complaint/service-review evidence, seasonal rollover decisions and permission-scoped agreement profitability.

Renewal review is based on recorded end dates and the existing CRM renewal states: overdue, due within 30 days, due within 90 days, or an explicit seasonal renewal-contact decision. Retention attention surfaces active customer/service holds, repeated skip/cancel/weather-delay evidence and unresolved agreement-linked CRM issues. Finance evidence is optional: when visible, price review is limited to negative recorded agreement profit or a planned visit charge that does not exceed its recorded planned visit cost. No target margin is invented when the business has not configured one.

The workbench prepares context only. It does not renew agreements, change prices, create estimates or invoices, send messages, or create customer commitments. Missing or permission-hidden Finance evidence remains unavailable rather than becoming a zero-margin fact.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **356 — Estimate-to-Cash Leakage & Margin Recovery** is implemented

The Owner / Management Command Centre now traces accepted estimate evidence through work-order conversion, active dispatch, production/completion, approved extras/change orders, invoice readiness, A/R invoice state, payment applications and collection evidence using the existing Jobs and Finance authorities.

The leakage queue surfaces accepted-not-scheduled work, completed/accounting-ready work without an A/R invoice, authorized/applied change-order scope without linked invoice evidence, invoices with a remaining recorded balance, and material margin leakage. Material margin leakage uses only strong recorded evidence: negative actual job profit, or simultaneous adverse recorded revenue and cost variance. No arbitrary dollar or percentage threshold is invented.

Each queue row preserves its source reference and deliberate Jobs or Finance navigation. The release is analytical only: it does not create invoices, post accounting, apply payments, send collection messages, mutate payment providers or charge customers.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **357 — Labour, Equipment & Fleet Utilization Decision Support** is implemented

The Owner / Management Command Centre now combines a 30-day window of permission-scoped paid-time evidence, dispatch crew assignment, recorded production labour, equipment signouts, equipment registry readiness, preventive-maintenance due state and fleet operations into read-only utilization decision support.

Crew evidence is aggregated by crew rather than individual employee. Equipment use is based on recorded signouts; no signout in the window is retained as an evidence-review signal and is not treated as proof that an asset was idle or unnecessary. Lockout, fleet downtime/readiness, maintenance due state and replacement state remain their existing operational authorities and are shown as constraints, not employee-performance judgments.

The decision-support layer cannot change crew/equipment assignments, clear lockouts, return equipment to service, complete maintenance, replace assets, create purchases or create vendor commitments. The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **358 — Materials, Consumables & Seasonal Stock Readiness** is implemented

The Owner / Management Command Centre now combines canonical Materials Control stock with planned Landscape Material Estimator lines, active dispatch, recurring visit coverage and Seasonal Operations material-readiness evidence for a read-only 7- and 14-day stock view.

Quantified demand is scheduled only when a planned material line belongs to a work order with an active dispatch inside the window. Projected on-hand and shortage timing require a matching recorded stock/planned unit; unit mismatches are surfaced for review and no hidden conversion is performed. Upcoming recurring visits without a linked dispatched work order and quantified material plan remain explicitly unquantified rather than receiving invented demand.

The readiness view distinguishes spring/summer mowing and landscaping materials, fall cleanup supplies, winter salt/de-icer/traction stock and general four-season materials using recorded catalog labels/categories. Reorder signals reuse canonical on-hand stock and recorded reorder/target settings. No purchase order, supplier contact, stock reservation or vendor commitment is created.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **359 — Customer Communication Readiness & Queue Quality** is implemented

The Owner / Management Command Centre now exposes a permission-aware, read-only communication readiness queue across recorded workability changes, dispatch reschedules/ETA changes, completion follow-up, upcoming recurring-service notices, overdue CRM follow-ups and Finance-scoped overdue invoice reminders.

Queue identity is deterministic. Workability and dispatch evidence for the same work order collapse into one schedule-change candidate while preserving all source links. Completion follow-up is suppressed when a later outbound CRM interaction already exists for that work order. Customer message context is limited to source/service/timing/reason plus recorded preferred contact method/window; customer email addresses, phone numbers and portal tokens are not returned.

Existing protected notification-delivery failures/manual review remain visible as delivery-attention evidence, but this layer cannot send email/text, publish updates, reschedule work, retry provider delivery, mutate A/R or collect payment. The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench** is implemented

The Owner / Management Command Centre now includes a read-only reconciliation queue across canonical CRM customers/properties, active Jobs and Dispatch, recurring-service programs, crews, equipment, routes, Workability and Material Estimator evidence.

Duplicate customer candidates require deterministic evidence: exact normalized email or phone, or normalized customer name plus postal code. Duplicate property candidates use normalized service address/postal or rounded coordinates. Matching contact values are used only for comparison and are not returned by the management workbench. Every candidate retains the original source IDs and references.

Reference checks surface active job/dispatch/recurring links that are unavailable in complete loaded canonical sources, customer/property ownership mismatches, expired-but-active crew memberships, equipment assigned to inactive crews, and active dispatch assignments that use unavailable or lockout/replacement-hold equipment. If a required reference source reaches its configured row cap, reference-gap findings are withheld rather than treating unloaded rows as missing records.

Four-season service/season checks compare explicit service context with the established spring/summer landscaping and lawn, fall cleanup/leaf, and winter snow/ice taxonomy. The workbench is advisory only: it cannot merge/delete records, delete history, rewrite foreign keys, reassign crews/equipment, clear lockouts or mutate Jobs, CRM, Finance or Safety authority.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented

Mobile Crew now resolves Jobs and Safety permissions once each, keeps post-auth business reads to a documented maximum of 13, removes route/live-update history that the phone cards did not use, returns production/material/proof summary counts instead of bulky history arrays, and reports its payload/read-budget evidence in the response metadata.

The Today surface no longer turns its 30-second local render timer into a background server refresh. Mobile Crew live context uses a five-minute freshness window with a four-hour signed-in session snapshot for poor-connectivity fallback; route activation, reconnect, foreground return, explicit refresh and successful writes remain deliberate freshness triggers.

Offline action replay is profile-isolated, single-flight and capped at 12 actions per batch. Existing conflicts are held for explicit recovery instead of being replayed repeatedly, while Keep Mine, Merge and Retry still return a reviewed action to the normal replay path. Identical Admin directory reads are coalesced for three seconds per signed-in profile and invalidated before Admin mutation.

The current release shell cache is reused for same-origin static assets while navigation remains network-first and Auth/API/Storage/Supabase traffic remains uncached. Source and rendered regression gates enforce the read, refresh, replay, cache and 390px mobile contracts without weakening module authorization, release evidence or offline conflict safety.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **362 — Production Learning & Autonomous Roadmap Renewal** is implemented

Item 362 reviews the production-learning evidence from items 351–361 and records the next autonomous sequence in `docs/production_learning_review_362.json`. The review keeps the current canonical business authorities intact and identifies the next gaps as outcome learning rather than more disconnected dashboards: decision closure/recurrence, schedule recovery, route plan-vs-actual, renewal conversion/churn, estimate accuracy, invoice/cash cycle time, labour capture completeness, equipment downtime economics, material-use variance, communication follow-up outcomes, data-quality recurrence, mobile/read-budget trend, and four-season capacity/margin mix.

The renewed sequence is deliberately repository-owned and non-interactive. Ordinary releases must not require provider credentials, live payments, real customer messages, external staging acceptance or manual signoff to complete. Finance posting, payment/provider mutation, Auth control changes, destructive reconciliation, and provider delivery remain separately authorized rails.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

#### **363 — Management Decision Outcome Journal & Learning Loop** is implemented

The Operations Needs Attention workspace now carries a private Admin-manage learning journal linked to the existing canonical source key. A management decision records the recommendation, chosen safe action, decision time, source status/priority/due state at review and triage score without copying source business payloads.

Later outcome review records pending/resolved/improved/recurring/no-change/superseded state, recurrence signal, follow-up date and bounded evidence/reference. Defer/resolve disposition also leaves a learning trace while the existing attention state remains separate from the canonical Jobs, Safety, Finance, Equipment, Employment or CRM record.

Schema 236 keeps the journal and its read view private behind RLS/service authority. The two management-learning writes are explicit Admin-manage contracts. The journal cannot dispatch work, change Finance, resolve Safety, clear equipment state, send customer/provider messages or create customer/vendor commitments.

The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.

<!-- Historical item 362 queue markers retained for regression provenance: #### 364 — Workability-to-Schedule Recovery Outcomes | renewed autonomous queue now continues with **364–376** -->

#### **364 — Workability-to-Schedule Recovery Outcomes** is implemented

The Owner / Management Command Centre now includes a read-only 90-day outcome layer over canonical Workability, Dispatch and Production evidence. Recorded constraint episodes are deduplicated to the latest evidence for the affected dispatch/work-order/date and classified as same-day completed, completed after recovery, partial/return visit, rescheduled pending, proposed reschedule pending or unresolved.

Recovery time is measured only from the recorded constrained service date to a recorded later schedule/completion date. Completed-capacity evidence uses only Production `duration_minutes`; missing durations, productivity assumptions and jobs-per-crew targets are not invented. Spring/summer landscaping/lawn work, fall cleanup/leaf work, winter snow/ice work and general four-season work retain separate recovery summaries.

Workability observations/decisions remain human/source-authoritative. The outcome layer does not query an external weather provider and cannot change Workability decisions, move/dispatch schedule items, complete work, send customer messages, clear Safety/equipment state or alter Finance.

<!-- Historical item 364 handoff marker retained for regression provenance: The next planned autonomous item is **365 — Route Plan-vs-Actual & Stop-Sequence Learning**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 365 — Route Plan-vs-Actual & Stop-Sequence Learning -->

#### **365 — Route Plan-vs-Actual & Stop-Sequence Learning** is implemented

The Owner / Management Command Centre now extends the existing route-efficiency evidence into repeated plan-versus-actual learning. Planned stop position is compared with the sequence supported by recorded Production start times, while recorded service-duration variance, delay minutes, return visits, Workability effects, planned travel allowance and linked crew-travel evidence stay attached to each route-day comparison.

Stable friction requires the same recorded friction type on at least two service dates for a route. Candidate sequencing review is stricter: the same planned-position versus recorded-start-position difference must recur on at least two dates. These are review signals only; YW does not rewrite routes, reorder stops, infer GPS or vehicle travel facts, score employees, dispatch crews or change Workability/source records.

<!-- Historical item 365 handoff marker retained for regression provenance: The next planned autonomous item is **366 — Recurring Renewal Conversion & Churn Outcomes**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 366 — Recurring Renewal Conversion & Churn Outcomes -->

#### **366 — Recurring Renewal Conversion & Churn Outcomes** is implemented

The Owner / Management Command Centre now includes a read-only recurring-renewal outcome layer over recurring agreements, CRM interaction/renewal evidence, seasonal rollover decisions and permission-scoped profitability. Renewed and declined outcomes require explicit recorded renewal-decision evidence (or an explicitly renewal-related cancellation reason); ordinary active, overdue, cancelled or future status does not become a renewal decision by inference.

Held outcomes require recorded pause/hold evidence. Expired outcomes require recorded ended/expired lifecycle evidence or an already-passed end date on a non-active lifecycle. Ambiguous or incomplete records remain unresolved. The recorded conversion rate uses only explicit renewed plus declined decisions, while recorded churn counts explicit declined plus expired outcomes.

Finance evidence remains optional and permission-scoped. The outcome layer does not invent target profitability or retention value and cannot renew/cancel agreements, change prices, contact customers, resolve complaints or mutate CRM, recurring-service, rollover or Finance records.

<!-- Historical item 366 handoff marker retained for regression provenance: The next planned autonomous item is **367 — Estimate Accuracy & Change-Order Margin Calibration**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 367 — Estimate Accuracy & Change-Order Margin Calibration -->

#### **367 — Estimate Accuracy & Change-Order Margin Calibration** is implemented

The Owner / Management Command Centre now compares accepted estimate assumption baselines with recorded Production and job-cost evidence. The accepted work-order assumption snapshot is preferred; current estimate assumptions are an explicitly disclosed fallback only when no accepted snapshot is available. Labour, material and equipment cost variance remains source-bounded, and labour hours are compared only where both estimate and Production evidence are recorded in hours.

Customer-approved and applied change-order estimated cost deltas can adjust the comparison baseline without rewriting the accepted estimate. Approved but unapplied changes remain visible without changing that baseline. Recorded estimate margin can be compared with recorded actual job margin, but no target margin, markup recommendation, pricing threshold or automatic calibration is invented.

Recurring calibration patterns require the same recorded variance direction on at least two comparable estimates within the same recorded template/group. This calibration layer is read-only and cannot edit estimates, approve extras, change pricing, mutate job-cost closeout or post Finance.

<!-- Historical item 367 handoff marker retained for regression provenance: The next planned autonomous item is **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 368 — Completed-to-Invoiced Cycle-Time & Cash Conversion -->

#### **368 — Completed-to-Invoiced Cycle-Time & Cash Conversion** is implemented

The Owner / Management Command Centre now measures recorded elapsed time from explicit completed Production evidence or approved closeout through invoice-candidate readiness, A/R invoice creation, payment application and full collection. Completion, closeout approval, invoice readiness and invoice creation use their recorded milestone timestamps rather than generic status or update times.

Cash collection requires both recorded payment-application evidence and a recorded A/R balance at or below zero. Missing milestone evidence remains unavailable rather than becoming zero elapsed time. Open lifecycle stages are grouped into descriptive 0–1, 2–3, 4–7 and 8+ day cohorts without turning those buckets into service-level targets or automatic collection rules.

The timing layer is read-only and cannot create invoices, apply payments, send collection messages, post journals, change closeout approvals or mutate payment/provider state.

<!-- Historical item 368 handoff marker retained for regression provenance: The next planned autonomous item is **369 — Labour Capture Completeness & Payroll Exception Reduction**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 369 — Labour Capture Completeness & Payroll Exception Reduction -->

#### **369 — Labour Capture Completeness & Payroll Exception Reduction** is implemented

The Owner / Management Command Centre now matches the last 30 completed calendar days of scheduled/Production crew-job evidence to canonical timekeeping and payroll-readiness evidence. A work unit is complete only when matching time entries exist and every matched entry is payroll-ready; missing capture, open shifts, pending corrections, attendance review, supervisor approval and other unready evidence remain distinct.

Late capture is counted only from explicitly recorded late/missed/untimely payroll exception or review codes rather than an invented elapsed-time threshold. The most recent 14 completed days are compared with the preceding 14 completed days to show recorded exception-rate movement without turning the comparison into a worker-performance target.

The management response remains aggregated to crew/job/service-date and repeated crew/job patterns. It excludes individual employee names, employee numbers, explanations, supervisor notes and approver identities, and cannot edit time entries, approve payroll/corrections, change pay codes, rank workers, make employment decisions or override Safety restrictions.

<!-- Historical item 369 handoff marker retained for regression provenance: The next planned autonomous item is **370 — Equipment Downtime Cost & Replacement Readiness**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 370 — Equipment Downtime Cost & Replacement Readiness -->

#### **370 — Equipment Downtime Cost & Replacement Readiness** is implemented

The Owner / Management Command Centre now combines equipment registry state with 365-day historical fleet downtime, recorded maintenance history, service tasks, signout/use evidence and optional linked job-level Finance context. Downtime exposure uses recorded event start/end timestamps; open downtime is measured only from its recorded start through evidence-generation time.

Registry all-time service/lifecycle cost rollups remain separate from 365-day maintenance-history and service-task costs so the layer does not add overlapping sources together. Linked job repair/replacement/delay totals remain explicitly job-level context and are not attributed to an asset unless the Finance source already provides asset attribution.

Replacement readiness preserves the existing replacement state, target date, reason and estimated cost. Repeated downtime means at least two recorded downtime events and repeated maintenance means at least two recorded maintenance/service events; these are lifecycle-review signals rather than replacement or purchasing recommendations. Lockout/return-to-service, maintenance execution, equipment purchasing/replacement, vendor commitments and Finance posting remain under their existing authorities.

<!-- Historical item 370 handoff marker retained for regression provenance: The next planned autonomous item is **371 — Material Usage Variance & Reorder Calibration**. -->
<!-- Historical item 362 queue marker retained for regression provenance: #### 371 — Material Usage Variance & Reorder Calibration -->

#### **371 — Material Usage Variance & Reorder Calibration** is implemented

The Owner / Management Command Centre now compares canonical Landscape Material Estimator planned quantities with recorded actual-use evidence, distinguishing material-issue-linked usage from production actual-use evidence without an issue link. A line is comparable only when all recorded actual-use events use the planned unit or carry a non-default explicit conversion factor to the planned unit; unresolved unit mismatches withhold variance rather than guessing.

Repeated over-use or under-use requires at least two comparable estimator lines for the same material, service context and season with the same direction. The calibration view keeps current Materials Control stock-on-hand, reorder-required state, reorder point, reorder quantity and target stock beside those patterns, including recorded stockout evidence, but does not invent a replacement reorder value.

Estimator assumptions, actual-use events, inventory quantities, reorder settings and purchasing remain under their existing authorities. This calibration layer cannot create purchase orders, contact suppliers, reserve stock or create vendor commitments.

<!-- Historical item 371 handoff marker retained for regression provenance: The next planned autonomous item is **372 — Customer Communication Outcome & Follow-Up Effectiveness**. -->

<!-- Historical item 362 queue marker retained for regression provenance: #### 372 — Customer Communication Outcome & Follow-Up Effectiveness -->

#### **372 — Customer Communication Outcome & Follow-Up Effectiveness** is implemented

The Owner / Management Command Centre now measures recorded communication outcomes from canonical CRM interactions, CRM follow-ups, approved/invoice-ready closeouts and protected notification-delivery evidence. A recorded customer response requires a later inbound CRM interaction on the same work order; missing linkage or missing inbound evidence remains unknown rather than being inferred as silence, failure or success.

Follow-up effectiveness keeps completion status and timing explicit by comparing recorded completed_at with due_at. Cancelled work is not counted as completed, overdue open follow-up stays open, and CRM outcome/status remains separate from response evidence. Provider sent state is delivery evidence only and is never treated as customer read/reply proof.

Repeated unresolved outreach means at least two recorded outbound CRM interactions for the same work order with no later recorded inbound interaction after the first outbound. It is an operational review signal only, never a customer-quality score or staff-performance rating. This layer cannot send or retry messages, create/close CRM records, change customer consent/preferences, publish customer updates, reschedule work, collect payment or contact a provider.

<!-- Historical item 372 handoff marker retained for regression provenance: The next planned autonomous item is **373 — Data Quality Remediation Outcome & Recurrence Prevention**. -->

<!-- Historical item 362 queue marker retained for regression provenance: #### 373 — Data Quality Remediation Outcome & Recurrence Prevention -->

#### **373 — Data Quality Remediation Outcome & Recurrence Prevention** is implemented

The Owner / Management Command Centre now gives every current data-quality reconciliation signal a stable <code>admin:data_quality_signal</code> source identity and joins current findings to the existing private Management Decision Outcome Journal. Current findings are separated into tracked open, untracked open and recurring states without changing the canonical source record.

A prior resolved/improved journal outcome is counted as confirmed resolved by absence only when every source required by the current data-quality scan completed successfully and remained below its configured query cap. Partial or capped source coverage therefore withholds resolution instead of treating an unseen row as repaired.

A current source key becomes recurring when recurrence was explicitly recorded or when the same key reappears after a resolved/improved outcome. Duplicate, broken-reference, stale-assignment and four-season-tag recurrence receives advisory prevention review guidance only. The layer cannot auto-merge/delete identities, rewrite foreign keys, reassign crews/equipment, clear lockouts, rewrite historical tags or automatically mutate management-journal rows.

<!-- Historical item 373 handoff retained for regression provenance: The next planned autonomous item is **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes**. -->

<!-- Historical item 362 queue heading retained for regression provenance: #### 374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes -->
#### **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes** is implemented

The Mobile Crew reliability card now compares the retained item 361 release contract with the current release for the business-read ceiling, payload budget, live-refresh interval, signed-in-session cache window, offline replay batch and Admin read-coalescing window. The rendered outcome also classifies the current payload-size band and reports a local offline-action conflict rate from aggregate queue counts only.

The release gate fails closed when a later change raises the business-read or payload ceiling, increases replay batch size, makes automatic refresh more aggressive, extends the stale-cache window, shortens Admin read coalescing, or produces an over-budget Mobile Crew payload. Clearing a regression requires repairing the source behavior; the gate does not silently accept a larger budget.

Runtime evidence is privacy-bounded: no customer names, addresses, notes, queued payload bodies, server payload bodies or device identifiers are retained by the trend view. Existing Jobs, Safety, Auth, offline-recovery and release-source authorities remain canonical, and the evidence layer cannot replay, merge, discard or mutate queued work.

<!-- Historical item 374 handoff retained for regression provenance: The next planned autonomous item is **375 — Four-Season Capacity Mix & Profitability Scenario Evidence**. -->
<!-- Historical item 362 queue heading retained for regression provenance: #### 375 — Four-Season Capacity Mix & Profitability Scenario Evidence -->
#### **375 — Four-Season Capacity Mix & Profitability Scenario Evidence** is implemented

The Owner / Management Command Centre now combines recorded 14-day dispatch and recurring-visit demand with shared crew-day evidence, configured route-capacity history, recorded Workability recovery, seasonal material readiness and permission-scoped profitability for spring/summer landscaping and lawn work, fall cleanup and leaf work, winter snow/storm/ice work and general four-season operations.

Seasonal mix is calculated only from recorded items in the current 14-day horizon. Crew evidence remains shared across mixed-season days instead of being falsely assigned as dedicated seasonal capacity. Route headroom appears only when a configured route daily-capacity value exists. Missing route capacity, recovery history, material evidence, recurring material plans, source coverage, Finance visibility or profitability remains an explicit assumption/evidence gap.

Job-family profitability and recurring-agreement profitability stay separate because their populations may overlap. No target margin, synthetic profit-per-capacity metric, automatic price, wage, growth rate, demand forecast or hidden Finance substitute is invented.

The scenario layer is read-only and cannot auto-price, dispatch, hire, schedule, purchase, contact suppliers/customers, create estimates/invoices or commit customer/vendor work.

The next planned autonomous item is **376 — Production Learning & Autonomous Roadmap Renewal II**.

<!-- Historical item 362 roadmap marker: #### 376 — Production Learning & Autonomous Roadmap Renewal II -->
#### **376 — Production Learning & Autonomous Roadmap Renewal II** is implemented

Item 376 closes the capability-level review of Builds 363–375 in `docs/production_learning_review_376.json`. This is **not** proof that live Production recovery, margins, response rates, performance or reliability improved; no live measured sample was supplied. The review records 13 source-backed capabilities and the missing denominator, coverage, recency, consent, permission, sample and seasonal comparisons needed for trustworthy outcome trends.

The renewed queue contains **377–390** (14 further bounded items). It prioritizes decision-outcome confidence, workability recovery, stop-sequence friction, retention cohorts, estimate/invoice handoffs, labour/equipment/material outcomes, consent-safe communications, data-quality recurrence, device-safe offline reliability, and four-season scenario backtesting. Item 390 repeats the roadmap renewal. All items remain advisory, source-backed, privacy- and permission-preserving, and executable without real customer messages, payments, provider credentials, external staging or manual signoff. No Finance posting, Auth/provider mutation, operational scheduling, destructive reconciliation or automatic customer/vendor commitment is authorized.

The next planned autonomous item is **377 — Management Outcome Confidence & Cohort Trend**.

<!-- Historical item 376 queue marker: #### 377 — Management Outcome Confidence & Cohort Trend -->
#### **377 — Management Outcome Confidence & Cohort Trend** is implemented

The Owner / Management Command Centre now displays permission-restricted, read-only outcomes from the canonical private management decision journal. It uses the latest decision per distinct source key in non-overlapping latest 30-day and previous 60-day windows. Both period denominators require at least five distinct source keys before a percentage or comparative trend is shown.

Hidden/failed/stale/capped/unknown/insufficient outcome evidence withholds trend claims. Follow-up overdue evidence and recurrence remain recorded source facts, not judgments of employees, customers or the effectiveness of the operation. The view adds no mutation path or new schema and cannot change Jobs, Safety, Equipment, Employment or Finance.

The enlarged Yard Workers / future multi-company landscaping and small-construction platform specification is `docs/LANDSCAPING_SAAS_EXPANSION_377.txt` with a non-production demonstration catalog `docs/demo_service_catalog_377.json`. Future tenant provisioning, recurring contract execution, employee compensation, billing, entitlements and accounting posting remain disabled until their respective isolated, reviewed, tested releases.

<!-- Historical completed-item handoff: The next planned autonomous item is **378 — Workability Forecast-vs-Recovery Calibration**. -->
<!-- Previous-item handoff: The next planned autonomous item is **379 — Route Stop-Sequence Friction Hotspots by Season**. -->
<!-- Previous-item handoff: The next planned autonomous item is **380 — Recurring Retention Cohort & Renewal Lag**. -->
<!-- Historical item 380 handoff: The next planned autonomous item is **381 — Estimate Margin Drift & Change-Order Follow-through**. -->
#### **381 — Estimate Margin Drift & Change-Order Follow-through** is implemented

Read-only comparison of accepted-estimate calibrated margin changes and approved change-order application counts is available in Owner Management. Average drift is withheld under five comparable records; inherited Jobs + Finance visibility and source confidence are required. Review candidates are advisory only, and no change-order approvals, Finance writes, notifications or schema changes are performed.

<!-- Historical item 381 handoff: The next planned autonomous item is **382 — Invoice Aging Handoff & Receivables Leakage**. -->
#### **382 — Invoice Aging Handoff & Receivables Leakage** is implemented
Read-only recorded-stage invoice handoff, open balances with missingness and bounded review candidates; 8+ day stage age is not due-date delinquency. No financial or messaging mutation.
<!-- Historical item 382 handoff: The next planned autonomous item is **383 — Labour Capture Exception Closure & Shift Readiness**. -->
#### **383 — Labour Capture Exception Closure & Shift Readiness** is implemented
Read-only historical work-unit payroll exception closure signals, with incomplete source evidence explicitly withheld, no future-shift forecast, no payroll or timekeeping mutation.
<!-- Historical item 383 handoff: The next planned autonomous item is **384 — Fleet Maintenance Cost Trend & Downtime Concentration**. -->
#### **384 — Fleet Maintenance Cost Trend & Downtime Concentration** is implemented

The Owner Management fleet lifecycle view now compares recorded history maintenance costs and fleet downtime starts/durations in consecutive 90-day windows using canonical timestamped sources. Trend percentage/absolute delta is withheld without five priced maintenance-history events in each window. Top-three downtime concentration is withheld below five known-duration events or when recorded durations are missing. Source errors and capped source reads fail closed. Separate all-time registry cost and job Finance context are never treated as period cost; no fleet, Safety, maintenance, payment or purchasing mutation.

<!-- Historical 384 handoff: The next planned autonomous item is **385 — Material Demand vs Stockout Trend & Season Transition**. -->
#### **385 — Material Demand vs Stockout Trend & Season Transition** is implemented

Adds a bounded 30-day versus previous 30-day count of recorded linked actual-use events grouped by catalog material season. Dated events from canonical actual-use and estimator lines are counted once; unknown dates, unlinked events and unit mismatches are reported. A minimum five linked recorded events in each period is required for movement comparison. Separately, a **current snapshot only** reports registered material stockouts, comparable 7/14-day planned shortages and next-season/four-season readiness pressure. There are no dated historical inventory snapshots to support a historical stockout rate or seasonal stockout improvement claim. Missing stock, source errors, capped datasets, stale data, unauthorized views or truncated stock readiness fail closed. No purchasing, stock changes, dispatch changes, Finance postings, customer sends or approval writes.

The next planned autonomous item is **386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging**.

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### **378 — Workability Forecast-vs-Recovery Calibration** is implemented

The current item adds a read-only 90-day retrospective comparison of recorded proposed reschedule dates and linked full Production completion. It reports explicit denominators and missing/invalid proposals, full completion missing, same-day/earlier/later alignment, and season-level cohorts. Mean absolute day gap and same-day proposal alignment are shown only for five or more complete pairs. Missing, stale, unauthorized or capped Workability/Dispatch/Production sources fail closed.

The current seven/fourteen-day capacity forecast remains a **forward-looking snapshot**, not an immutable historical forecast. Recorded proposed dates may have been revised; these are descriptive plan-alignment proxies, never a true forecast-accuracy or improved-business-performance claim. It cannot automatically change dispatch, workability, safety, finance or customer communication. Accessible Help is under Admin → Owner / Management Command Centre.

The next planned autonomous item is **379 — Route Stop-Sequence Friction Hotspots by Season**.

#### **380 — Recurring Retention Cohort & Renewal Lag** is implemented

The Owner / Management Command Centre adds a read-only 365-day renewal-retention view organized by the recorded expiry quarter and the recorded seasonal service context. Each eligible agreement has one expiry-cohort membership. Open-ended, missing end dates, expired outside the window, and future end dates are excluded, never counted as retained.

Only documented explicit renewed and declined decisions in the existing canonical renewal outcome record contribute to observed retention. Held, expired and unresolved outcomes remain separately reported; observed retention is not the total-customer retention rate. The denominator must contain five or more explicit decisions before the percentage is displayed.

Signed renewal-decision lag compares the recorded end date with a valid dated explicit decision (negative early, zero on end, positive late). Invalid, missing, future or implausible dates have no lag; average and median require at least five valid dated decisions. Source-query failures, capped source reads, truncated outcome payloads, missing Jobs permissions or unreliable freshness withhold all aggregates. No customer messages, subscription mutations or paid providers.

The dashboard includes quarterly and season cohorts, missing-evidence counts and a circled-i Help link. Future roadmap item is **381 — Estimate Margin Drift & Change-Order Follow-through**.

#### **379 — Route Stop-Sequence Friction Hotspots by Season** is implemented

The Owner / Management Command Centre now summarizes a 90-day, season-aware read-only route friction review. It groups canonical Dispatch, Route, Production, Timekeeping and Workability observations by distinct route-service day, deduplicating dispatch records. Sequence deviations require full sets of unique planned stop positions and distinct recorded Production start times; incomplete orders are unscored, not assumed exact. Service overruns, recorded delays, return visits and Workability effects retain individual eligible-evidence denominators.

Hotspots require the same friction type on at least two distinct dates for a route and season. Percentages are withheld below five eligible route-days. Source-query errors, capped reads, missing permissions and unreliable freshness withhold the aggregates entirely. Season summaries include separate spring/summer, fall, winter and four-season categories, plus missing-sequence coverage.

The view does not use external routing providers or GPS, infer individual employee performance, mutate scheduled stops or override Safety/Workability decisions. Admin → Owner / Management Command Centre includes a circled-i Help link to the explanation.

The next planned autonomous item is **380 — Recurring Retention Cohort & Renewal Lag**.

#### 380 — Recurring Retention Cohort & Renewal Lag

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 381 — Estimate Margin Drift & Change-Order Follow-through

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 382 — Invoice Aging Handoff & Receivables Leakage

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 383 — Labour Capture Exception Closure & Shift Readiness

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 384 — Fleet Maintenance Cost Trend & Downtime Concentration

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 385 — Material Demand vs Stockout Trend & Season Transition

Use recorded source evidence, explicit missing-data and permission states, season-aware windows, and bounded advisory guidance without authority to mutate business records. Measurements must not imply improvements before real Production outcome evidence exists.

#### 386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging (implemented)

Read-only, consent-scoped communication management: age open CRM follow-ups into Ontario due-date buckets; keep missing dates, statuses, source linkage and recorded inbound responses explicit; show existing live-update email consent only for the matching protected outbox items. Withhold all counts on missing, stale, capped or permission-hidden source evidence. No generic contact authorization, automatic sending, provider retry, CRM changes, purchase, dispatch or Finance writes. No improvement claim without production measurement.

Next: **387 — Data-Quality Fix Recurrence & Source Freshness** (implemented).

#### 387 — Data-Quality Fix Recurrence & Source Freshness (implemented)

Read-only Admin+Jobs-permissioned 30-day and preceding-60-day dated quality decision cohorts from items 360/373 stable source-key evidence. Reports recurring keys, events following a dated resolved/improved decision, descriptive normalized 30-day event rates, Ontario decision-month spring/summer/fall/winter breakdowns and item 351 canonical source freshness. Fewer than five distinct dated keys per window withholds percentages. Missing, hidden, stale, capped, unknown-timestamp, failed or undated evidence withholds comparisons; a missing defect is not proof of a successful past fix. No automatic reconciliation, source writes, employee scoring or Production improvement claim.

Next: **388 — Offline Conflict Closure & Device-Safe Reliability Cohorts** (implemented).

#### 388 — Offline Conflict Closure & Device-Safe Reliability Cohorts (implemented)

The existing local device conflict queue and item 348 recovery history are aggregated for the currently signed-in profile, without new storage or server collection. A Mobile Crew App v2 card shows aged conflicts, pending actions, locally recorded Keep Server/Discard removals versus Keep Mine/Merge/Retry replay preparation, with last-7-day and preceding-23-day comparison windows. At least five local decisions per window are required to show percentages; a full 50-entry history cap, invalid/future timestamps or missing owner identity withhold comparisons. Device-specific samples are not fleet-wide and a local closure choice is never proof of successful server sync. Only a user decision can perform a recovery action; no automatic writes or increased read/replay budgets.

Next: **389 — Four-Season Crew-Day Mix Constraint & Scenario Backtesting** (implemented).

#### 389 — Four-Season Crew-Day Mix Constraint & Scenario Backtesting (implemented)

Read-only 14-day mixed assigned crew-day and shared seasonal readiness review using the existing capacity forecast and canonical Dispatch, Crew, Workability, Equipment and Recurring Visit sources; no invented per-crew hours or hard season allocations. Historical 90-day scheduling-to-completed-Production comparison uses only unambiguous work-order pairs, excluding multiple plans and sessions and requiring at least five completed pairs for per-window 30/60-day alignment percentages. It is explicitly retrospective recorded-plan alignment, **not** historical forecast accuracy or improvement evidence. Jobs permission and current, complete, uncapped canonical source evidence required, with missing/failed/stale/timestamp-unknown reads withholding the analysis. No dispatch, Safety, Equipment or Finance writes.

Next: **390 — Production Learning & Autonomous Roadmap Renewal III**.

#### 390 — Production Learning & Autonomous Roadmap Renewal III (implemented)

Item 390 records a dated capability-versus-outcome evidence review for items 377–389 in `docs/production_learning_review_390.json`. On 2026-10-13, privacy-safe read-only aggregate inspections found **zero recorded rows in ten inspected Production operational tables** (including Dispatch, Workability, Production sessions, CRM follow-ups, and the management decision journal). This is a bounded source-presence observation, not proof of zero activity elsewhere or of successful improvements. Percentages, historical comparisons and business outcome assertions remain **unknown / insufficient observed evidence**. No Production writes, schema, payment/provider, Safety or schedule changes are authorized by this review.

The next wave prioritizes usable first-use customer/property and service setup, explicit operator confirmation and saved/error acknowledgement, dispatch/field execution readiness, QA, Finance handoff and genuine evidence capture. The renewed queue below covers items 391–405, with a further review item at 405. Each future release must enforce canonical source/module permissions, fail-closed freshness and safe authority boundaries, with a phone and source acceptance gate.

Next: **391 — First-Use Readiness & Verified Data Intake**.

#### 391 — First-Use Readiness & Verified Data Intake (implemented)

An accessible, read-only source-derived first-use checklist is now at Owner / Management Command Centre, with help at `/help.html#first-use-readiness-verified-intake`. It distinguishes source-presence from completed operational readiness. The existing authenticated backend canonical `source_freshness` map verifies CRM customer/property, crew, equipment, job, dispatch, Production and recurring-visit queries with source-read timestamp, role visibility, freshness, row count and query-cap checks. Recent uncapped `no_rows` means verified empty at that moment and an opportunity for authorized intake, **not** a fictional performance zero. Failed, hidden, stale, undated, capped or expired source reads withhold evidence. Existing Jobs/CRM module navigation is the only next action. No automatic writes, seeds, schema updates, provider calls or signoffs. Existing Refresh disables duplicate clicks and announces checking and completion.

Next: **392 — Customer & Property Guided Record Creation**.

#### 392 — Customer & Property Guided Record Creation (implemented)

Add a two-step customer/property create-or-edit workspace inside the existing Customer & Property CRM. Source lookup, name/email and same-customer property name/address duplicate warnings are pre-submit protections, not uniqueness certification; customers and sites remain in canonical `clients` / `client_sites`. Explicit Save calls existing authorized `crm_client_save` or `property_site_save` through `manageOperations`, preserving Jobs approve permissions, central audit and RPC ownership. Busy buttons display Saving… and suppress repeat requests until the backend acknowledges a record identifier and the CRM readback is checked. Empty customer list forbids property creation. Missing CRM access prevents writes. No new Edge Functions, database migrations, customer messages, automatic import, merges, invoices or provider calls. Phone-source/browser acceptance validates new/update/lookup, duplicate, unauthorized, ack error and saving lock cases.

Next: **393 — Four-Season Service Template & Price Source Validation**.

#### 393 — Four-Season Service Template & Price Source Validation

**Implemented:** Admin read-only source review shows actual recorded template charges, unit/duration basis and active configured Canadian sale tax codes, including missing-source warnings, without publishing or writing rates. The following item is **394 — Crew Availability & Dispatch Conflict Gate**.

**Outcome:** Expose season/service-specific existing price and unit source validation, missing-rate warnings and Canadian tax context; do not invent rates or publish prices.

**Canonical source:** service catalog, templates, season and tax configuration. **Boundary:** Configuration review only; no live price change or invoice write.

#### 394 — Crew Availability & Dispatch Conflict Gate

**Outcome:** Test job assignment against actual crew availability, overlapping dispatch, ready vehicles and configured schedules using the existing Jobs authority, no auto-rescheduling.

**Canonical source:** dispatch, crews, shifts, routes, equipment. **Boundary:** No automatic route editing, personnel reassignment or dispatch.

#### 395 — Workability Safe Schedule Recheck

**Implementation:** Read-only, fresh authorized `workability` check in the existing Weather & Workability workspace; matches exact dispatch observation/decision, required HSE monitoring, existing holds and loaded Safety approve access. Explicit HOLD/REVIEW/operator recheck results; never changes schedules or sends messages. Regression scripts and browser acceptance are release-gated. Next: **396 — Job Start/Stop & Production Evidence Capture**.

**Outcome:** Require recorded Ontario conditions, workability decisions and Safety permission for schedule-review readiness, never override a hold or automatically dispatch.

**Canonical source:** workability observations/decisions, Dispatch and Safety. **Boundary:** Safety and operator workability decision remain final; no autonomous scheduling.

#### 396 — Job Start/Stop & Production Evidence Capture

**Implemented:** Mobile Crew Start/Finish now use authenticated, assignment-filtered transition endpoint and atomic Schema 237 intent ledger with stable retry keys; pending/saved/uncertain status is shown on the phone, completion notes remain on canonical sessions, and Production quantity/Execution Proof remain linked actions. Dedicated source and rendered browser regressions are release-gated. **Next queued: 397 — Safety & Equipment Readiness Preflight.**

**Outcome:** Make one mobile job session path legible with a pending/saved/retry/error acknowledgement and linked completion evidence; no duplicate sessions on repeated clicks.

**Canonical source:** mobile crew, Production sessions and execution proof. **Boundary:** Existing production writes only with explicit user action; immutable idempotency evidence.

#### 397 — Safety & Equipment Readiness Preflight

**Implemented on dev:** Admin operations now exposes an on-demand, read-only job/equipment preflight for authorized Jobs records. Every result remains BLOCKED / UNVERIFIED for separate canonical Safety signoff, training and current equipment inspection/lockout confirmation; unknown sources fail closed. No status transitions, approvals, equipment release or employment changes. Source acceptance: `node scripts/safety-equipment-preflight-397-check.mjs`. **Next queued after verified Production GREEN: 398 — Material Issue & Return Reconciliation.**

**Outcome:** Before an active job, surface canonical site hazard, training and equipment lockout readiness, with explicit blocked/unavailable instead of auto-clearing.

**Canonical source:** Safety plans, training, lockout and equipment readiness. **Boundary:** No Safety approval, lockout removal or employment change through this layer.

#### 398 — Material Issue & Return Reconciliation

**Implementation scope:** A read-only operator materials review now joins authorized estimator planned/actual-use evidence with separate canonical stock snapshots, units, cost availability, negative balances, and recorded usage variance without inventory mutation. This does **not** constitute complete job-level estimated/actual issue/return reconciliation: corresponding transaction-level, audit, and return source linkage remains unimplemented and must be completed before describing the full milestone 398 objective as accepted. Source contract: `node scripts/material-issue-return-reconciliation-398-check.mjs`. No automatic issue, return, adjustment, receipt, supplier or purchasing operations.

**Outcome:** Link job-level estimated and actual material quantities to canonical stock issue/return actions; preserve unit, cost and audit provenance and no negative stock assumption.

**Canonical source:** materials catalog, stock adjustments and job material issues. **Boundary:** No automatic purchase, receipt, stock adjustment or supplier interaction.

#### 399 — Visit Completion, QC & Customer-Safe Evidence

**Outcome:** Guide crew proof capture through supervisor QC, customer-safe visibility and deficiency correction; never impersonate a customer or auto-approve signoff.

**Canonical source:** execution proofs, QC and customer portal signoff. **Boundary:** No automatic customer approval, external message or image disclosure.

#### 400 — Estimate/Change Order to Invoice Readiness

**Outcome:** Connect recorded estimate, approved change-order application and work completion to a Finance review-ready invoice packet; Finance writes remain separately permissioned.

**Canonical source:** estimates, change orders, closeout and Finance invoices. **Boundary:** No posting, collection, external accounting provider or tax remittance.

#### 401 — Receivables Aging & Payment Reconciliation

**Outcome:** Show authorized aging, deposit allocation and payment reconciliation exceptions from existing Finance records, without creating or posting payment transactions.

**Canonical source:** accounts receivable, deposits and payment reconciliation. **Boundary:** Finance authority and payment providers unchanged; reconciliation review only.

#### 402 — Recurring Renewal & Season Rollover Readiness

**Outcome:** Review four-season agreement renewal dates, overlapping site work and winter rollover prerequisites; require operator confirmation for canonical renewal actions.

**Canonical source:** recurring agreements, visits, seasonal operations. **Boundary:** No unattended auto-renewal, communication or payment.

#### 403 — Offline Replay Receipt & Provenance Confirmation

**Outcome:** Add profile-bound offline replay receipt evidence tied to canonical server acknowledgements; local queue removal alone is not server success, no cross-device identifiers.

**Canonical source:** device-local outbox plus existing server conflict/result contracts. **Boundary:** No automatic conflict merge/retry or cross-profile replay.

#### 404 — First Operational Cohort Measurement & Conversion Funnel
**Implementation acceptance contract (not yet GREEN):** Use only authorized CRM, Dispatch, Production, QC, and Finance reads. Require source timestamps, complete permission/cap provenance, deterministic distinct cohort IDs and actual canonical joins; missing, stale, hidden or capped inputs must be withheld rather than counted as zero. Withhold small-sample rate/trend comparisons; don't infer employee effect. Render read-only owner diagnostics and source links; no operational, financial or customer/provider mutation. Test negative/ambiguous/complete cases and browser display. Feature, dev, hosted Vercel and exact main checks must independently pass before marking production GREEN. This item remains development-only until those checks are recorded.


**Outcome:** Only with genuine samples and complete fresh sources, show first-job funnel denominators from customer intake through dispatch, session, closeout and invoice, and withhold small cohort comparisons.

**Canonical source:** CRM, Dispatch, Production, QC and Finance canonical views. **Boundary:** No employee ranking or inferred customer effect; minimum-sample and freshness gates.

#### 405 — Production Learning & Autonomous Roadmap Renewal IV

**Outcome:** Review measured first-use evidence and outcome gaps, publish the next >=10 bounded releases; never report improvement without dated comparable Production events.

**Canonical source:** completed releases and dated source-cohort evidence. **Boundary:** No additional mutations or external authorization grants.


**Implemented acceptance:** The dated 2026-10-16 read-only sample across six named Production tables in `docs/production_learning_review_405.json` returned zero recorded rows (and zero clients created in the past 90 days). This is not a statement about the whole business. Released items 391–404 have implemented capabilities, but first-use operational improvement, invoice conversion, season-specific retention, employee effects and ROI remain unmeasured. The renewed queue below comprises 12 bounded releases; no automatic business writes or additional permissions were introduced. The next build is **406 — First-Customer Intake Receipt & Duplicate-Safe Review**.

#### 406 — First-Customer Intake Receipt & Duplicate-Safe Review

**Acceptance:** Demonstrate permissioned first-customer intake receipt and existing duplicate review on a real operator-provided example; withhold status when no dated customer record exists.

**Implementation:** CRM supervisor-or-higher canonical read now cross-checks client identifiers and original `clients.created_at` against the existing CRM directory in a five-minute, bounded, complete-source receipt. Missing, expired, failed or capped source evidence withholds display and pauses new-customer creation until recheck. The operator panel shows the chosen customer's dated receipt, advisory exact-name/email duplicate matches, and a read-only Recheck action; no customer data is generated to simulate acceptance. Authenticated existing `crm_client_save` remains the only customer write authority. No genuine first-customer intake has been claimed from empty Production source evidence. This item requires the matching `admin-directory` Edge Function release and exact-source production verification before being marked GREEN.


**Canonical source:** CRM customer intake and existing duplicate review. **Boundary:** No automatic customer creation, duplicate merge, or broad-profile disclosure.

#### 407 — Property & Four-Season Coverage Evidence

**Acceptance:** Reconcile one real customer-owned property to its seasonal work types without inferring winter or summer readiness from missing agreements.

**Implementation:** The permissioned CRM read validates original customer/property ownership, complete property and service-agreement read coverage, source freshness, and dated active site-specific agreements across spring/summer, fall and winter. The operator can recheck, select an owned property and see per-season agreement states. Missing or paused/draft/future/unscoped agreements do not establish active coverage. No site mutation or weather/workability/snow readiness inference is made. Real-world owner acceptance remains unmeasured if there are no customer-owned property records. The canonical `admin-directory` Supabase Edge Function must match the exact released `main` source with JWT enabled before GREEN.


**Canonical source:** CRM properties, site intelligence and seasonal agreements. **Boundary:** No site mutation, enrollment or plan renewal without operator action.

#### 408 — Estimate Acceptance to First Work Order Trace

**Acceptance:** Show explicit customer acceptance, internal approval and first work-order identity with missing approvals marked unavailable.

**Implementation:** A read-only supervisor Jobs review checks a fresh, complete, capped canonical estimate workflow against original estimate identities, customer/site ownership and original linked work orders. Dated quote-package acceptance is distinguished from estimate status-only acceptance, and a separate dated internal approver is required whenever approval is configured. An approval that is not required is explicitly labelled as such. Earliest linked work-order identity is withheld when chronology, ownership or source coverage is ambiguous. Recheck does not approve, price, convert, issue, email or modify records. No genuine trial acceptance is claimed without live dated records. The exact source for the Jobs-scope `admin-directory` function must be released with JWT verification enabled before GREEN.

**Canonical source:** Estimate workflow and work-order authority. **Boundary:** No automatic estimate acceptance, pricing or work-order issuance.

#### 409 — First-Dispatch Schedule Receipt

**Acceptance:** Match an authorized first work order to a dated noncancelled schedule; show unresolved resource/workability exceptions separately.

**Implementation:** A supervisor-and-Jobs-view-only, read-only source receipt cross-checks estimate quote acceptance, dated internal approval (when required), original first work-order identity, work-order ownership and earliest noncancelled dated dispatch. Capped, failed, stale, duplicate, mismatched or ambiguous schedule/Workability reads withhold the result. A cancelled or superseded schedule never counts. Conflicts, crew assignment and existing dispatch-readiness evidence are presented separately from linked Workability observations, including unresolved restrictions; absence of weather observations does not prove safe conditions. Operator Recheck does not assign crew, override Safety/workability, dispatch, communicate, price or change Finance. Exact released `admin-directory` source must be deployed with JWT enabled and verified in Production; owner trial cannot be claimed without actual dated operational records.

**Canonical source:** Dispatch schedule and Workability authorities. **Boundary:** No unattended dispatch, weather override or staff assignment.

#### 410 — Production Start and Return-Visit Proof

**Acceptance:** Reconcile first-job scheduled visit to an actual dated started session, partial completion and return-visit evidence.

**Implementation:** Supervisor/JOBS read-only first-job production receipt reconciles canonical accepted quote/approval, earliest work order, first noncancelled dated dispatch, actual started session and dated field-capture receipt with the same work-order and customer/site identity. An explicit unfinished/partial completion field is not final signoff; return required versus separately recorded dated return session/receipt are distinct states. Missing, capped, stale, mismatched, duplicate or ambiguous source is held. No synthetic production, invoicing, staff assignment, auto completion or customer outreach. The exact `admin-directory` main backend source must be deployed with JWT verification and verified. Dedicated service-offering architecture contract is retained in `docs/ACTIVE_PROJECT_HANDBOOK.md`: six separately selectable company service offerings sharing CRM, Jobs, Finance, equipment, inventory, dispatch and HSE remain a staged future rollout, not live toggles.

**Canonical source:** Production sessions and field capture receipts. **Boundary:** No synthetic session or automatic completion.

#### 411 — Material and Equipment First-Job Trace

**Acceptance:** Distinguish recorded actual materials/equipment from estimates on the same first-job identity with caps and permission checks.

**Canonical source:** Materials issue, equipment use and Production evidence. **Boundary:** No inventory correction, lockout override or job-cost posting.

#### 412 — Quality-Control Closeout Evidence

**Acceptance:** Show first-job QC, supervisor approval and customer-safe proof completeness without substituting planned steps for completed evidence.

**Canonical source:** QC, supervisor signoff and closeout packages. **Boundary:** No automatic signoff, customer message or review request.

#### 413 — Invoice Readiness and Candidate Provenance

**Acceptance:** Link approved first-job closeout to Finance candidate identity with explicit missing and approval states.

**Canonical source:** Approved closeout and Finance invoice candidate source. **Boundary:** No posting an invoice, collection, payment or external provider call.

#### 414 — First Invoice Receivable Confidence

**Acceptance:** Verify actual non-void first invoice presence and the authoritative receivable state only for permissioned, complete samples.

**Canonical source:** Finance receivable and payment application views. **Boundary:** No charge, receipt allocation or customer follow-up automation.

#### 415 — Seasonal First-Use Cohort Coverage

**Acceptance:** Show season-specific first-use denominators only when dated, fully linked and sample-supported.

**Canonical source:** CRM first-use dates, seasonal services and Workability. **Boundary:** No performance attribution, staff ranking or zero assumption.

#### 416 — Owner First-Use Trial Acceptance Workbench

**Acceptance:** Provide a bounded owner acceptance checklist for each canonical first-use handoff and record unresolved evidence gaps without fake demo success.

**Canonical source:** Existing owner source checks, Help and operator acceptance. **Boundary:** No unattended seed data, external outreach, or account-role change.

#### 417 — Production Learning & Autonomous Roadmap Renewal V

**Implemented acceptance:** On 2026-10-19 at 23:27 America/Toronto a read-only Production inspection again found zero records in all six named canonical tables plus zero client intake in the preceding 90 days. Item 406–416 code has been promoted but actual comparable first-job outcomes have not been measured; **no first-job improvement**, conversion lift or ROI is claimed. The pure read-only `js/first-job-outcome-comparison-417.mjs` verifies two fresh authorized complete noncapped nonoverlapping cohorts (at least ten genuine first jobs per period) before showing descriptive rates and withholds per-stage rates when denominators are under ten. No unauthorized access, schema, roles, invoices, payments, customer communication or business transactions were introduced.

**Detailed dated source report:** `docs/production_learning_review_417.json`. **New bounded queue:** `docs/NEXT_STEPS_AND_SANITY_CHECK.md` (12 proposed releases). **Next build: 418 — First Live Trial Source Coverage & Owner Acceptance.**

**Canonical source:** Dated Production source counts and released 406–416 code evidence. **Boundary:** No autonomous business transactions or unauthorized data access.





Items **318 — Job Cost & Profitability Closeout**, **319 — Landscaping Finance Dashboard & Cash Position**, **320 — Operations Needs Attention**, **321 — Crew Scheduling & Dispatch**, **322 — Recurring Lawn & Yard Maintenance Engine**, **323 — Property & Site Intelligence**, **324 — Estimate → Job → Invoice Workflow**, **325 — Landscape Production Tracking**, **326 — Mobile Crew App v2**, **327 — Safety & Compliance Command Centre**, **328 — Job Hazard & Site Safety Plans**, **329 — Incident & Near-Miss Investigation**, **330 — Training & Certification Matrix**, **331 — Equipment Registry & QR System v2**, **332 — Daily Equipment Inspection & Lockout**, **333 — Fleet, Trailer & Vehicle Operations**, **334 — Preventive Maintenance Engine**, **335 — Fuel, Consumables & Materials Control**, **336 — Employee & Crew Management**, **337 — Timekeeping, Attendance & Payroll Evidence**, **338 — Performance & Development**, **339 — Hiring & Onboarding Workflow**, **340 — Customer & Property CRM**, **341 — Route Optimization & Territory Management**, **342 — Weather & Workability Controls**, **343 — Landscape Material Estimator**, **344 — Change Orders & Extras**, **345 — Quality Control & Customer Signoff**, **346 — Seasonal Operations Centre**, **347 — Universal Activity & Audit Timeline**, **348 — Offline & Conflict Recovery**, **349 — Saved Views, Search & Command Centre**, **350 — Owner / Management Command Centre**, **351 — Management Metric Freshness & Confidence**, **352 — Autonomous Exception Triage & Next-Safe-Action**, **353 — Four-Season Capacity & Workability Forecast**, **354 — Route & Crew Efficiency Evidence**, **355 — Recurring Service Renewal & Retention Workbench**, **356 — Estimate-to-Cash Leakage & Margin Recovery**, **357 — Labour, Equipment & Fleet Utilization Decision Support**, **358 — Materials, Consumables & Seasonal Stock Readiness**, **359 — Customer Communication Readiness & Queue Quality**, **360 — Data Quality, Duplicate & Orphan Reconciliation Workbench**, **361 — Mobile, Offline & Read-Budget Reliability Optimization**, and **362 — Production Learning & Autonomous Roadmap Renewal**, **363 — Management Decision Outcome Journal & Learning Loop**, and **364 — Workability-to-Schedule Recovery Outcomes** are implemented by the current release. The renewed autonomous queue now continues with **365–376**, beginning with **365 — Route Plan-vs-Actual & Stop-Sequence Learning**. The four-season Ontario operating model applies to every later release where season or service type is relevant. The canonical cross-AI operating instructions live in the **Cross-AI autonomous handoff** section of `docs/ACTIVE_PROJECT_HANDBOOK.md`.

### Roadmap selection rules

When the next YW technical item is requested, prefer the earliest still-valid roadmap item whose prerequisites are satisfied. A newly discovered release, security or data-integrity defect may take priority when it materially affects safe operation or release truth. Small adjacent fixes may be grouped when they share one authority/test surface, but unrelated business areas should remain separate.

For items 351 and later, do not default to CI-only micro-releases merely to raise the release number. Prefer measurable operator, seasonal, economic, data-quality or reliability value unless a new release-safety defect is proven. Do not turn external staging, accounting-provider or payment-provider acceptance into a blocking ordinary build. When those external prerequisites are unavailable, keep provider/payment mutation disabled and continue with the next safe repository-owned autonomous release.

The target is not the highest possible release number. The target is a landscaping and yard-maintenance operating system that releases with trustworthy exact-source evidence, keeps Safety, Jobs, Equipment, Employment and Finance connected, shows real crew/job profitability, reduces repetitive office and field work, remains usable on phones and during poor connectivity, preserves audit and regulatory/accounting boundaries, and eventually closes staging/accounting/provider acceptance with genuine evidence rather than source-only confidence.


## Renewed bounded scope after Item 417 (proposed, not deployed)

#### 418 — First Live Trial Source Coverage & Owner Acceptance

**Implementation:** New Admin owner-controlled workbench `js/owner-first-live-trial-418.js` consumes only the existing authenticated `owner_first_use_trial_acceptance` receipt; `js/first-live-trial-418.js` validates the permissioned dated customer, original owned property, first job, ten unique ordered handoffs, source totals and reconciled gap provenance. Only an explicitly checked and confirmed fully verified sample may prepare a **manual, unsigned clipboard acceptance candidate**. Samples with missing proof can export a gap-review receipt only. Clipboard output is neither backend acceptance nor a saved owner signature. A denied, stale, unknown, incomplete or capped source fails closed and an empty Production source does not invent a live trial. No Supabase RPC, schema, Edge Function or business writes. Mobile/browser and source regressions run in CI. **Next queued: Item 419 — Company Service Offering Entitlement Inventory.**

**Acceptance:** Verify an actual first customer, property, job and owner handoff using only permissioned dated source records.

**Canonical source:** CRM and Jobs first-use receipts. **Boundary:** No synthetic customer or automatic acceptance.

#### 419 — Company Service Offering Entitlement Inventory

**Implementation:** A dated, read-only Production aggregate source audit at `public/data/company-service-inventory-419.json` is shown in the Admin source-inventory panel. The inspected Production evidence reported four permission-driven modules (Admin/Jobs/Finance/Safety) enabled, four active price templates, zero CRM customers/properties/work orders/estimates/recurring agreements/contract documents in the sampled sources and zero company/tenant key matches across nine inspected backbone tables. **No independent company service entitlement can be inferred or verified from those source facts.** All six specialist offerings are displayed as NOT VERIFIED, with landscaping and plowing-related price templates distinguished from entitlement authority. Missing tenant identity/isolation, canonical company registry, safe defaults, historical read-through and owner audit are explicit prerequisites for Item 420. This static snapshot is not a live entitlement API. No Supabase change or permission grant. Source and mobile-browser tests are CI-gated.

**Acceptance:** Inventory existing platform/module and pricing evidence, live-contract source coverage and tenant-boundary gaps for all six independently selectable services.

**Canonical source:** Dated Production SQL audit, shared CRM/Jobs/Pricing/Agreement sources and active platform handbook. **Boundary:** Inventory only; no entitlement or permission changes.

#### 420 — Audited Company Service Offering Registry

**Implementation:** Create owner-scoped companies with six disabled-by-default service switches, server-enforced RLS ownership, exact authenticated identity verification, explicit owner confirmation per toggle, and append-only audit history. Reviewed additive migration lives in `sql/company_service_offering_registry_420.sql` with a guarded empty-only rollback in `sql/company_service_offering_registry_420_rollback.sql`. The Admin panel reads owned companies and the server's authoritative current toggle and audit rows, failing closed on gaps/cross-tenant mismatches. Source and browser gates run through existing CI. Existing Shared Core Customers/Jobs/Finance/Safety/equipment records and staff module-role grants are untouched; this is NOT a retrofit of older records to a tenant partition. Enablement governs owner intent only until Item 421 server-side new-work authorization.

**Acceptance:** Establish audited owner toggles and isolated *new registry* records while retaining historical read continuity; prove no auto-enable or deletion, and preserve guarded rollback.

**Canonical source:** Authenticated owner company registry, six company service rows and immutable server audit. **Boundary:** Do not terminate existing agreements, hide archived jobs, or interpret toggles as permission for new service work.

#### 421 — New-Work Service Entitlement Enforcement

**Implementation:** SQL migration `sql/company_new_work_entitlement_421.sql` creates mandatory INSERT-time company/service identity on new canonical Estimates and Work Orders, rejects missing/disabled/cross-company service keys, and verifies both the authentic company owner and the independent active Jobs create/approve/manage role authority. Existing historical rows retain original read/update behavior, and scoped records cannot silently change company/service. Linked estimate/work-order company and module must agree; no legacy company inference. The guided Admin draft flow calls authenticated, owner-verified SQL RPCs for new draft estimates and work orders. Each authorized insert records a server-owned append-only entitlement receipt. Customer/site linking is intentionally blocked until Item 422 independently verifies existing Shared Core customer ownership; no dispatch, payment, invoicing, auto-conversion or cancellation. Unscoped legacy forms creating new canonical estimates/work orders fail closed instead of bypassing the service switch. Browser, source, and Help mobile CI are mandatory. Rollback file refuses deletion if scoped business work or receipts exist.

**Acceptance:** Verify enabled company offerings independently of Jobs employee permissions for all new canonical estimate/work-order INSERT paths; retain historical work and explicit source-consistency protection.

**Canonical source:** Owner-only service switch from Item 420, authenticated profile/Jobs permissions, original Estimates/Work Orders, and receipt audit. **Boundary:** No retroactive cancellation, cross-tenant customer mapping or permission bypass.

#### 422 — Cross-Service Customer & Property Continuity

**Implementation:** Add owner-only immutable provenance links from the existing `clients` and `client_sites` identities to an explicitly owned company. Reviewed SQL is in `sql/company_customer_property_continuity_422.sql`; its customer/property creation RPCs insert the *original* CRM rows and their tenant proof atomically, and its history RPC reads only that company's verified links and original scoped Estimates/Work Orders. A second server function permits a one-time customer/property assignment to the company's draft, while the original Item 421 Jobs-create and enabled-service checks still run. The app's 422 owner workbench supports safe creation, authenticated readback, an all-services timeline, and explicit draft attachment. Historical unscoped data remains unchanged and cannot be implicitly claimed from names, addresses, phone numbers or matching service records. Earlier company drafts can stay unlinked; disabled services remain visible in verified historical timeline but cannot authorize new attachment. No new CRM identity table or invoice/dispatch route is introduced. Source/browser gates and phone Help acceptance are mandatory.

**Acceptance:** Present original one-customer/many-services job history with privacy and tenant checks.

**Canonical source:** Original CRM customer and site records. **Boundary:** No duplicated CRM authority or cross-tenant disclosure.

#### 423 — Shared Equipment & Materials Allocation Proof

**Implementation:** Add the reviewed `sql/shared_equipment_material_allocation_proof_423.sql` as an immutable, owner-scoped allocation *receipt*, keyed uniquely to exactly one original `material_issue_lines` ID or `equipment_signouts` ID. A guarded RPC rechecks active owner, independent Jobs creation permission, enabled company service, Item 422 canonical customer/property proof, exact work-order link, material source status and quantities, matching plan line, equipment safety/lockout and overlapping-checkout holds. A separate bounded RPC returns only company work orders, canonical source candidates and their one-time proof state, including a source fingerprint that detects later ledger changes. Owner confirmation in Admin records the proof once; repeated identical requests are idempotent, cross-order/different-source-attribution attempts fail. Phone/mobile rendered acceptance and static CI contracts are mandatory. The receipt never deducts stock, posts job costs or account journals, books equipment hours, overrides safety, auto-merges legacy work or invoices; displayed material amounts are the original issued amounts and not another accounting charge. If the original source changes, HOLD requires human review.

**Acceptance:** Attribute original shared-asset/material issue evidence to authorized company work orders exactly once, retaining original source and cost authority, and withhold unverified/changed/foreign/locked-out data. Production currently contains no material issue or equipment signout rows, so the protected browser tests use synthetic fixtures and live SQL verifies schema/privileges rather than claiming live operational consumption.

**Canonical source:** Original Equipment, Inventory and Jobs ledgers. **Boundary:** No silent stock corrections or lockout overrides.

#### 424 — Landscaping Field Production Evidence

**Implementation:** A private append-only field attestation keyed uniquely to an original `job_session_production_quantities` record; the owning landscaping company's original Jobs work order, dated session, verified client-property zone, recorded operator and positive measured activity/unit must all match. The owner-signed, dated observation may reference existing Execution Proof and QC run IDs only when they belong to the same session/order. Source fingerprints detect later original-quantity, session or site-zone changes and move the displayed receipt to HOLD. Original Production, Jobs, QC and media stay authoritative; no user-provided operator signature or timestamp is trusted. Owner-only Admin panel with mobile layout and Help link; new SQL `sql/landscaping_field_production_evidence_424.sql`, source and browser CI regression. A permissioned empty Production directory is *not* evidence that any field work was completed. No automatic completion, QC approval, invoice or financial posting.

**Acceptance:** Record site-zone, measured grounds work and dated operator field evidence for landscaping.

**Canonical source:** Jobs, Production and QC sessions. **Boundary:** No automatic completion or invoice.

#### 425 — Construction Phase, Permit & Change Control

**Implementation:** Add owner-only append-only construction *phase references* for an original Jobs company-scoped construction work order, with a unique phase key, sequence, factual scope and optional original work-order plan-line link. Add one immutable, uniquely keyed operator-reported permit-evidence receipt per phase/category/reference, with observed date, source document reference, notes and optional existing same-work-order Safety plan and change-order links. Server guards require enabled construction entitlement, independent Jobs create access, owner/tenant and original customer-property evidence. A bounded owner dashboard reads original Safety stop-work/supervisor reviews, signed Finance release and source change-order supervisor/customer approvals and budget application. All permit statuses are operator reports, NEVER issued-certification; outstanding source approvals produce HOLD and source fingerprints detect later changes without automatic clearance. No payment, permit, Safety, Finance, Jobs completion or change-order mutation. Reviewed SQL `sql/construction_phase_permit_change_control_425.sql`, Admin workbench, mobile Help and protected source/browser tests. Production currently has no construction-scoped work orders, original change orders, Safety plans or Finance release reviews; browser fixtures test bounded synthetic cases, not fictitious live completion.

**Acceptance:** Link construction phase and permit evidence to original work orders and financial approval gates.

**Canonical source:** Jobs phases, Safety and approved change orders. **Boundary:** No automatic permit certification, change-order approval or posting.

#### 426 — Water Park Inspection & Safety Evidence

**Implementation:** The immutable, owner-only `ywi_aquatic_inspections_426` and `ywi_aquatic_followups_426` tables attach operator-reported dated aquatic area observations and follow-up action receipts to the **original** company-scoped `water_parks` Jobs work order, with original Item 422 customer/property proof and independent Jobs create permission/entitlement. Source optional site Safety plans must belong to the identical work order and property. The receipt stores original source log reference, factual notes, optional observed pH/sanitizer/temperature *without threshold interpretation*, and reported concern/closure only; no verified regulatory inspection is implied. The original Jobs/Safety fingerprint yields `source_changed_hold` on changes. Reported concerns/closure, missing or unapproved Safety plans remain on HOLD. An operator-reported follow-up **never** lifts a closure; independent Safety authorization remains required. Repeating an identical key/request is idempotent, changed payloads conflict. Admin owner UI at phone/desktop with Help, reviewed `sql/water_park_inspection_safety_evidence_426.sql`, source/browser tests; no automated dosing, facility reopening, compliance certification, Safety mutation, job closure, inventory/Finance posting or invoice. Production's actual aquatic work/inspection counts must be verified before claiming a live inspection.

**Acceptance:** Track dated aquatic inspection records, closure holds and follow-up receipts.

**Canonical source:** Safety and maintenance inspection authority. **Boundary:** No automated chemical dosing or unattended reopening.

#### 427 — Snow Removal & Plowing Event Separation

**Implementation:** Append-only, owner-only storm service receipts bind two independent company offerings (`snow_removal` sidewalk/entrance work and `snow_plowing` driveway/roadway work) to original Jobs work orders and their separate Dispatch schedule item IDs. They can share the same canonical `seasonal_storm_events` entry only if each original dispatch route has the corresponding `seasonal_storm_route_activations` link. Independent Jobs create/tenant/entitlement and Item 422 property guards apply; an original dispatch ID can belong to **only one receipt globally**, rejecting cross-service double attribution. A repeated identical request is idempotent; changed evidence conflicts. The original Dispatch/storm activation, workability observation/latest decision, site Safety plan, and optional assigned-truck Fleet readiness all contribute to a source fingerprint; edits display `source_changed_hold`. Missing independent Safety/Workability/Fleet authority or inactive dispatch/storm yields HOLD. Even with sources nominally ready, the result remains independent review required, not a release command. The responsive Admin workbench `js/snow-removal-plowing-427.js`, `help.html#snow-service-events-427`, additive SQL `sql/snow_removal_plowing_event_separation_427.sql`, source and browser tests are release-gated. An unverified operator pass report does not complete jobs, claim cleared sidewalks, change routes, move materials, charge clients, pay crews or certify winter safety.

**Acceptance:** Track plowing and sidewalk removal as separate offerings while retaining shared storm-event histories.

**Canonical source:** Dispatch, Workability, fleet and Safety. **Boundary:** No automatic dispatch, weather override or double billing.

#### 428 — Septic Haulage & Disposal Receipt Control

**Implementation:** Original company-owned `septic` Jobs orders, original Dispatch crew assignments and trucks, original Jobs execution-proof media for the actual disposal ticket, Fleet readiness and site Safety remain canonical. An authenticated owner with Jobs create permission and enabled septic service can append one immutable `ywi_septic_disposal_receipts_428` evidence receipt per uploaded source artifact and unique facility/receipt number, with an assigned active operator, dated collection/disposal, measured tank litres, method and measurement log, waste stream, real facility name and document number. The actual receipt image must be a stored original Jobs proof-media asset and cannot be an arbitrary typed URL; the image is still operator-attested, not independently authenticated by the disposal facility. Duplicate source/facility receipt reuse is blocked; identical replay is idempotent, changed source fingerprints mark HOLD. Missing/unready Fleet and unapproved Safety remain HOLD. An independently reviewable origin is NOT legal or environmental compliance, completion, disposal authorization, automatic truck dispatch, payroll, costing or invoicing. The owner-only Admin workbench, Help, additive SQL and source/mobile-browser tests are release-gated. Actual Production field acceptance needs genuine work orders and source documents; empty history is not success.

**Acceptance:** Track measured tank volume, operator and legitimate disposal receipts against original job IDs.

**Canonical source:** Jobs, fleet, Safety and disposal evidence. **Boundary:** No fabricated regulatory compliance or autonomous disposal.

#### 429 — Production Learning & Cross-Service Trial Review VI

**Acceptance:** Review genuinely comparable source-supported first-job outcomes and next bounded priorities.

**Canonical source:** Dated canonical multi-service cohorts. **Boundary:** No unmeasured ROI claim, employee ranking or autonomous transactions.

**Implemented:** On October 23, 2026 at 16:00 UTC, a read-only Production query inspected seventeen named original and specialist tables. Each had zero rows, including company records, Jobs/Production/Dispatch, AR invoices and the six specialized service-proof families. The reviewed sources therefore contain no real first jobs, and conversion, cross-service impact, ROI and employee outcomes are withheld, not zero-valued outcomes. The pure comparison in `js/cross-service-first-job-review-429.mjs` checks fresh, authorized, complete, uncapped, nonoverlapping company/service first-job cohorts, canonical customer/property/work-order identity, duplicate-source exclusion, chronology and at least ten first jobs per service per period; it emits only descriptive stage differences. A source-controlled dated snapshot in `docs/production_learning_review_429.json`, Admin owner read-only notice, Help explanation and CI source/mobile-browser gates document the evidence boundary. No backend schema, operator grant, customer/job, dispatch, payment, Safety or Finance mutation. The next **thirteen proposed builds (430–442)** intentionally focus on real operator adoption and work-flow integration, not synthetic performance improvement.

## Renewed bounded scope after Item 429 (proposed, not deployed)

The priority order below reflects *prerequisites and operational readiness*, not measured ROI. In the absence of live Production customer/job events, none is an empirically proven savings opportunity. Each future release must re-check source authority and existing capabilities before adding new tables or flows.

#### 430 — Six-Service Owner Trial Intake & Source-Coverage Runbook

**Priority P0. Acceptance:** Guide owner company/entitlement setup and genuine first customer/property/job trial, expose authoritative missing-source holds and avoid replay duplicates. **Canonical source:** Company registry, original CRM/Jobs, Item 429 gap report. **Boundary:** No synthetic first jobs, auto-entitlements or unauthorized records.

**Implemented:** The owner-only, mobile-safe `js/six-service-owner-trial-430.js` renders an interactive six-offering intake checklist using signed-in Supabase owner verification, 420 company/entitlement rows and owner-scoped 422 customer/site/work-order RPCs. The source reducer fails closed on stale, denied, duplicate, foreign or capped company/customer/history data. A real original Jobs link is reported as present with specialist proof and owner acceptance still **unverified**; each service points to the appropriate 424–428 source workflow. The operator deliberately performs all creation/linkage in audited 420–422 screens; this read-only feature has no insert/update/delete or success-forcing action. Source and phone-browser regression tests are release gates. As of Item 429's dated Production sample, no first-job outcome was measured; do not treat this new screen or browser fixtures as an actual business trial.

#### 431 — Service-Specific Intake Templates & Verified Site Constraints

**Priority P0. Acceptance:** Show per-service factual site requirements and missing Safety evidence using the same original CRM customer/property IDs. **Canonical source:** Original property/site registry, templates and Safety. **Boundary:** No guessed measurements, duplicated CRM authority or automatic Safety pass.

**Implemented:** The responsive, owner-only Admin workbench `js/service-site-intake-431.js` presents six distinct service requirement templates against a selected, real 420 company and original 422 customer/property pairing. The additive, read-only `sql/service_site_intake_431.sql` grants a narrowly scoped, authenticated owner/Jobs/422-verified-link RPC to the existing `client_sites` and bounded active `client_site_zones` source. The original property ID is never recreated or inferred from similar names. Only canonical recorded values appear; missing terrain, measurements, access constraints, utility notes, hazards and zones are explicitly marked MISSING. The original property review and access verification timestamps are displayed as *recorded provenance*, not proof of an on-site survey or continuing validity. Source failures, foreign tenant, duplicate/capped zones, stale browser reads, inactive site, disabled offering and changed owner session fail closed. Every enabled service remains **SITE + SAFETY REVIEW REQUIRED** until its separate specialist, permit, Fleet, Dispatch and Safety authorities are reviewed; `safety_evidence_source=NOT_QUERIED` and `safety_approval=UNVERIFIED` are intentional, never synthetic Safety passes. The owner screen is read-only and does not make an authorized work order, save a property, schedule dispatch, or certify regulatory compliance. Actual first-job acceptance remains unmeasured until a genuine owner trial. Source and 390px browser tests are CI-gated. The SQL requires controlled database deployment and live permission verification as a distinct release prerequisite.

#### 432 — Cross-Service Estimate-to-Authorized-Job Handoff Audit

**Priority P0. Acceptance:** Trace original estimate, approved scope/price and enabled-service authorization into a true work-order handoff, with explicit unresolved approvals. **Canonical source:** Original Estimates, Jobs and entitlement audit. **Boundary:** No autonomous customer acceptance or new agreement.

**Implemented:** Owner-only Admin audit `js/cross-service-estimate-job-handoff-432.js` uses the narrowly scoped original-record `ywi_rpc_estimate_job_handoff_432` bridge, guarded by 422 owner/Jobs/read and linked active CRM customer/property. For that specific company+customer+site, it returns no more than 50 original estimates and 50 base lines per estimate/job, independently checks 420 enabled offering and the 421 original creation receipts, and reads the dated customer quote-package acceptance, internal estimate approval, original price/scope lines, recorded deposit, explicit converted job pointer and actual Jobs source. A linked job is not considered authorized merely because it exists: company/service/customer/property, baseline line and price continuity, original Jobs approval and a separate dated `released`/`pass` sign-off are individually reviewed. Modified prices, missing quote terms, deposit shortfall, disabled service, draft/unlinked/duplicate jobs and foreign or missing approvals are HOLD; source ownership mismatch, stale/denied/capped or duplicated records are WITHHELD. Even a fully recorded source release is **operator-review evidence only**, not authorization to dispatch or work without independent Safety/specialist/permit/Dispatch gates. Existing customer-acceptance and Jobs/Finance flows remain authoritative; this build does **not** create customers, quotes, agreements, Jobs, payments, releases, Safety permissions, invoices or messages. Source/mobile CI covers success and fail-closed cases. SQL migration requires controlled Supabase release verification. Production real-first-job uptake is still unmeasured until genuine owner sources exist.

#### 433 — Mobile Field Evidence Capture & Offline Replay Acceptance

**Priority P0. Acceptance:** Test reliable phone photo/document capture, stable retries and offline replay without duplicate specialist/source receipts. **Canonical source:** Existing Offline, Jobs proof-media and service-specific records. **Boundary:** Do not treat a local pending upload as server completion.

**Item 433 guarded capture candidate:** Today → `js/mobile-field-evidence-433.js` accepts only actual server-filtered, active original Dispatch/Jobs assignments and a signed-in profile. Phone JPEG/PNG/WebP/PDF bytes are stored in profile-partitioned IndexedDB (8 MiB per file; 8 files/20 MiB total), with a SHA-256 file/work-order fingerprint to prevent duplicate local capture and a persistent intent key for eventual replay. Clear LOCAL ONLY / uncertain / SERVER VERIFIED receipt states distinguish device persistence from original `work_order_execution_proof_media`. Interrupted upload cannot be assumed failed: retry is deliberately disabled until a separately deployed, permissioned, server-idempotent proof-media adapter can verify original owner/work-order, unchanged digest and canonical execution-proof/media receipt ID. Source and 390px phone tests cover duplicate capture, offline retention, identity mismatch, missing reconciliation and verified acknowledgement. No existing non-idempotent upload function is used; no database migration, server evidence creation, specialist attestation, Safety approval or claimed live upload success. Controlled backend deployment and real phone acceptance remain explicit HOLD prerequisites for operational replay.

#### 434 — Service Dispatch, Crew, Workability & Safety Preflight Review

**Priority P0. Acceptance:** Provide an original-source per-job operator preflight for crew, equipment, weather, site Safety and schedule holds. **Canonical source:** Dispatch, Workability, Fleet, Jobs and Safety. **Boundary:** No auto-dispatch, weather bypass, lockout clearance or work authorization.

**Item 434 candidate:** Admin owner panel `js/service-dispatch-safety-preflight-434.js` uses the 420/422-verified company, customer, property and exact original Jobs work order. The additive read-only `ywi_rpc_job_dispatch_preflight_434` source bridge reuses the 422 owner + Jobs-view + active site link checks, reads original Jobs release, up to 20 linked dispatches, crew/member and schedule, existing conflict view, up to 20 extra assigned equipment items, current Fleet readiness/expiry, exact dispatch observation/signed workability decision and linked original work-order HSE packet. Disabled offering, unsigned release, missing crew/schedule, conflicts, lockout, Fleet expiry, missing/stale conditions, adverse supervisor decision, unaccepted HSE and incomplete required HSE monitoring/sign-off are explicit HOLD. Denial, malformed/capped/foreign or stale source is WITHHELD. Absence of holds remains REVIEW — never automatic dispatch, a site-open or Safety/permit clearance, or a job action. Source/mobile tests and an ⓘ Help guide cover the boundary. Real field acceptance and Supabase migration verification are still required at controlled release time. Item 433 must first reach Production and reconcile `dev/main` before 434 promotion.

#### 435 — Shared Crew, Fleet, Equipment & Materials Conflict Review

**Priority P1. Acceptance:** Identify dated overlaps and one-source/one-cost attribution gaps before scheduling across services. **Canonical source:** Existing assignments, equipment and material-issue evidence. **Boundary:** No automatic reallocation or double charging.

**Item 435 candidate — depends on 433 and 434 Production GREEN:** The owner-only `js/shared-capacity-conflict-review-435.js` panel reviews a selected company and seven-day UTC window using a 14-day-maximum, strictly owner+Jobs-read-guarded `ywi_rpc_shared_capacity_review_435` source. It compares overlapping original Dispatch crew IDs, active crew member IDs, lead/supervisor identities, Fleet/truck/trailer and other assigned equipment across each of six actual services; it separately detects overlapping original asset checkouts and missing, stale or wrong-work-order 423 equipment/material attribution receipts. Every original issued material amount is evidence only, never summed across sources, transferred, charged, deducted or rebooked. Disabled/cancelled/historical schedules are not active candidates; malformed, stale, foreign or capped sources are WITHHELD, and missing source, Fleet readiness and overlaps are HOLD. Even a no-detected-conflict result is REVIEW: coverage is explicitly limited to the selected company/window, not all companies, unscheduled work, stock availability, independent Safety or a future state. Responsive ⓘ Help, deterministic source and 390px browser checks are wired to staging CI. SQL stays unapplied until predecessor releases and controlled database acceptance; no live owner trial or Production readiness is asserted by tests.

#### 436 — Service-Native Production & Evidence Completion Review

**Priority P1. Acceptance:** Review original recorded quantities, phase/ticket/event/inspection receipts and required missing originals for each enabled service without conflating work types. **Canonical source:** Original Production/Jobs and 424–428 receipts. **Boundary:** No invented field measurement, completion or regulatory certification.

**Implemented as read-only candidate:** The owner-only Admin panel `js/service-native-production-review-436.js` selects an original 420 owner company, one explicitly distinct offering, and one actual original Jobs work order. It reuses the existing authenticated, owner-guarded 424–428 dashboard RPCs, including the 427 snow-only two-service order split, rather than inventing a new database or parallel completion ledger. Its reducer withholds duplicate, foreign, malformed, capped or missing sources and flags absent measured field quantities/424 receipts, phase/permit document notes, aquatic inspection/Safety evidence, storm/Dispatch/427 receipts and actual 428 source-media disposal tickets. Original changed-source and independent Safety/Finance/Workability review holds remain holds; disabled new-work offerings are never implicitly enabled. A matched source and receipt is REVIEW only, never completion, QC sign-off, customer acceptance, authorized dispatch, certification, combined multi-service volume/cost or financial posting. Responsive Help, deterministic source and phone-browser CI checks are mandatory. No SQL migration or new Production roles are needed because all source RPCs already exist; live owner first-job trial remains unmeasured.

#### 437 — Quality-Control, Exception & Customer Handoff Acceptance

**Priority P1. Acceptance:** Trace source QC approvals, unresolved objections, job closeout and authentic customer sign-off with clear manual gates. **Canonical source:** QC and original Jobs closeout. **Boundary:** No silent signature, customer messaging or site reopening.

**Implemented as read-only owner review:** `js/quality-customer-handoff-437.js` uses one narrowly owner-asserted SQL RPC (`sql/quality_control_exception_customer_handoff_437.sql`) to trace a selected original six-service Jobs work order through original QC runs, required checklist results, deficiencies and rework, approved customer-safe proof, independently approved supervisor closeout and actual customer-portal signoff records. Foreign/malformed/duplicated/capped or unavailable source is WITHHELD; missing approvals, outstanding exceptions, required evidence or authentic signoff is HOLD. REVIEW only means no currently missing source in a bounded snapshot, never a new QC approval, real customer signature, customer notice, site reopening, invoice eligibility, dispatch or job completion. The helper provides a responsive ⓘ help path and deterministic source/390px browser release checks. Database migration and owner permission audit must precede any live owner trial; synthetic checks never assert genuine field or customer acceptance.

#### 438 — Six-Service Job-Cost Provenance & Price Variance Review

**Priority P1. Acceptance:** Reconcile original job price, hours, materials, assets and valid Finance totals by service where permission and denominator allow, exposing gaps explicitly. **Canonical source:** Timekeeping, Materials, Equipment, Estimates, Finance. **Boundary:** No duplicated expenses, unsupported ROI or staff ranking.

**Implemented as read-only candidate:** `js/six-service-job-cost-provenance-438.js` uses one company-owner and original-Jobs-guarded bounded database function (`sql/six_service_job_cost_provenance_438.sql`) for six independent services. It reads original approved estimate and Jobs price, accepted cost baseline, individual execution proof envelopes, original timekeeping hours, material-issue lines, equipment checkouts and unchanged 423 allocation receipts, original invoice candidates/postings and AR invoices. Three separate source-specific price/cost/Finance differences appear only for positive comparable denominators; the source buckets are **never added together**, and multiple approved proof cost envelopes or multiple AR invoices remain HOLD pending independent deduplication. Foreign, changed, malformed, orphaned or capped source is WITHHELD. Unrecorded time, inventory, crew and Finance evidence is HOLD, never zero expenditure or profit. The ⓘ Help and 390px browser/source tests enforce no payroll, Finance, Jobs, charge, automatic invoice, ROI or staff-ranking mutation. Real owner trials are unavailable in the current empty original source tables, so synthetic acceptance cannot establish actual profitability or field acceptance.

#### 439 — Owner-Gated Invoice Candidate & Receivable Trace

**Priority P1. Acceptance:** Show per-service invoice readiness and original AR provenance only after genuine QC/owner reviews. **Canonical source:** Jobs closeout, invoice and AR. **Boundary:** No autonomous invoice creation, payment collection or charge.

**Implemented as read-only owner review:** `js/owner-invoice-receivable-439.js` composes existing owner-guarded 437 QC/closeout and 438 Jobs/Finance RPCs for the same original company, service and work order. It independently requires QC and real portal/supervisor gates, the recorded `ready` closeout state, original approved price/estimate, and one-to-one invoice candidate → dated Finance posting → AR receipt lineage. Draft/rejected candidates, absent or multiple documents, reversals, mismatched amounts, unbalanced receivables and missing human signoff remain HOLD; foreign, malformed, duplicated/capped or mismatched source is WITHHELD. The panel cannot invoice, post, collect, charge, message or authorize Finance. It adds no new SQL authority; synthetic source/mobile-browser checks cover the safety boundary. An operator must still independently review current Finance authorities before a real transaction, and no actual owner invoice has been accepted by this source-only build.

#### 440 — Seasonal Contracts, Plowing Events & Recurring First-Use Continuity

**Priority P2. Acceptance:** Keep the original customer/property, seasonal agreement, storm activation and per-visit evidence unambiguous across renewals and weather events. **Canonical source:** Recurring, Storm, Dispatch and entitlements. **Boundary:** No invented storm, automatic renewal, bill or dispatch.

**Implemented as conservative owner read-only source review:** The new Property Maintenance System Admin directory distinguishes the six already-provisioned company offering switches (`420/421`) from upcoming service modules. The 440 reviewer combines owner-scoped agreement/visit/snow-trigger sources from `sql/seasonal_contract_first_use_continuity_440.sql` with the original 424 lawn/427 snow field dashboards. It requires the SAME owner, company, original Jobs work order, customer, property and source route. Only original recurring agreements personally created by the verified owner are exposed because the legacy agreement table is NOT independently company-scoped; missing/multiple/ambiguous renewals remain HOLD. First-use is earliest *reported* original field receipt, not completion. Agreement snow triggers and operational storm events cannot be linked by date alone; explicit event-ID continuity remains HOLD until an approved canonical bridge exists. No renewal, dispatch, field completion, Finance or payroll operation is performed. SQL migration and live owner acceptance are not inferred from source/browser GREEN tests.

#### 441 — Live Field Trial Integrity, Privacy & Release-Readiness Audit

**Priority P2. Acceptance:** Verify owner company isolation, source freshness/completeness, responsive operator screens and exact GitHub/Vercel release evidence for actual trial readiness. **Canonical source:** RLS/identity, canonical receipts and CI/deployment proof. **Boundary:** No trial success or owner approval inferred from source-only green checks.

**Implemented as owner-scoped privacy audit:** `sql/live_field_trial_integrity_441.sql` introduces a read-only, RLS-identity-asserted RPC covering the six existing company entitlements and an original Jobs order's independently company-linked customer/property. Source counts and latest dates come from actual execution, dispatch, QC and the matching 424–428 specialist receipt, with hard 60-job/80-receipt caps. No source PII, wages, private notes, amounts, automatic actions or operator acceptance crosses the browser boundary. The function was applied to the connected YW Supabase project on 2026-10-24; privilege verification confirmed `SECURITY DEFINER`, anonymous execution denied and authenticated execution granted. `js/live-field-trial-integrity-441.js` adds a narrow-screen Admin reviewer with a circled Help link, an independent <=5-minute DB capture check, source-activity age and explicit HOLD/WITHHELD states. Neither UI nor RPC can certify an actual field visit, client acceptance, financial posting or exact-commit GitHub/Vercel Production release. Actual release evidence is verified separately at deployment time. A dated 2026-10-24 read-only Production check found zero registered PMS companies, original company Jobs, linked company customers/properties and specialist field receipts in the inspected tables; this is not proof of absence of offline work. `tests/fixtures/live-field-trial-integrity-441.mjs` uses **Yard Rosevear** as a wholly synthetic company for six-service tenant and 390px screen acceptance, not a Production Auth user or live company.

#### 442 — Production Learning & Cross-Service Trial Review VII

**Priority P2. Acceptance:** Reinspect real company-scoped service-specific first jobs, withhold insufficient comparisons, and renew a bounded operator-value-driven roadmap. **Canonical source:** Dated original Jobs/Production/Finance and service receipts. **Boundary:** No unmeasured improvement, ROI, employee score or business mutation.

**Implemented as a dated live-baseline and owner-only ongoing comparison:** `docs/production_learning_review_442.json` records a read-only Production Supabase inspection at 2026-10-25T00:28:58.879321Z (Oct 24, 8:28 p.m. Eastern). All 16 explicitly sampled company, Jobs, Production, Dispatch, QC, invoice and specialist receipts counts were zero. This cannot prove work did not occur outside those source tables; real first-job field acceptance remains HOLD. `sql/cross_service_learning_442.sql` adds a read-only owner-asserted, 2,000-Job-capped cohort RPC that counts one earliest original Job per company/service/customer across contiguous, fully completed UTC 14-day periods, with separate verified company/customer/site and Dispatch, Production, proof, QC, AR-invoice and matching 424–428 specialist receipt *presence* flags. This new migration was applied to connected YW Supabase; verification confirmed anonymous execution denied, authenticated execution granted, `SECURITY DEFINER` plus explicit verified-owner assertion. It returns aggregated counts only: no customer identifiers, addresses, staff, wages, amounts or original notes. `js/cross-service-learning-442.js` provides a narrow-screen, Help-linked owner console with a five-minute source clock, six-service evidence and strict ten-first-Jobs-per-period / missing-link / disabled-service HOLD gates. Even eligible counts are descriptive source presence, **never job completion, causal improvement, ROI or accepted field trial**; the older cohort's longer follow-up interval confounds outcome rates. `tests/fixtures/cross-service-learning-442.mjs` defines **Yard Rosevear — Company Admin (test)** as an isolated synthetic permission-shaped copy of an overall administrator, without cloning real sign-in credentials, global rights, payroll/banking privileges or Production records. Priority renewal: 443/444/447 P0 company module/CRM/accounting isolation; 449/450 P1 authentic lawn/winter service-first use; later HR, payroll, native finance and specialist modules require independent authorization. Software Production GREEN remains a separate exact-commit GitHub/Vercel verification.

### Property Maintenance System — modular platform direction (owner request 2026-10-24)

**Name:** The multi-company software platform is **Property Maintenance System (PMS)**. **Yard Workers** remains the first tenant and existing public brand; renaming the public company/domain is NOT authorized. Distinguish company/tenant from its customer accounts and locations. A company chooses its service offerings; employee access remains governed separately by roles and per-resource server permissions.

**Current state / sanity check:** The primary staff navigation still has four broad areas (Safety/OHSA, Finance, Jobs, Admin); equipment is nested and specialist service panels are in Admin/Jobs. Six independent owner-audited company service switches already exist: `landscape`, `snow_removal`, `snow_plowing`, `septic`, `construction`, `water_parks`. 421 restricts NEW work according to those switches. They do not yet behave as independent routed service workspaces, and future specialties are not implemented. Existing CRM/Contracts, Employees, Payroll exports, GL/AR/AP, Costs and Equipment functions are partially present but need consistent ownership, UI grouping and field-level access validation; "robust payroll/accounting" cannot be declared complete.

**Target hierarchy:**

- **Operations Core (shared):** Client & Properties (multiple customers/sites/assets/contact preferences), Jobs & Estimates, Contracts/Renewals, Calendar & Dispatch, Equipment/Fleet/Materials, Safety/OHSA, Media/Documents, Customer portal, Audit/Help and owner/tenant administration.
- **Company-selectable Services:** Lawn & Grounds; Snow Removal/De-icing; Plowing/Salting; Septic/Pumping/Disposal; Light Construction/Repairs; Water Parks/Aquatic; Arboriculture/Tree Care; Concrete/Formwork/Finishing; Fibre/Telecom & Utility Trenching/Locates; Land Clearing/Grading; Excavation/Ditch Digging/Drainage; Hardscaping/Retaining; Fencing/Decks/Structures; Commercial Property Inspections. Each specialty needs its own job forms, units, estimate rules, equipment, certificates, permits, field proof and Help, but reuses original company/client/site, Jobs, Dispatch, Finance and Safety authority.
- **Accounting & Business:** Accounting top-level workspace with sub-screens for Cost Book, Job Costs, Quotes/Billing, A/R, A/P, Chart of Accounts/GL, Bank Reconciliation, Sales Tax, Payroll, Reports and Period Close. HR/Employees sub-screens include employment status, emergency contact, credential expiry, wages/history, leave, timesheets, performance development, training and role permissions. Employee and payroll can be presented under Accounting for convenience, but PII, salaries, banking, payroll approval and employment decision permissions MUST be independently enforced. Non-accounting staff cannot infer secret wage data from costs or reports. Internal work cost rates may be aggregated/redacted separately.

**Module entitlements are not cosmetic:** Per company, immutable/stable module keys with audited disabled-by-default activation; server-side new-work/endpoint validation; auth role + field permission + tenant RLS; context navigation (desktop/mobile) generated only from allowed modules. Company module OFF removes entry points and blocks new transactions but cannot erase historical obligations, invoices, payroll/tax receipts or audit; retain restricted legal reads, export and reopen review. Safety obligations and audit/security core cannot be switched off. Supplier payments, payroll runs, tax submissions and customer charging always require separately authorized human approvals. No automatic utility excavation without permits/locates or arborist rigging without training/insurance.

**Follow-on queue after 441–442 (proposed, not delivered):**

| Build | Independently testable scope and acceptance boundary |
| --- | --- |
| 443 | PMS tenant/module navigation registry: show/hide permitted desktop & mobile routes; company OFF blocks server writes; legacy records remain accessible to authorized auditors. |
| 444 | Client & Property 360: company-scoped clients, contacts, site assets, contracts, photos, history and consent; prove cross-tenant rejection. |
| 445 | Detailed Employee/HR: private profile, certifications, shifts, onboarding, leave, training and records retention; wages hidden by default. |
| 446 | Payroll readiness: approved time, rates, deductions/benefits/vacation, corrections and confidential access; **no live direct deposits or CRA filings** without accountant review. |
| 447 | Accounting shell and financial access matrix: GL, A/R, A/P, quotes, costs, payments, tax and reports, separate payroll and bank permissions. |
| 448 | Native double-entry GL, period locks and reconciliation: idempotent postings, liability control, review/reversal, non-posting test mode first. |
| 449 | Lawn Care & Grounds standalone module: recurring visits, zones/measurements, routes, materials, notes, pricing and field QC. |
| 450 | Winter Snow Removal & Plowing standalone modules: contracts/per-storm thresholds, de-icing, route activation, passes, weather/Safety/Fleet gates and per-site records. |
| 451 | Septic & Arboriculture workspaces: manifests/disposal chain and tree inventory, risk zones, equipment, crew credentials and permits. |
| 452 | Construction/Concrete/Fibre/Excavation workspaces: phases, quantities, materials, inspections, ground-disturbance permits, utility locates, subcontractors and change orders; explicitly bounded safe pilots. |
| 453 | Multi-company cost allocation, workforce burden, profitability and financial report parity without leaking wage/other-company information. |
| 454 | End-to-end modular acceptance: company ON/OFF, cross-tenant denial, 390px/mobile Help, historical preservation and Production GREEN release gate. |

**Release approach:** Keep the legacy four-top-level shell intact through 440–442 to avoid breaking module-runtime and permissions. Starting 443, introduce the new nav shell and entitlement guardrails before migrating individual existing/brand-new service modules. No invented first-use, ledger posting, regulatory certification or live field pilot acceptance.

**Release sequence:** Item 433 guards device-local capture while canonical upload/replay remains on HOLD pending an idempotent server endpoint and real field acceptance. After guarded 433 is deployed and independently verified, promote the read-only 434 preflight, then 435 conflict review. No operator authorization or business mutation is conferred by this roadmap.
