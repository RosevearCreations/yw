# YW Build 477 — QL-245 sanitized evidence return (2026-10-28)

This is a truthful source-readiness record, **not** evidence of a successful HMAC handshake. QL-245 forbids treating CI, code readiness, synthetic fixtures, or production READY as nonproduction connection proof.

| Required field | Yard Workers result |
|---|---|
| Application and source_system | Yard Workers / `yw`, `RosevearCreations/yw` |
| Exact source SHA and green CI | Verify after Build 477 protected promotion; no earlier SHA is a QL-245 source receipt |
| Separately deployed nonproduction HTTPS origin and revision | UNVERIFIED |
| Real issued company tenant, enabled module | NOT PROVISIONED for gateway; no tenant guessed |
| Nonsecret source signing-key ID, independently sourced public SPKI SHA-256 pin | NOT PROVISIONED |
| Per-tenant gateway HMAC key ID, registry receipt, revocation | NOT PROVISIONED |
| Two signed source health/capability GET receipts, original retrieved traces | UNVERIFIED |
| Gateway-signed health/capabilities/audit IDs, durable restart inspection | UNVERIFIED |
| Seven executed denial cases: nonce replay, stale request, wrong business, wrong tenant, revoked key, prohibited write, prohibited dispatch | UNVERIFIED (local source-only simulated negatives are not live traces) |
| Independent assessor / seven trusted Ed25519 pins / witness | UNVERIFIED |
| Distinct owner identity challenge and pilot approval | NOT GIVEN |
| Kill-switch and rollback witnessed on live nonprod runner | NOT VERIFIED |
| Owner field/Jobs/Safety approval | HOLD; nothing granted |
| Actual cross-app connection | **DISCONNECTED / HOLD** |

## Scope

The QL-245 allowlist is only `GET /api/integration/v1/health` and `GET /api/integration/v1/capabilities`, with ordered `read_health`, `read_capabilities` scope. Tenant must be a separately issued real nonproduction company ID. Payroll, HR, job dispatch, service writes, outbound messages, and other company records remain denied. The static production endpoints are disabled discovery responses, not authenticated nonproduction proof.

Code-mode QL-243 HMAC syntax and fail-closed checks are preparatory only. Never place a credential or private key into GitHub/chat. QL-245 source metadata cannot be signed without independently provisioned source credentials, an actual isolated nonproduction GET test, seven real denials, an external assessor and separately authenticated owner approval. No fixture may be substituted for receipts.
