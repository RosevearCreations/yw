# YW Build 478 / QL-246 source-proof readiness

Status: **PENDING / DISCONNECTED / HOLD**, not an external connected integration.

Source system: yw. Repository: RosevearCreations/yw. Business: yw. Contract: rosevear.integration.v1.

- Real issued nonproduction np-... company tenant and enabled module: **NOT VERIFIED**.
- Separately issued one-time operator challenge + SHA-256: **NOT PROVISIONED**.
- Per-source Ed25519 private signer in a trusted secret manager: **NOT PROVISIONED**. Never include secrets in GitHub, chat or static assets.
- Trusted Ed25519 public SPKI fingerprint from separate channel: **UNVERIFIED**.
- Exact source SHA, independent green CI URL, and deployed nonproduction revision: **PENDING**.
- Authenticated server-only nonproduction health/capabilities GETs: **NOT PROVISIONED**.
- Seven separately witnessed negative test denials, original HTTP traces and signed audit: **UNVERIFIED**. CI fixture assertions do not count.
- Independent datastore restart proof, owner identity witness, kill-switch/revocation and rollback: **UNVERIFIED**.
- Owner pilot authorization: **NOT GIVEN**. Actual connection: **DISCONNECTED / HOLD**.

Offline verifier: server/rosevear-ql246-source-proof-478.mjs; test: npm run test:rosevear-ql246-source-proof-478. It verifies exact ordered public metadata, Ed25519 signatures, independently supplied pins, challenge, scoped YW tenant, CI, time and GET-only paths. A matching signature still returns REAL_PROOF_PENDING_HELD.

No signed docs/integration/ql246-source-proof.json is published without genuine independent inputs. A proof cannot reliably include the commit SHA of the commit that itself contains that proof; publish reviewed source first and proof in a later immutable commit, with both revisions linked and independently confirmed.

No payroll, employee, customer, booking, job, dispatch, route, message, payment, camera or device operations are enabled or transferred. Production software release GREEN does NOT mean integration connected.

Sanitized handoff: YW Build 478 code ready; QL-246 source-proof PENDING; six-app trust/unverified evidence remains HOLD.
