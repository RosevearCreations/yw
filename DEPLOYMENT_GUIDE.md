# Deployment Guide

## Before deploy

1. deploy frontend files including new modules:
   - `js/admin-actions.js`
   - `js/outbox.js`
2. confirm `index.html` loads all modules in the correct order
3. deploy latest Supabase Edge Functions
4. apply latest SQL helpers and profile expansion SQL where appropriate
5. verify route/view restrictions and admin directory behavior with real accounts

## Security checks

- test worker login
- test supervisor login
- test admin login
- verify non-admin access to `#admin` is redirected
- verify frontend restrictions are matched by backend checks
