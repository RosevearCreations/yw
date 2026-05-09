-- 068_journal_sync_exceptions_and_upload_failure_fallback.sql
-- Adds:
-- 1) journal sync exception tracking for stale/unbalanced/missing-entry source batches
-- 2) upload failure logs for field photo/file fallback visibility
-- 3) rollup visibility so Admin can review sync and upload exceptions without digging into raw rows

create extension if not exists pgcrypto;

create table if not exists public.gl_journal_sync_exceptions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.gl_journal_batches(id) on delete cascade,
  source_record_type text,
  source_record_id uuid,
  exception_type text not null,
  severity text not null default 'warning',
  exception_status text not null default 'open',
  title text,
  details text,
  detected_snapshot jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, exception_type),
  check (severity in ('info','warning','error')),
  check (exception_status in ('open','resolved','dismissed'))
);

create table if not exists public.field_upload_failures (
  id uuid primary key default gen_random_uuid(),
  failure_scope text not null default 'job_comment_attachment',
  linked_record_type text,
  linked_record_id text,
  job_id bigint,
  comment_id uuid,
  signout_id bigint,
  file_name text,
  content_type text,
  file_size_bytes bigint,
  storage_bucket text,
  storage_path text,
  failure_stage text not null default 'upload',
  failure_reason text,
  retry_status text not null default 'pending',
  client_context jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  check (failure_scope in ('job_comment_attachment','equipment_evidence','route_execution_attachment','hse_proof','general')),
  check (failure_stage in ('validation','lookup','upload','signed_url','metadata_insert','cleanup','network','unknown')),
  check (retry_status in ('pending','retrying','resolved','abandoned'))
);

create index if not exists idx_gl_journal_sync_exceptions_batch_id on public.gl_journal_sync_exceptions(batch_id, exception_status, severity);
create index if not exists idx_field_upload_failures_scope on public.field_upload_failures(failure_scope, retry_status, created_at desc);
create index if not exists idx_field_upload_failures_job_id on public.field_upload_failures(job_id, created_at desc);
create index if not exists idx_field_upload_failures_comment_id on public.field_upload_failures(comment_id, created_at desc);
create index if not exists idx_field_upload_failures_signout_id on public.field_upload_failures(signout_id, created_at desc);

create or replace function public.ywi_before_gl_journal_sync_exception()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if coalesce(new.exception_status, 'open') <> 'open' and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if coalesce(new.exception_status, 'open') = 'open' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_gl_journal_sync_exception on public.gl_journal_sync_exceptions;
create trigger trg_ywi_before_gl_journal_sync_exception
before insert or update on public.gl_journal_sync_exceptions
for each row execute function public.ywi_before_gl_journal_sync_exception();

create or replace function public.ywi_before_field_upload_failure()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if coalesce(new.retry_status, 'pending') in ('resolved','abandoned') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  if coalesce(new.retry_status, 'pending') not in ('resolved','abandoned') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_field_upload_failure on public.field_upload_failures;
create trigger trg_ywi_before_field_upload_failure
before insert or update on public.field_upload_failures
for each row execute function public.ywi_before_field_upload_failure();

create or replace function public.ywi_upsert_journal_sync_exception(
  p_batch_id uuid,
  p_exception_type text,
  p_is_present boolean,
  p_severity text default 'warning',
  p_title text default null,
  p_details text default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  v_batch public.gl_journal_batches%rowtype;
begin
  if p_batch_id is null or coalesce(p_exception_type, '') = '' then
    return;
  end if;

  select *
    into v_batch
  from public.gl_journal_batches
  where id = p_batch_id;

  if not found then
    return;
  end if;

  if coalesce(p_is_present, false) then
    insert into public.gl_journal_sync_exceptions (
      batch_id,
      source_record_type,
      source_record_id,
      exception_type,
      severity,
      exception_status,
      title,
      details,
      detected_snapshot,
      detected_at,
      last_seen_at,
      resolved_at,
      resolved_by_profile_id,
      resolution_notes,
      created_at,
      updated_at
    ) values (
      v_batch.id,
      v_batch.source_record_type,
      v_batch.source_record_id,
      p_exception_type,
      coalesce(p_severity, 'warning'),
      'open',
      p_title,
      p_details,
      coalesce(p_snapshot, '{}'::jsonb),
      now(),
      now(),
      null,
      null,
      null,
      now(),
      now()
    )
    on conflict (batch_id, exception_type) do update
    set
      source_record_type = excluded.source_record_type,
      source_record_id = excluded.source_record_id,
      severity = excluded.severity,
      exception_status = 'open',
      title = excluded.title,
      details = excluded.details,
      detected_snapshot = excluded.detected_snapshot,
      last_seen_at = now(),
      resolved_at = null,
      resolved_by_profile_id = null,
      resolution_notes = null,
      updated_at = now();
  else
    update public.gl_journal_sync_exceptions
    set
      exception_status = case when exception_status = 'dismissed' then 'dismissed' else 'resolved' end,
      last_seen_at = now(),
      updated_at = now()
    where batch_id = p_batch_id
      and exception_type = p_exception_type
      and exception_status = 'open';
  end if;
end;
$$;

create or replace function public.ywi_refresh_journal_sync_exceptions(p_batch_id uuid)
returns void
language plpgsql
as $$
declare
  v_batch public.gl_journal_batches%rowtype;
begin
  if p_batch_id is null then
    return;
  end if;

  select *
    into v_batch
  from public.gl_journal_batches
  where id = p_batch_id;

  if not found then
    return;
  end if;

  perform public.ywi_upsert_journal_sync_exception(
    v_batch.id,
    'source_stale',
    coalesce(v_batch.source_generated, false) and coalesce(v_batch.source_sync_state, 'manual') = 'stale',
    case when coalesce(v_batch.batch_status, 'draft') = 'posted' then 'error' else 'warning' end,
    'Source batch drift detected',
    'The originating record changed after the draft/post cycle. Review the source record and rebuild or resolve the batch before trusting the accounting state.',
    jsonb_build_object(
      'batch_status', v_batch.batch_status,
      'source_module', v_batch.source_module,
      'source_record_type', v_batch.source_record_type,
      'source_sync_state', v_batch.source_sync_state,
      'source_synced_at', v_batch.source_synced_at
    )
  );

  perform public.ywi_upsert_journal_sync_exception(
    v_batch.id,
    'unbalanced_batch',
    not coalesce(v_batch.is_balanced, false),
    'error',
    'Journal batch is not balanced',
    'Debit and credit totals do not match. The batch must be corrected before posting.',
    jsonb_build_object(
      'line_count', v_batch.line_count,
      'debit_total', v_batch.debit_total,
      'credit_total', v_batch.credit_total,
      'is_balanced', v_batch.is_balanced
    )
  );

  perform public.ywi_upsert_journal_sync_exception(
    v_batch.id,
    'missing_entries',
    coalesce(v_batch.source_generated, false) and coalesce(v_batch.line_count, 0) <= 0,
    'error',
    'Source-generated batch has no journal entries',
    'The source batch exists but does not currently contain journal lines. Review the source record mapping before posting.',
    jsonb_build_object(
      'line_count', v_batch.line_count,
      'source_module', v_batch.source_module,
      'source_record_type', v_batch.source_record_type
    )
  );
end;
$$;

create or replace function public.ywi_after_gl_journal_batch_refresh_exceptions()
returns trigger
language plpgsql
as $$
begin
  perform public.ywi_refresh_journal_sync_exceptions(new.id);
  return new;
end;
$$;

drop trigger if exists trg_ywi_after_gl_journal_batch_refresh_exceptions on public.gl_journal_batches;
create trigger trg_ywi_after_gl_journal_batch_refresh_exceptions
after insert or update of batch_status, line_count, debit_total, credit_total, is_balanced, source_generated, source_sync_state, source_synced_at, source_record_type, source_record_id
on public.gl_journal_batches
for each row execute function public.ywi_after_gl_journal_batch_refresh_exceptions();

-- backfill current exception state
select public.ywi_refresh_journal_sync_exceptions(id) from public.gl_journal_batches;

create or replace view public.v_gl_journal_sync_exceptions as
select
  gse.id,
  gse.batch_id,
  gjb.batch_number,
  gjb.batch_status,
  gjb.source_module,
  gjb.source_record_type,
  gjb.source_record_id,
  gse.exception_type,
  gse.severity,
  gse.exception_status,
  gse.title,
  gse.details,
  gse.detected_snapshot,
  gse.detected_at,
  gse.last_seen_at,
  gse.resolved_at,
  gse.resolved_by_profile_id,
  gse.resolution_notes,
  gse.created_at,
  gse.updated_at
from public.gl_journal_sync_exceptions gse
left join public.gl_journal_batches gjb on gjb.id = gse.batch_id;

create or replace view public.v_field_upload_failure_rollups as
select
  fuf.id,
  fuf.failure_scope,
  fuf.linked_record_type,
  fuf.linked_record_id,
  fuf.job_id,
  fuf.comment_id,
  fuf.signout_id,
  fuf.file_name,
  fuf.content_type,
  fuf.file_size_bytes,
  fuf.storage_bucket,
  fuf.storage_path,
  fuf.failure_stage,
  fuf.failure_reason,
  fuf.retry_status,
  fuf.client_context,
  fuf.created_by_profile_id,
  fuf.created_at,
  fuf.updated_at,
  fuf.resolved_at,
  fuf.resolved_by_profile_id,
  fuf.resolution_notes,
  extract(epoch from (now() - fuf.created_at))::bigint as age_seconds,
  j.job_code,
  jc.job_id as comment_job_id,
  es.job_id as signout_job_id
from public.field_upload_failures fuf
left join public.jobs j on j.id = fuf.job_id
left join public.job_comments jc on jc.id = fuf.comment_id
left join public.equipment_signouts es on es.id = fuf.signout_id;

create or replace view public.v_gl_journal_batch_rollups as
with exception_rollups as (
  select
    batch_id,
    count(*)::int as exception_count,
    count(*) filter (where exception_status = 'open')::int as open_exception_count,
    count(*) filter (where exception_status = 'open' and severity = 'error')::int as blocking_exception_count,
    max(last_seen_at) as last_exception_at
  from public.gl_journal_sync_exceptions
  group by batch_id
)
select
  gjb.id,
  gjb.batch_number,
  gjb.source_module,
  gjb.batch_status,
  gjb.batch_date,
  gjb.memo,
  gjb.posted_at,
  gjb.source_record_type,
  gjb.source_record_id,
  gjb.line_count,
  gjb.debit_total,
  gjb.credit_total,
  gjb.is_balanced,
  public.ywi_normalize_money(coalesce(gjb.debit_total, 0) - coalesce(gjb.credit_total, 0)) as balance_difference,
  gjb.posting_notes,
  gjb.posted_by_profile_id,
  gjb.source_generated,
  gjb.source_sync_state,
  gjb.source_synced_at,
  coalesce(er.exception_count, 0) as exception_count,
  coalesce(er.open_exception_count, 0) as open_exception_count,
  coalesce(er.blocking_exception_count, 0) as blocking_exception_count,
  er.last_exception_at
from public.gl_journal_batches gjb
left join exception_rollups er on er.batch_id = gjb.id;
