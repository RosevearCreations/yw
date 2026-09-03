-- 184_it_scorecard_truth_convergence.sql
-- Build 2026-09-02p
-- Converges stale historical I.T./architecture progress rails onto current proof while
-- keeping genuinely human/provider/staging/content/feature work open and classified.
-- Does not mutate business records, enable Finance execution/provider mutation, write Jobs state,
-- approve accounting mappings, or promote Production.

begin;

create table if not exists public.it_scorecard_rail_resolution_contracts (
  rail_key text primary key references public.admin_scorecard_progress_rails(rail_key) on delete cascade,
  resolution_class text not null check (resolution_class in (
    'verified_complete','staging_acceptance','provider_acceptance','accounting_acceptance',
    'content_approval','feature_followup','build_acceptance'
  )),
  requires_human boolean not null default false,
  requires_external boolean not null default false,
  auto_close_allowed boolean not null default false,
  resolution_note text not null,
  introduced_by_schema integer not null default 184,
  updated_at timestamptz not null default now(),
  check (not auto_close_allowed or (requires_human is false and requires_external is false))
);

alter table public.it_scorecard_rail_resolution_contracts enable row level security;
revoke all on table public.it_scorecard_rail_resolution_contracts from public,anon,authenticated;
grant select on table public.it_scorecard_rail_resolution_contracts to service_role;

create table if not exists public.it_scorecard_rail_completion_evidence (
  id uuid primary key default gen_random_uuid(),
  rail_key text not null references public.admin_scorecard_progress_rails(rail_key) on delete restrict,
  evidence_key text not null,
  evidence_status text not null check (evidence_status in ('passed','failed','informational')),
  source_schema_version integer not null,
  evidence_detail jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique(rail_key,evidence_key)
);

alter table public.it_scorecard_rail_completion_evidence enable row level security;
revoke all on table public.it_scorecard_rail_completion_evidence from public,anon,authenticated;
grant select on table public.it_scorecard_rail_completion_evidence to service_role;

create or replace function public.ywi_guard_it_scorecard_completion_evidence_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'I.T. scorecard completion evidence is immutable; append new evidence instead.' using errcode='23514';
end;
$$;

revoke all on function public.ywi_guard_it_scorecard_completion_evidence_immutable() from public,anon,authenticated;

drop trigger if exists trg_guard_it_scorecard_completion_evidence_immutable on public.it_scorecard_rail_completion_evidence;
create trigger trg_guard_it_scorecard_completion_evidence_immutable
before update or delete on public.it_scorecard_rail_completion_evidence
for each row execute function public.ywi_guard_it_scorecard_completion_evidence_immutable();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema184_it_scorecard_truth_convergence','security','I.T. scorecard truth convergence and blocker classification',
  'active',90,9,10,
  'Verify current assertion-backed legacy closures, explicit classification of every open rail, Admin I.T. rendering, and exact-main release evidence.',
  'I.T. / Admin',104,
  jsonb_build_object('schema',184,'build','2026-09-02p','business_data_mutation',false,'human_or_external_work_auto_closed',false,'posting_execution_release_enabled',false,'provider_mutation',false,'jobs_writeback',false,'production_promotion',false)
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values
  ('schema159_module_permissions','verified_complete',false,false,true,'Current module-security and rendered acceptance assertions supersede the historical staging-only next action.',184),
  ('schema160_it_readiness','verified_complete',false,false,true,'Current I.T. security assertions plus live Admin break-glass integrity supersede the historical deployment next action.',184),
  ('schema164_cross_module_boundaries','verified_complete',false,false,true,'Current write-boundary, cross-module boundary/event-wiring and module-acceptance assertions supersede the historical first-reaction next action.',184),
  ('operations_cockpit_live','staging_acceptance',true,false,false,'Keep open until the Cockpit staging acceptance requested by the rail is actually exercised.',184),
  ('quote_intake_live','staging_acceptance',true,false,false,'Keep open until a deployed quote/contact submission is accepted and observed in the live/staging write path.',184),
  ('payment_actions_live','accounting_acceptance',true,false,false,'Keep open for seeded accounting permission/journal acceptance; Build 184 must not post or approve accounting truth.',184),
  ('bank_csv_preview_live','accounting_acceptance',true,false,false,'Keep open for bank-promotion/split/undo/sign-off acceptance and reconciliation review.',184),
  ('equipment_scan_custody_live','feature_followup',false,false,false,'Manual scanning exists; barcode/QR camera scanning remains a real feature follow-up.',184),
  ('route_asset_approval_live','content_approval',true,false,false,'Keep open for human route/visual approval before public publishing.',184),
  ('customer_portal_live','provider_acceptance',true,true,false,'Keep open for Stripe test-mode hosted checkout/webhook/customer-status acceptance.',184),
  ('live_job_updates','staging_acceptance',true,false,false,'Keep open for customer-visible versus staff-only staging proof with an approved public image.',184),
  ('customer_live_update_notifications','staging_acceptance',true,false,false,'Keep open for explicit consent, protected dispatcher and no-staff-data email proof.',184),
  ('service_execution_proof_costing','staging_acceptance',true,false,false,'Keep open for arrival/completion proof, approval, customer-safe portal and internal cost-variance acceptance.',184),
  ('supervisor_closeout_signoff_invoice_followup','staging_acceptance',true,false,false,'Keep open for closeout approval, customer signoff, invoice readiness, review request and maintenance follow-up acceptance.',184),
  ('approved_route_generation','content_approval',true,false,false,'Keep open until a human-approved route/visual is published and included by the deployment sitemap generator.',184),
  ('schema184_it_scorecard_truth_convergence','build_acceptance',false,false,false,'Current build remains active until live DB/runtime/UI proof and exact-main release evidence close it.',184)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

do $$
begin
  if exists(select 1 from public.ywi_module_security_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.ywi_module_acceptance_security_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.v_admin_module_access_integrity where lower(coalesce(role,''))='admin' and all_modules_manage is not true) then
    raise exception 'Schema 159 historical rail cannot close: current module/admin acceptance proof is not green.' using errcode='23514';
  end if;

  if exists(select 1 from public.ywi_it_readiness_security_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.v_admin_module_access_integrity where lower(coalesce(role,''))='admin' and all_modules_manage is not true) then
    raise exception 'Schema 160 historical rail cannot close: current I.T./Admin integrity proof is not green.' using errcode='23514';
  end if;

  if exists(select 1 from public.ywi_module_write_boundary_security_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.ywi_cross_module_boundary_security_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.ywi_cross_module_event_wiring_assertions() where assertion_status<>'passed')
     or exists(select 1 from public.ywi_module_acceptance_security_assertions() where assertion_status<>'passed') then
    raise exception 'Schema 164 historical rail cannot close: current boundary/event/browser acceptance proof is not green.' using errcode='23514';
  end if;
end;
$$;

insert into public.it_scorecard_rail_completion_evidence(
  rail_key,evidence_key,evidence_status,source_schema_version,evidence_detail
) values
  ('schema159_module_permissions','schema184_current_module_permission_proof','passed',184,
    jsonb_build_object(
      'module_security_passed',(select count(*) from public.ywi_module_security_assertions() where assertion_status='passed'),
      'module_acceptance_passed',(select count(*) from public.ywi_module_acceptance_security_assertions() where assertion_status='passed'),
      'active_admin_break_glass_blockers',(select count(*) from public.v_admin_module_access_integrity where lower(coalesce(role,''))='admin' and all_modules_manage is not true)
    )),
  ('schema160_it_readiness','schema184_current_it_readiness_proof','passed',184,
    jsonb_build_object(
      'it_readiness_assertions_passed',(select count(*) from public.ywi_it_readiness_security_assertions() where assertion_status='passed'),
      'active_admin_count',(select count(*) from public.v_admin_module_access_integrity where lower(coalesce(role,''))='admin'),
      'active_admin_break_glass_blockers',(select count(*) from public.v_admin_module_access_integrity where lower(coalesce(role,''))='admin' and all_modules_manage is not true)
    )),
  ('schema164_cross_module_boundaries','schema184_current_cross_module_boundary_proof','passed',184,
    jsonb_build_object(
      'module_write_boundary_passed',(select count(*) from public.ywi_module_write_boundary_security_assertions() where assertion_status='passed'),
      'cross_module_boundary_passed',(select count(*) from public.ywi_cross_module_boundary_security_assertions() where assertion_status='passed'),
      'cross_module_event_wiring_passed',(select count(*) from public.ywi_cross_module_event_wiring_assertions() where assertion_status='passed'),
      'module_acceptance_passed',(select count(*) from public.ywi_module_acceptance_security_assertions() where assertion_status='passed')
    ))
on conflict(rail_key,evidence_key) do nothing;

update public.admin_scorecard_progress_rails r
set metadata = r.metadata || jsonb_build_object(
      'schema184_truth_convergence',jsonb_build_object(
        'prior_status',r.rail_status,
        'prior_progress_percent',r.progress_percent,
        'prior_current_value',r.current_value,
        'prior_next_action_hint',r.next_action_hint,
        'evidence_key',case r.rail_key
          when 'schema159_module_permissions' then 'schema184_current_module_permission_proof'
          when 'schema160_it_readiness' then 'schema184_current_it_readiness_proof'
          when 'schema164_cross_module_boundaries' then 'schema184_current_cross_module_boundary_proof'
        end,
        'closed_at',now()
      )
    ),
    rail_status='complete',
    progress_percent=100,
    current_value=coalesce(r.target_value,r.current_value),
    next_action_hint='Historical rail closed by Schema 184 using current assertion-backed evidence. Future regressions are governed by current I.T./security/browser gates.',
    updated_at=now()
where r.rail_key in ('schema159_module_permissions','schema160_it_readiness','schema164_cross_module_boundaries');

create or replace view public.v_it_scorecard_progress_truth
with (security_invoker=true)
as
select
  r.rail_key,r.rail_area,r.rail_title,r.rail_status,r.progress_percent,r.current_value,r.target_value,
  r.next_action_hint,r.owner_hint,r.sort_order,r.updated_at,
  c.resolution_class,c.requires_human,c.requires_external,c.auto_close_allowed,c.resolution_note,
  coalesce(e.evidence_count,0)::int as evidence_count,
  e.latest_evidence_at,
  case
    when r.rail_status='complete' and c.auto_close_allowed and coalesce(e.passed_evidence_count,0)>0 then 'verified_complete'
    when r.rail_status='complete' then 'complete'
    when c.rail_key is null then 'unclassified_pending'
    else c.resolution_class || '_pending'
  end::text as resolution_status,
  case
    when r.rail_status='complete' and c.auto_close_allowed and coalesce(e.passed_evidence_count,0)=0 then 'red'
    when r.rail_status<>'complete' and c.rail_key is null then 'red'
    when r.rail_status<>'complete' then 'amber'
    else 'green'
  end::text as truth_status,
  case
    when r.rail_status='complete' and c.auto_close_allowed and coalesce(e.passed_evidence_count,0)=0 then 'A proof-closed historical rail has lost its completion evidence.'
    when r.rail_status<>'complete' and c.rail_key is null then 'This open rail has no explicit current resolution contract and must be classified before it is treated as release work.'
    when r.rail_status='complete' and c.auto_close_allowed then 'Historical rail is complete with immutable current-proof evidence.'
    when r.rail_status='complete' then 'Rail is complete.'
    else c.resolution_note
  end::text as truth_message,
  now() as checked_at
from public.admin_scorecard_progress_rails r
left join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
left join lateral (
  select count(*)::int as evidence_count,
         count(*) filter(where evidence_status='passed')::int as passed_evidence_count,
         max(recorded_at) as latest_evidence_at
  from public.it_scorecard_rail_completion_evidence ce
  where ce.rail_key=r.rail_key
) e on true
order by r.sort_order,r.rail_key;

revoke all on table public.v_it_scorecard_progress_truth from public,anon,authenticated;
grant select on table public.v_it_scorecard_progress_truth to service_role;

create or replace view public.v_it_scorecard_progress_truth_status
with (security_invoker=true)
as
select
  count(*)::int as rail_count,
  count(*) filter(where rail_status='complete')::int as complete_count,
  count(*) filter(where rail_status<>'complete')::int as open_count,
  count(*) filter(where rail_status<>'complete' and resolution_class is not null)::int as classified_open_count,
  count(*) filter(where rail_status<>'complete' and resolution_class is null)::int as unclassified_open_count,
  count(*) filter(where rail_status<>'complete' and resolution_class='staging_acceptance')::int as staging_acceptance_pending_count,
  count(*) filter(where rail_status<>'complete' and resolution_class='provider_acceptance')::int as provider_acceptance_pending_count,
  count(*) filter(where rail_status<>'complete' and resolution_class='accounting_acceptance')::int as accounting_acceptance_pending_count,
  count(*) filter(where rail_status<>'complete' and resolution_class='content_approval')::int as content_approval_pending_count,
  count(*) filter(where rail_status<>'complete' and resolution_class='feature_followup')::int as feature_followup_pending_count,
  count(*) filter(where rail_status<>'complete' and requires_human)::int as human_pending_count,
  count(*) filter(where rail_status<>'complete' and requires_external)::int as external_pending_count,
  count(*) filter(where auto_close_allowed and (rail_status<>'complete' or evidence_count=0))::int as proof_closure_drift_count,
  case
    when count(*) filter(where rail_status<>'complete' and resolution_class is null)>0
      or count(*) filter(where auto_close_allowed and (rail_status<>'complete' or evidence_count=0))>0 then 'red'
    else 'green'
  end::text as scorecard_truth_status,
  case
    when count(*) filter(where rail_status<>'complete' and resolution_class is null)>0 then 'At least one open readiness rail is unclassified.'
    when count(*) filter(where auto_close_allowed and (rail_status<>'complete' or evidence_count=0))>0 then 'A proof-closable historical rail has drifted from its evidence-backed completion state.'
    else 'Scorecard truth is structurally converged. Open rails remain explicit staging/provider/accounting/content/feature/build work and are not auto-completed.'
  end::text as truth_message,
  now() as checked_at
from public.v_it_scorecard_progress_truth;

revoke all on table public.v_it_scorecard_progress_truth_status from public,anon,authenticated;
grant select on table public.v_it_scorecard_progress_truth_status to service_role;

create or replace function public.ywi_it_scorecard_truth_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'it_scorecard_truth_surfaces_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('it_scorecard_rail_resolution_contracts','it_scorecard_rail_completion_evidence','v_it_scorecard_progress_truth','v_it_scorecard_progress_truth_status')
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Scorecard truth contracts, evidence and views are private service-role control-plane surfaces.'
  union all
  select 'it_scorecard_truth_open_rails_classified',
    case when not exists(select 1 from public.v_it_scorecard_progress_truth where rail_status<>'complete' and resolution_class is null)
      then 'passed' else 'failed' end,
    'Every open scorecard rail has an explicit current resolution class.'
  union all
  select 'it_scorecard_truth_historical_rails_evidence_closed',
    case when (select count(*) from public.v_it_scorecard_progress_truth
               where rail_key in ('schema159_module_permissions','schema160_it_readiness','schema164_cross_module_boundaries')
                 and rail_status='complete' and progress_percent=100 and resolution_status='verified_complete')=3
      then 'passed' else 'failed' end,
    'Schemas 159, 160 and 164 historical rails are complete only with immutable current-proof evidence.'
  union all
  select 'it_scorecard_truth_auto_close_bounded',
    case when (select count(*) from public.it_scorecard_rail_resolution_contracts where auto_close_allowed)=3
      and not exists(select 1 from public.it_scorecard_rail_resolution_contracts where auto_close_allowed and (requires_human or requires_external))
      then 'passed' else 'failed' end,
    'Only the three assertion-backed historical architecture rails may be auto-converged; human/external work cannot be auto-closed.'
  union all
  select 'it_scorecard_truth_evidence_immutable',
    case when exists(select 1 from pg_trigger where tgrelid='public.it_scorecard_rail_completion_evidence'::regclass and tgname='trg_guard_it_scorecard_completion_evidence_immutable' and not tgisinternal)
      then 'passed' else 'failed' end,
    'Historical completion evidence cannot be updated or deleted.'
  union all
  select 'it_scorecard_truth_execution_provider_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled is true or provider_mutation_enabled is true)
      then 'passed' else 'failed' end,
    'Build 184 does not enable Finance posting execution or provider/payment mutation.';
$$;

revoke all on function public.ywi_it_scorecard_truth_assertions() from public,anon,authenticated;
grant execute on function public.ywi_it_scorecard_truth_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('it_scorecard_truth_rail_status','public','admin_scorecard_progress_rails','rail_status','text','admin',150,184,true,'Build 184 scorecard truth classification and bounded historical closure.'),
  ('it_scorecard_truth_progress_percent','public','admin_scorecard_progress_rails','progress_percent','integer','admin',150,184,true,'Build 184 evidence-backed historical rail completion.'),
  ('it_scorecard_truth_metadata','public','admin_scorecard_progress_rails','metadata','jsonb','admin',150,184,true,'Build 184 preserves prior rail state and evidence provenance in metadata.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'it_scorecard_truth_convergence','I.T.','I.T. scorecard truth and blocker classification','critical',
  'Keep every open scorecard rail explicitly classified. Only assertion-backed historical rails may be evidence-closed; staging/provider/accounting/content/feature work stays open until actually completed.',
  'Admin > I.T. Readiness > Scorecard truth',54,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  184,'184_it_scorecard_truth_convergence','184_it_scorecard_truth_convergence.sql','2026-09-02p',
  'Converges stale historical readiness rails onto current proof and explicitly classifies genuinely open work.',
  'applied',
  'Closes only Schemas 159/160/164 historical rails after current assertion proof. Does not auto-complete human/provider/accounting/content/staging/feature work, mutate business data, enable Finance/provider execution, write Jobs state, or promote Production.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 184::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=184 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=184 then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 184 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;
