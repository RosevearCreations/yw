-- 174_finance_work_order_identity_contract_convergence.sql
-- Build 2026-09-02f
-- Repairs the Schema 173 Finance dependency contract against the canonical UUID work-order identity.
-- This is control-plane convergence only: no job/accounting/provider business state is mutated.

begin;

-- Schema 173 correctly exposed a live mismatch, but the contract itself had guessed bigint.
-- The canonical Jobs model uses UUID work-order identities across reviews, work orders and invoice candidates.
update public.app_schema_dependency_contracts
set expected_data_type='uuid',
    notes='Canonical completion-review work_order_id is UUID and references public.work_orders(id). Repaired by Schema 174 after live dependency proof.',
    updated_at=now()
where contract_key='completion_review_work_order'
  and relation_schema='public'
  and relation_name='job_completion_reviews'
  and column_name='work_order_id';

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('work_order_identity','public','work_orders','id','uuid','jobs',1,172,true,
   'Canonical work-order identity used by the Finance completion candidate path.'),
  ('invoice_candidate_work_order','public','job_invoice_candidates','work_order_id','uuid','finance',95,172,true,
   'Draft invoice candidates must preserve the canonical UUID work-order identity.'),
  ('completion_review_estimate','public','job_completion_reviews','estimate_id','uuid','jobs',94,172,true,
   'Canonical completion-review estimate reference used by Finance candidate generation.'),
  ('work_order_estimate','public','work_orders','estimate_id','uuid','jobs',1,172,true,
   'Canonical work-order estimate identity used by Finance candidate generation.'),
  ('invoice_candidate_estimate','public','job_invoice_candidates','estimate_id','uuid','finance',95,172,true,
   'Draft invoice candidate estimate identity must match the canonical work order/review.'),
  ('work_order_client','public','work_orders','client_id','uuid','jobs',1,172,true,
   'Canonical work-order client identity used by Finance candidate generation.'),
  ('invoice_candidate_client','public','job_invoice_candidates','client_id','uuid','finance',95,172,true,
   'Draft invoice candidate client identity must match the canonical work order.'),
  ('work_order_client_site','public','work_orders','client_site_id','uuid','jobs',1,172,true,
   'Canonical work-order client-site identity used by Finance candidate generation.'),
  ('invoice_candidate_client_site','public','job_invoice_candidates','client_site_id','uuid','finance',95,172,true,
   'Draft invoice candidate client-site identity must match the canonical work order.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,
  relation_name=excluded.relation_name,
  column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,
  owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,
  required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,
  notes=excluded.notes,
  updated_at=now();

update public.admin_scorecard_progress_rails
set next_action_hint='Schema 173 dependency guard is live-converged: completion review/work-order identity is canonical UUID and the Finance candidate identity chain is contract-checked.',
    metadata=coalesce(metadata,'{}'::jsonb) || '{"schema174_work_order_uuid_repair":true}'::jsonb,
    updated_at=now()
where rail_key='schema173_finance_schema_dependency_guard';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema174_finance_work_order_identity_convergence','architecture','Finance work-order identity contract convergence','complete',100,4,4,
  'Keep the Finance completion candidate path pinned to canonical UUID work-order/estimate/client identities before adding any posting authority.',
  'Finance / Jobs / I.T. / Architecture',94,
  '{"build":"2026-09-02f","schema":174,"schema173_contract_repair":"job_completion_reviews.work_order_id bigint -> uuid","identity_chain_contracts":true,"business_mutation":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  174,'174_finance_work_order_identity_contract_convergence','174_finance_work_order_identity_contract_convergence.sql','2026-09-02f',
  'Repairs the Schema 173 work-order dependency type to canonical UUID and extends Finance candidate identity-chain contracts.',
  'applied',
  'Control-plane convergence only. No Jobs writeback, invoice/journal posting, payment/provider mutation, fifth module or Production promotion is introduced.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 174::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=174 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=174
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 174 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
