## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` for the next implementation phase.
- Current state is now best described as stable session/auth shell + HSE forms + staff/admin backbone foundations + operations/accounting schema foundation.

# Project State

Last synchronized: April 7, 2026

## Current state

The build now contains a usable blend of:
- stable staff auth/session flows
- HSE field forms
- profile and logbook screens
- staff admin foundations
- dropdown/catalog management foundations
- assignment workbench foundations
- jobs/equipment workflows
- accounting/order scaffolding
- schema foundation for estimates, work orders, materials, routes, subcontract dispatch, and digital accounting

## What is working directionally

### Session-aware internal shell
- standard login/logout shell exists
- protected pages can load under a signed-in session
- role-aware backend direction is established

### HSE forms
- toolbox
- PPE
- first aid
- inspection
- drill
- logbook/review direction exists

### Admin foundations
- staff directory exists
- admin password reset exists
- dropdown/catalog manager exists
- assignment workbench exists
- orders/accounting stub exists

### New schema foundation
- estimates and work orders
- materials catalog and units
- routes and service areas
- subcontract clients and dispatches
- chart of accounts, AR, AP, and GL journals

## What still needs implementation depth
- admin UI for estimates/work orders/materials/routes/subcontract dispatch/accounting
- repeat-save validation and stronger field feedback
- tighter linking between standalone HSE and operations records
- continued DB-first replacement of shared JSON operational data
