> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.
# Rosie Dazzlers — Admin / Detailer Role Model

Use this document as the quick reference for how staff access should behave on the `dev` branch.

This file is about:
- security roles
- staff capabilities
- booking/work scope
- override behavior

This file is **not** about customer loyalty tiers.

---

## Core rule

Do not mix:

- **security roles**
with
- **customer tiers**

Security roles control access.

Customer tiers are business segmentation only.

---

## Security roles

Current intended staff role set:

- Admin
- Senior Detailer
- Detailer

Customer is not part of the internal staff role set.

---

## Role intent

### Admin
Highest internal access.

Admin should be able to:
- manage bookings
- manage blocks
- manage progress
- manage promos
- manage staff
- view live operations
- override lower-level entries when needed

Admin is the business control role.

---

### Senior Detailer
Field leader / advanced operator role.

Senior Detailer should be able to:
- work assigned bookings
- update jobsite intake
- log time
- post progress
- add media
- manage signoff on allowed bookings
- potentially override lower-level work entries when business rules allow

Senior Detailer is the “trusted field lead” role.

---

### Detailer
Standard field operator role.

Detailer should be able to:
- work assigned bookings
- update allowed intake records
- log time
- post progress/media on allowed bookings
- participate in signoff workflow where allowed

Detailer should not have broad business-management powers.

---

## Capability model

The backend should think in terms of capabilities, not only page names.

Important capability examples:

- `manage_bookings`
- `manage_blocks`
- `manage_progress`
- `manage_promos`
- `manage_staff`
- `work_booking`
- `override_lower_entries`
- `view_live_ops`

This keeps access rules clearer and easier to reuse across endpoints.

---

## Staff identity model

Current bridge reality may still include:
- `ADMIN_PASSWORD`
- transitional header-based staff identification

Long-term intended model:
- real staff login/session
- resolved `staff_user_id`
- resolved staff email/name
- capability checks based on the `staff_users` table

Best practice:
- trust real staff identity
- do not rely long-term on typed names

---

## Staff source of truth

Primary internal staff table:

- `staff_users`

Important fields/direction include:
- role code
- active state
- email
- full name
- capability flags
- notes / admin context

This table should be the main internal authority for staff access decisions.

---

## Booking scope model

Not every staff user should see every booking.

General rule:

### Admin / booking managers
Can see and act on all bookings within allowed business operations.

### Senior Detailer / Detailer
Should usually only see and act on bookings they are allowed to work.

That scope is generally determined through booking assignment fields such as:
- `assigned_staff_user_id`
- `assigned_staff_email`
- `assigned_staff_name`
- legacy `assigned_to`

Goal:
- keep lower roles scoped to their work
- avoid exposing unrelated jobs unnecessarily

---

## Assignment model

Preferred structured assignment fields:

- `assigned_staff_user_id`
- `assigned_staff_email`
- `assigned_staff_name`

Legacy compatibility field:
- `assigned_to`

Long-term preference:
- resolve assignment from `staff_users`
- keep `assigned_to` only as a compatibility/helper field where needed

---

## Override model

Some internal actions are more sensitive than others.

Examples:
- deleting another staff user’s time entry
- deleting another staff user’s progress entry
- deleting another staff user’s media
- replacing another staff user’s intake/signoff work

When a higher-authority user changes or deletes another staff user’s work, that should be treated as an override.

Primary audit table:
- `staff_override_log`

---

## Override rules

### Detailer
Normally should not override another staff user’s records.

### Senior Detailer
May be allowed to override lower-level work depending on capability rules.

### Admin
May override when operationally necessary.

When override happens:
- record who performed it
- record whose work was overridden if known
- record booking context
- record source table / source row
- record reason when possible
- record a short summary of the change

---

## Live ops visibility

Live monitoring should follow scope rules too.

### Admin / booking managers
Can view full live operational board.

### Detailer / Senior Detailer
Should usually only see jobs they are assigned to or explicitly allowed to work.

This keeps the live system useful without exposing unrelated work.

---

## Customer tiers rule

Customer tiers belong to:
- sales/loyalty
- repeat-customer segmentation
- business reporting
- future pricing/marketing decisions

Customer tiers do **not** control:
- staff access
- admin visibility
- internal permissions

Examples of customer tier ideas:
- random
- regular
- silver
- gold
- vip

These are business tags, not access-control roles.

---

## Page access direction

Intended page access should roughly follow this model:

### Admin
- `/admin`
- `/admin-booking`
- `/admin-blocks`
- `/admin-progress`
- `/admin-jobsite`
- `/admin-live`
- `/admin-staff`
- `/admin-customers`
- `/admin-promos`

### Senior Detailer
Usually:
- `/admin-jobsite`
- `/admin-progress`
- `/admin-live` (scoped)
- possibly parts of `/admin-booking` if explicitly allowed

### Detailer
Usually:
- `/admin-jobsite`
- scoped progress/time/media/signoff workflow
- limited live/scoped work visibility

Exact frontend visibility should eventually be driven by resolved role/capability state.

---

## API design rule

Do not trust the frontend alone to enforce role rules.

Frontend should:
- hide irrelevant tools
- simplify the interface

Backend must:
- resolve staff identity
- apply capability checks
- apply booking-scope checks
- reject unauthorized actions

---

## Preferred future direction

The ideal long-term flow is:

1. staff logs in
2. backend resolves current staff user
3. frontend loads current actor info
4. menus/pages adapt to role
5. API endpoints enforce final authority
6. override actions are logged when needed

---

## Things to avoid

- mixing customer tiers with security roles
- relying forever on typed names for staff identity
- giving detailers broad global booking visibility
- letting override actions happen without audit logging
- building page access rules that are not backed by API enforcement

---

## One-sentence summary

Rosie Dazzlers should use a **role-and-capability staff model with scoped booking access and override logging**, while keeping **customer tiers completely separate from security permissions**.


## Current snapshot — March 21, 2026

Latest pass completed:
- fixed booking add-on checkbox/text layout pressure
- improved service/package image fallback with extra photo cards
- expanded staff management toward richer Admin/Detailer profile editing
- added customer tier discount support in the UI/data model direction
- added/confirmed garage, gift, and redemption visibility in client/admin screens
- added current SQL for tier discounts and richer staff/customer fields

Current next priorities:
- picture-first observation interface
- richer client/detailer threaded comments UI
- manual scheduling / app-management rules UI completion
- final layout polish across booking and internal screens
