-- =========================================================
-- Document 20: sql/034_site_access_helpers.sql
-- Purpose:
-- - Create shared helper functions for access control
-- - Standardize role and site-permission checks
-- - Support future multi-tier security model:
--   1) admin
--   2) hse
--   3) supervisor
--   4) site_leader
--   5) worker
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Role rank helper
--    Returns numeric rank for a role string
-- ---------------------------------------------------------
create or replace function public.role_rank(input_role text)
returns integer
language sql
immutable
as $$
  select case coalesce(input_role, '')
    when 'worker' then 10
    when 'site_leader' then 20
    when 'supervisor' then 30
    when 'hse' then 40
    when 'admin' then 50
    else 0
  end;
$$;

comment on function public.role_rank(text) is
'Returns numeric rank for a role. worker=10, site_leader=20, supervisor=30, hse=40, admin=50.';

-- ---------------------------------------------------------
-- 2) Get global role rank for a profile
-- ---------------------------------------------------------
create or replace function public.profile_role_rank(input_profile_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(public.role_rank(p.role), 0)
  from public.profiles p
  where p.id = input_profile_id
    and p.is_active = true;
$$;

comment on function public.profile_role_rank(uuid) is
'Returns the active global role rank for a profile.';

-- ---------------------------------------------------------
-- 3) Get site-specific assignment role rank for a profile
-- ---------------------------------------------------------
create or replace function public.site_assignment_role_rank(
  input_profile_id uuid,
  input_site_id bigint
)
returns integer
language sql
stable
as $$
  select coalesce(max(public.role_rank(sa.assignment_role)), 0)
  from public.site_assignments sa
  join public.profiles p
    on p.id = sa.profile_id
  join public.sites s
    on s.id = sa.site_id
  where sa.profile_id = input_profile_id
    and sa.site_id = input_site_id
    and p.is_active = true
    and s.is_active = true;
$$;

comment on function public.site_assignment_role_rank(uuid, bigint) is
'Returns the highest active assignment role rank a profile has for a site.';

-- ---------------------------------------------------------
-- 4) Effective role rank for a site
--    Uses the higher of:
--    - global profile role rank
--    - site assignment role rank
-- ---------------------------------------------------------
create or replace function public.effective_site_role_rank(
  input_profile_id uuid,
  input_site_id bigint
)
returns integer
language sql
stable
as $$
  select greatest(
    coalesce(public.profile_role_rank(input_profile_id), 0),
    coalesce(public.site_assignment_role_rank(input_profile_id, input_site_id), 0)
  );
$$;

comment on function public.effective_site_role_rank(uuid, bigint) is
'Returns the effective access rank for a user at a specific site.';

-- ---------------------------------------------------------
-- 5) Can manage site?
--    supervisor and above for the site
-- ---------------------------------------------------------
create or replace function public.can_manage_site(
  input_profile_id uuid,
  input_site_id bigint
)
returns boolean
language sql
stable
as $$
  select public.effective_site_role_rank(input_profile_id, input_site_id) >= 30;
$$;

comment on function public.can_manage_site(uuid, bigint) is
'Returns true if the user can manage a site. supervisor and above.';

-- ---------------------------------------------------------
-- 6) Can review submissions for a site?
--    site_leader and above for the site
-- ---------------------------------------------------------
create or replace function public.can_review_site_submission(
  input_profile_id uuid,
  input_site_id bigint
)
returns boolean
language sql
stable
as $$
  select public.effective_site_role_rank(input_profile_id, input_site_id) >= 20;
$$;

comment on function public.can_review_site_submission(uuid, bigint) is
'Returns true if the user can review submissions for a site. site_leader and above.';

-- ---------------------------------------------------------
-- 7) Can administer system?
--    global admin only
-- ---------------------------------------------------------
create or replace function public.is_system_admin(input_profile_id uuid)
returns boolean
language sql
stable
as $$
  select public.profile_role_rank(input_profile_id) >= 50;
$$;

comment on function public.is_system_admin(uuid) is
'Returns true if the user is a global admin.';

-- ---------------------------------------------------------
-- 8) Can act as HSE?
--    hse and admin globally
-- ---------------------------------------------------------
create or replace function public.is_hse_or_admin(input_profile_id uuid)
returns boolean
language sql
stable
as $$
  select public.profile_role_rank(input_profile_id) >= 40;
$$;

comment on function public.is_hse_or_admin(uuid) is
'Returns true if the user is globally HSE or admin.';

-- ---------------------------------------------------------
-- 9) Submission-site resolver view
--    Helps connect submissions.site text to sites.id
--    Current app stores site as text, often matching site_code
-- ---------------------------------------------------------
create or replace view public.v_submission_site_resolved as
select
  sub.id as submission_id,
  sub.site as submission_site_text,
  s.id as resolved_site_id,
  s.site_code,
  s.site_name,
  s.is_active
from public.submissions sub
left join public.sites s
  on lower(trim(sub.site)) = lower(trim(s.site_code));

comment on view public.v_submission_site_resolved is
'Maps submissions.site text to sites.id when site text matches site_code.';

grant select on public.v_submission_site_resolved to authenticated;

-- ---------------------------------------------------------
-- 10) Submission access helper
--     A worker can always access own submission.
--     Otherwise use site-based rank.
-- ---------------------------------------------------------
create or replace function public.can_access_submission(
  input_profile_id uuid,
  input_submission_id bigint
)
returns boolean
language plpgsql
stable
as $$
declare
  v_owner uuid;
  v_site_id bigint;
  v_rank integer;
begin
  select s.submitted_by_profile_id
    into v_owner
  from public.submissions s
  where s.id = input_submission_id;

  if v_owner is null then
    return false;
  end if;

  if v_owner = input_profile_id then
    return true;
  end if;

  select r.resolved_site_id
    into v_site_id
  from public.v_submission_site_resolved r
  where r.submission_id = input_submission_id;

  if v_site_id is null then
    -- fallback: only elevated global roles can access unresolved site submissions
    return public.profile_role_rank(input_profile_id) >= 40;
  end if;

  v_rank := public.effective_site_role_rank(input_profile_id, v_site_id);
  return v_rank >= 20;
end;
$$;

comment on function public.can_access_submission(uuid, bigint) is
'Returns true if user owns the submission or has site_leader+ access for its site.';

-- ---------------------------------------------------------
-- 11) Submission review helper
--     site_leader+ can review site submissions
--     unresolved site falls back to hse/admin
-- ---------------------------------------------------------
create or replace function public.can_review_submission(
  input_profile_id uuid,
  input_submission_id bigint
)
returns boolean
language plpgsql
stable
as $$
declare
  v_site_id bigint;
  v_rank integer;
begin
  select r.resolved_site_id
    into v_site_id
  from public.v_submission_site_resolved r
  where r.submission_id = input_submission_id;

  if v_site_id is null then
    return public.profile_role_rank(input_profile_id) >= 40;
  end if;

  v_rank := public.effective_site_role_rank(input_profile_id, v_site_id);
  return v_rank >= 20;
end;
$$;

comment on function public.can_review_submission(uuid, bigint) is
'Returns true if user has site_leader+ for the submission site, or hse/admin fallback for unresolved site.';

-- ---------------------------------------------------------
-- 12) Verification
-- ---------------------------------------------------------
select public.role_rank('worker') as worker_rank,
       public.role_rank('site_leader') as site_leader_rank,
       public.role_rank('supervisor') as supervisor_rank,
       public.role_rank('hse') as hse_rank,
       public.role_rank('admin') as admin_rank;

select to_regclass('public.v_submission_site_resolved') as submission_site_resolved_view;
