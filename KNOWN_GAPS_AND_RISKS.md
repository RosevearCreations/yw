# Known Gaps and Risks

Last synchronized: April 7, 2026

## 1) Session contamination risk
### Risk
The most serious current risk is cross-user identity contamination.

### Why it matters
If an Admin can navigate and later appear as Employee with partial settings data:
- trust in permissions fails
- audit trails weaken
- protected actions become unsafe
- logout and re-auth become unreliable

### Needed
- stale async request cancellation/guarding
- one resolved actor trusted across all screens
- no protected refetch after logout/session removal

## 2) Role consistency risk
### Risk
Legacy `worker` / `staff` values still overlap with the intended Admin / Supervisor / Employee model.

### Needed
- canonical role model
- effective-role resolution that tolerates legacy data safely
- database normalization toward `employee`

## 3) Admin backbone incompletion
### Risk
The admin side is growing, but it is not yet the complete source of truth for all shared data.

### Needed
- staff management depth
- equipment manager
- job/work-order manager
- materials/costing manager
- shared dropdown/reference control for all major forms

## 4) Landscaping workflow gap
### Risk
The current build has jobs/equipment/HSE foundations, but not yet the full landscaping operations lifecycle.

### Needed
- recurring service templates
- route stops and scheduling
- visit completion flow
- material usage and costing
- client/site history per property

## 5) Project/construction workflow gap
### Risk
One-off project work like splash pads, parks, and construction support is only partially represented.

### Needed
- estimate -> approved work order -> phase tracking
- milestone/progress structure
- job packet / forms bundle
- equipment and materials planning

## 6) Subcontract dispatch gap
### Risk
Sending an employee or operator+machine to another company needs dedicated operational support.

### Needed
- subcontract client records
- dispatch work orders
- operator/equipment pairing
- time/billing/cost capture
- linked safety requirements

## 7) Standalone HSE linkage gap
### Risk
The HSE app must stay usable alone, but later linking those records to jobs/sites/clients should be smoother.

### Needed
- standalone mode remains first-class
- optional link-back to operations records later
- shared safety templates and categories

## 8) CORS and endpoint reliability risk
### Risk
Any remaining function without correct OPTIONS/CORS handling can break field workflows even when auth is otherwise working.

### Needed
- consistent OPTIONS handling
- consistent CORS headers on success/error
- retire duplicate/older endpoint patterns

## 9) Save reliability risk
### Risk
Some forms have shown “saves once, fails later” behavior.

### Needed
- repeat-save validation
- visible success/failure messaging
- idempotent save paths where appropriate

## 10) CSS/mobile drift risk
### Risk
The UI continues to drift visually across screens and devices.

### Needed
- routine CSS QA
- mobile-first control sizing
- stronger empty states and loading states
- keep admin screens usable on desktop and acceptable on tablet/mobile

## Highest-priority summary
1. session/account isolation
2. role consistency
3. admin backbone completion
4. landscaping/project/subcontract data model depth
5. standalone + linked HSE convergence
6. endpoint/CORS reliability
