import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,companyId,foreignCompanyId,serviceKeys} from '../tests/fixtures/pms-first-service-reconciliation-456.mjs';
const read=p=>readFileSync(p,'utf8'),source=read('js/pms-first-service-reconciliation-456.js');
new Function(source);const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(source,ctx);
const {inspect,keys,outcomes}=ctx.window.YWI456;
assert.deepEqual([...keys],[...serviceKeys]);assert.equal(outcomes.length,3);
const now=Date.now(),base=fixture({now});
const args={companyId,now,nav:base.menu.services,registry:base.registry};
const ok=inspect(base.review,args);
assert.equal(ok.state,'source_verified');assert.equal(ok.sourceReceiptCount,1);
assert.equal(ok.independentApproval,false);assert.equal(ok.fieldAccepted,false);assert.equal(ok.releaseGreen,false);
assert.equal(inspect(fixture({now,noReceipt:true}).review,args).receipts.length,0);
const zero=fixture({now,enabled:[]});
assert.equal(inspect(zero.review,{companyId,now,nav:zero.menu.services,registry:zero.registry}).state,'source_verified');
function modified(change){const state=fixture({now});change(state);return inspect(state.review,{companyId,now,nav:state.menu.services,registry:state.registry}).state;}
for(const [name,change] of [
 ['foreign root',x=>x.review.company_id=foreignCompanyId],
 ['foreign service',x=>x.review.services[0].company_id=foreignCompanyId],
 ['duplicated service',x=>x.review.services[1].module_key=x.review.services[0].module_key],
 ['missing service',x=>x.review.services.pop()],
 ['switch mismatch',x=>x.review.services[0].enabled=!x.review.services[0].enabled],
 ['foreign receipt',x=>x.review.receipts[0].company_id=foreignCompanyId],
 ['duplicate receipt',x=>x.review.receipts.push({...x.review.receipts[0]})],
 ['foreign observation',x=>x.review.owner_entries[0].company_id=foreignCompanyId],
 ['bad review',x=>x.review.reviews[0].review_outcome='approved'],
 ['duplicated review',x=>x.review.reviews.push({...x.review.reviews[0]})],
 ['permission spoof',x=>x.review.independent_approval_granted=true],
 ['fake field acceptance',x=>x.review.real_field_accepted=true],
 ['fake GREEN',x=>x.review.release_green=true],
 ['synthetic',x=>x.review.synthetic=true],
 ['stale source',x=>x.review.captured_at=new Date(now-340000).toISOString()],
 ['capped missing',x=>x.review.receipt_sample_capped=true],
 ['sample too large',x=>x.review.receipts=Array.from({length:61},()=>({...x.review.receipts[0]}))]
])assert.equal(modified(change),'withheld',name);
assert.equal(inspect(base.review,{...args,companyId:foreignCompanyId}).state,'withheld');
const sql=read('sql/pms_first_service_reconciliation_456.sql');
for(const part of ['enable row level security','revoke all on public.ywi_first_service_reviews_456',
 'ywi_422_assert_owner','ywi_422_assert_jobs_create','app_profile_module_permissions',
 "v_level not in ('approve','manage')",'ywi_new_work_gate_receipts_421',
 'ywi_company_site_links_422','ywi_owner_first_use_entries_455','for share',
 'security definer set search_path', 'on conflict(company_id,request_id) do nothing',
 'grant execute on function public.ywi_rpc_append_first_service_review_456',
 "'independent_approval_granted',false", "'real_field_accepted',false"])
 assert.ok(sql.includes(part),part);
assert.ok(!/grant\s+(insert|update|delete)\s+on\s+public\.ywi_first_service_reviews_456\s+to\s+authenticated/i.test(sql));
for(const part of ['YWI454?.rosterOwned','ywi_rpc_pms_navigation_443',
 'ywi_rpc_first_service_review_456','ywi_rpc_append_first_service_review_456',
 'ywi:company-service-offering-changed','window.confirm','getRandomValues',
 'pms456Append','pms456Release'])assert.ok(source.includes(part),part);
assert.ok(read('index.html').includes('js/pms-first-service-reconciliation-456.js'));
assert.ok(read('help.html').includes('id="pms-first-service-reconciliation-456"'));
assert.ok(read('style.css').includes('.pms456-controls'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 456 implementation'));
const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/staging-browser-integration.yml');
for(const cmd of ['test:pms-first-service-reconciliation-456','test:browser:pms-first-service-reconciliation-456']){
 assert.ok(pkg.scripts[cmd]);assert.ok(ci.includes('npm run '+cmd));}
console.log('YW 456: 421/455 cross-source reconciliation, owner/permission grants, append-only review and no false approval: PASS');
