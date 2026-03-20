# Rosie Dazzlers — Development Roadmap

This is the updated next-build order after the recent admin, security, jobsite, customer, staff, promo, and booking operations work on the `dev` branch.

---

## Current state

Already built or substantially advanced:

- booking + Stripe deposit flow
- gift certificate purchase flow
- admin booking management foundation
- date / slot block system
- token-based progress flow
- customer signoff foundation
- jobsite intake foundation
- time tracking foundation
- media handling foundation
- live monitor foundation
- staff management foundation
- customer profiles / tiers foundation
- role-aware admin/detailer API foundation across many endpoints

---

## What changed recently

The project is no longer only documenting roles.  
A large part of the API surface is now being moved toward real role-aware enforcement.

That includes patterns for:

- booking assignment
- progress post/list/detail/delete
- jobsite save/list/detail/delete
- time save/list/delete
- media save/list/delete
- signoff save/list/delete
- staff detail / active toggle / assignable list
- customer list / detail / save / delete
- customer tier list / save / delete
- promo list / detail / save / toggle / delete
- booking save / detail / search / confirm / complete / cancel / delete
- dashboard / live / day schedule style operational views

This means the next phase should focus less on adding raw endpoint count and more on finishing the missing higher-level workflow pieces cleanly.

---

## Next 10 upgrades in order

### 1) Add real staff login / session handling

The API is now far enough along that shared `ADMIN_PASSWORD` should become a temporary bridge only.

Next step:
- introduce real staff authentication
- issue staff session identity to admin/detailer pages
- remove dependence on typed headers for routine staff use

Goal:
- realistic phone/tablet field use
- clearer role enforcement
- safer admin tools

---

### 2) Connect jobsite actions to real staff users everywhere

The direction is already in place, but some older paths still rely on typed names or legacy patterns.

Next step:
- ensure all intake, progress, media, time, signoff, and assignment flows consistently use staff user identity
- reduce fallback reliance on typed display names

Goal:
- cleaner audit trail
- cleaner override handling
- fewer ambiguous records

---

### 3) Complete gift certificate redemption during booking

Gift purchase works, but booking-time redemption still needs to be fully closed.

Required:
- validate gift code
- read remaining balance
- apply to booking subtotal/total
- update certificate balance
- mark fully redeemed when appropriate

Goal:
- full customer checkout loop for gifts

---

### 4) Unify add-on pricing and config

Add-ons still need one canonical source across:
- frontend selection
- booking pricing display
- checkout validation
- Stripe session creation

Recommended direction:
- keep one canonical structured source in JSON
- read from that source on both frontend and backend

Goal:
- eliminate price drift
- eliminate duplicate add-on logic

---

### 5) Add direct file upload from phone

Media posting currently supports records and URLs, but direct upload flow is still a next-phase feature.

Required:
- signed upload URL flow or direct storage integration
- mobile-friendly upload UX
- save returned media reference into `job_media`

Goal:
- real before/after field uploads
- damage documentation
- cleaner progress updates from the field

---

### 6) Expand the jobsite page into the main detailer workspace

The building blocks now exist, but detailers still risk being spread across multiple admin pages.

Next step:
- make `/admin-jobsite` the primary working screen for assigned detailers
- surface intake, progress, time, media, and signoff from one place
- reduce need to bounce between separate admin tools during a live job

Goal:
- faster field workflow
- cleaner mobile UX
- less operator confusion

---

### 7) Build a role-aware internal app shell

There are now enough admin/detailer pages that navigation needs to mature.

Next step:
- create a shared internal shell/layout
- show menu items based on role
- hide irrelevant tools from lower roles
- improve mobile-first usability

Goal:
- turn separate admin pages into a more coherent operations app

---

### 8) Strengthen override logging in all sensitive update flows

The override foundation is present, but it should be consistently applied everywhere risky changes happen.

Next step:
- review all overwrite/delete paths
- ensure senior/admin overrides write to `staff_override_log`
- make reason capture consistent where appropriate

Goal:
- better accountability
- better audit trail
- easier troubleshooting later

---

### 9) Add customer + vehicle history view

Customer profiles now exist, but long-term service history is still thin.

Next step:
- link customer to prior bookings more deeply
- add vehicle history direction
- show prior services, signoffs, notes, and tier context

Goal:
- repeat-customer operations
- better upsell/service continuity
- stronger business memory

---

### 10) Clean up legacy and duplicate endpoint patterns

As the newer role-aware layer becomes dominant, older admin patterns should be reduced.

Next step:
- identify outdated shared-password-only endpoints
- consolidate duplicate naming
- remove clearly obsolete paths once replacements are live

Goal:
- less confusion
- lower maintenance burden
- cleaner backend map

---

## Keep avoiding

- breaking working JSON keys
- renaming live asset filenames without audit
- replacing whole systems when smaller additive changes work
- mixing customer tiers with security roles
- keeping parallel “old vs new” admin logic longer than necessary
- adding UI complexity before auth/session basics are ready

---

## Short practical priority list

If development continues in the most logical order, the next priorities should be:

1. real staff login/session
2. consistent real staff identity across jobsite actions
3. gift redemption in booking
4. unified add-on definitions
5. direct mobile upload flow
6. role-aware internal admin/detailer shell

---

## One-sentence roadmap summary

The `dev` branch has largely finished the **role-aware backend foundation**, so the next phase is to turn it into a **real staff-operated internal app** with proper auth, direct uploads, unified pricing logic, and smoother detailer workflow.
