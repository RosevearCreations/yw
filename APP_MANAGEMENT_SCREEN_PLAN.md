> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.
# Rosie Dazzlers — App Management Screen Plan

This document captures the current split between Customer, Detailer, Senior Detailer, and Admin screens.

## Current policy
- Blocking time is Admin-only.
- Staff management is Admin-only.
- Manual schedule changes should remain Admin-only for now.
- Customer garage is self-managed by the client, but Admin can review it.
- Customer private admin notes should not be visible to detailers.
- Detailer private admin notes should not be visible to other detailers.

## Screen direction

### Customer
- garage of vehicles
- per-vehicle preferences
- live updates / progress thread
- booking history
- gift certificates and redemption history

### Detailer
- assigned-job workspace
- observation thread posting
- customer-facing notes only where allowed
- personal profile, hours, payout/tip history

### Admin
- everything detailers see where appropriate
- plus private notes
- plus role/pay/supervisor fields
- plus app management and time blocking


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
