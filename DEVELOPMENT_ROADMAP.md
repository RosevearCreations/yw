# Development Roadmap

Last synchronized: April 7, 2026

## Immediate priorities

### 1) Session and identity integrity
Finish the auth/session cleanup so one user's identity never leaks into another user's session.
- eliminate stale async overwrites
- keep logout deterministic
- align frontend/header/settings/admin identity everywhere
- complete consistent effective-role resolution

### 2) Admin backbone completion
Make Admin the single source of truth for shared operational data.
- staff directory and hierarchy
- dropdown/reference manager
- equipment listings
- jobs and work orders
- materials and costing categories
- service areas and route references

### 3) Landscaping operations model
Deepen the landscaping service model.
- recurring service templates
- route scheduling
- seasonal maintenance packages
- crew assignment per route/job
- material usage per job
- visit-level notes, photos, and signoff

### 4) Project and construction workflow
Support one-off and construction-style jobs.
- estimates and scope breakdown
- work orders
- project phases and milestones
- equipment and material planning
- costing and approvals

### 5) Subcontract dispatch workflow
Support operator + equipment subcontract assignments.
- dispatch records
- client-specific billing basis
- operator/equipment pairing
- timesheets and cost entries
- linked safety/jobsite paperwork

### 6) Standalone HSE continuity
Keep HSE operational without requiring a full operations job.
- standalone forms
- standalone logbook/review
- optional later linking to jobs/sites when created

## Secondary priorities

### 7) Mobile-first field optimization
- quicker mobile navigation
- progressive disclosure on forms
- camera/upload friendly steps
- offline-safe drafts and retries
- faster repeat data entry from shared dropdowns

### 8) Materials and costing
- estimated vs actual materials
- labour costing
- equipment/operator costing
- subcontract cost capture
- job profitability later

### 9) Route and scheduling depth
- route planning surface
- recurring visit generation
- supervisor assignment view
- conflict detection for staff/equipment

### 10) Ongoing public SEO pass
On every build:
- one H1 on exposed pages
- refine local-service titles/meta
- keep private/admin pages noindex
- continue route-by-route cleanup for local search visibility

## Move up next
- eliminate the remaining session-cross contamination risk
- complete Admin dropdown + equipment + jobs editing depth
- add estimate/work-order structure for landscaping and project jobs
- continue DB-first replacement of shared JSON operational data
