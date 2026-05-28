# Deployment Guide

Last refreshed: **2026-05-26a**

## Deploy order

1. Upload the updated app files.
2. Apply SQL through **schema 120**.
3. Redeploy Supabase function `admin-directory`.
4. Redeploy `admin-manage` only if the live copy is behind the prior action-permission work.
5. Hard refresh the browser or unregister the service worker.

## Post-deploy checks

- Confirm the loaded asset version is `2026-05-26a`.
- Confirm the mobile bottom quick-action bar appears on phone width.
- Confirm Admin > Readiness loads schema 120 gates.
- Confirm the app shell still has one H1.
- Confirm visible safety wording uses Ontario OHSA / Ontario workplace safety wording.
