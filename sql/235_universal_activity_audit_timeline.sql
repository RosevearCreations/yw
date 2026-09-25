-- Schema 235 — Build 347 Universal Activity & Audit Timeline
-- Read-only normalization over the protected operation audit authority.
-- No customer, job, employee, equipment, safety or finance record is duplicated here.

begin;

drop view if exists public.v_universal_activity_audit_timeline;
create view public.v_universal_activity_audit_timeline
with (security_invoker=true)
as
with base as (
  select
    e.id,
    e.event_key,
    e.operation_action,
    e.operation_status,
    e.entity_type,
    e.entity_id,
    e.actor_profile_id,
    e.error_message,
    e.created_at,
    e.boundary_owner_module,
    e.boundary_event_key,
    lower(concat_ws(' ', coalesce(e.entity_type,''), coalesce(e.operation_action,''), coalesce(e.boundary_event_key,''))) as search_text
  from public.operation_write_audit_events e
)
select
  b.id as event_id,
  b.created_at as occurred_at,
  b.actor_profile_id,
  coalesce(nullif(p.full_name,''), nullif(p.email,''), 'System / unknown') as actor_label,
  case
    when b.boundary_owner_module in ('safety','finance','jobs','admin') then b.boundary_owner_module
    when b.search_text ~ '(payment|invoice|bank|reconciliation|receivable|posting|accounting|finance)' then 'finance'
    when b.search_text ~ '(safety|hazard|incident|near.miss|lockout|inspection)' then 'safety'
    when b.search_text ~ '(job|work.order|dispatch|route|seasonal|quality|workability|change.order|visit|equipment|fleet|maintenance|material|fuel|quote|estimate|customer|property|site)' then 'jobs'
    else 'admin'
  end as source_module,
  case
    when b.search_text ~ '(customer|client|crm)' then 'customer'
    when b.search_text ~ '(property|site)' then 'property'
    when b.search_text ~ '(estimate|quote)' then 'estimate'
    when b.search_text ~ '(employee|crew|timekeeping|attendance|training|performance|hiring|onboarding|workforce)' then 'employee'
    when b.search_text ~ '(equipment|fleet|vehicle|trailer|maintenance|fuel|material|consumable)' then 'equipment_fleet'
    when b.search_text ~ '(safety|hazard|incident|near.miss|lockout|inspection)' then 'safety'
    when b.search_text ~ '(invoice|payment|bank|reconciliation|receivable|posting|accounting|finance)' then 'invoice_payment'
    when b.search_text ~ '(job|work.order|dispatch|route|seasonal|quality|workability|change.order|visit)' then 'job_visit'
    else 'other'
  end as entity_group,
  coalesce(nullif(b.entity_type,''), 'unspecified') as source_entity_type,
  b.entity_id,
  b.operation_action as action_key,
  case
    when b.search_text ~ '(reopen|unlock.period)' then 'reopened'
    when b.search_text ~ '(lockout|locked.out)' then 'locked_out'
    when b.search_text ~ '(reject|denied|decline)' then 'rejected'
    when b.search_text ~ '(approve|authorized|accept|signoff)' then 'approved'
    when b.search_text ~ '(assign|owner|dispatch)' then 'assigned'
    when b.search_text ~ '(inspect|inspection|checklist|quality.control)' then 'inspected'
    when b.search_text ~ '(training.record|trained|certif)' then 'trained'
    when b.search_text ~ '(upload|attachment|evidence.link)' then 'uploaded'
    when b.search_text ~ '(notif|message|email|sms)' then 'notified'
    when b.search_text ~ '(post|settle|apply.payment)' then 'posted'
    when b.search_text ~ '(create|register|generated|start)' then 'created'
    when b.search_text ~ '(save|update|change|edit|adjust|resolve|complete|cancel)' then 'changed'
    else 'activity'
  end as activity_kind,
  b.operation_status as event_status,
  initcap(replace(coalesce(nullif(b.operation_action,''),'activity'), '_', ' ')) as activity_label,
  coalesce(nullif(b.boundary_event_key,''), nullif(b.event_key,''), b.id::text) as evidence_reference,
  b.error_message
from base b
left join public.profiles p on p.id=b.actor_profile_id
order by b.created_at desc;

revoke all on table public.v_universal_activity_audit_timeline from public, anon, authenticated;
grant select on table public.v_universal_activity_audit_timeline to service_role;

comment on view public.v_universal_activity_audit_timeline is
  'Build 347 read-only permission-filterable activity evidence. Raw request/response payloads remain private and source modules remain authoritative.';

commit;
