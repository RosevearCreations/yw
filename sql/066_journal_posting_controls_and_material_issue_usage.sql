-- 066_journal_posting_controls_and_material_issue_usage.sql
-- Adds explicit journal-batch posting rollups plus material issue / usage records
-- so receiving can move into job consumption and variance.

create extension if not exists pgcrypto;

alter table if exists public.gl_journal_batches
  add column if not exists source_record_type text,
  add column if not exists source_record_id uuid,
  add column if not exists line_count integer not null default 0,
  add column if not exists debit_total numeric(12,2) not null default 0,
  add column if not exists credit_total numeric(12,2) not null default 0,
  add column if not exists is_balanced boolean not null default false,
  add column if not exists posting_notes text,
  add column if not exists posted_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.gl_journal_entries
  add column if not exists line_number integer,
  add column if not exists source_record_type text,
  add column if not exists source_record_id uuid,
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.gl_journal_batches drop constraint if exists gl_journal_batches_batch_status_check;
alter table if exists public.gl_journal_batches
  add constraint gl_journal_batches_batch_status_check
  check (batch_status in ('draft','review','posted','void'));

create table if not exists public.material_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number text not null unique,
  work_order_id uuid references public.work_orders(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  issue_status text not null default 'draft',
  issue_date date not null default current_date,
  issued_by_profile_id uuid references public.profiles(id) on delete set null,
  line_count integer not null default 0,
  quantity_total numeric(12,2) not null default 0,
  issue_total numeric(12,2) not null default 0,
  estimated_material_total numeric(12,2) not null default 0,
  variance_amount numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (issue_status in ('draft','issued','partial','closed','void'))
);

create table if not exists public.material_issue_lines (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.material_issues(id) on delete cascade,
  line_order integer not null default 0,
  material_id uuid references public.materials_catalog(id) on delete set null,
  work_order_line_id uuid references public.work_order_lines(id) on delete set null,
  description text not null,
  unit_id uuid references public.units_of_measure(id) on delete set null,
  quantity numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gl_journal_entries_batch_id on public.gl_journal_entries(batch_id);
create unique index if not exists idx_gl_journal_entries_batch_line_number on public.gl_journal_entries(batch_id, line_number);
create index if not exists idx_material_issues_work_order_id on public.material_issues(work_order_id);
create index if not exists idx_material_issues_client_site_id on public.material_issues(client_site_id);
create index if not exists idx_material_issue_lines_issue_id on public.material_issue_lines(issue_id, line_order);
create index if not exists idx_material_issue_lines_material_id on public.material_issue_lines(material_id);
create index if not exists idx_material_issue_lines_work_order_line_id on public.material_issue_lines(work_order_line_id);

create or replace function public.ywi_before_gl_journal_entry()
returns trigger
language plpgsql
as $$
begin
  if new.line_number is null or new.line_number <= 0 then
    new.line_number := public.ywi_next_line_order('public.gl_journal_entries'::regclass, 'batch_id', new.batch_id, new.id);
  end if;
  new.debit_amount := public.ywi_normalize_money(coalesce(new.debit_amount, 0));
  new.credit_amount := public.ywi_normalize_money(coalesce(new.credit_amount, 0));
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_gl_journal_entry on public.gl_journal_entries;
create trigger trg_ywi_before_gl_journal_entry
before insert or update on public.gl_journal_entries
for each row execute function public.ywi_before_gl_journal_entry();

create or replace function public.ywi_sync_gl_journal_batch(p_batch_id uuid)
returns void
language plpgsql
as $$
declare
  v_line_count integer := 0;
  v_debit numeric(12,2) := 0;
  v_credit numeric(12,2) := 0;
begin
  if p_batch_id is null then
    return;
  end if;

  select
    count(*),
    coalesce(sum(debit_amount), 0),
    coalesce(sum(credit_amount), 0)
  into
    v_line_count,
    v_debit,
    v_credit
  from public.gl_journal_entries
  where batch_id = p_batch_id;

  update public.gl_journal_batches
  set
    line_count = v_line_count,
    debit_total = public.ywi_normalize_money(v_debit),
    credit_total = public.ywi_normalize_money(v_credit),
    is_balanced = (
      v_line_count > 0
      and public.ywi_normalize_money(v_debit) = public.ywi_normalize_money(v_credit)
    ),
    updated_at = now()
  where id = p_batch_id;
end;
$$;

create or replace function public.ywi_after_gl_journal_entry_sync()
returns trigger
language plpgsql
as $$
begin
  perform public.ywi_sync_gl_journal_batch(coalesce(new.batch_id, old.batch_id));
  if tg_op = 'UPDATE' and new.batch_id is distinct from old.batch_id then
    perform public.ywi_sync_gl_journal_batch(old.batch_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ywi_after_gl_journal_entry_sync on public.gl_journal_entries;
create trigger trg_ywi_after_gl_journal_entry_sync
after insert or update or delete on public.gl_journal_entries
for each row execute function public.ywi_after_gl_journal_entry_sync();

create or replace view public.v_gl_journal_batch_rollups as
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
  gjb.posted_by_profile_id
from public.gl_journal_batches gjb;

create or replace function public.ywi_before_material_issue_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.material_issue_lines'::regclass, 'issue_id', new.issue_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_normalize_money(coalesce(new.unit_cost, 0));
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_cost, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_material_issue_line on public.material_issue_lines;
create trigger trg_ywi_before_material_issue_line
before insert or update on public.material_issue_lines
for each row execute function public.ywi_before_material_issue_line();

create or replace function public.ywi_sync_material_issue(p_issue_id uuid)
returns void
language plpgsql
as $$
declare
  v_work_order_id uuid;
  v_line_count integer := 0;
  v_qty numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_estimated numeric(12,2) := 0;
begin
  if p_issue_id is null then
    return;
  end if;

  select work_order_id into v_work_order_id
  from public.material_issues
  where id = p_issue_id;

  select
    count(*),
    coalesce(sum(quantity), 0),
    coalesce(sum(line_total), 0)
  into
    v_line_count,
    v_qty,
    v_total
  from public.material_issue_lines
  where issue_id = p_issue_id;

  if v_work_order_id is not null then
    select
      coalesce(sum(
        case
          when wol.material_id is not null or lower(coalesce(wol.line_type, '')) = 'material'
            then coalesce(wol.quantity, 0) * coalesce(wol.unit_cost, 0)
          else 0
        end
      ), 0)
    into v_estimated
    from public.work_order_lines wol
    where wol.work_order_id = v_work_order_id;
  end if;

  update public.material_issues
  set
    line_count = v_line_count,
    quantity_total = public.ywi_normalize_money(v_qty),
    issue_total = public.ywi_normalize_money(v_total),
    estimated_material_total = public.ywi_normalize_money(v_estimated),
    variance_amount = public.ywi_normalize_money(v_total - v_estimated),
    updated_at = now()
  where id = p_issue_id;
end;
$$;

create or replace function public.ywi_after_material_issue_line_sync()
returns trigger
language plpgsql
as $$
begin
  perform public.ywi_sync_material_issue(coalesce(new.issue_id, old.issue_id));
  if tg_op = 'UPDATE' and new.issue_id is distinct from old.issue_id then
    perform public.ywi_sync_material_issue(old.issue_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ywi_after_material_issue_line_sync on public.material_issue_lines;
create trigger trg_ywi_after_material_issue_line_sync
after insert or update or delete on public.material_issue_lines
for each row execute function public.ywi_after_material_issue_line_sync();

create or replace view public.v_material_issue_rollups as
select
  mi.id,
  mi.issue_number,
  mi.work_order_id,
  mi.client_site_id,
  mi.issue_status,
  mi.issue_date,
  mi.issued_by_profile_id,
  mi.line_count,
  mi.quantity_total,
  mi.issue_total,
  mi.estimated_material_total,
  mi.variance_amount,
  mi.notes,
  mi.created_by_profile_id,
  mi.created_at,
  mi.updated_at,
  wo.work_order_number,
  cs.site_name as client_site_name,
  p.full_name as issued_by_name
from public.material_issues mi
left join public.work_orders wo on wo.id = mi.work_order_id
left join public.client_sites cs on cs.id = mi.client_site_id
left join public.profiles p on p.id = mi.issued_by_profile_id;
