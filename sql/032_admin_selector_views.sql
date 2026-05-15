-- =========================================================
-- Document 11: sql/032_admin_selector_views.sql
-- Purpose:
-- - Create helper views for admin selector/dropdown data
-- - Makes it easier to build dropdown-driven admin UI
-- - Provides readable labels for:
--   1) profiles
--   2) sites
--   3) assignments
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Profile selector view
-- ---------------------------------------------------------
create or replace view public.v_profile_selector as
select
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  trim(
    both ' ' from
    coalesce(p.full_name, '') ||
    case
      when p.full_name is not null and p.email is not null then ' — '
      else ''
    end ||
    coalesce(p.email, '')
  ) as display_label,
  trim(
    both ' ' from
    coalesce(p.full_name, '') ||
    case
      when p.full_name is not null and p.email is not null then ' — '
      else ''
    end ||
    coalesce(p.email, '') ||
    case
      when p.role is not null then ' [' || p.role || ']'
      else ''
    end ||
    case
      when p.is_active = false then ' (inactive)'
      else ''
    end
  ) as option_label
from public.profiles p
order by p.is_active desc, p.full_name nulls last, p.email nulls last;

comment on view public.v_profile_selector is
'Readable selector view for profiles used in admin dropdowns.';

-- ---------------------------------------------------------
-- 2) Site selector view
-- ---------------------------------------------------------
create or replace view public.v_site_selector as
select
  s.id,
  s.site_code,
  s.site_name,
  s.address,
  s.is_active,
  trim(
    both ' ' from
    coalesce(s.site_code, '') ||
    case
      when s.site_code is not null and s.site_name is not null then ' — '
      else ''
    end ||
    coalesce(s.site_name, '')
  ) as display_label,
  trim(
    both ' ' from
    coalesce(s.site_code, '') ||
    case
      when s.site_code is not null and s.site_name is not null then ' — '
      else ''
    end ||
    coalesce(s.site_name, '') ||
    case
      when s.is_active = false then ' (inactive)'
      else ''
    end
  ) as option_label
from public.sites s
order by s.is_active desc, s.site_code nulls last, s.site_name nulls last;

comment on view public.v_site_selector is
'Readable selector view for sites used in admin dropdowns.';

-- ---------------------------------------------------------
-- 3) Assignment selector view
-- ---------------------------------------------------------
create or replace view public.v_assignment_selector as
select
  sa.id,
  sa.site_id,
  sa.profile_id,
  sa.assignment_role,
  sa.is_primary,
  sa.created_at,
  s.site_code,
  s.site_name,
  p.email,
  p.full_name,
  p.role as profile_role,
  p.is_active as profile_is_active,
  s.is_active as site_is_active,
  trim(
    both ' ' from
    coalesce(s.site_code, '') ||
    case
      when s.site_code is not null and p.email is not null then ' — '
      else ''
    end ||
    coalesce(p.email, '')
  ) as display_label,
  trim(
    both ' ' from
    coalesce(s.site_code, '') ||
    case
      when s.site_code is not null and s.site_name is not null then ' '
      else ''
    end ||
    coalesce('(' || s.site_name || ')', '') ||
    ' — ' ||
    coalesce(p.full_name, p.email, '') ||
    case
      when sa.assignment_role is not null then ' [' || sa.assignment_role || ']'
      else ''
    end ||
    case
      when sa.is_primary then ' (primary)'
      else ''
    end
  ) as option_label
from public.site_assignments sa
join public.sites s
  on s.id = sa.site_id
join public.profiles p
  on p.id = sa.profile_id
order by sa.created_at desc, s.site_code nulls last, p.email nulls last;

comment on view public.v_assignment_selector is
'Readable selector view for assignments used in admin dropdowns.';

-- ---------------------------------------------------------
-- 4) Enable RLS dependency compatibility
-- Views inherit source-table access rules. No separate RLS.
-- ---------------------------------------------------------

-- ---------------------------------------------------------
-- 5) Grant read access to authenticated users
-- Admin UI and future helper endpoints can use these safely.
-- ---------------------------------------------------------
grant select on public.v_profile_selector to authenticated;
grant select on public.v_site_selector to authenticated;
grant select on public.v_assignment_selector to authenticated;

-- ---------------------------------------------------------
-- 6) Verification queries
-- ---------------------------------------------------------
select to_regclass('public.v_profile_selector') as profile_selector_view;
select to_regclass('public.v_site_selector') as site_selector_view;
select to_regclass('public.v_assignment_selector') as assignment_selector_view;

select * from public.v_profile_selector limit 5;
select * from public.v_site_selector limit 5;
select * from public.v_assignment_selector limit 5;
