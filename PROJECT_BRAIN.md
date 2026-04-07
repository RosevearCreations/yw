# Project Brain

Last synchronized: April 7, 2026

## Product summary

This project is now best understood as a **field operations platform with an integrated HSE safety application** for a landscaping-led company that also performs project work, construction-style work, and subcontract machine/operator dispatch.

It is not just a safety app and it is not just a crew directory. It is becoming the operational system for:
- people
- equipment
- jobs
- work orders
- safety records
- costing
- routes
- materials
- approvals

## Business reality the app must support

### A) Recurring landscaping operations
Examples:
- mowing and trimming routes
- spring and fall cleanup
- bed maintenance
- pruning and planting
- property visits with repeating schedules

### B) One-off project work
Examples:
- splash pads
- children's park work
- local construction support
- hardscape/site enhancement jobs
- small building or site-related jobs

### C) Subcontract dispatch work
Examples:
- backhoe + operator for a fibre optic contractor
- employee sent to another firm for a day or project
- client-specific site, safety, and billing requirements

### D) Standalone HSE usage
Examples:
- an unscheduled project where only the safety module is needed
- project-specific inspection or toolbox flow without a formal work order
- ad hoc site documentation when operations-side records are not yet created

## Identity and role model

The intended role model is:
- **Admin**: full access to staff, jobs, equipment, dropdowns, approvals, work orders, and configuration
- **Supervisor**: oversight of assigned crews, jobs, equipment, and field workflows within scope
- **Employee**: assigned work, field forms, job updates, limited self-profile access

Key rule:
- customer/business tiers are never permissions
- only staff roles and scoped assignments control access

## Data backbone that should be database-first

The following should be treated as database-first shared reference data, not scattered JSON islands:
- staff directory
- positions/trades
- staff tiers and seniority
- employment statuses
- equipment classes and equipment items
- job types and work order statuses
- material catalog and units
- route/service area references
- recurring task templates
- HSE form templates and safety categories

## Core linked modules

### Staff
- account + role
- supervisor chain
- certifications / training later
- employment status
- contact and emergency details later

### Equipment
- assets
- reservations
- condition / maintenance
- dispatch to jobs or subcontract work

### Jobs and work orders
- estimate -> approved job -> work order -> crew assignment -> completion
- support both recurring route jobs and one-off projects

### Materials and costing
- budgeted materials
- actual materials used
- labour hours
- subcontract cost entries
- equipment cost and operator cost later

### HSE
- standalone mode must remain supported
- linked mode should attach HSE records to jobs, sites, crews, or work orders when available

## Product truth for next builds

If a future change conflicts with these rules, prefer:
1. session integrity
2. role correctness
3. database-backed shared data
4. mobile usability in the field
5. standalone HSE capability
6. desktop admin completeness
