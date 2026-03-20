# SYSTEM_ARCHITECTURE.md

System architecture documentation for the **YWI HSE Safety Application**.

This document explains how the frontend, Supabase backend, database, storage, and Edge Functions currently work together.

It is written to help developers, administrators, and AI assistants quickly understand the system as it exists now.

---

# System Overview

The YWI HSE application is a **static frontend safety system backed by Supabase services**.

The architecture separates responsibilities into clear layers:

## Frontend

Handles:

- user interaction
- authentication UI
- form entry
- logbook viewing
- review actions
- admin dashboard interaction

## Supabase Auth

Handles:

- login
- session creation
- token refresh
- password reset email flow

## Edge Functions

Handle:

- secure backend logic
- validation
- submission intake
- review actions
- admin lookups
- admin writes
- image upload flow

## Postgres Database

Stores:

- profiles
- sites
- assignments
- submissions
- reviews
- image metadata
- toolbox attendees

## Supabase Storage

Stores uploaded evidence images.

---

# High-Level Architecture

```text
User Browser
│
▼
Static Frontend Application
(index.html + modular JS files)
│
├──────────────► Supabase Auth
│                 │
│                 ▼
│             User Session JWT
│
▼
Supabase Edge Functions
│
▼
Postgres Database
│
▼
Supabase Storage
(submission-images)
