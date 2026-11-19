# AIDP Build 423 — Yard Workers Sysop telemetry source handoff

YW exposes the common read-only `GET /internal/rosevear/sysop/telemetry/v1` source endpoint for the AI Data Platform Build 423 portfolio view.

The endpoint requires server-side `ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN`, `ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM` and the exact deployed source commit. It signs only non-sensitive aggregate fields. Missing enrollment is `NOT_ENROLLED`; it never manufactures a CONNECTED state.

All YW tenant/company/client/job/worker/location/photo/payroll/invoice data remain inside YW. Unknown counters are null. YW may report process-level heartbeat/restart observations but cannot claim the Windows original-host boot event. The envelope authorizes no job, payment, message, reboot, recovery or configuration action.

Coordination: AI Data Platform Build 423; existing source issue #846.
