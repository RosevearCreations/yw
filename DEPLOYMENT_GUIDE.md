# Deployment Guide

Current build: **2026-06-05c**  
Current schema: **133**

## Deploy order

1. Apply SQL migrations through schema 133.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` if the live functions are behind the packaged build.
4. Hard-refresh or clear the old service worker so `2026-06-05c` assets load.
5. Run the smoke check script before treating the upload as production-ready.
