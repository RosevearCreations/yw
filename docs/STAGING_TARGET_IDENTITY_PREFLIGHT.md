# Staging Target Identity Preflight

This is the durable operator contract for the GitHub staging runner. It supplements the staging environment and exact-current-schema rules in the Active Project Handbook.

Before any staging-only integration proof may run, `npm run staging:preflight` must pass. The preflight is configuration-only: it does not connect to Supabase, create fixtures, or mutate data.

The preflight must prove all of the following:

- `YWI_RUN_STAGING_RPC_TESTS=1`.
- `SUPABASE_URL` is an HTTPS Supabase project URL and its hostname yields a concrete project ref.
- `YWI_STAGING_PROJECT_REF` is present and exactly matches the project ref derived from `SUPABASE_URL`.
- Neither the URL-derived ref nor `YWI_STAGING_PROJECT_REF` equals the known Production project ref.
- `SUPABASE_SERVICE_ROLE_KEY` and `YWI_STAGING_JOB_ADMIN_PROFILE_ID` are present.
- `YWI_STAGING_LABEL=staging` and `YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY`.
- `quote_intake_live` additionally requires `YWI_STAGING_PUBLIC_KEY`.

A staging ref that is merely *different from Production* is not sufficient. A crossed secret set—for example, a staging ref from one project with the Supabase URL from another—must fail closed before the runner starts.

Preflight diagnostics may report project refs and whether required credentials are present, but must never echo service-role keys, public keys, JWTs, or other secret values.

Passing this preflight does not itself authorize staging mutation. The runtime environment guard, exact current-schema parity, scenario prerequisites, fixture boundaries, and required human evidence/signoff remain independent locks. Production data and Production provider activity are never valid substitutes for missing staging infrastructure.
