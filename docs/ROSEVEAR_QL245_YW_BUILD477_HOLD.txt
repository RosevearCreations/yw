# Yard Workers Build 477 — QL-245 source evidence return (HOLD)

**Implemented scope:** read-only aging of the genuine 476 independent reviewer receipts; offline QL-245 candidate evidence classification. No live cross-app gateway request is performed. This document is a factual source readiness handoff, **not** an Ed25519-signed QL-245 public return.

| QL-245 requirement | Yard Workers Build 477 state |
|---|---|
| Source repo / exact 40-character SHA | RosevearCreations/yw — verify exact deployed commit and its green CI run independently; do not copy a historical SHA |
| Company/tenant ID and enabled jobs module | **NOT PROVISIONED** for nonproduction gateway; never use synthetic test UUID as a real tenant |
| Nonproduction origin and authenticated deployed revision | **NOT PROVISIONED** / **UNVERIFIED** |
| Unique HMAC signing key ID and registered per-tenant key | **NOT PROVISIONED**; no key or secret in source |
| Source Ed25519 signing key ID and out-of-band SHA-256 SPKI pin | **NOT PROVISIONED** / **UNVERIFIED** |
| Actual signed source health/capability receipts | **UNVERIFIED** — public static HOLD JSON is not authenticated |
| Signed gateway audit record / after-restart durability | **UNVERIFIED** |
| Real nonce replay, stale, wrong-business, wrong-tenant, revoked-key, prohibited-write, prohibited-dispatch denials | **UNVERIFIED** — source-level tests are not live trace receipts |
| Independent assessor, distinct verified public-key pins and witnessed rollback | **UNVERIFIED** |
| Owner identity and exact-time read-only pilot authorization | **NOT GIVEN** |
| Connection state | **DISCONNECTED / HOLD** |
| Operational Jobs/Safety, payroll, dispatch, customer messages and integration writes | **HELD / DISABLED** |

Only paths /api/integration/v1/health and /api/integration/v1/capabilities are candidate health-only scopes, with ordered scope read_health/read_capabilities. Even those are not callable as authenticated nonproduction endpoints on the existing YW static Vercel deployment. YW remains authoritative for company/module data, and AI Data Platform remains the sole gateway. Do not enable product/listing/customer/job reference reads as part of this handoff.

**Offline source check:** `npm run test:rosevear-ql245-source-evidence-477` (same fail-closed test as `test:pms-reviewer-receipt-aging-477`). The returned JS assessment always labels applicant-provided claims UNVERIFIED, never signs or submits a QL-245 envelope. Keep real HMAC secrets and Ed25519 private keys only in a separately approved nonproduction secret manager.

**Evidence still required from separately authenticated channels:** issued company tenant and active module, real nonproduction URL and matching source SHA/green CI link, seven original denial HTTP/trace/audit records, gateway-signed originals, six source + one assessor independently pinned Ed25519 SPKI fingerprints, an independent datastore restart witness, a revocation/kill-switch demonstration, and separate explicit owner scope/duration authorization. No fixture can satisfy them.

**Next review:** QL-245/QL-246 independent evidence retrieval; not connector activation.
