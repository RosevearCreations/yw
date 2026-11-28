-- Disposable PostgreSQL only; never use a linked project or production data.
\set ON_ERROR_STOP on
do $$begin
 if current_database()<>'yw602_ci' or to_regclass('public.ywi_companies') is not null then raise exception 'empty YW602 isolated database required';end if;
end$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
grant usage on schema auth to authenticated;
create table public.profiles(id uuid primary key,is_active boolean not null);
create table public.ywi_companies(id uuid primary key,name text not null,owner_user_id uuid not null references public.profiles,created_at timestamptz default now());
create table public.ywi_company_service_modules(company_id uuid,module_key text,enabled boolean);
create table public.client_sites(id uuid primary key,client_id uuid not null,site_name text,is_active boolean);
create table public.client_site_zones(id uuid primary key,client_site_id uuid,zone_name text,zone_type text,sort_order integer,is_active boolean);
create table public.work_orders(id uuid primary key,company_id uuid,client_id uuid,client_site_id uuid,work_order_number text,status text,created_at timestamptz default now());
create table public.ywi_company_site_links_422(company_id uuid,client_id uuid,client_site_id uuid,primary key(company_id,client_site_id));
create table public.ywi_company_client_links_422(company_id uuid,client_id uuid,primary key(company_id,client_id));
create function public.ywi_is_platform_administrator_489() returns boolean language sql stable as $$select auth.uid()='00000000-0000-4000-8000-000000000006'::uuid$$;
\ir ../sql/yw602_property_portal.sql
begin;
create function public.fixture_id(n integer) returns uuid language sql immutable as $$select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
grant execute on function public.fixture_id(integer) to authenticated;
insert into public.profiles select public.fixture_id(i),true from generate_series(1,7) i;
insert into public.ywi_companies(id,name,owner_user_id) values(public.fixture_id(10),'Fixture A',public.fixture_id(1)),(public.fixture_id(11),'Fixture B',public.fixture_id(5));
insert into public.ywi_company_service_modules values(public.fixture_id(10),'landscaping',true),(public.fixture_id(11),'snow',false);
insert into public.client_sites values(public.fixture_id(20),public.fixture_id(30),'Fixture A property',true),(public.fixture_id(21),public.fixture_id(31),'Fixture B property',true);
insert into public.client_site_zones values(public.fixture_id(40),public.fixture_id(20),'North bed','garden',1,true),(public.fixture_id(41),public.fixture_id(21),'Foreign bed','garden',1,true);
insert into public.ywi_company_client_links_422 values(public.fixture_id(10),public.fixture_id(30)),(public.fixture_id(11),public.fixture_id(31));
insert into public.ywi_company_site_links_422 values(public.fixture_id(10),public.fixture_id(30),public.fixture_id(20)),(public.fixture_id(11),public.fixture_id(31),public.fixture_id(21));
insert into public.work_orders(id,company_id,client_id,client_site_id,work_order_number,status) values(public.fixture_id(50),public.fixture_id(10),public.fixture_id(30),public.fixture_id(20),'FIX-A','scheduled'),(public.fixture_id(51),public.fixture_id(11),public.fixture_id(31),public.fixture_id(21),'FIX-B','scheduled');
do $$declare t record;begin
 if (select count(*) from pg_class where relname like 'ywi_602_%' and relkind='r' and relrowsecurity)<>5 then raise exception 'five RLS tables required';end if;
 for t in select oid,relname from pg_class where relname like 'ywi_602_%' and relkind='r' loop
  if has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role',t.oid,'INSERT,UPDATE,DELETE') then raise exception 'incorrect private grants: %',t.relname;end if;
 end loop;
 if has_function_privilege('anon','public.ywi_602_property_portal(text,jsonb)','EXECUTE') or not has_function_privilege('authenticated','public.ywi_602_property_portal(text,jsonb)','EXECUTE') then raise exception 'incorrect RPC grants';end if;
end$$;
set local role authenticated;
do $$declare
 c uuid:=public.fixture_id(10);s uuid:=public.fixture_id(20);z uuid:=public.fixture_id(40);w uuid:=public.fixture_id(50);
 p jsonb:=jsonb_build_object('company_id',c,'site_id',s);r jsonb;req uuid; denied boolean;who integer;bad jsonb;
begin
 perform set_config('request.jwt.claim.sub',public.fixture_id(6)::text,true);
 if (select count(*) from public.ywi_platform_company_directory_489())<>2 or exists(select 1 from public.ywi_platform_company_directory_489() where owner_user_id is not null or owner_email is not null) then raise exception 'Shell directory disclosure or count';end if;
 if jsonb_array_length(public.ywi_602_property_portal('list','{}')->'properties')<>0 then raise exception 'Sysop inherited property access';end if;
 denied:=false;begin perform public.ywi_602_property_portal('overview',p);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Sysop foreign property access';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(1)::text,true);
 if jsonb_array_length(public.ywi_602_property_portal('list','{}')->'properties')<>1 then raise exception 'owner scope';end if;
 for who in 2..4 loop
  perform public.ywi_602_property_portal('grant',p||jsonb_build_object('user_id',public.fixture_id(who),'access_role',case who when 2 then 'manager' when 3 then 'payer' else 'resident' end,'confirmed',true,'expires_at',now()+interval '1 day'));
 end loop;
 r:=public.ywi_602_property_portal('layout',p||jsonb_build_object('zone_id',z,'x',100,'y',200,'w',4000,'h',2000,'expected_revision',0));
 if r->>'state'<>'layout_saved' then raise exception 'layout failed';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(2)::text,true);
 r:=public.ywi_602_property_portal('overview',p);
 if r->>'access_role'<>'manager' or r->'zones'->0->>'zone_name'<>'North bed' or r->'zones'->0->>'x'<>'100' then raise exception 'map authority failed';end if;
 bad:=p||jsonb_build_object('zone_id',public.fixture_id(41),'work_order_id',w,'description','Mulch north bed','nonce',public.fixture_id(60));
 denied:=false;begin perform public.ywi_602_property_portal('request',bad);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'foreign zone accepted';end if;
 bad:=p||jsonb_build_object('zone_id',z,'work_order_id',public.fixture_id(51),'description','Mulch north bed','nonce',public.fixture_id(60));
 denied:=false;begin perform public.ywi_602_property_portal('request',bad);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'foreign job accepted';end if;
 bad:=p||jsonb_build_object('zone_id',z,'work_order_id',w,'description','Mulch north bed','nonce',public.fixture_id(60));
 r:=public.ywi_602_property_portal('request',bad);req:=(r->>'request_id')::uuid;
 r:=public.ywi_602_property_portal('request',bad);if (r->>'request_id')::uuid<>req or r->>'replayed'<>'true' then raise exception 'duplicate request';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(1)::text,true);
 bad:=p||jsonb_build_object('request_id',req,'scope','Supply and spread mulch','quantity',2,'unit','cubic yards','total_cents',6000,'expires_at',now()+interval '1 day');
 r:=public.ywi_602_property_portal('quote',bad||jsonb_build_object('expected_version',0));if r->>'version'<>'1' then raise exception 'first quote';end if;
 r:=public.ywi_602_property_portal('quote',bad||jsonb_build_object('expected_version',1,'total_cents',7000));if r->>'version'<>'2' then raise exception 'quote revision';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(4)::text,true);
 r:=public.ywi_602_property_portal('overview',p);if r->'changes'->0->>'total_cents' is not null then raise exception 'resident pricing leak';end if;
 bad:=p||jsonb_build_object('request_id',req,'version',2,'decision','accept','confirmed',true);
 denied:=false;begin perform public.ywi_602_property_portal('decide',bad);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'resident approved cost';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(3)::text,true);
 r:=public.ywi_602_property_portal('overview',p);if r->'changes'->0->>'total_cents'<>'7000' then raise exception 'payer price missing';end if;
 denied:=false;begin perform public.ywi_602_property_portal('decide',bad||jsonb_build_object('version',1));exception when others then denied:=true;end;if not denied then raise exception 'stale quote approved';end if;
 r:=public.ywi_602_property_portal('decide',bad);if r->>'decision'<>'accept' or r->>'billing_performed'<>'false' then raise exception 'payer decision';end if;
 r:=public.ywi_602_property_portal('decide',bad);if r->>'replayed'<>'true' then raise exception 'duplicate decision';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(1)::text,true);
 perform public.ywi_602_property_portal('revoke',p||jsonb_build_object('user_id',public.fixture_id(3)));
 perform set_config('request.jwt.claim.sub',public.fixture_id(3)::text,true);
 if jsonb_array_length(public.ywi_602_property_portal('list','{}')->'properties')<>0 then raise exception 'revoked access persists';end if;
 denied:=false;begin perform public.ywi_602_property_portal('overview',p);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'revoked access not denied';end if;
 perform set_config('request.jwt.claim.sub',public.fixture_id(5)::text,true);
 denied:=false;begin perform public.ywi_602_property_portal('overview',p);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'foreign owner read';end if;
end$$;
reset role;
do $$begin
 if (select count(*) from public.ywi_602_property_changes)<>1 or (select count(*) from public.ywi_602_change_quotes)<>2 or (select count(*) from public.ywi_602_change_decisions)<>1 then raise exception 'durable duplicate prevention failed';end if;
end$$;
rollback;
select 'YW602 isolated property, Shell redaction, role, tenant, map, quote-version and replay checks passed' as result;
