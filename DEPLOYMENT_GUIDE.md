# Deployment Guide

Latest build: **2026-06-05a**  
Latest schema: **131**

## Deploy order

1. Apply any missing repaired schema 128 migration if it has not already succeeded.
2. Apply schema 129 and 130 if missing.
3. Apply `sql/131_payment_recon_equipment_seo_runtime_execution_controls.sql`.
4. Redeploy `admin-directory`.
5. Redeploy `jobs-manage` and `jobs-directory` if live versions are behind.
6. Hard-refresh or clear the old service worker so `2026-06-05a` assets load.

## Deploy Notes – 2026-06-05b / Schema 132

1. Apply migrations through schema 132.
2. Redeploy `admin-directory`.
3. Redeploy `jobs-manage` and `jobs-directory` if the live versions are behind.
4. Confirm `sitemap.xml` and `robots.txt` deploy with the static assets.
5. Hard-refresh or clear the service worker so the `2026-06-05b` cache marker loads.
