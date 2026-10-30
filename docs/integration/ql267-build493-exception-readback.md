# Yard Workers Build 493 — QL-267 connection exception readback (HELD)

This is a release-status and owner-review handoff, **not proof of integration authorization**.

## Implemented

- Company-owner audit filters query the existing RLS-protected service history by
  company, module, action and UTC start date. A changed session or foreign row
  invalidates the display. Initial `previous_enabled = NULL` records are valid.
- The platform administrator sees a restricted append-only ledger of ticket IDs
  for **current legacy global-admin accounts**. IDs are labeled
  `UNVERIFIED_REFERENCE`; the underlying evidence is not uploaded or verified.
  The record RPC checks curated administrator status and the legacy target.
- QL-267 display checks only public `GET /api/integration/v1/health` and
  `GET /api/integration/v1/capabilities`. It fails closed if the source identity,
  HOLD status, disabled capabilities or isolation flags change unexpectedly.

## Still held — genuine external evidence required

1. Immutable source A and separately signed proof B, independently retrieved
   and verified without self-reference.
2. Private signer custody decision, separately witnessed and confirmed pinned
   key / SPKI evidence; no credentials or private proof in this repository.
3. Genuinely isolated nonproduction company tenant, independent seven-denial
   evidence and rollback custody.
4. Separate authenticated owner approval for a bounded TEST-only read-only
   gateway window (at most 30 minutes; health/capabilities GET only).

The published app, source checks and evidence-reference ledger do **not**
activate the gateway, authenticate another application, authorize customer
data, change an administrator role, or permit dispatch, payroll, SMS, calls,
events or mutations.
