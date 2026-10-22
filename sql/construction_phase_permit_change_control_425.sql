-- Item 425. Original Jobs work orders, Safety plans, Finance release decisions and
-- approved canonical change-order budget applications remain authoritative.
-- These owner-reported phases and permit references neither certify permits
-- nor approve a change, release work or post costs/invoices.

create table if not exists public.ywi_construction_phases_425 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 phase_code text not null check(phase_code ~ '^[a-z0-9_]{2,40}$'),
 phase_label text not null check(length(btrim(phase_label)) between 3 and 120),
 sequence_number int not null check(sequence_number between 1 and 1000),
 scope_notes text not null check(length(btrim(scope_notes)) between 20 and 1000),
 source_work_order_line_id uuid references public.work_order_lines(id) on delete restrict,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(work_order_id,phase_code)
);
create index if not exists ywi_425_phases_company_order_idx
 on public.ywi_construction_phases_425(company_id,work_order_id,sequence_number);

create table if not exists public.ywi_construction_permit_notes_425 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 phase_id uuid not null references public.ywi_construction_phases_425(id) on delete restrict,
 permit_kind text not null check(permit_kind in
  ('building','electrical','plumbing','grading','road_occupancy','environmental','other')),
 permit_reference text not null check(length(btrim(permit_reference)) between 3 and 120),
 reported_status text not null check(reported_status in ('unknown','submitted','reported_issued')),
 source_document_reference text not null check(length(btrim(source_document_reference)) between 8 and 400),
 field_notes text not null check(length(btrim(field_notes)) between 20 and 1000),
 observed_on date not null,
 original_safety_plan_id uuid references public.job_hazard_site_safety_plans(id) on delete restrict,
 original_change_order_id uuid references public.change_orders(id) on delete restrict,
 original_source_fingerprint text not null check(length(original_source_fingerprint)=64),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(phase_id,permit_kind,permit_reference)
);
create index if not exists ywi_425_permit_company_order_idx
 on public.ywi_construction_permit_notes_425(company_id,work_order_id,recorded_at desc);

alter table public.ywi_construction_phases_425 enable row level security;
alter table public.ywi_construction_permit_notes_425 enable row level security;
revoke all on public.ywi_construction_phases_425 from public,anon,authenticated;
revoke all on public.ywi_construction_permit_notes_425 from public,anon,authenticated;
grant select on public.ywi_construction_phases_425 to authenticated;
grant select on public.ywi_construction_permit_notes_425 to authenticated;
drop policy if exists ywi_425_owner_phase_select on public.ywi_construction_phases_425;
create policy ywi_425_owner_phase_select on public.ywi_construction_phases_425
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_425_owner_permit_select on public.ywi_construction_permit_notes_425;
create policy ywi_425_owner_permit_select on public.ywi_construction_permit_notes_425
 for select to authenticated using(exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_425_reject_evidence_edit()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception '425 construction evidence is append-only; verify original Jobs/Safety/Finance sources'; end $$;
revoke all on function public.ywi_425_reject_evidence_edit() from public,anon,authenticated;
drop trigger if exists ywi_425_phase_no_rewrite on public.ywi_construction_phases_425;
create trigger ywi_425_phase_no_rewrite before update or delete on public.ywi_construction_phases_425
 for each row execute function public.ywi_425_reject_evidence_edit();
drop trigger if exists ywi_425_permit_no_rewrite on public.ywi_construction_permit_notes_425;
create trigger ywi_425_permit_no_rewrite before update or delete on public.ywi_construction_permit_notes_425
 for each row execute function public.ywi_425_reject_evidence_edit();

create or replace function public.ywi_425_assert_construction_order(
 p_company_id uuid,p_work_order_id uuid,p_write boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write);
 if not exists(select 1 from public.work_orders wo where wo.id=p_work_order_id
  and wo.company_id=p_company_id and wo.service_module_key='construction') then
  raise exception '425 original company construction work order required';
 end if;
end $$;
revoke all on function public.ywi_425_assert_construction_order(uuid,uuid,boolean) from public,anon,authenticated;

-- Snapshot only the relevant original authority: site/approval, Finance release,
-- linked Safety review, change authorization and the original budget application.
-- A changed source generates HOLD; a newly approved source is NOT auto-promoted.
create or replace function public.ywi_425_original_fingerprint(
 p_phase_id uuid,p_safety_id uuid,p_change_id uuid
) returns text language plpgsql stable security definer set search_path='' as $$
declare v_payload jsonb;
begin
 select jsonb_build_object(
  'phase',to_jsonb(ph),'work_order',jsonb_build_object(
   'id',wo.id,'company',wo.company_id,'service',wo.service_module_key,
   'customer',wo.client_id,'property',wo.client_site_id,'status',wo.status,
   'approval',wo.approval_status,'approval_required',wo.approval_required),
  'release',(select to_jsonb(rr) from public.work_order_release_reviews rr where rr.work_order_id=wo.id),
  'safety',(select to_jsonb(sp) from public.job_hazard_site_safety_plans sp where sp.id=p_safety_id),
  'change',(select to_jsonb(ch) from public.change_orders ch where ch.id=p_change_id),
  'budget',(select to_jsonb(ba) from public.change_order_budget_applications ba where ba.change_order_id=p_change_id))
 into v_payload from public.ywi_construction_phases_425 ph
 join public.work_orders wo on wo.id=ph.work_order_id where ph.id=p_phase_id;
 if v_payload is null then raise exception '425 original construction phase missing'; end if;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_425_original_fingerprint(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.ywi_rpc_create_construction_phase_425(
 p_company_id uuid,p_work_order_id uuid,p_phase_code text,p_phase_label text,
 p_sequence_number integer,p_scope_notes text,p_work_order_line_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.ywi_construction_phases_425;v_id uuid;
 v_code text:=lower(btrim(coalesce(p_phase_code,'')));
 v_label text:=btrim(coalesce(p_phase_label,''));v_notes text:=btrim(coalesce(p_scope_notes,''));
begin
 perform public.ywi_425_assert_construction_order(p_company_id,p_work_order_id,true);
 if v_code !~ '^[a-z0-9_]{2,40}$' or length(v_label) not between 3 and 120 or
  length(v_notes) not between 20 and 1000 or p_sequence_number not between 1 and 1000 then
  raise exception '425 phase code, name, sequence and factual scope are required'; end if;
 if p_work_order_line_id is not null and not exists(select 1 from public.work_order_lines
  where id=p_work_order_line_id and work_order_id=p_work_order_id) then
  raise exception '425 original Jobs plan line belongs to another work order'; end if;
 select * into v_old from public.ywi_construction_phases_425
  where work_order_id=p_work_order_id and phase_code=v_code;
 if found then
  if v_old.company_id=p_company_id and v_old.phase_label=v_label and
   v_old.sequence_number=p_sequence_number and v_old.scope_notes=v_notes and
   v_old.source_work_order_line_id is not distinct from p_work_order_line_id then
   return v_old.id; end if;
  raise exception '425 phase key already exists with different scope; manual review required';
 end if;
 insert into public.ywi_construction_phases_425(company_id,work_order_id,phase_code,
  phase_label,sequence_number,scope_notes,source_work_order_line_id,recorded_by)
 values(p_company_id,p_work_order_id,v_code,v_label,p_sequence_number,v_notes,
  p_work_order_line_id,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_create_construction_phase_425(uuid,uuid,text,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_create_construction_phase_425(uuid,uuid,text,text,integer,text,uuid) to authenticated;

create or replace function public.ywi_rpc_record_construction_permit_425(
 p_company_id uuid,p_work_order_id uuid,p_phase_id uuid,p_kind text,
 p_reference text,p_reported_status text,p_document_reference text,p_field_notes text,
 p_observed_on date,p_safety_plan_id uuid default null,p_change_order_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.ywi_construction_permit_notes_425;v_id uuid;v_hash text;
 v_ref text:=btrim(coalesce(p_reference,''));v_doc text:=btrim(coalesce(p_document_reference,''));
 v_notes text:=btrim(coalesce(p_field_notes,''));
begin
 perform public.ywi_425_assert_construction_order(p_company_id,p_work_order_id,true);
 if not exists(select 1 from public.ywi_construction_phases_425 ph
  where ph.id=p_phase_id and ph.company_id=p_company_id and ph.work_order_id=p_work_order_id) then
  raise exception '425 construction phase missing or foreign'; end if;
 if p_kind not in ('building','electrical','plumbing','grading','road_occupancy','environmental','other') or
  p_reported_status not in ('unknown','submitted','reported_issued') or
  length(v_ref) not between 3 and 120 or length(v_doc) not between 8 and 400 or
  length(v_notes) not between 20 and 1000 or p_observed_on is null or
  p_observed_on>current_date or p_observed_on<date '2000-01-01' then
  raise exception '425 dated operator-reported permit reference and source are required'; end if;
 if p_safety_plan_id is not null and not exists(select 1 from public.job_hazard_site_safety_plans sp
  join public.work_orders wo on wo.id=p_work_order_id
  where sp.id=p_safety_plan_id and sp.work_order_id=p_work_order_id
   and sp.client_site_id=wo.client_site_id) then
  raise exception '425 original Safety plan missing or property mismatch'; end if;
 if p_change_order_id is not null and not exists(select 1 from public.change_orders ch
  where ch.id=p_change_order_id and ch.work_order_id=p_work_order_id) then
  raise exception '425 original change order missing or foreign'; end if;
 v_hash:=public.ywi_425_original_fingerprint(p_phase_id,p_safety_plan_id,p_change_order_id);
 select * into v_old from public.ywi_construction_permit_notes_425
  where phase_id=p_phase_id and permit_kind=p_kind and permit_reference=v_ref;
 if found then
  if v_old.company_id=p_company_id and v_old.work_order_id=p_work_order_id and
   v_old.reported_status=p_reported_status and v_old.source_document_reference=v_doc and
   v_old.field_notes=v_notes and v_old.observed_on=p_observed_on and
   v_old.original_safety_plan_id is not distinct from p_safety_plan_id and
   v_old.original_change_order_id is not distinct from p_change_order_id and
   v_old.original_source_fingerprint=v_hash then return v_old.id; end if;
  raise exception '425 permit reference already recorded or original source changed: manual review';
 end if;
 insert into public.ywi_construction_permit_notes_425(company_id,work_order_id,phase_id,
  permit_kind,permit_reference,reported_status,source_document_reference,field_notes,
  observed_on,original_safety_plan_id,original_change_order_id,original_source_fingerprint,recorded_by)
 values(p_company_id,p_work_order_id,p_phase_id,p_kind,v_ref,p_reported_status,v_doc,
  v_notes,p_observed_on,p_safety_plan_id,p_change_order_id,v_hash,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_construction_permit_425(uuid,uuid,uuid,text,text,text,text,text,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_construction_permit_425(uuid,uuid,uuid,text,text,text,text,text,date,uuid,uuid) to authenticated;

create or replace function public.ywi_rpc_construction_dashboard_425(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb;v_phases jsonb:='[]'::jsonb;v_permits jsonb:='[]'::jsonb;
 v_safety jsonb:='[]'::jsonb;v_changes jsonb:='[]'::jsonb;v_lines jsonb:='[]'::jsonb;
 v_release jsonb;v_count int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key='construction';
 if v_count>60 then raise exception '425 company construction order listing capped'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,status from public.work_orders
  where company_id=p_company_id and service_module_key='construction'
  order by created_at desc,id limit 60) x;
 if p_work_order_id is null then return jsonb_build_object('company_id',p_company_id,
  'work_order_id',null,'orders',v_orders,'phases',v_phases,'permits',v_permits,
  'safety',v_safety,'changes',v_changes,'lines',v_lines,'release',null,
  'source_limit',80,'complete',true,'no_auto_approval',true,'state','choose_order'); end if;
 perform public.ywi_425_assert_construction_order(p_company_id,p_work_order_id,false);
 select (select count(*) from public.ywi_construction_phases_425 where work_order_id=p_work_order_id)
  +(select count(*) from public.ywi_construction_permit_notes_425 where work_order_id=p_work_order_id)
  +(select count(*) from public.change_orders where work_order_id=p_work_order_id)
  +(select count(*) from public.job_hazard_site_safety_plans where work_order_id=p_work_order_id)
  +(select count(*) from public.work_order_lines where work_order_id=p_work_order_id)
 into v_count;
 if v_count>80 then raise exception '425 canonical construction source cap reached'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_phases from (
  select id,phase_code,phase_label,sequence_number,scope_notes,source_work_order_line_id,
   recorded_at from public.ywi_construction_phases_425 where company_id=p_company_id
   and work_order_id=p_work_order_id order by sequence_number,id) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_lines from (
  select id,description from public.work_order_lines where work_order_id=p_work_order_id
  order by line_order,id) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_safety from (
  select sp.id,sp.plan_number,sp.plan_status,sp.supervisor_review_status,
   sp.stop_work_required,sp.utility_locate_confirmed
  from public.job_hazard_site_safety_plans sp join public.work_orders wo
   on wo.id=sp.work_order_id where sp.work_order_id=p_work_order_id
   and sp.client_site_id=wo.client_site_id order by sp.field_date desc,sp.id) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_changes from (
  select ch.id,ch.change_order_number,ch.status,ch.review_status,
   ch.customer_authorization_status,ch.scope_application_status,
   (ba.id is not null) as budget_applied
  from public.change_orders ch left join public.change_order_budget_applications ba
   on ba.change_order_id=ch.id and ba.work_order_id=p_work_order_id
  where ch.work_order_id=p_work_order_id order by ch.requested_at desc,ch.id) x;
 select jsonb_build_object('release_status',r.release_status,'threshold_status',r.threshold_status,
  'signoff_present',r.signoff_profile_id is not null and r.signoff_at is not null)
 into v_release from public.work_order_release_reviews r where r.work_order_id=p_work_order_id;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_permits from (
  select p.id,p.phase_id,p.permit_kind,p.permit_reference,p.reported_status,
   p.source_document_reference,p.field_notes,p.observed_on,p.recorded_at,
   p.original_safety_plan_id,p.original_change_order_id,
   case when p.original_source_fingerprint is distinct from public.ywi_425_original_fingerprint(
    p.phase_id,p.original_safety_plan_id,p.original_change_order_id)
    then 'source_changed_hold' else 'recorded_unverified' end as evidence_state,
   case when (wo.approval_required and wo.approval_status not in ('approved','released','completed')) or
    rr.id is null or rr.release_status not in ('approved','released') or
    rr.threshold_status<>'pass' or rr.signoff_profile_id is null or rr.signoff_at is null or
    exists(select 1 from public.change_orders ch where ch.work_order_id=p_work_order_id and
     (ch.status not in ('approved','completed') or
      ch.review_status<>'approved_for_pricing' or
      ch.customer_authorization_status<>'authorized' or
      ch.scope_application_status<>'applied' or not exists(
       select 1 from public.change_order_budget_applications ba
       where ba.change_order_id=ch.id and ba.work_order_id=p_work_order_id)))
    then 'hold' else 'source_verified_only' end as financial_gate,
   case when sp.id is null or sp.stop_work_required or
    sp.supervisor_review_status<>'approved' then 'hold' else 'source_reviewed_only' end as safety_gate
  from public.ywi_construction_permit_notes_425 p
  join public.work_orders wo on wo.id=p.work_order_id and wo.company_id=p.company_id
  left join public.work_order_release_reviews rr on rr.work_order_id=p_work_order_id
  left join public.job_hazard_site_safety_plans sp on sp.id=p.original_safety_plan_id
  where p.company_id=p_company_id and p.work_order_id=p_work_order_id
  order by p.recorded_at desc,p.id) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'phases',v_phases,'permits',v_permits,'safety',v_safety,
  'changes',v_changes,'lines',v_lines,'release',v_release,
  'source_limit',80,'complete',true,'no_auto_approval',true,'state','review_only');
end $$;
revoke all on function public.ywi_rpc_construction_dashboard_425(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_construction_dashboard_425(uuid,uuid) to authenticated;
