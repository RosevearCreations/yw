# System Architecture

Last synchronized: April 7, 2026

## High-level architecture

The system is a browser-based operations and HSE application with:
- frontend SPA shell
- Supabase Auth
- Supabase database
- Supabase Edge Functions
- database-backed reference data and operational records
- service-worker shell caching

## Logical layers

### 1) Session and identity layer
Responsible for:
- login/logout
- onboarding completion
- effective role resolution
- preventing stale identity overwrites

### 2) Admin backbone layer
Responsible for:
- staff directory
- dropdown/reference values
- equipment catalog
- job/work-order control
- assignments and hierarchy

### 3) Field operations layer
Responsible for:
- jobs
- work orders
- equipment use
- routes/visits later
- materials/costing later

### 4) HSE layer
Responsible for:
- safety forms
- inspections/checks
- logbook/review
- standalone or linked use

## Architectural rule going forward

The HSE layer must be able to run standalone, but whenever a job/work-order/site exists, the system should be able to link the safety record back to operations cleanly.
