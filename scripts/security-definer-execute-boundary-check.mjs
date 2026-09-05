#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SQL_DIR=path.join(ROOT,'sql');
const BOUNDARY_SCHEMA=206;
const FUTURE_SCHEMA=207;
const boundaryFile=path.join(SQL_DIR,'206_security_definer_execute_boundary.sql');
const boundary=fs.readFileSync(boundaryFile,'utf8').toLowerCase().replace(/\s+/g,' ');
const errors=[];
const requiredTargets=[
  'directory_scope(text)',
  'dispatch_due_report_delivery_scheduler_runs()',
  'dispatch_due_service_execution_scheduler_runs()',
  'handle_new_user_profile()',
  'handle_new_user()',
  'ywi_assert_period_open(date,text)',
  'ywi_create_balanced_journal(uuid,uuid,text,date,text,jsonb)',
  'ywi_find_gl_account(text[])',
  'ywi_normalized_profile_role(uuid)',
  'ywi_profile_rank(uuid)',
  'ywi_refresh_stripe_webhook_alerts()',
  'ywi_require_rpc_rank(uuid,integer,text)',
];

function mustContain(text,needle,label){
  if(!text.includes(needle))errors.push(`${label}: missing ${needle}`);
}

mustContain(boundary,'alter default privileges for role postgres in schema public revoke execute on functions from public;','Schema 206');
mustContain(boundary,'alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;','Schema 206');
mustContain(boundary,'alter function public.directory_scope(text) security invoker;','Schema 206');
mustContain(boundary,'set search_path = public, net, cron, pg_catalog;','Schema 206 scheduler path');
mustContain(boundary,'create or replace view public.v_it_security_definer_execute_boundary','Schema 206 authority view');
mustContain(boundary,'create or replace function public.ywi_security_definer_execute_boundary_assertions()','Schema 206 assertions');
mustContain(boundary,'206 as expected_schema_version','Schema 206 schema marker');

for(const signature of requiredTargets){
  mustContain(boundary,`revoke execute on function public.${signature} from public, anon, authenticated;`,`Schema 206 ${signature}`);
  mustContain(boundary,`grant execute on function public.${signature} to service_role;`,`Schema 206 ${signature}`);
}

function schemaNumber(name){
  const m=/^(\d+)[a-z]?[_-]/i.exec(name);
  return m?Number.parseInt(m[1],10):null;
}

function normalize(text){
  return text.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--.*$/gm,' ').replace(/\s+/g,' ').trim().toLowerCase();
}

function auditFutureDefiners(sql,file){
  const source=normalize(sql);
  const headerRe=/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_$]*)\s*\([\s\S]*?\)\s*(?:returns[\s\S]*?)?security\s+definer([\s\S]*?)as\s+\$[a-z0-9_]*\$/g;
  for(const match of source.matchAll(headerRe)){
    const name=match[1];
    const between=match[2]||'';
    if(!/set\s+search_path\s*(?:=|to)\s*/.test(between)){
      errors.push(`${file}: SECURITY DEFINER public.${name} must pin search_path in the function declaration.`);
    }
    const revokeRe=new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]*\\)\\s+from\\s+([^;]+);`,'i');
    const grantRe=new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\([^;]*\\)\\s+to\\s+([^;]+);`,'i');
    const revokes=[...source.matchAll(new RegExp(revokeRe.source,'gi'))].map((m)=>m[1]);
    const grants=[...source.matchAll(new RegExp(grantRe.source,'gi'))].map((m)=>m[1]);
    const decided=(role)=>revokes.some((x)=>new RegExp(`(?:^|[,\\s])${role}(?:$|[,\\s])`,'i').test(x))||grants.some((x)=>new RegExp(`(?:^|[,\\s])${role}(?:$|[,\\s])`,'i').test(x));
    if(!revokes.some((x)=>/(?:^|[,\s])public(?:$|[,\s])/i.test(x)))errors.push(`${file}: public.${name} must explicitly revoke PUBLIC EXECUTE.`);
    for(const role of ['anon','authenticated','service_role'])if(!decided(role))errors.push(`${file}: public.${name} must explicitly decide ${role} EXECUTE.`);
    if(grants.some((x)=>/(?:^|[,\s])public(?:$|[,\s])/i.test(x)))errors.push(`${file}: public.${name} must not grant PUBLIC EXECUTE.`);
  }
}

const files=fs.readdirSync(SQL_DIR).filter((name)=>name.endsWith('.sql')).sort();
for(const file of files){
  const schema=schemaNumber(file);
  if(Number.isInteger(schema)&&schema>=FUTURE_SCHEMA)auditFutureDefiners(fs.readFileSync(path.join(SQL_DIR,file),'utf8'),file);
}

// Synthetic future-regression proof: secure pattern passes; missing search_path and missing
// role decisions must fail. Keep this isolated from the repository error list.
function syntheticErrors(sql){
  const prior=errors.length;
  auditFutureDefiners(sql,'207_synthetic.sql');
  return errors.splice(prior);
}
const good=syntheticErrors(`
  create function public.synthetic_secure() returns void language plpgsql security definer set search_path='' as $$ begin null; end $$;
  revoke execute on function public.synthetic_secure() from public,anon,authenticated;
  grant execute on function public.synthetic_secure() to service_role;
`);
if(good.length)errors.push(`Synthetic secure SECURITY DEFINER contract unexpectedly failed: ${good.join(' | ')}`);
const badPath=syntheticErrors(`
  create function public.synthetic_bad_path() returns void language plpgsql security definer as $$ begin null; end $$;
  revoke execute on function public.synthetic_bad_path() from public,anon,authenticated;
  grant execute on function public.synthetic_bad_path() to service_role;
`);
if(!badPath.some((x)=>x.includes('pin search_path')))errors.push('Synthetic missing-search_path contract did not fail closed.');
const badDecision=syntheticErrors(`
  create function public.synthetic_bad_role() returns void language plpgsql security definer set search_path='' as $$ begin null; end $$;
  revoke execute on function public.synthetic_bad_role() from public;
  grant execute on function public.synthetic_bad_role() to service_role;
`);
if(!badDecision.some((x)=>x.includes('anon EXECUTE'))||!badDecision.some((x)=>x.includes('authenticated EXECUTE')))errors.push('Synthetic missing-client-role decisions did not fail closed.');

console.log(JSON.stringify({
  ok:errors.length===0,
  boundary_schema:BOUNDARY_SCHEMA,
  future_enforcement_schema:FUTURE_SCHEMA,
  reviewed_target_count:requiredTargets.length,
  errors,
},null,2));
if(errors.length){
  console.error('\nSECURITY DEFINER EXECUTE BOUNDARY: LOCKED');
  for(const error of errors)console.error(`- ${error}`);
  process.exit(1);
}
console.log('\nSECURITY DEFINER EXECUTE BOUNDARY: GREEN');
