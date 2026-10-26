import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,foreignCompanyId,serviceKeys} from '../tests/fixtures/pms-owner-first-use-455.mjs';
const read=p=>readFileSync(p,'utf8');
const source=read('js/pms-owner-first-use-455.js');new Function(source);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(source,context);
const {keys,checkpoints,inspectIntake}=context.window.YWI455;
assert.deepEqual([...keys],[...serviceKeys]);assert.equal(checkpoints.length,5);
const now=Date.now(),good=fixture({now});
const args={companyId,enabled:['landscape','snow_removal','septic'],now};
const result=inspectIntake(good.journal,args);
assert.equal(result.state,'source_verified');assert.equal(result.fieldAccepted,false);
assert.equal(result.releaseGreen,false);assert.equal(result.evidenceCount,1);
assert.equal(inspectIntake(fixture({now,withEvidence:false}).journal,args).state,'source_verified');
const bad=(change)=>{const obj=fixture({now}).journal;change(obj);return inspectIntake(obj,args).state;};
for(const [name,change] of [
 ['other company',x=>x.company_id=foreignCompanyId],
 ['foreign switch',x=>x.services[0].company_id=foreignCompanyId],
 ['missing switch',x=>x.services.pop()],
 ['duplicate switch',x=>x.services[0].module_key=x.services[1].module_key],
 ['toggle mismatch',x=>x.services[0].enabled=!x.services[0].enabled],
 ['foreign approval claim',x=>x.owner_field_accepted=true],
 ['false release claim',x=>x.release_green=true],
 ['outbound action',x=>x.outbound_actions=true],
 ['missing owner guard',x=>x.owner_guard='unverified'],
 ['synthetic source',x=>x.synthetic=true],
 ['stale snapshot',x=>x.captured_at=new Date(now-360000).toISOString()],
 ['future snapshot',x=>x.captured_at=new Date(now+120000).toISOString()],
 ['malformed evidence',x=>x.entries[0].id='invalid'],
 ['bad checkpoint',x=>x.entries[0].checkpoint='approved'],
 ['mispaired module',x=>x.entries[0].observed_enabled=null],
 ['unscoped note',x=>x.entries[0].module_key=foreignCompanyId],
 ['bad evidence count',x=>x.evidence_total=0],
 ['foreign sampling claim',x=>x.evidence_sample_capped=true],
 ['duplicate source',x=>x.entries.push({...x.entries[0]})],
 ['unbounded sample',x=>x.entries=Array.from({length:61},()=>({...x.entries[0]}))]
])assert.equal(bad(change),'withheld',name);
assert.equal(inspectIntake(good.journal,{...args,companyId:foreignCompanyId}).state,'withheld');
const sql=read('sql/pms_owner_first_use_455.sql');
for(const token of ['enable row level security','revoke all on public.ywi_owner_first_use_entries_455',
 'ywi_422_assert_owner','ywi_422_assert_jobs_create','ywi_company_service_modules',
 'for share','ywi_company_site_links_422','ywi_new_work_gate_receipts_421',
 'security definer set search_path','on conflict(company_id,request_id) do nothing',
 'grant execute on function public.ywi_rpc_append_owner_first_use_455','owner_field_accepted',
 'approval_granted','outbound_actions'])assert.ok(sql.includes(token),token);
assert.ok(!/grant\s+(insert|update|delete)\s+on\s+public\.ywi_owner_first_use_entries_455\s+to\s+authenticated/i.test(sql));
for(const token of ['YWI454.inspect','YWI454?.rosterOwned','auth.getUser',
 'ywi_rpc_pms_navigation_443','ywi_rpc_owner_first_use_455','ywi_rpc_append_owner_first_use_455',
 'pms455Append','ywi:company-service-offering-changed','window.confirm','crypto?.randomUUID'])
 assert.ok(source.includes(token),token);
assert.ok(read('index.html').includes('js/pms-owner-first-use-455.js'));
assert.ok(read('help.html').includes('id="pms-owner-first-use-455"'));
assert.ok(read('style.css').includes('.pms455-actions'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 455 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-owner-first-use-455','test:browser:pms-owner-first-use-455']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 455: owner-bound first-company steps, seven-module parity, append-only source ledger, HOLD boundaries and CI wiring: PASS');
