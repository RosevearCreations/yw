begin;

-- Schema 233 — Build 345 Quality Control & Customer Signoff.
-- Adds a private QC layer around the existing canonical work-order execution proof,
-- supervisor closeout and customer-portal signoff authorities. Staff never sign for customers.

create table if not exists public.quality_control_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  service_context text not null default 'general_outdoor',
  season_context text not null default 'four_season',
  supervisor_qc_required boolean not null default true,
  customer_signoff_mode text not null default 'recommended',
  notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_control_templates_service_chk check (
    service_context in ('mowing_landscaping','landscape_installation','fall_cleanup','snow_clearing_removal','general_outdoor')
  ),
  constraint quality_control_templates_season_chk check (
    season_context in ('spring_summer','fall','winter','four_season')
  ),
  constraint quality_control_templates_signoff_chk check (
    customer_signoff_mode in ('none','optional','recommended','required')
  )
);

create table if not exists public.quality_control_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quality_control_templates(id) on delete cascade,
  item_code text not null,
  item_prompt text not null,
  evidence_requirement text not null default 'none',
  is_required boolean not null default true,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id,item_code),
  constraint quality_control_template_items_evidence_chk check (
    evidence_requirement in ('none','before','after','before_after','detail')
  ),
  constraint quality_control_template_items_sort_chk check (sort_order between 0 and 10000)
);

create table if not exists public.work_order_quality_control_runs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references public.work_orders(id) on delete cascade,
  template_id uuid not null references public.quality_control_templates(id) on delete restrict,
  job_session_id uuid references public.job_sessions(id) on delete set null,
  run_status text not null default 'draft',
  crew_completion_summary text,
  customer_safe_summary text,
  crew_completed_by_profile_id uuid references public.profiles(id) on delete set null,
  crew_completed_at timestamptz,
  review_status text not null default 'pending',
  supervisor_review_note text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_qc_run_status_chk check (
    run_status in ('draft','crew_complete','awaiting_supervisor_qc','rework_required','approved','blocked')
  ),
  constraint work_order_qc_review_status_chk check (
    review_status in ('pending','not_required','approved','rework_required')
  )
);

create table if not exists public.work_order_quality_control_items (
  id uuid primary key default gen_random_uuid(),
  qc_run_id uuid not null references public.work_order_quality_control_runs(id) on delete cascade,
  template_item_id uuid references public.quality_control_template_items(id) on delete set null,
  item_code text not null,
  item_prompt text not null,
  evidence_requirement text not null default 'none',
  is_required boolean not null default true,
  result_status text not null default 'pending',
  completion_note text,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(qc_run_id,item_code),
  constraint work_order_qc_items_evidence_chk check (
    evidence_requirement in ('none','before','after','before_after','detail')
  ),
  constraint work_order_qc_items_result_chk check (
    result_status in ('pending','pass','fail','not_applicable')
  )
);

create table if not exists public.work_order_quality_control_evidence_links (
  id uuid primary key default gen_random_uuid(),
  qc_run_id uuid not null references public.work_order_quality_control_runs(id) on delete cascade,
  qc_item_id uuid references public.work_order_quality_control_items(id) on delete set null,
  execution_proof_id uuid not null references public.work_order_execution_proofs(id) on delete restrict,
  evidence_role text not null default 'after',
  customer_safe boolean not null default false,
  caption text,
  linked_by_profile_id uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique(qc_run_id,execution_proof_id,evidence_role),
  constraint work_order_qc_evidence_role_chk check (
    evidence_role in ('before','after','detail','final')
  )
);

create table if not exists public.work_order_quality_control_deficiencies (
  id uuid primary key default gen_random_uuid(),
  qc_run_id uuid not null references public.work_order_quality_control_runs(id) on delete cascade,
  qc_item_id uuid references public.work_order_quality_control_items(id) on delete set null,
  deficiency_summary text not null,
  severity text not null default 'minor',
  deficiency_status text not null default 'open',
  customer_safe_note text,
  opened_by_profile_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_qc_deficiency_severity_chk check (
    severity in ('minor','major','critical')
  ),
  constraint work_order_qc_deficiency_status_chk check (
    deficiency_status in ('open','rework_required','rework_in_progress','resolved','accepted_exception')
  )
);

create table if not exists public.work_order_quality_control_rework_events (
  id uuid primary key default gen_random_uuid(),
  deficiency_id uuid not null references public.work_order_quality_control_deficiencies(id) on delete cascade,
  event_type text not null,
  event_note text not null,
  resolution_execution_proof_id uuid references public.work_order_execution_proofs(id) on delete set null,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint work_order_qc_rework_event_type_chk check (
    event_type in ('started','progress','completed')
  )
);

create index if not exists quality_control_templates_context_idx
  on public.quality_control_templates(service_context,season_context,is_active);
create index if not exists work_order_qc_runs_status_idx
  on public.work_order_quality_control_runs(run_status,review_status,updated_at desc);
create index if not exists work_order_qc_items_run_idx
  on public.work_order_quality_control_items(qc_run_id,sort_order);
create index if not exists work_order_qc_evidence_run_idx
  on public.work_order_quality_control_evidence_links(qc_run_id,evidence_role,linked_at desc);
create index if not exists work_order_qc_deficiencies_run_idx
  on public.work_order_quality_control_deficiencies(qc_run_id,deficiency_status,severity,updated_at desc);
create index if not exists work_order_qc_rework_deficiency_idx
  on public.work_order_quality_control_rework_events(deficiency_id,recorded_at desc);

alter table public.quality_control_templates enable row level security;
alter table public.quality_control_template_items enable row level security;
alter table public.work_order_quality_control_runs enable row level security;
alter table public.work_order_quality_control_items enable row level security;
alter table public.work_order_quality_control_evidence_links enable row level security;
alter table public.work_order_quality_control_deficiencies enable row level security;
alter table public.work_order_quality_control_rework_events enable row level security;

revoke all on table public.quality_control_templates from public,anon,authenticated;
revoke all on table public.quality_control_template_items from public,anon,authenticated;
revoke all on table public.work_order_quality_control_runs from public,anon,authenticated;
revoke all on table public.work_order_quality_control_items from public,anon,authenticated;
revoke all on table public.work_order_quality_control_evidence_links from public,anon,authenticated;
revoke all on table public.work_order_quality_control_deficiencies from public,anon,authenticated;
revoke all on table public.work_order_quality_control_rework_events from public,anon,authenticated;

grant select,insert,update,delete on table public.quality_control_templates to service_role;
grant select,insert,update,delete on table public.quality_control_template_items to service_role;
grant select,insert,update,delete on table public.work_order_quality_control_runs to service_role;
grant select,insert,update,delete on table public.work_order_quality_control_items to service_role;
grant select,insert,update,delete on table public.work_order_quality_control_evidence_links to service_role;
grant select,insert,update,delete on table public.work_order_quality_control_deficiencies to service_role;
grant select,insert on table public.work_order_quality_control_rework_events to service_role;

insert into public.quality_control_templates(
  template_code,template_name,service_context,season_context,supervisor_qc_required,customer_signoff_mode,notes,is_active
) values
  ('mowing_landscaping_completion','Mowing & Landscaping Completion','mowing_landscaping','spring_summer',false,'recommended','Routine mowing/landscaping completion with property-safe finish checks.',true),
  ('landscape_installation_completion','Landscape Installation Completion','landscape_installation','four_season',true,'required','Installation completion requires supervisor QC and customer signoff.',true),
  ('fall_cleanup_completion','Fall Cleanup Completion','fall_cleanup','fall',true,'recommended','Fall cleanup/leaf collection completion and disposal checks.',true),
  ('winter_snow_ice_completion','Winter Snow & Ice Completion','snow_clearing_removal','winter',true,'recommended','Snow/ice clearing completion with access, accumulation and traction/salt evidence.',true)
on conflict(template_code) do update set
  template_name=excluded.template_name,service_context=excluded.service_context,season_context=excluded.season_context,
  supervisor_qc_required=excluded.supervisor_qc_required,customer_signoff_mode=excluded.customer_signoff_mode,
  notes=excluded.notes,is_active=true,updated_at=now();

with item_seed(template_code,item_code,item_prompt,evidence_requirement,is_required,sort_order) as (
  values
    ('mowing_landscaping_completion','surface_complete','Mowing/landscaping scope is visibly complete and even.','after',true,10),
    ('mowing_landscaping_completion','edges_cleanup','Edges, clippings and hard-surface cleanup are complete.','after',true,20),
    ('mowing_landscaping_completion','property_protected','Property, gates, beds, fixtures and customer areas were left protected.','none',true,30),
    ('landscape_installation_completion','before_condition','Before-condition evidence is linked for the completed installation area.','before',true,10),
    ('landscape_installation_completion','installed_scope','Installed scope matches the authorized work order/change orders.','after',true,20),
    ('landscape_installation_completion','finish_quality','Grade, placement, cleanup and visible finish meet the completion standard.','detail',true,30),
    ('fall_cleanup_completion','leaf_debris_removed','Leaves/debris are removed from contracted areas.','after',true,10),
    ('fall_cleanup_completion','beds_edges_clear','Beds, edges, entrances and hard surfaces are left reasonably clear.','after',true,20),
    ('fall_cleanup_completion','disposal_complete','Collected material/disposal handling is complete or documented.','none',true,30),
    ('winter_snow_ice_completion','access_cleared','Contracted access, walkways/drive areas are cleared to the service standard.','after',true,10),
    ('winter_snow_ice_completion','ice_hazards_addressed','Observed ice hazards are treated or documented for follow-up.','detail',true,20),
    ('winter_snow_ice_completion','snow_storage_safe','Snow placement does not knowingly obstruct sight lines, doors, drains or required access.','after',true,30)
)
insert into public.quality_control_template_items(
  template_id,item_code,item_prompt,evidence_requirement,is_required,sort_order
)
select t.id,s.item_code,s.item_prompt,s.evidence_requirement,s.is_required,s.sort_order
from item_seed s
join public.quality_control_templates t on t.template_code=s.template_code
on conflict(template_id,item_code) do update set
  item_prompt=excluded.item_prompt,evidence_requirement=excluded.evidence_requirement,
  is_required=excluded.is_required,sort_order=excluded.sort_order,is_active=true,updated_at=now();

create or replace function public.ywi_quality_control_ready_for_closeout(p_qc_run_id uuid)
returns boolean
language sql stable security invoker set search_path=public as $$
  select exists(
    select 1
    from public.work_order_quality_control_runs r
    join public.quality_control_templates t on t.id=r.template_id
    where r.id=p_qc_run_id
      and nullif(btrim(coalesce(r.customer_safe_summary,'')),'') is not null
      and r.run_status not in ('draft','blocked','rework_required')
      and (not t.supervisor_qc_required or r.review_status='approved')
      and not exists(
        select 1 from public.work_order_quality_control_items i
        where i.qc_run_id=r.id
          and ((i.is_required and i.result_status<>'pass') or i.result_status='fail')
      )
      and not exists(
        select 1 from public.work_order_quality_control_deficiencies d
        where d.qc_run_id=r.id and d.deficiency_status not in ('resolved','accepted_exception')
      )
      and (
        not exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=r.id and i.evidence_requirement in ('before','before_after'))
        or exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=r.id and e.evidence_role='before')
      )
      and (
        not exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=r.id and i.evidence_requirement in ('after','before_after'))
        or exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=r.id and e.evidence_role in ('after','final'))
      )
      and (
        not exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=r.id and i.evidence_requirement='detail')
        or exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=r.id and e.evidence_role in ('detail','final'))
      )
  );
$$;
revoke all on function public.ywi_quality_control_ready_for_closeout(uuid) from public,anon,authenticated;
grant execute on function public.ywi_quality_control_ready_for_closeout(uuid) to service_role;

create or replace function public.ywi_guard_closeout_quality_control()
returns trigger
language plpgsql security invoker set search_path=public as $$
declare
  v_qc_run_id uuid;
begin
  select id into v_qc_run_id
  from public.work_order_quality_control_runs
  where work_order_id=new.work_order_id
  limit 1;

  if v_qc_run_id is not null and not public.ywi_quality_control_ready_for_closeout(v_qc_run_id) then
    raise exception 'Quality control has started for this work order and must be complete before closeout can proceed.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.ywi_guard_closeout_quality_control() from public,anon,authenticated;
grant execute on function public.ywi_guard_closeout_quality_control() to service_role;

drop trigger if exists trg_work_order_closeout_quality_control_guard on public.work_order_closeout_packages;
create trigger trg_work_order_closeout_quality_control_guard
before insert or update of closeout_status,customer_summary,customer_signoff_status,invoice_readiness_status
on public.work_order_closeout_packages
for each row execute function public.ywi_guard_closeout_quality_control();

create or replace view public.v_quality_control_template_directory
with (security_invoker=true) as
select
  t.*,
  count(i.id)::int as item_count,
  count(i.id) filter(where i.is_required)::int as required_item_count,
  count(i.id) filter(where i.evidence_requirement<>'none')::int as evidence_item_count
from public.quality_control_templates t
left join public.quality_control_template_items i on i.template_id=t.id and i.is_active
group by t.id;

create or replace view public.v_quality_control_run_directory
with (security_invoker=true) as
select
  r.*,
  t.template_code,t.template_name,t.service_context,t.season_context,t.supervisor_qc_required,t.customer_signoff_mode,
  wo.work_order_number,wo.status as work_order_status,wo.work_type,wo.client_id,wo.client_site_id,wo.scheduled_start,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  public.ywi_quality_control_ready_for_closeout(r.id) as ready_for_closeout,
  coalesce(item_counts.required_total,0)::int as required_item_count,
  coalesce(item_counts.required_passed,0)::int as required_item_passed_count,
  coalesce(item_counts.failed_count,0)::int as failed_item_count,
  coalesce(evidence_counts.before_count,0)::int as before_evidence_count,
  coalesce(evidence_counts.after_count,0)::int as after_evidence_count,
  coalesce(evidence_counts.detail_count,0)::int as detail_evidence_count,
  coalesce(def_counts.open_count,0)::int as unresolved_deficiency_count,
  cp.id as closeout_package_id,
  cp.closeout_status,
  cp.customer_signoff_required as canonical_customer_signoff_required,
  cp.customer_signoff_status as canonical_customer_signoff_status,
  cp.signed_off_by_name as canonical_signed_off_by_name,
  cp.signed_off_at as canonical_signed_off_at,
  'work_order_closeout_packages + customer portal signoff remain canonical'::text as customer_signoff_authority
from public.work_order_quality_control_runs r
join public.quality_control_templates t on t.id=r.template_id
join public.work_orders wo on wo.id=r.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.client_sites cs on cs.id=wo.client_site_id
left join public.work_order_closeout_packages cp on cp.work_order_id=wo.id
left join lateral (
  select count(*) filter(where i.is_required)::int as required_total,
         count(*) filter(where i.is_required and i.result_status='pass')::int as required_passed,
         count(*) filter(where i.result_status='fail')::int as failed_count
  from public.work_order_quality_control_items i where i.qc_run_id=r.id
) item_counts on true
left join lateral (
  select count(*) filter(where e.evidence_role='before')::int as before_count,
         count(*) filter(where e.evidence_role in ('after','final'))::int as after_count,
         count(*) filter(where e.evidence_role in ('detail','final'))::int as detail_count
  from public.work_order_quality_control_evidence_links e where e.qc_run_id=r.id
) evidence_counts on true
left join lateral (
  select count(*) filter(where d.deficiency_status not in ('resolved','accepted_exception'))::int as open_count
  from public.work_order_quality_control_deficiencies d where d.qc_run_id=r.id
) def_counts on true;

create or replace view public.v_quality_control_item_directory
with (security_invoker=true) as
select i.*,r.work_order_id,wo.work_order_number,t.template_code,t.template_name
from public.work_order_quality_control_items i
join public.work_order_quality_control_runs r on r.id=i.qc_run_id
join public.work_orders wo on wo.id=r.work_order_id
join public.quality_control_templates t on t.id=r.template_id;

create or replace view public.v_quality_control_evidence_directory
with (security_invoker=true) as
select e.*,r.work_order_id,wo.work_order_number,p.proof_type,p.proof_status,p.customer_visible,p.title as proof_title,
       p.customer_summary as proof_customer_summary,p.occurred_at
from public.work_order_quality_control_evidence_links e
join public.work_order_quality_control_runs r on r.id=e.qc_run_id
join public.work_orders wo on wo.id=r.work_order_id
join public.work_order_execution_proofs p on p.id=e.execution_proof_id;

create or replace view public.v_quality_control_deficiency_directory
with (security_invoker=true) as
select d.*,r.work_order_id,wo.work_order_number,t.template_name,i.item_code,i.item_prompt,
       coalesce(rework.event_count,0)::int as rework_event_count,rework.latest_rework_at
from public.work_order_quality_control_deficiencies d
join public.work_order_quality_control_runs r on r.id=d.qc_run_id
join public.work_orders wo on wo.id=r.work_order_id
join public.quality_control_templates t on t.id=r.template_id
left join public.work_order_quality_control_items i on i.id=d.qc_item_id
left join lateral (
  select count(*)::int as event_count,max(recorded_at) as latest_rework_at
  from public.work_order_quality_control_rework_events x where x.deficiency_id=d.id
) rework on true;

revoke all on table public.v_quality_control_template_directory from public,anon,authenticated;
revoke all on table public.v_quality_control_run_directory from public,anon,authenticated;
revoke all on table public.v_quality_control_item_directory from public,anon,authenticated;
revoke all on table public.v_quality_control_evidence_directory from public,anon,authenticated;
revoke all on table public.v_quality_control_deficiency_directory from public,anon,authenticated;
grant select on table public.v_quality_control_template_directory to service_role;
grant select on table public.v_quality_control_run_directory to service_role;
grant select on table public.v_quality_control_item_directory to service_role;
grant select on table public.v_quality_control_evidence_directory to service_role;
grant select on table public.v_quality_control_deficiency_directory to service_role;

create or replace function public.ywi_rpc_quality_control_template_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.quality_control_templates
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_code text:=lower(regexp_replace(coalesce(nullif(btrim(p_payload->>'template_code'),''),nullif(btrim(p_payload->>'template_name'),''),'quality_template'),'[^a-zA-Z0-9]+','_','g'));
  v_name text:=nullif(btrim(p_payload->>'template_name'),'');
  v_row public.quality_control_templates;
  v_item jsonb;
  v_item_code text;
begin
  if v_name is null then raise exception 'Template name is required.' using errcode='23514'; end if;

  if v_id is null then
    insert into public.quality_control_templates(
      template_code,template_name,service_context,season_context,supervisor_qc_required,customer_signoff_mode,
      notes,is_active,created_by_profile_id,updated_by_profile_id
    ) values(
      v_code,v_name,lower(coalesce(nullif(p_payload->>'service_context',''),'general_outdoor')),
      lower(coalesce(nullif(p_payload->>'season_context',''),'four_season')),
      coalesce((p_payload->>'supervisor_qc_required')::boolean,true),
      lower(coalesce(nullif(p_payload->>'customer_signoff_mode',''),'recommended')),
      nullif(btrim(p_payload->>'notes'),''),coalesce((p_payload->>'is_active')::boolean,true),
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.quality_control_templates t set
      template_name=v_name,
      service_context=lower(coalesce(nullif(p_payload->>'service_context',''),t.service_context)),
      season_context=lower(coalesce(nullif(p_payload->>'season_context',''),t.season_context)),
      supervisor_qc_required=coalesce((p_payload->>'supervisor_qc_required')::boolean,t.supervisor_qc_required),
      customer_signoff_mode=lower(coalesce(nullif(p_payload->>'customer_signoff_mode',''),t.customer_signoff_mode)),
      notes=case when p_payload?'notes' then nullif(btrim(p_payload->>'notes'),'') else t.notes end,
      is_active=coalesce((p_payload->>'is_active')::boolean,t.is_active),
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where t.id=v_id returning t.* into v_row;
    if not found then raise exception 'Quality-control template was not found.' using errcode='23503'; end if;
  end if;

  if jsonb_typeof(p_payload->'items')='array' then
    delete from public.quality_control_template_items where template_id=v_row.id;
    for v_item in select value from jsonb_array_elements(p_payload->'items')
    loop
      v_item_code:=lower(regexp_replace(coalesce(nullif(btrim(v_item->>'item_code'),''),nullif(btrim(v_item->>'item_prompt'),''),'item'),'[^a-zA-Z0-9]+','_','g'));
      insert into public.quality_control_template_items(
        template_id,item_code,item_prompt,evidence_requirement,is_required,sort_order,is_active
      ) values(
        v_row.id,v_item_code,coalesce(nullif(btrim(v_item->>'item_prompt'),''),v_item_code),
        lower(coalesce(nullif(v_item->>'evidence_requirement',''),'none')),
        coalesce((v_item->>'is_required')::boolean,true),
        coalesce(nullif(v_item->>'sort_order','')::integer,100),true
      );
    end loop;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_quality_control_run_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.work_order_quality_control_runs
language plpgsql security invoker set search_path=public as $$
declare
  v_run_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_work_order_id uuid:=nullif(p_payload->>'work_order_id','')::uuid;
  v_template_id uuid:=nullif(p_payload->>'template_id','')::uuid;
  v_session_id uuid:=nullif(p_payload->>'job_session_id','')::uuid;
  v_summary text:=nullif(btrim(p_payload->>'crew_completion_summary'),'');
  v_customer_summary text:=nullif(btrim(p_payload->>'customer_safe_summary'),'');
  v_row public.work_order_quality_control_runs;
  v_result jsonb;
  v_item_code text;
  v_status text;
begin
  if v_work_order_id is null or v_template_id is null then raise exception 'Work order and QC template are required.' using errcode='23514'; end if;
  if not exists(select 1 from public.work_orders where id=v_work_order_id) then raise exception 'Work order was not found.' using errcode='23503'; end if;
  if not exists(select 1 from public.quality_control_templates where id=v_template_id and is_active) then raise exception 'Active QC template was not found.' using errcode='23503'; end if;
  if v_session_id is not null and not exists(select 1 from public.job_sessions where id=v_session_id and work_order_id=v_work_order_id) then
    raise exception 'Job session does not belong to this work order.' using errcode='23514';
  end if;

  if v_run_id is null then
    select id into v_run_id from public.work_order_quality_control_runs where work_order_id=v_work_order_id;
  end if;

  if v_run_id is null then
    insert into public.work_order_quality_control_runs(
      work_order_id,template_id,job_session_id,run_status,crew_completion_summary,customer_safe_summary,
      crew_completed_by_profile_id,crew_completed_at,review_status,created_by_profile_id,updated_by_profile_id
    ) values(
      v_work_order_id,v_template_id,v_session_id,'crew_complete',v_summary,v_customer_summary,
      p_actor_profile_id,now(),
      case when (select supervisor_qc_required from public.quality_control_templates where id=v_template_id) then 'pending' else 'not_required' end,
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;

    insert into public.work_order_quality_control_items(
      qc_run_id,template_item_id,item_code,item_prompt,evidence_requirement,is_required,sort_order
    )
    select v_row.id,i.id,i.item_code,i.item_prompt,i.evidence_requirement,i.is_required,i.sort_order
    from public.quality_control_template_items i
    where i.template_id=v_template_id and i.is_active
    order by i.sort_order,i.item_code;
  else
    update public.work_order_quality_control_runs r set
      template_id=v_template_id,job_session_id=v_session_id,
      crew_completion_summary=coalesce(v_summary,r.crew_completion_summary),
      customer_safe_summary=coalesce(v_customer_summary,r.customer_safe_summary),
      crew_completed_by_profile_id=p_actor_profile_id,crew_completed_at=now(),
      run_status=case when r.run_status='approved' then 'crew_complete' else r.run_status end,
      review_status=case
        when r.run_status='approved' then case when (select supervisor_qc_required from public.quality_control_templates where id=v_template_id) then 'pending' else 'not_required' end
        else r.review_status end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where r.id=v_run_id and r.work_order_id=v_work_order_id
    returning r.* into v_row;
    if not found then raise exception 'QC run was not found for this work order.' using errcode='23503'; end if;
  end if;

  if jsonb_typeof(p_payload->'item_results')='array' then
    for v_result in select value from jsonb_array_elements(p_payload->'item_results')
    loop
      v_item_code:=lower(coalesce(nullif(btrim(v_result->>'item_code'),''),''));
      v_status:=lower(coalesce(nullif(v_result->>'result_status',''),'pending'));
      if v_status not in ('pending','pass','fail','not_applicable') then raise exception 'Unsupported QC item result.' using errcode='23514'; end if;
      update public.work_order_quality_control_items i set
        result_status=v_status,
        completion_note=nullif(btrim(v_result->>'completion_note'),''),
        completed_by_profile_id=case when v_status='pending' then null else p_actor_profile_id end,
        completed_at=case when v_status='pending' then null else now() end,
        updated_at=now()
      where i.qc_run_id=v_row.id and i.item_code=v_item_code;
    end loop;
  end if;

  update public.work_order_quality_control_runs r set
    run_status=case
      when exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=r.id and i.result_status='fail') then 'rework_required'
      when exists(select 1 from public.work_order_quality_control_deficiencies d where d.qc_run_id=r.id and d.deficiency_status not in ('resolved','accepted_exception')) then 'rework_required'
      when (select supervisor_qc_required from public.quality_control_templates t where t.id=r.template_id) then 'awaiting_supervisor_qc'
      else 'crew_complete'
    end,
    updated_at=now()
  where r.id=v_row.id returning r.* into v_row;

  return v_row;
end;
$$;

create or replace function public.ywi_rpc_quality_control_evidence_link(p_payload jsonb,p_actor_profile_id uuid)
returns public.work_order_quality_control_evidence_links
language plpgsql security invoker set search_path=public as $$
declare
  v_run_id uuid:=nullif(p_payload->>'qc_run_id','')::uuid;
  v_item_id uuid:=nullif(p_payload->>'qc_item_id','')::uuid;
  v_proof_id uuid:=nullif(p_payload->>'execution_proof_id','')::uuid;
  v_role text:=lower(coalesce(nullif(p_payload->>'evidence_role',''),'after'));
  v_customer_safe boolean:=coalesce((p_payload->>'customer_safe')::boolean,false);
  v_run public.work_order_quality_control_runs;
  v_proof public.work_order_execution_proofs;
  v_row public.work_order_quality_control_evidence_links;
begin
  if v_run_id is null or v_proof_id is null then raise exception 'QC run and execution proof are required.' using errcode='23514'; end if;
  select * into v_run from public.work_order_quality_control_runs where id=v_run_id;
  if not found then raise exception 'QC run was not found.' using errcode='23503'; end if;
  select * into v_proof from public.work_order_execution_proofs where id=v_proof_id;
  if not found or v_proof.work_order_id<>v_run.work_order_id then raise exception 'Execution proof does not belong to this QC work order.' using errcode='23514'; end if;
  if v_item_id is not null and not exists(select 1 from public.work_order_quality_control_items where id=v_item_id and qc_run_id=v_run_id) then
    raise exception 'QC item does not belong to this run.' using errcode='23514';
  end if;
  if v_customer_safe and (v_proof.proof_status<>'approved' or not v_proof.customer_visible) then
    raise exception 'Customer-safe QC evidence must reference an approved customer-visible execution proof.' using errcode='23514';
  end if;

  insert into public.work_order_quality_control_evidence_links(
    qc_run_id,qc_item_id,execution_proof_id,evidence_role,customer_safe,caption,linked_by_profile_id
  ) values(
    v_run_id,v_item_id,v_proof_id,v_role,v_customer_safe,nullif(btrim(p_payload->>'caption'),''),p_actor_profile_id
  )
  on conflict(qc_run_id,execution_proof_id,evidence_role) do update set
    qc_item_id=excluded.qc_item_id,customer_safe=excluded.customer_safe,caption=excluded.caption,
    linked_by_profile_id=excluded.linked_by_profile_id,linked_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_quality_control_deficiency_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.work_order_quality_control_deficiencies
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_run_id uuid:=nullif(p_payload->>'qc_run_id','')::uuid;
  v_item_id uuid:=nullif(p_payload->>'qc_item_id','')::uuid;
  v_summary text:=nullif(btrim(p_payload->>'deficiency_summary'),'');
  v_severity text:=lower(coalesce(nullif(p_payload->>'severity',''),'minor'));
  v_row public.work_order_quality_control_deficiencies;
begin
  if v_run_id is null or v_summary is null then raise exception 'QC run and deficiency summary are required.' using errcode='23514'; end if;
  if not exists(select 1 from public.work_order_quality_control_runs where id=v_run_id) then raise exception 'QC run was not found.' using errcode='23503'; end if;
  if v_item_id is not null and not exists(select 1 from public.work_order_quality_control_items where id=v_item_id and qc_run_id=v_run_id) then
    raise exception 'QC item does not belong to this run.' using errcode='23514';
  end if;
  if v_id is null then
    insert into public.work_order_quality_control_deficiencies(
      qc_run_id,qc_item_id,deficiency_summary,severity,deficiency_status,customer_safe_note,opened_by_profile_id
    ) values(
      v_run_id,v_item_id,v_summary,v_severity,
      case when v_severity in ('major','critical') then 'rework_required' else 'open' end,
      nullif(btrim(p_payload->>'customer_safe_note'),''),p_actor_profile_id
    ) returning * into v_row;
  else
    update public.work_order_quality_control_deficiencies d set
      deficiency_summary=v_summary,severity=v_severity,
      customer_safe_note=case when p_payload?'customer_safe_note' then nullif(btrim(p_payload->>'customer_safe_note'),'') else d.customer_safe_note end,
      updated_at=now()
    where d.id=v_id and d.qc_run_id=v_run_id returning d.* into v_row;
    if not found then raise exception 'QC deficiency was not found.' using errcode='23503'; end if;
  end if;
  update public.work_order_quality_control_runs set run_status='rework_required',review_status='rework_required',updated_at=now()
  where id=v_run_id;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_quality_control_rework_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.work_order_quality_control_deficiencies
language plpgsql security invoker set search_path=public as $$
declare
  v_deficiency_id uuid:=nullif(p_payload->>'deficiency_id','')::uuid;
  v_event_type text:=lower(coalesce(nullif(p_payload->>'event_type',''),'progress'));
  v_note text:=nullif(btrim(p_payload->>'event_note'),'');
  v_proof_id uuid:=nullif(p_payload->>'resolution_execution_proof_id','')::uuid;
  v_row public.work_order_quality_control_deficiencies;
  v_run_id uuid;
  v_work_order_id uuid;
begin
  if v_deficiency_id is null or v_note is null then raise exception 'Deficiency and rework note are required.' using errcode='23514'; end if;
  select d.qc_run_id,r.work_order_id into v_run_id,v_work_order_id
  from public.work_order_quality_control_deficiencies d
  join public.work_order_quality_control_runs r on r.id=d.qc_run_id
  where d.id=v_deficiency_id;
  if not found then raise exception 'QC deficiency was not found.' using errcode='23503'; end if;
  if v_proof_id is not null and not exists(select 1 from public.work_order_execution_proofs where id=v_proof_id and work_order_id=v_work_order_id) then
    raise exception 'Resolution execution proof does not belong to this work order.' using errcode='23514';
  end if;

  insert into public.work_order_quality_control_rework_events(
    deficiency_id,event_type,event_note,resolution_execution_proof_id,recorded_by_profile_id
  ) values(v_deficiency_id,v_event_type,v_note,v_proof_id,p_actor_profile_id);

  update public.work_order_quality_control_deficiencies d set
    deficiency_status=case v_event_type when 'started' then 'rework_in_progress' when 'completed' then 'resolved' else d.deficiency_status end,
    resolved_by_profile_id=case when v_event_type='completed' then p_actor_profile_id else d.resolved_by_profile_id end,
    resolved_at=case when v_event_type='completed' then now() else d.resolved_at end,
    resolution_note=case when v_event_type='completed' then v_note else d.resolution_note end,
    updated_at=now()
  where d.id=v_deficiency_id returning d.* into v_row;

  update public.work_order_quality_control_runs r set
    run_status=case
      when exists(select 1 from public.work_order_quality_control_deficiencies d where d.qc_run_id=r.id and d.deficiency_status not in ('resolved','accepted_exception')) then 'rework_required'
      when exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=r.id and i.result_status='fail') then 'rework_required'
      when (select supervisor_qc_required from public.quality_control_templates t where t.id=r.template_id) then 'awaiting_supervisor_qc'
      else 'crew_complete'
    end,
    review_status=case
      when exists(select 1 from public.work_order_quality_control_deficiencies d where d.qc_run_id=r.id and d.deficiency_status not in ('resolved','accepted_exception')) then 'rework_required'
      when (select supervisor_qc_required from public.quality_control_templates t where t.id=r.template_id) then 'pending'
      else 'not_required'
    end,
    updated_at=now()
  where r.id=v_run_id;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_quality_control_review(p_payload jsonb,p_actor_profile_id uuid)
returns public.work_order_quality_control_runs
language plpgsql security invoker set search_path=public as $$
declare
  v_run_id uuid:=nullif(p_payload->>'qc_run_id','')::uuid;
  v_decision text:=lower(coalesce(nullif(p_payload->>'decision',''),''));
  v_note text:=nullif(btrim(p_payload->>'supervisor_review_note'),'');
  v_run public.work_order_quality_control_runs;
begin
  if v_run_id is null or v_decision not in ('approve','require_rework') then raise exception 'QC run and review decision are required.' using errcode='23514'; end if;
  select * into v_run from public.work_order_quality_control_runs where id=v_run_id for update;
  if not found then raise exception 'QC run was not found.' using errcode='23503'; end if;

  if v_decision='approve' then
    if nullif(btrim(coalesce(v_run.customer_safe_summary,'')),'') is null then raise exception 'Customer-safe completion summary is required before QC approval.' using errcode='23514'; end if;
    if exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=v_run_id and ((i.is_required and i.result_status<>'pass') or i.result_status='fail')) then
      raise exception 'Required QC items must pass before supervisor approval.' using errcode='23514';
    end if;
    if exists(select 1 from public.work_order_quality_control_deficiencies d where d.qc_run_id=v_run_id and d.deficiency_status not in ('resolved','accepted_exception')) then
      raise exception 'Unresolved QC deficiencies must be closed before supervisor approval.' using errcode='23514';
    end if;
    if exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=v_run_id and i.evidence_requirement in ('before','before_after'))
       and not exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=v_run_id and e.evidence_role='before') then
      raise exception 'Required before evidence is missing.' using errcode='23514';
    end if;
    if exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=v_run_id and i.evidence_requirement in ('after','before_after'))
       and not exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=v_run_id and e.evidence_role in ('after','final')) then
      raise exception 'Required after evidence is missing.' using errcode='23514';
    end if;
    if exists(select 1 from public.work_order_quality_control_items i where i.qc_run_id=v_run_id and i.evidence_requirement='detail')
       and not exists(select 1 from public.work_order_quality_control_evidence_links e where e.qc_run_id=v_run_id and e.evidence_role in ('detail','final')) then
      raise exception 'Required detail evidence is missing.' using errcode='23514';
    end if;
  end if;

  update public.work_order_quality_control_runs r set
    run_status=case when v_decision='approve' then 'approved' else 'rework_required' end,
    review_status=case when v_decision='approve' then 'approved' else 'rework_required' end,
    supervisor_review_note=v_note,reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now(),
    updated_by_profile_id=p_actor_profile_id,updated_at=now()
  where r.id=v_run_id returning r.* into v_run;
  return v_run;
end;
$$;

revoke all on function public.ywi_rpc_quality_control_template_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_quality_control_run_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_quality_control_evidence_link(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_quality_control_deficiency_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_quality_control_rework_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_quality_control_review(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_quality_control_template_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_quality_control_run_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_quality_control_evidence_link(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_quality_control_deficiency_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_quality_control_rework_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_quality_control_review(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('quality_control_template_save','jobs','approve','write','quality_control','jobs.quality_control.template_saved',false,true,'Supervisor/admin maintains four-season service-type QC templates.'),
  ('quality_control_run_save','jobs','create','write','quality_control','jobs.quality_control.run_saved',false,true,'Crew records completion checklist results and customer-safe summary without customer signoff.'),
  ('quality_control_evidence_link','jobs','create','write','quality_control','jobs.quality_control.evidence_linked',false,true,'Links canonical work-order execution proof as QC before/after/detail evidence.'),
  ('quality_control_deficiency_save','jobs','create','write','quality_control','jobs.quality_control.deficiency_saved',false,true,'Records a QC deficiency and forces rework-required state.'),
  ('quality_control_rework_save','jobs','create','write','quality_control','jobs.quality_control.rework_saved',false,true,'Records rework progress/completion against a QC deficiency.'),
  ('quality_control_review','jobs','approve','write','quality_control','jobs.quality_control.reviewed',true,true,'Supervisor approves QC or requires rework; customer signoff remains the existing portal authority.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=84 then 'passed' else 'failed' end,
    'Exactly 84 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'weather_workability_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'workability_rule_save','workability_observation_save','workability_decision_save','workability_notification_readiness_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 342 weather/workability writes remain explicit Jobs-approve contracts.'
  union all
  select 'landscape_material_estimator_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'landscape_material_estimate_save','landscape_material_actual_use_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=2 then 'passed' else 'failed' end,
    'Build 343 material-estimator writes remain explicit Jobs-approve contracts.'
  union all
  select 'change_orders_extras_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'change_order_discovery_save','change_order_evidence_save','change_order_review_price',
      'change_order_customer_authorization','change_order_apply','change_order_invoice_evidence_save'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 344 change-order actions remain explicit Jobs contracts.'
  union all
  select 'quality_control_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'quality_control_template_save','quality_control_run_save','quality_control_evidence_link',
      'quality_control_deficiency_save','quality_control_rework_save','quality_control_review'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 345 QC template/completion/evidence/deficiency/rework/review actions are explicit Jobs contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_quality_control_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_signoff_authority_preserved',
    case when to_regclass('public.work_order_closeout_packages') is not null
      and to_regclass('public.work_order_customer_closeout_signoffs') is not null
      and to_regprocedure('public.ywi_rpc_customer_sign_work_order_closeout(uuid,uuid,text,text,boolean,text,text,text)') is not null
    then 'passed' else 'failed' end,
    'Existing supervisor closeout and customer-portal signoff remain canonical.'
  union all
  select 'staff_cannot_impersonate_customer',
    case when position('work_order_customer_closeout_signoffs' in lower(pg_get_functiondef('public.ywi_rpc_quality_control_review(jsonb,uuid)'::regprocedure)))=0
      and position('signed_off_by_name' in lower(pg_get_functiondef('public.ywi_rpc_quality_control_review(jsonb,uuid)'::regprocedure)))=0
    then 'passed' else 'failed' end,
    'QC supervisor review cannot create customer signoff rows or customer signer identity.'
  union all
  select 'canonical_execution_proof_reused',
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='work_order_quality_control_evidence_links' and column_name='execution_proof_id')
      and to_regclass('public.work_order_execution_proofs') is not null
    then 'passed' else 'failed' end,
    'Build 345 links existing execution proof instead of creating parallel photo/evidence storage.'
  union all
  select 'unresolved_deficiency_blocks_approval',
    case when position('unresolved qc deficiencies must be closed' in lower(pg_get_functiondef('public.ywi_rpc_quality_control_review(jsonb,uuid)'::regprocedure)))>0
    then 'passed' else 'failed' end,
    'Supervisor approval fails while unresolved deficiencies remain.'
  union all
  select 'qc_started_blocks_closeout_until_ready',
    case when exists(select 1 from pg_trigger where tgname='trg_work_order_closeout_quality_control_guard' and not tgisinternal)
    then 'passed' else 'failed' end,
    'Once QC starts for a work order, canonical closeout is guarded until QC is ready.'
  union all
  select 'four_season_templates_present',
    case when (select count(*) from public.quality_control_templates where template_code in (
      'mowing_landscaping_completion','landscape_installation_completion','fall_cleanup_completion','winter_snow_ice_completion'
    ) and is_active)=4 then 'passed' else 'failed' end,
    'Seed templates cover mowing/landscaping, installation, fall cleanup and winter snow/ice.'
  union all
  select 'quality_control_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in (
        'quality_control_templates','quality_control_template_items','work_order_quality_control_runs',
        'work_order_quality_control_items','work_order_quality_control_evidence_links',
        'work_order_quality_control_deficiencies','work_order_quality_control_rework_events'
      ) and grantee in ('anon','authenticated','PUBLIC'))
    then 'passed' else 'failed' end,
    'QC templates, evidence links, deficiencies and rework history remain service-role private.';
$$;
revoke all on function public.ywi_quality_control_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_quality_control_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  233,'quality_control_customer_signoff',
  'Build 345 adds four-season QC templates, crew completion, evidence links, deficiency/rework tracking, supervisor review and closeout gating while preserving canonical customer-portal signoff.',
  'applied',now(),'schema233',
  'QC is a pre-closeout quality layer. Existing execution proof, work-order closeout package and customer portal signoff remain authoritative; staff cannot impersonate customer signoff.',
  '233_quality_control_customer_signoff.sql','schema233'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 233 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=233 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>233 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=233 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>233 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
