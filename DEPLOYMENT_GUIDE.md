# Deployment Guide

Current build: **2026-06-06a**  
Current schema: **134**

## Deploy order

1. Apply SQL migrations through schema 134.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` if the live functions are behind the packaged build.
4. Hard-refresh or clear the old service worker so `2026-06-06a` assets load.
5. Run the smoke check script before treating the upload as production-ready.
