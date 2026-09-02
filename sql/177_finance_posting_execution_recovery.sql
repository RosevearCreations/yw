-- 177_finance_posting_execution_recovery.sql
-- Build 2026-09-02i
-- Adds controlled, atomic Finance posting execution, retry/recovery detection and explicit reversal authority.
-- Execution machinery is installed fail-closed: the release control is seeded disabled and provider mutation stays forbidden.

begin;

create table if not exists public.finance_job_completion_posting_execution_controls (
  control_key text primary key,
  execution_enabled boolean not null default false,
  provider_mutation_enabled boolean not null default false,
  required_schema_version integer not null default 177,
  release_note text not null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint finance_posting_execution_control_provider_chk check (provider_mutation_enabled=false)
);

insert into public.finance_job_completion_posting_execution_controls(
  control_key,execution_enabled,provider_mutation_enabled,required_schema_version,release_note
) values(
  'finance_job_completion_v1',false,false,177,
  'Schema 177 execution machinery is installed but live execution remains disabled until accountant mappings, preflight, release evidence and deliberate I.T. release authority agree.'
)
on conflict(control_key) do update set
  required_schema_version=excluded.required_schema_version,
  provider_mutation_enabled=false,
  release_note=excluded.release_note,
  updated_at=now();

alter table public.finance_job_completion_posting_execution_controls enable row level security;
revoke all on table public.finance_job_completion_posting_execution_controls from public,anon,authenticated,service_role;
grant select on table public.finance_job_completion_posting_execution_controls to service_role;

create table if not exists public.finance_job_completion_posting_execution_runs (
  id uuid primary key default gen_random_uuid(),
  posting_approval_id uuid not null unique references public.finance_job_completion_posting_approvals(id) on delete restrict,
  intake_id uuid not null unique references public.finance_job_completion_intake(id) on delete restrict,
  idempotency_key text not null unique,
  execution_status text not null default 'running',
  attempt_count integer not null default 1,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  invoice_posting_id uuid references public.job_invoice_postings(id) on delete restrict,
  ar_invoice_id uuid references public.ar_invoices(id) on delete restrict,
  journal_posting_id uuid references public.job_journal_postings(id) on delete restrict,
  gl_batch_id uuid references public.gl_journal_batches(id) on delete restrict,
  last_error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb,
  constraint finance_posting_execution_run_status_chk check (execution_status in ('running','completed','failed','recovery_required','reversed')),
  constraint finance_posting_execution_run_attempt_chk check (attempt_count between 1 and 100),
  constraint finance_posting_execution_run_idempotency_chk check (idempotency_key='schema177-finance-posting:' || posting_approval_id::text)
);

create index if not exists idx_finance_posting_execution_runs_status
  on public.finance_job_completion_posting_execution_runs(execution_status,updated_at desc);

alter table public.finance_job_completion_posting_execution_runs enable row level security;
revoke all on table public.finance_job_completion_posting_execution_runs from public,anon,authenticated,service_role;
grant select on table public.finance_job_completion_posting_execution_runs to service_role;

create table if not exists public.finance_job_completion_posting_reversals (
  id uuid primary key default gen_random_uuid(),
  execution_run_id uuid not null unique references public.finance_job_completion_posting_execution_runs(id) on delete restrict,
  posting_approval_id uuid not null unique references public.finance_job_completion_posting_approvals(id) on delete restrict,
  reversal_status text not null default 'running',
  reason text not null,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  original_ar_invoice_id uuid not null references public.ar_invoices(id) on delete restrict,
  original_gl_batch_id uuid not null references public.gl_journal_batches(id) on delete restrict,
  reversal_gl_batch_id uuid references public.gl_journal_batches(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text,
  provenance jsonb not null default '{}'::jsonb,
  constraint finance_posting_reversal_status_chk check (reversal_status in ('running','completed','failed')),
  constraint finance_posting_reversal_reason_chk check (length(btrim(reason)) between 3 and 2000)
);

alter table public.finance_job_completion_posting_reversals enable row level security;
revoke all on table public.finance_job_completion_posting_reversals from public,anon,authenticated,service_role;
grant select on table public.finance_job_completion_posting_reversals to service_role;

create unique index if not exists uq_job_invoice_postings_schema177_finance_approval
  on public.job_invoice_postings ((posting_payload->>'finance_posting_approval_id'))
  where posting_payload->>'posting_authority'='schema177_finance_posting_execution';
create unique index if not exists uq_job_journal_postings_schema177_finance_approval
  on public.job_journal_postings ((posting_payload->>'finance_posting_approval_id'))
  where posting_payload->>'posting_authority'='schema177_finance_posting_execution';

-- Replace the Schema 175 closed guards with a narrower Schema 177 execution guard.
-- The trigger names remain unchanged so prior release assertions remain auditable.
create or replace function public.ywi_guard_schema172_invoice_posting_closed()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_candidate public.job_invoice_candidates%rowtype;
  v_run public.finance_job_completion_posting_execution_runs%rowtype;
  v_reversal public.finance_job_completion_posting_reversals%rowtype;
  v_approval_id uuid;
  v_run_id uuid;
  v_reversal_id uuid;
begin
  select * into v_candidate from public.job_invoice_candidates where id=new.invoice_candidate_id;
  if v_candidate.id is null or coalesce(v_candidate.payload->>'candidate_authority','')<>'schema172_finance_review' then
    return new;
  end if;

  if coalesce(new.posting_payload->>'posting_authority','')<>'schema177_finance_posting_execution'
     or coalesce(new.posting_payload->>'provider_mutation','false')<>'false' then
    raise exception 'Schema 172 Finance invoice postings require Schema 177 controlled execution authority and provider mutation=false.';
  end if;

  v_approval_id := nullif(new.posting_payload->>'finance_posting_approval_id','')::uuid;
  v_run_id := nullif(new.posting_payload->>'execution_run_id','')::uuid;
  select * into v_run from public.finance_job_completion_posting_execution_runs where id=v_run_id;
  if v_run.id is null or v_run.posting_approval_id<>v_approval_id or v_run.intake_id::text<>coalesce(v_candidate.payload->>'finance_intake_id','') then
    raise exception 'Schema 177 invoice posting execution run/provenance is invalid.';
  end if;

  if new.posting_status='posted' then
    if v_run.execution_status not in ('running','completed') then
      raise exception 'Schema 177 invoice posting requires an active or completed execution run.';
    end if;
    if not exists(select 1 from public.finance_job_completion_posting_execution_controls where control_key='finance_job_completion_v1' and execution_enabled and provider_mutation_enabled=false) then
      raise exception 'Schema 177 Finance posting execution release is disabled.';
    end if;
  elsif new.posting_status='reversed' then
    v_reversal_id := nullif(new.posting_payload->>'reversal_id','')::uuid;
    select * into v_reversal from public.finance_job_completion_posting_reversals where id=v_reversal_id;
    if v_reversal.id is null or v_reversal.execution_run_id<>v_run.id or v_reversal.reversal_status not in ('running','completed') then
      raise exception 'Schema 177 invoice reversal provenance is invalid.';
    end if;
  else
    raise exception 'Schema 177 Finance invoice posting status must be posted or reversed.';
  end if;

  return new;
end;
$$;

create or replace function public.ywi_guard_schema172_journal_posting_closed()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_candidate public.job_journal_candidates%rowtype;
  v_run public.finance_job_completion_posting_execution_runs%rowtype;
  v_reversal public.finance_job_completion_posting_reversals%rowtype;
  v_approval_id uuid;
  v_run_id uuid;
  v_reversal_id uuid;
begin
  select * into v_candidate from public.job_journal_candidates where id=new.journal_candidate_id;
  if v_candidate.id is null or coalesce(v_candidate.payload->>'candidate_authority','')<>'schema172_finance_review' then
    return new;
  end if;

  if coalesce(new.posting_payload->>'posting_authority','')<>'schema177_finance_posting_execution'
     or coalesce(new.posting_payload->>'provider_mutation','false')<>'false' then
    raise exception 'Schema 172 Finance journal postings require Schema 177 controlled execution authority and provider mutation=false.';
  end if;

  v_approval_id := nullif(new.posting_payload->>'finance_posting_approval_id','')::uuid;
  v_run_id := nullif(new.posting_payload->>'execution_run_id','')::uuid;
  select * into v_run from public.finance_job_completion_posting_execution_runs where id=v_run_id;
  if v_run.id is null or v_run.posting_approval_id<>v_approval_id or v_run.intake_id::text<>coalesce(v_candidate.payload->>'finance_intake_id','') then
    raise exception 'Schema 177 journal posting execution run/provenance is invalid.';
  end if;

  if new.posting_status='posted' then
    if v_run.execution_status not in ('running','completed') then
      raise exception 'Schema 177 journal posting requires an active or completed execution run.';
    end if;
    if not exists(select 1 from public.finance_job_completion_posting_execution_controls where control_key='finance_job_completion_v1' and execution_enabled and provider_mutation_enabled=false) then
      raise exception 'Schema 177 Finance posting execution release is disabled.';
    end if;
  elsif new.posting_status='reversed' then
    v_reversal_id := nullif(new.posting_payload->>'reversal_id','')::uuid;
    select * into v_reversal from public.finance_job_completion_posting_reversals where id=v_reversal_id;
    if v_reversal.id is null or v_reversal.execution_run_id<>v_run.id or v_reversal.reversal_status not in ('running','completed') then
      raise exception 'Schema 177 journal reversal provenance is invalid.';
    end if;
  else
    raise exception 'Schema 177 Finance journal posting status must be posted or reversed.';
  end if;

  return new;
end;
$$;

revoke all on function public.ywi_guard_schema172_invoice_posting_closed() from public,anon,authenticated,service_role;
revoke all on function public.ywi_guard_schema172_journal_posting_closed() from public,anon,authenticated,service_role;

create or replace function public.ywi_finance_execute_job_completion_posting(
  p_intake_id uuid,
  p_reason text,
  p_actor_profile_id uuid
)
returns table(
  execution_run_id uuid,
  execution_status text,
  invoice_posting_id uuid,
  ar_invoice_id uuid,
  journal_posting_id uuid,
  gl_batch_id uuid,
  idempotent boolean,
  recovery_required boolean,
  message text
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason,''));
  v_approval public.finance_job_completion_posting_approvals%rowtype;
  v_invoice public.job_invoice_candidates%rowtype;
  v_journal public.job_journal_candidates%rowtype;
  v_run public.finance_job_completion_posting_execution_runs%rowtype;
  v_invoice_post public.job_invoice_postings%rowtype;
  v_journal_post public.job_journal_postings%rowtype;
  v_pf record;
  v_invoice_number text;
  v_existing_invoice_id uuid;
  v_existing_batch_id uuid;
  v_ar_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_entries jsonb := '[]'::jsonb;
  v_terms_days integer := 0;
  v_ar_invoice_id uuid;
  v_gl_batch_id uuid;
  v_invoice_posting_id uuid;
  v_journal_posting_id uuid;
  v_error text;
begin
  if length(v_reason)<3 then raise exception 'A Finance posting execution reason is required.'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active is not false) then
    raise exception 'An active Finance execution profile is required.';
  end if;
  if not public.ywi_profile_has_module_access(p_actor_profile_id,'finance','approve') then
    raise exception 'Finance approve access is required for posting execution.';
  end if;

  select * into v_approval from public.finance_job_completion_posting_approvals where intake_id=p_intake_id;
  if v_approval.id is null then raise exception 'Schema 175 Finance posting approval is required before execution.'; end if;

  select * into v_run from public.finance_job_completion_posting_execution_runs where posting_approval_id=v_approval.id;
  if v_run.id is not null and v_run.execution_status='completed' then
    return query select v_run.id,'completed'::text,v_run.invoice_posting_id,v_run.ar_invoice_id,
      v_run.journal_posting_id,v_run.gl_batch_id,true,false,'Posting already completed; returning the durable idempotent result.'::text;
    return;
  elsif v_run.id is not null and v_run.execution_status='reversed' then
    return query select v_run.id,'reversed'::text,v_run.invoice_posting_id,v_run.ar_invoice_id,
      v_run.journal_posting_id,v_run.gl_batch_id,true,false,'Posting was reversed and cannot be executed again.'::text;
    return;
  end if;

  if not exists(
    select 1 from public.finance_job_completion_posting_execution_controls
    where control_key='finance_job_completion_v1' and execution_enabled and provider_mutation_enabled=false and required_schema_version<=177
  ) then
    return query select coalesce(v_run.id,null::uuid),'blocked_release'::text,null::uuid,null::uuid,null::uuid,null::uuid,
      false,false,'Schema 177 execution machinery is installed but the deliberate Finance posting execution release remains disabled.'::text;
    return;
  end if;

  select * into v_pf from public.ywi_finance_job_completion_posting_preflight(p_intake_id);
  if v_pf.preflight_status is distinct from 'passed_execution_closed' or jsonb_array_length(coalesce(v_pf.blockers,'[]'::jsonb))<>0 then
    return query select coalesce(v_run.id,null::uuid),'blocked_preflight'::text,null::uuid,null::uuid,null::uuid,null::uuid,
      false,false,'Schema 176 posting preflight must pass with zero blockers before execution.'::text;
    return;
  end if;

  select * into v_invoice from public.job_invoice_candidates where id=v_approval.invoice_candidate_id;
  select * into v_journal from public.job_journal_candidates where id=v_approval.journal_candidate_id;
  if v_invoice.id is null or v_journal.id is null then raise exception 'Canonical Finance invoice/journal candidates are missing.'; end if;

  select * into v_invoice_post from public.job_invoice_postings where invoice_candidate_id=v_invoice.id;
  select * into v_journal_post from public.job_journal_postings where journal_candidate_id=v_journal.id;
  v_invoice_number := 'FIN-' || upper(replace(v_approval.id::text,'-',''));
  select id into v_existing_invoice_id from public.ar_invoices where invoice_number=v_invoice_number limit 1;
  select id into v_existing_batch_id from public.gl_journal_batches
    where source_record_type='finance_job_completion_posting_approval' and source_record_id=v_approval.id limit 1;

  if (v_invoice_post.id is null) <> (v_journal_post.id is null)
     or (v_existing_invoice_id is null) <> (v_existing_batch_id is null)
     or (v_invoice_post.id is null) <> (v_existing_invoice_id is null) then
    if v_run.id is null then
      insert into public.finance_job_completion_posting_execution_runs(
        posting_approval_id,intake_id,idempotency_key,execution_status,actor_profile_id,last_error,provenance
      ) values(
        v_approval.id,p_intake_id,'schema177-finance-posting:'||v_approval.id::text,'recovery_required',p_actor_profile_id,
        'Partial/orphan accounting state detected before execution.',
        jsonb_build_object('authority','schema177_finance_posting_execution','provider_mutation',false)
      ) returning * into v_run;
    else
      update public.finance_job_completion_posting_execution_runs
      set execution_status='recovery_required',last_error='Partial/orphan accounting state detected before execution.',updated_at=now()
      where id=v_run.id returning * into v_run;
    end if;
    return query select v_run.id,'recovery_required'::text,v_invoice_post.id,v_existing_invoice_id,
      v_journal_post.id,v_existing_batch_id,false,true,'Incomplete paired posting state detected; automatic retry is quarantined to prevent duplication.'::text;
    return;
  end if;

  if v_invoice_post.id is not null and v_journal_post.id is not null then
    if coalesce(v_invoice_post.posting_payload->>'posting_authority','')='schema177_finance_posting_execution'
       and coalesce(v_journal_post.posting_payload->>'posting_authority','')='schema177_finance_posting_execution'
       and coalesce(v_invoice_post.posting_payload->>'finance_posting_approval_id','')=v_approval.id::text
       and coalesce(v_journal_post.posting_payload->>'finance_posting_approval_id','')=v_approval.id::text then
      if v_run.id is null then
        insert into public.finance_job_completion_posting_execution_runs(
          posting_approval_id,intake_id,idempotency_key,execution_status,actor_profile_id,
          invoice_posting_id,ar_invoice_id,journal_posting_id,gl_batch_id,completed_at,provenance
        ) values(
          v_approval.id,p_intake_id,'schema177-finance-posting:'||v_approval.id::text,'completed',p_actor_profile_id,
          v_invoice_post.id,v_invoice_post.ar_invoice_id,v_journal_post.id,v_journal_post.gl_batch_id,now(),
          jsonb_build_object('authority','schema177_finance_posting_execution','recovered_idempotent_pair',true,'provider_mutation',false)
        ) returning * into v_run;
      end if;
      return query select v_run.id,'completed'::text,v_invoice_post.id,v_invoice_post.ar_invoice_id,
        v_journal_post.id,v_journal_post.gl_batch_id,true,false,'Existing Schema 177 paired posting returned idempotently.'::text;
      return;
    end if;
    return query select coalesce(v_run.id,null::uuid),'recovery_required'::text,v_invoice_post.id,v_invoice_post.ar_invoice_id,
      v_journal_post.id,v_journal_post.gl_batch_id,false,true,'Existing posting rows do not match Schema 177 provenance; manual recovery review is required.'::text;
    return;
  end if;

  if v_run.id is null then
    insert into public.finance_job_completion_posting_execution_runs(
      posting_approval_id,intake_id,idempotency_key,execution_status,actor_profile_id,provenance
    ) values(
      v_approval.id,p_intake_id,'schema177-finance-posting:'||v_approval.id::text,'running',p_actor_profile_id,
      jsonb_build_object('authority','schema177_finance_posting_execution','preflight_status',v_pf.preflight_status,'provider_mutation',false)
    ) returning * into v_run;
  else
    if v_run.execution_status='recovery_required' then
      return query select v_run.id,'recovery_required'::text,v_run.invoice_posting_id,v_run.ar_invoice_id,
        v_run.journal_posting_id,v_run.gl_batch_id,false,true,'Recovery review is required before retry.'::text;
      return;
    end if;
    update public.finance_job_completion_posting_execution_runs
    set execution_status='running',attempt_count=attempt_count+1,actor_profile_id=p_actor_profile_id,
        last_error=null,started_at=now(),updated_at=now()
    where id=v_run.id returning * into v_run;
  end if;

  begin
    select coalesce(payment_terms_days,0) into v_terms_days from public.clients where id=v_invoice.client_id;
    v_terms_days := greatest(coalesce(v_terms_days,0),0);

    insert into public.ar_invoices(
      invoice_number,client_id,work_order_id,invoice_status,invoice_date,due_date,
      subtotal,tax_total,total_amount,balance_due,created_by_profile_id,invoice_source
    ) values(
      v_invoice_number,v_invoice.client_id,v_invoice.work_order_id,'draft',current_date,current_date+v_terms_days,
      v_invoice.subtotal,v_invoice.tax_total,v_invoice.total_amount,v_invoice.total_amount,p_actor_profile_id,'job'
    ) returning id into v_ar_invoice_id;

    select account_id into v_ar_account_id from public.v_finance_posting_account_mapping_authority
      where mapping_key='accounts_receivable' and mapping_approved limit 1;
    select account_id into v_revenue_account_id from public.v_finance_posting_account_mapping_authority
      where mapping_key='service_revenue' and mapping_approved limit 1;
    if coalesce(v_invoice.tax_total,0)>0 then
      select account_id into v_tax_account_id from public.v_finance_posting_account_mapping_authority
        where mapping_key='sales_tax_payable' and mapping_approved limit 1;
    end if;
    if v_ar_account_id is null or v_revenue_account_id is null or (coalesce(v_invoice.tax_total,0)>0 and v_tax_account_id is null) then
      raise exception 'Required accountant-approved account mappings are unavailable during execution.';
    end if;

    v_entries := jsonb_build_array(
      jsonb_build_object('account_id',v_ar_account_id,'debit_amount',v_invoice.total_amount,'credit_amount',0,'client_id',v_invoice.client_id,'work_order_id',v_invoice.work_order_id,'memo','Schema 177 AR recognition'),
      jsonb_build_object('account_id',v_revenue_account_id,'debit_amount',0,'credit_amount',v_invoice.subtotal,'client_id',v_invoice.client_id,'work_order_id',v_invoice.work_order_id,'memo','Schema 177 service revenue recognition')
    );
    if coalesce(v_invoice.tax_total,0)>0 then
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('account_id',v_tax_account_id,'debit_amount',0,'credit_amount',v_invoice.tax_total,'client_id',v_invoice.client_id,'work_order_id',v_invoice.work_order_id,'memo','Schema 177 sales tax payable recognition')
      );
    end if;

    v_gl_batch_id := public.ywi_sync_source_journal_batch(
      'finance','finance_job_completion_posting_approval',v_approval.id,current_date,
      coalesce(v_journal.journal_memo,'Schema 177 job completion posting'),v_entries
    );
    if v_gl_batch_id is null then raise exception 'GL journal batch creation failed.'; end if;
    if not exists(select 1 from public.gl_journal_batches where id=v_gl_batch_id and is_balanced and debit_total=credit_total and line_count>=2) then
      raise exception 'Schema 177 journal batch is not balanced.';
    end if;
    update public.gl_journal_batches
    set batch_status='posted',posted_at=now(),posted_by_profile_id=p_actor_profile_id,
        source_sync_state='posted',posting_notes='Posted by Schema 177 controlled Finance execution.',updated_at=now()
    where id=v_gl_batch_id;

    insert into public.job_invoice_postings(
      invoice_candidate_id,posting_status,external_system,external_invoice_number,posting_payload,
      posted_by_profile_id,posted_at,ar_invoice_id,posting_message
    ) values(
      v_invoice.id,'posted','ywi_ar',v_invoice_number,
      jsonb_build_object(
        'posting_authority','schema177_finance_posting_execution','finance_posting_approval_id',v_approval.id,
        'execution_run_id',v_run.id,'idempotency_key',v_run.idempotency_key,'ar_invoice_id',v_ar_invoice_id,
        'posting_reason',v_reason,'provider_mutation',false
      ),p_actor_profile_id,now(),v_ar_invoice_id,'Schema 177 controlled AR materialization completed.'
    ) returning id into v_invoice_posting_id;

    insert into public.job_journal_postings(
      journal_candidate_id,posting_status,external_system,journal_entry_number,batch_number,posting_payload,
      posted_by_profile_id,posted_at,gl_batch_id,posting_message
    )
    select v_journal.id,'posted','ywi_gl',null,b.batch_number,
      jsonb_build_object(
        'posting_authority','schema177_finance_posting_execution','finance_posting_approval_id',v_approval.id,
        'execution_run_id',v_run.id,'idempotency_key',v_run.idempotency_key,'gl_batch_id',v_gl_batch_id,
        'posting_reason',v_reason,'provider_mutation',false
      ),p_actor_profile_id,now(),v_gl_batch_id,'Schema 177 controlled balanced GL posting completed.'
    from public.gl_journal_batches b where b.id=v_gl_batch_id
    returning id into v_journal_posting_id;

    update public.finance_job_completion_posting_execution_runs
    set execution_status='completed',invoice_posting_id=v_invoice_posting_id,ar_invoice_id=v_ar_invoice_id,
        journal_posting_id=v_journal_posting_id,gl_batch_id=v_gl_batch_id,last_error=null,completed_at=now(),updated_at=now(),
        provenance=provenance || jsonb_build_object('invoice_number',v_invoice_number,'completed_by_profile_id',p_actor_profile_id,'provider_mutation',false)
    where id=v_run.id returning * into v_run;
  exception when others then
    v_error := sqlerrm;
    update public.finance_job_completion_posting_execution_runs
    set execution_status='failed',last_error=left(v_error,2000),updated_at=now()
    where id=v_run.id returning * into v_run;
    return query select v_run.id,'failed'::text,null::uuid,null::uuid,null::uuid,null::uuid,
      false,false,'Schema 177 paired accounting transaction rolled back safely: '||left(v_error,1200);
    return;
  end;

  return query select v_run.id,'completed'::text,v_invoice_posting_id,v_ar_invoice_id,
    v_journal_posting_id,v_gl_batch_id,false,false,'Schema 177 paired Finance posting completed atomically.'::text;
end;
$$;

revoke all on function public.ywi_finance_execute_job_completion_posting(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_execute_job_completion_posting(uuid,text,uuid) to service_role;

create or replace function public.ywi_finance_reverse_job_completion_posting(
  p_intake_id uuid,
  p_reason text,
  p_actor_profile_id uuid
)
returns table(
  reversal_id uuid,
  reversal_status text,
  reversal_gl_batch_id uuid,
  original_ar_invoice_id uuid,
  message text,
  idempotent boolean
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason,''));
  v_run public.finance_job_completion_posting_execution_runs%rowtype;
  v_reversal public.finance_job_completion_posting_reversals%rowtype;
  v_reversal_id uuid;
  v_reversal_batch_id uuid;
  v_error text;
begin
  if length(v_reason)<3 then raise exception 'A reversal/void reason is required.'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active is not false) then
    raise exception 'An active Finance reversal profile is required.';
  end if;
  if not public.ywi_profile_has_module_access(p_actor_profile_id,'finance','manage') then
    raise exception 'Finance manage access is required for posting reversal.';
  end if;

  select * into v_run from public.finance_job_completion_posting_execution_runs where intake_id=p_intake_id;
  if v_run.id is null or v_run.execution_status not in ('completed','reversed') then
    raise exception 'A completed Schema 177 execution run is required for reversal.';
  end if;
  select * into v_reversal from public.finance_job_completion_posting_reversals where execution_run_id=v_run.id;
  if v_reversal.id is not null and v_reversal.reversal_status='completed' then
    return query select v_reversal.id,'completed'::text,v_reversal.reversal_gl_batch_id,v_reversal.original_ar_invoice_id,
      'Existing reversal returned idempotently.'::text,true;
    return;
  end if;

  if v_reversal.id is null then
    insert into public.finance_job_completion_posting_reversals(
      execution_run_id,posting_approval_id,reversal_status,reason,actor_profile_id,original_ar_invoice_id,original_gl_batch_id,provenance
    ) values(
      v_run.id,v_run.posting_approval_id,'running',v_reason,p_actor_profile_id,v_run.ar_invoice_id,v_run.gl_batch_id,
      jsonb_build_object('reversal_authority','schema177_finance_posting_reversal','provider_mutation',false)
    ) returning * into v_reversal;
  else
    update public.finance_job_completion_posting_reversals
    set reversal_status='running',reason=v_reason,actor_profile_id=p_actor_profile_id,last_error=null,started_at=now()
    where id=v_reversal.id returning * into v_reversal;
  end if;
  v_reversal_id := v_reversal.id;

  begin
    insert into public.gl_journal_batches(
      batch_number,source_module,batch_status,batch_date,memo,created_by_profile_id,
      source_record_type,source_record_id,source_generated,source_sync_state,source_synced_at
    ) values(
      public.ywi_source_batch_number('FREV',v_reversal_id),'finance','draft',current_date,
      'Reversal of Schema 177 posting '||v_run.id::text,p_actor_profile_id,
      'finance_job_completion_posting_reversal',v_reversal_id,true,'drafted',now()
    ) returning id into v_reversal_batch_id;

    insert into public.gl_journal_entries(
      batch_id,line_number,entry_date,account_id,debit_amount,credit_amount,client_id,work_order_id,dispatch_id,
      source_record_type,source_record_id,memo,created_by_profile_id
    )
    select v_reversal_batch_id,coalesce(e.line_number,row_number() over(order by e.created_at,e.id)::int*10),current_date,
      e.account_id,e.credit_amount,e.debit_amount,e.client_id,e.work_order_id,e.dispatch_id,
      'finance_job_completion_posting_reversal',v_reversal_id,'Reversal: '||coalesce(e.memo,'Schema 177 posting'),p_actor_profile_id
    from public.gl_journal_entries e where e.batch_id=v_run.gl_batch_id;

    perform public.ywi_sync_gl_journal_batch(v_reversal_batch_id);
    if not exists(select 1 from public.gl_journal_batches where id=v_reversal_batch_id and is_balanced and debit_total=credit_total and line_count>=2) then
      raise exception 'Reversal GL batch is not balanced.';
    end if;
    update public.gl_journal_batches
    set batch_status='posted',posted_at=now(),posted_by_profile_id=p_actor_profile_id,
        source_sync_state='posted',posting_notes='Schema 177 auditable reversal batch.',updated_at=now()
    where id=v_reversal_batch_id;

    update public.ar_invoices
    set invoice_status='void',balance_due=0,updated_at=now()
    where id=v_run.ar_invoice_id and invoice_status<>'void';

    update public.job_invoice_postings
    set posting_status='reversed',posting_message='Reversed by Schema 177 auditable reversal authority.',
        posting_payload=posting_payload || jsonb_build_object('reversal_id',v_reversal_id,'reversal_gl_batch_id',v_reversal_batch_id,'reversal_reason',v_reason),
        updated_at=now()
    where id=v_run.invoice_posting_id;
    update public.job_journal_postings
    set posting_status='reversed',posting_message='Reversed by Schema 177 auditable reversal authority.',
        posting_payload=posting_payload || jsonb_build_object('reversal_id',v_reversal_id,'reversal_gl_batch_id',v_reversal_batch_id,'reversal_reason',v_reason),
        updated_at=now()
    where id=v_run.journal_posting_id;

    update public.finance_job_completion_posting_reversals
    set reversal_status='completed',reversal_gl_batch_id=v_reversal_batch_id,completed_at=now(),last_error=null,
        provenance=provenance || jsonb_build_object('completed_by_profile_id',p_actor_profile_id,'provider_mutation',false)
    where id=v_reversal_id returning * into v_reversal;
    update public.finance_job_completion_posting_execution_runs
    set execution_status='reversed',updated_at=now(),provenance=provenance || jsonb_build_object('reversal_id',v_reversal_id)
    where id=v_run.id;
  exception when others then
    v_error := sqlerrm;
    update public.finance_job_completion_posting_reversals
    set reversal_status='failed',last_error=left(v_error,2000)
    where id=v_reversal_id returning * into v_reversal;
    return query select v_reversal_id,'failed'::text,null::uuid,v_run.ar_invoice_id,
      'Schema 177 reversal transaction rolled back safely: '||left(v_error,1200),false;
    return;
  end;

  return query select v_reversal_id,'completed'::text,v_reversal_batch_id,v_run.ar_invoice_id,
    'Schema 177 auditable reversal completed; original posted GL batch remains unchanged.',false;
end;
$$;

revoke all on function public.ywi_finance_reverse_job_completion_posting(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_reverse_job_completion_posting(uuid,text,uuid) to service_role;

create or replace view public.v_finance_job_completion_posting_execution_queue
with (security_invoker=true)
as
select
  q.*,
  r.id as execution_run_id,
  r.execution_status as posting_execution_status,
  r.attempt_count,
  r.invoice_posting_id,
  r.ar_invoice_id,
  r.journal_posting_id,
  r.gl_batch_id,
  r.last_error as execution_last_error,
  r.updated_at as execution_updated_at,
  rv.id as reversal_id,
  rv.reversal_status,
  rv.reversal_gl_batch_id,
  case
    when r.execution_status='recovery_required' then 'recovery_required'
    when (r.invoice_posting_id is null)<>(r.journal_posting_id is null) then 'partial_pair'
    when r.execution_status='completed' and r.invoice_posting_id is not null and r.journal_posting_id is not null then 'complete_pair'
    when r.execution_status='reversed' and rv.reversal_status='completed' then 'reversed_pair'
    else coalesce(r.execution_status,'not_started')
  end as execution_pair_state
from public.v_finance_job_completion_posting_preflight_queue q
left join public.finance_job_completion_posting_execution_runs r on r.intake_id=q.intake_id
left join public.finance_job_completion_posting_reversals rv on rv.execution_run_id=r.id;

revoke all on table public.v_finance_job_completion_posting_execution_queue from public,anon,authenticated;
grant select on table public.v_finance_job_completion_posting_execution_queue to service_role;

create or replace view public.v_it_finance_posting_execution_status
with (security_invoker=true)
as
select
  coalesce((select execution_enabled from public.finance_job_completion_posting_execution_controls where control_key='finance_job_completion_v1'),false) as execution_release_enabled,
  false as provider_mutation_authorized,
  (select count(*) from public.v_finance_posting_account_mapping_authority where mapping_approved)::int as approved_required_posting_mapping_count,
  (select count(*) from public.v_finance_posting_account_mapping_authority)::int as required_posting_mapping_count,
  (select count(*) from public.finance_job_completion_posting_execution_runs)::int as execution_run_count,
  (select count(*) from public.finance_job_completion_posting_execution_runs where execution_status='completed')::int as completed_execution_count,
  (select count(*) from public.finance_job_completion_posting_execution_runs where execution_status='failed')::int as failed_execution_count,
  (select count(*) from public.finance_job_completion_posting_execution_runs where execution_status='recovery_required')::int as recovery_required_count,
  (select count(*) from public.finance_job_completion_posting_reversals where reversal_status='completed')::int as completed_reversal_count,
  now() as checked_at;

revoke all on table public.v_it_finance_posting_execution_status from public,anon,authenticated;
grant select on table public.v_it_finance_posting_execution_status to service_role;

create or replace function public.ywi_finance_posting_execution_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'execution_control_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public' and table_name in ('finance_job_completion_posting_execution_controls','finance_job_completion_posting_execution_runs','finance_job_completion_posting_reversals','v_finance_job_completion_posting_execution_queue','v_it_finance_posting_execution_status') and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Execution, recovery and reversal authorities remain private service control-plane surfaces.'
  union all
  select 'execution_rpc_service_only',
    case when not exists(select 1 from information_schema.routine_privileges where routine_schema='public' and routine_name in ('ywi_finance_execute_job_completion_posting','ywi_finance_reverse_job_completion_posting') and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE') then 'passed' else 'failed' end,
    'Execution and reversal RPCs are reachable only through the authenticated Finance Edge/service boundary.'
  union all
  select 'execution_release_fail_closed',
    case when exists(select 1 from public.finance_job_completion_posting_execution_controls where control_key='finance_job_completion_v1' and execution_enabled=false and provider_mutation_enabled=false) then 'passed' else 'failed' end,
    'Schema 177 installs execution machinery with the live release control disabled and provider mutation forbidden.'
  union all
  select 'execution_idempotency_contracts',
    case when to_regclass('public.uq_job_invoice_postings_schema177_finance_approval') is not null and to_regclass('public.uq_job_journal_postings_schema177_finance_approval') is not null and not exists(select 1 from public.finance_job_completion_posting_execution_runs group by idempotency_key having count(*)>1) then 'passed' else 'failed' end,
    'One execution run and one posting envelope per Finance posting approval are enforced.'
  union all
  select 'paired_completion_consistent',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_runs where execution_status='completed' and (invoice_posting_id is null or ar_invoice_id is null or journal_posting_id is null or gl_batch_id is null)) then 'passed' else 'failed' end,
    'Completed runs always retain both AR and GL posting identities.'
  union all
  select 'posted_gl_balanced',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_runs r join public.gl_journal_batches b on b.id=r.gl_batch_id where r.execution_status in ('completed','reversed') and (b.batch_status<>'posted' or not b.is_balanced or b.debit_total<>b.credit_total)) then 'passed' else 'failed' end,
    'Schema 177 completed original GL batches are posted and balanced.'
  union all
  select 'reversal_history_auditable',
    case when not exists(select 1 from public.finance_job_completion_posting_reversals rv left join public.gl_journal_batches b on b.id=rv.reversal_gl_batch_id where rv.reversal_status='completed' and (b.id is null or b.batch_status<>'posted' or not b.is_balanced)) then 'passed' else 'failed' end,
    'Completed reversals preserve the original GL batch and create a separate balanced posted reversal batch.'
  union all
  select 'provider_mutation_closed',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where provider_mutation_enabled) and not exists(select 1 from public.job_invoice_postings where posting_payload->>'posting_authority'='schema177_finance_posting_execution' and coalesce(posting_payload->>'provider_mutation','false')<>'false') and not exists(select 1 from public.job_journal_postings where posting_payload->>'posting_authority'='schema177_finance_posting_execution' and coalesce(posting_payload->>'provider_mutation','false')<>'false') then 'passed' else 'failed' end,
    'Stripe/PayPal/provider mutation remains outside Schema 177 execution authority.';
$$;

revoke all on function public.ywi_finance_posting_execution_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_posting_execution_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_posting_execution_control_enabled','public','finance_job_completion_posting_execution_controls','execution_enabled','boolean','finance',177,177,true,'Deliberate live execution release gate.'),
  ('finance_posting_execution_run_approval','public','finance_job_completion_posting_execution_runs','posting_approval_id','uuid','finance',177,177,true,'Immutable posting approval identity for execution idempotency.'),
  ('finance_posting_execution_run_ar','public','finance_job_completion_posting_execution_runs','ar_invoice_id','uuid','finance',177,177,true,'Materialized AR identity.'),
  ('finance_posting_execution_run_gl','public','finance_job_completion_posting_execution_runs','gl_batch_id','uuid','finance',177,177,true,'Posted balanced GL batch identity.'),
  ('finance_posting_reversal_original_gl','public','finance_job_completion_posting_reversals','original_gl_batch_id','uuid','finance',177,177,true,'Original posted GL history remains referenced and unchanged.'),
  ('finance_posting_reversal_batch','public','finance_job_completion_posting_reversals','reversal_gl_batch_id','uuid','finance',177,177,true,'Separate posted reversal batch identity.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_posting_execution_recovery','Finance','Finance controlled posting execution and recovery','critical',
  'Keep execution release disabled until mappings are human-approved and Schema 176/177 assertions are green. Investigate recovery_required runs before any retry.','Admin > I.T. Readiness',46,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=10,target_value=10,
    next_action_hint='Schema 176 preflight/mapping authority is release-proven; Schema 177 adds controlled execution/recovery behind its disabled release gate.',
    updated_at=now()
where rail_key='schema176_finance_posting_preflight_accounting_mapping';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema177_finance_posting_execution_recovery','finance','Finance controlled posting execution, recovery and reversal','active',90,9,10,
  'Merge the exact green Schema 177 source SHA, apply and verify live assertions with execution release still disabled, deploy the protected Finance Edge function, and record exact-main release evidence.',
  'Finance / I.T. / Accounting',97,
  '{"build":"2026-09-02i","schema":177,"atomic_pair":true,"idempotent_retry":true,"partial_failure_quarantine":true,"reversal_authority":true,"posting_execution_release_enabled":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  177,'177_finance_posting_execution_recovery','177_finance_posting_execution_recovery.sql','2026-09-02i',
  'Adds service-authorized atomic Finance AR/GL posting execution, durable idempotent retry/recovery detection and auditable reversal/void authority.',
  'applied',
  'Execution machinery is installed fail-closed with execution_enabled=false. Accountant mapping approvals remain human-controlled; provider/payment mutation, Jobs writeback, fifth module and Production promotion remain excluded.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 177::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=177 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=177
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 177 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;