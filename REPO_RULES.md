> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

<!-- docs/REPO_RULES.md -->

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.

> Last synchronized: March 24, 2026. This file was reviewed during the recovery/moderation/docs/schema refresh pass.

# Rosie Dazzlers — Repository Rules

This document defines the **non-negotiable rules** for modifying the Rosie Dazzlers codebase.

These rules exist to prevent architectural drift and ensure that future development (human or AI) maintains the intended design of the system.

Any AI assistant helping with this repository **must follow these rules**.

---

# 1) Preserve the Architecture

The Rosie Dazzlers platform is intentionally built as:

Static Website  
+  
Serverless API  
+  
Supabase Database  
+  
Stripe Payments  
+  
Cloudflare R2 Image Hosting

Architecture flow:

Browser  
↓  
Cloudflare Pages (static site)  
↓  
Pages Functions (`/functions/api`)  
↓  
Supabase (Postgres)  
↓  
Stripe  
↓  
R2 storage

Do **not** introduce frameworks or changes that break this architecture.

---

# 2) Do Not Introduce Frontend Frameworks

This project is intentionally a **static HTML site**.

Do not introduce:

React  
Next.js  
Vue  
Angular  
Svelte  
Astro  

Static HTML + JavaScript is the intended design.

---

# 3) Backend Must Remain Serverless

Backend logic must remain inside:


/functions/api


Do not introduce:

Express servers  
Node hosting services  
Docker containers  
Persistent backend services  

All backend logic must run through **Cloudflare Pages Functions**.

---

# 4) Do Not Duplicate Business Logic

Business rules must exist in **one place only**.

Examples:

Pricing logic  
Add-on definitions  
Promo code rules  
Package definitions  

Preferred location for business configuration:


/data/*.json


Both frontend and backend should read from the same source.

---

# 5) Do Not Hardcode Asset Paths

Images must follow the R2 asset structure.

Base domain:

https://assets.rosiedazzlers.ca

Folders:

brand/  
packages/  
products/  
systems/

Do not hardcode new asset locations that break this structure.

---

# 6) Database Schema Changes

Database schema is defined in:


SUPABASE_SCHEMA.sql


Rules:

• do not create tables outside this file  
• keep schema changes backward compatible  
• use `create table if not exists` patterns  
• use `add column if not exists` when modifying tables  

All schema updates must be reflected in this file.

---

# 7) Protect the Booking System

The booking system is the **core business logic**.

Key files:


/functions/api/checkout.js
/functions/api/availability.js
/functions/api/stripe/webhook.js


Changes to booking logic must preserve:

AM / PM slot system  
date_blocks  
slot_blocks  
deposit checkout flow  
Stripe webhook confirmation

Do not alter booking flow without careful validation.

---

# 8) Protect the Gift Certificate System

Gift certificates are intentionally **separate from bookings**.

Key endpoints:


/api/gifts/checkout
/api/gifts/webhook
/api/gifts/receipt


Do not merge gift logic into the booking system.

---

# 9) Admin Endpoints Must Remain Protected

Admin API endpoints must require:


ADMIN_PASSWORD


Never expose admin endpoints publicly without authentication.

---

# 10) Avoid Introducing State on the Frontend

The frontend should remain simple and stateless.

Avoid:

complex client-side frameworks  
persistent client state systems  
local database storage  

State belongs in the database.

---

# 11) Respect the Documentation System

This repository includes structured documentation.

README.md — project overview  
PROJECT_BRAIN.md — system overview  
AI_CONTEXT.md — AI guidance  
REPO_GUIDE.md — repo structure  
SANITY_CHECK.md — development priorities  
DEVELOPMENT_ROADMAP.md — next upgrades  
SUPABASE_SCHEMA.sql — database schema  

Any major change should update the relevant documentation.

---

# 12) Prefer Simple Solutions

When adding features:

Prefer

simple JavaScript  
JSON configuration  
serverless functions  

Avoid unnecessary complexity.

The goal is a **maintainable small-business platform**, not an enterprise framework.

---

# Final Rule

If a proposed change makes the system:

• harder to understand  
• more complex to deploy  
• dependent on new infrastructure  

then it is likely **the wrong change**.

Always favor the simplest architecture that preserves functionality.