begin;

-- 158_supervisor_closeout_customer_signoff_invoice_followup.sql
-- Creates a controlled supervisor closeout package from approved execution proof.
-- Customer-facing signoff, before/after gallery, review request readiness, invoice readiness,
-- and maintenance follow-up are private portal workflows, not public SEO pages.

create table if not exists public.work_order_closeout_packages (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  closeout_status text not null default 'submitted',
  customer_signoff_required boolean not null default true,
  customer_signoff_status text not null default 'not_requested',
  invoice_ready_requested boolean not null default false,
  invoice_readiness_status text not null default 'blocked',
  review_request_requested boolean not null default false,
  review_request_status text not null default 'not_requested',
  maintenance_followup_status text not null default 'not_requested',
  maintenance_followup_due_at date,
  customer_summary text not null,
  staff_closeout_notes text,
  submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by_profile_id uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  signed_off_by_name text,
  signed_off_by_email text,
  signed_off_at timestamptz,
  customer_change_request_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_order_id),
  check (closeout_status in ('submitted','approved','rejected','rework_required','invoice_ready','archived')),
  check (customer_signoff_status in ('not_requested','requested','signed','declined')),
  check (invoice_readiness_status in ('blocked','waiting_customer_signoff','ready','not_requested')),
  check (review_request_status in ('not_requested','waiting_signoff','queued','sent','cancelled')),
  check (maintenance_followup_status in ('not_requested','scheduled','completed','cancelled'))
);

create index if not exists work_order_closeout_packages_status_idx
  on public.work_order_closeout_packages(closeout_status, customer_signoff_status, created_at desc);
create index if not exists work_order_closeout_packages_due_idx
  on public.work_order_closeout_packages(maintenance_followup_due_at, maintenance_followup_status)
  where maintenance_followup_due_at is not null;

create table if not exists public.work_order_closeout_gallery_items (
  id uuid primary key default gen_random_uuid(),
  closeout_package_id uuid not null references public.work_order_closeout_packages(id) on delete cascade,
  visual_asset_id uuid not null references public.visual_asset_approval_items(id) on delete restrict,
  gallery_role text not null default 'after',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(closeout_package_id, visual_asset_id),
  check (gallery_role in ('before','after','detail','final','other'))
);
create index if not exists work_order_closeout_gallery_items_package_idx
  on public.work_order_closeout_gallery_items(closeout_package_id, display_order, created_at);

create table if not exists public.work_order_customer_closeout_signoffs (
  id uuid primary key default gen_random_uuid(),
  closeout_package_id uuid not null references public.work_order_closeout_packages(id) on delete cascade,
  quote_package_id uuid references public.estimate_quote_packages(id) on delete set null,
  signoff_status text not null default 'signed',
  signer_name text not null,
  signer_email text,
  customer_note text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  check (signoff_status in ('signed','declined'))
);
create index if not exists work_order_customer_closeout_signoffs_package_idx
  on public.work_order_customer_closeout_signoffs(closeout_package_id, created_at desc);

create table if not exists public.work_order_review_requests (
  id uuid primary key default gen_random_uuid(),
  closeout_package_id uuid not null references public.work_order_closeout_packages(id) on delete cascade,
  request_status text not null default 'waiting_signoff',
  review_platform text not null default 'google_business_profile',
  review_url text,
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  requested_at timestamptz,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(closeout_package_id),
  check (request_status in ('waiting_signoff','queued','sent','cancelled'))
);

create table if not exists public.work_order_maintenance_followups (
  id uuid primary key default gen_random_uuid(),
  closeout_package_id uuid not null references public.work_order_closeout_packages(id) on delete cascade,
  followup_status text not null default 'scheduled',
  followup_due_at date not null,
  followup_type text not null default 'maintenance_reminder',
  customer_summary text,
  staff_note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(closeout_package_id),
  check (followup_status in ('scheduled','completed','cancelled'))
);

alter table public.work_order_closeout_packages enable row level security;
alter table public.work_order_closeout_gallery_items enable row level security;
alter table public.work_order_customer_closeout_signoffs enable row level security;
alter table public.work_order_review_requests enable row level security;
alter table public.work_order_maintenance_followups enable row level security;
revoke all on public.work_order_closeout_packages, public.work_order_closeout_gallery_items, public.work_order_customer_closeout_signoffs, public.work_order_review_requests, public.work_order_maintenance_followups from anon, authenticated;

drop view if exists public.v_customer_portal_closeout_packages;
drop view if exists public.v_work_order_closeout_queue;

create view public.v_work_order_closeout_queue
with (security_barrier=true)
as
with proof_counts as (
  select work_order_id,
    count(*) filter (where proof_status='approved')::int as approved_proof_count,
    count(*) filter (where proof_status='submitted')::int as submitted_proof_count,
    max(approved_at) filter (where proof_status='approved') as latest_approved_proof_at
  from public.work_order_execution_proofs
  group by work_order_id
), gallery as (
  select gi.closeout_package_id,
    count(*)::int as gallery_item_count,
    count(*) filter (where gi.gallery_role='before')::int as before_count,
    count(*) filter (where gi.gallery_role='after')::int as after_count,
    count(*) filter (where va.asset_status='approved' and coalesce(va.public_url,'') <> '')::int as approved_public_gallery_count
  from public.work_order_closeout_gallery_items gi
  join public.visual_asset_approval_items va on va.id=gi.visual_asset_id
  group by gi.closeout_package_id
)
select
  cp.id,
  cp.work_order_id,
  wo.work_order_number,
  wo.status as work_order_status,
  wo.scheduled_start,
  wo.scheduled_end,
  c.legal_name as client_name,
  cp.closeout_status,
  cp.customer_signoff_required,
  cp.customer_signoff_status,
  cp.invoice_ready_requested,
  cp.invoice_readiness_status,
  cp.review_request_requested,
  cp.review_request_status,
  cp.maintenance_followup_status,
  cp.maintenance_followup_due_at,
  cp.customer_summary,
  cp.staff_closeout_notes,
  cp.submitted_at,
  sp.full_name as submitted_by_name,
  ap.full_name as approved_by_name,
  cp.approved_at,
  cp.rejection_reason,
  cp.signed_off_by_name,
  cp.signed_off_at,
  cp.customer_change_request_note,
  coalesce(pc.approved_proof_count,0)::int as approved_proof_count,
  coalesce(pc.submitted_proof_count,0)::int as submitted_proof_count,
  pc.latest_approved_proof_at,
  coalesce(g.gallery_item_count,0)::int as gallery_item_count,
  coalesce(g.before_count,0)::int as before_count,
  coalesce(g.after_count,0)::int as after_count,
  coalesce(g.approved_public_gallery_count,0)::int as approved_public_gallery_count,
  coalesce(cd.accepted_estimate_total,0)::numeric(12,2) as accepted_estimate_total,
  coalesce(cd.total_actual_cost,0)::numeric(12,2) as total_actual_cost,
  coalesce(cd.margin_amount,0)::numeric(12,2) as margin_amount,
  coalesce(cd.margin_percent,0)::numeric(7,2) as margin_percent,
  coalesce(cd.cost_status,'awaiting_approved_proof') as cost_status,
  case
    when coalesce(pc.approved_proof_count,0)=0 then 'Needs at least one approved proof before customer signoff.'
    when coalesce(g.before_count,0)=0 or coalesce(g.after_count,0)=0 then 'Before/after gallery is optional but recommended before closeout.'
    when cp.closeout_status='approved' and cp.customer_signoff_required and cp.customer_signoff_status <> 'signed' then 'Waiting for customer signoff in the secure portal.'
    when cp.invoice_readiness_status='ready' then 'Closeout is invoice-ready.'
    else 'Closeout is ready for supervisor review.'
  end as closeout_message,
  cp.created_at,
  cp.updated_at
from public.work_order_closeout_packages cp
join public.work_orders wo on wo.id=cp.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.profiles sp on sp.id=cp.submitted_by_profile_id
left join public.profiles ap on ap.id=cp.approved_by_profile_id
left join proof_counts pc on pc.work_order_id=cp.work_order_id
left join gallery g on g.closeout_package_id=cp.id
left join public.v_work_order_execution_cost_dashboard cd on cd.work_order_id=cp.work_order_id
order by case cp.closeout_status when 'submitted' then 0 when 'approved' then 1 when 'invoice_ready' then 2 else 3 end, cp.updated_at desc, cp.created_at desc;

create view public.v_customer_portal_closeout_packages
with (security_barrier=true)
as
select
  cp.id as closeout_package_id,
  cp.work_order_id,
  cp.closeout_status,
  cp.customer_signoff_required,
  cp.customer_signoff_status,
  cp.customer_summary,
  cp.approved_at,
  cp.signed_off_at,
  cp.invoice_readiness_status,
  cp.review_request_status,
  cp.maintenance_followup_due_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'asset_id', va.id,
        'role', gi.gallery_role,
        'url', va.public_url,
        'thumbnail_url', coalesce(va.thumbnail_url, va.public_url),
        'alt_text', coalesce(va.alt_text, cp.customer_summary),
        'width', va.pixel_width,
        'height', va.pixel_height
      ) order by case gi.gallery_role when 'before' then 0 when 'after' then 1 when 'final' then 2 else 3 end, gi.display_order, gi.created_at
    ) filter (where va.id is not null and va.asset_status='approved' and coalesce(va.public_url,'') <> ''),
    '[]'::jsonb
  ) as gallery
from public.work_order_closeout_packages cp
left join public.work_order_closeout_gallery_items gi on gi.closeout_package_id=cp.id
left join public.visual_asset_approval_items va on va.id=gi.visual_asset_id
where cp.closeout_status in ('approved','invoice_ready')
  and cp.customer_signoff_status in ('requested','signed')
  and nullif(trim(coalesce(cp.customer_summary,'')),'') is not null
group by cp.id, cp.work_order_id, cp.closeout_status, cp.customer_signoff_required, cp.customer_signoff_status, cp.customer_summary, cp.approved_at, cp.signed_off_at, cp.invoice_readiness_status, cp.review_request_status, cp.maintenance_followup_due_at;

revoke all on public.v_work_order_closeout_queue, public.v_customer_portal_closeout_packages from anon, authenticated;
grant select on public.v_work_order_closeout_queue, public.v_customer_portal_closeout_packages to service_role;

create or replace function public.ywi_rpc_submit_work_order_closeout_package(
  p_work_order_id uuid,
  p_actor_profile_id uuid,
  p_customer_summary text,
  p_staff_closeout_notes text default null,
  p_invoice_ready_requested boolean default false,
  p_review_request_requested boolean default false,
  p_maintenance_followup_due_at date default null,
  p_before_asset_ids uuid[] default '{}'::uuid[],
  p_after_asset_ids uuid[] default '{}'::uuid[],
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_work_order public.work_orders%rowtype;
  v_summary text := nullif(trim(coalesce(p_customer_summary,'')),'');
  v_closeout_id uuid;
  v_all_assets uuid[] := coalesce(p_before_asset_ids,'{}'::uuid[]) || coalesce(p_after_asset_ids,'{}'::uuid[]);
  v_missing_count integer := 0;
  v_before_count integer := coalesce(array_length(p_before_asset_ids,1),0);
  v_after_count integer := coalesce(array_length(p_after_asset_ids,1),0);
begin
  if v_rank < 30 then
    raise exception 'Supervisor or higher is required to submit a closeout package.' using errcode='42501';
  end if;
  if v_summary is null or length(v_summary) < 12 then
    raise exception 'A customer-safe closeout summary of at least 12 characters is required.' using errcode='22023';
  end if;
  select * into v_work_order from public.work_orders where id=p_work_order_id;
  if not found then
    raise exception 'Work order not found.' using errcode='P0002';
  end if;
  if cardinality(v_all_assets) > 0 then
    select count(*) into v_missing_count
    from unnest(v_all_assets) as supplied(asset_id)
    left join public.visual_asset_approval_items va on va.id=supplied.asset_id and va.asset_status='approved' and coalesce(va.public_url,'') <> ''
    where va.id is null;
    if v_missing_count > 0 then
      raise exception 'Closeout galleries can use only approved public images.' using errcode='23514';
    end if;
  end if;

  insert into public.work_order_closeout_packages as cp (
    work_order_id, closeout_status, customer_signoff_required, customer_signoff_status,
    invoice_ready_requested, invoice_readiness_status, review_request_requested, review_request_status,
    maintenance_followup_status, maintenance_followup_due_at, customer_summary, staff_closeout_notes,
    submitted_by_profile_id, submitted_at, metadata, updated_at
  ) values (
    p_work_order_id, 'submitted', true, 'not_requested', coalesce(p_invoice_ready_requested,false),
    case when coalesce(p_invoice_ready_requested,false) then 'blocked' else 'not_requested' end,
    coalesce(p_review_request_requested,false), case when coalesce(p_review_request_requested,false) then 'waiting_signoff' else 'not_requested' end,
    case when p_maintenance_followup_due_at is not null then 'scheduled' else 'not_requested' end,
    p_maintenance_followup_due_at, v_summary, nullif(trim(coalesce(p_staff_closeout_notes,'')),''),
    p_actor_profile_id, now(), coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('schema',158,'before_count',v_before_count,'after_count',v_after_count), now()
  ) on conflict (work_order_id) do update set
    closeout_status='submitted',
    customer_signoff_status='not_requested',
    invoice_ready_requested=excluded.invoice_ready_requested,
    invoice_readiness_status=excluded.invoice_readiness_status,
    review_request_requested=excluded.review_request_requested,
    review_request_status=excluded.review_request_status,
    maintenance_followup_status=excluded.maintenance_followup_status,
    maintenance_followup_due_at=excluded.maintenance_followup_due_at,
    customer_summary=excluded.customer_summary,
    staff_closeout_notes=excluded.staff_closeout_notes,
    submitted_by_profile_id=excluded.submitted_by_profile_id,
    submitted_at=now(),
    approved_by_profile_id=null,
    approved_at=null,
    rejected_by_profile_id=null,
    rejected_at=null,
    rejection_reason=null,
    customer_change_request_note=null,
    metadata=excluded.metadata,
    updated_at=now()
  returning id into v_closeout_id;

  delete from public.work_order_closeout_gallery_items where closeout_package_id=v_closeout_id;
  insert into public.work_order_closeout_gallery_items(closeout_package_id, visual_asset_id, gallery_role, display_order)
  select v_closeout_id, asset_id, 'before', ord::int from unnest(coalesce(p_before_asset_ids,'{}'::uuid[])) with ordinality as t(asset_id,ord);
  insert into public.work_order_closeout_gallery_items(closeout_package_id, visual_asset_id, gallery_role, display_order)
  select v_closeout_id, asset_id, 'after', ord::int from unnest(coalesce(p_after_asset_ids,'{}'::uuid[])) with ordinality as t(asset_id,ord);

  if coalesce(p_review_request_requested,false) then
    insert into public.work_order_review_requests(closeout_package_id, request_status, requested_by_profile_id, notes, updated_at)
    values (v_closeout_id, 'waiting_signoff', p_actor_profile_id, 'Queued after customer signoff.', now())
    on conflict (closeout_package_id) do update set request_status='waiting_signoff', requested_by_profile_id=excluded.requested_by_profile_id, notes=excluded.notes, updated_at=now();
  else
    update public.work_order_review_requests set request_status='cancelled', updated_at=now() where closeout_package_id=v_closeout_id and request_status <> 'sent';
  end if;

  if p_maintenance_followup_due_at is not null then
    insert into public.work_order_maintenance_followups(closeout_package_id, followup_due_at, customer_summary, staff_note, created_by_profile_id, updated_at)
    values (v_closeout_id, p_maintenance_followup_due_at, v_summary, nullif(trim(coalesce(p_staff_closeout_notes,'')),''), p_actor_profile_id, now())
    on conflict (closeout_package_id) do update set followup_status='scheduled', followup_due_at=excluded.followup_due_at, customer_summary=excluded.customer_summary, staff_note=excluded.staff_note, updated_at=now();
  else
    update public.work_order_maintenance_followups set followup_status='cancelled', cancelled_at=now(), updated_at=now() where closeout_package_id=v_closeout_id and followup_status='scheduled';
  end if;

  return jsonb_build_object('closeout_package_id',v_closeout_id,'work_order_id',p_work_order_id,'closeout_status','submitted','message','Supervisor closeout package submitted for review.');
end;
$$;

create or replace function public.ywi_rpc_decide_work_order_closeout_package(
  p_closeout_package_id uuid,
  p_actor_profile_id uuid,
  p_decision text,
  p_decision_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id),0);
  v_package public.work_order_closeout_packages%rowtype;
  v_decision text := lower(trim(coalesce(p_decision,'')));
  v_note text := nullif(trim(coalesce(p_decision_note,'')),'');
  v_approved_proof_count integer := 0;
begin
  if v_rank < 30 then
    raise exception 'Supervisor or higher is required to decide closeout.' using errcode='42501';
  end if;
  select * into v_package from public.work_order_closeout_packages where id=p_closeout_package_id for update;
  if not found then
    raise exception 'Closeout package not found.' using errcode='P0002';
  end if;
  if v_decision not in ('approve','reject','rework','invoice_ready') then
    raise exception 'Unsupported closeout decision.' using errcode='22023';
  end if;
  if v_decision in ('reject','rework') and v_note is null then
    raise exception 'A rejection or rework reason is required.' using errcode='22023';
  end if;
  select count(*) into v_approved_proof_count from public.work_order_execution_proofs where work_order_id=v_package.work_order_id and proof_status='approved';
  if v_decision in ('approve','invoice_ready') and v_approved_proof_count = 0 then
    raise exception 'Approve at least one execution proof before closeout approval.' using errcode='23514';
  end if;

  if v_decision='approve' then
    update public.work_order_closeout_packages set
      closeout_status='approved',
      customer_signoff_status=case when customer_signoff_required then 'requested' else 'not_requested' end,
      invoice_readiness_status=case when invoice_ready_requested and customer_signoff_required then 'waiting_customer_signoff' when invoice_ready_requested then 'ready' else 'not_requested' end,
      approved_by_profile_id=p_actor_profile_id,
      approved_at=now(),
      rejected_by_profile_id=null,
      rejected_at=null,
      rejection_reason=null,
      updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
  elsif v_decision='invoice_ready' then
    if v_package.customer_signoff_required and v_package.customer_signoff_status <> 'signed' then
      raise exception 'Customer signoff is required before invoice readiness.' using errcode='23514';
    end if;
    update public.work_order_closeout_packages set
      closeout_status='invoice_ready',
      invoice_ready_requested=true,
      invoice_readiness_status='ready',
      approved_by_profile_id=coalesce(approved_by_profile_id,p_actor_profile_id),
      approved_at=coalesce(approved_at,now()),
      updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
  elsif v_decision='rework' then
    update public.work_order_closeout_packages set
      closeout_status='rework_required',
      customer_signoff_status='declined',
      invoice_readiness_status='blocked',
      review_request_status='cancelled',
      customer_change_request_note=v_note,
      rejected_by_profile_id=p_actor_profile_id,
      rejected_at=now(),
      rejection_reason=v_note,
      updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
  else
    update public.work_order_closeout_packages set
      closeout_status='rejected',
      invoice_readiness_status='blocked',
      review_request_status='cancelled',
      rejected_by_profile_id=p_actor_profile_id,
      rejected_at=now(),
      rejection_reason=v_note,
      updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
  end if;

  if v_package.review_request_requested and v_package.customer_signoff_status='signed' and v_package.closeout_status in ('approved','invoice_ready') then
    update public.work_order_review_requests set request_status='queued', requested_by_profile_id=p_actor_profile_id, requested_at=now(), updated_at=now() where closeout_package_id=v_package.id and request_status <> 'sent';
    update public.work_order_closeout_packages set review_request_status='queued', updated_at=now() where id=v_package.id;
  end if;

  return jsonb_build_object('closeout_package_id',v_package.id,'work_order_id',v_package.work_order_id,'closeout_status',v_package.closeout_status,'customer_signoff_status',v_package.customer_signoff_status,'invoice_readiness_status',v_package.invoice_readiness_status);
end;
$$;

create or replace function public.ywi_rpc_customer_sign_work_order_closeout(
  p_quote_package_id uuid,
  p_closeout_package_id uuid,
  p_customer_name text,
  p_customer_email text default null,
  p_accept_closeout boolean default true,
  p_customer_note text default null,
  p_ip_hash text default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.estimate_quote_packages%rowtype;
  v_package public.work_order_closeout_packages%rowtype;
  v_signoff_status text := case when coalesce(p_accept_closeout,true) then 'signed' else 'declined' end;
  v_name text := nullif(trim(coalesce(p_customer_name,'')),'');
  v_email text := nullif(trim(coalesce(p_customer_email,'')),'');
  v_work_order_id uuid;
  v_signoff_id uuid;
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'Customer name is required for closeout signoff.' using errcode='22023';
  end if;
  select * into v_quote from public.estimate_quote_packages where id=p_quote_package_id;
  if not found then
    raise exception 'Quote package not found.' using errcode='P0002';
  end if;
  select w.id into v_work_order_id
  from public.work_orders w
  where w.estimate_id=v_quote.estimate_id
  order by w.created_at desc
  limit 1;
  if v_work_order_id is null then
    raise exception 'No work order is linked to this quote package.' using errcode='P0002';
  end if;
  select * into v_package from public.work_order_closeout_packages where id=p_closeout_package_id and work_order_id=v_work_order_id for update;
  if not found or v_package.closeout_status not in ('approved','invoice_ready') then
    raise exception 'This closeout package is not available for customer signoff.' using errcode='23514';
  end if;

  insert into public.work_order_customer_closeout_signoffs(closeout_package_id, quote_package_id, signoff_status, signer_name, signer_email, customer_note, ip_hash, user_agent)
  values (p_closeout_package_id, p_quote_package_id, v_signoff_status, v_name, v_email, nullif(trim(coalesce(p_customer_note,'')),''), p_ip_hash, p_user_agent)
  returning id into v_signoff_id;

  if v_signoff_status='signed' then
    update public.work_order_closeout_packages set
      customer_signoff_status='signed', signed_off_by_name=v_name, signed_off_by_email=v_email, signed_off_at=now(),
      closeout_status=case when invoice_ready_requested then 'invoice_ready' else closeout_status end,
      invoice_readiness_status=case when invoice_ready_requested then 'ready' else invoice_readiness_status end,
      review_request_status=case when review_request_requested then 'queued' else review_request_status end,
      updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
    update public.work_order_review_requests set request_status='queued', requested_at=now(), updated_at=now() where closeout_package_id=p_closeout_package_id and request_status <> 'sent';
  else
    update public.work_order_closeout_packages set
      customer_signoff_status='declined', closeout_status='rework_required', invoice_readiness_status='blocked', review_request_status='cancelled',
      customer_change_request_note=nullif(trim(coalesce(p_customer_note,'')),''), updated_at=now()
    where id=p_closeout_package_id
    returning * into v_package;
    update public.work_order_review_requests set request_status='cancelled', updated_at=now() where closeout_package_id=p_closeout_package_id and request_status <> 'sent';
  end if;

  insert into public.customer_portal_events(quote_package_id, estimate_id, work_order_id, event_type, customer_name, customer_email, event_note, event_payload)
  values (p_quote_package_id, v_quote.estimate_id, v_work_order_id, case when v_signoff_status='signed' then 'closeout_signed' else 'closeout_declined' end, v_name, v_email, nullif(trim(coalesce(p_customer_note,'')),''), jsonb_build_object('closeout_package_id',p_closeout_package_id,'signoff_id',v_signoff_id));

  return jsonb_build_object('closeout_package_id',p_closeout_package_id,'signoff_id',v_signoff_id,'signoff_status',v_signoff_status,'closeout_status',v_package.closeout_status,'invoice_readiness_status',v_package.invoice_readiness_status,'review_request_status',v_package.review_request_status);
end;
$$;

create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations'),
           ('work_order_live_updates'),('work_order_live_update_media'),
           ('customer_notification_preferences'),('customer_notification_outbox'),('customer_notification_delivery_attempts'),
           ('work_order_execution_proofs'),('work_order_execution_proof_media'),
           ('work_order_closeout_packages'),('work_order_closeout_gallery_items'),('work_order_customer_closeout_signoffs'),
           ('work_order_review_requests'),('work_order_maintenance_followups')
  ), checks as (
    select 'review_assets_private'::text as assertion_key,
      case when exists(select 1 from storage.buckets where id='review-assets' and public=false) then 'passed' else 'failed' end as assertion_status,
      'Review uploads must remain in a private bucket until approved.'::text as details
    union all select 'accountant_exports_private', case when exists(select 1 from storage.buckets where id='accountant-exports' and public=false) then 'passed' else 'failed' end,
      'Accountant ZIP packages must remain private and use signed downloads.'
    union all select 'public_assets_bucket_present', case when exists(select 1 from storage.buckets where id='public-assets' and public=true) then 'passed' else 'failed' end,
      'Public assets may be public only after the approval-copy workflow promotes them.'
    union all select 'sensitive_tables_rls_enabled', case when not exists(
      select 1 from required_tables r left join pg_class c on c.relname=r.table_name and c.relnamespace='public'::regnamespace where coalesce(c.relrowsecurity,false)=false
    ) then 'passed' else 'failed' end,
      'Sensitive direct-data tables must have Row Level Security enabled.'
    union all select 'closeout_tables_not_public', case when not exists(
      select 1 from information_schema.table_privileges tp
      where tp.table_schema='public'
        and tp.table_name in ('work_order_closeout_packages','work_order_closeout_gallery_items','work_order_customer_closeout_signoffs','work_order_review_requests','work_order_maintenance_followups')
        and tp.grantee in ('anon','authenticated')
    ) then 'passed' else 'failed' end,
      'Closeout, signoff, review, and maintenance workflow tables are private service-role surfaces.'
    union all select 'closeout_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_submit_work_order_closeout_package','ywi_rpc_decide_work_order_closeout_package','ywi_rpc_customer_sign_work_order_closeout')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Closeout and customer signoff RPCs are reachable only through role/token-checking Edge Functions.'
    union all select 'portal_rpc_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public' and rp.routine_name='ywi_rpc_accept_quote_package' and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Portal conversion RPC is callable only through the token-validating service function.'
    union all select 'live_update_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_create_work_order_live_update','ywi_rpc_retract_work_order_live_update')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Live job updates are written only by the authenticated role-checking service function.'
    union all select 'customer_notification_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_set_customer_live_update_email_preference','ywi_rpc_claim_customer_notification','ywi_rpc_complete_customer_notification','ywi_rpc_retry_customer_notification')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Customer notification preference/outbox operations are only reachable through token/service functions.'
    union all select 'execution_proof_rpcs_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public'
        and rp.routine_name in ('ywi_rpc_submit_work_order_execution_proof','ywi_rpc_decide_work_order_execution_proof')
        and rp.grantee in ('anon','authenticated')
        and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Service-execution proof and internal costing RPCs are not callable by browser roles.'
  ) select * from checks;
$$;

create or replace function public.ywi_get_operations_capabilities(p_actor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce((select role from public.profiles where id = p_actor_profile_id and coalesce(is_active,true) is true), ''));
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id), 0);
  v_actions jsonb;
begin
  select coalesce(jsonb_object_agg(action_key,
    jsonb_build_object(
      'label', label,
      'minimum_role', minimum_role,
      'minimum_rank', minimum_rank,
      'permitted', v_rank >= minimum_rank,
      'reason', case when v_rank >= minimum_rank then 'Allowed for your role.' else 'Requires ' || replace(minimum_role, '_', ' ') || ' or higher.' end
    )
  ), '{}'::jsonb)
  into v_actions
  from (values
    ('payment_action_request','Create payment action','job_admin',45),
    ('payment_action_decision','Approve, reject, or post payment','job_admin',45),
    ('bank_csv_preview','Parse bank CSV','job_admin',45),
    ('bank_csv_confirm_import','Promote confirmed bank rows','job_admin',45),
    ('reconciliation_action','Process reconciliation','job_admin',45),
    ('equipment_scan_event','Record equipment custody scan','site_leader',20),
    ('equipment_cost_recovery_decision','Approve equipment recovery','job_admin',45),
    ('visual_asset_register','Register visual asset','supervisor',30),
    ('visual_asset_decision','Approve or reject visual asset','job_admin',45),
    ('public_route_register','Save public route','job_admin',45),
    ('public_route_decision','Approve or reject public route','job_admin',45),
    ('public_route_publish','Publish public route and sitemap','job_admin',45),
    ('quote_owner_assign','Assign quote owner','supervisor',30),
    ('quote_followup_event','Record quote follow-up','supervisor',30),
    ('dispatch_schedule','Dispatch work order','supervisor',30),
    ('job_cost_refresh','Refresh live job cost','supervisor',30),
    ('work_order_live_update','Record live work update','site_leader',20),
    ('work_order_live_update_retract','Retract live work update','supervisor',30),
    ('work_order_execution_proof_submit','Capture service-execution proof','site_leader',20),
    ('work_order_execution_proof_decision','Approve service-execution proof','supervisor',30),
    ('work_order_closeout_submit','Submit supervisor closeout package','supervisor',30),
    ('work_order_closeout_decision','Approve/reject closeout or mark invoice-ready','supervisor',30),
    ('customer_notification_retry','Retry customer notification','job_admin',45),
    ('accountant_export_prepare','Generate accountant package','job_admin',45),
    ('staging_fixture_create','Create disposable staging fixture','job_admin',45),
    ('staging_fixture_cleanup','Clean disposable staging fixture','job_admin',45),
    ('content_signal_record','Record search/local performance evidence','job_admin',45),
    ('content_signal_decision','Decide route/content follow-up','job_admin',45),
    ('stripe_webhook_alert_decision','Acknowledge or resolve webhook alert','job_admin',45),
    ('release_readiness_snapshot','Capture release evidence snapshot','job_admin',45)
  ) as permissions(action_key, label, minimum_role, minimum_rank);
  return jsonb_build_object('actor_profile_id',p_actor_profile_id,'actor_role',coalesce(v_role,'unknown'),'actor_rank',v_rank,'actions',v_actions,'generated_at',now());
end;
$$;

create or replace view public.v_schema_drift_status as
select 158::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=158 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=158
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 158.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'supervisor_closeout_signoff_invoice_followup','field_execution','Supervisor closeout, customer signoff, invoice readiness, review request, and maintenance follow-up','active',91,8,9,
  'In staging, submit a closeout from approved proof, approve it, sign it from the portal, then verify invoice readiness, review request status, and maintenance follow-up without exposing costs.',
  'Supervisor / admin',68,'{"build":"2026-07-17a","schema":158,"customer_costs_hidden":true,"portal_closeout_private":true}'::jsonb
)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

insert into public.app_schema_versions(
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  158,
  '158_supervisor_closeout_customer_signoff_invoice_followup',
  '158_supervisor_closeout_customer_signoff_invoice_followup.sql',
  '2026-07-17a',
  'Adds supervisor closeout packages, approved before/after gallery, customer portal signoff, invoice-readiness status, review request queue, and maintenance follow-up from approved proof records.',
  'applied',
  'Customer portal receives only approved summaries and public gallery images. Internal costs, staff notes, and margins remain service-role/Cockpit only.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label,
  description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

revoke all on function public.ywi_rpc_submit_work_order_closeout_package(uuid,uuid,text,text,boolean,boolean,date,uuid[],uuid[],jsonb) from public;
revoke all on function public.ywi_rpc_decide_work_order_closeout_package(uuid,uuid,text,text) from public;
revoke all on function public.ywi_rpc_customer_sign_work_order_closeout(uuid,uuid,text,text,boolean,text,text,text) from public;
grant execute on function public.ywi_rpc_submit_work_order_closeout_package(uuid,uuid,text,text,boolean,boolean,date,uuid[],uuid[],jsonb) to service_role;
grant execute on function public.ywi_rpc_decide_work_order_closeout_package(uuid,uuid,text,text) to service_role;
grant execute on function public.ywi_rpc_customer_sign_work_order_closeout(uuid,uuid,text,text,boolean,text,text,text) to service_role;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_security_policy_assertions() to service_role;
revoke all on function public.ywi_get_operations_capabilities(uuid) from public;
grant execute on function public.ywi_get_operations_capabilities(uuid) to service_role;

commit;
