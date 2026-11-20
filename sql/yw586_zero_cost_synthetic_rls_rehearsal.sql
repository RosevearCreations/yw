-- YW586 self-contained zero-credential PostgreSQL fixture rehearsal.
-- Runs ONLY inside an ephemeral GitHub Actions Postgres container.
-- Synthetic UUIDs and content. NO Supabase connection, real customer, file,
-- service key, secret, screenshot, website publication or storage mutation.
-- This proves fixture RLS semantics, NOT that YW585/586 migrations run live.
\set ON_ERROR_STOP on
begin;
create schema yw586_fixture;
create role yw586_customer nologin;
create role yw586_owner nologin;
grant usage on schema yw586_fixture to yw586_customer,yw586_owner;

create table yw586_fixture.companies (
 id uuid primary key,owner_user_id uuid not null
);
create table yw586_fixture.original_links (
 company_id uuid not null,client_id uuid not null,site_id uuid not null,
 primary key(company_id,client_id,site_id)
);
create table yw586_fixture.memberships(
 company_id uuid not null,client_id uuid not null,actor_id uuid not null,
 state text not null check(state in ('active','revoked')),
 primary key(company_id,actor_id)
);
create table yw586_fixture.services(
 company_id uuid not null,service_key text not null,enabled boolean not null default false,
 primary key(company_id,service_key)
);
create table yw586_fixture.jobs(
 id uuid primary key,company_id uuid not null,client_id uuid not null,
 site_id uuid not null,service_key text not null,status text not null
);
create table yw586_fixture.photos(
 id uuid primary key,job_id uuid not null,company_id uuid not null,client_id uuid not null,
 private_storage boolean not null,consent_recorded boolean not null,
 server_hash_verified boolean not null
);
create table yw586_fixture.drafts(
 id uuid primary key,
 company_id uuid not null,client_id uuid not null,
 actor_id uuid not null default nullif(current_setting('app.actor_id',true),'')::uuid,
 service_key text not null,summary text not null
);
create table yw586_fixture.sites(
 company_id uuid primary key,title text not null,publication_state text not null
 check(publication_state='draft')
);

insert into yw586_fixture.companies values
 ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002');
insert into yw586_fixture.original_links values
 ('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002');
insert into yw586_fixture.memberships values
 ('a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','active'),
 ('b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','active');
insert into yw586_fixture.services values
 ('a0000000-0000-4000-8000-000000000001','landscape',true),
 ('a0000000-0000-4000-8000-000000000001','septic',false),
 ('b0000000-0000-4000-8000-000000000002','landscape',true);
insert into yw586_fixture.jobs values
 ('a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','landscape','in_progress'),
 ('b4000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','landscape','in_progress'),
 -- Deliberately orphaned company A job: wrong site despite same client.
 ('a4000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','landscape','in_progress');
insert into yw586_fixture.photos values
 ('a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',true,true,true),
 ('b5000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',true,false,true),
 ('a5000000-0000-4000-8000-000000000003','a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',true,true,false),
 ('a5000000-0000-4000-8000-000000000004','a4000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',true,true,true),
 ('a5000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',false,true,true);
insert into yw586_fixture.sites values
 ('a0000000-0000-4000-8000-000000000001','Company A private draft','draft'),
 ('b0000000-0000-4000-8000-000000000002','Company B private draft','draft');

alter table yw586_fixture.memberships enable row level security;
alter table yw586_fixture.jobs enable row level security;
alter table yw586_fixture.photos enable row level security;
alter table yw586_fixture.drafts enable row level security;
alter table yw586_fixture.sites enable row level security;
-- Table owner is postgres. Non-owner roles never receive BYPASSRLS.
revoke all on all tables in schema yw586_fixture from public,yw586_customer,yw586_owner;
grant select on yw586_fixture.memberships,yw586_fixture.jobs,
 yw586_fixture.photos to yw586_customer;
grant select on yw586_fixture.sites to yw586_owner;
grant insert(id,company_id,client_id,service_key,summary) on yw586_fixture.drafts to yw586_customer;
grant select on yw586_fixture.drafts to yw586_customer;

create policy customer_active_membership on yw586_fixture.memberships
 for select to yw586_customer using(
  actor_id=nullif(current_setting('app.actor_id',true),'')::uuid and state='active'
);
create policy original_job_link on yw586_fixture.jobs
 for select to yw586_customer using(
  exists(select 1 from yw586_fixture.memberships m
   where m.company_id=jobs.company_id and m.client_id=jobs.client_id
    and m.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid and m.state='active')
  and exists(select 1 from yw586_fixture.original_links l
   where l.company_id=jobs.company_id and l.client_id=jobs.client_id and l.site_id=jobs.site_id)
);
create policy consented_private_photo on yw586_fixture.photos
 for select to yw586_customer using(
  private_storage=true and consent_recorded=true and server_hash_verified=true
  and exists(select 1 from yw586_fixture.jobs j
   join yw586_fixture.original_links l on
    l.company_id=j.company_id and l.client_id=j.client_id and l.site_id=j.site_id
   join yw586_fixture.memberships m on
    m.company_id=j.company_id and m.client_id=j.client_id
   where j.id=photos.job_id and j.company_id=photos.company_id and j.client_id=photos.client_id
    and m.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid and m.state='active')
);
create policy customer_private_draft_read on yw586_fixture.drafts
 for select to yw586_customer using(
  actor_id=nullif(current_setting('app.actor_id',true),'')::uuid
  and exists(select 1 from yw586_fixture.memberships m
   where m.company_id=drafts.company_id and m.client_id=drafts.client_id
    and m.actor_id=actor_id and m.state='active')
);
create policy customer_private_draft_insert on yw586_fixture.drafts
 for insert to yw586_customer with check(
  actor_id=nullif(current_setting('app.actor_id',true),'')::uuid
  and exists(select 1 from yw586_fixture.memberships m
   where m.company_id=drafts.company_id and m.client_id=drafts.client_id
    and m.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid and m.state='active')
  and exists(select 1 from yw586_fixture.services s
   where s.company_id=drafts.company_id and s.service_key=drafts.service_key and s.enabled=true)
);
create policy owner_site_preview on yw586_fixture.sites
 for select to yw586_owner using(
  exists(select 1 from yw586_fixture.companies c
   where c.id=sites.company_id and c.owner_user_id=nullif(current_setting('app.actor_id',true),'')::uuid)
);
-- Privilege assertions: no self-enrollment, customer site publishing or photo uploads.
do $$
begin
 if has_table_privilege('yw586_customer','yw586_fixture.memberships','INSERT') or
    has_table_privilege('yw586_customer','yw586_fixture.memberships','UPDATE') or
    has_table_privilege('yw586_customer','yw586_fixture.sites','SELECT') or
    has_table_privilege('yw586_customer','yw586_fixture.jobs','INSERT') or
    has_table_privilege('yw586_customer','yw586_fixture.photos','INSERT')
 then raise exception 'YW586 fixture privilege boundary failed'; end if;
end $$;

-- Postgres RLS must deny cross-company, missing consent, invalid originals.
set local role yw586_customer;
set local app.actor_id='a3000000-0000-4000-8000-000000000001';
do $$
begin
 if (select count(*) from yw586_fixture.memberships)<>1 then raise exception 'customer A membership';end if;
 if (select count(*) from yw586_fixture.jobs)<>1 then raise exception 'customer A cross-company or orphan job';end if;
 if (select count(*) from yw586_fixture.photos)<>1 then raise exception 'customer A foreign, orphan, unverified or non-private photo';end if;
end $$;
insert into yw586_fixture.drafts(id,company_id,client_id,service_key,summary) values
 ('a6000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','landscape','Private mowing draft');
do $$
begin
 if (select count(*) from yw586_fixture.drafts)<>1 then raise exception 'private draft did not use RLS';end if;
 begin
  insert into yw586_fixture.drafts(id,company_id,client_id,service_key,summary) values
   ('a6000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','septic','Disabled service rejected');
  raise exception 'disabled service erroneously accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into yw586_fixture.drafts(id,company_id,client_id,service_key,summary) values
   ('a6000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','landscape','Cross-tenant draft rejected');
  raise exception 'cross tenant draft erroneously accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
set local app.actor_id='b3000000-0000-4000-8000-000000000002';
do $$
begin
 if (select count(*) from yw586_fixture.memberships)<>1 then raise exception 'customer B membership';end if;
 if (select count(*) from yw586_fixture.jobs)<>1 then raise exception 'customer B job';end if;
 if (select count(*) from yw586_fixture.photos)<>0 then raise exception 'customer B photo without consent';end if;
 if (select count(*) from yw586_fixture.drafts)<>0 then raise exception 'customer B sees A draft';end if;
end $$;
set local app.actor_id='e3000000-0000-4000-8000-000000000003';
do $$
begin
 if (select count(*) from yw586_fixture.memberships)<>0 or
    (select count(*) from yw586_fixture.jobs)<>0 or
    (select count(*) from yw586_fixture.photos)<>0
 then raise exception 'unlinked actor accessed original CRM job/photo';end if;
end $$;
reset role;
set local role yw586_owner;
set local app.actor_id='c0000000-0000-4000-8000-000000000001';
do $$
begin
 if (select count(*) from yw586_fixture.sites)<>1 then
  raise exception 'tenant owner saw foreign website draft';end if;
end $$;
set local app.actor_id='e3000000-0000-4000-8000-000000000003';
do $$
begin
 if (select count(*) from yw586_fixture.sites)<>0 then
  raise exception 'non-owner saw private website draft';end if;
end $$;
reset role;
-- Revoke original customer membership and prove RLS erases all prior views.
update yw586_fixture.memberships set state='revoked'
 where actor_id='a3000000-0000-4000-8000-000000000001';
set local role yw586_customer;
set local app.actor_id='a3000000-0000-4000-8000-000000000001';
do $$
begin
 if (select count(*) from yw586_fixture.memberships)<>0 or
    (select count(*) from yw586_fixture.jobs)<>0 or
    (select count(*) from yw586_fixture.photos)<>0 or
    (select count(*) from yw586_fixture.drafts)<>0 then
  raise exception 'revoked customer retained access';end if;
end $$;
reset role;
-- Zero persistence: fixtures and test roles are discarded.
rollback;
\echo 'YW586 ZERO-COST SYNTHETIC POSTGRES RLS REHEARSAL PASS (not live Supabase acceptance)'
