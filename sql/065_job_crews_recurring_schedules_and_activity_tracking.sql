-- 065_job_crews_recurring_schedules_and_activity_tracking.sql
-- Adds crew assignment, recurring job scheduling, and photo-capable job activity tracking.

create extension if not exists pgcrypto;

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  crew_code text unique,
  crew_name text not null unique,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  crew_status text not null default 'active',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (crew_status in ('active','inactive','archived'))
);

create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member',
  is_primary boolean not null default false,
  added_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crew_id, profile_id)
);

alter table public.jobs add column if not exists crew_id uuid references public.crews(id) on delete set null;
alter table public.jobs add column if not exists assigned_supervisor_profile_id uuid references public.profiles(id) on delete set null;
alter table public.jobs add column if not exists schedule_mode text not null default 'standalone';
alter table public.jobs add column if not exists recurrence_rule text;
alter table public.jobs add column if not exists recurrence_summary text;
alter table public.jobs add column if not exists recurrence_interval integer;
alter table public.jobs add column if not exists recurrence_anchor_date date;
alter table public.jobs add column if not exists special_instructions text;
alter table public.jobs add column if not exists last_activity_at timestamptz;

update public.jobs
set assigned_supervisor_profile_id = coalesce(assigned_supervisor_profile_id, site_supervisor_profile_id, signing_supervisor_profile_id)
where assigned_supervisor_profile_id is null;

update public.jobs
set last_activity_at = coalesce(last_activity_at, updated_at, created_at)
where last_activity_at is null;

alter table public.jobs drop constraint if exists jobs_schedule_mode_check;
alter table public.jobs
  add constraint jobs_schedule_mode_check
  check (schedule_mode in ('standalone','recurring','project_phase'));

create table if not exists public.job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  comment_type text not null default 'update',
  comment_text text not null,
  is_special_instruction boolean not null default false,
  visible_to_client boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (comment_type in ('update','photo','issue','instruction','closeout'))
);

create table if not exists public.job_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.job_comments(id) on delete cascade,
  storage_bucket text not null default 'submission-images',
  storage_path text not null,
  preview_url text,
  file_name text not null,
  content_type text,
  file_size_bytes bigint,
  attachment_kind text not null default 'photo',
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (attachment_kind in ('photo','file','document'))
);

create index if not exists idx_crews_supervisor_profile_id on public.crews(supervisor_profile_id);
create index if not exists idx_crew_members_crew_id on public.crew_members(crew_id, created_at desc);
create index if not exists idx_crew_members_profile_id on public.crew_members(profile_id);
create index if not exists idx_jobs_crew_id on public.jobs(crew_id);
create index if not exists idx_jobs_assigned_supervisor_profile_id on public.jobs(assigned_supervisor_profile_id);
create index if not exists idx_jobs_schedule_mode on public.jobs(schedule_mode);
create index if not exists idx_job_comments_job_id on public.job_comments(job_id, created_at desc);
create index if not exists idx_job_comment_attachments_comment_id on public.job_comment_attachments(comment_id, created_at desc);

create or replace view public.v_crew_directory as
select
  c.id,
  c.crew_code,
  c.crew_name,
  c.supervisor_profile_id,
  c.crew_status,
  c.notes,
  c.created_by_profile_id,
  c.created_at,
  c.updated_at,
  sup.full_name as supervisor_name,
  count(cm.id)::int as member_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'member_role', cm.member_role,
    'is_primary', cm.is_primary
  ) order by cm.is_primary desc, p.full_name) filter (where cm.id is not null), '[]'::jsonb) as members_json
from public.crews c
left join public.profiles sup on sup.id = c.supervisor_profile_id
left join public.crew_members cm on cm.crew_id = c.id
left join public.profiles p on p.id = cm.profile_id
group by c.id, sup.full_name;

create or replace view public.v_job_comment_activity as
select
  jc.id,
  jc.job_id,
  jc.work_order_id,
  jc.comment_type,
  jc.comment_text,
  jc.is_special_instruction,
  jc.visible_to_client,
  jc.created_by_profile_id,
  jc.created_at,
  jc.updated_at,
  p.full_name as created_by_name,
  count(a.id)::int as attachment_count,
  count(a.id) filter (where a.attachment_kind = 'photo')::int as photo_count
from public.job_comments jc
left join public.profiles p on p.id = jc.created_by_profile_id
left join public.job_comment_attachments a on a.comment_id = jc.id
group by jc.id, p.full_name;

create or replace view public.v_jobs_directory as
select
  j.id,
  j.job_code,
  j.job_name,
  j.site_id,
  j.job_type,
  j.status,
  j.priority,
  j.client_name,
  j.start_date,
  j.end_date,
  j.site_supervisor_profile_id,
  j.signing_supervisor_profile_id,
  j.admin_profile_id,
  j.notes,
  j.created_by_profile_id,
  j.approval_status,
  j.approval_requested_at,
  j.approved_at,
  j.approved_by_profile_id,
  j.approval_notes,
  j.created_at,
  j.updated_at,
  s.site_code,
  s.site_name,
  sup.full_name as supervisor_name,
  signsup.full_name as signing_supervisor_name,
  adm.full_name as admin_name,
  j.crew_id,
  j.assigned_supervisor_profile_id,
  j.schedule_mode,
  j.recurrence_rule,
  j.recurrence_summary,
  j.recurrence_interval,
  j.recurrence_anchor_date,
  j.special_instructions,
  j.last_activity_at,
  crew.crew_name,
  assignedsup.full_name as assigned_supervisor_name,
  coalesce(crew_rollup.member_count, 0) as crew_member_count,
  coalesce(comment_rollup.comment_count, 0) as comment_count,
  coalesce(comment_rollup.photo_count, 0) as photo_count
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join (
  select crew_id, count(*)::int as member_count
  from public.crew_members
  group by crew_id
) crew_rollup on crew_rollup.crew_id = j.crew_id
left join (
  select jc.job_id, count(*)::int as comment_count, coalesce(sum(v.photo_count), 0)::int as photo_count
  from public.job_comments jc
  left join public.v_job_comment_activity v on v.id = jc.id
  group by jc.job_id
) comment_rollup on comment_rollup.job_id = j.id;
