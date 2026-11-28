begin;
-- YW602 private zone map and customer decision custody.
-- Reuses original 422 company/client/site bindings and canonical work orders.
-- No production customer, property, quote, charge or account is seeded.
-- Separate customer identities never create an auth.users or employee profile.
-- Owner-issued high entropy credentials are hashed, expiring and revocable.
create table public.ywi_602_customer_identities (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id),
 label text not null check(length(btrim(label)) between 2 and 120),
 token_hash bytea not null unique check(octet_length(token_hash)=32),
 issued_by uuid not null references public.profiles(id),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(company_id,id)
);
create table public.ywi_602_property_access (
 company_id uuid not null references public.ywi_companies(id),
 site_id uuid not null references public.client_sites(id),
 user_id uuid not null,
 foreign key(company_id,user_id) references public.ywi_602_customer_identities(company_id,id),
 access_role text not null check(access_role in ('manager','payer','resident')),
 approved_by uuid not null references public.profiles(id),
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 primary key(company_id,site_id,user_id),
 check(expires_at>approved_at)
);
create table public.ywi_602_zone_layouts (
 company_id uuid not null references public.ywi_companies(id),
 site_id uuid not null references public.client_sites(id),
 zone_id uuid not null references public.client_site_zones(id),
 x integer not null check(x>=0 and x<10000),
 y integer not null check(y>=0 and y<10000),
 w integer not null check(w>0 and w<=10000),
 h integer not null check(h>0 and h<=10000),
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(company_id,site_id,zone_id),
 check(x+w<=10000 and y+h<=10000)
);
create table public.ywi_602_property_changes (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id),
 site_id uuid not null references public.client_sites(id),
 zone_id uuid not null references public.client_site_zones(id),
 work_order_id uuid not null references public.work_orders(id),
 requested_by uuid not null,
 requested_by_customer boolean not null,
 owner_actor uuid generated always as (case when not requested_by_customer then requested_by end) stored references public.profiles(id),
 customer_actor uuid generated always as (case when requested_by_customer then requested_by end) stored,
 foreign key(company_id,customer_actor) references public.ywi_602_customer_identities(company_id,id),
 request_nonce uuid not null,
 description text not null check(length(btrim(description)) between 8 and 1500),
 requested_at timestamptz not null default now(),
 unique(company_id,site_id,requested_by,requested_by_customer,request_nonce)
);
create table public.ywi_602_change_quotes (
 request_id uuid not null references public.ywi_602_property_changes(id),
 version integer not null check(version>0),
 scope text not null check(length(btrim(scope)) between 8 and 1500),
 quantity numeric(12,3) not null check(quantity>0),
 unit text not null check(length(btrim(unit)) between 1 and 32),
 total_cents bigint not null check(total_cents between 0 and 100000000),
 currency text not null default 'CAD' check(currency='CAD'),
 issued_by uuid not null references public.profiles(id),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 primary key(request_id,version),
 check(expires_at>issued_at)
);
create table public.ywi_602_change_decisions (
 request_id uuid not null,
 version integer not null,
 decision text not null check(decision in ('accept','decline')),
 decided_by uuid not null references public.ywi_602_customer_identities(id),
 decided_at timestamptz not null default now(),
 primary key(request_id,version),
 foreign key(request_id,version) references public.ywi_602_change_quotes(request_id,version)
);
-- Link the accepted exact version to a single original change-order draft.
-- Office review, tax treatment, scope application and invoice posting remain
-- separate original authorities; never silently treat a gross quote as net.
create table public.ywi_602_change_handoffs (
 request_id uuid primary key references public.ywi_602_property_changes(id),
 version integer not null,
 change_order_id uuid not null unique references public.change_orders(id) on delete restrict,
 handed_by uuid not null references public.profiles(id),
 handed_at timestamptz not null default now(),
 foreign key(request_id,version) references public.ywi_602_change_decisions(request_id,version)
);
do $$declare t text;begin
 foreach t in array array['ywi_602_customer_identities','ywi_602_property_access','ywi_602_zone_layouts','ywi_602_property_changes','ywi_602_change_quotes','ywi_602_change_decisions','ywi_602_change_handoffs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to service_role',t);
 end loop;
end$$;
-- Preserve original RPC shape for existing readers but never return owner PII
-- in the routine SaaS registration/entitlement directory. Original curated
-- account audit is a distinct operator task, not a company-directory payload.
create or replace function public.ywi_platform_company_directory_489()
returns table(company_id uuid,company_name text,owner_user_id uuid,
 owner_email text,enabled_services bigint,registered_services bigint)
language sql stable security definer set search_path='' as $$
 select c.id,c.name,null::uuid,null::text,
 (select count(*) from public.ywi_company_service_modules m where m.company_id=c.id and m.enabled=true),
 (select count(*) from public.ywi_company_service_modules m where m.company_id=c.id)
 from public.ywi_companies c
 where (select public.ywi_is_platform_administrator_489())
 order by c.created_at,c.id;
$$;
revoke all on function public.ywi_platform_company_directory_489() from public,anon,authenticated;
grant execute on function public.ywi_platform_company_directory_489() to authenticated;

-- All writes use the verified auth.uid, never caller-supplied actor or role.
-- One lock per company serializes grant/revocation, publication, quote revisions
-- and payer decisions. Original company links must be unique to the tenant.
create schema yw602_private;
revoke all on schema yw602_private from public,anon,authenticated,service_role;
create function yw602_private.property_portal(actor uuid,customer_company uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare
 company uuid; site uuid; zone uuid; work uuid; target uuid;
 owner_id uuid; actor_role text; client uuid; req public.ywi_602_property_changes%rowtype;
 q public.ywi_602_change_quotes%rowtype; d public.ywi_602_change_decisions%rowtype;
 v integer; result jsonb; nonce uuid; body text; role_value text; exp timestamptz;
 canonical public.change_orders%rowtype; handoff public.ywi_602_change_handoffs%rowtype;
begin
 if actor is null then raise exception 'YW602 verified identity required' using errcode='42501';end if;
 if customer_company is not null and p_action not in ('list','overview','request','decide') then raise exception 'YW602 customer action denied' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>12000 then
 raise exception 'YW602 invalid request';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
   select l.company_id,l.client_site_id as site_id,c.name as company_name,s.site_name,
   case when customer_company is null then 'owner' else a.access_role end as access_role
   from public.ywi_company_site_links_422 l
   join public.ywi_companies c on c.id=l.company_id
   join public.client_sites s on s.id=l.client_site_id and s.client_id=l.client_id and s.is_active=true
   join public.ywi_company_client_links_422 cl on cl.company_id=l.company_id and cl.client_id=l.client_id
   left join public.ywi_602_property_access a on a.company_id=l.company_id and a.site_id=s.id and a.user_id=actor and a.approved_by=c.owner_user_id and a.revoked_at is null and a.expires_at>now()
   where ((customer_company is null and c.owner_user_id=actor) or (c.id=customer_company and a.user_id is not null))
   and not exists(select 1 from public.ywi_company_site_links_422 other where other.client_site_id=s.id and other.company_id<>c.id)
   order by c.name,s.site_name,s.id limit 101
  ) r;
  if jsonb_array_length(result)>100 then raise exception 'YW602 bounded roster exceeded';end if;
  return jsonb_build_object('state','authorized_properties','properties',result);
 end if;
 company:=(p_payload->>'company_id')::uuid;site:=(p_payload->>'site_id')::uuid;
 select c.owner_user_id into owner_id from public.ywi_companies c where c.id=company for update;
 if owner_id is null then raise exception 'YW602 tenant authority required' using errcode='42501';end if;
 select l.client_id into client from public.ywi_company_site_links_422 l
 join public.client_sites s on s.id=l.client_site_id and s.client_id=l.client_id and s.is_active=true
 join public.ywi_company_client_links_422 cl on cl.company_id=l.company_id and cl.client_id=l.client_id
 where l.company_id=company and l.client_site_id=site
 and not exists(select 1 from public.ywi_company_site_links_422 other where other.client_site_id=site and other.company_id<>company);
 if client is null then raise exception 'YW602 property authority required' using errcode='42501';end if;
 if customer_company is null and owner_id=actor then actor_role:='owner';
 elsif customer_company=company and exists(select 1 from public.ywi_602_customer_identities i where i.id=actor and i.company_id=company and i.issued_by=owner_id and i.revoked_at is null and i.expires_at>now()) then select a.access_role into actor_role from public.ywi_602_property_access a
 where a.company_id=company and a.site_id=site and a.user_id=actor and a.approved_by=owner_id
 and a.revoked_at is null and a.expires_at>now();end if;
 if actor_role is null then raise exception 'YW602 property access required' using errcode='42501';end if;

 if p_action='customer_create' then
  if actor_role<>'owner' or p_payload->>'confirmed' is distinct from 'true' then raise exception 'YW602 confirmed owner required' using errcode='42501';end if;
  body:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.ywi_602_customer_identities(company_id,label,token_hash,issued_by,expires_at)
  values(company,btrim(p_payload->>'label'),extensions.digest(body,'sha256'),actor,now()+interval '7 days') returning id into target;
  return jsonb_build_object('state','customer_created','customer_id',target,'access_code',body);
 end if;
 if p_action='customer_rotate' or p_action='customer_disable' then
  if actor_role<>'owner' or p_payload->>'confirmed' is distinct from 'true' then raise exception 'YW602 confirmed owner required' using errcode='42501';end if;
  target:=(p_payload->>'user_id')::uuid;
  if not exists(select 1 from public.ywi_602_customer_identities i where i.id=target and i.company_id=company and i.issued_by=owner_id) then raise exception 'YW602 customer authority required' using errcode='42501';end if;
  if p_action='customer_disable' then
   update public.ywi_602_customer_identities set revoked_at=now() where id=target and company_id=company;
   return jsonb_build_object('state','customer_disabled');
  end if;
  body:=encode(extensions.gen_random_bytes(32),'hex');
  update public.ywi_602_customer_identities set token_hash=extensions.digest(body,'sha256'),expires_at=now()+interval '7 days',revoked_at=null where id=target and company_id=company;
  return jsonb_build_object('state','customer_rotated','customer_id',target,'access_code',body);
 end if;
 if p_action='grant' or p_action='revoke' then
  if actor_role<>'owner' then raise exception 'YW602 owner required' using errcode='42501';end if;
  target:=(p_payload->>'user_id')::uuid;
  if not exists(select 1 from public.ywi_602_customer_identities i where i.id=target and i.company_id=company and i.issued_by=owner_id) then raise exception 'YW602 separate customer identity required';end if;
  if p_action='revoke' then
   update public.ywi_602_property_access a set revoked_at=now() where a.company_id=company and a.site_id=site and a.user_id=target and a.revoked_at is null;
   return jsonb_build_object('state','revoked');
  end if;
  role_value:=p_payload->>'access_role';exp:=(p_payload->>'expires_at')::timestamptz;
  if role_value is null or role_value not in ('manager','payer','resident') or exp is null or exp<=now() or exp>now()+interval '365 days' or p_payload->>'confirmed' is distinct from 'true'
  then raise exception 'YW602 explicit time-bounded property grant required';end if;
  insert into public.ywi_602_property_access(company_id,site_id,user_id,access_role,approved_by,expires_at)
  values(company,site,target,role_value,actor,exp)
  on conflict(company_id,site_id,user_id) do update set access_role=excluded.access_role,approved_by=excluded.approved_by,approved_at=now(),expires_at=excluded.expires_at,revoked_at=null;
  return jsonb_build_object('state','granted');
 end if;

 if p_action='overview' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
   select z.id,z.zone_name,z.zone_type,z.sort_order,l.x,l.y,l.w,l.h,l.revision
   from public.client_site_zones z left join public.ywi_602_zone_layouts l on l.company_id=company and l.site_id=site and l.zone_id=z.id
   where z.client_site_id=site and z.is_active=true order by z.sort_order,z.id limit 101
  ) r;
  if jsonb_array_length(result)>100 then raise exception 'YW602 zone limit exceeded';end if;
  return jsonb_build_object('state','property_overview','company_id',company,'site_id',site,'access_role',actor_role,'zones',result,
  'work_orders',(select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from
    (select wo.id,wo.work_order_number,wo.status from public.work_orders wo
    where wo.company_id=company and wo.client_site_id=site and wo.client_id=client
    order by wo.created_at desc,wo.id limit 100) w),
  'customers',case when actor_role='owner' then (select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) from (select ci.id,ci.label,ci.expires_at,ci.revoked_at,a.access_role,a.expires_at as property_expires_at,a.revoked_at as property_revoked_at from public.ywi_602_customer_identities ci left join public.ywi_602_property_access a on a.company_id=company and a.site_id=site and a.user_id=ci.id where ci.company_id=company and ci.issued_by=owner_id order by ci.created_at desc limit 100) i) else '[]'::jsonb end,
  'changes',(select coalesce(jsonb_agg(to_jsonb(ch)),'[]'::jsonb) from (
   select r.id,r.zone_id,r.work_order_id,r.description,r.requested_at,
   q1.version,q1.scope,q1.quantity,q1.unit,
   case when actor_role in ('owner','payer') then q1.total_cents else null end as total_cents,
   q1.expires_at,(select h.change_order_id from public.ywi_602_change_handoffs h where h.request_id=r.id and actor_role='owner') as canonical_change_order_id,case when d1.decision='accept' then 'customer_accepted' when d1.decision='decline' then 'customer_declined'
   when q1.version is null then 'requested' when q1.expires_at<=now() then 'quote_expired' else 'awaiting_payer_approval' end as state
   from public.ywi_602_property_changes r
   left join lateral(select q2.* from public.ywi_602_change_quotes q2 where q2.request_id=r.id order by q2.version desc limit 1) q1 on true
   left join public.ywi_602_change_decisions d1 on d1.request_id=r.id and d1.version=q1.version
   where r.company_id=company and r.site_id=site order by r.requested_at desc,r.id limit 100
  ) ch),'billing_performed',false);
 end if;
 if p_action in ('layout','request') then
  zone:=(p_payload->>'zone_id')::uuid;
  if not exists(select 1 from public.client_site_zones z where z.id=zone and z.client_site_id=site and z.is_active=true)
  then raise exception 'YW602 zone authority required' using errcode='42501';end if;
 end if;
 if p_action='layout' then
  if actor_role<>'owner' then raise exception 'YW602 owner required' using errcode='42501';end if;
  v:=coalesce((p_payload->>'expected_revision')::integer,0);
  if coalesce((select l.revision from public.ywi_602_zone_layouts l where l.company_id=company and l.site_id=site and l.zone_id=zone),0)<>v then
  raise exception 'YW602 stale layout revision';end if;
  insert into public.ywi_602_zone_layouts(company_id,site_id,zone_id,x,y,w,h,revision,updated_by)
  values(company,site,zone,(p_payload->>'x')::integer,(p_payload->>'y')::integer,(p_payload->>'w')::integer,(p_payload->>'h')::integer,v+1,actor)
  on conflict(company_id,site_id,zone_id) do update set x=excluded.x,y=excluded.y,w=excluded.w,h=excluded.h,revision=excluded.revision,updated_by=actor,updated_at=now();
  return jsonb_build_object('state','layout_saved','revision',v+1);
 end if;
 if p_action='request' then
  work:=(p_payload->>'work_order_id')::uuid;nonce:=(p_payload->>'nonce')::uuid;body:=btrim(p_payload->>'description');
  if nonce is null or body is null or length(body) not between 8 and 1500 then raise exception 'YW602 description and operation reference required';end if;
  if not exists(select 1 from public.work_orders w where w.id=work and w.company_id=company and w.client_id=client and w.client_site_id=site)
  then raise exception 'YW602 work order authority required' using errcode='42501';end if;
  select * into req from public.ywi_602_property_changes r where r.company_id=company and r.site_id=site and r.requested_by=actor and r.requested_by_customer=(customer_company is not null) and r.request_nonce=nonce;
  if req.id is not null then
   if req.zone_id<>zone or req.work_order_id<>work or req.description<>body then raise exception 'YW602 operation reference conflict';end if;
   return jsonb_build_object('state','request_saved','request_id',req.id,'replayed',true);
  end if;
  insert into public.ywi_602_property_changes(company_id,site_id,zone_id,work_order_id,requested_by,requested_by_customer,request_nonce,description)
  values(company,site,zone,work,actor,customer_company is not null,nonce,body) returning * into req;
  return jsonb_build_object('state','request_saved','request_id',req.id,'replayed',false);
 end if;
 select * into req from public.ywi_602_property_changes r where r.id=(p_payload->>'request_id')::uuid and r.company_id=company and r.site_id=site;
 if req.id is null or not exists(select 1 from public.work_orders w where w.id=req.work_order_id and w.company_id=company and w.client_id=client and w.client_site_id=site)
 or not exists(select 1 from public.client_site_zones z where z.id=req.zone_id and z.client_site_id=site and z.is_active=true)
 then raise exception 'YW602 request authority required' using errcode='42501';end if;
 select * into q from public.ywi_602_change_quotes x where x.request_id=req.id order by x.version desc limit 1;
 v:=coalesce(q.version,0);
 if p_action='quote' then
  if actor_role<>'owner' then raise exception 'YW602 owner required' using errcode='42501';end if;
  if exists(select 1 from public.ywi_602_change_decisions x where x.request_id=req.id and x.decision='accept') then raise exception 'YW602 accepted scope is immutable';end if;
  if (p_payload->>'expected_version')::integer is distinct from v then raise exception 'YW602 stale quote revision';end if;
  exp:=(p_payload->>'expires_at')::timestamptz;
  if exp is null or exp<=now() or exp>now()+interval '30 days' then raise exception 'YW602 quote expiry required';end if;
  insert into public.ywi_602_change_quotes(request_id,version,scope,quantity,unit,total_cents,issued_by,expires_at)
  values(req.id,v+1,btrim(p_payload->>'scope'),(p_payload->>'quantity')::numeric,btrim(p_payload->>'unit'),(p_payload->>'total_cents')::bigint,actor,exp);
  return jsonb_build_object('state','quote_issued','version',v+1);
 end if;
 if p_action='handoff' then
  if actor_role<>'owner' or not exists(select 1 from public.profiles p where p.id=actor and p.is_active=true and lower(p.role) in ('site_leader','supervisor','hse','job_admin','admin')) or p_payload->>'confirmed' is distinct from 'true' then
   raise exception 'YW602 original field discovery authority and explicit owner confirmation required' using errcode='42501';end if;
  if v=0 or (p_payload->>'version')::integer is distinct from v then raise exception 'YW602 stale handoff version';end if;
  select * into d from public.ywi_602_change_decisions x where x.request_id=req.id and x.version=v and x.decision='accept';
  if d.request_id is null then raise exception 'YW602 accepted payer decision required';end if;
  select * into handoff from public.ywi_602_change_handoffs h where h.request_id=req.id;
  if handoff.request_id is not null then
   if handoff.version<>v or not exists(select 1 from public.change_orders ch where ch.id=handoff.change_order_id and ch.work_order_id=req.work_order_id) then raise exception 'YW602 canonical handoff mismatch';end if;
   return jsonb_build_object('state','handoff_saved','change_order_id',handoff.change_order_id,'replayed',true,'billing_performed',false);
  end if;
  -- Call the original discovery and evidence RPCs under the original actor rank.
  -- Canonical request remains pending review with zero cost/charge deltas.
  canonical:=public.ywi_rpc_change_order_discovery_save(jsonb_build_object('work_order_id',req.work_order_id,'field_discovery_summary',req.description,'scope_summary',q.scope,'reason','Customer portal accepted quote; office review and tax reconciliation required','notes','YW602 request '||req.id||' version '||v||'; zone '||req.zone_id||'; quantity '||q.quantity||' '||q.unit||'; accepted gross CAD cents '||q.total_cents),actor);
  if canonical.id is null or canonical.work_order_id is distinct from req.work_order_id or canonical.status<>'requested' or canonical.review_status<>'pending' or canonical.customer_authorization_status<>'not_requested' or canonical.scope_application_status<>'not_applied' then raise exception 'YW602 canonical draft mismatch';end if;
  perform public.ywi_rpc_change_order_evidence_save(jsonb_build_object('change_order_id',canonical.id,'evidence_type','customer_message','evidence_reference','YW602:'||req.id||':v'||v,'caption','Recorded independent private customer payer decision; exact accepted gross cents '||q.total_cents,'customer_safe',true,'captured_at',d.decided_at),actor);
  insert into public.ywi_602_change_handoffs(request_id,version,change_order_id,handed_by) values(req.id,v,canonical.id,actor);
  return jsonb_build_object('state','handoff_saved','change_order_id',canonical.id,'replayed',false,'billing_performed',false);
 end if;
 if p_action='decide' then
  if actor_role<>'payer' or customer_company is null or p_payload->>'confirmed' is distinct from 'true'
  then raise exception 'YW602 separate authorized payer required' using errcode='42501';end if;
  if v=0 or (p_payload->>'version')::integer is distinct from v then raise exception 'YW602 stale quote revision';end if;
  role_value:=p_payload->>'decision';
  if role_value is null or role_value not in ('accept','decline') then raise exception 'YW602 decision required';end if;
  select * into d from public.ywi_602_change_decisions x where x.request_id=req.id and x.version=v;
  if d.request_id is not null then
   if d.decided_by=actor and d.decision=role_value then return jsonb_build_object('state','decision_saved','replayed',true,'decision',d.decision,'version',v);end if;
   raise exception 'YW602 existing decision cannot be replaced';
  end if;
  if q.expires_at<=now() then raise exception 'YW602 quote expired';end if;
  insert into public.ywi_602_change_decisions(request_id,version,decision,decided_by) values(req.id,v,role_value,actor);
  return jsonb_build_object('state','decision_saved','replayed',false,'decision',role_value,'version',v,'billing_performed',false);
 end if;
 raise exception 'YW602 unknown action';
end;$fn$;
revoke all on function yw602_private.property_portal(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
-- Owner path requires an original staff identity; it can never impersonate a customer.
create function public.ywi_602_property_portal(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or coalesce((select auth.jwt())->>'is_anonymous','false')='true' or not exists(select 1 from public.profiles p where p.id=actor and p.is_active=true)
 then raise exception 'YW602 verified active company owner required' using errcode='42501';end if;
 return yw602_private.property_portal(actor,null,p_action,p_payload);
end;$fn$;
revoke all on function public.ywi_602_property_portal(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ywi_602_property_portal(text,jsonb) to authenticated;
-- No Supabase Auth user or JWT is issued to a customer. Only this narrow endpoint
-- accepts a private code; it can never run an owner action or query legacy staff APIs.
create function public.ywi_602_customer_portal(p_access_code text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare customer uuid; tenant uuid; answer jsonb;
begin
 if (select auth.uid()) is not null or p_access_code is null or p_access_code !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('list','overview','request','decide')
 then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 select i.id,i.company_id into customer,tenant from public.ywi_602_customer_identities i join public.ywi_companies c on c.id=i.company_id and c.owner_user_id=i.issued_by
 where exists(select 1 from public.profiles p where p.id=i.issued_by and p.is_active=true) and i.token_hash=extensions.digest(p_access_code,'sha256') and i.revoked_at is null and i.expires_at>now();
 if customer is null then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 -- Serialize rotation/revocation and writes, then recheck the exact credential.
 perform 1 from public.ywi_companies c where c.id=tenant for update;
 if not exists(select 1 from public.ywi_602_customer_identities i join public.ywi_companies c on c.id=i.company_id and c.owner_user_id=i.issued_by where i.id=customer and i.company_id=tenant and exists(select 1 from public.profiles p where p.id=i.issued_by and p.is_active=true) and i.token_hash=extensions.digest(p_access_code,'sha256') and i.revoked_at is null and i.expires_at>now())
 then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 answer:=yw602_private.property_portal(customer,tenant,p_action,p_payload);
 return answer||jsonb_build_object('customer_id',customer);
end;$fn$;
revoke all on function public.ywi_602_customer_portal(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ywi_602_customer_portal(text,text,jsonb) to anon;
commit;

 or p_action is null or p_action not in ('list','overview','request','decide')
 then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 select i.id,i.company_id into customer,tenant from public.ywi_602_customer_identities i join public.ywi_companies c on c.id=i.company_id and c.owner_user_id=i.issued_by
 where exists(select 1 from public.profiles p where p.id=i.issued_by and p.is_active=true) and i.token_hash=extensions.digest(p_access_code,'sha256') and i.revoked_at is null and i.expires_at>now();
 if customer is null then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 -- Serialize rotation/revocation and writes, then recheck the exact credential.
 perform 1 from public.ywi_companies c where c.id=tenant for update;
 if not exists(select 1 from public.ywi_602_customer_identities i join public.ywi_companies c on c.id=i.company_id and c.owner_user_id=i.issued_by where i.id=customer and i.company_id=tenant and exists(select 1 from public.profiles p where p.id=i.issued_by and p.is_active=true) and i.token_hash=extensions.digest(p_access_code,'sha256') and i.revoked_at is null and i.expires_at>now())
 then raise exception 'YW602 customer access denied' using errcode='42501';end if;
 answer:=yw602_private.property_portal(customer,tenant,p_action,p_payload);
 return answer||jsonb_build_object('customer_id',customer);
end;$fn$;
revoke all on function public.ywi_602_customer_portal(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ywi_602_customer_portal(text,text,jsonb) to anon;
commit;
