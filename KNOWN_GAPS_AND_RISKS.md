## 2026-04-07 estimates/work-orders/routes/materials/subcontract/GL foundation pass
- Added schema foundation migration `061_estimates_work_orders_routes_materials_and_gl_foundation.sql` so the repo now has concrete tables for the operations/accounting direction that had previously been only in roadmap notes.
- With the current build reported as stable, the biggest remaining risks shift from shell repair toward implementation depth, validation quality, and operational/accounting convergence.

# Known Gaps and Risks

Last synchronized: April 7, 2026

## 1) Admin backbone incompletion
### Risk
The admin side is growing, but it is not yet the complete source of truth for all shared operational data.

### Needed
- staff management depth
- equipment manager using equipment master data
- estimate/work-order manager
- materials/costing manager
- route and service-area manager
- receivables/payables/accounting setup manager
- shared dropdown/reference control for all major forms

## 2) Validation and repeat-save risk
### Risk
Some forms have shown “saves once, fails later” behavior or insufficient validation feedback.

### Needed
- repeat-save validation
- clearer success/failure messages
- idempotent update paths where appropriate
- stronger server-side validation for critical records

## 3) Landscaping workflow gap
### Risk
The current build has jobs/equipment/HSE foundations, but not yet the full landscaping operations lifecycle.

### Needed
- recurring service templates
- route stops and scheduling
- visit completion flow
- material usage and costing
- client/site history per property

## 4) Project/construction workflow gap
### Risk
One-off project work like splash pads, parks, and construction support is only partially represented.

### Needed
- estimate -> approved work order -> phase tracking
- milestone/progress structure
- job packet / forms bundle
- equipment and materials planning

## 5) Subcontract dispatch gap
### Risk
Sending an employee or operator+machine to another company needs dedicated operational support.

### Needed
- subcontract client records
- dispatch work orders
- operator/equipment pairing
- time/billing/cost capture
- linked safety requirements

## 6) Digital accounting gap
### Risk
The repo now has schema foundations for AR/AP/GL, but not yet the complete admin workflow.

### Needed
- chart of accounts manager
- invoice and bill manager
- payments received and payments made
- journal batch/posting controls
- tax mapping and standard cost mapping
- later financial statements and reconciliation

## 7) Standalone HSE linkage gap
### Risk
The HSE app must stay usable alone, but later linking those records to jobs/sites/clients/work orders should be smoother.

### Needed
- standalone mode remains first-class
- optional link-back to operations records later
- shared safety templates and categories

## 8) CSS/mobile drift risk
### Risk
The UI continues to drift visually across screens and devices.

### Needed
- routine CSS QA
- mobile-first control sizing
- stronger empty states and loading states
- keep admin screens usable on desktop and acceptable on tablet/mobile

## Highest-priority summary
1. admin backbone completion
2. validation and repeat-save reliability
3. landscaping/project/subcontract workflow depth
4. digital accounting implementation
5. standalone HSE continuity
