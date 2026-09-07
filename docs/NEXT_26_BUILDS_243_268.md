# YardWeasels Builds 243–268 Roadmap

## Purpose

This roadmap starts from the accepted Build 242 Development checkpoint and sequences the next release-governance, staging, business-acceptance, Finance, public-content, security, recovery and Production-readiness work.

The build number does **not** imply a database migration. Prefer source/test/acceptance-only builds unless persistent schema authority is genuinely required. Do not weaken a gate merely to obtain GREEN. Human, provider, accounting, content, staging, Supabase Auth and GitHub repository controls remain open until their real evidence exists.

## Release principles

- Feature work starts from the accepted `dev` head on a dedicated feature branch.
- Feature PRs target `dev`; Production promotion PRs target `main` from exact head `dev`.
- A Production candidate must prove current branch freshness, canonical ancestry, full source/browser acceptance and any build-specific authority before `main` moves.
- `main` repository protection remains an external GitHub control. Source code must never bypass or simulate it.
- Finance posting execution and provider mutation remain OFF until their dedicated acceptance is completed.
- Production data, Production payments and Production provider mutation are not staging evidence.
- Current schema/release truth comes from current I.T. Readiness and repository/runtime evidence, not historical migration names.

## Planned builds

| Build | Focus | Completion target |
| --- | --- | --- |
| **243** | **Production promotion ancestry guard** | Prove a current `dev → main` candidate preserves the previously promoted Development lineage. Accept the canonical merge-based divergence pattern, but fail closed on rewritten Development history, unreconciled `main`-only changes, ambiguous ancestry or missing history evidence. |
| **244** | **Canonical release manifest** | Generate one machine-readable candidate manifest containing feature SHA, `dev` SHA, `main` SHA, content tree, schema version, changed surfaces, migration classification, gate evidence and known external blockers. |
| **245** | **I.T. release divergence cockpit** | Show current `dev` versus `main`, builds awaiting Production, tree/SHA divergence, promotion-hold reason, schema implications and exact next safe action inside I.T. & System. |
| **246** | **Build risk / authority classifier** | Classify each candidate as source-only, schema-changing, Auth-related, Finance-sensitive, provider-sensitive, public-content, staging-sensitive or deployment-sensitive and require the appropriate gate family. |
| **247** | **Database migration preflight hardening** | Prove migration order, explicit RLS/grants, Data API access decisions, `SECURITY DEFINER` execution boundaries, canonical full-schema compatibility and rollback/recovery expectations before schema-changing work merges. |
| **248** | **Staging infrastructure readiness package** | Complete the reusable non-Production staging preflight: exact project identity, environment isolation, schema parity, mutation lock, secret-safe diagnostics, disposable-fixture boundaries and cleanup guarantees. |
| **249** | **Operations Cockpit staging acceptance** | Prove authorized Cockpit access, lower-rank denial, one safe staging write round trip, cleanup/restoration, finalization and explicit human signoff. |
| **250** | **Quote/contact staging acceptance** | Test invalid rejection, one uniquely labelled disposable quote/contact submission, matching event history, fixture cleanup and explicit human signoff through the real public contract. |
| **251** | **Live Job Updates staging acceptance** | Prove staff/private visibility, customer-visible updates, approved-public-media boundaries, update retraction and final signoff. |
| **252** | **Customer notification staging acceptance** | Prove explicit opt-in, protected dispatcher execution, test-safe delivery, private-data filtering, opt-out suppression, uncertainty/manual-review behavior and signoff. |
| **253** | **Execution proof & costing acceptance** | Exercise arrival/completion proof, labour/material/equipment costing, supervisor approval, internal cost variance and strict customer-safe versus staff-only separation. |
| **254** | **Supervisor closeout & customer signoff acceptance** | Prove closeout creation, supervisor approval, customer signature, invoice-readiness transition, review request and maintenance-follow-up behavior. |
| **255** | **Stripe customer portal acceptance** | Use Stripe test mode only to prove quote acceptance, hosted deposit checkout, webhook validation/processing and resulting deposit/customer-status transitions without Production payment/provider mutation. |
| **256** | **Accounting payment-action acceptance** | Human-review payment permissions, balanced journal/proof behavior, exceptions, reversal/recovery and reconciliation while Finance execution remains OFF. |
| **257** | **Bank CSV & reconciliation acceptance** | Run a labelled test import through preview, duplicate/reject handling, matching/splits, controlled promotion, undo/recovery and reconciliation signoff. |
| **258** | **Month-end close & accountant export** | Simulate a complete accounting period close, unresolved-exception prevention, lock rules, audit evidence and accountant-ready export. |
| **259** | **Route + visual approval workflow** | Complete the human content-approval rail for a route candidate and public visual, including approver identity/decision, readiness state and placeholder rejection. |
| **260** | **Approved-route publication + SEO acceptance** | Publish approved content only; verify canonical URL, one H1, metadata, structured data, internal links, sitemap inclusion and meaningful `lastmod`. |
| **261** | **Public-site SEO/content quality sweep** | Review every indexable YW public route for search intent, content depth, headings, metadata, canonical behavior, structured data, accessibility, mobile layout and current Help coverage. |
| **262** | **Supabase Auth external-security closure** | Close MFA/leaked-password readiness only from current authoritative Supabase Dashboard or Management API evidence with the existing provenance/intake/recording controls. |
| **263** | **GitHub repository-enforcement closure** | After branch protection is manually enabled, verify `main protected=true`, expected status enforcement, exact-main SHA agreement and durable release-source evidence. Never weaken the gate to obtain GREEN. |
| **264** | **Backup / restore disaster-recovery rehearsal** | Establish usable backup evidence, RPO/RTO targets, controlled restore/recovery rehearsal, operator runbook and rehearsal-freshness visibility in I.T. |
| **265** | **Observability & incident readiness** | Consolidate runtime/API failures, scheduler health, notification/provider failures, sync conflicts and release regressions into actionable operator evidence and remediation. |
| **266** | **Mobile/offline/sync reliability pass** | Harden 390/430 phone layouts, offline writes, queued operations, retries, duplicate suppression, stale-response prevention, conflict resolution and post-network recovery. |
| **267** | **Full business-day simulation** | Run the entire test lifecycle: customer request → quote → scheduling → crew/job → live updates → execution proof → closeout → invoice readiness → payment/reconciliation → follow-up. |
| **268** | **Production Release Candidate / launch gate** | Consolidate schema parity, Auth evidence, repository enforcement, staging evidence, Finance acceptance, Stripe evidence, backup rehearsal, SEO, performance, security, mobile, Help and exact-main release proof into one final RC decision. |

## Execution order

### Phase 1 — Release and migration authority
Builds **243–248** close the remaining release, ancestry, classification, migration and staging-control gaps. Do not add another release-framework layer after this phase unless a real failure proves one is required.

### Phase 2 — Operational and customer acceptance
Builds **249–255** convert the already-built operational/customer rails into real staging/provider evidence.

### Phase 3 — Finance acceptance
Builds **256–258** move Finance from source hardening to accountant-reviewed operational acceptance while keeping posting/provider mutation fail-closed until explicitly released.

### Phase 4 — Content, SEO and external security authority
Builds **259–263** close public route/content quality plus the external Supabase Auth and GitHub repository-enforcement controls.

### Phase 5 — Production operability
Builds **264–268** prove recovery, observability, offline/mobile reliability, cross-module business operation and final Production release readiness.

## Working rule

At the end of every build, record the exact feature SHA, canonical feature-gate run, merged `dev` SHA/tree, and—when Production promotion is requested and permitted—the exact `dev → main` promotion run and resulting `main` SHA/tree. GREEN means the required gates actually passed; blocked external or human evidence remains visibly blocked rather than being relabelled.
