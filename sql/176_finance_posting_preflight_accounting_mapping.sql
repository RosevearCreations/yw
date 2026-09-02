-- 176_finance_posting_preflight_accounting_mapping.sql
-- Build 2026-09-02h
-- Maps Schema 172/175 Finance completion candidates onto the existing AR/GL accounting engine
-- and adds a read-only paired posting preflight. This release does NOT create posting rows,
-- AR invoices, GL batches/entries, payments, provider mutations or Jobs writeback.

begin;

create or replace view public.v_finance_posting_account_mapping_authority
with (security_invoker=true)
as
select
  r.mapping_key,
  r.source_key,
  r.target_label,
  r.account_id,
  a.account_number,
  a.account_name,
  a.account_type,
  a.system_code,
  r.review_status,
  r.is_required,
  r.is_active as mapping_is_active,
  coalesce(a.is_active,false) as account_is_active,
  (r.is_active and r.review_status='approved' and r.account_id is not null and coalesce(a.is_active,false)) as mapping_approved
from public.accountant_export_mapping_rules r
left join public.chart_of_accounts a on a.id=r.account_id
where r.mapping_type='account'
  and r.mapping_key in ('accounts_receivable','service_revenue','sales_tax_payable');

revoke all on table public.v_finance_posting_account_mapping_authority from public,anon,authenticated;
grant select on table public.v_finance_posting_account_mapping_authority to service_role;

create or replace function public.ywi_finance_job_completion_posting_preflight(p_intake_id uuid)
returns table(
  finance_intake_id uuid,
  posting_approval_id uuid,
  preflight_status text,
  invoice_mapping_status text,
  journal_mapping_status text,
  paired_consistency_status text,
  blockers jsonb,
  invoice_plan jsonb,
  journal_plan jsonb,
  execution_authorized boolean,
  provider_mutation_authorized boolean,
  checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_disposition public.finance_job_completion_review_dispositions%rowtype;
  v_approval public.finance_job_completion_posting_approvals%rowtype;
  v_invoice public.job_invoice_candidates%rowtype;
  v_journal public.job_journal_candidates%rowtype;
  v_review public.job_completion_reviews%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_invoice_ok boolean := true;
  v_journal_ok boolean := true;
  v_pair_ok boolean := true;
  v_ar_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_ar_mapping_status text;
  v_revenue_mapping_status text;
  v_tax_mapping_status text;
  v_journal_revenue numeric := 0;
  v_journal_cost numeric := 0;
  v_journal_profit numeric := 0;
  v_credit_total numeric := 0;
  v_invoice_plan jsonb := '{}'::jsonb;
  v_journal_plan jsonb := '{}'::jsonb;
begin
  select * into v_intake from public.finance_job_completion_intake where id=p_intake_id;
  if v_intake.id is null then
    return query select p_intake_id,null::uuid,'blocked'::text,'blocked'::text,'blocked'::text,'blocked'::text,
      jsonb_build_array(jsonb_build_object('code','FINANCE_INTAKE_NOT_FOUND','message','Canonical Finance completion intake was not found.')),
      '{}'::jsonb,'{}'::jsonb,false,false,now();
    return;
  end if;

  select * into v_disposition from public.finance_job_completion_review_dispositions where intake_id=v_intake.id;
  select * into v_approval from public.finance_job_completion_posting_approvals where intake_id=v_intake.id;

  if v_disposition.id is null or v_disposition.disposition_status<>'approved' or v_disposition.candidate_generation_status<>'generated' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','FINANCE_APPROVED_CANDIDATE_PAIR_REQUIRED','message','Approved Finance disposition with generated invoice and journal candidates is required.'));
    v_invoice_ok := false; v_journal_ok := false; v_pair_ok := false;
  end if;

  if v_disposition.id is not null then
    select * into v_invoice from public.job_invoice_candidates where id=v_disposition.invoice_candidate_id;
    select * into v_journal from public.job_journal_candidates where id=v_disposition.journal_candidate_id;
  end if;
  select * into v_review from public.job_completion_reviews where id=v_intake.completion_review_id;

  if v_approval.id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','POSTING_APPROVAL_REQUIRED','message','Separate Schema 175 Finance posting approval is required before execution can ever be released.'));
    v_pair_ok := false;
  elsif v_approval.execution_status<>'not_released' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','EXECUTION_STATUS_INVALID','message','Posting approval execution_status must remain not_released during Build 176.'));
    v_pair_ok := false;
  end if;

  if v_invoice.id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_CANDIDATE_MISSING','message','Canonical invoice candidate is missing.'));
    v_invoice_ok := false; v_pair_ok := false;
  else
    if v_invoice.candidate_status<>'draft' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_CANDIDATE_NOT_DRAFT','message','Schema 172 invoice candidate must remain draft.'));
      v_invoice_ok := false;
    end if;
    if v_invoice.client_id is null or v_invoice.work_order_id is null then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_CANONICAL_REFERENCE_MISSING','message','Invoice candidate requires canonical client and work-order identities.'));
      v_invoice_ok := false;
    end if;
    if round(coalesce(v_invoice.total_amount,0),2)<>round(coalesce(v_invoice.subtotal,0)+coalesce(v_invoice.tax_total,0),2) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_TOTAL_MISMATCH','message','Invoice total must equal canonical subtotal plus tax.'));
      v_invoice_ok := false; v_pair_ok := false;
    end if;
    if coalesce(v_invoice.payload->>'candidate_authority','')<>'schema172_finance_review'
       or coalesce(v_invoice.payload->>'finance_intake_id','')<>v_intake.id::text
       or coalesce(v_invoice.payload->>'finance_disposition_id','')<>coalesce(v_disposition.id::text,'')
       or coalesce(v_invoice.payload->>'posting_authorized','false')<>'false'
       or coalesce(v_invoice.payload->>'provider_mutation','false')<>'false' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_AUTHORITY_INVALID','message','Invoice candidate authority/provenance markers are not valid for Build 176 preflight.'));
      v_invoice_ok := false; v_pair_ok := false;
    end if;
    if exists(select 1 from public.job_invoice_postings where invoice_candidate_id=v_invoice.id) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','INVOICE_POSTING_ALREADY_EXISTS','message','A job_invoice_postings row already exists for this candidate; automated execution remains fail-closed.'));
      v_invoice_ok := false; v_pair_ok := false;
    end if;
  end if;

  if v_journal.id is null then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_CANDIDATE_MISSING','message','Canonical journal candidate is missing.'));
    v_journal_ok := false; v_pair_ok := false;
  else
    if v_journal.candidate_status<>'draft' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_CANDIDATE_NOT_DRAFT','message','Schema 172 journal candidate must remain draft.'));
      v_journal_ok := false;
    end if;
    if coalesce(v_journal.payload->>'candidate_authority','')<>'schema172_finance_review'
       or coalesce(v_journal.payload->>'finance_intake_id','')<>v_intake.id::text
       or coalesce(v_journal.payload->>'finance_disposition_id','')<>coalesce(v_disposition.id::text,'')
       or coalesce(v_journal.payload->>'posting_authorized','false')<>'false'
       or coalesce(v_journal.payload->>'provider_mutation','false')<>'false' then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_AUTHORITY_INVALID','message','Journal candidate authority/provenance markers are not valid for Build 176 preflight.'));
      v_journal_ok := false; v_pair_ok := false;
    end if;
    if v_journal.ledger_summary ?| array['debit_account_id','credit_account_id','debit','credit','posted_batch_id'] then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_CANDIDATE_ASSERTS_LEDGER_EXECUTION','message','Schema 172 documentary journal candidate may not supply posting accounts or posted batch truth.'));
      v_journal_ok := false; v_pair_ok := false;
    end if;
    if exists(select 1 from public.job_journal_postings where journal_candidate_id=v_journal.id) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_POSTING_ALREADY_EXISTS','message','A job_journal_postings row already exists for this candidate; automated execution remains fail-closed.'));
      v_journal_ok := false; v_pair_ok := false;
    end if;
    begin
      v_journal_revenue := coalesce((v_journal.ledger_summary->>'revenue_total')::numeric,0);
      v_journal_cost := coalesce((v_journal.ledger_summary->>'cost_total')::numeric,0);
      v_journal_profit := coalesce((v_journal.ledger_summary->>'profit_total')::numeric,0);
    exception when others then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','JOURNAL_DOCUMENTARY_TOTAL_INVALID','message','Journal documentary totals are not valid numeric values.'));
      v_journal_ok := false; v_pair_ok := false;
    end;
  end if;

  if v_invoice.id is not null and v_journal.id is not null then
    if v_invoice.job_id<>v_journal.job_id
       or v_invoice.completion_review_id<>v_journal.completion_review_id
       or v_invoice.job_id<>v_intake.job_id
       or v_invoice.completion_review_id<>v_intake.completion_review_id then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','PAIR_IDENTITY_MISMATCH','message','Invoice and journal candidates must resolve to the same canonical intake/job/completion review.'));
      v_pair_ok := false;
    end if;
    if round(coalesce(v_invoice.subtotal,0),2)<>round(coalesce(v_journal_revenue,0),2) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','PAIR_REVENUE_MISMATCH','message','Invoice subtotal must equal the documentary journal revenue total before paired posting can be released.'));
      v_pair_ok := false;
    end if;
    if round(coalesce(v_journal_revenue,0)-coalesce(v_journal_cost,0),2)<>round(coalesce(v_journal_profit,0),2) then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','PAIR_PROFIT_MISMATCH','message','Documentary journal profit must equal revenue less cost.'));
      v_pair_ok := false;
    end if;
  end if;

  if v_approval.id is not null and v_disposition.id is not null then
    if v_approval.disposition_id<>v_disposition.id
       or v_approval.source_event_id<>v_intake.source_event_id
       or v_approval.job_id<>v_intake.job_id
       or v_approval.completion_review_id<>v_intake.completion_review_id
       or v_approval.invoice_candidate_id is distinct from v_disposition.invoice_candidate_id
       or v_approval.journal_candidate_id is distinct from v_disposition.journal_candidate_id then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','POSTING_APPROVAL_PAIR_MISMATCH','message','Schema 175 posting approval does not match the canonical disposition/candidate pair.'));
      v_pair_ok := false;
    end if;
  end if;

  select m.account_id,m.review_status into v_ar_account_id,v_ar_mapping_status
  from public.v_finance_posting_account_mapping_authority m where m.mapping_key='accounts_receivable' and m.mapping_approved limit 1;
  if v_ar_account_id is null then
    select review_status into v_ar_mapping_status from public.v_finance_posting_account_mapping_authority where mapping_key='accounts_receivable' limit 1;
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','AR_ACCOUNT_MAPPING_NOT_APPROVED','message','Accounts Receivable mapping must be accountant/bookkeeper approved before posting execution.','review_status',coalesce(v_ar_mapping_status,'missing')));
    v_journal_ok := false;
  end if;

  select m.account_id,m.review_status into v_revenue_account_id,v_revenue_mapping_status
  from public.v_finance_posting_account_mapping_authority m where m.mapping_key='service_revenue' and m.mapping_approved limit 1;
  if v_revenue_account_id is null then
    select review_status into v_revenue_mapping_status from public.v_finance_posting_account_mapping_authority where mapping_key='service_revenue' limit 1;
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','REVENUE_ACCOUNT_MAPPING_NOT_APPROVED','message','Service revenue mapping must be accountant/bookkeeper approved before posting execution.','review_status',coalesce(v_revenue_mapping_status,'missing')));
    v_journal_ok := false;
  end if;

  if coalesce(v_invoice.tax_total,0)>0 then
    select m.account_id,m.review_status into v_tax_account_id,v_tax_mapping_status
    from public.v_finance_posting_account_mapping_authority m where m.mapping_key='sales_tax_payable' and m.mapping_approved limit 1;
    if v_tax_account_id is null then
      select review_status into v_tax_mapping_status from public.v_finance_posting_account_mapping_authority where mapping_key='sales_tax_payable' limit 1;
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','TAX_ACCOUNT_MAPPING_NOT_APPROVED','message','Sales tax payable mapping must be accountant/bookkeeper approved when invoice tax is non-zero.','review_status',coalesce(v_tax_mapping_status,'missing')));
      v_journal_ok := false;
    end if;
  end if;

  if v_review.id is null or v_review.accounting_ready is not true then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','COMPLETION_REVIEW_NOT_ACCOUNTING_READY','message','Canonical Jobs completion review must remain accounting-ready.'));
    v_invoice_ok := false; v_journal_ok := false; v_pair_ok := false;
  end if;

  v_credit_total := round(coalesce(v_invoice.subtotal,0)+coalesce(v_invoice.tax_total,0),2);
  if v_invoice.id is not null and round(coalesce(v_invoice.total_amount,0),2)<>v_credit_total then
    v_journal_ok := false; v_pair_ok := false;
  end if;

  v_invoice_plan := jsonb_build_object(
    'posting_envelope_table','job_invoice_postings',
    'accounting_target_table','ar_invoices',
    'invoice_candidate_id',v_invoice.id,
    'posting_approval_id',v_approval.id,
    'idempotency_key',v_approval.idempotency_key,
    'mapped_fields',jsonb_build_object(
      'client_id',v_invoice.client_id,
      'work_order_id',v_invoice.work_order_id,
      'invoice_status','draft',
      'invoice_date_source','execution_date',
      'due_date_source','approved_terms_policy',
      'subtotal',v_invoice.subtotal,
      'tax_total',v_invoice.tax_total,
      'total_amount',v_invoice.total_amount,
      'balance_due',v_invoice.total_amount,
      'invoice_source','job'
    ),
    'creates_rows',false,
    'posting_execution_authorized',false
  );

  v_journal_plan := jsonb_build_object(
    'posting_envelope_table','job_journal_postings',
    'batch_target_table','gl_journal_batches',
    'entry_target_table','gl_journal_entries',
    'journal_candidate_id',v_journal.id,
    'posting_approval_id',v_approval.id,
    'idempotency_key',v_approval.idempotency_key,
    'batch',jsonb_build_object(
      'source_module','finance',
      'source_record_type','finance_job_completion_posting_approval',
      'source_record_id',v_approval.id,
      'batch_status','draft',
      'memo',coalesce(v_journal.journal_memo,'Job completion invoice recognition preflight')
    ),
    'proposed_entries',jsonb_build_array(
      jsonb_build_object('line',1,'account_mapping_key','accounts_receivable','account_id',v_ar_account_id,'debit_amount',coalesce(v_invoice.total_amount,0),'credit_amount',0),
      jsonb_build_object('line',2,'account_mapping_key','service_revenue','account_id',v_revenue_account_id,'debit_amount',0,'credit_amount',coalesce(v_invoice.subtotal,0))
    ) || case when coalesce(v_invoice.tax_total,0)>0 then jsonb_build_array(
      jsonb_build_object('line',3,'account_mapping_key','sales_tax_payable','account_id',v_tax_account_id,'debit_amount',0,'credit_amount',coalesce(v_invoice.tax_total,0))
    ) else '[]'::jsonb end,
    'documentary_cost_total',v_journal_cost,
    'documentary_profit_total',v_journal_profit,
    'debit_total',coalesce(v_invoice.total_amount,0),
    'credit_total',v_credit_total,
    'is_balanced',round(coalesce(v_invoice.total_amount,0),2)=v_credit_total,
    'creates_rows',false,
    'posting_execution_authorized',false
  );

  return query select
    v_intake.id,
    v_approval.id,
    case when v_invoice_ok and v_journal_ok and v_pair_ok and v_approval.id is not null
      then 'passed_execution_closed' else 'blocked' end,
    case when v_invoice_ok then 'mapped' else 'blocked' end,
    case when v_journal_ok then 'mapped' else 'blocked' end,
    case when v_pair_ok then 'consistent' else 'blocked' end,
    v_blockers,
    v_invoice_plan,
    v_journal_plan,
    false,
    false,
    now();
end;
$$;

revoke all on function public.ywi_finance_job_completion_posting_preflight(uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_job_completion_posting_preflight(uuid) to service_role;

create or replace view public.v_finance_job_completion_posting_preflight_queue
with (security_invoker=true)
as
select
  q.*,
  pf.preflight_status,
  pf.invoice_mapping_status,
  pf.journal_mapping_status,
  pf.paired_consistency_status,
  pf.blockers,
  pf.invoice_plan,
  pf.journal_plan,
  pf.execution_authorized,
  pf.provider_mutation_authorized,
  pf.checked_at as preflight_checked_at
from public.v_finance_job_completion_posting_approval_queue q
cross join lateral public.ywi_finance_job_completion_posting_preflight(q.intake_id) pf;

revoke all on table public.v_finance_job_completion_posting_preflight_queue from public,anon,authenticated;
grant select on table public.v_finance_job_completion_posting_preflight_queue to service_role;

create or replace view public.v_it_finance_posting_preflight_status
with (security_invoker=true)
as
select
  (select count(*) from public.v_finance_job_completion_posting_preflight_queue)::int as candidate_pair_count,
  (select count(*) from public.v_finance_job_completion_posting_preflight_queue where preflight_status='passed_execution_closed')::int as preflight_pass_count,
  (select count(*) from public.v_finance_job_completion_posting_preflight_queue where preflight_status='blocked')::int as preflight_blocked_count,
  (select count(*) from public.v_finance_posting_account_mapping_authority where mapping_approved)::int as approved_required_posting_mapping_count,
  (select count(*) from public.v_finance_posting_account_mapping_authority)::int as required_posting_mapping_count,
  false as posting_execution_authorized,
  false as provider_mutation_authorized,
  now() as checked_at;

revoke all on table public.v_it_finance_posting_preflight_status from public,anon,authenticated;
grant select on table public.v_it_finance_posting_preflight_status to service_role;

create or replace function public.ywi_finance_posting_preflight_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'posting_preflight_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name in ('v_finance_posting_account_mapping_authority','v_finance_job_completion_posting_preflight_queue','v_it_finance_posting_preflight_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 176 preflight/mapping surfaces remain private service control-plane data.'
  union all
  select 'posting_preflight_rpc_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_finance_job_completion_posting_preflight'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Read-only posting preflight is reachable only through the authenticated Finance Edge boundary/service role.'
  union all
  select 'posting_preflight_function_read_only',
    case when lower(pg_get_functiondef('public.ywi_finance_job_completion_posting_preflight(uuid)'::regprocedure)) !~ '\m(insert|update|delete|merge|truncate)\M[[:space:]]+(into[[:space:]]+|from[[:space:]]+)?public\.'
      then 'passed' else 'failed' end,
    'Preflight function contains no public-table DML.'
  union all
  select 'posting_execution_guards_retained',
    case when exists(select 1 from pg_trigger where tgrelid='public.job_invoice_postings'::regclass and tgname='trg_guard_schema172_invoice_posting_closed' and not tgisinternal)
           and exists(select 1 from pg_trigger where tgrelid='public.job_journal_postings'::regclass and tgname='trg_guard_schema172_journal_posting_closed' and not tgisinternal)
      then 'passed' else 'failed' end,
    'Schema 175 posting-execution guards remain installed on both posting envelopes.'
  union all
  select 'posting_mapping_uses_existing_accounting_authority',
    case when to_regclass('public.job_invoice_postings') is not null
           and to_regclass('public.ar_invoices') is not null
           and to_regclass('public.job_journal_postings') is not null
           and to_regclass('public.gl_journal_batches') is not null
           and to_regclass('public.gl_journal_entries') is not null
           and to_regclass('public.accountant_export_mapping_rules') is not null
           and to_regclass('public.chart_of_accounts') is not null
      then 'passed' else 'failed' end,
    'Build 176 maps into existing YW posting, AR, GL and account-mapping authorities rather than parallel tables.'
  union all
  select 'posting_mapping_requires_accountant_approval',
    case when not exists(
      select 1 from public.v_finance_posting_account_mapping_authority
      where mapping_approved and (account_id is null or account_is_active is false or review_status<>'approved')
    ) then 'passed' else 'failed' end,
    'Only explicitly approved active account mappings may pass posting preflight.'
  union all
  select 'paired_preflight_execution_closed',
    case when not exists(
      select 1 from public.v_finance_job_completion_posting_preflight_queue
      where execution_authorized or provider_mutation_authorized
    ) then 'passed' else 'failed' end,
    'A passing Build 176 preflight still cannot authorize accounting or provider execution.'
  union all
  select 'schema172_posting_rows_still_absent',
    case when not exists(
      select 1 from public.job_invoice_postings p join public.job_invoice_candidates c on c.id=p.invoice_candidate_id where c.payload->>'candidate_authority'='schema172_finance_review'
    ) and not exists(
      select 1 from public.job_journal_postings p join public.job_journal_candidates c on c.id=p.journal_candidate_id where c.payload->>'candidate_authority'='schema172_finance_review'
    ) then 'passed' else 'failed' end,
    'Build 176 creates no Schema 172 invoice/journal posting-envelope rows.';
$$;

revoke all on function public.ywi_finance_posting_preflight_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_posting_preflight_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('invoice_posting_candidate','public','job_invoice_postings','invoice_candidate_id','uuid','finance',98,176,true,'Existing invoice posting envelope candidate identity.'),
  ('invoice_posting_ar_invoice','public','job_invoice_postings','ar_invoice_id','uuid','finance',101,176,true,'Existing AR invoice link used by Finance execution mapping.'),
  ('journal_posting_candidate','public','job_journal_postings','journal_candidate_id','uuid','finance',98,176,true,'Existing journal posting envelope candidate identity.'),
  ('journal_posting_gl_batch','public','job_journal_postings','gl_batch_id','uuid','finance',101,176,true,'Existing GL batch link used by Finance execution mapping.'),
  ('ar_invoice_client','public','ar_invoices','client_id','uuid','finance',1,176,true,'Canonical AR customer identity.'),
  ('ar_invoice_work_order','public','ar_invoices','work_order_id','uuid','finance',1,176,true,'Canonical AR work-order source identity.'),
  ('ar_invoice_subtotal','public','ar_invoices','subtotal','numeric','finance',1,176,true,'AR subtotal target.'),
  ('ar_invoice_tax_total','public','ar_invoices','tax_total','numeric','finance',1,176,true,'AR tax target.'),
  ('ar_invoice_total_amount','public','ar_invoices','total_amount','numeric','finance',1,176,true,'AR total target.'),
  ('ar_invoice_balance_due','public','ar_invoices','balance_due','numeric','finance',1,176,true,'AR initial balance target.'),
  ('ar_invoice_source','public','ar_invoices','invoice_source','text','finance',81,176,true,'AR source classifier must support job.'),
  ('gl_batch_status','public','gl_journal_batches','batch_status','text','finance',1,176,true,'Existing GL draft/review/posted/void state authority.'),
  ('gl_batch_source_module','public','gl_journal_batches','source_module','text','finance',1,176,true,'GL source-module provenance.'),
  ('gl_batch_source_record_id','public','gl_journal_batches','source_record_id','uuid','finance',67,176,true,'GL source-record provenance identity.'),
  ('gl_entry_batch','public','gl_journal_entries','batch_id','uuid','finance',1,176,true,'Balanced journal line batch identity.'),
  ('gl_entry_account','public','gl_journal_entries','account_id','uuid','finance',1,176,true,'Chart-of-accounts identity for a GL line.'),
  ('gl_entry_debit','public','gl_journal_entries','debit_amount','numeric','finance',1,176,true,'GL debit amount.'),
  ('gl_entry_credit','public','gl_journal_entries','credit_amount','numeric','finance',1,176,true,'GL credit amount.'),
  ('posting_mapping_rule_key','public','accountant_export_mapping_rules','mapping_key','text','finance',153,176,true,'Accountant-reviewed account mapping key.'),
  ('posting_mapping_rule_account','public','accountant_export_mapping_rules','account_id','uuid','finance',153,176,true,'Accountant-reviewed chart-of-accounts target.'),
  ('posting_mapping_rule_review','public','accountant_export_mapping_rules','review_status','text','finance',153,176,true,'Account mapping approval state.'),
  ('posting_chart_account_system_code','public','chart_of_accounts','system_code','text','finance',1,176,true,'Canonical system account code used by seeded mappings.'),
  ('posting_chart_account_active','public','chart_of_accounts','is_active','boolean','finance',1,176,true,'Mapped ledger account must remain active.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_posting_preflight_accounting_mapping','Finance','Finance posting preflight and accounting-engine mapping','critical',
  'Repair failed Schema 176 preflight assertions or approve the required accountant mapping rules before any posting-execution release.','Admin > I.T. Readiness',45,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=10,target_value=10,
    next_action_hint='Schema 175 posting approval/idempotency/provenance safety remains the prerequisite for Build 176 preflight.',
    updated_at=now()
where rail_key='schema175_finance_posting_safety_foundation';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema176_finance_posting_preflight_accounting_mapping','finance','Finance posting preflight and existing accounting-engine mapping','active',90,9,10,
  'Merge the exact green Schema 176 source SHA, verify live read-only preflight assertions/dependency contracts, and record exact-main release evidence. Accountant mapping approvals remain a separate human accounting decision.',
  'Finance / I.T. / Accounting',96,
  '{"build":"2026-09-02h","schema":176,"existing_ar_gl_authority":true,"paired_preflight":true,"accountant_mapping_required":true,"posting_execution":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  176,'176_finance_posting_preflight_accounting_mapping','176_finance_posting_preflight_accounting_mapping.sql','2026-09-02h',
  'Maps approved Finance completion candidate pairs onto existing AR/GL authorities and adds a non-mutating posting preflight with paired consistency/account-mapping checks.',
  'applied',
  'Posting execution remains closed. No posting rows, AR invoices, GL batches/entries, payments, Jobs writeback, provider mutation, fifth module or Production promotion is introduced.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 176::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=176 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=176
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 176 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
