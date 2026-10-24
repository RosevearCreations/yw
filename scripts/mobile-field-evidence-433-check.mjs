import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(p,'utf8');
const source=read('js/mobile-field-evidence-433.js');new Function(source);
const context={window:{},document:{readyState:'loading',addEventListener(){}}};
vm.runInNewContext(source,context);
const guard=context.window.YWI433;
const id=i=>`${String(i).padStart(8,'0')}-0000-4000-8000-000000000001`;
const owner=id(1),workOrder=id(2),dispatch=id(3),receipt=id(4),proof=id(5),asset=id(6);
const route={ok:true,profile:{id:owner},meta:{assignment_filtered:true},my_route:[{
  work_order:{id:workOrder,work_order_number:'WO-433'},dispatch:{id:dispatch,schedule_status:'scheduled'}
}]};
assert.equal(guard.checkOriginalAssignment(route,owner)[0].id,workOrder);
for(const modified of [
  {...route,profile:{id:id(7)}},
  {...route,meta:{assignment_filtered:false}},
  {...route,my_route:[route.my_route[0],route.my_route[0]]},
  {...route,my_route:[{work_order:{id:id(9)},dispatch:{id:dispatch}}]},
  {...route,my_route:Array(101).fill(route.my_route[0])}
])assert.throws(()=>guard.checkOriginalAssignment(modified,owner));
assert.equal(guard.checkOriginalAssignment({...route,my_route:[{...route.my_route[0],dispatch:{id:dispatch,schedule_status:'cancelled'}}]},owner).length,0);
const file=(type,size)=>({type,size});
guard.validateFile(file('image/jpeg',120));
guard.validateFile(file('image/png',120));
guard.validateFile(file('image/webp',120));
guard.validateFile(file('application/pdf',120));
for(const bad of [file('application/x-msdownload',100),file('image/gif',100),file('image/jpeg',0),file('image/jpeg',9*1024*1024)])
  assert.throws(()=>guard.validateFile(bad));
const row={id:id(10),owner_id:owner,work_order_id:workOrder,sha256:'a'.repeat(64)};
const response={ok:true,canonical_source:'work_order_execution_proof_media',receipt_id:receipt,
  execution_proof_id:proof,visual_asset_id:asset,owner_profile_id:owner,work_order_id:workOrder,
  intent_key:row.id,content_sha256:row.sha256,verified:true};
assert.equal(guard.receiptStatus(row,response),'confirmed');
for(const change of [{verified:false},{receipt_id:null},{intent_key:id(9)},{owner_profile_id:id(8)},
  {work_order_id:id(7)},{content_sha256:'b'.repeat(64)},{canonical_source:'job_comment_attachments'},
  {execution_proof_id:null},{visual_asset_id:null}])assert.equal(guard.receiptStatus(row,{...response,...change}),'withheld');
const html=read('index.html'),help=read('help.html'),flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(html.includes('js/mobile-field-evidence-433.js'));
assert.ok(help.includes('id="mobile-field-evidence-433"'));
for(const line of ['indexedDB.open','crypto.subtle.digest','file:','content_sha256','lookupFieldEvidenceIntent433',
  'uploadFieldEvidenceIdempotent433','verified_not_found','work_order_execution_proof_media','ywi:auth-changed',
  'LOCAL ONLY','owner_id'])assert.ok(source.includes(line),line);
for(const bad of ['uploadJobCommentAttachment(', 'uploadRouteExecutionAttachment(', 'uploadHsePacketProof(',
  '.from(\'work_order_execution_proof_media\').insert('])assert.ok(!source.includes(bad),bad);
assert.ok(source.includes('retry.disabled=!window.YWIAPI?.lookupFieldEvidenceIntent433'),
  'Unimplemented idempotent server upload must not be clickable');
const pkg=JSON.parse(read('package.json'));
for(const key of ['test:mobile-field-evidence-433','test:browser:mobile-field-evidence-433']){
  assert.ok(pkg.scripts[key]);assert.ok(flow.includes('npm run '+key));
}
console.log('Build 433 profile-scoped device capture and fail-closed proof-media replay acceptance PASS');
