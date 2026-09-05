#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditRepository as auditDataApiAccess} from './data-api-explicit-access-check.mjs';
const root=process.cwd(); const results=[]; const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap((e)=>{const f=path.join(dir,e.name);if(['.git','node_modules','playwright-report','test-results'].includes(e.name))return[];return e.isDirectory()?walk(f):[f];});
const files=walk(root); const rel=(f)=>path.relative(root,f).replaceAll('\\','/');
const activeMd=files.filter((f)=>f.endsWith('.md')).map(rel).sort();
add('active-markdown-exactly-three',JSON.stringify(activeMd)===JSON.stringify(['README.md','docs/ACTIVE_PROJECT_HANDBOOK.md','docs/NEXT_STEPS_AND_SANITY_CHECK.md']),activeMd.join(', '));
add('no-archive-tree',!fs.existsSync('archive')); add('no-retired-markdown-tree',!files.some((f)=>/retired-markdown-/i.test(rel(f))));
add('no-temporary-artifacts',!files.some((f)=>/(?:^|\/)(?:test_write[^/]*|.*\.(?:tmp|bak|log))$/i.test(rel(f))));
add('no-one-time-workflows-after-bootstrap',!files.some((f)=>/^\.github\/workflows\/one-time-/i.test(rel(f))));
add('no-generated-full-schema-snapshot',!fs.existsSync('sql/000_full_schema_reference.sql'));
const docs=activeMd.map((f)=>fs.readFileSync(f,'utf8'));
add('active-docs-no-build-ledger',docs.every((t)=>!(/\bBuild\s+\d+\b/i.test(t)))); add('active-docs-no-run-or-sha-ledger',docs.every((t)=>!(/\bRun\s*#?\d+\b/i.test(t))&&!/\b[0-9a-f]{40}\b/i.test(t)));
add('docs-four-module-boundary',docs.every((t)=>['Safety','Finance','Jobs','Admin'].every((k)=>t.includes(k)))); add('docs-online-help',docs.every((t)=>/help\.html/i.test(t))); add('docs-manual-production',docs.every((t)=>/Production/i.test(t)&&/manual|deliberate/i.test(t))); add('docs-finance-provider-fail-closed',docs.every((t)=>/Finance/i.test(t)&&/provider/i.test(t)&&/(OFF|fail-closed)/i.test(t)));
const sqlNames=files.map(rel).filter((f)=>/^sql\/\d{3}_.+\.sql$/i.test(f)); const nums=sqlNames.map((f)=>Number(path.basename(f).slice(0,3))).filter(Number.isFinite).sort((a,b)=>a-b); const unique=[...new Set(nums)]; const missing=[]; if(unique.length){for(let n=30;n<=Math.max(...unique);n++)if(!unique.includes(n))missing.push(n);}
add('migration-history-contiguous',missing.length===0,missing.join(',')); add('migration-version-unique',unique.length===nums.length);
const migration203=fs.readFileSync('sql/203_auth_evidence_authorized_recording.sql','utf8');
const view203=(migration203.match(/create or replace view public\.v_it_auth_security_evidence_current[\s\S]*?from controls c\s*\nleft join latest l on l\.control_key=c\.control_key;/i)||[''])[0];
const pCurrent=view203.indexOf('end::text as current_status'); const pMessage=view203.indexOf('end::text as status_message'); const pChecked=view203.indexOf('now() as checked_at'); const pProject=view203.lastIndexOf('l.source_project_ref');
add('schema203-additive-view-column-order',pCurrent>=0&&pMessage>pCurrent&&pChecked>pMessage&&pProject>pChecked,'Schema 203 must preserve all Schema 202 columns through checked_at before appending traceability columns.');
const dataApiAudit=auditDataApiAccess(); add('future-data-api-access-explicit',dataApiAudit.ok,dataApiAudit.errors.join(' | '));
const definerAudit=spawnSync(process.execPath,['scripts/security-definer-execute-boundary-check.mjs'],{cwd:root,encoding:'utf8'});
add('security-definer-execute-boundary',definerAudit.status===0,(definerAudit.stderr||definerAudit.stdout||'').trim().slice(0,1200));
add('help-present',fs.existsSync('help.html')); add('seo-gate-present',fs.existsSync('scripts/help-seo-hygiene-check.mjs')); add('seo-browser-gate-present',fs.existsSync('tests/browser/help-seo-layout.spec.mjs'));
const passed=results.filter((x)=>x.ok).length; console.log(`Repository hygiene: ${passed}/${results.length} passed`); for(const r of results)console.log(`${r.ok?'PASS':'FAIL'}  ${r.name}${r.detail?' — '+r.detail:''}`); process.exit(passed===results.length?0:1);
