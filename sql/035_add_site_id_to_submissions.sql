-- =========================================================
-- Document 24 (replacement): sql/035_add_site_id_to_submissions.sql
-- Purpose:
-- - Add direct site linkage to submissions
-- - Reduce dependence on text matching of submissions.site
-- - Prepare for stronger site-based access control
--
-- This replacement safely drops/recreates dependent views.
--
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Add site_id column if missing
-- ---------------------------------------------------------
alter table public.submissions
  add column if not exists site_id bigint;

comment on column public.submissions.site_id is
'Direct foreign key reference to public.sites.id. Added to strengthen site-based access control.';

-- ---------------------------------------------------------
-- 2) Backfill site_id from submissions.site -> sites.site_code
-- ---------------------------------------------------------
update public.submissions sub
set site_id = s.id
from public.sites s
where sub.site_id is null
  and lower(trim(sub.site)) = lower(trim(s.site_code));

-- ---------------------------------------------------------
-- 3) Add foreign key if missing
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'submissions_site_id_fkey'
      and conrelid = 'public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint submissions_site_id_fkey
      foreign key (site_id)
      references public.sites(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------
-- 4) Add useful indexes
-- ---------------------------------------------------------
create index if not exists idx_submissions_site_id
  on public.submissions(site_id);

create index if not exists idx_submissions_status_date
  on public.submissions(status, date desc);

create index if not exists idx_submissions_form_type_date
  on public.submissions(form_type, date desc);

create index if not exists idx_submissions_submitted_by_profile_id
  on public.submissions(submitted_by_profile_id);

-- ---------------------------------------------------------
-- 5) Rebuild resolver/support views cleanly
-- ---------------------------------------------------------
drop view if exists public.v_submissions_missing_site_link;
drop view if exists public.v_submission_site_resolved;

create view public.v_submission_site_resolved as
select
  sub.id as submission_id,
  sub.site as submission_site_text,
  coalesce(sub.site_id::text, s.id::text) as resolved_site_id,
  coalesce(sub.site_id, s.id) as resolved_site_id_bigint,
  coalesce(s2.site_code, s.site_code) as site_code,
  coalesce(s2.site_name, s.site_name) as site_name,
  coalesce(s2.is_active, s.is_active) as is_active
from public.submissions sub
left join public.sites s2
  on s2.id = sub.site_id
left join public.sites s
  on sub.site_id is null
 and lower(trim(sub.site)) = lower(trim(s.site_code));

comment on view public.v_submission_site_resolved is
'Resolves submission site using submissions.site_id first, then falls back to matching submissions.site to sites.site_code.';

grant select on public.v_submission_site_resolved to authenticated;

create view public.v_submissions_missing_site_link as
select
  sub.id,
  sub.site,
  sub.form_type,
  sub.date,
  sub.submitted_by,
  sub.status,
  sub.created_at
from public.submissions sub
left join public.v_submission_site_resolved r
  on r.submission_id = sub.id
where r.resolved_site_id is null;

comment on view public.v_submissions_missing_site_link is
'Shows submissions that still do not resolve to a site record.';

grant select on public.v_submissions_missing_site_link to authenticated;

-- ---------------------------------------------------------
-- 6) Verification
-- ---------------------------------------------------------
select
  count(*) as submissions_total
from public.submissions;

select
  count(*) as submissions_with_site_id
from public.submissions
where site_id is not null;

select
  count(*) as submissions_unresolved
from public.v_submissions_missing_site_link;

select
  id,
  site,
  site_id
from public.submissions
order by id desc
limit 20;

select
  submission_id,
  submission_site_text,
  resolved_site_id,
  resolved_site_id_bigint,
  site_code,
  site_name
from public.v_submission_site_resolved
order by submission_id desc
limit 20;
