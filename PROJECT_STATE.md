# Project State

Last synchronized: April 7, 2026

## Current state

The build now contains a usable blend of:
- staff auth/session flows
- HSE field forms
- profile and logbook screens
- staff admin foundations
- dropdown/catalog management foundations
- assignment workbench foundations
- jobs/equipment workflows
- accounting/order scaffolding

The project is no longer at the “blank shell” stage. The main remaining work is **stabilization and convergence**.

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

## What still needs to become reliable

### 1) Session integrity
The highest-risk issue remains session/state contamination.

The app must hold a single trusted actor across:
- header identity
- settings/profile
- admin screens
- jobs/equipment screens
- logout flow

A stale async response must never overwrite the active signed-in user.

### 2) Role integrity
The app is still carrying legacy values like `worker`/`staff` in places where the product direction is now:
- admin
- supervisor
- employee

The system must consistently calculate an effective role without letting stale profile text demote an active admin session.

### 3) Endpoint convergence
The platform still contains a mix of:
- old compatibility paths
- new role-aware paths
- standalone HSE paths

The preferred direction is:
- session-first
- role-aware
- standalone HSE compatible
- fewer duplicate endpoints

## Current product direction after this sync

The project should now be treated as a **landscaping and field-operations platform** with support for:
- recurring landscaping services
- construction/project jobs
- subcontract equipment/operator work
- standalone HSE workflows

## Near-term completion target

The near-term target is a stable build where:
- auth/session identity is trustworthy
- logout works every time
- admin can manage staff, dropdowns, equipment, and jobs from one backbone
- HSE can run standalone or attached to an operations job
- documentation and schema notes stop drifting
