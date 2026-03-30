> Last synchronized: March 28, 2026. Reviewed during the image-fit, booking-slot readability, dark-text contrast, and current-build documentation/schema sync pass.

# Rosie Dazzlers Access Control Model

## Purpose
This document defines the first structured access model for the Rosie Dazzlers app so future development can safely support:
- Admin users
- Senior Detailers
- Detailers
- Customers
- Customer tiers (random, regular, silver, gold, vip)

This file is the human-readable rulebook that sits beside the database schema.

---

## 1) User groups

### A) Admin
Highest privilege level.

Typical abilities:
- View all bookings
- Edit all bookings
- Assign staff
- Enable or disable progress links
- Post and edit progress
- Post and edit media
- Create or remove date blocks and slot blocks
- Create and disable promo codes
- Override detailer-entered intake information
- Manage staff users and permissions
- View all internal notes
- View override history

Examples:
- Owner
- Business manager
- Lead admin

---

### B) Senior Detailer
High trust operational user.

Typical abilities:
- View assigned bookings
- View job-site intake
- Edit job-site intake
- Post progress and media
- Mark work status changes
- Record arrival / work / break times
- Override lower-level detailer entries when needed
- Add internal notes
- View customer-visible progress link
- Update assigned booking details within allowed scope

Restrictions:
- Should not manage global promo settings
- Should not manage staff accounts unless explicitly granted
- Should not change system-wide configuration unless explicitly granted

Examples:
- Lead mobile detailer
- Trainer
- Experienced trusted operator

---

### C) Detailer
Operational field user.

Typical abilities:
- View assigned bookings
- Fill out pre-job intake
- Post progress updates
- Attach media
- Start / stop / break time tracking
- Record on-site notes
- Record owner acknowledgement details
- Submit work completion updates

Restrictions:
- Cannot override senior detailer or admin changes
- Cannot manage promos
- Cannot manage staff users
- Cannot change blocked dates / slot availability by default
- Cannot edit bookings outside their allowed scope
- Cannot see sensitive admin-only financial controls unless explicitly allowed

Examples:
- Field detailer
- Assistant detailer
- Junior team member

---

### D) Customer
Public-facing user connected to a booking or customer profile.

Typical abilities:
- View booking-specific progress page through token link
- View customer-visible progress notes
- View customer-visible media
- Submit signoff
- View status of their own booking
- Potentially log in later if account system is added

Restrictions:
- Cannot see internal notes
- Cannot see internal-only media
- Cannot see staff notes
- Cannot edit booking pricing or operational controls
- Cannot access admin pages

---

## 2) Staff role codes

Current planned role codes:
- `admin`
- `senior_detailer`
- `detailer`

These are stored in:
- `public.staff_users.role_code`

Permission booleans in `staff_users` control extra privileges:
- `can_override_lower_entries`
- `can_manage_bookings`
- `can_manage_blocks`
- `can_manage_progress`
- `can_manage_promos`
- `can_manage_staff`

This means role + permission flags can work together.

Example:
A senior detailer may normally not manage promos, but could be granted it later without redesigning the entire role system.

---

## 3) Customer tiers

Customer tiers are business/value segments, not security roles.

Current planned tier codes:
- `random`
- `regular`
- `silver`
- `gold`
- `vip`

These tiers are stored in:
- `public.customer_tiers`
- `public.customer_profiles.tier_code`
- optionally copied onto bookings as `customer_tier_code`

### Customer tier meaning
- **random**: one-off / unknown / first-time customer
- **regular**: returning customer
- **silver**: good repeat customer
- **gold**: high-value or priority customer
- **vip**: top-tier preferred customer

### Intended future uses
Customer tiers may affect:
- priority booking windows
- preferred scheduling
- loyalty offers
- manual promo logic
- customer service priority
- reminder / follow-up handling

Important:
Customer tier is **not** the same as access permission.
A VIP customer still remains a customer in the access system.

---

## 4) Override rules

### Detailer
- Can create intake and progress entries
- Can edit their own entries if editing is allowed
- Cannot override senior detailer or admin entries

### Senior Detailer
- Can override detailer-entered intake/progress/media
- Override action should be logged in `staff_override_log`

### Admin
- Can override any lower-level operational entry
- Override action should be logged in `staff_override_log`

### Override logging
Whenever a higher-trust staff member changes another staff member’s protected entry, log:
- booking id
- source table
- source row id
- previous staff user
- overriding staff user
- reason
- summary of change

---

## 5) Visibility levels

Current main visibility values:
- `customer`
- `internal`

Used in:
- `job_updates.visibility`
- `job_media.visibility`

### Customer visibility
Visible to:
- customer progress page
- admin
- appropriate staff

### Internal visibility
Visible to:
- admin
- permitted staff only

Never visible to customer progress page.

---

## 6) Booking access model

### Admin
Can access all bookings.

### Senior Detailer
Should be able to access:
- assigned bookings
- optionally unassigned bookings if granted
- bookings they are supervising

### Detailer
Should be able to access:
- assigned bookings only
- maybe temporarily shared bookings if explicitly assigned

### Customer
Can access:
- only the booking tied to their progress token or future account link

---

## 7) Job-site intake ownership

The `jobsite_intake` record belongs to:
- one booking
- usually one active detailer or senior detailer session
- but may later be updated by a higher role

Important fields:
- `detailer_name`
- `last_updated_by_staff_user_id`

Future rule:
- track who last edited intake
- prevent silent overwrites by lower-trust users

---

## 8) Time tracking access

Planned rules:
- Detailer can record arrival/start/stop/break
- Senior Detailer can correct or override detailer time logs
- Admin can correct all time logs
- All overrides should be auditable

Time data should eventually support:
- arrival time
- work start time
- work stop time
- break start / stop
- weather breaks
- unscheduled breaks
- total paid work time
- total paused time

---

## 9) Live progress model

As a job runs:
- Detailer posts progress notes
- Detailer attaches photos/media
- Customer sees customer-visible items
- Admin sees everything
- Senior Detailer sees assigned and permitted jobs
- Internal notes never appear on customer page

This should support:
- real-time admin visibility
- customer visibility
- field updates without exposing internal details publicly

---

## 10) Future authentication path

Current state:
- admin pages use shared admin password in page/API flow
- customer progress uses token link

Future recommended direction:
- staff login system
- role-based session management
- customer login / profile access
- per-user audit trail
- per-action authorization checks
- token + session hybrid for customer progress

### Recommended implementation order
1. keep shared admin password working
2. add staff user records
3. add staff login/session layer
4. enforce role-based page/API access
5. add customer profile/account layer later

---

## 11) Practical development rules

When building future pages/endpoints:

### Rule 1
Never assume all staff are admins.

### Rule 2
Never expose internal notes or internal media to customer pages.

### Rule 3
Customer tier is business segmentation, not staff privilege.

### Rule 4
Any override by a higher role should be auditable.

### Rule 5
Assigned detailers should only see the bookings they are supposed to work on unless explicitly granted wider access.

### Rule 6
Do not remove the current token-based customer progress system while building staff authentication.

### Rule 7
Prefer additive changes over destructive rewrites.

---

## 12) Immediate next implementation targets

After this document, the best next build steps are:

1. create `admin-staff.html`
2. create `/functions/api/admin/staff_list.js`
3. create `/functions/api/admin/staff_save.js`
4. update job-site intake save/load to include `staff_user_id`
5. add role-aware restriction checks to admin/jobsite/progress endpoints
6. build time-tracking tables and endpoints
7. build live job-site dashboard view for admin

---

## 13) Summary

This system has three main layers:

### Staff permissions
Who can do operational work and who can override it

### Customer visibility
What the customer can see during booking progress

### Customer business tier
How valuable / recurring the customer is from a service and loyalty perspective

These must remain separate concepts so the system stays clean and flexible.
