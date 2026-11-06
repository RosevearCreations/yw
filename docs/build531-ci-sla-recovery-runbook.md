# Yard Workers Build 531 — CI SLA exceptions and recovery review

The production deployment is **not** approved by this report. The required GitHub
checks, exact `main` SHA, repository protection and Vercel readiness are separate
release requirements. This is a **read-only** review added to the Build 530 audit.

## Where to find evidence

1. Open GitHub Actions → **YWI post-promotion dev reconciliation** for the exact
   successful `main` push of **YWI source and staging checks**.
2. Open the **Build 530/531 read-only CI SLA and recovery evidence** job summary.
3. Download `ywi-ci-runtime-audit-<source-run-id>-<attempt>` and inspect
   `ci-runtime-audit.json` → `build531`.
4. Match `sourceRunId`, `currentMainSha`, `exactCurrentMain`,
   `current.status`, and each independent required-gate conclusion to the
   original source workflow. An artifact from an older SHA cannot attest to a
   newer release.

## Measurements and budgets

| Measurement | Initial review threshold | Meaning |
| --- | ---: | --- |
| Source workflow queue wait | 120 seconds | `QUEUE_SLA_EXCEEDED`: find runner/start delays |
| Source workflow total elapsed time | 900 seconds | `RUN_SLA_EXCEEDED`: review slow critical path |
| Each of three independent browser lanes | 600 seconds | `LANE_RUNTIME_OVER_BUDGET`: review the named lane |
| Recent successful/unsuccessful main samples | At least 4 | Below this, trend is provisional |

These are **reporting thresholds**, not shortcuts or replacement release gates.
The report retains the latest six exact-main push observations, including
separate queue/runtime breach counts and failed-gate histories. Use the Build
530 six-sample median and p95 to compare future releases; do not claim a
before/after speedup without a comparable pre-change baseline.

## Independent failure and recovery decisions

| Evidence | Review decision | Safe recovery |
| --- | --- | --- |
| Missing, failed, skipped, duplicate gate | `HOLD_NOT_VERIFIED` | Inspect original job logs; correct the source on a PR; re-run normal protected checks |
| Unknown lane time | `HOLD_NOT_VERIFIED` | Check incomplete jobs, cancellation or missing timestamps; do not infer a passing lane |
| Superseded `main` SHA | `HOLD_NOT_VERIFIED` | Observe a fresh source workflow for the current `main`; never adopt an older receipt |
| All protected gates succeed, timing exceeds review threshold | `VERIFIED_GREEN_EVIDENCE_ONLY` | Investigate CI performance; do not waive checks or trigger an automatic retry |
| Sparse history or an older failed run | Review annotation | Preserve original evidence and distinguish historical problems from current release truth |

No action in this workflow merges a PR, retries a job, dispatches a workflow,
rewrites production configuration, or authorizes a connection to Comms Hub.

## Verify after each future promotion

- Required GitHub gate conclusions for the exact `main` commit all `success`.
- Latest read-only CI audit references the same SHA and source workflow run.
- `build531.releaseEvidenceState` is `VERIFIED_GREEN_EVIDENCE_ONLY` and any
  `REVIEW` exceptions are triaged independently.
- Production Vercel deployment for that SHA is `READY`, its production alias
  resolves, and live responses/logs are checked.

Reference: [GitHub workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)
and [GitHub workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs).
