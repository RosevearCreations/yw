begin;
-- Public-web canonical authority and duplicate-index protection release contract.
insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('public_web_authority_duplicate_index','Web / Help','Canonical public-web authority and duplicate-index protection','error','Keep yardweasels.ca as the configured application canonical authority; keep Help, portals, previews and noncanonical hosts noindex; require canonical-only static output, one rendered H1, and phone/desktop canonical plus preview acceptance.','Online Help + public website source/browser gates',46,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata)
values('schema194_public_web_authority','admin','Public-web authority and duplicate-index protection','active',80,8,10,'Verify centralized canonical authority, canonical-only generator output, preview noindex behavior, one-H1 phone/desktop acceptance, live schema convergence, dev/main parity, release evidence and cleanup. Do not close business acceptance rails.','Admin / I.T. / Web',114,jsonb_build_object('schema',194,'business_rail_auto_close',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false,'canonical_origin','https://yardweasels.ca','established_business_origin','https://ywiinc.com'))
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema)
values('schema194_public_web_authority','build_acceptance',false,false,false,'Close this technical release rail only after canonical authority/source gates, rendered canonical and preview phone/desktop acceptance, live schema convergence, dev/main parity, release evidence and cleanup. No business acceptance auto-close is authorized.',194)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace function public.ywi_public_web_authority_release_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql security definer set search_path=public,pg_temp as $$
 select 'prior_help_seo_authority_green',case when not exists(select 1 from public.ywi_help_seo_release_assertions() where assertion_status<>'passed') then 'passed' else 'failed' end,'Prior Help/search/H1 release assertions remain green.'
 union all select 'business_acceptance_rails_untouched',case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,'All existing human/provider/accounting/content acceptance rails remain open.'
 union all select 'finance_execution_provider_off',case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled=true or provider_mutation_enabled=true) then 'passed' else 'failed' end,'Finance posting execution and provider mutation remain OFF.'
 union all select 'public_web_authority_rail_present',case when exists(select 1 from public.admin_scorecard_progress_rails where rail_key='schema194_public_web_authority' and rail_status in ('active','complete')) then 'passed' else 'failed' end,'The public-web authority rail remains present during release and after evidence-backed closure.';
$$;
revoke all on function public.ywi_public_web_authority_release_assertions() from public,anon,authenticated;
grant execute on function public.ywi_public_web_authority_release_assertions() to service_role;

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 194::int as expected_schema_version,
       coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=194 then 'current' else 'behind' end::text as drift_status,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=194 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through the current schema in order.' end::text as message,
       now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(194,'194_public_web_authority','194_public_web_authority.sql','2026-09-03h','Records canonical public-web authority and duplicate-index protection release authority.','applied','No business data mutation. Finance/provider execution remains OFF; business acceptance remains evidence-gated; Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();
commit;
