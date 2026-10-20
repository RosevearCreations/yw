import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=x=>fs.readFileSync(x,'utf8');
const scope={};
vm.runInNewContext(read('js/first-live-trial-418.js'),scope);
const inspect=scope.YWI418.inspect;
const now=Date.now(),at=new Date(now).toISOString();
const steps=()=>Array.from({length:10},(_,i)=>({handoff:String(406+i),label:'Handoff '+(406+i),state:'source_verified',reason:null}));
const row=(id='job-1')=>({customer_id:'customer-1',property_id:'property-1',first_work_order_id:id,work_order_number:'WO-1',
 first_order_created_at:at,steps:steps(),unresolved_count:0,trial_acceptance:'operator_review_required'});
const envelope=(rows,gaps=[],other={})=>({ok:true,scope:'owner_first_use_trial_acceptance',acceptance_416:{
 state:rows.length?'recorded':'no_record',complete:true,retrieved_at:at,records:rows,unresolved_gaps:gaps,
 record_count:rows.length,unresolved_count:gaps.length,...other}});
assert.equal(inspect(envelope([]),now).state,'no_record');
const good=inspect(envelope([row()]),now);
assert.equal(good.state,'recorded');assert.equal(good.records[0].manual_acceptance_eligible,true);
const gapRow=row();gapRow.steps[7]={handoff:'413',label:'Candidate',state:'unresolved',reason:'Missing'};
gapRow.unresolved_count=1;
const gap={customer_id:'customer-1',first_work_order_id:'job-1',handoff:'413',reason:'Missing'};
const incomplete=inspect(envelope([gapRow],[gap]),now);
assert.equal(incomplete.state,'recorded');assert.equal(incomplete.records[0].manual_acceptance_eligible,false);
assert.equal(inspect(envelope([row(),row()]),now).state,'withheld');
assert.equal(inspect(envelope([row()],[],{unresolved_count:1}),now).state,'withheld');
assert.equal(inspect(envelope([row()],[],{retrieved_at:'2026-01-01T00:00:00Z'}),now).state,'withheld');
assert.equal(inspect({...envelope([row()]),ok:false},now).state,'withheld');
const wrong=row();wrong.steps=steps().reverse();
assert.equal(inspect(envelope([wrong]),now).state,'withheld');
const bad=row();bad.first_work_order_id=null;
assert.equal(inspect(envelope([bad]),now).state,'withheld');
const badGap=row();badGap.steps[4]={handoff:'410',label:'Start',state:'unresolved',reason:'No start'};badGap.unresolved_count=1;
assert.equal(inspect(envelope([badGap],[gap]),now).state,'withheld');
const ui=read('js/owner-first-live-trial-418.js');new Function(ui);
for(const t of ['owner418','owner_first_use_trial_acceptance','reviewed_with_gaps','manual_acceptance_candidate',
 'navigator.clipboard','No live first-use','NOT server-stored','confirm.checked','manual_acceptance_eligible'])assert.ok(ui.includes(t),t);
assert.doesNotMatch(ui,/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(/);
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:first-live-trial-418'],'node scripts/first-live-trial-418-check.mjs');
assert.ok(pkg.scripts['test:browser:first-live-trial-418'].includes('tests/browser/first-live-trial-418.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
assert.ok(ci.includes('npm run test:first-live-trial-418')&&ci.includes('npm run test:browser:first-live-trial-418'));
assert.ok(read('index.html').includes('/js/first-live-trial-418.js'));
assert.ok(read('index.html').includes('/js/owner-first-live-trial-418.js'));
assert.ok(read('help.html').includes('id="first-live-trial-418"'));
console.log('First live-trial 418 source, completeness, manual receipt and no-write gates PASS');
