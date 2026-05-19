# YWI Main App

Current build: **2026-05-18a**

This build focuses on making the Admin backend load more like a real production app. The first Admin load now uses smaller staged Edge Function scopes instead of starting with one heavy `scope: all` request.

## Active priorities

- Keep public pages mobile-friendly with one clear H1.
- Keep Admin panels loading in smaller chunks with retry/fallback messaging.
- Keep schema files and Markdown synchronized on every pass.
- Continue moving duplicated/high-risk data toward database-backed directories and views.
- Keep retired Markdown and temp files out of the active root.

## Deploy notes

1. Apply SQL through schema **114**.
2. Redeploy Supabase Edge Functions, especially `admin-directory` and `admin-manage`.
3. Hard refresh or clear/unregister the service worker so `?v=2026-05-18a` assets load.
4. Open `/#admin` and verify the Admin page loads live data without immediately falling back to cached Admin data.
