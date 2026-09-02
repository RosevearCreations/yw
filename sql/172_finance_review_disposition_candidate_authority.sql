-- 172_finance_review_disposition_candidate_authority.sql
-- Build 2026-09-02d
-- Finance-owned human disposition plus guarded draft candidate generation.
-- Canonical compatibility note: Schema 169 finance_job_completion_intake timestamps are
-- source_occurred_at, first_seen_at and updated_at. There is no intake.created_at column.

begin;

create table if not exists public.finance_job_completion_review_dispositions (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null unique references public.finance_job_completion_intake(id) on delete cascade,
  source_event_id bigint not null unique references public.app_cross_module_events(event_id) on delete restrict,
  job_id bigint not null references public.jobs(id) on delete restrict,
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete restrict,
  disposition_status text not null,
  disposition_reason text not null,
  reviewed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  candidate_generation_status text not null default 'not_eligible',
  invoice_candidate_id uuid references public.job_invoice_candidates(id) on delete set null,
  journal_candidate_id uuid references public.job_journal_candidates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_job_completion_review_dispositions_status_chk
    check (disposition_status in ('approved','rejected')),
  constraint finance_job_completion_review_dispositions_generation_chk
    check (candidate_generation_status in ('not_eligible','eligible','generated','blocked')),
  constraint finance_job_completion_review_dispositions_reason_chk
    check (length(btrim(disposition_reason)) between 3 and 2000),
  constraint finance_job_completion_review_dispositions_approval_chk
    check (
      (disposition_status='approved' and candidate_generation_status in ('eligible','generated','blocked'))
      or (disposition_status='rejected' and candidate_generation_status='not_eligible')
    )
);

create index if not exists idx_finance_job_completion_review_dispositions_status
  on public.finance_job_completion_review_dispositions(disposition_status,candidate_generation_status,reviewed_at desc);
create index if not exists idx_finance_job_completion_review_dispositions_job
  on public.finance_job_completion_review_dispositions(job_id,completion_review_id);

alter table public.finance_job_completion_review_dispositions enable row level security;
revoke all on table public.finance_job_completion_review_dispositions from public, anon, authenticated;
grant select,insert,update on table public.finance_job_completion_review_dispositions to service_role;

create unique index if not exists uq_job_invoice_candidates_schema172_finance_intake
  on public.job_invoice_candidates ((payload->>'finance_intake_id'))
  where payload->>'candidate_authority'='schema172_finance_review';
create unique index if not exists uq_job_journal_candidates_schema172_finance_intake
  on public.job_journal_candidates ((payload->>'finance_intake_id'))
  where payload->>'candidate_authority'='schema172_finance_review';

create or replace function public.ywi_guard_finance_completion_invoice_candidate()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_disposition public.finance_job_completion_review_dispositions%rowtype;
  v_review public.job_completion_reviews%rowtype;
  v_work_order public.work_orders%rowtype;
begin
  select * into v_intake
  from public.finance_job_completion_intake
  where completion_review_id=new.completion_review_id
  order by first_seen_at desc
  limit 1;

  if v_intake.id is null then return new; end if;

  if coalesce(new.payload->>'candidate_authority','') <> 'schema172_finance_review'
     or coalesce(new.payload->>'finance_intake_id','') <> v_intake.id::text
     or coalesce(new.payload->>'posting_authorized','false') <> 'false'
     or coalesce(new.payload->>'provider_mutation','false') <> 'false' then
    raise exception 'Finance completion candidates require Schema 172 authority markers and posting/provider mutation must remain disabled.';
  end if;

  select * into v_disposition
  from public.finance_job_completion_review_dispositions
  where intake_id=v_intake.id;
  if v_disposition.id is null
     or v_disposition.disposition_status <> 'approved'
     or v_disposition.candidate_generation_status not in ('eligible','generated') then
    raise exception 'Finance approval is required before invoice candidate generation.';
  end if;

  if new.job_id <> v_intake.job_id
     or new.completion_review_id <> v_intake.completion_review_id
     or coalesce(new.payload->>'finance_disposition_id','') <> v_disposition.id::text then
    raise exception 'Invoice candidate identity does not match its Finance intake/disposition.';
  end if;

  select * into v_review from public.job_completion_reviews where id=v_intake.completion_review_id;
  if v_review.id is null or v_review.work_order_id is null then
    raise exception 'A canonical completion review with a work order is required for invoice candidate generation.';
  end if;
  select * into v_work_order from public.work_orders where id=v_review.work_order_id;
  if v_work_order.id is null then raise exception 'Canonical work order not found for Finance candidate generation.'; end if;

  if new.work_order_id is distinct from v_review.work_order_id
     or new.estimate_id is distinct from coalesce(v_review.estimate_id,v_work_order.estimate_id)
     or new.client_id is distinct from v_work_order.client_id
     or new.client_site_id is distinct from v_work_order.client_site_id then
    raise exception 'Invoice candidate canonical references do not match the work order.';
  end if;
  if round(coalesce(new.subtotal,0),2) <> round(coalesce(v_work_order.subtotal,0),2)
     or round(coalesce(new.tax_total,0),2) <> round(coalesce(v_work_order.tax_total,0),2)
     or round(coalesce(new.total_amount,0),2) <> round(coalesce(v_work_order.total_amount,0),2) then
    raise exception 'Invoice candidate amounts must come from canonical work-order totals.';
  end if;
  if new.candidate_status <> 'draft' then raise exception 'Schema 172 creates draft invoice candidates only.'; end if;
  return new;
end;
$$;

create or replace function public.ywi_guard_finance_completion_journal_candidate()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_disposition public.finance_job_completion_review_dispositions%rowtype;
  v_review public.job_completion_reviews%rowtype;
begin
  select * into v_intake
  from public.finance_job_completion_intake
  where completion_review_id=new.completion_review_id
  order by first_seen_at desc
  limit 1;

  if v_intake.id is null then return new; end if;
  if coalesce(new.payload->>'candidate_authority','') <> 'schema172_finance_review'
     or coalesce(new.payload->>'finance_intake_id','') <> v_intake.id::text
     or coalesce(new.payload->>'posting_authorized','false') <> 'false'
     or coalesce(new.payload->>'provider_mutation','false') <> 'false' then
    raise exception 'Finance completion candidates require Schema 172 authority markers and posting/provider mutation must remain disabled.';
  end if;

  select * into v_disposition from public.finance_job_completion_review_dispositions where intake_id=v_intake.id;
  if v_disposition.id is null
     or v_disposition.disposition_status <> 'approved'
     or v_disposition.candidate_generation_status not in ('eligible','generated') then
    raise exception 'Finance approval is required before journal candidate generation.';
  end if;
  if new.job_id <> v_intake.job_id
     or new.completion_review_id <> v_intake.completion_review_id
     or coalesce(new.payload->>'finance_disposition_id','') <> v_disposition.id::text then
    raise exception 'Journal candidate identity does not match its Finance intake/disposition.';
  end if;

  select * into v_review from public.job_completion_reviews where id=v_intake.completion_review_id;
  if v_review.id is null then raise exception 'Canonical completion review not found for Finance candidate generation.'; end if;
  if coalesce((new.ledger_summary->>'revenue_total')::numeric,0) <> coalesce(v_review.revenue_total,0)
     or coalesce((new.ledger_summary->>'cost_total')::numeric,0) <> coalesce(v_review.cost_total,0)
     or coalesce((new.ledger_summary->>'profit_total')::numeric,0) <> coalesce(v_review.profit_total,0) then
    raise exception 'Journal candidate documentary totals must come from the canonical completion review.';
  end if;
  if new.ledger_summary ?| array['debit_account_id','credit_account_id','debit','credit','posted_batch_id'] then
    raise exception 'Schema 172 does not invent or post ledger accounts/entries.';
  end if;
  if new.candidate_status <> 'draft' then raise exception 'Schema 172 creates draft journal candidates only.'; end if;
  return new;
end;
$$;

create or replace function public.ywi_guard_schema172_candidate_posting()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if coalesce(old.payload->>'candidate_authority','')='schema172_finance_review' then
    if coalesce(new.payload->>'candidate_authority','') <> 'schema172_finance_review'
       or coalesce(new.payload->>'finance_intake_id','') <> coalesce(old.payload->>'finance_intake_id','')
       or coalesce(new.payload->>'posting_authorized','false') <> 'false'
       or coalesce(new.payload->>'provider_mutation','false') <> 'false' then
      raise exception 'Schema 172 candidate authority markers are immutable.';
    end if;
    if new.candidate_status='posted' then raise exception 'Schema 172 does not authorize candidate posting.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_finance_completion_invoice_candidate on public.job_invoice_candidates;
create trigger trg_guard_finance_completion_invoice_candidate before insert on public.job_invoice_candidates
for each row execute function public.ywi_guard_finance_completion_invoice_candidate();
drop trigger if exists trg_guard_finance_completion_journal_candidate on public.job_journal_candidates;
create trigger trg_guard_finance_completion_journal_candidate before insert on public.job_journal_candidates
for each row execute function public.ywi_guard_finance_completion_journal_candidate();
drop trigger if exists trg_guard_schema172_invoice_candidate_posting on public.job_invoice_candidates;
create trigger trg_guard_schema172_invoice_candidate_posting before update on public.job_invoice_candidates
for each row execute function public.ywi_guard_schema172_candidate_posting();
drop trigger if exists trg_guard_schema172_journal_candidate_posting on public.job_journal_candidates;
create trigger trg_guard_schema172_journal_candidate_posting before update on public.job_journal_candidates
for each row execute function public.ywi_guard_schema172_candidate_posting();

revoke all on function public.ywi_guard_finance_completion_invoice_candidate() from public,anon,authenticated,service_role;
revoke all on function public.ywi_guard_finance_completion_journal_candidate() from public,anon,authenticated,service_role;
revoke all on function public.ywi_guard_schema172_candidate_posting() from public,anon,authenticated,service_role;

create or replace function public.ywi_finance_dispose_job_completion_review(
  p_intake_id uuid,p_disposition text,p_reason text,p_actor_profile_id uuid
)
returns table(disposition_id uuid,intake_id uuid,disposition_status text,candidate_generation_status text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_existing public.finance_job_completion_review_dispositions%rowtype;
  v_status text := lower(btrim(coalesce(p_disposition,'')));
  v_reason text := btrim(coalesce(p_reason,''));
  v_id uuid;
begin
  if v_status not in ('approved','rejected') then raise exception 'disposition must be approved or rejected'; end if;
  if length(v_reason) < 3 then raise exception 'A Finance disposition reason is required.'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active is not false) then
    raise exception 'Active Finance reviewer profile is required.';
  end if;

  select * into v_intake from public.finance_job_completion_intake where id=p_intake_id for update;
  if v_intake.id is null then raise exception 'Finance completion intake not found.'; end if;
  select * into v_existing from public.finance_job_completion_review_dispositions where intake_id=v_intake.id;
  if v_existing.id is not null then
    if v_existing.disposition_status=v_status then
      return query select v_existing.id,v_existing.intake_id,v_existing.disposition_status,v_existing.candidate_generation_status;
      return;
    end if;
    raise exception 'Finance completion review already has an immutable disposition.';
  end if;
  if v_intake.intake_status <> 'finance_review_queued' then raise exception 'Finance completion intake is not awaiting human review.'; end if;
  if not exists(
    select 1 from public.app_cross_module_events e
    where e.event_id=v_intake.source_event_id and e.event_key='jobs.job_completed'
      and e.aggregate_type='job' and e.aggregate_id=v_intake.job_id::text
  ) then raise exception 'Finance intake source event no longer resolves to canonical jobs.job_completed.'; end if;
  if not exists(
    select 1 from public.job_completion_reviews r
    where r.id=v_intake.completion_review_id and r.job_id=v_intake.job_id
      and r.review_status in ('approved','ready_for_accounting','posted') and r.accounting_ready=true
  ) then raise exception 'Canonical completion review is not accounting-ready.'; end if;

  insert into public.finance_job_completion_review_dispositions(
    intake_id,source_event_id,job_id,completion_review_id,disposition_status,disposition_reason,
    reviewed_by_profile_id,candidate_generation_status
  ) values (
    v_intake.id,v_intake.source_event_id,v_intake.job_id,v_intake.completion_review_id,v_status,v_reason,
    p_actor_profile_id,case when v_status='approved' then 'eligible' else 'not_eligible' end
  ) returning id into v_id;

  update public.finance_job_completion_intake set intake_status='processed',updated_at=now() where id=v_intake.id;
  update public.job_completion_accounting_events
  set event_status='completed',completed_at=coalesce(completed_at,now()),payload=payload || jsonb_build_object(
    'schema172_disposition_id',v_id,'finance_disposition',v_status,
    'finance_reviewed_by_profile_id',p_actor_profile_id,'candidate_generation_authorized',v_status='approved'
  )
  where id=v_intake.finance_queue_event_id and accounting_action='queue_review' and event_status='queued';

  return query select d.id,d.intake_id,d.disposition_status,d.candidate_generation_status
  from public.finance_job_completion_review_dispositions d where d.id=v_id;
end;
$$;

create or replace function public.ywi_finance_generate_job_completion_candidates(
  p_intake_id uuid,p_actor_profile_id uuid
)
returns table(intake_id uuid,disposition_id uuid,invoice_candidate_id uuid,journal_candidate_id uuid,candidate_generation_status text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_disposition public.finance_job_completion_review_dispositions%rowtype;
  v_review public.job_completion_reviews%rowtype;
  v_work_order public.work_orders%rowtype;
  v_invoice_id uuid;
  v_journal_id uuid;
  v_candidate_number text;
  v_payload jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active is not false) then
    raise exception 'Active Finance reviewer profile is required.';
  end if;
  select * into v_intake from public.finance_job_completion_intake where id=p_intake_id for update;
  if v_intake.id is null then raise exception 'Finance completion intake not found.'; end if;
  select * into v_disposition from public.finance_job_completion_review_dispositions where intake_id=v_intake.id for update;
  if v_disposition.id is null or v_disposition.disposition_status <> 'approved' then
    raise exception 'Approved Finance disposition is required before candidate generation.';
  end if;
  if v_disposition.candidate_generation_status='blocked' then raise exception 'Candidate generation is blocked for this Finance disposition.'; end if;
  if v_disposition.candidate_generation_status='generated'
     and v_disposition.invoice_candidate_id is not null and v_disposition.journal_candidate_id is not null then
    return query select v_intake.id,v_disposition.id,v_disposition.invoice_candidate_id,v_disposition.journal_candidate_id,'generated'::text;
    return;
  end if;

  select * into v_review from public.job_completion_reviews
  where id=v_intake.completion_review_id and job_id=v_intake.job_id;
  if v_review.id is null or v_review.work_order_id is null or v_review.accounting_ready is not true then
    raise exception 'Canonical accounting-ready completion review with work order is required.';
  end if;
  select * into v_work_order from public.work_orders where id=v_review.work_order_id;
  if v_work_order.id is null then raise exception 'Canonical work order not found.'; end if;

  v_candidate_number := 'FIN-CAND-' || v_intake.job_id::text || '-' || left(replace(v_review.id::text,'-',''),8);
  v_payload := jsonb_build_object(
    'candidate_authority','schema172_finance_review','finance_intake_id',v_intake.id,
    'finance_disposition_id',v_disposition.id,'source_event_id',v_intake.source_event_id,
    'completion_review_id',v_review.id,'canonical_amount_source','work_orders',
    'posting_authorized',false,'provider_mutation',false,
    'generated_by','ywi_finance_generate_job_completion_candidates'
  );

  select id into v_invoice_id from public.job_invoice_candidates
  where payload->>'candidate_authority'='schema172_finance_review'
    and payload->>'finance_intake_id'=v_intake.id::text limit 1;
  if v_invoice_id is null then
    insert into public.job_invoice_candidates(
      completion_review_id,job_id,work_order_id,estimate_id,candidate_status,candidate_number,
      client_id,client_site_id,subtotal,tax_total,total_amount,memo,payload,created_by_profile_id
    ) values (
      v_review.id,v_intake.job_id,v_work_order.id,coalesce(v_review.estimate_id,v_work_order.estimate_id),'draft',v_candidate_number,
      v_work_order.client_id,v_work_order.client_site_id,v_work_order.subtotal,v_work_order.tax_total,v_work_order.total_amount,
      'Draft invoice candidate generated after approved Finance completion review. Posting remains unauthorized.',v_payload,p_actor_profile_id
    ) returning id into v_invoice_id;
  end if;

  select id into v_journal_id from public.job_journal_candidates
  where payload->>'candidate_authority'='schema172_finance_review'
    and payload->>'finance_intake_id'=v_intake.id::text limit 1;
  if v_journal_id is null then
    insert into public.job_journal_candidates(
      completion_review_id,job_id,candidate_status,journal_memo,ledger_summary,payload,created_by_profile_id
    ) values (
      v_review.id,v_intake.job_id,'draft',
      'Documentary completion totals generated after approved Finance review; no debit/credit accounts are asserted.',
      jsonb_build_object(
        'revenue_total',coalesce(v_review.revenue_total,0),'cost_total',coalesce(v_review.cost_total,0),
        'profit_total',coalesce(v_review.profit_total,0),'margin_percent',coalesce(v_review.margin_percent,0),
        'basis','canonical_completion_review_documentary_totals_only'
      ),v_payload,p_actor_profile_id
    ) returning id into v_journal_id;
  end if;

  insert into public.job_completion_accounting_events(
    completion_review_id,job_id,accounting_action,event_status,memo,payload,created_by_profile_id,completed_at
  ) values
    (v_review.id,v_intake.job_id,'create_invoice_candidate','completed',
     'Finance-approved draft invoice candidate created from canonical work-order totals.',
     v_payload || jsonb_build_object('invoice_candidate_id',v_invoice_id),p_actor_profile_id,now()),
    (v_review.id,v_intake.job_id,'create_journal_candidate','completed',
     'Finance-approved draft journal candidate created from documentary completion totals only.',
     v_payload || jsonb_build_object('journal_candidate_id',v_journal_id),p_actor_profile_id,now());

  update public.finance_job_completion_review_dispositions
  set candidate_generation_status='generated',invoice_candidate_id=v_invoice_id,journal_candidate_id=v_journal_id,updated_at=now()
  where id=v_disposition.id;
  return query select v_intake.id,v_disposition.id,v_invoice_id,v_journal_id,'generated'::text;
end;
$$;

revoke all on function public.ywi_finance_dispose_job_completion_review(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_dispose_job_completion_review(uuid,text,text,uuid) to service_role;
revoke all on function public.ywi_finance_generate_job_completion_candidates(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_generate_job_completion_candidates(uuid,uuid) to service_role;

create or replace view public.v_finance_job_completion_review_queue
with (security_invoker=true)
as
select
  i.id as intake_id,i.source_event_id,i.job_id,j.job_code,j.job_name,i.completion_review_id,
  r.review_status as completion_review_status,r.completion_date,r.accounting_ready,
  r.revenue_total,r.cost_total,r.profit_total,r.margin_percent,r.work_order_id,
  wo.work_order_number,wo.client_id,coalesce(c.display_name,c.legal_name,'') as client_name,
  wo.client_site_id,cs.site_name,wo.subtotal,wo.tax_total,wo.total_amount,
  i.intake_status,i.source_occurred_at,d.id as disposition_id,d.disposition_status,d.disposition_reason,
  d.reviewed_by_profile_id,coalesce(p.full_name,p.email,'') as reviewed_by_name,d.reviewed_at,
  coalesce(d.candidate_generation_status,case when i.intake_status='finance_review_queued' then 'awaiting_disposition' else 'not_eligible' end) as candidate_generation_status,
  d.invoice_candidate_id,ic.candidate_status as invoice_candidate_status,
  d.journal_candidate_id,jc.candidate_status as journal_candidate_status,
  i.first_seen_at as queued_at
from public.finance_job_completion_intake i
join public.jobs j on j.id=i.job_id
join public.job_completion_reviews r on r.id=i.completion_review_id
left join public.work_orders wo on wo.id=r.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.client_sites cs on cs.id=wo.client_site_id
left join public.finance_job_completion_review_dispositions d on d.intake_id=i.id
left join public.profiles p on p.id=d.reviewed_by_profile_id
left join public.job_invoice_candidates ic on ic.id=d.invoice_candidate_id
left join public.job_journal_candidates jc on jc.id=d.journal_candidate_id
order by i.first_seen_at asc;

revoke all on table public.v_finance_job_completion_review_queue from public,anon,authenticated;
grant select on table public.v_finance_job_completion_review_queue to service_role;

create or replace view public.v_finance_job_completion_review_status
with (security_invoker=true)
as
select
  count(*) filter(where d.id is null and i.intake_status='finance_review_queued')::bigint as awaiting_disposition_count,
  count(*) filter(where d.disposition_status='approved' and d.candidate_generation_status='eligible')::bigint as approved_awaiting_generation_count,
  count(*) filter(where d.disposition_status='rejected')::bigint as rejected_count,
  count(*) filter(where d.candidate_generation_status='generated')::bigint as generated_count,
  count(*) filter(where d.candidate_generation_status='blocked')::bigint as blocked_count,
  min(i.first_seen_at) filter(where d.id is null and i.intake_status='finance_review_queued') as oldest_awaiting_disposition_at,
  min(d.reviewed_at) filter(where d.disposition_status='approved' and d.candidate_generation_status='eligible') as oldest_approved_awaiting_generation_at,
  now() as checked_at
from public.finance_job_completion_intake i
left join public.finance_job_completion_review_dispositions d on d.intake_id=i.id;

revoke all on table public.v_finance_job_completion_review_status from public,anon,authenticated;
grant select on table public.v_finance_job_completion_review_status to service_role;

create or replace function public.ywi_finance_job_completion_review_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'schema172_disposition_rls',case when c.relrowsecurity then 'passed' else 'failed' end,
    'Finance dispositions are protected by row-level security.'
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='finance_job_completion_review_dispositions'
  union all
  select 'schema172_service_role_rpc_boundary',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name in ('ywi_finance_dispose_job_completion_review','ywi_finance_generate_job_completion_candidates')
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) and (select count(distinct routine_name) from information_schema.routine_privileges
      where routine_schema='public' and routine_name in ('ywi_finance_dispose_job_completion_review','ywi_finance_generate_job_completion_candidates')
        and grantee='service_role' and privilege_type='EXECUTE')=2 then 'passed' else 'failed' end,
    'Underlying Finance disposition/generation RPCs are service-role-only.'
  union all
  select 'schema172_candidate_idempotency',
    case when to_regclass('public.uq_job_invoice_candidates_schema172_finance_intake') is not null
      and to_regclass('public.uq_job_journal_candidates_schema172_finance_intake') is not null then 'passed' else 'failed' end,
    'Each Finance intake can create at most one invoice and one journal candidate.'
  union all
  select 'schema172_candidate_db_guards',
    case when (select count(*) from pg_trigger where tgname in (
      'trg_guard_finance_completion_invoice_candidate','trg_guard_finance_completion_journal_candidate',
      'trg_guard_schema172_invoice_candidate_posting','trg_guard_schema172_journal_candidate_posting') and not tgisinternal)=4
      then 'passed' else 'failed' end,
    'Database triggers enforce Finance approval, canonical values and no-posting status.'
  union all
  select 'schema172_no_jobs_writeback',
    case when not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('ywi_finance_dispose_job_completion_review','ywi_finance_generate_job_completion_candidates')
      and pg_get_functiondef(p.oid) ~* E'update\\s+public\\.(jobs|work_orders|job_completion_reviews)') then 'passed' else 'failed' end,
    'Finance review/candidate generation never writes canonical Jobs completion state.'
  union all
  select 'schema172_no_posting_or_provider_mutation',
    case when not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='ywi_finance_generate_job_completion_candidates'
      and (pg_get_functiondef(p.oid) ~* E'insert\\s+into\\s+public\\.(ar_invoices|gl_batches|gl_entries|payments)'
        or pg_get_functiondef(p.oid) ilike '%stripe%' or pg_get_functiondef(p.oid) ilike '%paypal%'))
      then 'passed' else 'failed' end,
    'Schema 172 only creates draft review candidates; posting/payment/provider mutation is absent.'
  union all
  select 'schema172_canonical_amount_source',
    case when pg_get_functiondef('public.ywi_finance_generate_job_completion_candidates(uuid,uuid)'::regprocedure) ilike '%v_work_order.subtotal%'
      and pg_get_functiondef('public.ywi_finance_generate_job_completion_candidates(uuid,uuid)'::regprocedure) ilike '%v_work_order.tax_total%'
      and pg_get_functiondef('public.ywi_finance_generate_job_completion_candidates(uuid,uuid)'::regprocedure) ilike '%v_work_order.total_amount%'
      then 'passed' else 'failed' end,
    'Invoice candidate amounts are copied from the canonical work order, not caller input.'
  union all
  select 'schema172_draft_only',
    case when pg_get_functiondef('public.ywi_finance_generate_job_completion_candidates(uuid,uuid)'::regprocedure) ilike '%''draft''%'
      and pg_get_functiondef('public.ywi_guard_schema172_candidate_posting()'::regprocedure) ilike '%does not authorize candidate posting%'
      then 'passed' else 'failed' end,
    'Generated Finance candidates remain draft and cannot transition to posted under Schema 172.';
$$;

revoke all on function public.ywi_finance_job_completion_review_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_job_completion_review_assertions() to service_role;

create or replace view public.v_it_cross_module_consumer_health
with (security_invoker=true)
as
with source_events as (
  select count(*)::bigint as source_event_count,
    count(*) filter(where not exists(select 1 from public.finance_job_completion_intake i where i.source_event_id=e.event_id))::bigint as unconsumed_event_count,
    min(e.occurred_at) filter(where not exists(select 1 from public.finance_job_completion_intake i where i.source_event_id=e.event_id)) as oldest_unconsumed_at
  from public.app_cross_module_events e where e.event_key='jobs.job_completed'
), intake as (
  select count(*)::bigint as intake_count,
    count(*) filter(where intake_status='finance_review_queued')::bigint as finance_review_queued_count,
    count(*) filter(where intake_status='processed')::bigint as processed_intake_count,
    count(*) filter(where intake_status='failed')::bigint as failed_intake_count,
    min(source_occurred_at) filter(where intake_status='finance_review_queued') as oldest_queued_intake_at
  from public.finance_job_completion_intake
), accounting_queue as (
  select count(*) filter(where accounting_action='queue_review' and event_status='queued' and payload->>'consumer'='finance_job_completion_consumer')::bigint as queued_accounting_review_count,
    min(created_at) filter(where accounting_action='queue_review' and event_status='queued' and payload->>'consumer'='finance_job_completion_consumer') as oldest_accounting_review_at
  from public.job_completion_accounting_events
), facts as (select se.*,i.*,aq.* from source_events se cross join intake i cross join accounting_queue aq),
execution as (select * from public.v_finance_job_completion_execution_status),
review_status as (select * from public.v_finance_job_completion_review_status)
select 'finance_completion_unconsumed'::text as check_key,'Unconsumed Jobs completion events'::text as check_title,
  case when unconsumed_event_count=0 then 'passed' when oldest_unconsumed_at < now()-interval '1 day' then 'failed' else 'warning' end::text as check_status,
  unconsumed_event_count as metric_value,source_event_count as related_total,oldest_unconsumed_at as oldest_item_at,
  case when unconsumed_event_count=0 then 'Every canonical jobs.job_completed event has a Finance intake row.' else 'Finance has completed-job events waiting for service-owned intake.' end::text as details,
  'Use only the bounded service-role Finance consumer after execution readiness is green.'::text as next_action_hint,now() as checked_at
from facts
union all select 'finance_completion_failed_intake','Failed Finance completion intake',case when failed_intake_count=0 then 'passed' else 'failed' end,
  failed_intake_count,intake_count,null::timestamptz,'Failed intake must be investigated before downstream automation.',
  'Inspect private Finance intake/source-event evidence; never repair Jobs state from Finance.',now() from facts
union all select 'finance_completion_review_queue','Finance accounting review queue',case when queued_accounting_review_count=0 then 'passed' when oldest_accounting_review_at < now()-interval '7 days' then 'failed' else 'warning' end,
  queued_accounting_review_count,finance_review_queued_count,oldest_accounting_review_at,'Completed-job Finance reviews are queued for human/accounting handling.',
  'Review queued accounting work in Finance. Candidate generation requires Schema 172 approval.',now() from facts
union all select 'finance_completion_pipeline_balance','Jobs completion / Finance intake balance',
  case when intake_count > source_event_count then 'failed' when processed_intake_count+finance_review_queued_count+failed_intake_count<>intake_count then 'failed' else 'passed' end,
  intake_count,source_event_count,oldest_queued_intake_at,'Every intake row must resolve to a declared state and never exceed canonical source events.',
  'Repair consumer-state integrity before dependent accounting automation.',now() from facts
union all select 'finance_completion_execution_readiness','Controlled Finance consumer execution',e.check_status,e.unconsumed_event_count,
  coalesce(e.last_consumed_count,0)::bigint,e.last_started_at,e.details,
  'Execution is service-role-only; Admin I.T. remains read-only.',now() from execution e
union all select 'finance_completion_retry_state','Finance consumer retry state',
  case when e.exhausted_failure_count>0 then 'failed' when e.open_failure_count>0 then 'warning' else 'passed' end,
  (e.open_failure_count+e.exhausted_failure_count)::bigint,e.failure_record_count,e.next_retry_at,
  'Finance consumer retry state is bounded by the Schema 171 retry ceiling.',
  'Investigate exhausted failures before dependent accounting automation.',now() from execution e
union all select 'finance_completion_human_disposition','Finance completion human disposition',
  case when r.awaiting_disposition_count=0 then 'passed' when r.oldest_awaiting_disposition_at < now()-interval '7 days' then 'failed' else 'warning' end,
  r.awaiting_disposition_count,(r.rejected_count+r.generated_count+r.approved_awaiting_generation_count)::bigint,r.oldest_awaiting_disposition_at,
  case when r.awaiting_disposition_count=0 then 'No completed-job Finance intake is awaiting human disposition.' else 'One or more completed jobs require Finance approve/reject review.' end,
  'Use the Finance workspace to approve or reject. I.T. is visibility-only.',now() from review_status r
union all select 'finance_completion_candidate_generation','Finance completion candidate generation',
  case when r.blocked_count>0 then 'failed' when r.approved_awaiting_generation_count>0 then 'warning' else 'passed' end,
  (r.approved_awaiting_generation_count+r.blocked_count)::bigint,r.generated_count,r.oldest_approved_awaiting_generation_at,
  case when r.blocked_count>0 then 'At least one approved Finance review is blocked from candidate generation.' when r.approved_awaiting_generation_count>0 then 'Approved Finance reviews are eligible for explicit draft candidate generation.' else 'No approved Finance review is waiting for candidate generation.' end,
  'Generate draft candidates from Finance only after approval. Posting/payment/provider mutation remains out of scope.',now() from review_status r;

revoke all on table public.v_it_cross_module_consumer_health from public,anon,authenticated;
grant select on table public.v_it_cross_module_consumer_health to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('finance_completion_review_authority','Architecture','Finance completion review disposition and candidate authority','critical',
  'Require human Finance disposition before draft candidate generation; keep posting/provider mutation locked.','Admin > I.T. Readiness',38,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,action_hint=excluded.action_hint,route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=8,target_value=8,
  next_action_hint='Schema 171 consumer execution/retry control is release-proven; Schema 172 adds human Finance disposition and guarded draft-candidate generation.',updated_at=now()
where rail_key='schema171_finance_consumer_execution';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values('schema172_finance_review_disposition','architecture','Finance completion review disposition and candidate authority','active',90,8,9,
  'Apply and verify Finance approve/reject and draft-candidate authority without fabricating live business events.',
  'Finance / I.T. / Architecture',92,
  '{"build":"2026-09-02d","schema":172,"human_disposition":true,"canonical_amounts":true,"draft_candidates_only":true,"posting":false,"provider_mutation":false,"jobs_writeback":false,"it_visibility":true,"intake_timestamp":"first_seen_at"}'::jsonb)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(172,'172_finance_review_disposition_candidate_authority','172_finance_review_disposition_candidate_authority.sql','2026-09-02d',
  'Adds human Finance completion-review disposition plus guarded, idempotent draft invoice/journal candidate generation from canonical records.',
  'applied','Uses Schema 169 first_seen_at as Finance intake queue time. No posting/payment/provider mutation, Jobs writeback, fifth module or Production promotion.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 172::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=172 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=172
    then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 172.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
