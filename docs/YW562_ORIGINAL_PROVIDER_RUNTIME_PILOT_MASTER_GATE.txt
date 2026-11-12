# YW562 — Original Provider Runtime Pilot, Signed Delivery Correlation & Owner-Gated Master Acceptance

## Runtime gates
YW562 extends YW561. Neither green GitHub CI nor a code deployment means a live provider receipt was received. The original signed provider claim remains DISTINCT from proof of actual customer receipt, source-health signer admission, three-Master runtime acceptance, and AI Data Platform owner acceptance.

**Verified at authoring:** The connected YardWeasels Supabase project `jmqvkgiqlimdhcofwkxr` did not contain the original `ywi_landscape_recovery_cases_556` or `ywi_landscape_provider_verified_561` tables. Runtime cannot open the pilot until the approved DBA migration chain is installed and separately tested. Do not install this migration out of dependency order.

## Original provider pilot workflow
1. Custodian verifies prior YW553–561 schema and RLS, records independent provider signing key/witness custody and activates only the pre-authorized YW561 protected receiver. No fake keys, unsafe service-role access, or secrets in Git.
2. Comms backend sends an actual signed Ed25519 provider report through YW561. The receiver must validate the current public key pin, protected token, source, canonical SHA-256, nonce and current YW559/560 intent; the DB enforces an atomic unique nonce ledger.
3. Original company owner opens **Landscaping · Original Provider Runtime Pilot & Master Acceptance Gate**, selects their company, exact original YW556 recovery case and YW561 verified receipt. The protected YW562 read RPC must match company/request/case version and receipt ID, a fresh verified signature from the last 24 hours, a YW561 original reopen continuity-reviewed source decision, original YW557 fresh supervisor and original customer source closure. No independently verified provider report = HOLD.
4. Owner can **approve source evidence for independent Master review** ONLY when source gates are ready; or explicitly reject a source receipt. An immutable receipt-specific decision is written with auth.uid, case version and idempotency. Replays of the same decision are idempotent; inconsistent replays and cross-tenant requests are refused. The owner cannot mark Master accepted by changing a web form.
5. Protected service-role-only read RPC returns platform-shell aggregate counts without company/customer/case IDs or individual receipt signatures. The source's owner-only case review returns the exact canonical and signature hashes needed to separately cross-check handoff with Comms and AI Data. The Master must obtain exact evidence through its separately authorized protected path, independently verify source signer, runtime and current revision, and capture **its own** explicitly owner-gated acceptance. Until then Master=HOLD, connected=HOLD.

## Files
- `sql/landscape_provider_runtime_pilot_562.sql`: RLS-protected immutable source decisions, exact read and write RPCs, protected summary.
- `js/landscape-provider-runtime-pilot-562.js`: responsive original owner review; sign-out clears source evidence.
- `scripts/landscape-provider-runtime-pilot-562-check.mjs`: SQL and browser security guardrails.
- `tests/browser/landscape-provider-runtime-pilot-562.spec.mjs`: source-ready, stale closure, foreign company, sign-out and 390/768/1440-pixel cases.

## Installation and acceptance
Apply `sql/landscape_provider_runtime_pilot_562.sql` only after verifying all earlier migrations and owner helper functions are installed. Run DB RLS tests as anonymous user, foreign owner, correct owner, service role and DB custodian; assert direct table INSERT/UPDATE/DELETE denied to browser roles. Confirm actual YW561 signed receiver receipt, signer pin, nonce replay, source lineage and supervisor/customer closure using independent authorized runtime evidence. Then independently gate AI Data Platform exact receipt admission, source-health signer, Comms receiver ACK and explicit Master owner acceptance; do not infer `CONNECTED`.

Source checks: `npm run test:landscape-provider-runtime-pilot-562` and `npm run test:browser:landscape-provider-runtime-pilot-562`. Both are included in existing protected source/browser lanes.

## Sanitized direct handoff
`MASTER562-YW-PROVIDER-PILOT | controller=ai-data-platform | source=yw | source_role=platform_shell | tenant_boundary=platform_shell | code=GREEN_ONLY_IF_PRODUCTION_CI | original_provider_receiver=HOLD_UNTIL_VERIFIED_RUNTIME | signed_delivery_evidence=HOLD_UNTIL_EXACT_SIGNED_RECEIPT | source_owner_decision=SEPARATE_EXPLICIT_GATE | master_owner_acceptance=HOLD | customer_delivery=UNVERIFIED | connection=HOLD | tenant_export=NONE`

**Next proposed YW563:** Independent Provider Runtime Acceptance Ledger, Master Receipt Discrepancy Triage & Owner-Approved Follow-Up Closure.
