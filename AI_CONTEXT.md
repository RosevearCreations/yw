> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

<!-- AI_CONTEXT.md -->

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

> Last synchronized: March 24, 2026. This file was reviewed during the recovery/moderation/docs/schema refresh pass.

# Rosie Dazzlers — AI Context Document

This document is designed to give any AI assistant immediate context about the Rosie Dazzlers system so it can help effectively without needing the entire repository.

This file should be pasted into new AI chats when requesting help with the project.

---

# Project Identity

Project Name  
Rosie Dazzlers — Mobile Auto Detailing

Business Area  
Norfolk County and Oxford County, Ontario, Canada

Primary Purpose  
Provide an online system where customers can:

• view detailing services  
• see pricing  
• book appointments  
• pay booking deposits  
• purchase gift certificates  
• receive progress updates about their vehicle  

Admins use the system to:

• manage bookings  
• block dates or AM/PM slots  
• assign staff  
• manage promo codes  
• upload progress photos and updates  

---

# System Architecture

Customer Browser  
↓  
Cloudflare Pages (static site)  
↓  
Cloudflare Pages Functions (`/functions/api`)  
↓  
Supabase Postgres Database  
↓  
Stripe (payments)  
↓  
Cloudflare R2 (image storage)

---

# Core Technologies

Hosting  
Cloudflare Pages

Serverless Backend  
Cloudflare Pages Functions

Database  
Supabase (Postgres)

Payments  
Stripe

Image Hosting  
Cloudflare R2

Public Asset Domain  
https://assets.rosiedazzlers.ca

---

# Repository Structure

Root HTML pages  
/*.html

Shared assets  
/assets

JSON data files  
/data

Backend API endpoints  
/functions/api

Database schema definition  
SUPABASE_SCHEMA.sql

Documentation  
README.md  
REPO_GUIDE.md  
SANITY_CHECK.md  
PROJECT_BRAIN.md  

---

# Important Pages

Home  
/

Services  
/services

Pricing  
/pricing

Booking  
/book

Gift Certificates  
/gifts

Gear Catalog  
/gear

Consumables Catalog  
/consumables

Admin Dashboard  
/admin

Customer Progress Viewer  
/progress

---

# Booking System Model

Bookings are based on half-day slots.

Available slots

AM  
PM  

A full-day booking uses both AM and PM.

Booking capacity is controlled by two tables:

date_blocks — blocks entire day  
slot_blocks — blocks AM or PM

Bookings are stored in the table:

bookings

Booking lifecycle states:

pending  
confirmed  
cancelled  
completed

Deposits are processed through Stripe checkout.

Stripe webhook endpoint:

/api/stripe/webhook

This webhook confirms deposits and updates booking status.

---

# Gift Certificate System

Gift certificates are purchased separately from bookings.

Flow:

Customer → `/gifts`  
↓  
Stripe checkout session  
↓  
Stripe webhook  
↓  
Gift certificate created in database  
↓  
Customer receives gift code

Gift certificates can represent:

• a specific service package  
• an open dollar value  

Certificates expire after **1 year**.

---

# Admin System

Admin pages allow operational control of the system.

Admin capabilities include:

• view bookings  
• change booking status  
• block calendar dates  
• block AM or PM slots  
• assign staff to bookings  
• upload progress photos  
• add progress notes  
• manage promo codes  

Admin API endpoints require the environment variable:

ADMIN_PASSWORD

---

# Progress Update System

Two progress systems currently exist.

Simple progress system

Table  
progress_updates

Endpoint  
/api/progress_list_public

This system is already functional.

---

Token-based secure progress system

Tables

job_updates  
job_media  
job_signoffs  

Endpoints

/api/progress/view  
/api/progress/signoff

This system uses a unique progress token attached to the booking.

Recommended long-term system: token-based progress system.

---

# Database Overview

Main operational tables

bookings  
date_blocks  
slot_blocks  
promo_codes  
gift_products  
gift_certificates  
booking_events  

Progress system tables

progress_updates

or

job_updates  
job_media  
job_signoffs  

The database schema is defined in:

SUPABASE_SCHEMA.sql

---

# Image Storage (Cloudflare R2)

Images are stored in R2 and served through the custom domain:

https://assets.rosiedazzlers.ca

Folder structure used by the site

brand/  
packages/  
products/  
systems/

Example

https://assets.rosiedazzlers.ca/packages/Exterior Detail.png

---

# Environment Variables

Cloudflare Pages environment variables

SUPABASE_URL  
SUPABASE_SERVICE_ROLE_KEY  
ADMIN_PASSWORD  

Stripe configuration

STRIPE_SECRET_KEY  
STRIPE_WEBHOOK_SECRET  
STRIPE_WEBHOOK_SECRET_GIFTS  

Preview environments use Stripe TEST keys.

Production uses Stripe LIVE keys.

---

# Development Rules for AI Assistants

When modifying this project:

Do not duplicate pricing logic between frontend and backend.

Use JSON configuration files when possible instead of hardcoding data.

Keep image paths consistent with the R2 folder structure.

Follow the API patterns already used in `/functions/api`.

Avoid introducing frameworks that conflict with the static site architecture.

Preserve the serverless design.

---

# Known Development Priorities

See SANITY_CHECK.md for the authoritative list.

Important current tasks include:

• resolving duplicate routes for services and pricing  
• aligning add-on pricing definitions between frontend and backend  
• cleaning up duplicate admin block endpoints  
• finishing the token-based progress update system  
• improving admin dashboard usability  

---

# Quick Mental Model

Rosie Dazzlers is essentially:

A static website  
+  
A serverless booking API  
+  
A Supabase database  
+  
Stripe payment processing  
+  
Cloudflare R2 image hosting  

All hosted through Cloudflare.

---

# How to Use This Document with AI

When starting a new AI session, paste this file first.

Then ask the AI for help with:

• debugging endpoints  
• improving booking flow  
• writing new admin tools  
• database queries  
• deployment issues  

This gives the AI enough context to operate effectively without needing the entire repository.


## March 24, 2026 update

This repo now includes:
- persisted recovery template management and preview endpoints
- database-backed public catalog support with JSON fallback
- rated inventory fields for tools and consumables
- admin catalog and recovery pages
- two-sided progress threads with moderation states
- a refreshed schema snapshot in `SUPABASE_SCHEMA.sql`
- migration file: `sql/2026-03-24_recovery_inventory_moderation_and_checkout.sql`

### March 25, 2026 pass note
This doc was refreshed during the vehicle catalog, progress-session, layout, and public catalog filter pass. The repo now includes NHTSA-backed vehicle make/model endpoints, a DB cache table for vehicle catalog rows, progress moderation/enable session upgrades, and public search/filter cleanup on Gear and Consumables.


## March 30, 2026 promo compatibility pass
- Admin promo creation now sends the minimal canonical promo payload (`code`, `is_active`, `discount_type`, `discount_value`, `starts_at`, `ends_at`, `description`) to reduce schema drift against the live `promo_codes` table.
- This pass specifically removes older create-path dependence on legacy promo fields like `active`, `applies_to`, `percent_off`, and `amount_off_cents` during promo creation.

## March 30, 2026 session-first cleanup pass
- Reduced bridge risk again by removing legacy admin fallback from another active set of endpoints, including progress posting/upload, customer-profile save/list, booking customer linking, unblock actions, and app-settings access.
- Tightened browser-side admin calls so active internal pages send `x-admin-password` only when a transitional password is actually present instead of always attaching the header shape.
- Continued doc/schema synchronization and public-page SEO/H1 review for the current build.

