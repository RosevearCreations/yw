import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import vm from 'node:vm';
import {SERVICE_KEYS_582,inspectStagingReview582,inspectPrivatePhoto582,planRetention582}
 from './yw582-photo-custody.mjs';
const source=path=>readFileSync(path,'utf8');
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const h=s=>createHash('sha256').update(s).digest('hex');
const keys=Array.from({length:2},()=>generateKeyPairSync('ec',{namedCurve:'prime256v1'}));
const publicTrust=keys.map((k,i)=>({actor_id:uuid(i+1),key_id:'independent-582-'+i,
 public_key_pem:k.publicKey.export({format:'pem',type:'spki'})}));
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?
 Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const now=Date.parse('2026-11-18T14:00:00Z');
const ref='stagingsafe1234',prod='knownprod1234',src='a'.repeat(40),digest='b'.repeat(64);
const payload={project_ref:ref,environment:'staging',source_revision:src,migration_digest:digest,
 issued_at:new Date(now-15000).toISOString(),expires_at:new Date(now+60000).toISOString()};
const measurements={project_ref:ref,source_revision:src,migration_digest:digest,
 schema_parity:true,isolated_project:true,backup_restore_proven:true,
 production_unmodified:true,bucket_private:true,owner_rls_denials:true,
 cross_company_denied:true,jobs_revocation_denied:true,consent_denied:true,
 expiry_denied:true,allowed_module_count:9,photo_replay_denied:true,media_size_type_denied:true};
function makePacket(){
 const signed={payload:structuredClone(payload),measurements:structuredClone(measurements)};
 const sig=i=>sign('sha256',Buffer.from(canonical(signed)),
  {key:keys[i].privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return {...signed,owner:{actor_id:publicTrust[0].actor_id,key_id:publicTrust[0].key_id,signature:sig(0)},
  reviewer:{actor_id:publicTrust[1].actor_id,key_id:publicTrust[1].key_id,signature:sig(1)}};
}
const opts={expectedStagingProjectRef:ref,productionProjectRef:prod,expectedSourceSha:src,
 expectedMigrationDigest:digest,trustedOwner:publicTrust[0],trustedReviewer:publicTrust[1],now};
const pass=inspectStagingReview582(makePacket(),opts);
assert.equal(pass.state,'SIGNED_STAGING_REVIEW_PACKET_ONLY');
assert.equal(pass.stagingMigrationAccepted,false);
assert.equal(pass.productionActivation,false);
let fails=0;
for(const [name,p,option] of [
 ['production project',(()=>{const p=makePacket();p.payload.project_ref=prod;return p})(),{}],
 ['no isolation',(()=>{const p=makePacket();p.measurements.isolated_project=false;return p})(),{}],
 ['cross company not denied',(()=>{const p=makePacket();p.measurements.cross_company_denied=false;return p})(),{}],
 ['photo replay not tested',(()=>{const p=makePacket();p.measurements.photo_replay_denied=false;return p})(),{}],
 ['partial services',(()=>{const p=makePacket();p.measurements.allowed_module_count=8;return p})(),{}],
 ['tampered digest',(()=>{const p=makePacket();p.payload.migration_digest=h('other');return p})(),{}],
 ['tampered reviewer',(()=>{const p=makePacket();p.reviewer.signature='fake-fake-fake-fake';return p})(),{}],
 ['wrong source',makePacket(),{expectedSourceSha:'c'.repeat(40)}],
 ['same reviewer',makePacket(),{trustedReviewer:publicTrust[0]}],
 ['same project',makePacket(),{productionProjectRef:ref}],
 ['expired',makePacket(),{now:now+300000}]
]){
 const result=inspectStagingReview582(p,{...opts,...option});
 assert.equal(result.state,'HOLD',name);fails++;
}
const company=uuid(11),job=uuid(12),client=uuid(13),site=uuid(14);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('test-original-image-payload')]);
const path=company+'/'+job+'/'+uuid(15)+'.png';
const rec={company_id:company,job_id:job,client_id:client,client_site_id:site,
 service_key:'ponds',consent_scope:'job_documentation',consent_recorded:true,
 private_object_key:path,reported_sha256:h(png),media_type:'image/png'};
const storage={bucket:'ywi-private-job-photos-581',public:false,path};
const imageOK=inspectPrivatePhoto582({bytes:png,record:rec,storage});
assert.equal(imageOK.state,'BYTE_HASH_MATCH_LOCAL_ONLY');
assert.equal(imageOK.databaseReceiptWritten,false);
const reject=(reason,data)=>{
 assert.equal(inspectPrivatePhoto582(data).state,'HOLD',reason);fails++;
};
reject('changed byte',{bytes:Buffer.concat([png,Buffer.from('1')]),record:rec,storage});
reject('public storage',{bytes:png,record:rec,storage:{...storage,public:true}});
reject('foreign job',{bytes:png,record:{...rec,job_id:uuid(99)},storage});
reject('missing consent',{bytes:png,record:{...rec,consent_recorded:false},storage});
reject('unsupported service',{bytes:png,record:{...rec,service_key:'mail'},storage});
reject('wrong mime',{bytes:png,record:{...rec,media_type:'image/jpeg'},storage});
const plan=planRetention582([
 {id:uuid(21),company_id:company,job_id:job,private_object_key:path,
  bucket:'ywi-private-job-photos-581',retained_until:new Date(now-1000).toISOString(),
  legal_hold:false,active_dispute:false,integrity_verified:true},
 {id:uuid(22),company_id:company,job_id:job,private_object_key:path,
  bucket:'ywi-private-job-photos-581',retained_until:new Date(now-1000).toISOString(),
  legal_hold:true,active_dispute:false,integrity_verified:true},
 {id:uuid(23),company_id:company,job_id:job,private_object_key:path,
  bucket:'ywi-private-job-photos-581',retained_until:new Date(now-1000).toISOString(),
  legal_hold:false,active_dispute:false,integrity_verified:false}
],{now});
assert.equal(plan.state,'RETENTION_REVIEW_PLAN_ONLY');
assert.equal(plan.reviewCount,1);
assert.deepEqual(plan.records.map(x=>x.reason),['REVIEW_EXPIRED','LEGAL_HOLD','INTEGRITY_NOT_ATTESTED']);
assert.equal(plan.autoDelete,false);
assert.equal(plan.retentionDeleteAllowed,false);
const ui=source('js/yw582-original-job-picker.js');
new vm.Script(ui);
const runtime={window:{},document:{readyState:'loading',addEventListener(){}},location:{hash:''}};
vm.runInNewContext(ui,runtime);
const history={company_id:company,client_id:client,customer_name:'Verified Company Customer',
 legacy_unscoped_excluded:true,history_limit_per_type:80,
 properties:[{id:site,name:'Original lot'}],estimates:[],
 work_orders:[{id:job,property_id:site,service:'ponds',status:'draft',
  created_at:new Date(now).toISOString()}]};
const inspect=runtime.window.YW582OriginalJobs.inspectOriginal;
const parsed=inspect(history,{companyId:company,clientId:client});
assert.equal(parsed.state,'ORIGINAL_422_OWNER_READ_ONLY');
assert.equal(parsed.jobs.length,1);
assert.equal(parsed.canUpload,false);
for(const [name,mutate] of [
 ['foreign client',v=>v.client_id=uuid(999)],
 ['foreign property',v=>v.work_orders[0].property_id=uuid(998)],
 ['unscoped history',v=>v.legacy_unscoped_excluded=false],
 ['invalid job service',v=>v.work_orders[0].service='forged_service'],
 ['duplicate job',v=>v.work_orders.push({...v.work_orders[0]})],
 ['no original chronology',v=>v.work_orders[0].created_at='n/a']
]){
 const o=structuredClone(history);mutate(o);
 assert.equal(inspect(o,{companyId:company,clientId:client}).state,'HOLD',name);fails++;
}
const html=source('index.html'),build=source('scripts/build-vercel-site.mjs');
assert.ok(html.includes('/js/yw582-original-job-picker.js?v=20261118b582'));
assert.ok(html.includes('/theme-original-jobs-582.css?v=20261118b582'));
assert.ok(build.includes("'theme-original-jobs-582.css'"));
for(const x of ['ywi_rpc_company_customers_422','ywi_rpc_customer_history_422',
 'canEvidenceService','getUser','ywi:auth-changed','state.epoch'])
 assert.ok(ui.includes(x),x);
assert.ok(!/\\.insert\\(|\\.upsert\\(|\\.delete\\(|\\.getPublicUrl\\(/.test(ui));
assert.equal(SERVICE_KEYS_582.length,9);
const sql=source('sql/yw582_photo_integrity_retention_STAGING_ONLY.sql');
for(const clause of [
 'public.ywi_582_photo_integrity_receipts','public.ywi_582_retention_reviews',
 'enable row level security','delete_authorized boolean not null default false',
 'verified_match boolean not null check',
 'before update or delete','ywi_582_guard_append_only'
]){
 assert.ok(sql.toLowerCase().includes(clause.toLowerCase()),'missing staged ledger protection: '+clause);
}
assert.ok(!/grant\\s+(insert|update|delete)[^;]*to\\s+authenticated/i.test(sql));
console.log('YW582 source PASS: 9 service keys, cryptographic two-witness staging review, original 422 owner-bound job usability, actual byte-hash checks, legal hold and retention review, '+fails+' negative cases; no production activation');
