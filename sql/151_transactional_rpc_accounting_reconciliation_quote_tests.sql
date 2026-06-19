-- Schema 151: Transactional PostgreSQL RPC layer for accounting, reconciliation,
-- bank promotion, quote conversion, and portal deposits.
-- Build 2026-06-18a.

begin;

-- ---------------------------------------------------------------------------
-- Shared transactional RPC helpers. PostgreSQL functions run inside the caller
-- transaction; any exception rolls back all writes in that call.
-- ---------------------------------------------------------------------------
create or replace function public.ywi_cents(p_amount numeric)
returns bigint
language sql
immutable
as $$
  select round(coalesce(p_amount,0) * 100)::bigint;
$$;

create or replace function public.ywi_money(p_amount numeric)
returns numeric(12,2)
language sql
immutable
as $$
  select round(coalesce(p_amount,0)::numeric,2)::numeric(12,2);
$$;

create or replace function public.ywi_profile_rank(p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(p.role,''))
    when 'worker' then 10
    when 'employee' then 10
    when 'staff' then 10
    when 'onsite_admin' then 18
    when 'site_leader' then 20
    when 'supervisor' then 30
    when 'hse' then 40
    when 'job_admin' then 45
    when 'admin' then 50
    else 0 end
  from public.profiles p
  where p.id = p_profile_id and coalesce(p.is_active,true) is true;
$$;

create or replace function public.ywi_require_rpc_rank(p_profile_id uuid, p_minimum integer, p_action text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(public.ywi_profile_rank(p_profile_id),0) < p_minimum then
    raise exception 'Your role cannot perform %.', coalesce(p_action,'this operation') using errcode = '42501';
  end if;
end;
$$;

create or replace function public.ywi_assert_period_open(p_entry_date date, p_side text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_locked record;
begin
  select period_code, ar_locked, ap_locked, gl_locked
    into v_locked
  from public.accounting_period_closes
  where p_entry_date between period_start and period_end
    and close_status in ('in_review','closed')
    and (gl_locked or (lower(p_side) = 'ar' and ar_locked) or (lower(p_side) = 'ap' and ap_locked))
  order by period_start desc
  limit 1;

  if found then
    raise exception 'Accounting period % is locked for % or GL posting.', v_locked.period_code, upper(coalesce(p_side,'gl')) using errcode = '23514';
  end if;
end;
$$;

create or replace function public.ywi_find_gl_account(p_candidates text[])
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_candidate text;
begin
  foreach v_candidate in array coalesce(p_candidates, array[]::text[]) loop
    select id into v_account_id
    from public.chart_of_accounts
    where is_active is true
      and (
        lower(coalesce(system_code,'')) = lower(v_candidate)
        or lower(account_name) like '%' || lower(v_candidate) || '%'
      )
    order by case when lower(coalesce(system_code,'')) = lower(v_candidate) then 0 else 1 end, account_number
    limit 1;
    if v_account_id is not null then
      return v_account_id;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.ywi_create_balanced_journal(
  p_actor_profile_id uuid,
  p_source_request_id uuid,
  p_source_module text,
  p_entry_date date,
  p_memo text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit_cents bigint;
  v_credit_cents bigint;
  v_batch public.gl_journal_batches%rowtype;
  v_line jsonb;
  v_line_count integer := 0;
begin
  select coalesce(sum(public.ywi_cents((line->>'amount')::numeric)) filter (where lower(line->>'side') = 'debit'),0),
         coalesce(sum(public.ywi_cents((line->>'amount')::numeric)) filter (where lower(line->>'side') = 'credit'),0)
    into v_debit_cents, v_credit_cents
  from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) as line;

  if v_debit_cents <= 0 or v_debit_cents <> v_credit_cents then
    raise exception 'Journal entry is not balanced to the cent.' using errcode = '23514';
  end if;

  insert into public.gl_journal_batches (
    batch_number, source_module, batch_status, batch_date, memo, posted_at, created_by_profile_id
  ) values (
    'RPC-' || to_char(coalesce(p_entry_date,current_date),'YYYYMMDD') || '-' || substr(coalesce(p_source_request_id, gen_random_uuid())::text,1,8) || '-' || substr(gen_random_uuid()::text,1,8),
    coalesce(nullif(p_source_module,''),'operations_rpc'), 'posted', coalesce(p_entry_date,current_date), left(coalesce(p_memo,''),1000), now(), p_actor_profile_id
  ) returning * into v_batch;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    if nullif(v_line->>'account_id','') is null or public.ywi_money((v_line->>'amount')::numeric) <= 0 then
      raise exception 'Journal account and positive amount are required for every line.' using errcode = '23514';
    end if;
    insert into public.gl_journal_entries (
      batch_id, entry_date, account_id, debit_amount, credit_amount, client_id, work_order_id, memo
    ) values (
      v_batch.id,
      coalesce(p_entry_date,current_date),
      (v_line->>'account_id')::uuid,
      case when lower(v_line->>'side') = 'debit' then public.ywi_money((v_line->>'amount')::numeric) else 0 end,
      case when lower(v_line->>'side') = 'credit' then public.ywi_money((v_line->>'amount')::numeric) else 0 end,
      nullif(v_line->>'client_id','')::uuid,
      nullif(v_line->>'work_order_id','')::uuid,
      left(coalesce(v_line->>'memo',p_memo,''),1000)
    );
    v_line_count := v_line_count + 1;
  end loop;

  return jsonb_build_object('batch_id',v_batch.id,'batch_number',v_batch.batch_number,'entry_count',v_line_count,'debit_total',v_debit_cents/100.0,'credit_total',v_credit_cents/100.0);
end;
$$;

create or replace function public.ywi_rpc_post_payment_action(p_request_id uuid, p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.payment_action_requests%rowtype;
  prior public.payment_action_requests%rowtype;
  bank record;
  invoice record;
  bill record;
  arpay record;
  appay record;
  side text;
  amount numeric(12,2);
  entry_date date;
  cash_id uuid;
  ar_id uuid;
  ap_id uuid;
  bad_debt_id uuid;
  deposit_id uuid;
  refund_id uuid;
  debit_account uuid;
  application_id uuid;
  journal jsonb;
  available numeric(12,2);
  new_balance numeric(12,2);
  memo text;
  reversed_lines jsonb;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'post payment action');

  select * into r from public.payment_action_requests where id = p_request_id for update;
  if not found then raise exception 'Payment action request was not found.' using errcode = 'P0002'; end if;
  if r.posting_status = 'posted' then return jsonb_build_object('record',to_jsonb(r),'already_posted',true); end if;
  if r.action_status <> 'approved' then raise exception 'Approve the payment action before posting it.' using errcode = '23514'; end if;
  if coalesce(r.proof_required,true) and nullif(trim(coalesce(r.proof_reference,'')),'') is null then
    raise exception 'Posting is blocked until proof is attached or referenced.' using errcode = '23514';
  end if;

  update public.payment_action_requests
  set posting_status='posting', posting_message='Transactional RPC posting started.', updated_at=now()
  where id = r.id and posting_status in ('not_posted','failed')
  returning * into r;
  if not found then
    select * into r from public.payment_action_requests where id = p_request_id;
    if r.posting_status = 'posted' then return jsonb_build_object('record',to_jsonb(r),'already_posted',true); end if;
    raise exception 'This payment action is not available for posting.' using errcode = '23514';
  end if;

  amount := public.ywi_money(r.amount);
  entry_date := coalesce(r.transaction_date,current_date);
  side := lower(coalesce(nullif(r.ledger_side,''),'auto'));
  if amount <= 0 then raise exception 'Payment action amount must be greater than zero.' using errcode = '23514'; end if;

  if r.bank_account_id is not null then
    select * into bank from public.bank_accounts where id = r.bank_account_id and account_status = 'open';
  end if;
  if bank.id is null then
    select * into bank from public.bank_accounts where account_status='open' order by is_default desc, account_name limit 1;
  end if;
  if bank.id is null then raise exception 'Confirming/posting requires an open bank account.' using errcode = '23514'; end if;

  cash_id := coalesce(bank.gl_account_id, public.ywi_find_gl_account(array['cash','bank','operating cash']));
  ar_id := public.ywi_find_gl_account(array['ar','accounts receivable','trade receivables']);
  ap_id := public.ywi_find_gl_account(array['ap','accounts payable','trade payables']);
  bad_debt_id := public.ywi_find_gl_account(array['bad debt expense','write off expense','credit loss expense']);
  deposit_id := public.ywi_find_gl_account(array['customer deposits','unapplied cash','customer credits','deferred revenue']);
  refund_id := public.ywi_find_gl_account(array['customer refunds','refund expense','sales returns']);
  if cash_id is null then raise exception 'No active bank/cash GL account is configured.' using errcode = '23514'; end if;

  if r.action_type = 'reverse_payment' then
    select * into prior
    from public.payment_action_requests
    where (id = r.reversal_of_request_id or (r.reversal_of_request_id is null and payment_reference = r.payment_reference and id <> r.id))
      and posting_status = 'posted'
    order by posted_at desc
    limit 1 for update;
    if prior.id is null or prior.gl_batch_id is null then raise exception 'A posted source request with a journal batch is required for reversal.' using errcode='23514'; end if;
    perform public.ywi_assert_period_open(entry_date,coalesce(prior.ledger_side,'gl'));
    select jsonb_agg(jsonb_build_object(
      'account_id',e.account_id,
      'side',case when e.debit_amount > 0 then 'credit' else 'debit' end,
      'amount',case when e.debit_amount > 0 then e.debit_amount else e.credit_amount end,
      'client_id',e.client_id,
      'work_order_id',e.work_order_id,
      'memo','Reversal of ' || prior.action_key
    )) into reversed_lines
    from public.gl_journal_entries e
    where e.batch_id = prior.gl_batch_id;
    if reversed_lines is null then raise exception 'The source journal batch has no entries to reverse.' using errcode='23514'; end if;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_reversal_rpc',entry_date,'Reverse payment action ' || prior.action_key,reversed_lines);
    update public.payment_action_requests set posting_status='reversed', posting_message='Reversed by ' || r.action_key, updated_at=now() where id = prior.id;
    update public.payment_action_requests
      set action_status='posted', posting_status='posted', posted_at=now(), posted_by_profile_id=p_actor_profile_id,
          gl_batch_id=(journal->>'batch_id')::uuid, posting_message='Reversed ' || prior.action_key || '.',
          posting_payload=jsonb_build_object('rpc','ywi_rpc_post_payment_action','reversed_request_id',prior.id,'journal',journal), updated_at=now()
      where id = r.id returning * into r;
    return jsonb_build_object('record',to_jsonb(r),'journal',journal);
  end if;

  if side in ('auto','ar') then
    if r.ar_invoice_id is not null then select * into invoice from public.ar_invoices where id = r.ar_invoice_id for update; end if;
    if invoice.id is null and nullif(r.invoice_reference,'') is not null then select * into invoice from public.ar_invoices where invoice_number = r.invoice_reference limit 1 for update; end if;
    if r.ar_payment_id is not null then select * into arpay from public.ar_payments where id = r.ar_payment_id for update; end if;
    if arpay.id is null and nullif(r.payment_reference,'') is not null then select * into arpay from public.ar_payments where payment_number = r.payment_reference or reference_number = r.payment_reference limit 1 for update; end if;
    if invoice.id is not null or arpay.id is not null then side := 'ar'; end if;
  end if;
  if side in ('auto','ap') then
    if r.ap_bill_id is not null then select * into bill from public.ap_bills where id = r.ap_bill_id for update; end if;
    if bill.id is null and nullif(r.invoice_reference,'') is not null then select * into bill from public.ap_bills where bill_number = r.invoice_reference limit 1 for update; end if;
    if r.ap_payment_id is not null then select * into appay from public.ap_payments where id = r.ap_payment_id for update; end if;
    if appay.id is null and nullif(r.payment_reference,'') is not null then select * into appay from public.ap_payments where payment_number = r.payment_reference or reference_number = r.payment_reference limit 1 for update; end if;
    if bill.id is not null or appay.id is not null then side := 'ap'; end if;
  end if;
  if side not in ('ar','ap') then raise exception 'Could not resolve the request to AR or AP.' using errcode='23514'; end if;
  perform public.ywi_assert_period_open(entry_date,side);
  if side='ar' and ar_id is null then raise exception 'No Accounts Receivable control account is configured.' using errcode='23514'; end if;
  if side='ap' and ap_id is null then raise exception 'No Accounts Payable control account is configured.' using errcode='23514'; end if;
  memo := left(replace(r.action_type,'_',' ') || ' ' || r.action_key || ': ' || coalesce(r.reason,''),1000);

  if r.action_type = 'apply_payment' and side='ar' then
    if invoice.id is null or arpay.id is null then raise exception 'AR posting requires an exact invoice and AR payment reference.' using errcode='23514'; end if;
    available := public.ywi_money(coalesce(arpay.unapplied_amount, arpay.amount));
    if public.ywi_cents(amount) > public.ywi_cents(invoice.balance_due) or public.ywi_cents(amount) > public.ywi_cents(available) then raise exception 'Applied amount exceeds invoice balance or unapplied payment.' using errcode='23514'; end if;
    insert into public.ar_payment_applications(payment_id, invoice_id, applied_amount, application_date, application_status, notes, created_by_profile_id)
    values (arpay.id, invoice.id, amount, entry_date, 'applied', memo, p_actor_profile_id) returning id into application_id;
    new_balance := public.ywi_money(invoice.balance_due - amount);
    update public.ar_invoices set balance_due=new_balance, invoice_status=case when new_balance=0 then 'paid' else 'partial' end, updated_at=now() where id=invoice.id;
    update public.ar_payments set unapplied_amount=public.ywi_money(available-amount), application_status=case when public.ywi_money(available-amount)=0 then 'applied' else 'partial' end, last_applied_at=now(), last_application_notes=memo, updated_at=now() where id=arpay.id;
    select case when exists(select 1 from public.payment_action_requests x where x.ar_payment_id=arpay.id and x.action_type='overpayment_credit' and x.posting_status='posted' and x.id<>r.id) then deposit_id else cash_id end into debit_account;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_action_rpc',entry_date,memo,jsonb_build_array(
      jsonb_build_object('account_id',debit_account,'side','debit','amount',amount,'client_id',invoice.client_id,'work_order_id',invoice.work_order_id),
      jsonb_build_object('account_id',ar_id,'side','credit','amount',amount,'client_id',invoice.client_id,'work_order_id',invoice.work_order_id)
    ));
  elsif r.action_type = 'apply_payment' and side='ap' then
    if bill.id is null or appay.id is null then raise exception 'AP posting requires an exact bill and AP payment reference.' using errcode='23514'; end if;
    available := public.ywi_money(coalesce(appay.unapplied_amount, appay.amount));
    if public.ywi_cents(amount) > public.ywi_cents(bill.balance_due) or public.ywi_cents(amount) > public.ywi_cents(available) then raise exception 'Applied amount exceeds bill balance or unapplied payment.' using errcode='23514'; end if;
    insert into public.ap_payment_applications(payment_id, bill_id, applied_amount, application_date, application_status, notes, created_by_profile_id)
    values (appay.id, bill.id, amount, entry_date, 'applied', memo, p_actor_profile_id) returning id into application_id;
    new_balance := public.ywi_money(bill.balance_due - amount);
    update public.ap_bills set balance_due=new_balance, bill_status=case when new_balance=0 then 'paid' else 'partial' end, updated_at=now() where id=bill.id;
    update public.ap_payments set unapplied_amount=public.ywi_money(available-amount), application_status=case when public.ywi_money(available-amount)=0 then 'applied' else 'partial' end, last_applied_at=now(), last_application_notes=memo, updated_at=now() where id=appay.id;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_action_rpc',entry_date,memo,jsonb_build_array(
      jsonb_build_object('account_id',ap_id,'side','debit','amount',amount),
      jsonb_build_object('account_id',cash_id,'side','credit','amount',amount)
    ));
  elsif r.action_type = 'write_off' then
    if side <> 'ar' or invoice.id is null then raise exception 'Write-off posting requires an AR invoice.' using errcode='23514'; end if;
    if bad_debt_id is null then raise exception 'No bad-debt/write-off expense account is configured.' using errcode='23514'; end if;
    if public.ywi_cents(amount) > public.ywi_cents(invoice.balance_due) then raise exception 'Write-off exceeds invoice balance.' using errcode='23514'; end if;
    new_balance := public.ywi_money(invoice.balance_due - amount);
    update public.ar_invoices set balance_due=new_balance, invoice_status=case when new_balance=0 then 'paid' else 'partial' end, updated_at=now() where id=invoice.id;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_action_rpc',entry_date,memo,jsonb_build_array(
      jsonb_build_object('account_id',bad_debt_id,'side','debit','amount',amount,'client_id',invoice.client_id,'work_order_id',invoice.work_order_id),
      jsonb_build_object('account_id',ar_id,'side','credit','amount',amount,'client_id',invoice.client_id,'work_order_id',invoice.work_order_id)
    ));
  elsif r.action_type = 'overpayment_credit' then
    if side <> 'ar' or arpay.id is null then raise exception 'Overpayment credit requires an AR payment reference.' using errcode='23514'; end if;
    if deposit_id is null then raise exception 'No customer-deposit/unapplied-cash account is configured.' using errcode='23514'; end if;
    available := public.ywi_money(coalesce(arpay.unapplied_amount, arpay.amount));
    if exists(select 1 from public.payment_action_requests x where x.ar_payment_id=arpay.id and x.action_type='overpayment_credit' and x.posting_status='posted' and x.id<>r.id) then raise exception 'This AR payment has already been posted to customer deposits.' using errcode='23514'; end if;
    if public.ywi_cents(amount) <> public.ywi_cents(available) then raise exception 'Customer-deposit recognition must equal the current unapplied amount.' using errcode='23514'; end if;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_action_rpc',entry_date,memo,jsonb_build_array(
      jsonb_build_object('account_id',cash_id,'side','debit','amount',amount,'client_id',arpay.client_id),
      jsonb_build_object('account_id',deposit_id,'side','credit','amount',amount,'client_id',arpay.client_id)
    ));
  elsif r.action_type = 'refund' then
    if side <> 'ar' or arpay.id is null then raise exception 'Refund posting requires the original AR payment reference.' using errcode='23514'; end if;
    available := public.ywi_money(coalesce(arpay.unapplied_amount,0));
    if public.ywi_cents(amount) > public.ywi_cents(available) then raise exception 'Refund exceeds the payment’s unapplied customer credit.' using errcode='23514'; end if;
    debit_account := case when exists(select 1 from public.payment_action_requests x where x.ar_payment_id=arpay.id and x.action_type='overpayment_credit' and x.posting_status='posted' and x.id<>r.id) then deposit_id else refund_id end;
    if debit_account is null then raise exception 'No customer-deposit or refund account is configured.' using errcode='23514'; end if;
    update public.ar_payments set unapplied_amount=public.ywi_money(available-amount), application_status=case when public.ywi_money(available-amount)=0 then 'applied' else 'partial' end, last_applied_at=now(), last_application_notes=memo, updated_at=now() where id=arpay.id;
    journal := public.ywi_create_balanced_journal(p_actor_profile_id,r.id,'operations_payment_action_rpc',entry_date,memo,jsonb_build_array(
      jsonb_build_object('account_id',debit_account,'side','debit','amount',amount,'client_id',arpay.client_id),
      jsonb_build_object('account_id',cash_id,'side','credit','amount',amount,'client_id',arpay.client_id)
    ));
  else
    raise exception 'Unsupported posting action %.', r.action_type using errcode='23514';
  end if;

  update public.payment_action_requests
    set action_status='posted', posting_status='posted', ledger_side=side, bank_account_id=bank.id,
        transaction_date=entry_date, posted_at=now(), posted_by_profile_id=p_actor_profile_id,
        gl_batch_id=(journal->>'batch_id')::uuid,
        ar_invoice_id=coalesce(invoice.id,r.ar_invoice_id), ap_bill_id=coalesce(bill.id,r.ap_bill_id),
        ar_payment_id=coalesce(arpay.id,r.ar_payment_id), ap_payment_id=coalesce(appay.id,r.ap_payment_id),
        ar_application_id=case when side='ar' then application_id else r.ar_application_id end,
        ap_application_id=case when side='ap' then application_id else r.ap_application_id end,
        posting_message='Posted by transactional RPC with balanced journal entries.',
        posting_payload=jsonb_build_object('rpc','ywi_rpc_post_payment_action','journal',journal),
        period_lock_checked=true, updated_at=now()
    where id=r.id returning * into r;
  return jsonb_build_object('record',to_jsonb(r),'journal',journal);
exception when others then
  update public.payment_action_requests
    set posting_status='failed', posting_message=left(sqlerrm,2000), updated_at=now()
    where id = p_request_id and posting_status = 'posting';
  raise;
end;
$$;

create or replace function public.ywi_rpc_promote_bank_csv_import(
  p_import_id uuid,
  p_actor_profile_id uuid,
  p_bank_account_id uuid default null,
  p_closing_balance numeric default null,
  p_confirmation_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  preview public.bank_csv_import_previews%rowtype;
  bank_id uuid;
  statement_id uuid;
  session_id uuid;
  accepted_count integer;
  statement_start date;
  statement_end date;
  suffix text;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'promote bank CSV import');
  select * into preview from public.bank_csv_import_previews where id=p_import_id for update;
  if not found then raise exception 'Bank CSV preview was not found.' using errcode='P0002'; end if;
  if preview.promoted_at is not null and preview.reconciliation_session_id is not null then
    return jsonb_build_object('record',to_jsonb(preview),'promoted',true,'already_promoted',true);
  end if;
  bank_id := coalesce(p_bank_account_id, preview.bank_account_id);
  if bank_id is null then
    select id into bank_id from public.bank_accounts where account_status='open' order by is_default desc, account_name limit 1;
  end if;
  if bank_id is null then raise exception 'Confirming a bank import requires a configured open bank account.' using errcode='23514'; end if;

  select count(*), min(transaction_date), max(transaction_date)
    into accepted_count, statement_start, statement_end
  from public.bank_csv_import_preview_rows
  where import_id=p_import_id and row_status='accepted' and promoted_at is null;
  if coalesce(accepted_count,0) = 0 then raise exception 'No accepted, unpromoted rows remain.' using errcode='23514'; end if;

  suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(p_import_id::text,1,8);
  insert into public.bank_statement_imports (
    bank_account_id, import_code, statement_start, statement_end, import_status, closing_balance,
    transaction_count, source_file_name, source_format, import_payload, imported_by_profile_id, imported_at
  ) values (
    bank_id, 'CSV-' || suffix, statement_start, statement_end, 'imported', p_closing_balance,
    accepted_count, preview.original_filename, 'csv', jsonb_build_object('preview_id',preview.id,'validation_summary',preview.validation_summary), p_actor_profile_id, now()
  ) returning id into statement_id;

  insert into public.bank_reconciliation_sessions (
    bank_account_id, statement_import_id, session_code, period_start, period_end,
    reconciliation_status, bank_balance, notes, created_by_profile_id
  ) values (
    bank_id, statement_id, 'RECON-' || suffix, statement_start, statement_end,
    'in_review', p_closing_balance, coalesce(nullif(p_confirmation_note,''),'Promoted from ' || coalesce(preview.original_filename,preview.import_key)), p_actor_profile_id
  ) returning id into session_id;

  insert into public.bank_reconciliation_items (
    reconciliation_session_id, item_source_type, item_source_id, item_date, item_description, amount, match_status, clearing_status, notes
  )
  select session_id, 'bank_statement_line', r.id::text, r.transaction_date, r.description, r.amount, 'unmatched', 'open', r.reference
  from public.bank_csv_import_preview_rows r
  where r.import_id=p_import_id and r.row_status='accepted' and r.promoted_at is null
  order by r.row_number;

  update public.bank_csv_import_preview_rows r
    set promoted_reconciliation_item_id = bi.id, promoted_at = now()
  from public.bank_reconciliation_items bi
  where bi.reconciliation_session_id=session_id
    and bi.item_source_id = r.id::text
    and r.import_id=p_import_id;

  update public.bank_csv_import_previews
    set preview_status='promoted', bank_account_id=bank_id, statement_import_id=statement_id,
        reconciliation_session_id=session_id, confirmed_at=coalesce(confirmed_at,now()),
        confirmation_note=coalesce(nullif(p_confirmation_note,''),confirmation_note),
        promoted_at=now(), promoted_by_profile_id=p_actor_profile_id,
        promotion_message='Promoted by transactional RPC to reconciliation session ' || session_id,
        updated_at=now()
    where id=p_import_id returning * into preview;

  return jsonb_build_object('record',to_jsonb(preview),'statement_import_id',statement_id,'reconciliation_session_id',session_id,'promoted_rows',accepted_count);
end;
$$;

create or replace function public.ywi_rpc_apply_reconciliation_action(p_payload jsonb, p_actor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_type text := lower(coalesce(p_payload->>'action_type','match'));
  item_id uuid := nullif(coalesce(p_payload->>'reconciliation_item_id', p_payload->>'bank_row_id'),'')::uuid;
  item public.bank_reconciliation_items%rowtype;
  request_id uuid;
  request_row public.reconciliation_action_requests%rowtype;
  target_reference text := nullif(p_payload->>'target_reference','');
  splits jsonb := coalesce(p_payload->'split_rows', p_payload->'split_json', '[]'::jsonb);
  split_total_cents bigint := 0;
  source_cents bigint := 0;
  allocation jsonb;
  score numeric(5,2) := coalesce((p_payload->>'match_score')::numeric, null);
  explanation jsonb := coalesce(p_payload->'match_explanation','{}'::jsonb);
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'apply reconciliation action');
  if action_type not in ('match','split','undo','signoff','reject') then raise exception 'Unsupported reconciliation action.' using errcode='23514'; end if;

  if item_id is not null then
    select * into item from public.bank_reconciliation_items where id=item_id for update;
    if item.id is null then raise exception 'Reconciliation item was not found.' using errcode='P0002'; end if;
  end if;

  if action_type in ('match','split','reject') and item.id is null then raise exception 'A reconciliation item is required.' using errcode='23514'; end if;

  source_cents := public.ywi_cents(abs(coalesce(item.amount,0)));
  if action_type = 'split' then
    select coalesce(sum(public.ywi_cents(abs((x->>'allocated_amount')::numeric))),0) into split_total_cents from jsonb_array_elements(splits) x;
    if jsonb_array_length(splits) < 2 then raise exception 'Split actions require at least two allocations.' using errcode='23514'; end if;
    if split_total_cents <> source_cents then raise exception 'Split allocations must equal the bank item amount exactly to the cent.' using errcode='23514'; end if;
  else
    split_total_cents := source_cents;
  end if;

  insert into public.reconciliation_action_requests (
    action_type, action_status, import_id, bank_row_id, reconciliation_item_id, target_reference,
    split_json, signoff_note, undo_of_action_id, requested_by_profile_id,
    match_score, match_explanation, source_amount, split_total, balance_difference,
    processed_by_profile_id, processed_at, metadata
  ) values (
    action_type, case when action_type='reject' then 'rejected' else 'processed' end,
    nullif(p_payload->>'import_id','')::uuid, item_id, item_id, target_reference,
    splits, nullif(p_payload->>'signoff_note',''), nullif(p_payload->>'undo_of_action_id','')::uuid, p_actor_profile_id,
    score, explanation || jsonb_build_object('rpc','ywi_rpc_apply_reconciliation_action','exact_split_validation',action_type='split'),
    case when item.id is not null then abs(item.amount) else null end,
    split_total_cents / 100.0, (split_total_cents - source_cents) / 100.0,
    p_actor_profile_id, now(), jsonb_build_object('build','2026-06-18a','schema',151,'payload',p_payload)
  ) returning * into request_row;
  request_id := request_row.id;

  if action_type='match' then
    insert into public.reconciliation_match_allocations (
      action_request_id, reconciliation_item_id, target_type, target_id, target_reference,
      allocated_amount, match_score, match_explanation, allocation_status
    ) values (
      request_id, item.id, coalesce(nullif(p_payload->>'target_type',''),'manual_reference'), nullif(p_payload->>'target_id',''), target_reference,
      abs(item.amount), coalesce(score,100), explanation, 'active'
    );
    update public.bank_reconciliation_items set match_status='matched', clearing_status='cleared', notes=coalesce(notes || ' | ','') || 'Matched by transactional RPC.', updated_at=now() where id=item.id;
  elsif action_type='split' then
    for allocation in select * from jsonb_array_elements(splits) loop
      insert into public.reconciliation_match_allocations (
        action_request_id, reconciliation_item_id, target_type, target_id, target_reference,
        allocated_amount, match_score, match_explanation, allocation_status
      ) values (
        request_id, item.id, coalesce(nullif(allocation->>'target_type',''),'manual_split'), nullif(allocation->>'target_id',''), nullif(allocation->>'target_reference',''),
        public.ywi_money((allocation->>'allocated_amount')::numeric), coalesce((allocation->>'match_score')::numeric,score,100),
        coalesce(allocation->'match_explanation',explanation), 'active'
      );
    end loop;
    update public.bank_reconciliation_items set match_status='split', clearing_status='cleared', notes=coalesce(notes || ' | ','') || 'Split matched by transactional RPC.', updated_at=now() where id=item.id;
  elsif action_type='undo' then
    update public.reconciliation_match_allocations set allocation_status='reversed', reversed_at=now(), reversed_by_profile_id=p_actor_profile_id where action_request_id = nullif(p_payload->>'undo_of_action_id','')::uuid;
    update public.reconciliation_action_requests set action_status='reversed', decision_note=coalesce(nullif(p_payload->>'signoff_note',''),'Reversed by transactional RPC.'), updated_at=now() where id = nullif(p_payload->>'undo_of_action_id','')::uuid;
    update public.bank_reconciliation_items set match_status='unmatched', clearing_status='open', difference_reason=null, notes=coalesce(notes || ' | ','') || 'Match undone by transactional RPC.', updated_at=now() where id in (select reconciliation_item_id from public.reconciliation_match_allocations where action_request_id = nullif(p_payload->>'undo_of_action_id','')::uuid);
  elsif action_type='signoff' then
    update public.bank_reconciliation_items set clearing_status='cleared', match_status=case when match_status='unmatched' then 'manual_signoff' else match_status end, notes=coalesce(notes || ' | ','') || coalesce(nullif(p_payload->>'signoff_note',''),'Signed off by transactional RPC.'), updated_at=now() where id=item.id;
    update public.reconciliation_action_requests set signed_off_by_profile_id=p_actor_profile_id, signed_off_at=now() where id=request_id returning * into request_row;
  elsif action_type='reject' then
    update public.bank_reconciliation_items set match_status='exception', clearing_status='open', difference_reason=coalesce(nullif(p_payload->>'signoff_note',''),'Rejected during reconciliation review.'), updated_at=now() where id=item.id;
  end if;

  select * into request_row from public.reconciliation_action_requests where id=request_id;
  return jsonb_build_object('record',to_jsonb(request_row),'rpc','ywi_rpc_apply_reconciliation_action');
end;
$$;

create or replace function public.ywi_rpc_accept_quote_package(
  p_quote_package_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_accept_terms boolean,
  p_terms_version text default '2026-06-18',
  p_acceptance_notes text default null,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg public.estimate_quote_packages%rowtype;
  est public.estimates%rowtype;
  wo public.work_orders%rowtype;
  stable_number text;
begin
  select * into pkg from public.estimate_quote_packages where id=p_quote_package_id and portal_enabled is true for update;
  if not found then raise exception 'This customer portal link is unavailable.' using errcode='P0002'; end if;
  if pkg.accepted_at is not null then
    select * into wo from public.work_orders where estimate_id=pkg.estimate_id order by created_at desc limit 1;
    return jsonb_build_object('already_accepted',true,'quote_package_id',pkg.id,'work_order_id',wo.id);
  end if;
  if p_accept_terms is not true then raise exception 'Quote terms must be accepted.' using errcode='23514'; end if;
  if length(trim(coalesce(p_customer_name,''))) < 2 or position('@' in coalesce(p_customer_email,'')) = 0 then raise exception 'Customer name and valid email are required.' using errcode='23514'; end if;

  select * into est from public.estimates where id=pkg.estimate_id for update;
  if not found then raise exception 'The source estimate was not found.' using errcode='P0002'; end if;
  if est.valid_until is not null and est.valid_until < current_date then raise exception 'This quote has expired and needs review.' using errcode='23514'; end if;

  stable_number := left('WO-' || regexp_replace(coalesce(est.estimate_number,pkg.id::text),'[^A-Za-z0-9-]+','-','g'),80);
  select * into wo from public.work_orders where estimate_id=est.id or work_order_number=stable_number order by created_at desc limit 1 for update;
  if wo.id is null then
    insert into public.work_orders (
      work_order_number, estimate_id, client_id, work_type, status, customer_notes,
      subtotal, tax_total, total_amount
    ) values (
      stable_number, est.id, est.client_id, 'service', 'draft',
      'Quote accepted through customer portal by ' || trim(p_customer_name) || ' (' || lower(trim(p_customer_email)) || ').',
      coalesce(est.subtotal,0), coalesce(est.tax_total,0), coalesce(est.total_amount,0)
    ) returning * into wo;
  end if;

  update public.estimate_quote_packages
    set package_status='accepted', send_status='accepted', accepted_at=now(), accepted_by_name=trim(p_customer_name),
        accepted_by_email=lower(trim(p_customer_email)), acceptance_notes=nullif(p_acceptance_notes,''),
        last_client_action='accepted', last_client_action_at=now(), portal_terms_version=coalesce(nullif(p_terms_version,''),'2026-06-18'),
        portal_acceptance_ip_hash=p_ip_hash, last_client_ip=p_ip_hash, last_client_user_agent=p_user_agent, updated_at=now()
    where id=pkg.id returning * into pkg;

  update public.estimates
    set status='accepted', approved_at=coalesce(approved_at,now()), converted_work_order_id=wo.id, converted_at=coalesce(converted_at,now()), updated_at=now()
    where id=est.id returning * into est;

  insert into public.quote_package_client_events (quote_package_id, event_action, event_email, event_name, event_ip, user_agent, notes)
  values (pkg.id, 'accepted', lower(trim(p_customer_email)), trim(p_customer_name), p_ip_hash, p_user_agent, nullif(p_acceptance_notes,''));
  insert into public.customer_portal_events (quote_package_id, estimate_id, work_order_id, event_type, customer_name, customer_email, event_payload)
  values (pkg.id, est.id, wo.id, 'quote_accepted', trim(p_customer_name), lower(trim(p_customer_email)), jsonb_build_object('terms_version',coalesce(nullif(p_terms_version,''),'2026-06-18'),'ip_hash',p_ip_hash,'build','2026-06-18a','schema',151));

  return jsonb_build_object('accepted',true,'quote_package_id',pkg.id,'estimate_id',est.id,'work_order_id',wo.id,'work_order_number',wo.work_order_number);
end;
$$;

create or replace function public.ywi_rpc_prepare_deposit_request(
  p_quote_package_id uuid,
  p_currency_code text default 'CAD',
  p_token_suffix text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pkg record;
  required_cents bigint;
  paid_cents bigint;
  remaining_cents bigint;
  deposit public.customer_deposit_requests%rowtype;
begin
  select qp.*, e.client_id, e.total_amount, e.estimate_number, e.converted_work_order_id into pkg
  from public.estimate_quote_packages qp
  join public.estimates e on e.id=qp.estimate_id
  where qp.id=p_quote_package_id for update;
  if not found then raise exception 'Quote package was not found.' using errcode='P0002'; end if;
  if pkg.accepted_at is null then raise exception 'Accept the quote before paying a deposit.' using errcode='23514'; end if;
  if coalesce(pkg.deposit_required_amount,0) <= 0 then raise exception 'This quote does not have a deposit amount configured.' using errcode='23514'; end if;
  if pkg.deposit_required_amount > pkg.total_amount then raise exception 'The configured deposit exceeds the quote total and must be corrected by staff.' using errcode='23514'; end if;
  required_cents := public.ywi_cents(pkg.deposit_required_amount);
  select coalesce(sum(public.ywi_cents(paid_amount)) filter (where deposit_status='paid'),0) into paid_cents
  from public.customer_deposit_requests where quote_package_id=p_quote_package_id;
  remaining_cents := greatest(0, required_cents - paid_cents);
  if remaining_cents = 0 then return jsonb_build_object('already_paid',true,'remaining_cents',0); end if;
  select * into deposit from public.customer_deposit_requests
  where quote_package_id=p_quote_package_id and deposit_status in ('requested','checkout_created')
    and public.ywi_cents(requested_amount)=remaining_cents
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1 for update;
  if deposit.id is null then
    insert into public.customer_deposit_requests (
      quote_package_id, estimate_id, client_id, requested_amount, currency_code, deposit_status, checkout_provider, expires_at, metadata
    ) values (
      p_quote_package_id, pkg.estimate_id, pkg.client_id, remaining_cents/100.0, upper(coalesce(nullif(p_currency_code,''),'CAD')), 'requested', 'stripe',
      now() + interval '24 hours', jsonb_build_object('build','2026-06-18a','schema',151,'portal_token_suffix',p_token_suffix,'exact_required_balance',true)
    ) returning * into deposit;
  end if;
  insert into public.customer_portal_events (quote_package_id, estimate_id, work_order_id, event_type, event_status, event_payload)
  values (p_quote_package_id, pkg.estimate_id, pkg.converted_work_order_id, 'deposit_request_prepared', 'completed', jsonb_build_object('deposit_request_id',deposit.id,'remaining_cents',remaining_cents))
  on conflict do nothing;
  return jsonb_build_object('deposit',to_jsonb(deposit),'remaining_cents',remaining_cents,'reused',deposit.created_at < now() - interval '1 second');
end;
$$;

create or replace function public.ywi_rpc_attach_deposit_checkout(
  p_deposit_request_id uuid,
  p_checkout_session_id text,
  p_checkout_url text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deposit public.customer_deposit_requests%rowtype;
begin
  select * into deposit from public.customer_deposit_requests where id=p_deposit_request_id for update;
  if not found then raise exception 'Deposit request was not found.' using errcode='P0002'; end if;
  update public.customer_deposit_requests
    set deposit_status='checkout_created', checkout_session_id=p_checkout_session_id, checkout_url=p_checkout_url,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('checkout_payload',p_provider_payload,'rpc','ywi_rpc_attach_deposit_checkout'), updated_at=now()
    where id=deposit.id and deposit_status in ('requested','checkout_created') returning * into deposit;
  update public.estimate_quote_packages set deposit_status='checkout_created', updated_at=now() where id=deposit.quote_package_id and deposit_status <> 'paid';
  insert into public.customer_portal_events (quote_package_id, estimate_id, event_type, event_payload)
  values (deposit.quote_package_id, deposit.estimate_id, 'deposit_checkout_created', jsonb_build_object('deposit_request_id',deposit.id,'checkout_session_id',p_checkout_session_id,'requested_amount',deposit.requested_amount));
  return jsonb_build_object('deposit',to_jsonb(deposit));
end;
$$;

create or replace function public.ywi_rpc_record_portal_deposit_paid(
  p_deposit_request_id uuid,
  p_checkout_session_id text,
  p_payment_reference text,
  p_paid_amount numeric,
  p_currency_code text,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deposit public.customer_deposit_requests%rowtype;
  ar_payment_id uuid;
  payment_number text;
  action_key text;
begin
  select * into deposit from public.customer_deposit_requests where id=p_deposit_request_id for update;
  if not found then raise exception 'Deposit request was not found.' using errcode='P0002'; end if;
  if public.ywi_cents(p_paid_amount) <> public.ywi_cents(deposit.requested_amount) then raise exception 'Paid amount does not match the exact requested deposit.' using errcode='23514'; end if;
  if upper(coalesce(p_currency_code,deposit.currency_code,'CAD')) <> upper(coalesce(deposit.currency_code,'CAD')) then raise exception 'Currency does not match the deposit request.' using errcode='23514'; end if;
  if deposit.checkout_session_id is not null and p_checkout_session_id <> deposit.checkout_session_id then raise exception 'Checkout session does not match the deposit request.' using errcode='23514'; end if;

  if deposit.deposit_status <> 'paid' then
    update public.customer_deposit_requests
      set deposit_status='paid', paid_amount=public.ywi_money(p_paid_amount), paid_at=now(), payment_reference=p_payment_reference,
          checkout_session_id=coalesce(checkout_session_id,p_checkout_session_id),
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('rpc','ywi_rpc_record_portal_deposit_paid','provider_event',p_event_payload), updated_at=now()
      where id=deposit.id returning * into deposit;
    update public.estimate_quote_packages set deposit_status='paid', updated_at=now() where id=deposit.quote_package_id;

    if deposit.client_id is not null then
      payment_number := left('DEP-' || regexp_replace(coalesce(p_checkout_session_id,p_deposit_request_id::text),'[^A-Za-z0-9-]+','-','g'),80);
      insert into public.ar_payments(payment_number, client_id, payment_date, payment_method, reference_number, amount, unapplied_amount, application_status, notes)
      values (payment_number, deposit.client_id, current_date, 'stripe', p_payment_reference, deposit.paid_amount, deposit.paid_amount, 'unapplied', 'Customer portal deposit for quote package ' || deposit.quote_package_id)
      on conflict (payment_number) do update set reference_number=excluded.reference_number, amount=excluded.amount, unapplied_amount=excluded.unapplied_amount, updated_at=now()
      returning id into ar_payment_id;

      action_key := 'stripe_deposit_' || deposit.id::text;
      insert into public.payment_action_requests (
        action_key, idempotency_key, action_type, action_status, ledger_side, customer_or_vendor_name,
        payment_reference, amount, currency_code, reason, proof_required, proof_reference,
        ar_payment_id, posting_status, rollback_hint, metadata, updated_at
      ) values (
        action_key, action_key, 'overpayment_credit', 'submitted', 'ar', 'Portal customer',
        payment_number, deposit.paid_amount, upper(coalesce(deposit.currency_code,'CAD')), 'Record customer portal deposit as unapplied customer credit.', true,
        p_payment_reference, ar_payment_id, 'not_posted', 'Refund through Stripe, then post an approved reversal/refund action.',
        jsonb_build_object('build','2026-06-18a','schema',151,'deposit_request_id',deposit.id,'rpc','ywi_rpc_record_portal_deposit_paid'), now()
      ) on conflict (action_key) do update set payment_reference=excluded.payment_reference, amount=excluded.amount, ar_payment_id=excluded.ar_payment_id, updated_at=now();
    end if;

    insert into public.customer_portal_events (quote_package_id, estimate_id, event_type, event_payload)
    values (deposit.quote_package_id, deposit.estimate_id, 'deposit_paid', jsonb_build_object('deposit_request_id',deposit.id,'checkout_session_id',p_checkout_session_id,'ar_payment_id',ar_payment_id,'paid_amount',deposit.paid_amount,'provider_event',p_event_payload));
  end if;
  return jsonb_build_object('deposit',to_jsonb(deposit),'ar_payment_id',ar_payment_id);
end;
$$;

create or replace function public.ywi_rpc_mark_deposit_checkout_status(
  p_deposit_request_id uuid,
  p_deposit_status text,
  p_checkout_session_id text default null,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deposit public.customer_deposit_requests%rowtype;
begin
  if p_deposit_status not in ('processing','failed','expired','refunded','checkout_created') then raise exception 'Unsupported deposit status.' using errcode='23514'; end if;
  select * into deposit from public.customer_deposit_requests where id=p_deposit_request_id for update;
  if not found then raise exception 'Deposit request was not found.' using errcode='P0002'; end if;
  if deposit.deposit_status <> 'paid' then
    update public.customer_deposit_requests
      set deposit_status=p_deposit_status, checkout_session_id=coalesce(p_checkout_session_id,checkout_session_id),
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('rpc','ywi_rpc_mark_deposit_checkout_status','provider_event',p_event_payload), updated_at=now()
      where id=deposit.id returning * into deposit;
    update public.estimate_quote_packages set deposit_status=p_deposit_status, updated_at=now() where id=deposit.quote_package_id and deposit_status <> 'paid';
    insert into public.customer_portal_events (quote_package_id, estimate_id, event_type, event_status, event_payload)
    values (deposit.quote_package_id, deposit.estimate_id, 'deposit_' || p_deposit_status, p_deposit_status, jsonb_build_object('deposit_request_id',deposit.id,'checkout_session_id',p_checkout_session_id,'provider_event',p_event_payload));
  end if;
  return jsonb_build_object('deposit',to_jsonb(deposit));
end;
$$;

-- ---------------------------------------------------------------------------
-- Permission matrix and executable permission smoke tests for staging.
-- ---------------------------------------------------------------------------
create table if not exists public.operation_rpc_permission_tests (
  id uuid primary key default gen_random_uuid(),
  test_key text not null unique,
  rpc_name text not null,
  minimum_role text not null,
  minimum_rank integer not null,
  expected_allowed_roles text[] not null default array[]::text[],
  expected_blocked_roles text[] not null default array[]::text[],
  test_status text not null default 'defined',
  test_command text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.operation_rpc_permission_tests (
  test_key, rpc_name, minimum_role, minimum_rank, expected_allowed_roles, expected_blocked_roles, test_command, notes
) values
('rpc_post_payment_action_admin_only','ywi_rpc_post_payment_action','job_admin',45,array['job_admin','admin'],array['worker','staff','supervisor','hse'],'node scripts/operations-rpc-integration-test.mjs --suite payment','Posts AR/AP applications and journals atomically; blocked roles must receive 42501.'),
('rpc_promote_bank_import_admin_only','ywi_rpc_promote_bank_csv_import','job_admin',45,array['job_admin','admin'],array['worker','staff','supervisor','hse'],'node scripts/operations-rpc-integration-test.mjs --suite bank','Promotes preview/header/rows/session/items atomically.'),
('rpc_apply_reconciliation_admin_only','ywi_rpc_apply_reconciliation_action','job_admin',45,array['job_admin','admin'],array['worker','staff','supervisor','hse'],'node scripts/operations-rpc-integration-test.mjs --suite reconciliation','Validates exact split totals and persists explanations atomically.'),
('rpc_quote_accept_public_token_guarded','ywi_rpc_accept_quote_package','public_token',0,array['portal_token'],array['expired_quote','already_converted_duplicate'],'node scripts/operations-rpc-integration-test.mjs --suite quote','Converts accepted quote to one work order atomically and idempotently.'),
('rpc_deposit_paid_webhook_guarded','ywi_rpc_record_portal_deposit_paid','webhook_signature',0,array['stripe_webhook'],array['wrong_amount','wrong_currency','wrong_session'],'node scripts/operations-rpc-integration-test.mjs --suite deposit','Records paid deposit, AR payment, payment action, quote status, and event atomically.')
on conflict (test_key) do update set
  rpc_name=excluded.rpc_name, minimum_role=excluded.minimum_role, minimum_rank=excluded.minimum_rank,
  expected_allowed_roles=excluded.expected_allowed_roles, expected_blocked_roles=excluded.expected_blocked_roles,
  test_command=excluded.test_command, notes=excluded.notes, updated_at=now();

drop view if exists public.v_operation_rpc_permission_matrix;
create view public.v_operation_rpc_permission_matrix as
select test_key, rpc_name, minimum_role, minimum_rank, expected_allowed_roles, expected_blocked_roles,
       test_status, test_command, notes, updated_at
from public.operation_rpc_permission_tests
order by minimum_rank desc, rpc_name;

update public.admin_scorecard_progress_rails
set progress_percent = case rail_key
  when 'payment_actions_live' then greatest(progress_percent, 92)
  when 'bank_csv_preview_live' then greatest(progress_percent, 92)
  when 'operations_cockpit_live' then greatest(progress_percent, 92)
  when 'customer_portal_live' then greatest(progress_percent, 88)
  else progress_percent end,
  next_action_hint = case rail_key
    when 'payment_actions_live' then 'Run transactional RPC integration tests against staging and map final chart-of-accounts IDs.'
    when 'bank_csv_preview_live' then 'Run bank CSV promotion and exact reconciliation split tests with staging data.'
    when 'customer_portal_live' then 'Run quote acceptance, reusable deposit checkout, and Stripe webhook tests in staging.'
    else next_action_hint end,
  metadata = coalesce(metadata,'{}'::jsonb) || '{"build":"2026-06-18a","schema":151,"transactional_rpc":true}'::jsonb,
  updated_at = now()
where rail_key in ('payment_actions_live','bank_csv_preview_live','operations_cockpit_live','customer_portal_live');

-- Schema marker.
drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 151::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 151 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 151
       then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 151.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  151,
  '151_transactional_rpc_accounting_reconciliation_quote_tests',
  '151_transactional_rpc_accounting_reconciliation_quote_tests.sql',
  '2026-06-18a',
  'Moves accounting posting, bank CSV promotion, reconciliation actions, quote acceptance, and portal deposit recording into transactional PostgreSQL RPCs with role-permission test definitions.',
  'applied',
  'Edge Functions now delegate multi-row writes to RPCs so failures roll back cleanly and staging tests can verify role gates and idempotency.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name,
  release_label=excluded.release_label, description=excluded.description,
  status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_rpc_post_payment_action(uuid,uuid) from public;
revoke all on function public.ywi_rpc_promote_bank_csv_import(uuid,uuid,uuid,numeric,text) from public;
revoke all on function public.ywi_rpc_apply_reconciliation_action(jsonb,uuid) from public;
revoke all on function public.ywi_rpc_accept_quote_package(uuid,text,text,boolean,text,text,text,text) from public;
revoke all on function public.ywi_rpc_prepare_deposit_request(uuid,text,text) from public;
revoke all on function public.ywi_rpc_attach_deposit_checkout(uuid,text,text,jsonb) from public;
revoke all on function public.ywi_rpc_record_portal_deposit_paid(uuid,text,text,numeric,text,jsonb) from public;
revoke all on function public.ywi_rpc_mark_deposit_checkout_status(uuid,text,text,jsonb) from public;

grant execute on function public.ywi_rpc_post_payment_action(uuid,uuid) to service_role;
grant execute on function public.ywi_rpc_promote_bank_csv_import(uuid,uuid,uuid,numeric,text) to service_role;
grant execute on function public.ywi_rpc_apply_reconciliation_action(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_accept_quote_package(uuid,text,text,boolean,text,text,text,text) to service_role;
grant execute on function public.ywi_rpc_prepare_deposit_request(uuid,text,text) to service_role;
grant execute on function public.ywi_rpc_attach_deposit_checkout(uuid,text,text,jsonb) to service_role;
grant execute on function public.ywi_rpc_record_portal_deposit_paid(uuid,text,text,numeric,text,jsonb) to service_role;
grant execute on function public.ywi_rpc_mark_deposit_checkout_status(uuid,text,text,jsonb) to service_role;
grant select on public.operation_rpc_permission_tests to authenticated;
grant select on public.v_operation_rpc_permission_matrix to authenticated;

commit;
