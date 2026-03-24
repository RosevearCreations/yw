# Testing Checklist

## Auth
- email/password login
- magic link login
- logout current session
- logout everywhere
- header session controls visible

## People
- self profile loads
- self profile saves
- supervisor sees crew
- admin sees all
- hierarchy names populate

## Admin
- profile save with hierarchy fields
- site save with site leadership fields
- assignment save with reporting overrides

## Jobs and equipment
- jobs screen visible to supervisor+
- equipment screen visible to supervisor+
- local draft fallback works
- backend load works after function deployment


## Latest security and workflow pass

This pass adds password/account maintenance improvements, email verification resend, phone verification request workflow, direct-report crew filtering, equipment checkout/return workflow, reservation enforcement hooks, and a refreshed full schema reference. New backend pieces include `supabase/functions/account-maintenance`, expanded `jobs-manage`, expanded `jobs-directory`, and updated `admin-directory`. New SQL references include `046_account_validation_and_notifications.sql` and `047_password_validation_equipment_workflow.sql`.


## Account / validation workflow

- Email verification resend works from Account Security
- Phone verification request creates an admin notification
- Change password works after magic-link sign-in
- Clear current session works
- Log out everywhere works

## Crew / hierarchy workflow

- Worker sees self only in My Profile / Crew restrictions
- Supervisor sees direct reports by hierarchy or assignment reporting lines
- Admin/HSE/Job Admin can see broader scoped crew data

## Equipment workflow

- Equipment can be reserved from a job requirement
- Equipment checkout moves item to checked_out
- Equipment return moves item back to available
- Admin notifications are queued on checkout/return
