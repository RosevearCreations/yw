# Build 404 — First Operational Cohort Measurement & Conversion Funnel

Status: IN DEVELOPMENT. NOT PRODUCTION GREEN.

## Purpose
Provide a read-only, source-grounded first-job funnel from customer intake to dispatch, Production session, quality/closeout and invoice readiness. Do not fabricate records, causal improvement or employee scoring.

## Acceptance criteria
- Reuse authorized canonical CRM, Dispatch, Production, QC and Finance reads; never introduce a second business-record authority.
- Define the cohort entry date, source entity IDs, conversion numerator and denominator at each stage, and distinct-record deduplication.
- Include timestamps, permission coverage, source freshness and cap/limit metadata alongside every count.
- Withhold missing, stale, capped, unauthorized, undated or partially matched source stages; unknown is never zero.
- Enforce minimum sample sizes for conversion-rate and cross-period comparison; report withheld rather than implying trends from small cohorts.
- Preserve provenance for every transition; if source lineage is ambiguous, omit the conversion rather than infer.
- Surface read-only owner/operator funnel diagnostics, explaining exceptions and links to canonical source workspaces where permitted.
- Do not write customers, jobs, dispatch, Production records, QC approvals, invoices, payments, messages or staffing/performance ratings.
- Add regression tests for zero sample, small sample, partial sources, duplicates, stale timestamps, caps, denied access and legitimate full-cohort counts.
- Promote to dev and main only after source gates, browser coverage, security checks, Vercel exact-commit deployment verification and Production runtime verification are GREEN.

## Release record
- Work on feature branch first; initial PR is draft until implementation and testing are complete.
- Record exact dev SHA and production SHA with independent checks before claiming GREEN.
- Next after verified Build 404: Build 405 — Production Learning & Autonomous Roadmap Renewal IV.
