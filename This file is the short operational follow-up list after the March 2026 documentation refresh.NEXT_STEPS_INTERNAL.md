> Last synchronized: March 30, 2026. Reviewed during the staff-session, time-flow identity, intake/media session hardening, booking/admin shell cleanup, and docs/schema synchronization pass.

> Last synchronized: March 26, 2026. Reviewed during the booking add-on imagery, catalog autofill, low-stock reorder UI, Amazon-link intake, local SEO, and docs/schema refresh pass.
# Rosie Dazzlers — Next Steps Internal


Use this when you want the fastest answer to:
**“What should we do next?”**

---

## Immediate next priorities

### 1) Add real staff login / session handling
Current admin/detailer access still relies on a bridge model.

Need:
- real staff authentication
- session-aware admin/detailer pages
- backend trust in resolved staff identity
- less dependence on manual headers or typed names

Why first:
- role-aware backend patterns now exist
- the missing piece is real identity/session flow

---

### 2) Make all jobsite actions consistently use real staff identity
A lot of jobsite/admin flows now support staff-aware logic, but consistency still matters.

Need:
- consistent use of `staff_user_id`
- cleaner linkage for:
  - intake
  - progress
  - time
  - media
  - signoff
- less fallback reliance on typed names

Why next:
- better audit trail
- cleaner overrides
- fewer ambiguous records

---

### 3) Complete gift certificate redemption during booking
Gift purchase works, but booking-time gift redemption still needs the full loop.

Need:
- gift code validation
- remaining value lookup
- total reduction during booking
- remaining balance update
- mark fully redeemed when exhausted

Why next:
- closes a major customer-facing workflow gap

---

### 4) Unify add-on pricing/config
Add-ons still need a single canonical source.

Need:
- one structured source for add-ons
- frontend and backend reading the same values
- no pricing drift between display and checkout

Why next:
- prevents silent pricing mismatches

---

### 5) Add direct phone-friendly upload flow
Media records exist, but direct field upload still needs a proper path.

Need:
- signed upload URLs or direct storage integration
- mobile-friendly upload UX
- clean save into `job_media`

Why next:
- makes field use much more realistic
- removes friction for before/after uploads

---

### 6) Build a cleaner internal admin/detailer shell
There are now enough admin/detailer pages that navigation needs to mature.

Need:
- shared internal shell
- role-aware menu visibility
- better mobile workflow
- smoother movement between booking, progress, jobsite, live, staff, and customers

Why next:
- current pieces are strong enough to benefit from better structure

---

## Cleanup phase after that

### 7) Review older endpoints and duplicate patterns
Need:
- identify legacy shared-password-only paths
- reduce duplicate old/new patterns
- remove clearly obsolete routes once replacements are stable

### 8) Expand override logging consistency
Need:
- confirm all sensitive overwrite/delete actions write to `staff_override_log`
- make reason capture consistent

### 9) Grow customer + vehicle history
Need:
- deeper customer booking history
- future vehicle profile/history direction
- stronger repeat-customer context

### 10) Finish route cleanup
Need:
- settle canonical structure for services/pricing
- remove long-term route ambiguity

---

## What not to do next

Avoid spending the next phase on:
- adding lots of new isolated endpoints
- renaming live asset files casually
- mixing customer tiers with staff permissions
- building fancy admin UI before auth/session basics are ready
- keeping old/new admin flows in parallel longer than necessary

---

## If only one task is chosen

Pick:

**real staff login/session handling**

That is the most important next step because the backend is now strong enough to benefit from real identity and role-aware internal use.

---

## One-sentence summary

The next Rosie Dazzlers phase should focus on **real staff auth, consistent staff identity, gift redemption, upload flow, and internal workflow polish** rather than simply adding more disconnected backend pieces.