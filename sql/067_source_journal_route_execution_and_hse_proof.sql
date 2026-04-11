-- 067_source_journal_route_execution_and_hse_proof.sql
-- Adds:
-- 1) source-generated draft journal batches from AR/AP/receiving/usage events
-- 2) route-stop execution lifecycle records with note/photo attachment rows
-- 3) HSE proof rows plus reopen-aware packet workflow

create extension if not exists pgcrypto;

insert into public.chart_of_accounts (account_number, account_name, account_type, system_code)
values
  ('2050', 'Inventory / Receipt Clearing', 'liability', 'inventory_clearing')
on conflict (account_number) do update
set
  account_name = excluded.account_name,
  account_type = excluded.account_type,
  system_code = excluded.system_code;

alter table if exists public.gl_journal_batches
  add column if not exists source_generated boolean not null default false,
  add column if not exists source_sync_state text not null default 'manual',
  add column if not exists source_synced_at timestamptz;

alter table if exists public.gl_journal_batches drop constraint if exists gl_journal_batches_source_sync_state_check;
alter table if exists public.gl_journal_batches
  add constraint gl_journal_batches_source_sync_state_check
  check (source_sync_state in ('manual','drafted','posted','stale'));

create table if not exists public.route_stop_executions (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references public.route_stops(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  execution_date date not null default current_date,
  execution_sequence integer not null default 1,
  execution_status text not null default 'planned',
  started_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  delay_minutes integer not null default 0,
  special_instructions_acknowledged boolean not null default false,
  notes text,
  exception_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (execution_status in ('planned','in_progress','completed','skipped','delayed','cancelled')),
  check (execution_sequence > 0),
  check (delay_minutes >= 0),
  unique(route_stop_id, execution_date, execution_sequence)
);

create table if not exists public.route_stop_execution_attachments (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.route_stop_executions(id) on delete cascade,
  attachment_kind text not null default 'photo',
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  public_url text,
  caption text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (attachment_kind in ('photo','file','signature','document'))
);

alter table if exists public.linked_hse_packets
  add column if not exists reopen_in_progress boolean not null default false,
  add column if not exists reopen_count integer not null default 0,
  add column if not exists last_reopened_at timestamptz,
  add column if not exists last_reopened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopen_reason text;

create table if not exists public.hse_packet_proofs (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.linked_hse_packets(id) on delete cascade,
  proof_kind text not null default 'photo',
  proof_stage text not null default 'field',
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  public_url text,
  caption text,
  proof_notes text,
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proof_kind in ('photo','file','signature','document')),
  check (proof_stage in ('field','closeout','reopen','exception'))
);

create index if not exists idx_route_stop_executions_route_stop_id on public.route_stop_executions(route_stop_id, execution_date desc);
create index if not exists idx_route_stop_executions_route_id on public.route_stop_executions(route_id, execution_date desc);
create index if not exists idx_route_stop_execution_attachments_execution_id on public.route_stop_execution_attachments(execution_id, created_at desc);
create index if not exists idx_hse_packet_proofs_packet_id on public.hse_packet_proofs(packet_id, created_at desc);
create index if not exists idx_hse_packet_proofs_kind on public.hse_packet_proofs(proof_kind, proof_stage);

create or replace function public.ywi_get_account_id(p_system_code text)
returns uuid
language sql
stable
as $$
  select coa.id
  from public.chart_of_accounts coa
  where lower(coalesce(coa.system_code, '')) = lower(coalesce(p_system_code, ''))
    and coalesce(coa.is_active, true)
  order by coa.account_number
  limit 1
$$;

create or replace function public.ywi_source_batch_number(p_source_module text, p_source_record_id uuid)
returns text
language sql
immutable
as $$
  select 'AUTO-' || upper(left(regexp_replace(coalesce(p_source_module, 'src'), '[^a-zA-Z0-9]+', '', 'g'), 4)) || '-' || upper(substr(replace(coalesce(p_source_record_id::text, '00000000-0000-0000-0000-000000000000'), '-', ''), 1, 12))
$$;

create or replace function public.ywi_drop_source_journal_batch(p_source_record_type text, p_source_record_id uuid)
returns void
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_status text;
begin
  if p_source_record_id is null or coalesce(p_source_record_type, '') = '' then
    return;
  end if;

  select gjb.id, gjb.batch_status
    into v_batch_id, v_status
  from public.gl_journal_batches gjb
  where gjb.source_record_type = p_source_record_type
    and gjb.source_record_id = p_source_record_id
  order by gjb.created_at desc
  limit 1;

  if v_batch_id is null then
    return;
  end if;

  if coalesce(v_status, 'draft') = 'posted' then
    update public.gl_journal_batches
    set
      source_sync_state = 'stale',
      source_synced_at = now(),
      updated_at = now()
    where id = v_batch_id;
    return;
  end if;

  delete from public.gl_journal_entries where batch_id = v_batch_id;
  delete from public.gl_journal_batches where id = v_batch_id;
end;
$$;

create or replace function public.ywi_sync_source_journal_batch(
  p_source_module text,
  p_source_record_type text,
  p_source_record_id uuid,
  p_batch_date date,
  p_memo text,
  p_entries jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_existing_status text;
  v_line_number integer := 10;
  v_entry jsonb;
begin
  if p_source_record_id is null or coalesce(p_source_record_type, '') = '' then
    return null;
  end if;

  select gjb.id, gjb.batch_status
    into v_batch_id, v_existing_status
  from public.gl_journal_batches gjb
  where gjb.source_record_type = p_source_record_type
    and gjb.source_record_id = p_source_record_id
  order by gjb.created_at desc
  limit 1;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    perform public.ywi_drop_source_journal_batch(p_source_record_type, p_source_record_id);
    return null;
  end if;

  if v_batch_id is null then
    insert into public.gl_journal_batches (
      batch_number,
      source_module,
      batch_status,
      batch_date,
      memo,
      source_record_type,
      source_record_id,
      source_generated,
      source_sync_state,
      source_synced_at,
      created_at,
      updated_at
    ) values (
      public.ywi_source_batch_number(p_source_module, p_source_record_id),
      coalesce(p_source_module, 'operations'),
      'draft',
      coalesce(p_batch_date, current_date),
      p_memo,
      p_source_record_type,
      p_source_record_id,
      true,
      'drafted',
      now(),
      now(),
      now()
    )
    returning id into v_batch_id;
  else
    if coalesce(v_existing_status, 'draft') = 'posted' then
      update public.gl_journal_batches
      set
        source_generated = true,
        source_sync_state = 'stale',
        source_synced_at = now(),
        updated_at = now()
      where id = v_batch_id;
      return v_batch_id;
    end if;

    update public.gl_journal_batches
    set
      source_module = coalesce(p_source_module, source_module),
      batch_status = 'draft',
      batch_date = coalesce(p_batch_date, batch_date),
      memo = p_memo,
      source_generated = true,
      source_sync_state = 'drafted',
      source_synced_at = now(),
      updated_at = now()
    where id = v_batch_id;

    delete from public.gl_journal_entries where batch_id = v_batch_id;
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if nullif(v_entry ->> 'account_id', '') is null then
      continue;
    end if;

    insert into public.gl_journal_entries (
      batch_id,
      line_number,
      entry_date,
      account_id,
      debit_amount,
      credit_amount,
      client_id,
      work_order_id,
      dispatch_id,
      source_record_type,
      source_record_id,
      memo,
      created_by_profile_id
    ) values (
      v_batch_id,
      v_line_number,
      coalesce(p_batch_date, current_date),
      nullif(v_entry ->> 'account_id', '')::uuid,
      coalesce(nullif(v_entry ->> 'debit_amount', '')::numeric, 0),
      coalesce(nullif(v_entry ->> 'credit_amount', '')::numeric, 0),
      nullif(v_entry ->> 'client_id', '')::uuid,
      nullif(v_entry ->> 'work_order_id', '')::uuid,
      nullif(v_entry ->> 'dispatch_id', '')::uuid,
      p_source_record_type,
      p_source_record_id,
      coalesce(nullif(v_entry ->> 'memo', ''), p_memo),
      null
    );

    v_line_number := v_line_number + 10;
  end loop;

  perform public.ywi_sync_gl_journal_batch(v_batch_id);
  return v_batch_id;
end;
$$;

create or replace function public.ywi_sync_ar_invoice_journal(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_invoice record;
  v_ar_account uuid;
  v_revenue_account uuid;
  v_tax_account uuid;
  v_work_type text;
  v_entries jsonb := '[]'::jsonb;
  v_subtotal numeric(12,2) := 0;
begin
  if p_invoice_id is null then
    return;
  end if;

  select ai.*, wo.work_type
    into v_invoice
  from public.ar_invoices ai
  left join public.work_orders wo on wo.id = ai.work_order_id
  where ai.id = p_invoice_id;

  if not found or coalesce(v_invoice.invoice_status, 'draft') in ('draft', 'void') or coalesce(v_invoice.total_amount, 0) <= 0 then
    perform public.ywi_drop_source_journal_batch('ar_invoice', p_invoice_id);
    return;
  end if;

  v_ar_account := public.ywi_get_account_id('ar');
  v_work_type := lower(coalesce(v_invoice.work_type, ''));
  if v_invoice.dispatch_id is not null then
    v_revenue_account := public.ywi_get_account_id('revenue_dispatch');
  elsif v_work_type in ('project', 'construction', 'project_support') then
    v_revenue_account := public.ywi_get_account_id('revenue_project');
  else
    v_revenue_account := public.ywi_get_account_id('revenue_landscape');
  end if;
  v_tax_account := public.ywi_get_account_id('tax_payable');
  v_subtotal := public.ywi_normalize_money(coalesce(v_invoice.subtotal, v_invoice.total_amount) - coalesce(v_invoice.tax_total, 0));

  if v_ar_account is null or v_revenue_account is null then
    perform public.ywi_drop_source_journal_batch('ar_invoice', p_invoice_id);
    return;
  end if;

  v_entries := v_entries || jsonb_build_array(
    jsonb_build_object(
      'account_id', v_ar_account,
      'debit_amount', public.ywi_normalize_money(v_invoice.total_amount),
      'memo', 'Auto draft from AR invoice',
      'client_id', v_invoice.client_id,
      'work_order_id', v_invoice.work_order_id,
      'dispatch_id', v_invoice.dispatch_id
    ),
    jsonb_build_object(
      'account_id', v_revenue_account,
      'credit_amount', v_subtotal,
      'memo', 'Auto draft revenue from AR invoice',
      'client_id', v_invoice.client_id,
      'work_order_id', v_invoice.work_order_id,
      'dispatch_id', v_invoice.dispatch_id
    )
  );

  if coalesce(v_invoice.tax_total, 0) > 0 and v_tax_account is not null then
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'account_id', v_tax_account,
        'credit_amount', public.ywi_normalize_money(v_invoice.tax_total),
        'memo', 'Auto draft tax from AR invoice',
        'client_id', v_invoice.client_id,
        'work_order_id', v_invoice.work_order_id,
        'dispatch_id', v_invoice.dispatch_id
      )
    );
  end if;

  perform public.ywi_sync_source_journal_batch(
    'ar',
    'ar_invoice',
    p_invoice_id,
    v_invoice.invoice_date,
    'Auto draft from AR invoice ' || coalesce(v_invoice.invoice_number, p_invoice_id::text),
    v_entries
  );
end;
$$;

create or replace function public.ywi_sync_ap_bill_journal(p_bill_id uuid)
returns void
language plpgsql
as $$
declare
  v_bill record;
  v_ap_account uuid;
  v_clearing_account uuid;
  v_entries jsonb := '[]'::jsonb;
begin
  if p_bill_id is null then
    return;
  end if;

  select ab.*
    into v_bill
  from public.ap_bills ab
  where ab.id = p_bill_id;

  if not found or coalesce(v_bill.bill_status, 'draft') in ('draft', 'void') or coalesce(v_bill.total_amount, 0) <= 0 then
    perform public.ywi_drop_source_journal_batch('ap_bill', p_bill_id);
    return;
  end if;

  v_ap_account := public.ywi_get_account_id('ap');
  v_clearing_account := public.ywi_get_account_id('inventory_clearing');

  if v_ap_account is null or v_clearing_account is null then
    perform public.ywi_drop_source_journal_batch('ap_bill', p_bill_id);
    return;
  end if;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_clearing_account,
      'debit_amount', public.ywi_normalize_money(v_bill.total_amount),
      'memo', 'Auto draft clearing from AP bill'
    ),
    jsonb_build_object(
      'account_id', v_ap_account,
      'credit_amount', public.ywi_normalize_money(v_bill.total_amount),
      'memo', 'Auto draft liability from AP bill'
    )
  );

  perform public.ywi_sync_source_journal_batch(
    'ap',
    'ap_bill',
    p_bill_id,
    v_bill.bill_date,
    'Auto draft from AP bill ' || coalesce(v_bill.bill_number, p_bill_id::text),
    v_entries
  );
end;
$$;

create or replace function public.ywi_sync_material_receipt_journal(p_receipt_id uuid)
returns void
language plpgsql
as $$
declare
  v_receipt record;
  v_inventory_account uuid;
  v_clearing_account uuid;
  v_total numeric(12,2);
  v_entries jsonb := '[]'::jsonb;
begin
  if p_receipt_id is null then
    return;
  end if;

  select mr.*
    into v_receipt
  from public.material_receipts mr
  where mr.id = p_receipt_id;

  if not found then
    perform public.ywi_drop_source_journal_batch('material_receipt', p_receipt_id);
    return;
  end if;

  select coalesce(sum(mrl.line_total), 0)
    into v_total
  from public.material_receipt_lines mrl
  where mrl.receipt_id = p_receipt_id;

  if coalesce(v_receipt.receipt_status, 'draft') in ('draft') or public.ywi_normalize_money(v_total) <= 0 then
    perform public.ywi_drop_source_journal_batch('material_receipt', p_receipt_id);
    return;
  end if;

  v_inventory_account := public.ywi_get_account_id('inventory');
  v_clearing_account := public.ywi_get_account_id('inventory_clearing');

  if v_inventory_account is null or v_clearing_account is null then
    perform public.ywi_drop_source_journal_batch('material_receipt', p_receipt_id);
    return;
  end if;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_inventory_account,
      'debit_amount', public.ywi_normalize_money(v_total),
      'memo', 'Auto draft inventory from material receipt',
      'work_order_id', v_receipt.work_order_id
    ),
    jsonb_build_object(
      'account_id', v_clearing_account,
      'credit_amount', public.ywi_normalize_money(v_total),
      'memo', 'Auto draft clearing from material receipt',
      'work_order_id', v_receipt.work_order_id
    )
  );

  perform public.ywi_sync_source_journal_batch(
    'receiving',
    'material_receipt',
    p_receipt_id,
    v_receipt.receipt_date,
    'Auto draft from material receipt ' || coalesce(v_receipt.receipt_number, p_receipt_id::text),
    v_entries
  );
end;
$$;

create or replace function public.ywi_sync_material_issue_journal(p_issue_id uuid)
returns void
language plpgsql
as $$
declare
  v_issue record;
  v_inventory_account uuid;
  v_expense_account uuid;
  v_entries jsonb := '[]'::jsonb;
begin
  if p_issue_id is null then
    return;
  end if;

  select mi.*
    into v_issue
  from public.material_issues mi
  where mi.id = p_issue_id;

  if not found or coalesce(v_issue.issue_status, 'draft') in ('draft', 'void') or coalesce(v_issue.issue_total, 0) <= 0 then
    perform public.ywi_drop_source_journal_batch('material_issue', p_issue_id);
    return;
  end if;

  v_inventory_account := public.ywi_get_account_id('inventory');
  v_expense_account := public.ywi_get_account_id('expense_materials');

  if v_inventory_account is null or v_expense_account is null then
    perform public.ywi_drop_source_journal_batch('material_issue', p_issue_id);
    return;
  end if;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'account_id', v_expense_account,
      'debit_amount', public.ywi_normalize_money(v_issue.issue_total),
      'memo', 'Auto draft material usage expense',
      'work_order_id', v_issue.work_order_id
    ),
    jsonb_build_object(
      'account_id', v_inventory_account,
      'credit_amount', public.ywi_normalize_money(v_issue.issue_total),
      'memo', 'Auto draft inventory relief from material issue',
      'work_order_id', v_issue.work_order_id
    )
  );

  perform public.ywi_sync_source_journal_batch(
    'operations',
    'material_issue',
    p_issue_id,
    v_issue.issue_date,
    'Auto draft from material issue ' || coalesce(v_issue.issue_number, p_issue_id::text),
    v_entries
  );
end;
$$;

create or replace function public.ywi_after_ar_invoice_journal_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ywi_drop_source_journal_batch('ar_invoice', old.id);
    return old;
  end if;
  perform public.ywi_sync_ar_invoice_journal(new.id);
  return new;
end;
$$;

drop trigger if exists trg_ywi_after_ar_invoice_journal_sync on public.ar_invoices;
create trigger trg_ywi_after_ar_invoice_journal_sync
after insert or update or delete on public.ar_invoices
for each row execute function public.ywi_after_ar_invoice_journal_sync();

create or replace function public.ywi_after_ap_bill_journal_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ywi_drop_source_journal_batch('ap_bill', old.id);
    return old;
  end if;
  perform public.ywi_sync_ap_bill_journal(new.id);
  return new;
end;
$$;

drop trigger if exists trg_ywi_after_ap_bill_journal_sync on public.ap_bills;
create trigger trg_ywi_after_ap_bill_journal_sync
after insert or update or delete on public.ap_bills
for each row execute function public.ywi_after_ap_bill_journal_sync();

create or replace function public.ywi_after_material_receipt_journal_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ywi_drop_source_journal_batch('material_receipt', coalesce(old.receipt_id, old.id));
    return old;
  end if;
  perform public.ywi_sync_material_receipt_journal(coalesce(new.receipt_id, new.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ywi_after_material_receipt_header_journal_sync on public.material_receipts;
create trigger trg_ywi_after_material_receipt_header_journal_sync
after insert or update or delete on public.material_receipts
for each row execute function public.ywi_after_material_receipt_journal_sync();

drop trigger if exists trg_ywi_after_material_receipt_line_journal_sync on public.material_receipt_lines;
create trigger trg_ywi_after_material_receipt_line_journal_sync
after insert or update or delete on public.material_receipt_lines
for each row execute function public.ywi_after_material_receipt_journal_sync();

create or replace function public.ywi_after_material_issue_journal_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ywi_drop_source_journal_batch('material_issue', coalesce(old.issue_id, old.id));
    return old;
  end if;
  perform public.ywi_sync_material_issue_journal(coalesce(new.issue_id, new.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ywi_after_material_issue_header_journal_sync on public.material_issues;
create trigger trg_ywi_after_material_issue_header_journal_sync
after insert or update or delete on public.material_issues
for each row execute function public.ywi_after_material_issue_journal_sync();

drop trigger if exists trg_ywi_after_material_issue_line_journal_sync on public.material_issue_lines;
create trigger trg_ywi_after_material_issue_line_journal_sync
after insert or update or delete on public.material_issue_lines
for each row execute function public.ywi_after_material_issue_journal_sync();

create or replace function public.ywi_before_route_stop_execution()
returns trigger
language plpgsql
as $$
declare
  v_stop record;
begin
  if new.execution_sequence is null or new.execution_sequence <= 0 then
    new.execution_sequence := 1;
  end if;

  if new.route_stop_id is not null then
    select rs.route_id, rs.client_site_id
      into v_stop
    from public.route_stops rs
    where rs.id = new.route_stop_id;

    if found then
      new.route_id := coalesce(new.route_id, v_stop.route_id);
      new.client_site_id := coalesce(new.client_site_id, v_stop.client_site_id);
    end if;
  end if;

  if new.completed_at is not null then
    new.execution_status := case when coalesce(new.execution_status, '') in ('skipped','cancelled') then new.execution_status else 'completed' end;
  elsif new.arrived_at is not null or new.started_at is not null then
    if coalesce(new.execution_status, '') in ('planned','delayed','') then
      new.execution_status := 'in_progress';
    end if;
  elsif coalesce(new.delay_minutes, 0) > 0 and coalesce(new.execution_status, '') = 'planned' then
    new.execution_status := 'delayed';
  end if;

  new.delay_minutes := greatest(coalesce(new.delay_minutes, 0), 0);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_route_stop_execution on public.route_stop_executions;
create trigger trg_ywi_before_route_stop_execution
before insert or update on public.route_stop_executions
for each row execute function public.ywi_before_route_stop_execution();

create or replace function public.ywi_before_hse_packet_proof()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_hse_packet_proof on public.hse_packet_proofs;
create trigger trg_ywi_before_hse_packet_proof
before insert or update on public.hse_packet_proofs
for each row execute function public.ywi_before_hse_packet_proof();

create or replace function public.ywi_before_linked_hse_packet()
returns trigger
language plpgsql
as $$
declare
  v_required_count integer := 0;
  v_completed_count integer := 0;
begin
  v_required_count :=
      (case when coalesce(new.briefing_required, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) then 1 else 0 end);

  v_completed_count :=
      (case when coalesce(new.briefing_required, false) and coalesce(new.briefing_completed, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) and coalesce(new.inspection_completed, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) and coalesce(new.emergency_review_completed, false) then 1 else 0 end);

  if tg_op = 'UPDATE'
     and coalesce(old.reopen_in_progress, false) = false
     and coalesce(new.reopen_in_progress, false) = true then
    new.reopen_count := coalesce(old.reopen_count, 0) + 1;
    new.last_reopened_at := now();
    new.last_reopened_by_profile_id := coalesce(new.last_reopened_by_profile_id, new.closed_by_profile_id, old.closed_by_profile_id);
  else
    new.reopen_count := coalesce(new.reopen_count, 0);
  end if;

  if coalesce(new.reopen_in_progress, false) then
    new.packet_status := 'in_progress';
    new.ready_for_closeout_at := null;
    new.closed_at := null;
    new.completion_percent := round(
      case
        when v_required_count <= 0 then 100
        else (v_completed_count::numeric / v_required_count::numeric) * 100
      end,
      2
    );
  elsif coalesce(new.packet_status, '') = 'closed' then
    new.completion_percent := 100;
    new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  else
    if v_required_count <= 0 then
      new.completion_percent := 100;
      new.packet_status := 'ready_for_closeout';
      new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    else
      new.completion_percent := round((v_completed_count::numeric / v_required_count::numeric) * 100, 2);
      if v_completed_count = v_required_count then
        new.packet_status := 'ready_for_closeout';
        new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
      elsif v_completed_count > 0 then
        if coalesce(new.packet_status, '') <> 'closed' then
          new.packet_status := 'in_progress';
        end if;
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      else
        new.packet_status := 'draft';
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      end if;
    end if;
  end if;

  if coalesce(new.packet_status, '') <> 'closed' then
    new.closed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace view public.v_route_stop_execution_rollups as
select
  rse.id,
  rse.route_stop_id,
  rse.route_id,
  rse.client_site_id,
  rse.execution_date,
  rse.execution_sequence,
  rse.execution_status,
  rse.started_at,
  rse.arrived_at,
  rse.completed_at,
  rse.completed_by_profile_id,
  rse.supervisor_profile_id,
  rse.delay_minutes,
  rse.special_instructions_acknowledged,
  rse.notes,
  rse.exception_notes,
  rse.created_by_profile_id,
  rse.created_at,
  rse.updated_at,
  count(rsea.id)::int as attachment_count,
  count(rsea.id) filter (where rsea.attachment_kind = 'photo')::int as photo_count,
  count(rsea.id) filter (where rsea.attachment_kind = 'signature')::int as signature_count,
  max(rsea.created_at) as last_attachment_at,
  rs.stop_order,
  rs.instructions as route_stop_instructions,
  r.name as route_name,
  cs.site_name as client_site_name
from public.route_stop_executions rse
left join public.route_stop_execution_attachments rsea on rsea.execution_id = rse.id
left join public.route_stops rs on rs.id = rse.route_stop_id
left join public.routes r on r.id = rse.route_id
left join public.client_sites cs on cs.id = rse.client_site_id
group by
  rse.id,
  rse.route_stop_id,
  rse.route_id,
  rse.client_site_id,
  rse.execution_date,
  rse.execution_sequence,
  rse.execution_status,
  rse.started_at,
  rse.arrived_at,
  rse.completed_at,
  rse.completed_by_profile_id,
  rse.supervisor_profile_id,
  rse.delay_minutes,
  rse.special_instructions_acknowledged,
  rse.notes,
  rse.exception_notes,
  rse.created_by_profile_id,
  rse.created_at,
  rse.updated_at,
  rs.stop_order,
  rs.instructions,
  r.name,
  cs.site_name;

create or replace view public.v_hse_packet_progress as
with proof_rollups as (
  select
    hpp.packet_id,
    count(hpp.id)::int as proof_count,
    count(hpp.id) filter (where hpp.proof_kind = 'photo')::int as photo_count,
    count(hpp.id) filter (where hpp.proof_kind = 'signature')::int as signature_count,
    count(hpp.id) filter (where hpp.proof_kind in ('file','document'))::int as document_count,
    max(hpp.created_at) as last_proof_at
  from public.hse_packet_proofs hpp
  group by hpp.packet_id
)
select
  lhp.id,
  lhp.packet_number,
  lhp.packet_type,
  lhp.packet_status,
  lhp.work_order_id,
  lhp.dispatch_id,
  ((case when lhp.briefing_required then 1 else 0 end)
    + (case when lhp.inspection_required then 1 else 0 end)
    + (case when lhp.emergency_review_required then 1 else 0 end)) as required_step_count,
  ((case when lhp.briefing_required and lhp.briefing_completed then 1 else 0 end)
    + (case when lhp.inspection_required and lhp.inspection_completed then 1 else 0 end)
    + (case when lhp.emergency_review_required and lhp.emergency_review_completed then 1 else 0 end)) as completed_step_count,
  lhp.completion_percent,
  lhp.ready_for_closeout_at,
  lhp.closed_at,
  coalesce(pr.proof_count, 0) as proof_count,
  coalesce(pr.photo_count, 0) as photo_count,
  coalesce(pr.signature_count, 0) as signature_count,
  coalesce(pr.document_count, 0) as document_count,
  pr.last_proof_at,
  lhp.reopen_in_progress,
  lhp.reopen_count,
  lhp.last_reopened_at,
  lhp.last_reopened_by_profile_id
from public.linked_hse_packets lhp
left join proof_rollups pr on pr.packet_id = lhp.id;

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
  gjb.posted_by_profile_id,
  gjb.source_generated,
  gjb.source_sync_state,
  gjb.source_synced_at
from public.gl_journal_batches gjb;
