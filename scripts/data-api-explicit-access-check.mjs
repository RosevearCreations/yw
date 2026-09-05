#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SQL_DIR=path.join(ROOT,'sql');
const MIN_ENFORCED_SCHEMA=206;

const normalize=(text)=>text
  .replace(/\/\*[\s\S]*?\*\//g,' ')
  .replace(/--.*$/gm,' ')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();

const escapeRe=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function schemaNumber(fileName){
  const match=/^(\d+)[a-z]?[_-]/i.exec(fileName);
  return match ? Number.parseInt(match[1],10) : null;
}

export function inspectMigrationAccess(sql,fileName='synthetic_206.sql'){
  const schema=schemaNumber(fileName);
  if(!Number.isInteger(schema) || schema<MIN_ENFORCED_SCHEMA){
    return {schema,checked:false,tables:[],errors:[]};
  }

  const source=normalize(sql);
  const tableNames=[];
  const createRe=/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_$]*)/g;
  for(const match of source.matchAll(createRe))tableNames.push(match[1]);
  const tables=[...new Set(tableNames)];
  const errors=[];

  for(const table of tables){
    const t=escapeRe(table);
    const rlsRe=new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${t}\\s+enable\\s+row\\s+level\\s+security`,'i');
    const explicitGrantRe=new RegExp(`grant\\s+(?!all\\b)[^;]+\\s+on\\s+table\\s+public\\.${t}\\s+to\\s+[^;]*(?:service_role|anon|authenticated)`,'i');
    const anonDecisionRe=new RegExp(`(?:grant|revoke)\\s+[^;]+\\s+on\\s+table\\s+public\\.${t}\\s+(?:to|from)\\s+[^;]*\\banon\\b`,'i');
    const authenticatedDecisionRe=new RegExp(`(?:grant|revoke)\\s+[^;]+\\s+on\\s+table\\s+public\\.${t}\\s+(?:to|from)\\s+[^;]*\\bauthenticated\\b`,'i');
    const broadClientGrantRe=new RegExp(`grant\\s+all(?:\\s+privileges)?\\s+on\\s+table\\s+public\\.${t}\\s+to\\s+[^;]*(?:anon|authenticated)`,'i');

    if(!rlsRe.test(source))errors.push(`${fileName}: public.${table} must enable row level security in the creating migration.`);
    if(!explicitGrantRe.test(source))errors.push(`${fileName}: public.${table} must declare at least one explicit least-privilege table GRANT for service_role/anon/authenticated.`);
    if(!anonDecisionRe.test(source))errors.push(`${fileName}: public.${table} must explicitly GRANT or REVOKE anon access in the creating migration.`);
    if(!authenticatedDecisionRe.test(source))errors.push(`${fileName}: public.${table} must explicitly GRANT or REVOKE authenticated access in the creating migration.`);
    if(broadClientGrantRe.test(source))errors.push(`${fileName}: public.${table} must not GRANT ALL table privileges to anon/authenticated; declare only the required privileges.`);
  }

  return {schema,checked:true,tables,errors};
}

function runParserRegression(){
  const validPrivate=`
    create table public.example_private(id bigint primary key);
    alter table public.example_private enable row level security;
    revoke all on table public.example_private from public,anon,authenticated,service_role;
    grant select,insert on table public.example_private to service_role;
  `;
  const validClient=`
    create table if not exists public.example_client(id bigint primary key,user_id uuid not null);
    alter table public.example_client enable row level security;
    revoke all on table public.example_client from public,anon,authenticated,service_role;
    grant select,insert on table public.example_client to authenticated;
    grant select on table public.example_client to service_role;
  `;
  const missingRls=`
    create table public.bad_no_rls(id bigint primary key);
    revoke all on table public.bad_no_rls from public,anon,authenticated,service_role;
    grant select on table public.bad_no_rls to service_role;
  `;
  const implicitOnly=`
    create table public.bad_implicit(id bigint primary key);
    alter table public.bad_implicit enable row level security;
  `;
  const missingAnonDecision=`
    create table public.bad_missing_anon(id bigint primary key);
    alter table public.bad_missing_anon enable row level security;
    revoke all on table public.bad_missing_anon from public,authenticated,service_role;
    grant select on table public.bad_missing_anon to service_role;
  `;
  const broadGrant=`
    create table public.bad_all(id bigint primary key);
    alter table public.bad_all enable row level security;
    revoke all on table public.bad_all from public,anon,authenticated,service_role;
    grant all on table public.bad_all to authenticated;
    grant select on table public.bad_all to service_role;
  `;

  const assertions=[
    ['private-contract-passes',inspectMigrationAccess(validPrivate,'206_private.sql').errors.length===0],
    ['client-contract-passes',inspectMigrationAccess(validClient,'206_client.sql').errors.length===0],
    ['missing-rls-fails',inspectMigrationAccess(missingRls,'206_bad.sql').errors.some((x)=>x.includes('row level security'))],
    ['implicit-access-fails',inspectMigrationAccess(implicitOnly,'206_bad.sql').errors.some((x)=>x.includes('explicit least-privilege'))],
    ['missing-anon-decision-fails',inspectMigrationAccess(missingAnonDecision,'206_bad.sql').errors.some((x)=>x.includes('anon access'))],
    ['grant-all-client-fails',inspectMigrationAccess(broadGrant,'206_bad.sql').errors.some((x)=>x.includes('must not GRANT ALL'))],
    ['historical-files-are-baseline-only',inspectMigrationAccess('create table public.legacy(id int);','205_legacy.sql').checked===false],
  ];
  const failed=assertions.filter(([,ok])=>!ok).map(([name])=>name);
  if(failed.length)throw new Error(`Data API access parser regression failed: ${failed.join(', ')}`);
}

export function auditRepository(){
  runParserRegression();
  const files=fs.readdirSync(SQL_DIR).filter((name)=>name.endsWith('.sql')).sort();
  const inspected=[];
  const errors=[];
  for(const file of files){
    const sql=fs.readFileSync(path.join(SQL_DIR,file),'utf8');
    const result=inspectMigrationAccess(sql,file);
    if(result.checked && result.tables.length)inspected.push({file,schema:result.schema,tables:result.tables});
    errors.push(...result.errors);
  }
  return {ok:errors.length===0,min_enforced_schema:MIN_ENFORCED_SCHEMA,inspected,errors};
}

function main(){
  const result=auditRepository();
  console.log(JSON.stringify({
    ok:result.ok,
    min_enforced_schema:result.min_enforced_schema,
    migration_count_with_new_public_tables:result.inspected.length,
    public_tables_checked:result.inspected.reduce((sum,item)=>sum+item.tables.length,0),
    errors:result.errors,
  },null,2));
  if(!result.ok){
    console.error('\nDATA API EXPLICIT ACCESS PREFLIGHT: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nDATA API EXPLICIT ACCESS PREFLIGHT: GREEN');
  console.log(`Every public table created in Schema ${MIN_ENFORCED_SCHEMA}+ must declare RLS plus explicit least-privilege Data API grants/revokes for both anon and authenticated roles in the creating migration.`);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
