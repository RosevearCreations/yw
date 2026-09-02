#!/usr/bin/env node
/** Current repository-level hygiene and static sanity gate. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const results=[];
const add=(name,ok,details='')=>results.push({name,ok,details});
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
  const full=path.join(dir,entry.name);
  if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='playwright-report'||entry.name==='test-results') return [];
  return entry.isDirectory()?walk(full):[full];
});

const files=walk(root);
const rel=(file)=>path.relative(root,file).replaceAll('\\','/');
const activeMd=files.filter((file)=>file.endsWith('.md')).map(rel).sort();
const expectedMd=['README.md','docs/ACTIVE_PROJECT_HANDBOOK.md','docs/NEXT_STEPS_AND_SANITY_CHECK.md'];
add('active-markdown-exactly-three',JSON.stringify(activeMd)===JSON.stringify(expectedMd),`Active Markdown: ${activeMd.join(', ')||'none'}`);
add('no-archive-tree',!exists('archive'),'Git history is the archive; active archive/ must not return.');
add('no-retired-markdown-tree',!fs.readdirSync(root,{withFileTypes:true}).some((entry)=>entry.isDirectory()&&/^retired-markdown-/i.test(entry.name)),'Dated retired Markdown must not return to the active tree.');
add('no-test-write-artifacts',!files.some((file)=>/^test_write/i.test(path.basename(file))),'Temporary test_write artifacts are absent.');
add('no-backup-temp-artifacts',!files.some((file)=>/\.(?:tmp|bak|log)$/i.test(file)),'Temporary, backup and log artifacts are absent.');
add('no-generated-full-schema-snapshot',!exists('sql/000_full_schema_reference.sql'),'Numbered migrations are the schema source authority; stale generated full-schema snapshots stay out of the active tree.');

const readme=read('README.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const nextSteps=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
for(const [name,text] of [['README',readme],['Handbook',handbook],['Next steps',nextSteps]]){
  add(`${name.toLowerCase().replaceAll(' ','-')}-schema175`,text.includes('175')&&text.includes('I.T. Readiness'),`${name} records Schema 175 as the current verified authority and retains the Admin/I.T. boundary.`);
}
add('docs-build176-next',handbook.includes('Build 176')&&nextSteps.includes('Build 176')&&nextSteps.includes('items 5–8'),'Active authority advances the next bounded work to Build 176 items 5–8.');
add('docs-four-module-boundary',[readme,handbook,nextSteps].every((text)=>['Safety','Finance','Jobs','Admin'].every((key)=>text.includes(key))),'Active authority retains Safety, Finance, Jobs and Admin.');
add('docs-manual-production',[readme,handbook,nextSteps].every((text)=>/manual/i.test(text)&&/Production/i.test(text)),'Production promotion remains deliberate/manual.');
add('docs-posting-execution-closed',[readme,handbook,nextSteps].every((text)=>/posting execution/i.test(text)&&/(closed|not_released)/i.test(text)),'Schema 175 posting approval remains explicitly separate from execution authority.');

const sqlDir=path.join(root,'sql');
const sqlNames=fs.readdirSync(sqlDir).filter((name)=>/^\d{3}_.+\.sql$/i.test(name));
const versions=new Set(sqlNames.map((name)=>Number(name.slice(0,3))).filter((n)=>n>0));
const missing=[];
for(let n=30;n<=175;n++) if(!versions.has(n)) missing.push(n);
add('migration-range-030-through-175',missing.length===0&&versions.has(175),missing.length?`Missing migration numbers: ${missing.join(', ')}`:'Every schema number 030–175 is represented.');
add('schema174-migration-present',exists('sql/174_finance_work_order_identity_contract_convergence.sql'),'Schema 174 convergence migration is present.');
add('schema175-migration-present',exists('sql/175_finance_posting_safety_foundation.sql'),'Schema 175 posting-safety migration is present.');
const schema173=read('sql/173_finance_schema_dependency_contract_guard.sql');
const schema174=read('sql/174_finance_work_order_identity_contract_convergence.sql');
const schema175=read('sql/175_finance_posting_safety_foundation.sql');
add('schema173-history-preserved',schema173.includes("'completion_review_work_order'")&&schema173.includes("'bigint'"),'Schema 173 historical dependency assumption remains auditable.');
add('schema174-uuid-repair',schema174.includes("set expected_data_type='uuid'")&&schema174.includes("where contract_key='completion_review_work_order'"),'Schema 174 explicitly repairs the work-order identity contract to UUID.');
add('schema175-posting-execution-closed',schema175.includes("check (execution_status='not_released')")&&schema175.includes('posting execution remains closed'),'Schema 175 adds approval/idempotency/provenance while retaining fail-closed posting execution.');

const index=read('index.html');
add('homepage-one-h1',(index.match(/<h1\b/gi)||[]).length===1,`Homepage H1 count: ${(index.match(/<h1\b/gi)||[]).length}.`);
const config=read('supabase/config.toml');
add('protected-control-functions',/\[functions\.admin-it-control\]\s+verify_jwt = true/s.test(config)&&/\[functions\.core-data-read\]\s+verify_jwt = true/s.test(config)&&/\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config)&&/\[functions\.finance-job-completion-posting-approval\]\s+verify_jwt = true/s.test(config),'Core Admin/I.T., Shared Core, operations and Finance posting-approval functions retain JWT verification.');

const jsFiles=files.filter((file)=>/\.(?:js|mjs)$/i.test(file));
for(const file of jsFiles){
  const run=spawnSync(process.execPath,['--check',rel(file)],{cwd:root,encoding:'utf8'});
  add(`syntax:${rel(file)}`,run.status===0,run.status===0?'Syntax OK.':(run.stderr||run.stdout).trim());
}

const required=[
  '.github/workflows/staging-browser-integration.yml','package.json','package-lock.json','playwright.config.mjs',
  'scripts/module-permissions-check.mjs','scripts/admin-it-readiness-check.mjs','scripts/it-release-authority-check.mjs',
  'scripts/finance-schema-dependency-contract-check.mjs','scripts/finance-posting-safety-foundation-check.mjs',
  'supabase/functions/admin-it-control/index.ts','supabase/functions/finance-job-completion-posting-approval/index.ts',
  'supabase/functions/core-data-read/index.ts','supabase/functions/operations-manage/index.ts'
];
for(const file of required) add(`exists:${file}`,exists(file),'Required current release/control file is present.');

const passed=results.filter((item)=>item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for(const item of results) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`);
process.exit(results.some((item)=>!item.ok)?1:0);
