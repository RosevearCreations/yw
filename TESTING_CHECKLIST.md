> Last synchronized: April 7, 2026. Reviewed during the estimates/work-orders/routes/materials/subcontract/general-ledger foundation and documentation synchronization pass.

# Testing Checklist

Last synchronized: April 7, 2026

## Session integrity tests
- sign in as Admin
- navigate across random screens
- confirm header identity remains Admin
- confirm Settings remains the same user
- sign out repeatedly from different screens
- confirm logout always works
- confirm no partial profile from another user appears

## Role tests
- Admin access to staff/dropdowns/equipment/jobs
- Supervisor scoped access
- Employee limited access
- legacy worker records still resolve safely

## HSE tests
- toolbox
- PPE
- first aid
- inspection
- emergency drill
- logbook/review-list
- standalone usage without full operations record

## Admin backbone tests
- staff create/edit/block/reset
- dropdown create/edit/delete
- equipment listing load/edit
- jobs/work orders load/edit
- assignments create/edit/delete

## Mobile tests
- phone-size layout
- touch target sizing
- save feedback visibility
- form scrolling
- empty states and validation clarity
