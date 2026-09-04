# Next Steps and Sanity Check

## Restart checkpoint

Start every work session from current `dev` and `main`, then verify that their application trees are synchronized before opening another feature branch. Read current schema/release truth from I.T. Readiness rather than historical documentation.

When Production promotion is deliberately on hold, treat the resulting `dev`/`main` divergence as an explicit release boundary rather than silently force-synchronizing branches. New Development work must still start from the accepted `dev` head, and `main` must remain unchanged until promotion is separately authorized.

## Required sanity checks

Before new feature work, verify `dev`/`main` parity or an explicitly documented promotion hold, current schema drift, release authority separately from repository enforcement, intended Finance/provider fail-closed state, Current Admin To-Do truth, Auth security evidence freshness, next safe action classification, no accidental business-rail closure, repository/Help/SEO/browser gates, staging acceptance mutation lock state, and removal of temporary branches/workflows/files after release proof.

## Auth security evidence sanity check

Treat leaked-password protection and MFA as external Supabase Auth configuration. Verify each setting with recent authoritative external evidence before considering its follow-up resolved. Do not infer either setting from PostgreSQL catalogs, a historical security-advisor row, or the absence of a current advisor warning. Stale evidence requires re-verification, and application source work must not change the Auth setting or auto-close its Current Admin To-Do item.

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

## Repository enforcement sanity check

Treat repository enforcement as an external GitHub control, separate from green source tests and separate from application release authority. The exact-main repository protection preflight runs only for a `push` to `refs/heads/main`; it reads GitHub's current `branches/main` evidence, requires `protected=true`, and requires the GitHub-reported main SHA to exactly match the workflow release SHA.

The preflight must fail closed when main is unprotected, the evidence is missing, the branch SHA is stale/different, the event is not an exact main push, or the ref is not `refs/heads/main`. A successful pull-request workflow is not branch-protection evidence. This source gate does not enable or alter GitHub branch protection/rulesets and must not auto-close `repository:main_protection`; the external follow-up remains open until GitHub itself reports enforcement.

## Remaining work selection

Choose the next technical feature from a fresh I.T. Readiness / Current Admin To-Do review. Do not invent autonomous work merely to increase a score. Rails classified as human, accounting, provider, content or staging acceptance remain open until their actual evidence exists.

Repository protection remains a separate enforcement concern from application release authority and should stay visible until GitHub reports it as enforced.

## Module and Production boundary

The four top-level modules are **Safety / OHSA**, **Finance**, **Jobs**, and **Admin**. **I.T. Readiness** remains inside Admin rather than becoming another top-level module.

Production promotion remains deliberate/manual and separate from application source readiness.