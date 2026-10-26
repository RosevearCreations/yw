import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,ownerId,foreignCompanyId} from '../tests/fixtures/pms-reassessment-followup-461.mjs';
const read=x=>readFileSync(x,'utf8');
const prev=read('js/pms-reassessment-followup-461.js'),src=read('js/pms-evidence-outcomes-462.js');
const sandbox={window:{},document:{readyState:'loading',addEventListener(){}},Date};
vm.runInNewContext(prev,sandbox);vm.runInNewContext(src,sandbox);
// Exercise mount, not only parsing: strict-mode declarations can fail at runtime.
class ElementStub{constructor(){this.dataset={};this.children=[];}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}setAttribute(){}addEventListener(){}}
const admin=new ElementStub();
const mounting={window:{},document:{readyState:'complete',createElement:()=>new ElementStub(),getElementById:id=>id==='admin'?admin:null,addEventListener(){}}};
vm.runInNewContext(src,mounting);assert.equal(admin.children.length,1,'Build 462 Admin panel mounts');
const inspect=sandbox.window.YWI462.inspect;
const now=Date.now();const f=fixture({now,requested:true});
const outcome={id:'a4620000-0000-4462-8462-000000000001',company_id:companyId,request_id:f.request.id,
 owner_user_id:ownerId,outcome:'evidence_received',source_reference:'RECEIVED-DOCUMENT-REFERENCE',notes:null,
 created_at:new Date(now-500).toISOString()};
const ledger={company_id:companyId,viewer_id:ownerId,is_owner:true,captured_at:new Date(now).toISOString(),
 outcomes:[outcome],total:1,sample_capped:false,field_accepted:false,service_authorized:false,
 independent_reapproval:false,release_green:false,outbound_actions:false,mutation_authorized:false};
const check=()=>inspect(f.view,ledger,{companyId,userId:ownerId});
assert.equal(check().state,'source_verified');assert.equal(check().rows[0].readiness,'documentary_handoff_ready');
for(const status of ['clarification_pending','continued_hold']){outcome.outcome=status;assert.equal(check().rows[0].readiness,'hold');}
outcome.outcome='evidence_received';f.view.services.find(x=>x.module_key==='landscape').enabled=false;
assert.equal(check().rows[0].readiness,'hold');f.view.services.find(x=>x.module_key==='landscape').enabled=true;
for(const [name,edit] of [
 ['foreign owner',()=>ledger.viewer_id=foreignCompanyId],
 ['false authority',()=>ledger.release_green=true],
 ['foreign request',()=>outcome.request_id=foreignCompanyId],
 ['foreign outcome',()=>outcome.company_id=foreignCompanyId],
 ['false source',()=>outcome.source_reference='x'],
 ['future outcome',()=>outcome.created_at=new Date(now+120000).toISOString()],
 ['stale source',()=>ledger.captured_at=new Date(now-400000).toISOString()],
 ['sample capped',()=>ledger.sample_capped=true]
 ]){const baseline=structuredClone({ledger,outcome});edit();assert.equal(check().state,'withheld',name);Object.assign(ledger,baseline.ledger);Object.assign(outcome,baseline.outcome);ledger.outcomes=[outcome];}
const sql=read('sql/pms_evidence_outcomes_462.sql');
for(const s of ['enable row level security','revoke all on public.ywi_evidence_outcomes_462',
 'ywi_rpc_evidence_outcomes_462','ywi_rpc_record_evidence_outcome_462','ywi_422_assert_owner',
 'ywi_460_assert_comparison_source','ywi_reassessment_evidence_requests_461',
 "('approve','manage')",'on conflict(company_id,operation_id) do nothing',
 "'outbound_actions',false","'release_green',false"])assert.ok(sql.includes(s),s);
assert.ok(!/grant\s+(select|insert|update|delete)\s+on\s+public\.ywi_evidence_outcomes_462\s+to\s+authenticated/i.test(sql));
for(const s of ['pms462Form','pms462Hold','window.confirm','ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])assert.ok(src.includes(s),s);
assert.ok(read('index.html').includes('js/pms-evidence-outcomes-462.js'));
assert.ok(read('help.html').includes('id="pms-evidence-outcomes-462"'));
assert.ok(read('style.css').includes('.pms462-controls'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const s of ['test:pms-evidence-outcomes-462','test:browser:pms-evidence-outcomes-462']){assert.ok(pkg.scripts[s]);assert.ok(ci.includes('npm run '+s));}
console.log('YW 462: owner outcome lineage, independent documentary readiness, fail-closed gates: PASS');
