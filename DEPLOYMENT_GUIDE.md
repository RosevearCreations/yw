# DEPLOYMENT_GUIDE.md
# YWI HSE Safety System Deployment Guide

This document describes how to deploy and configure the YWI HSE Safety System.

It includes instructions for:

- Supabase project setup
- database configuration
- storage configuration
- Edge Function deployment
- frontend deployment
- verification testing

This guide ensures a consistent deployment across development, staging, and production environments.

---

# System Components

The system consists of the following parts.

Frontend

- static HTML application
- JavaScript logic
- CSS styling
- Progressive Web App support

Backend

- Supabase authentication
- Supabase Postgres database
- Supabase Edge Functions
- Supabase Storage bucket

Deployment targets

- Vercel
- Cloudflare Pages
- Netlify

---

# Step 1 — Create Supabase Project

1. Go to

https://supabase.com

2. Create a new project.

3. Record the following values:

Project URL  
Publishable key (anon key)  
Service role key  

These will be used later.

Important:

The service role key must **never be placed in frontend code**.

---

# Step 2 — Configure Authentication

Open the Supabase dashboard.

Navigate to:

Authentication → Providers

Enable:

Email authentication

Enable:

Magic Link login

Recommended settings:

- disable password login
- enable email verification
- limit login rate if needed

---

# Step 3 — Create Database Tables

Run the SQL migration files located in the repository.

Typical location:
