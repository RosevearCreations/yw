-- YW585 • STAGING-ONLY source. DO NOT run on production.
-- No paid staging project approved; no real customer activation, jobs or photos.
-- Requires verified historical 420→421→422→443→451 and staged 580–584,
-- original database backup, RLS adversarial tests and independent DBA approval.
-- Only independently corroborated admin/server process may provision membership.
begin;

create table if not exists public.ywi_585_customer_memberships (
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 client_id uuid not null references public.clients(id) on delete restrict,
 customer_user_id uuid not null references auth.users(id) on delete restrict,
 membership_state text not null default 'pending'
  check(membership_state in ('pending','active','revoked')),
 verification_source text not null check(char_length(btrim(verification_source)) between 20 and 240),
 verified_by uuid references auth.users(id) on delete restrict,
 verified_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 primary key(company_id,client_id,customer_user_id),
 unique(company_id,customer_user_id),
 foreign key(company_id,client_id) references
  public.ywi_company_client_links_422(company_id,client_id) on delete restrict,
 check(
  (membership_state='pending' and verified_at is null and verified_by is null)
  or (membership_state in ('active','revoked') and verified_at is not null and verified_by is not null)
 )
);
create index if not exists ywi585_membership_customer
 on public.ywi_585_customer_memberships(customer_user_id,membership_state);
alter table public.ywi_585_customer_memberships enable row level security;
revoke all on public.ywi_585_customer_memberships from public,anon,authenticated;
grant select on public.ywi_585_customer_memberships to authenticated;
drop policy if exists ywi585_customer_own_active_link on public.ywi_585_customer_memberships;
create policy ywi585_customer_own_active_link on public.ywi_585_customer_memberships
 for select to authenticated using(
 customer_user_id=(select auth.uid()) and membership_state='active'
 and exists(select 1 from public.ywi_company_client_links_422 l
  where l.company_id=company_id and l.client_id=client_id)
);
-- No end-user INSERT, UPDATE, DELETE; no public enrollment RPC or invite tokens.
-- Separate independently verified trusted server custodian may provision using
-- privileged database procedure only after out-of-band identity corroboration.

create table if not exists public.ywi_585_customer_request_drafts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 client_id uuid not null,
 customer_user_id uuid not null default auth.uid(),
 service_module_key text not null check(service_module_key in
 ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture')),
 request_kind text not null check(request_kind in
 ('quote_planning','maintenance_question','rental_question','event_interest')),
 short_summary text not null check(char_length(btrim(short_summary)) between 10 and 160),
 details text not null check(char_length(details) between 10 and 800),
 lifecycle_state text not null default 'private_draft' check(lifecycle_state='private_draft'),
 created_at timestamptz not null default statement_timestamp(),
 foreign key(company_id,client_id,customer_user_id) references
  public.ywi_585_customer_memberships(company_id,client_id,customer_user_id) on delete restrict,
 foreign key(company_id,service_module_key) references
  public.ywi_company_service_modules(company_id,module_key) on delete restrict,
 unique(company_id,id)
);
create index if not exists ywi585_request_customer_recent
 on public.ywi_585_customer_request_drafts(company_id,customer_user_id,created_at desc);
alter table public.ywi_585_customer_request_drafts enable row level security;
revoke all on public.ywi_585_customer_request_drafts from public,anon,authenticated;
grant select,insert(company_id,client_id,service_module_key,request_kind,short_summary,details)
 on public.ywi_585_customer_request_drafts to authenticated;
drop policy if exists ywi585_request_customer_own_read on public.ywi_585_customer_request_drafts;
create policy ywi585_request_customer_own_read on public.ywi_585_customer_request_drafts
 for select to authenticated using(
 customer_user_id=(select auth.uid())
 and lifecycle_state='private_draft'
 and exists(select 1 from public.ywi_585_customer_memberships m
  where m.company_id=company_id and m.client_id=client_id
   and m.customer_user_id=(select auth.uid()) and m.membership_state='active'));
drop policy if exists ywi585_request_customer_own_insert on public.ywi_585_customer_request_drafts;
create policy ywi585_request_customer_own_insert on public.ywi_585_customer_request_drafts
 for insert to authenticated with check(
 customer_user_id=(select auth.uid()) and lifecycle_state='private_draft'
 and exists(select 1 from public.ywi_585_customer_memberships m
  where m.company_id=company_id and m.client_id=client_id
   and m.customer_user_id=(select auth.uid()) and m.membership_state='active')
 and exists(select 1 from public.ywi_company_service_modules s
  where s.company_id=company_id and s.module_key=service_module_key and s.enabled=true)
);
-- A private draft is never a submitted booking/quote, authorized job, payment,
-- crew dispatch, public post, event reservation or customer message.

create or replace function public.ywi_585_customer_portal_scope(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid := (select auth.uid());
 v_client uuid;
 v_name text;
 v_count integer;
begin
 if v_user is null or p_company_id is null then
  raise exception 'YW585 verified customer identity and company required';
 end if;
 select m.client_id,c.name into v_client,v_name
 from public.ywi_585_customer_memberships m
 join public.ywi_companies c on c.id=m.company_id
 join public.ywi_company_client_links_422 l on l.company_id=m.company_id and l.client_id=m.client_id
 join public.clients original on original.id=m.client_id and original.is_active=true
 where m.company_id=p_company_id and m.customer_user_id=v_user
   and m.membership_state='active';
 if v_client is null then
  raise exception 'YW585 original customer linkage not verified';
 end if;
 select count(*)::integer into v_count from public.ywi_company_service_modules s
 where s.company_id=p_company_id and s.enabled=true and s.module_key in
 ('landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture');
 return jsonb_build_object(
  'scope','original_customer_company_only',
  'company_id',p_company_id,'client_id',v_client,'company_name',v_name,
  'service_count_enabled',v_count,'captured_at',statement_timestamp(),
  'can_view_work_orders',false,'can_view_photos',false,
  'can_submit_booking',false,'can_charge_account',false,
  'can_change_company_settings',false,'public_site_published',false,
  'owner_or_sysop_authority',false);
end $$;
revoke all on function public.ywi_585_customer_portal_scope(uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_585_customer_portal_scope(uuid)
 to authenticated;

comment on table public.ywi_585_customer_memberships is
 'STAGING ONLY: independently proofed original CRM customer membership. No public account enrollment.';
comment on table public.ywi_585_customer_request_drafts is
 'STAGING ONLY: customer-private planning drafts without submission, billing or Jobs authority.';
commit;
