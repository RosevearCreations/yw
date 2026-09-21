begin;

-- Schema 218 — Build 330 Training & Certification Matrix
-- Existing training_courses/training_records remain the completion/certificate authority.
-- This release adds requirement rules, explicit assignments, internal-company authorization
-- review, and a readiness matrix without claiming regulatory/legal authorization.

create table if not exists public.training_requirement_rules (
  id uuid primary key default gen_random_uuid(),
  requirement_code text not null unique,
  requirement_name text not null,
  course_id uuid not null references public.training_courses(id) on delete restrict,
  requirement_mode text not null default 'explicit',
  target_roles jsonb not null default '[]'::jsonb,
  target_position_terms jsonb not null default '[]'::jsonb,
  equipment_categories jsonb not null default '[]'::jsonb,
  equipment_context_required boolean not null default false,
  internal_authorization_required boolean not null default false,
  external_credential_expected boolean not null default false,
  refresher_months_override integer,
  reminder_days_before_override integer,
  applicability_note text,
  legal_boundary_note text not null default 'Internal training/readiness evidence only. This record does not itself establish any licence, legal qualification, regulatory credential, or external authorization.',
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_requirement_rules_code_chk check (requirement_code ~ '^[A-Z0-9_]{2,80}$'),
  constraint training_requirement_rules_mode_chk check (requirement_mode in ('automatic_all','automatic_role','automatic_position','explicit')),
  constraint training_requirement_rules_roles_json_chk check (jsonb_typeof(target_roles)='array'),
  constraint training_requirement_rules_positions_json_chk check (jsonb_typeof(target_position_terms)='array'),
  constraint training_requirement_rules_equipment_json_chk check (jsonb_typeof(equipment_categories)='array'),
  constraint training_requirement_rules_refresher_chk check (refresher_months_override is null or refresher_months_override between 1 and 120),
  constraint training_requirement_rules_reminder_chk check (reminder_days_before_override is null or reminder_days_before_override between 0 and 365)
);

create table if not exists public.training_requirement_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id uuid not null references public.training_requirement_rules(id) on delete cascade,
  equipment_category text,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  assignment_status text not null default 'required',
  due_date date,
  assignment_note text,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_requirement_assignments_status_chk check (assignment_status in ('required','deferred','not_required'))
);

create unique index if not exists training_requirement_assignments_scope_uidx
  on public.training_requirement_assignments(
    profile_id,requirement_id,coalesce(equipment_category,''),coalesce(equipment_item_id,0)
  );
create index if not exists training_requirement_assignments_profile_idx
  on public.training_requirement_assignments(profile_id,assignment_status,due_date);
create index if not exists training_requirement_assignments_requirement_idx
  on public.training_requirement_assignments(requirement_id,assignment_status,due_date);
create index if not exists training_requirement_assignments_equipment_idx
  on public.training_requirement_assignments(equipment_item_id)
  where equipment_item_id is not null;

create table if not exists public.training_internal_authorization_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id uuid not null references public.training_requirement_rules(id) on delete cascade,
  equipment_category text,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  authorization_status text not null default 'pending',
  authorization_scope text not null default 'internal_company_only',
  evidence_reference text,
  decision_note text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_internal_authorization_status_chk check (authorization_status in ('pending','authorized','suspended','revoked')),
  constraint training_internal_authorization_scope_chk check (authorization_scope='internal_company_only')
);

create unique index if not exists training_internal_authorization_scope_uidx
  on public.training_internal_authorization_reviews(
    profile_id,requirement_id,coalesce(equipment_category,''),coalesce(equipment_item_id,0)
  );
create index if not exists training_internal_authorization_profile_idx
  on public.training_internal_authorization_reviews(profile_id,authorization_status,expires_at);
create index if not exists training_internal_authorization_requirement_idx
  on public.training_internal_authorization_reviews(requirement_id,authorization_status,expires_at);
create index if not exists training_internal_authorization_equipment_idx
  on public.training_internal_authorization_reviews(equipment_item_id)
  where equipment_item_id is not null;

alter table public.training_requirement_rules enable row level security;
alter table public.training_requirement_assignments enable row level security;
alter table public.training_internal_authorization_reviews enable row level security;

revoke all on table public.training_requirement_rules from public,anon,authenticated;
revoke all on table public.training_requirement_assignments from public,anon,authenticated;
revoke all on table public.training_internal_authorization_reviews from public,anon,authenticated;
grant select,insert,update,delete on table public.training_requirement_rules to service_role;
grant select,insert,update,delete on table public.training_requirement_assignments to service_role;
grant select,insert,update,delete on table public.training_internal_authorization_reviews to service_role;

insert into public.training_courses(
  course_code,course_name,category,validity_months,reminder_days_before,
  requires_sds_acknowledgement,is_active,notes,self_service_enabled,require_supervisor_verification
) values
  ('ORIENTATION','Company / Field Orientation','orientation',null,30,false,true,'Internal onboarding/orientation evidence. Does not replace any legally required training.',false,true),
  ('EQUIPMENT_GENERAL','General Equipment Safety & Authorization','equipment',12,30,false,true,'Company equipment-safety expectations and authorization review.',false,true),
  ('CHAINSAW_BRUSH','Chainsaw / Brush Equipment Training','equipment',12,30,false,true,'Internal task/equipment training. External qualifications, where applicable, remain separate.',false,true),
  ('MOWER_TRACTOR','Mower / Tractor Authorization Training','equipment',12,30,false,true,'Internal mower/tractor training and authorization evidence.',false,true),
  ('PESTICIDE_APPLICATION','Pesticide / Application Credential Evidence','application',12,60,false,true,'Track applicable external credential evidence plus internal readiness. This record does not create a legal applicator credential.',false,true),
  ('TRAILER_TOWING','Trailer / Towing Training & Authorization','fleet',12,60,false,true,'Internal towing/trailer readiness. Driver licensing and legal towing requirements remain separate.',false,true),
  ('SUPERVISOR_SAFETY','Supervisor Safety Responsibilities','supervisor',12,30,false,true,'Company supervisor safety responsibilities and refresher evidence.',false,true),
  ('COMPANY_SOP','Company SOP / Policy Acknowledgement','sop',12,30,false,true,'Company SOP and policy acknowledgement/refresher evidence.',true,false)
on conflict(course_code) do update set
  course_name=excluded.course_name,
  category=excluded.category,
  validity_months=excluded.validity_months,
  reminder_days_before=excluded.reminder_days_before,
  requires_sds_acknowledgement=excluded.requires_sds_acknowledgement,
  notes=excluded.notes,
  is_active=true,
  self_service_enabled=excluded.self_service_enabled,
  require_supervisor_verification=excluded.require_supervisor_verification,
  updated_at=now();

insert into public.training_requirement_rules(
  requirement_code,requirement_name,course_id,requirement_mode,target_roles,target_position_terms,
  equipment_categories,equipment_context_required,internal_authorization_required,external_credential_expected,
  refresher_months_override,reminder_days_before_override,applicability_note,legal_boundary_note
)
select v.requirement_code,v.requirement_name,tc.id,v.requirement_mode,v.target_roles::jsonb,v.target_position_terms::jsonb,
       v.equipment_categories::jsonb,v.equipment_context_required,v.internal_authorization_required,
       v.external_credential_expected,v.refresher_months_override,v.reminder_days_before_override,
       v.applicability_note,
       'Internal readiness evidence only. Do not infer statutory qualification, licence, regulatory certification, driver privilege, pesticide/applicator authority, or other external legal authorization from this row.'
from (values
  ('ORIENTATION_CORE','Company / Field Orientation','ORIENTATION','automatic_all','[]','[]','[]',false,false,false,null,30,'Applies to active staff as company onboarding/readiness evidence.'),
  ('COMPANY_SOP_CORE','Company SOP / Policy Acknowledgement','COMPANY_SOP','automatic_all','[]','[]','[]',false,false,false,12,30,'Company SOP acknowledgement/refresher.'),
  ('WHMIS_APPLICABLE','WHMIS / Hazard Communication — where applicable','WHMIS','automatic_role','["employee"]','[]','[]',false,false,false,12,30,'Apply where worker duties/product exposure make WHMIS or hazard-communication training applicable. This rule is not itself a legal applicability determination.'),
  ('HAZARD_ASSESSMENT_FIELD','Hazard Assessment / JSA Review','JSA_HAZARD','automatic_role','["employee"]','[]','[]',false,false,false,12,30,'Field hazard-assessment/JSA expectations.'),
  ('PPE_FIELD','PPE Selection and Use','PPE_USE','automatic_role','["employee"]','[]','[]',false,false,false,12,30,'Field PPE selection, inspection and use.'),
  ('FIRST_AID_REQUIRED','First Aid / CPR — where required','FIRST_AID','explicit','[]','[]','[]',false,false,true,null,60,'Assign only where the role/site/operation requires it. External certificate validity must be verified separately.'),
  ('EQUIPMENT_GENERAL_FIELD','General Equipment Safety & Authorization','EQUIPMENT_GENERAL','automatic_role','["employee"]','[]','[]',false,false,false,12,30,'General field-equipment safety training; specific equipment may have additional authorization requirements.'),
  ('CHAINSAW_BRUSH_AUTH','Chainsaw / Brush Equipment Authorization','CHAINSAW_BRUSH','explicit','[]','[]','["chainsaw","brush","saw"]',true,true,false,12,30,'Assign to workers expected to use chainsaw/brush-cutting equipment. Internal authorization only.'),
  ('MOWER_TRACTOR_AUTH','Mower / Tractor Authorization','MOWER_TRACTOR','explicit','[]','[]','["mower","tractor"]',true,true,false,12,30,'Assign to workers expected to operate mower/tractor equipment. Internal authorization only.'),
  ('PESTICIDE_APPLICATION_CREDENTIAL','Pesticide / Application Credential — where required','PESTICIDE_APPLICATION','explicit','[]','[]','["sprayer","spreader","application"]',false,true,true,null,60,'Use only where application work is legally permitted and the required external credential evidence has been independently verified.'),
  ('TRAILER_TOWING_AUTH','Trailer / Towing Authorization','TRAILER_TOWING','explicit','[]','[]','["trailer","truck","tow"]',false,true,true,12,60,'Internal towing/trailer authorization. Valid licence/class, insurance, vehicle/trailer and jurisdictional requirements remain separate.'),
  ('SUPERVISOR_SAFETY_CORE','Supervisor Safety Responsibilities','SUPERVISOR_SAFETY','automatic_position','[]','["supervisor","lead","foreman"]','[]',false,false,false,12,30,'Applies when the worker position/title carries supervisor or crew-lead safety responsibilities.')
) as v(
  requirement_code,requirement_name,course_code,requirement_mode,target_roles,target_position_terms,
  equipment_categories,equipment_context_required,internal_authorization_required,external_credential_expected,
  refresher_months_override,reminder_days_before_override,applicability_note
)
join public.training_courses tc on tc.course_code=v.course_code
on conflict(requirement_code) do update set
  requirement_name=excluded.requirement_name,
  course_id=excluded.course_id,
  requirement_mode=excluded.requirement_mode,
  target_roles=excluded.target_roles,
  target_position_terms=excluded.target_position_terms,
  equipment_categories=excluded.equipment_categories,
  equipment_context_required=excluded.equipment_context_required,
  internal_authorization_required=excluded.internal_authorization_required,
  external_credential_expected=excluded.external_credential_expected,
  refresher_months_override=excluded.refresher_months_override,
  reminder_days_before_override=excluded.reminder_days_before_override,
  applicability_note=excluded.applicability_note,
  legal_boundary_note=excluded.legal_boundary_note,
  is_active=true,
  updated_at=now();

create or replace view public.v_training_requirement_directory
with (security_invoker=true)
as
select
  r.id,r.requirement_code,r.requirement_name,r.course_id,
  tc.course_code,tc.course_name,tc.category as course_category,
  r.requirement_mode,r.target_roles,r.target_position_terms,r.equipment_categories,
  r.equipment_context_required,r.internal_authorization_required,r.external_credential_expected,
  coalesce(r.refresher_months_override,tc.validity_months) as effective_refresher_months,
  coalesce(r.reminder_days_before_override,tc.reminder_days_before,30) as effective_reminder_days_before,
  tc.require_supervisor_verification,
  r.applicability_note,r.legal_boundary_note,r.is_active,r.updated_at
from public.training_requirement_rules r
join public.training_courses tc on tc.id=r.course_id
where r.is_active=true and tc.is_active=true;

create or replace view public.v_training_certification_matrix
with (security_invoker=true)
as
with automatic_rows as (
  select
    p.id as profile_id,
    r.id as requirement_id,
    null::text as equipment_category,
    null::bigint as equipment_item_id,
    null::date as assignment_due_date,
    'automatic'::text as applicability_source
  from public.profiles p
  cross join public.training_requirement_rules r
  where p.is_active is distinct from false
    and r.is_active=true
    and (
      r.requirement_mode='automatic_all'
      or (r.requirement_mode='automatic_role' and r.target_roles ? coalesce(p.role,''))
      or (
        r.requirement_mode='automatic_position'
        and exists (
          select 1
          from jsonb_array_elements_text(r.target_position_terms) term(value)
          where lower(coalesce(p.current_position,'')) like '%'||lower(term.value)||'%'
        )
      )
    )
), assigned_rows as (
  select
    a.profile_id,a.requirement_id,a.equipment_category,a.equipment_item_id,a.due_date,
    'explicit_assignment'::text as applicability_source
  from public.training_requirement_assignments a
  join public.profiles p on p.id=a.profile_id and p.is_active is distinct from false
  join public.training_requirement_rules r on r.id=a.requirement_id and r.is_active=true
  where a.assignment_status='required'
), applicable as (
  select * from automatic_rows
  union
  select * from assigned_rows
)
select
  a.profile_id,
  coalesce(p.full_name,p.email,'') as profile_name,
  p.employee_number,
  p.role as profile_role,
  p.current_position,
  r.id as requirement_id,
  r.requirement_code,
  r.requirement_name,
  r.requirement_mode,
  r.course_id,
  tc.course_code,
  tc.course_name,
  tc.category as course_category,
  a.applicability_source,
  a.equipment_category,
  a.equipment_item_id,
  ei.equipment_code,
  ei.equipment_name,
  ei.category as equipment_item_category,
  a.assignment_due_date,
  r.internal_authorization_required,
  r.external_credential_expected,
  r.equipment_context_required,
  r.applicability_note,
  r.legal_boundary_note,
  false as legal_authorization_inferred,
  tr.id as training_record_id,
  tr.completion_status,
  tr.completed_at,
  tr.expires_at,
  tr.trainer_name,
  tr.provider_name,
  tr.certificate_number,
  tr.license_number,
  tr.acknowledgement_method,
  tr.self_attested,
  tr.verified_by_profile_id,
  tr.verified_at,
  coalesce(r.refresher_months_override,tc.validity_months) as effective_refresher_months,
  coalesce(r.reminder_days_before_override,tc.reminder_days_before,30) as effective_reminder_days_before,
  ar.id as internal_authorization_id,
  coalesce(ar.authorization_status,'pending') as internal_authorization_status,
  ar.authorization_scope,
  ar.evidence_reference as internal_authorization_evidence_reference,
  ar.decision_note as internal_authorization_note,
  ar.decided_at as internal_authorized_at,
  ar.expires_at as internal_authorization_expires_at,
  case
    when tr.id is null then 'missing'
    when tr.completion_status='scheduled' then 'scheduled'
    when tr.completion_status='in_progress' then 'in_progress'
    when tr.completion_status='waived' then 'waived'
    when tr.completion_status<>'completed' then coalesce(tr.completion_status,'missing')
    when tr.expires_at is not null and tr.expires_at < current_date then 'expired'
    when tc.require_supervisor_verification and tr.verified_at is null then 'verification_pending'
    when r.external_credential_expected and nullif(btrim(coalesce(tr.certificate_number,'')),'') is null
      and nullif(btrim(coalesce(tr.license_number,'')),'') is null then 'external_credential_evidence_missing'
    when r.internal_authorization_required
      and (
        ar.id is null
        or ar.authorization_status<>'authorized'
        or (ar.expires_at is not null and ar.expires_at < current_date)
      ) then 'internal_authorization_pending'
    when tr.expires_at is not null
      and tr.expires_at <= current_date + make_interval(days=>coalesce(r.reminder_days_before_override,tc.reminder_days_before,30))
      then 'expiring'
    else 'current'
  end as readiness_status,
  case
    when tr.expires_at is not null then (tr.expires_at-current_date)::int
    else null
  end as days_until_training_expiry,
  greatest(r.updated_at,coalesce(tr.updated_at,r.updated_at),coalesce(ar.updated_at,r.updated_at)) as updated_at
from applicable a
join public.profiles p on p.id=a.profile_id
join public.training_requirement_rules r on r.id=a.requirement_id
join public.training_courses tc on tc.id=r.course_id
left join public.equipment_items ei on ei.id=a.equipment_item_id
left join lateral (
  select tr0.*
  from public.training_records tr0
  where tr0.profile_id=a.profile_id and tr0.course_id=r.course_id
  order by
    case when tr0.completion_status='completed' then 0 else 1 end,
    tr0.completed_at desc nulls last,
    tr0.created_at desc
  limit 1
) tr on true
left join lateral (
  select ar0.*
  from public.training_internal_authorization_reviews ar0
  where ar0.profile_id=a.profile_id
    and ar0.requirement_id=a.requirement_id
    and ar0.equipment_category is not distinct from a.equipment_category
    and ar0.equipment_item_id is not distinct from a.equipment_item_id
  order by ar0.updated_at desc,ar0.created_at desc
  limit 1
) ar on true;

create or replace view public.v_training_certification_matrix_summary
with (security_invoker=true)
as
select
  count(*)::int as requirement_row_count,
  count(*) filter(where readiness_status='current')::int as current_count,
  count(*) filter(where readiness_status='missing')::int as missing_count,
  count(*) filter(where readiness_status='scheduled')::int as scheduled_count,
  count(*) filter(where readiness_status='in_progress')::int as in_progress_count,
  count(*) filter(where readiness_status='expired')::int as expired_count,
  count(*) filter(where readiness_status='expiring')::int as expiring_count,
  count(*) filter(where readiness_status='verification_pending')::int as verification_pending_count,
  count(*) filter(where readiness_status='external_credential_evidence_missing')::int as external_credential_evidence_missing_count,
  count(*) filter(where readiness_status='internal_authorization_pending')::int as internal_authorization_pending_count,
  count(*) filter(where readiness_status not in ('current','waived'))::int as attention_count,
  max(updated_at) as last_updated_at
from public.v_training_certification_matrix;

revoke all on table public.v_training_requirement_directory from public,anon,authenticated;
revoke all on table public.v_training_certification_matrix from public,anon,authenticated;
revoke all on table public.v_training_certification_matrix_summary from public,anon,authenticated;
grant select on table public.v_training_requirement_directory to service_role;
grant select on table public.v_training_certification_matrix to service_role;
grant select on table public.v_training_certification_matrix_summary to service_role;

create or replace function public.ywi_rpc_training_requirement_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_code text:=upper(regexp_replace(coalesce(nullif(btrim(p_payload->>'requirement_code'),''),''),'[^A-Za-z0-9_]+','_','g'));
  v_name text:=nullif(btrim(p_payload->>'requirement_name'),'');
  v_course_id uuid:=nullif(p_payload->>'course_id','')::uuid;
  v_mode text:=lower(coalesce(nullif(btrim(p_payload->>'requirement_mode'),''),'explicit'));
  v_roles jsonb:=coalesce(p_payload->'target_roles','[]'::jsonb);
  v_positions jsonb:=coalesce(p_payload->'target_position_terms','[]'::jsonb);
  v_categories jsonb:=coalesce(p_payload->'equipment_categories','[]'::jsonb);
  v_row public.training_requirement_rules%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if v_code='' or v_name is null or v_course_id is null then raise exception 'Requirement code, name and course are required.' using errcode='23514'; end if;
  if v_code !~ '^[A-Z0-9_]{2,80}$' then raise exception 'Requirement code is invalid.' using errcode='23514'; end if;
  if v_mode not in ('automatic_all','automatic_role','automatic_position','explicit') then raise exception 'Unsupported requirement mode.' using errcode='23514'; end if;
  if jsonb_typeof(v_roles)<>'array' or jsonb_typeof(v_positions)<>'array' or jsonb_typeof(v_categories)<>'array' then
    raise exception 'Role, position and equipment category targets must be JSON arrays.' using errcode='23514';
  end if;
  if not exists(select 1 from public.training_courses where id=v_course_id and is_active=true) then
    raise exception 'Active training course was not found.' using errcode='P0002';
  end if;

  if v_id is null then select id into v_id from public.training_requirement_rules where requirement_code=v_code; end if;

  if v_id is null then
    insert into public.training_requirement_rules(
      requirement_code,requirement_name,course_id,requirement_mode,target_roles,target_position_terms,equipment_categories,
      equipment_context_required,internal_authorization_required,external_credential_expected,
      refresher_months_override,reminder_days_before_override,applicability_note,legal_boundary_note,is_active,
      created_by_profile_id,updated_by_profile_id
    ) values (
      v_code,v_name,v_course_id,v_mode,v_roles,v_positions,v_categories,
      coalesce((p_payload->>'equipment_context_required')::boolean,false),
      coalesce((p_payload->>'internal_authorization_required')::boolean,false),
      coalesce((p_payload->>'external_credential_expected')::boolean,false),
      nullif(p_payload->>'refresher_months_override','')::integer,
      nullif(p_payload->>'reminder_days_before_override','')::integer,
      nullif(btrim(p_payload->>'applicability_note'),''),
      coalesce(nullif(btrim(p_payload->>'legal_boundary_note'),''),
        'Internal training/readiness evidence only. This record does not itself establish any licence, legal qualification, regulatory credential, or external authorization.'),
      coalesce((p_payload->>'is_active')::boolean,true),p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.training_requirement_rules set
      requirement_code=v_code,requirement_name=v_name,course_id=v_course_id,requirement_mode=v_mode,
      target_roles=v_roles,target_position_terms=v_positions,equipment_categories=v_categories,
      equipment_context_required=coalesce((p_payload->>'equipment_context_required')::boolean,equipment_context_required),
      internal_authorization_required=coalesce((p_payload->>'internal_authorization_required')::boolean,internal_authorization_required),
      external_credential_expected=coalesce((p_payload->>'external_credential_expected')::boolean,external_credential_expected),
      refresher_months_override=case when p_payload ? 'refresher_months_override' then nullif(p_payload->>'refresher_months_override','')::integer else refresher_months_override end,
      reminder_days_before_override=case when p_payload ? 'reminder_days_before_override' then nullif(p_payload->>'reminder_days_before_override','')::integer else reminder_days_before_override end,
      applicability_note=case when p_payload ? 'applicability_note' then nullif(btrim(p_payload->>'applicability_note'),'') else applicability_note end,
      legal_boundary_note=coalesce(nullif(btrim(p_payload->>'legal_boundary_note'),''),legal_boundary_note),
      is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id
    returning * into v_row;
    if not found then raise exception 'Training requirement was not found.' using errcode='P0002'; end if;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_training_assignment_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_profile_id uuid:=nullif(p_payload->>'profile_id','')::uuid;
  v_requirement_id uuid:=nullif(p_payload->>'requirement_id','')::uuid;
  v_equipment_item_id bigint:=nullif(p_payload->>'equipment_item_id','')::bigint;
  v_equipment_category text:=nullif(btrim(p_payload->>'equipment_category'),'');
  v_status text:=lower(coalesce(nullif(btrim(p_payload->>'assignment_status'),''),'required'));
  v_rule public.training_requirement_rules%rowtype;
  v_row public.training_requirement_assignments%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if v_profile_id is null or v_requirement_id is null then raise exception 'Worker and training requirement are required.' using errcode='23514'; end if;
  if v_status not in ('required','deferred','not_required') then raise exception 'Unsupported assignment status.' using errcode='23514'; end if;
  if not exists(select 1 from public.profiles where id=v_profile_id and is_active is distinct from false) then
    raise exception 'Active worker profile was not found.' using errcode='P0002';
  end if;
  select * into v_rule from public.training_requirement_rules where id=v_requirement_id and is_active=true;
  if not found then raise exception 'Active training requirement was not found.' using errcode='P0002'; end if;
  if v_equipment_item_id is not null and not exists(select 1 from public.equipment_items where id=v_equipment_item_id) then
    raise exception 'Equipment item was not found.' using errcode='P0002';
  end if;
  if v_rule.equipment_context_required and v_equipment_item_id is null and v_equipment_category is null then
    raise exception 'This training requirement needs an equipment item or equipment category context.' using errcode='23514';
  end if;
  if jsonb_array_length(v_rule.equipment_categories)>0 and v_equipment_category is not null
     and not (v_rule.equipment_categories ? lower(v_equipment_category)) then
    raise exception 'Equipment category is outside this requirement rule.' using errcode='23514';
  end if;

  insert into public.training_requirement_assignments(
    profile_id,requirement_id,equipment_category,equipment_item_id,assignment_status,due_date,assignment_note,assigned_by_profile_id
  ) values (
    v_profile_id,v_requirement_id,lower(v_equipment_category),v_equipment_item_id,v_status,
    nullif(p_payload->>'due_date','')::date,nullif(btrim(p_payload->>'assignment_note'),''),p_actor_profile_id
  )
  on conflict(profile_id,requirement_id,(coalesce(equipment_category,'')),(coalesce(equipment_item_id,0)))
  do update set
    assignment_status=excluded.assignment_status,due_date=excluded.due_date,
    assignment_note=excluded.assignment_note,assigned_by_profile_id=excluded.assigned_by_profile_id,updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_training_record_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_profile_id uuid:=nullif(p_payload->>'profile_id','')::uuid;
  v_course_id uuid:=nullif(p_payload->>'course_id','')::uuid;
  v_status text:=lower(coalesce(nullif(btrim(p_payload->>'completion_status'),''),'completed'));
  v_completed date:=nullif(p_payload->>'completed_at','')::date;
  v_expires date:=nullif(p_payload->>'expires_at','')::date;
  v_course public.training_courses%rowtype;
  v_row public.training_records%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if v_profile_id is null or v_course_id is null then raise exception 'Worker and training course are required.' using errcode='23514'; end if;
  if v_status not in ('scheduled','in_progress','completed','expired','waived') then raise exception 'Unsupported training status.' using errcode='23514'; end if;
  if not exists(select 1 from public.profiles where id=v_profile_id and is_active is distinct from false) then
    raise exception 'Active worker profile was not found.' using errcode='P0002';
  end if;
  select * into v_course from public.training_courses where id=v_course_id and is_active=true;
  if not found then raise exception 'Active training course was not found.' using errcode='P0002'; end if;
  if v_status='completed' and v_completed is null then v_completed:=current_date; end if;
  if v_status='completed' and v_expires is null and v_course.validity_months is not null then
    v_expires:=(v_completed + make_interval(months=>v_course.validity_months))::date;
  end if;
  if v_expires is not null and v_completed is not null and v_expires < v_completed then
    raise exception 'Training expiry cannot be before completion.' using errcode='23514';
  end if;

  if v_id is null then
    insert into public.training_records(
      profile_id,course_id,completion_status,completed_at,expires_at,trainer_name,provider_name,
      certificate_number,license_number,notes,created_by_profile_id,self_attested,self_attested_at,
      acknowledgement_method,verified_by_profile_id,verified_at
    ) values (
      v_profile_id,v_course_id,v_status,v_completed,v_expires,
      nullif(btrim(p_payload->>'trainer_name'),''),nullif(btrim(p_payload->>'provider_name'),''),
      nullif(btrim(p_payload->>'certificate_number'),''),nullif(btrim(p_payload->>'license_number'),''),
      nullif(btrim(p_payload->>'notes'),''),p_actor_profile_id,false,null,
      'admin_recorded',
      case when coalesce((p_payload->>'supervisor_verified')::boolean,false) then p_actor_profile_id else null end,
      case when coalesce((p_payload->>'supervisor_verified')::boolean,false) then current_date else null end
    ) returning * into v_row;
  else
    update public.training_records set
      profile_id=v_profile_id,course_id=v_course_id,completion_status=v_status,completed_at=v_completed,expires_at=v_expires,
      trainer_name=nullif(btrim(p_payload->>'trainer_name'),''),
      provider_name=nullif(btrim(p_payload->>'provider_name'),''),
      certificate_number=nullif(btrim(p_payload->>'certificate_number'),''),
      license_number=nullif(btrim(p_payload->>'license_number'),''),
      notes=nullif(btrim(p_payload->>'notes'),''),
      acknowledgement_method='admin_recorded',
      verified_by_profile_id=case when coalesce((p_payload->>'supervisor_verified')::boolean,false) then p_actor_profile_id else verified_by_profile_id end,
      verified_at=case when coalesce((p_payload->>'supervisor_verified')::boolean,false) then current_date else verified_at end,
      updated_at=now()
    where id=v_id
    returning * into v_row;
    if not found then raise exception 'Training record was not found.' using errcode='P0002'; end if;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_training_internal_authorization_decision(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_profile_id uuid:=nullif(p_payload->>'profile_id','')::uuid;
  v_requirement_id uuid:=nullif(p_payload->>'requirement_id','')::uuid;
  v_equipment_item_id bigint:=nullif(p_payload->>'equipment_item_id','')::bigint;
  v_equipment_category text:=nullif(btrim(p_payload->>'equipment_category'),'');
  v_status text:=lower(coalesce(nullif(btrim(p_payload->>'authorization_status'),''),'pending'));
  v_rule public.training_requirement_rules%rowtype;
  v_course public.training_courses%rowtype;
  v_record public.training_records%rowtype;
  v_expiry date:=nullif(p_payload->>'expires_at','')::date;
  v_row public.training_internal_authorization_reviews%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if v_profile_id is null or v_requirement_id is null then raise exception 'Worker and training requirement are required.' using errcode='23514'; end if;
  if v_status not in ('pending','authorized','suspended','revoked') then raise exception 'Unsupported internal authorization status.' using errcode='23514'; end if;
  select * into v_rule from public.training_requirement_rules where id=v_requirement_id and is_active=true;
  if not found then raise exception 'Active training requirement was not found.' using errcode='P0002'; end if;
  if not v_rule.internal_authorization_required then raise exception 'This requirement does not use internal equipment/task authorization.' using errcode='23514'; end if;
  select * into v_course from public.training_courses where id=v_rule.course_id and is_active=true;
  if not found then raise exception 'Active training course was not found.' using errcode='P0002'; end if;
  if v_rule.equipment_context_required and v_equipment_item_id is null and v_equipment_category is null then
    raise exception 'Equipment context is required for this authorization.' using errcode='23514';
  end if;

  if v_status='authorized' then
    select * into v_record
    from public.training_records
    where profile_id=v_profile_id and course_id=v_rule.course_id and completion_status='completed'
    order by completed_at desc nulls last,created_at desc
    limit 1;
    if not found then raise exception 'Completed training evidence is required before internal authorization.' using errcode='23514'; end if;
    if v_record.expires_at is not null and v_record.expires_at < current_date then
      raise exception 'Training evidence is expired.' using errcode='23514';
    end if;
    if v_course.require_supervisor_verification and v_record.verified_at is null then
      raise exception 'Supervisor verification is required before internal authorization.' using errcode='23514';
    end if;
    if v_rule.external_credential_expected
       and nullif(btrim(coalesce(v_record.certificate_number,'')),'') is null
       and nullif(btrim(coalesce(v_record.license_number,'')),'') is null then
      raise exception 'External credential evidence reference is required before internal authorization.' using errcode='23514';
    end if;
    if v_expiry is null then v_expiry:=v_record.expires_at; end if;
    if v_record.expires_at is not null and v_expiry is not null and v_expiry>v_record.expires_at then
      raise exception 'Internal authorization cannot outlast the supporting training record.' using errcode='23514';
    end if;
  end if;

  insert into public.training_internal_authorization_reviews(
    profile_id,requirement_id,equipment_category,equipment_item_id,authorization_status,authorization_scope,
    evidence_reference,decision_note,decided_by_profile_id,decided_at,expires_at
  ) values (
    v_profile_id,v_requirement_id,lower(v_equipment_category),v_equipment_item_id,v_status,'internal_company_only',
    nullif(btrim(p_payload->>'evidence_reference'),''),nullif(btrim(p_payload->>'decision_note'),''),
    p_actor_profile_id,now(),v_expiry
  )
  on conflict(profile_id,requirement_id,(coalesce(equipment_category,'')),(coalesce(equipment_item_id,0)))
  do update set
    authorization_status=excluded.authorization_status,authorization_scope='internal_company_only',
    evidence_reference=excluded.evidence_reference,decision_note=excluded.decision_note,
    decided_by_profile_id=excluded.decided_by_profile_id,decided_at=excluded.decided_at,
    expires_at=excluded.expires_at,updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.ywi_rpc_training_requirement_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_training_assignment_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_training_record_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_training_internal_authorization_decision(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_training_requirement_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_training_assignment_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_training_record_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_training_internal_authorization_decision(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('training_requirement_save','safety','approve','write','training_matrix','safety.training_requirement.saved',false,true,'Create/update internal training requirement rules.'),
  ('training_assignment_save','safety','approve','write','training_matrix','safety.training_assignment.saved',false,true,'Assign/defer/remove a training requirement for a worker/equipment context.'),
  ('training_record_save','safety','approve','write','training_matrix','safety.training_record.saved',false,true,'Record supervisor/admin training completion/certificate evidence in the existing training_records authority.'),
  ('training_internal_authorization_decision','safety','approve','write','training_matrix','safety.training_internal_authorization.decided',false,true,'Record internal-company equipment/task authorization after training evidence checks. This is not external legal authorization.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=58 then 'passed' else 'failed' end,
    'Exactly 58 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null
    ) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists (
      select 1 from public.app_module_write_contracts
      where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled
    ) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'boundary_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts, emitted events and attention disposition state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_training_certification_matrix_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'training_matrix_tables_private',
    case when
      coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='training_requirement_rules'),false)
      and coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='training_requirement_assignments'),false)
      and coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='training_internal_authorization_reviews'),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public'
          and table_name in ('training_requirement_rules','training_requirement_assignments','training_internal_authorization_reviews')
          and grantee in ('anon','authenticated','PUBLIC')
      ) then 'passed' else 'failed' end,
    'Training matrix control tables use RLS and remain service-private.'
  union all
  select 'training_matrix_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_training_requirement_directory','v_training_certification_matrix','v_training_certification_matrix_summary')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Training requirement and matrix read models remain server-only.'
  union all
  select 'training_matrix_rpcs_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_training_requirement_save','ywi_rpc_training_assignment_save','ywi_rpc_training_record_save','ywi_rpc_training_internal_authorization_decision')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Training matrix mutation RPCs remain service-role-only.'
  union all
  select 'existing_training_record_authority_reused',
    case when to_regclass('public.training_records') is not null
      and position('insert into public.training_records' in lower(pg_get_functiondef('public.ywi_rpc_training_record_save(jsonb,uuid)'::regprocedure)))>0
      then 'passed' else 'failed' end,
    'Build 330 writes completion/certificate evidence into the existing training_records authority.'
  union all
  select 'no_legal_authorization_inference',
    case when not exists(
      select 1 from public.v_training_certification_matrix where legal_authorization_inferred is distinct from false
    ) then 'passed' else 'failed' end,
    'Every matrix row explicitly refuses to infer external legal authorization.'
  union all
  select 'internal_authorization_scope_bounded',
    case when not exists(
      select 1 from public.training_internal_authorization_reviews where authorization_scope<>'internal_company_only'
    ) then 'passed' else 'failed' end,
    'Equipment/task authorization decisions are explicitly internal-company-only.'
  union all
  select 'training_matrix_write_contracts_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('training_requirement_save','training_assignment_save','training_record_save','training_internal_authorization_decision')
        and owner_module='safety' and minimum_access='approve' and is_enabled)=4 then 'passed' else 'failed' end,
    'Requirement, assignment, training evidence and internal authorization writes are explicit Safety-approve contracts.';
$$;
revoke all on function public.ywi_training_certification_matrix_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_training_certification_matrix_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  218,'training_certification_matrix',
  'Build 330 role/equipment-based training requirements, existing training-record evidence matrix, and internal-company authorization review.',
  'applied',now(),'schema218',
  'Matrix readiness never implies statutory qualification or external legal authorization. Existing training_records remain completion/certificate authority.',
  '218_training_certification_matrix.sql','schema218'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  218 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=218 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>218 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=218 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>218 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
