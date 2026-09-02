-- 175_finance_posting_safety_foundation.sql
-- Build 2026-09-02g
-- Establishes a separate human posting-approval authority, durable idempotency identity,
-- immutable provenance and fail-closed posting guards for Schema 172 Finance candidates.
-- This release does NOT create AR invoices, GL batches/entries, payments or provider mutations.

begin;

create table if not exists public.finance_job_completion_posting_approvals (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null unique references public.finance_job_completion_intake(id) on delete restrict,
  disposition_id uuid not null unique references public.finance_job_completion_review_dispositions(id) on delete restrict,
  source_event_id bigint not null references public.app_cross_module_events(event_id) on delete restrict,
  job_id bigint not null references public.jobs(id) on delete restrict,
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete restrict,
  invoice_candidate_id uuid not null unique references public.job_invoice_candidates(id) on delete restrict,
  journal_candidate_id uuid not null unique references public.job_journal_candidates(id) on delete restrict,
  approval_status text not null default 'approved',
  approval_reason text not null,
  approved_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  idempotency_key text not null unique,
  execution_status text not null default 'not_released',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint finance_job_completion_posting_approvals_status_chk
    check (approval_status='approved'),
  constraint finance_job_completion_posting_approvals_reason_chk
    check (length(btrim(approval_reason)) between 3 and 2000),
  constraint finance_job_completion_posting_approvals_idempotency_chk
    check (idempotency_key = 'finance-job-completion:' || intake_id::text),
  constraint finance_job_completion_posting_approvals_execution_chk
    check (execution_status='not_released')
);

create index if not exists idx_finance_job_completion_posting_approvals_job
  on public.finance_job_completion_posting_approvals(job_id,approved_at desc);
create index if not exists idx_finance_job_completion_posting_approvals_review
  on public.finance_job_completion_posting_approvals(completion_review_id,approved_at desc);

alter table public.finance_job_completion_posting_approvals enable row level security;
revoke all on table public.finance_job_completion_posting_approvals from public,anon,authenticated,service_role;
grant select on table public.finance_job_completion_posting_approvals to service_role;

-- The existing posting tables already enforce one posting row per candidate. These additional
-- indexes make the future approval-idempotency identity explicit and independently unique.
create unique index if not exists uq_job_invoice_postings_schema175_finance_approval
  on public.job_invoice_postings ((posting_payload->>'finance_posting_approval_id'))
  where posting_payload->>'posting_authority'='schema175_finance_posting_approval';
create unique index if not exists uq_job_journal_postings_schema175_finance_approval
  on public.job_journal_postings ((posting_payload->>'finance_posting_approval_id'))
  where posting_payload->>'posting_authority'='schema175_finance_posting_approval';

create or replace function public.ywi_guard_finance_posting_approval_immutable()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  raise exception 'Finance posting approvals are immutable. Use a later explicit reversal/void authority rather than editing approval history.';
end;
$$;

revoke all on function public.ywi_guard_finance_posting_approval_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_guard_finance_posting_approval_immutable on public.finance_job_completion_posting_approvals;
create trigger trg_guard_finance_posting_approval_immutable
before update or delete on public.finance_job_completion_posting_approvals
for each row execute function public.ywi_guard_finance_posting_approval_immutable();

create or replace function public.ywi_finance_approve_job_completion_posting(
  p_intake_id uuid,
  p_reason text,
  p_actor_profile_id uuid
)
returns table(
  posting_approval_id uuid,
  intake_id uuid,
  disposition_id uuid,
  invoice_candidate_id uuid,
  journal_candidate_id uuid,
  idempotency_key text,
  execution_status text
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intake public.finance_job_completion_intake%rowtype;
  v_disposition public.finance_job_completion_review_dispositions%rowtype;
  v_invoice public.job_invoice_candidates%rowtype;
  v_journal public.job_journal_candidates%rowtype;
  v_existing public.finance_job_completion_posting_approvals%rowtype;
  v_reason text := btrim(coalesce(p_reason,''));
  v_key text;
  v_id uuid;
begin
  if length(v_reason) < 3 then
    raise exception 'A Finance posting-approval reason is required.';
  end if;
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active is not false) then
    raise exception 'An active Finance approver profile is required.';
  end if;
  if not public.ywi_profile_has_module_access(p_actor_profile_id,'finance','approve') then
    raise exception 'Finance approve access is required for posting approval.';
  end if;

  select * into v_intake
  from public.finance_job_completion_intake
  where id=p_intake_id
  for update;
  if v_intake.id is null then raise exception 'Finance completion intake not found.'; end if;

  select * into v_disposition
  from public.finance_job_completion_review_dispositions
  where intake_id=v_intake.id;
  if v_disposition.id is null
     or v_disposition.disposition_status <> 'approved'
     or v_disposition.candidate_generation_status <> 'generated'
     or v_disposition.invoice_candidate_id is null
     or v_disposition.journal_candidate_id is null then
    raise exception 'Generated Finance-approved invoice and journal candidates are required before posting approval.';
  end if;

  select * into v_invoice from public.job_invoice_candidates where id=v_disposition.invoice_candidate_id;
  select * into v_journal from public.job_journal_candidates where id=v_disposition.journal_candidate_id;
  if v_invoice.id is null or v_journal.id is null then
    raise exception 'Finance posting approval requires both canonical draft candidates.';
  end if;
  if v_invoice.candidate_status <> 'draft' or v_journal.candidate_status <> 'draft' then
    raise exception 'Posting approval may only be recorded while both Finance candidates remain draft.';
  end if;
  if coalesce(v_invoice.payload->>'candidate_authority','') <> 'schema172_finance_review'
     or coalesce(v_journal.payload->>'candidate_authority','') <> 'schema172_finance_review'
     or coalesce(v_invoice.payload->>'finance_intake_id','') <> v_intake.id::text
     or coalesce(v_journal.payload->>'finance_intake_id','') <> v_intake.id::text
     or coalesce(v_invoice.payload->>'finance_disposition_id','') <> v_disposition.id::text
     or coalesce(v_journal.payload->>'finance_disposition_id','') <> v_disposition.id::text
     or coalesce(v_invoice.payload->>'posting_authorized','false') <> 'false'
     or coalesce(v_journal.payload->>'posting_authorized','false') <> 'false'
     or coalesce(v_invoice.payload->>'provider_mutation','false') <> 'false'
     or coalesce(v_journal.payload->>'provider_mutation','false') <> 'false' then
    raise exception 'Finance candidate authority/provenance markers are invalid for posting approval.';
  end if;
  if v_invoice.job_id <> v_intake.job_id
     or v_journal.job_id <> v_intake.job_id
     or v_invoice.completion_review_id <> v_intake.completion_review_id
     or v_journal.completion_review_id <> v_intake.completion_review_id then
    raise exception 'Finance posting approval candidate identities do not match the canonical intake.';
  end if;

  v_key := 'finance-job-completion:' || v_intake.id::text;
  select * into v_existing
  from public.finance_job_completion_posting_approvals
  where intake_id=v_intake.id;
  if v_existing.id is not null then
    return query select v_existing.id,v_existing.intake_id,v_existing.disposition_id,
      v_existing.invoice_candidate_id,v_existing.journal_candidate_id,
      v_existing.idempotency_key,v_existing.execution_status;
    return;
  end if;

  insert into public.finance_job_completion_posting_approvals(
    intake_id,disposition_id,source_event_id,job_id,completion_review_id,
    invoice_candidate_id,journal_candidate_id,approval_status,approval_reason,
    approved_by_profile_id,idempotency_key,execution_status,provenance
  ) values (
    v_intake.id,v_disposition.id,v_intake.source_event_id,v_intake.job_id,v_intake.completion_review_id,
    v_invoice.id,v_journal.id,'approved',v_reason,p_actor_profile_id,v_key,'not_released',
    jsonb_build_object(
      'posting_approval_authority','schema175_finance_posting_approval',
      'candidate_authority','schema172_finance_review',
      'source_event_id',v_intake.source_event_id,
      'job_id',v_intake.job_id,
      'completion_review_id',v_intake.completion_review_id,
      'finance_intake_id',v_intake.id,
      'finance_disposition_id',v_disposition.id,
      'invoice_candidate_id',v_invoice.id,
      'journal_candidate_id',v_journal.id,
      'approved_by_profile_id',p_actor_profile_id,
      'posting_execution_authorized',false,
      'provider_mutation',false
    )
  ) returning id into v_id;

  return query select v_id,v_intake.id,v_disposition.id,v_invoice.id,v_journal.id,v_key,'not_released'::text;
end;
$$;

revoke all on function public.ywi_finance_approve_job_completion_posting(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.ywi_finance_approve_job_completion_posting(uuid,text,uuid) to service_role;

-- Schema 172 candidates remain unpostable even after human posting approval. Build 175 only creates
-- the approval/idempotency/provenance authority. Later releases must deliberately replace these
-- guards before any accounting execution can occur.
create or replace function public.ywi_guard_schema172_invoice_posting_closed()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_candidate public.job_invoice_candidates%rowtype;
begin
  select * into v_candidate from public.job_invoice_candidates where id=new.invoice_candidate_id;
  if v_candidate.id is not null and coalesce(v_candidate.payload->>'candidate_authority','')='schema172_finance_review' then
    raise exception 'Schema 175 records posting approval only; invoice posting execution remains closed until a later explicit release.';
  end if;
  return new;
end;
$$;

create or replace function public.ywi_guard_schema172_journal_posting_closed()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_candidate public.job_journal_candidates%rowtype;
begin
  select * into v_candidate from public.job_journal_candidates where id=new.journal_candidate_id;
  if v_candidate.id is not null and coalesce(v_candidate.payload->>'candidate_authority','')='schema172_finance_review' then
    raise exception 'Schema 175 records posting approval only; journal posting execution remains closed until a later explicit release.';
  end if;
  return new;
end;
$$;

revoke all on function public.ywi_guard_schema172_invoice_posting_closed() from public,anon,authenticated,service_role;
revoke all on function public.ywi_guard_schema172_journal_posting_closed() from public,anon,authenticated,service_role;

drop trigger if exists trg_guard_schema172_invoice_posting_closed on public.job_invoice_postings;
create trigger trg_guard_schema172_invoice_posting_closed
before insert or update on public.job_invoice_postings
for each row execute function public.ywi_guard_schema172_invoice_posting_closed();

drop trigger if exists trg_guard_schema172_journal_posting_closed on public.job_journal_postings;
create trigger trg_guard_schema172_journal_posting_closed
before insert or update on public.job_journal_postings
for each row execute function public.ywi_guard_schema172_journal_posting_closed();

create or replace view public.v_finance_job_completion_posting_approval_queue
with (security_invoker=true)
as
select
  d.intake_id,
  d.id as disposition_id,
  d.source_event_id,
  d.job_id,
  d.completion_review_id,
  d.invoice_candidate_id,
  d.journal_candidate_id,
  d.reviewed_by_profile_id as disposition_reviewed_by_profile_id,
  d.reviewed_at as disposition_reviewed_at,
  a.id as posting_approval_id,
  a.approval_status,
  a.approval_reason,
  a.approved_by_profile_id,
  a.approved_at,
  a.idempotency_key,
  coalesce(a.execution_status,'not_released') as execution_status,
  case when a.id is null then 'awaiting_posting_approval' else 'posting_approved_execution_closed' end as posting_safety_state
from public.finance_job_completion_review_dispositions d
left join public.finance_job_completion_posting_approvals a on a.disposition_id=d.id
where d.disposition_status='approved'
  and d.candidate_generation_status='generated'
  and d.invoice_candidate_id is not null
  and d.journal_candidate_id is not null;

revoke all on table public.v_finance_job_completion_posting_approval_queue from public,anon,authenticated;
grant select on table public.v_finance_job_completion_posting_approval_queue to service_role;

create or replace view public.v_it_finance_posting_safety_status
with (security_invoker=true)
as
select
  (select count(*) from public.v_finance_job_completion_posting_approval_queue)::int as eligible_pair_count,
  (select count(*) from public.finance_job_completion_posting_approvals)::int as approval_count,
  (select count(*) from public.finance_job_completion_posting_approvals where execution_status<>'not_released')::int as execution_release_violation_count,
  (select count(*) from public.job_invoice_postings p join public.job_invoice_candidates c on c.id=p.invoice_candidate_id where c.payload->>'candidate_authority'='schema172_finance_review')::int as schema172_invoice_posting_count,
  (select count(*) from public.job_journal_postings p join public.job_journal_candidates c on c.id=p.journal_candidate_id where c.payload->>'candidate_authority'='schema172_finance_review')::int as schema172_journal_posting_count,
  now() as checked_at;

revoke all on table public.v_it_finance_posting_safety_status from public,anon,authenticated;
grant select on table public.v_it_finance_posting_safety_status to service_role;

create or replace function public.ywi_finance_posting_safety_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'posting_approval_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name in ('finance_job_completion_posting_approvals','v_finance_job_completion_posting_approval_queue','v_it_finance_posting_safety_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Posting approvals and I.T. safety views remain private service control-plane surfaces.'
  union all
  select 'posting_approval_rpc_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_finance_approve_job_completion_posting'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Human posting approval is reachable only through the authenticated Edge boundary/service role.'
  union all
  select 'posting_approval_immutable',
    case when exists(
      select 1 from pg_trigger
      where tgrelid='public.finance_job_completion_posting_approvals'::regclass
        and tgname='trg_guard_finance_posting_approval_immutable' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Approval provenance cannot be edited or deleted after creation.'
  union all
  select 'posting_idempotency_contracts',
    case when to_regclass('public.uq_job_invoice_postings_schema175_finance_approval') is not null
           and to_regclass('public.uq_job_journal_postings_schema175_finance_approval') is not null
           and not exists(
             select 1 from public.finance_job_completion_posting_approvals
             group by idempotency_key having count(*)>1
           )
      then 'passed' else 'failed' end,
    'Approval identity and future invoice/journal posting references are independently unique.'
  union all
  select 'schema172_posting_execution_closed',
    case when exists(
      select 1 from pg_trigger where tgrelid='public.job_invoice_postings'::regclass
        and tgname='trg_guard_schema172_invoice_posting_closed' and not tgisinternal
    ) and exists(
      select 1 from pg_trigger where tgrelid='public.job_journal_postings'::regclass
        and tgname='trg_guard_schema172_journal_posting_closed' and not tgisinternal
    ) and not exists(
      select 1 from public.job_invoice_postings p join public.job_invoice_candidates c on c.id=p.invoice_candidate_id
      where c.payload->>'candidate_authority'='schema172_finance_review'
    ) and not exists(
      select 1 from public.job_journal_postings p join public.job_journal_candidates c on c.id=p.journal_candidate_id
      where c.payload->>'candidate_authority'='schema172_finance_review'
    ) then 'passed' else 'failed' end,
    'Schema 172 completion candidates cannot create posting rows in Build 175.'
  union all
  select 'posting_approval_chain_consistent',
    case when not exists(
      select 1
      from public.finance_job_completion_posting_approvals a
      join public.finance_job_completion_review_dispositions d on d.id=a.disposition_id
      where a.intake_id<>d.intake_id
         or a.source_event_id<>d.source_event_id
         or a.job_id<>d.job_id
         or a.completion_review_id<>d.completion_review_id
         or a.invoice_candidate_id<>d.invoice_candidate_id
         or a.journal_candidate_id<>d.journal_candidate_id
         or d.disposition_status<>'approved'
         or d.candidate_generation_status<>'generated'
         or a.execution_status<>'not_released'
         or coalesce(a.provenance->>'posting_execution_authorized','false')<>'false'
         or coalesce(a.provenance->>'provider_mutation','false')<>'false'
    ) then 'passed' else 'failed' end,
    'Every approval preserves the canonical event/intake/disposition/candidate identity chain and keeps execution/provider mutation closed.';
$$;

revoke all on function public.ywi_finance_posting_safety_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_posting_safety_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('posting_approval_intake','public','finance_job_completion_posting_approvals','intake_id','uuid','finance',175,175,true,'Canonical Finance completion intake identity for posting approval.'),
  ('posting_approval_disposition','public','finance_job_completion_posting_approvals','disposition_id','uuid','finance',175,175,true,'Separate human Finance disposition identity retained before posting approval.'),
  ('posting_approval_invoice_candidate','public','finance_job_completion_posting_approvals','invoice_candidate_id','uuid','finance',175,175,true,'Approved draft invoice candidate identity.'),
  ('posting_approval_journal_candidate','public','finance_job_completion_posting_approvals','journal_candidate_id','uuid','finance',175,175,true,'Approved draft journal candidate identity.'),
  ('posting_approval_idempotency','public','finance_job_completion_posting_approvals','idempotency_key','text','finance',175,175,true,'Durable unique key for future posting retries.'),
  ('posting_approval_execution_status','public','finance_job_completion_posting_approvals','execution_status','text','finance',175,175,true,'Build 175 must remain not_released until a later explicit execution release.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_posting_safety_foundation','Finance','Finance completion posting approval/idempotency safety foundation','critical',
  'Repair failed Schema 175 posting-safety assertions before any Finance posting execution release.','Admin > I.T. Readiness',44,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=4,target_value=4,
    next_action_hint='Schema 174 UUID identity convergence is retained as the prerequisite for posting safety authority.',
    updated_at=now()
where rail_key='schema174_finance_work_order_identity_convergence';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema175_finance_posting_safety_foundation','finance','Finance posting approval, idempotency and provenance safety foundation','active',90,9,10,
  'Merge the exact green Schema 175 source SHA, record main workflow evidence, then verify all posting-safety assertions and dependency contracts live.',
  'Finance / I.T. / Architecture',95,
  '{"build":"2026-09-02g","schema":175,"separate_posting_approval":true,"idempotency_contracts":true,"immutable_provenance":true,"posting_execution":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  175,'175_finance_posting_safety_foundation','175_finance_posting_safety_foundation.sql','2026-09-02g',
  'Adds separate Finance posting approval, idempotency and immutable provenance while keeping Schema 172 posting execution closed.',
  'applied',
  'No Jobs writeback, AR invoice creation, GL posting, payment/provider mutation, fifth module or Production promotion is introduced.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 175::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=175 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=175
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 175 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
