# Auth security evidence capture runbook

This runbook covers the bounded external verification path for the current Supabase Auth leaked-password-protection and MFA follow-ups.

The capture path is evidence collection only. It does not change Supabase Auth configuration, write an evidence row, close a current Admin To-Do item, enable Finance or provider execution, run staging acceptance, or authorize a Production release.

## Source authority

The capture uses the official Supabase Management API Auth configuration read endpoint for the registered YardWeasels Production project:

`GET https://api.supabase.com/v1/projects/jmqvkgiqlimdhcofwkxr/config/auth`

Use a dedicated token that can read Auth configuration only. Prefer a fine-grained token with the minimum current Supabase permission required for Auth config reads (`auth_config_read` / `auth:read`) instead of a broad personal access token.

## Required GitHub Actions secrets

Configure these repository or environment secrets before running the manual workflow:

- `SUPABASE_AUTH_CONFIG_READ_TOKEN` — dedicated read-only Management API token for the Auth config endpoint.
- `YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE` — a strong passphrase of at least 24 characters used only to encrypt the prepared evidence artifact.

Do not use a Supabase service-role key as the Management API read token. Do not put either secret into source, workflow inputs, issue comments, pull requests, job summaries, or documentation.

## Run the manual capture

Open GitHub Actions and select **YWI Auth security evidence capture**. Run the workflow manually and set **Run one read-only Supabase Auth config capture and prepare encrypted evidence candidates** to `true`.

The workflow performs one official Management API GET through the existing `auth:evidence:capture-prepare` authority. It validates the sanitized output, confirms the Management API token is absent from the prepared files, encrypts the entire prepared package, deletes the runner-side plaintext package, and uploads only the encrypted artifact.

The workflow must not be added to push, pull-request, scheduled, or canonical source-gate execution. A normal build or Production promotion must never trigger a live Auth configuration capture.

## Decrypt the evidence package

Download the encrypted artifact from the completed manual workflow. Keep the artifact and decrypted files private because they describe current security-control state.

With the same artifact passphrase available in `YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE`, decrypt locally:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in auth-security-evidence-prepared.tgz.enc \
  -out auth-security-evidence-prepared.tgz \
  -pass env:YWI_AUTH_EVIDENCE_ARTIFACT_PASSPHRASE

tar -xzf auth-security-evidence-prepared.tgz
```

The prepared set contains:

- `capture.json` — sanitized Management API capture boundary and derived states.
- `candidate-set.json` — both independently validated evidence candidates and their capture digests.
- `leaked-password-protection.json` — recorder candidate for leaked-password protection.
- `mfa-options.json` — recorder candidate for MFA configuration.

## Recording remains separate and explicit

A successful capture does not prove that an evidence row was recorded. Review the decrypted package and confirm it came from the genuine official Supabase Management API for the registered YardWeasels Production project.

Record each candidate only through the existing `auth:evidence:record` command. The recorder must still receive its explicit evidence-record confirmation, explicit official-source authenticity confirmation, exact Production Supabase URL, service-private recording credential, and any required operator profile identifier.

After each recording, the recorder re-reads `v_it_auth_security_evidence_current`. Re-read the current I.T. authority again before treating either follow-up as closed. A disabled leaked-password control or unconfigured MFA state is valid authoritative evidence, but it remains a follow-up rather than a secure-state completion.

## Safety boundary

Never use Production customer data, Finance posting, payment-provider mutation, staging writes, or an Auth configuration PATCH as part of this evidence capture. The capture endpoint is GET-only. If the endpoint, project reference, token scope, encryption boundary, or prepared-candidate validation does not match this runbook, stop and keep the follow-ups open.
