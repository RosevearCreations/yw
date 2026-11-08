import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('js/mobile-today.js','utf8');
const browser={};
vm.runInNewContext(source,{window:browser,document:{addEventListener(){}},navigator:{onLine:true},console},{filename:'mobile-today.js'});
const guide=browser.YWIMobileToday.crewCloseoutGuidance;

const row={
  dispatch:{id:'test-dispatch'},
  work_order:{id:'test-order'},
  latest_session:null,
  production:{quantity_count:0},
  evidence:{proof_count:0},
  closeout:null,
  equipment:[{id:42,is_locked_out:true,defect_status:'lockout'}]
};
const restricted=guide(row,{});
assert.equal(restricted[0].kind,'attention');
assert.equal(restricted[1].kind,'review');
assert.equal(restricted[2].kind,'review');
assert.equal(restricted[3].kind,'attention');
assert.ok(restricted[3].note.includes('does not clear it'),'Do not misrepresent equipment lockout');
assert.equal(restricted[4].kind,'review','Do not fabricate a Safety signoff');
assert.equal(restricted[5].kind,'status','Do not fabricate closeout approval');
assert.ok(restricted.every((item)=>!item.action),'No action without corresponding module capability');

const granted=guide(row,{production_capture:true,execution_proof:true,equipment_scan:true,safety_create:true,closeout_request:true});
assert.equal(granted[0].action,'start_visit');
assert.equal(granted[2].action,'execution_proof');
assert.equal(granted[3].action,'equipment');
assert.equal(granted[4].action,'safety');
assert.equal(granted[5].action,'closeout');
assert.equal(granted[1].action,'','Production quantity needs a server-confirmed session');

const confirmed=guide({...row,latest_session:{id:'s',session_status:'completed'},production:{quantity_count:2},evidence:{proof_count:1},equipment:[]},{production_capture:true,execution_proof:true});
assert.equal(confirmed[0].kind,'confirmed');
assert.equal(confirmed[1].kind,'confirmed');
assert.equal(confirmed[2].kind,'confirmed');
assert.equal(confirmed[3].kind,'review','No returned equipment is not a verified clear condition');
assert.equal(confirmed[4].kind,'review','A completed visit cannot prove official Safety approval');
const unknown=guide({...row,production:{},evidence:{}},{});
assert.ok(unknown[1].note.includes('unavailable'));
assert.ok(unknown[2].note.includes('unavailable'));
const markup=browser.YWIMobileToday.crewCloseoutMarkup({...row,closeout:{closeout_status:'<script>alert(1)</script>'}},0);
assert.ok(markup.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),'Escape server closeout status');
assert.ok(!markup.includes('<script>'),'Never inject server-supplied markup');

for(const required of [
  'crewCloseoutMarkup(row, index)',
  'bindCrewCloseout(list)',
  'state.crewCloseoutOpen=Object.create(null)',
  'pruneCrewPrepState(payload)',
  'if (!state.crewContext?.capabilities?.closeout_request) throw new Error',
  'if (!window.confirm(message))',
  "action:'work_order_closeout_submit'",
  'invoice_ready_requested:false',
  'review_request_requested:false'
]) assert.ok(source.includes(required),'Missing guarded closeout contract: '+required);

console.log('YW 544 guided visit closeout and missing information source security gate GREEN');
