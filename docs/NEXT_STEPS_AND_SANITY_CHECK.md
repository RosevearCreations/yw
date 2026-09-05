# Next Steps and Sanity Check

## Restart checkpoint

Start every work session from current `dev` and `main`, then verify that their application trees are synchronized before opening another feature branch. Read current schema/release truth from I.T. Readiness rather than historical documentation.

When Production promotion is deliberately on hold, treat the resulting `dev`/`main` divergence as an explicit release boundary rather than silently force-synchronizing branches. New Development work must still start from the accepted `dev` head, and `main` must remain unchanged until promotion is separately authorized.

## Required sanity checks

Before new feature work, verify `dev`/`main` parity or an explicitly documented promotion hold, current schema drift, release authority separately from repository enforcement, intended Finance/provider fail-closed state, Current Admin To-Do truth, Auth security evidence freshness and provenance, next safe action classification, no accidental business-rail closure, repository/Help/SEO/browser gates, staging acceptance mutation lock state, and removal of temporary branches/workflows/files after release proof.

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
