-- sql/2026-03-21_staff_tip_payouts_paid_at_compat.sql
--
-- Compatibility patch for staff_tip_payouts
--
-- Problem:
-- - some code/queries expect staff_tip_payouts.paid_at
-- - current schema uses staff_tip_payouts.payout_date
--
-- Fix:
-- - add paid_at if missing
-- - backfill it from payout_date
-- - keep payout_date intact

begin;

alter table public.staff_tip_payouts
  add column if not exists paid_at timestamptz null;

update public.staff_tip_payouts
   set paid_at = coalesce(
     paid_at,
     (payout_date::timestamp at time zone 'UTC')
   )
 where paid_at is null
   and payout_date is not null;

create index if not exists idx_staff_tip_payouts_staff_user_id_paid_at
  on public.staff_tip_payouts (staff_user_id, paid_at desc);

commit;
