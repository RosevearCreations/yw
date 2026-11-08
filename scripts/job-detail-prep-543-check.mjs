import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('js/mobile-today.js','utf8');
const browser={};
vm.runInNewContext(source,{window:browser,document:{addEventListener(){}},navigator:{onLine:true},console},{filename:'mobile-today.js'});

const ui=browser.YWIMobileToday;
const assigned={
  dispatch:{id:'assigned-dispatch',workability_state:'workable'},
  work_order:{id:'assigned-order',work_order_number:'WO-543',work_type:'Tree care'},
  job:{job_code:'TREE-543'},
  site:{site_name:'Test & Co'}
};
const key=ui.crewAssignmentKey(assigned);
assert.equal(key,'dispatch:assigned-dispatch');
assert.equal(ui.crewAssignmentKey({work_order:{id:'fallback-order'}}),'work_order:fallback-order');
assert.equal(ui.crewAssignmentKey({}),'','Never reuse anonymous checklist identity');
assert.equal(ui.crewPrepCount(key),0,'New review is never pre-approved');

const markup=ui.crewDetailsMarkup(assigned,1);
assert.match(markup,/Job details & on-site prep/);
assert.match(markup,/WO-543/);
assert.match(markup,/0 of 4 reviewed/);
assert.equal((markup.match(/data-crew-prep="/g)||[]).length,4,'Four explicit personal steps');
assert.match(markup,/not saved to the server or a completed safety inspection/,'Never imply authoritative approval');
assert.match(markup,/lockout clearance/,'Never treat a personal tick as lockout clearance');
assert.ok(!markup.includes('disabled'),'An identified assigned job can be reviewed');
assert.match(ui.crewDetailsMarkup({},0),/data-crew-prep="task"[^>]*disabled/,'Unidentified work cannot retain review ticks');
const escaped=ui.crewDetailsMarkup({...assigned,work_order:{...assigned.work_order,work_order_number:'<img src=x onerror=alert(1)>'}},0);
assert.ok(escaped.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(!escaped.includes('<img src=x'),'Job details must not inject markup');

for (const assertion of [
  'state.crewPrepByAssignment=Object.create(null)',
  'state.crewDetailsOpen=Object.create(null)',
  'state.crewAuthEpoch += 1',
  'authEpoch !== state.crewAuthEpoch',
  'pruneCrewPrepState(payload)',
  'bindCrewDetails(list)',
  'crewDetailsMarkup(row, index)'
]) assert.ok(source.includes(assertion),'Missing identity/authority safeguard: '+assertion);

console.log('YW 543 Job Detail & Personal Prep checklist source security gate GREEN');
