# YW561 — Independent Provider Receipt Validation, Reopen Supervision and Master Correlation

## What changes

- Protected Comms provider receiver: `supabase/functions/landscape-provider-verify-561`.
  Authenticated server-to-server only, strict fixed payload, exact Ed25519 signature
  over canonical JSON, key fingerprint, bounded timestamps, and no CORS.
- Independent DB custodian public-key pin registration (`HOLD` until separately
  installed and verified). Receiver cannot enroll keys or store private keys.
- Atomic server-side original YW559 owner-intent/YW560 provider-report matching,
  unique issuer/nonce replay ledger and conflicting-replay rejection.
- Original owner can review and escalate a reopened YW556 exception; a later
  “continuity reviewed” owner decision requires fresh original YW557 supervisor
  signer plus source-verified original YW556/YW559 customer closure evidence.
- Master read-only aggregate returns no tenant IDs, customer fields, case IDs,
  provider keys, or individual receipts. A cryptographically valid *provider*
  `delivered` report is **not recipient delivery, source-health signing, or an
  AI Data Platform Master owner acceptance**.

## Authority boundaries and installation order

1. DB custodian must confirm the original YW553–560 migrations are installed.
   Apply `sql/landscape_provider_validation_561.sql` through the approved
   migration workflow and test its security privileges/functional RLS.
2. Independently assign the Comms provider-signer custodian, obtain its Ed25519
   **public** key via authenticated channel, verify custody/witness and SHA-256
   of the 32-byte raw key, and enroll the pin with ACTIVE state via a separate
   DBA identity. Never enroll a synthetic/test key. `service_role` can SELECT
   the pin but has no INSERT, UPDATE or DELETE grant.
3. Configure the protected Edge function `YW561_RECEIVER_TOKEN` via deployment
   secrets, along with Supabase's existing server-side URL and service key.
   Share the receiver credential only with the authorized Comms backend through
   its approved secret channel. Never put tokens in Git, client code, or issues.
4. Deploy `landscape-provider-verify-561` with the reviewed JWT-disabled config
   (receiver requires its *own* server-to-server bearer token). Import prior
   signed, source-matched provider claim via the existing protected YW560
   pathway; the new receiver checks it again and atomically records nonce.
5. Confirm valid signature admitted once, identical nonce replay returns
   `replayed=true`, changed nonce payload or wrong tenant fails, revoked pin
   fails, and unauthenticated requests fail. These are supervised **runtime**
   checks, separate from the source CI mock tests.
6. Independently verify YW557 fresh supervisor ACK and YW559 original customer
   reconfirmation for reopened/closed source case. Owner case review is a source
   decision only; cannot mark a Master gate accepted.

## Signed receipt contract

`Content-Type: application/json`, protected backend POST:

```json
{
  "payload": {
    "schema": "rosevear.yw.provider-delivery-receipt.v1",
    "issuer": "rosevear-comms-hub",
    "audience": "yw-landscape-provider-receiver-561",
    "source_id": "yw", "tenant_boundary": "company",
    "key_id": "pre-enrolled-provider-key-id",
    "company_id": "owned-company-uuid", "request_id": "original-request-uuid",
    "case_version": 3, "followup_intent_id": "original-YW559-uuid",
    "provider_report_id": "protected-YW560-record-uuid",
    "provider_message_ref": "opaque-provider-reference",
    "provider_receipt_sha256": "64-lowercase-hex-characters",
    "provider_reported_state": "delivered",
    "provider_reported_at": "2026-11-11T18:00:00.000Z",
    "issued_at": "2026-11-11T18:01:00.000Z",
    "nonce": "fresh-v4-uuid"
  },
  "signature": "base64-of-64-byte-Ed25519-signature"
}
```

The signature is over UTF-8 `JSON.stringify` of the `payload` *in exactly the
field order above*, regardless of supplied JSON object key order. Extra fields
are rejected. The signature and key must be verified independently before the
service-role-only database commit. The nonce is durable once committed.

## AI Data Platform direct acceptance handoff

`MASTER561-YW-DELIVERY-ACK | controller=ai-data-platform | source=yw |
source_role=platform_shell | tenant_boundary=platform_shell |
production_main=<exact verified main> | code=GREEN_IF_CI_SUCCESS |
provider_receiver=CODE_READY_RUNTIME_HOLD | signer_pin=HOLD_UNTIL_INDEPENDENTLY_ENROLLED |
signed_provider_receipt=HOLD_UNTIL_PROTECTED_RUNTIME_PROOF |
replay=HOLD_UNTIL_DATABASE_COMMIT_PROOF | original_reopen_supervision=SOURCE_ONLY |
recipient_delivery=HOLD | master_delivery_acceptance=HOLD |
source_health_signer=SEPARATE_MASTER371_HOLD_IF_NOT_VERIFIED |
connection=HOLD | owner_accepted=false`

AI Data Platform must independently observe exact deployed platform-shell
manifest revision and controller-admit its own independent source Ed25519
HEALTHY receipt, distinct from this *Comms provider* signer. Do not convert
the aggregate counts or source code GREEN into a `CONNECTED` assertion.

## Verification

`npm run test:landscape-provider-validation-561` verifies real disposable-key
Ed25519 positive/negative behavior, static SQL security/source lineage, and
existing CI wiring. Browser acceptance covers mobile/tablet/desktop, stale
source, missing supervisor, cross-tenant, owner decision and sign-out.
