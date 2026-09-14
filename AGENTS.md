# Yard Weasels Build Session Instructions

## Mandatory startup reading

For **every new YW build session or build refresh**, read these files before choosing or implementing work:

1. `docs/NEXT_STEPS_AND_SANITY_CHECK.md` — canonical restart, safety, release, staging, Finance/provider, Help/SEO and Production-boundary rules.
2. `docs/ACTIVE_BUILD_ROADMAP.md` — current forward build priorities and planned build scopes.
3. `docs/ACTIVE_PROJECT_HANDBOOK.md` — durable current architecture and operating boundaries when the selected build touches those areas.

Do not select the next build from chat history or an old build number alone.

## Required refresh sequence

Before opening a feature branch:

- read current `main` and `dev` and verify parity or a deliberately documented promotion hold;
- verify the exact current Production/source SHA and current canonical CI/release truth;
- read current I.T. Readiness, Current Admin To-Do, next-safe-action authority, schema drift and Finance/provider fail-closed state;
- re-scan the exact current repository to prove the planned roadmap gap still exists;
- use the earliest still-valid roadmap item whose prerequisites are satisfied, unless a newly discovered release/security/data-integrity defect clearly has higher priority;
- skip or reshape a planned build if current evidence shows it is already complete, obsolete or unsafe;
- never invent a schema migration merely to satisfy a planned build number.

## Promotion discipline

Routine source work follows the canonical sequence:

**feature → exact feature GREEN → Development → fresh exact Development GREEN → protected `main` → exact-main repository/source/browser/release proof → non-force `dev` synchronization**.

Do not promote while required checks are running or failing. Do not call a build GREEN until exact current evidence proves it.

## Safety boundary

Finance posting, payment/provider mutation, Production staging mutation, external Auth-control changes, destructive business-data changes and other guarded operations remain fail-closed unless the selected build explicitly reaches a separately authorized acceptance/execution stage.

Historical migrations and historical build references are provenance. Current schema and release truth come from current repository/database/I.T. authorities.

## Roadmap maintenance

`docs/ACTIVE_BUILD_ROADMAP.md` is a **forward plan**, not a completed-build ledger. Update it only when priorities, prerequisites or scopes materially change. Completed build history remains in Git/GitHub and current release evidence.
