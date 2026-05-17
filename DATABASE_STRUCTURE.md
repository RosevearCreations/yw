# Database Structure

Last refreshed: **2026-05-16b**

## Latest schema marker

Latest active schema: **111**

## New in schema 111

`sql/111_admin_directory_pagination_saved_view_replay.sql` adds a safe production-readiness marker for:

- Staff Directory pagination controls.
- `admin-directory` pagination metadata for people and jobs.
- Saved admin view replay for Staff Directory filters.
- Cache/version gate for `2026-05-16b`.
- `v_schema_drift_status` expected version advanced to 111.

## Existing related schema foundations

- Schema 109 created `admin_list_pagination_settings` and `v_admin_list_pagination_settings`.
- Schema 110 created mobile navigation/frontend quality gates.
- Schema 111 updates the quality gates and marks the new Admin list behaviour.

## Apply order

Apply migrations in order through schema 111. If the live DB missed schema 106 earlier, run the fixed live-schema versions already included in the current migration chain before schema 111.
