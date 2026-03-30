-- sql/2026-03-20_staff_users_password_hash.sql
--
-- Staff password hash support
--
-- What this file does:
-- - adds password_hash to public.staff_users if missing
-- - adds a lightweight email lookup index if useful for auth
--
-- Notes:
-- - this does NOT generate passwords
-- - this does NOT backfill password hashes
-- - after running this, staff accounts still need password_hash values set
-- - auth_login.js expects password_hash formats like:
--     sha256:<hex>
--   or bcrypt hashes such as:
--     $2b$...
--
-- Run this in Supabase SQL editor or your normal migration flow.

begin;

alter table public.staff_users
  add column if not exists password_hash text null;

create index if not exists idx_staff_users_email
  on public.staff_users (email);

commit;
