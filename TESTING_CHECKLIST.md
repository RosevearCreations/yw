# TESTING_CHECKLIST.md

Testing checklist for YWI HSE.

## Authentication

- magic link login works
- password login works
- password reset email works
- in-app password change works
- logout works
- logout everywhere works
- expired link handling is safe
- callback/session recovery works on deployed site

## Security tiers

Test with at least these roles:

- worker or staff
- site_leader
- supervisor
- admin

Expected:

- worker/staff cannot review or use admin directory
- site_leader can review but not use admin directory manage actions
- supervisor can view admin directory but not perform create/update/delete
- admin can manage profiles/sites/assignments

## Forms

- toolbox submit
- PPE submit
- first aid submit
- inspection submit
- drill submit

## Uploads

- inspection images upload
- drill images upload
- toolbox images upload if enabled in backend flow
- uploaded images appear in detail view

## Logbook

- filters work
- detail opens
- CSV export works
- review button only appears for review-capable roles

## Admin directory

- directory loads for supervisor+
- profile/site/assignment rows populate forms
- create/update/delete only works for admin

## Account panel

- hidden while signed out
- shows email/role while signed in
- password validation works
- global sign-out works
