-- YW574 READ-ONLY CATALOG INSPECTION EXAMPLES — DO NOT RUN AS MIGRATION.
-- SELECT ONLY. Capture independently for staging and production and compare manually.
-- Neither this file nor its results authorize SQL writes, schema repair or Master ACK.

-- 1. Existing Supabase migration history is an observation, not source-hash parity:
select version, name
from supabase_migrations.schema_migrations
where name ~ '(556|557|558|559|560|561|562|563|564|565|566|567|572|573)'
order by version, name;

-- 2. Independent schema-object and RLS evidence:
select n.nspname as schema_name, c.relname as object_name,
       c.relkind, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('ywi_security_572','ywi_security_573')
   or (n.nspname='public' and (
     c.relname like '%landscape%' or c.relname like '%provider%'
     or c.relname like '%master%'))
order by n.nspname,c.relname;

-- 3. Mandatory private custody relationship presence is separately checked:
select
 to_regclass('ywi_security_572.replay_custody') is not null as custody_572_present,
 to_regclass('ywi_security_573.original_disposition') is not null as disposition_573_present;

-- 4. Check private schemas are not automatically exposed to client roles:
select n.nspname as schema_name,
       has_schema_privilege('anon',n.oid,'USAGE') as anon_usage,
       has_schema_privilege('authenticated',n.oid,'USAGE') as authenticated_usage
from pg_namespace n
where n.nspname in ('ywi_security_572','ywi_security_573')
order by n.nspname;

-- 5. Check grants on the two required tables without touching user data:
select n.nspname as schema_name, c.relname as table_name,
       has_table_privilege('anon',c.oid,'SELECT') as anon_select,
       has_table_privilege('anon',c.oid,'INSERT') as anon_insert,
       has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
       has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('ywi_security_572','ywi_security_573')
  and c.relname in ('replay_custody','original_disposition')
order by n.nspname,c.relname;

-- 6. Source provenance requirements that these queries CANNOT prove:
-- exact reviewed SHA-256 per SQL file; approved migration ordering; independent
-- original staging registration; real PITR/backup restore; signed owner/custodian
-- fingerprints; RLS/worker admission outcomes; authorized production decision.
