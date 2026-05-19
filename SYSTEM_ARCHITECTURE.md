# System Architecture

Last refreshed: **2026-05-18a**

## Current pattern

The app is a static frontend with Supabase Edge Functions and database-backed admin views. Admin data is moving away from one large all-in-one response toward smaller scoped payloads.

## Admin loading pattern

Initial Admin load now stages these scopes:

1. `health`
2. `people`
3. `operations`
4. `accounting`

The previous `all` scope remains as a last-resort fallback only. This keeps the screen usable when one panel is slow and reduces the chance of stale cached Admin data being shown as the first result.
