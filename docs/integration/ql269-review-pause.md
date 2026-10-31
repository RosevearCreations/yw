# Yard Workers Build 495 — QL-269 Review Pause

Status as of 31 October 2026: **UNDER REVIEW — PAUSED by owner direction**.

QL-269 exception aging, new connection approvals and authenticated gateway trial
planning are set aside until the owner explicitly resumes them. This is a
**workflow/presentation status**, not an authorization decision or a revision
to the machine-readable integration contract.

## Boundaries retained

- Public `/api/integration/v1/health` and `/api/integration/v1/capabilities`
  remain read-only discovery endpoints. Their `connection_status: HOLD`
  response is unchanged; capabilities, events and commands remain disabled.
- No proof-B origin, private signer-custody witness, independent reviewer
  decision, isolated tenant approval or owner TEST-only GET authorization is
  implied by this UI label or Build 495.
- No new credential, signed evidence, tenant identifier or private witness
  material is collected through the operator dashboard.
- The historical QL-268 public readback may be manually verified without
  credentials. No automatic GET polling or QL-269 aging clock is running.

## Returning from review

The owner must explicitly request reactivation. At that point, reconcile
original signed proof and key custody through the independently authorized
private process, validate tenant isolation, document explicit owner approval,
and obtain independent review **before** considering any authenticated
nonproduction request. Re-enable none of those steps by a display-only change.

## Build 495 operator changes

1. Company owners can select built-in audit filters (all, enables, disables,
   trailing seven days) and hold a custom filter set in memory for their current
   verified company session. Filter requests still query the RLS-protected audit.
2. Curated platform administrators can prepare a read-only authority decision
   handoff from the current account audit and append-only unverified references.
   It does not grant, remove or renew a role, and it is not an owner decision.
3. The QL-269 panel shows **Under Review** with a paused aging clock and a
   disabled connection. Technical gate enforcement remains unchanged.
