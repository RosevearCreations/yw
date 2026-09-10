# Auth Security Evidence Operator Runbook

## Purpose

Use this runbook to collect and record current Supabase Auth control-plane evidence for the YardWeasels Production project without changing the Auth settings themselves. It covers the two current external security follow-ups: leaked-password protection and MFA options.

This workflow records evidence only. It does not enable or disable an Auth control, authorize Production promotion, close a business rail, enable Finance/provider mutation, or substitute Production for staging acceptance.

## Canonical workflow sequence

1. Open GitHub Actions for the YardWeasels repository and manually run **YWI Auth security evidence capture** from `main` (`.github/workflows/auth-security-evidence-capture.yml`).
2. Set the workflow's read-only capture confirmation exactly as required by that workflow. Do not supply a service-role key to the capture workflow.
3. Wait for the capture workflow to complete successfully. Record the exact GitHub **run ID** and **run attempt** shown by GitHub. Do not use a failed, cancelled, expired, or different run.
4. Confirm that the capture came from the genuine official Supabase Management API for the registered YardWeasels Production project. The capture tooling cannot make this human/operator authenticity decision for you.
5. Manually run **YWI Auth evidence authorized recording** from `main` (`.github/workflows/auth-security-evidence-authorized-record.yml`). Supply the exact `capture_run_id` and `capture_run_attempt` from step 3.
6. Select exactly one control: `leaked_password_protection` or `mfa_options`.
7. Set `confirm_record` to `I_CONFIRM_AUTH_EVIDENCE_RECORD` and `confirm_source_authenticity` to `I_CONFIRM_OFFICIAL_SUPABASE_SOURCE` only after the source-authenticity check in step 4 is complete.
8. Let the workflow download only the exact encrypted capture artifact, decrypt it on the ephemeral runner, re-bind the selected candidate to the exact capture provenance, invoke the existing service-private recorder, and destroy the downloaded/decrypted workspace.
9. Repeat steps 5-8 separately for the second control if both controls need current evidence. The recording workflow intentionally records one control per dispatch.
10. Reopen **Admin → I.T. & System → Access & Security** and refresh current readiness. Confirm each recorded control shows the current evidence state expected from the captured Supabase configuration. Do not mark a follow-up complete by hand merely because a workflow ran.

## Fail-closed rules

- Both workflows are manual-only for live operation. They must not be scheduled, push-triggered, or automatically chained together.
- The capture workflow remains read-only and must not receive the Production service-role recording credential.
- The recording workflow must not receive the Management API capture token and must not change Supabase Auth configuration.
- Recording requires canonical `main`, the exact capture run ID and attempt, one allowlisted control, both explicit confirmations, the registered Production project binding, the encrypted artifact passphrase, and the existing service-private recording authority.
- Plaintext capture/candidate files must exist only in the bounded runner workspace and must be destroyed even when recording fails.
- A successful workflow run is not itself proof that the external Auth control is secure. Current I.T. authority is derived from the recorded, freshness-aware evidence row and its control-specific state.
- If the evidence is stale, mismatched, superseded, from the wrong project/run, or cannot be authenticated as official Supabase evidence, stop and collect a fresh capture.

## Lower-level CLI path

The existing `npm run auth:evidence:intake -- <input.json>` and `npm run auth:evidence:record -- <candidate.json>` commands remain the lower-level authority for controlled engineering use. The GitHub workflow path above is the preferred operator path because it keeps capture and recording credentials separated, binds the artifact to its exact workflow provenance, and removes the need to handle decrypted evidence files manually.
