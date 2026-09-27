# YW AI Handoff

This file is the canonical handoff for another AI system taking over the YW repository.

## Mission

YW is a four-season landscaping, yard-maintenance, snow-removal and business-operations application. The goal is to keep improving it autonomously as one connected operating system across Jobs, Safety, Equipment, Workforce, Finance, Customers/Properties, Routing, Seasonal Operations and field/mobile workflows.

The user does **not** want to manually drive ordinary roadmap releases. When asked to continue, take the next valid autonomous roadmap item, implement it, test it, promote it through `dev` and protected `main`, and do not stop until the exact Production source is GREEN.

## Repository and deployment

- Repository: `RosevearCreations/yw`
- Production branch: `main`
- Development branch: `dev`
- Production branch is protected.
- Vercel project: `yw`
- Canonical GitHub workflow: `.github/workflows/staging-browser-integration.yml`
- Canonical workflow name: `YWI source and staging checks`
- The previous feature release completed through **Build 350 — Owner / Management Command Centre**.
- Always resolve the current `main` and `dev` SHAs from GitHub at the start of a task. Do not trust an old copied SHA from this file.

## Current autonomous queue

The authoritative roadmap is `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.

The next release is:

1. **Build 351 — Management Metric Freshness & Confidence**
2. **Build 352 — Autonomous Exception Triage & Next-Safe-Action**
3. **Build 353 — Four-Season Capacity & Workability Forecast**
4. **Build 354 — Route & Crew Efficiency Evidence**
5. **Build 355 — Recurring Service Renewal & Retention Workbench**
6. **Build 356 — Estimate-to-Cash Leakage & Margin Recovery**
7. **Build 357 — Labour, Equipment & Fleet Utilization Decision Support**
8. **Build 358 — Materials, Consumables & Seasonal Stock Readiness**
9. **Build 359 — Customer Communication Readiness & Queue Quality**
10. **Build 360 — Data Quality, Duplicate & Orphan Reconciliation Workbench**
11. **Build 361 — Mobile, Offline & Read-Budget Reliability Optimization**
12. **Build 362 — Production Learning & Autonomous Roadmap Renewal**

Build 362 must create at least ten further bounded autonomous releases before it is promoted so the queue does not run out.

## Non-interactive rule

Ordinary roadmap builds must not require the user to:

- create or authorize a staging environment;
- enter provider credentials;
- run manual acceptance scenarios;
- approve synthetic test cases;
- send real customer messages;
- execute real payments/refunds/disputes;
- enable Production payment/provider rails;
- manually sign off before implementation can proceed.

If an external dependency is unavailable, do **not** block and do **not** ask the user to perform provider/human acceptance. Implement the safest repository-owned portion using existing operational data, deterministic source tests, synthetic fixtures and browser tests. Keep external/provider mutation disabled and clearly label readiness/advisory behavior.

Never fabricate evidence to claim an external provider, real payment path or human acceptance campaign passed.

## Four-season operating model

Southern Ontario seasonality is core product behavior, not a cosmetic label.

Treat these as distinct operational contexts when relevant:

- Spring/summer: mowing, lawn care, landscaping, gardens, trimming, materials and recurring maintenance.
- Fall: leaf collection, fall cleanup, seasonal closeout and winter preparation.
- Winter: snow removal/clearing, storm events, snow routes, salt/de-icer/traction materials, cold-weather workability and winter fleet/equipment readiness.
- Four-season/general: customers, properties, Finance, Safety, workforce, assets and cross-module administration.

Do not claim a service is workable in conditions where the operating evidence/rules say otherwise.

## Canonical authority boundaries

Preserve existing source-of-truth boundaries. New dashboards and workbenches should aggregate, explain, filter, prepare or deep-link unless the roadmap explicitly extends an existing write authority.

Key rules:

- Safety records remain Safety authority.
- Jobs/dispatch/routing remain Jobs authority.
- Equipment lockout and return-to-service remain Equipment/Safety-controlled flows.
- Employee/private workforce information remains permission-scoped.
- Finance posting, close, payment application and provider execution remain Finance/provider authorities.
- Read-only management/search layers must never silently become write authorities.
- Advisory recommendations must be labelled advisory.
- Do not infer employee performance from incident/Safety evidence.
- Do not auto-send customer communications unless an existing explicit send authority is deliberately invoked by the product workflow.

## Standard release workflow

For each ordinary autonomous build:

1. Read the current roadmap entry and inspect existing foundations before coding.
2. Confirm `dev` and `main` are reconciled before starting. If not, understand why before creating a release branch.
3. Branch from the current reconciled Development/Production baseline.
4. Implement one bounded release. Prefer extending existing authority and schema rather than creating a parallel source of truth.
5. Add or update source acceptance checks.
6. Add rendered/browser acceptance where UI or operator behavior changes.
7. Add the checks to the canonical workflow when appropriate.
8. Update Help and the roadmap.
9. Open a feature PR into `dev`.
10. Follow the exact feature SHA through the canonical source/browser gate. Repair failures; never weaken a gate merely to merge.
11. Merge the GREEN feature PR into `dev`.
12. Confirm the exact `dev` source is GREEN and Vercel preview is successful.
13. Open `dev` → `main` Production PR with no extra code changes.
14. Respect branch protection and required checks. Do not bypass them.
15. Merge only after the required Production PR gate is GREEN.
16. Verify the exact resulting `main` merge SHA, not merely the PR head SHA.
17. Verify the exact-main canonical run:
    - `source-checks` = success
    - `repository-enforcement` = success
    - `release-source-evidence` = success
    - `release-truth-summary` = success
    - `staging-proof` may be skipped on a normal Production push
18. Verify Vercel Production is success/GREEN on the exact `main` SHA.
19. Verify workflow-run follow-ups:
    - `YWI authorized release-source evidence recording` = success
    - `YWI repository policy evidence recording` = success
    - `YWI post-promotion dev reconciliation` = success
20. Confirm `dev` and `main` are identical again.
21. Only then report the build fully promoted and move the roadmap to the next item.

## Definition of GREEN

Do not call a release GREEN because only Vercel succeeded.

A completed Production release requires:

- protected `main` at the expected merge SHA;
- exact-main canonical GitHub workflow success;
- source and rendered/browser acceptance success;
- repository enforcement success;
- release-source evidence success;
- release-truth summary success;
- Vercel Production success;
- authorized release-evidence recording success;
- repository-policy evidence recording success;
- post-promotion `dev` reconciliation success;
- final `dev == main`.

## Testing and compatibility rules

- Historical build checks are part of the contract. When a new bounded release legitimately extends a loader chain, permission registry or roadmap state, update stale exact-string assertions rather than weakening behavior.
- Keep mobile acceptance important, especially 390/430-width field workflows.
- Preserve offline queued work and explicit conflict recovery.
- Keep permission-hidden data explicitly unavailable; never substitute zeros that look authoritative.
- Keep source freshness/provenance visible when a management metric could otherwise mislead.
- Do not remove release evidence, branch-protection or security checks to make CI faster.
- Prefer batching, caching and narrower read scopes when performance/read budgets are a problem.

## Data/schema discipline

Before adding a table or duplicate business object, search the existing schema and functions. Reuse and extend canonical records whenever possible.

A release may add a migration when a real durable business record is required, but a read-only dashboard, saved view, search surface, recommendation layer or analytical workbench usually should not create a competing source of truth.

Any destructive cleanup, merge or deletion feature must preserve auditability and must not execute automatically merely because a heuristic found a likely duplicate.

## Autonomous decision policy

When the user says only `continue`, do not ask which YW build is next. Use the earliest unimplemented valid roadmap item.

A newly discovered security, data-integrity or release-truth defect may temporarily take priority if it materially affects safe operation. Repair it as a bounded prerequisite, then resume the queued build.

Do not create release-number-only work. Each release must produce measurable operator, economic, reliability, seasonal or safety value.

If a task is difficult, continue with the safest complete subset that can be implemented and verified now rather than asking the user to perform routine project-management decisions.

## Project isolation

Do not modify the user's other projects while working on YW. In particular, do not touch Rosie Dazzlers or Devil n Dove unless the user explicitly switches projects.

## Handoff completion rule

A future AI taking over this file should begin by:

1. Fetching current `main` and `dev`.
2. Reading `docs/NEXT_STEPS_AND_SANITY_CHECK.md`.
3. Finding the earliest roadmap item not marked implemented.
4. Inspecting the relevant existing code/schema/test foundations.
5. Executing the Standard release workflow above through final Production GREEN.

