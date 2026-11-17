import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {inspectActivityTrail580,canonicalEvent580,eventHash580} from './yw580-activity-trail.mjs';
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const hex=s=>createHash('sha256').update(s).digest('hex');
const now=Date.parse('2026-11-17T19:00:00Z');
const identity={companyId:id(1),customerId:id(2),propertyId:id(3),jobId:id(4),serviceKey:'ponds'};
const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem=keys.publicKey.export({type:'spki',format:'pem'});
function build(){
 const issuer=id(20),actor=id(30),issuers={};
 issuers[issuer]={server_enrolled:true,revoked:false,company_id:identity.companyId,
  actor_id:actor,key_id:'yw580-role',audience:'YW',capabilities:['service.activity.review'],
  expires_at:'2026-11-17T20:00:00Z',public_key_pem:pem};
 const events=[];
 const resign=()=>{
  for(let i=0;i<events.length;i++){
   if(i)events[i].previous_hash=eventHash580(events[i-1]);
   events[i].signature=sign('sha256',Buffer.from(canonicalEvent580(events[i])),
    {key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  }
 };
 for(let i=0;i<3;i++){
  const event={event_id:id(40+i),company_id:identity.companyId,
   customer_id:identity.customerId,property_id:identity.propertyId,job_id:identity.jobId,
   service_key:identity.serviceKey,event_type:['estimate_review','photo_evidence','maintenance_review'][i],
   source_id:id(50+i),source_revision:i+1,source_digest:hex('original-'+i),
   evidence_digest:i===1?hex('photo-file'):null,consent_verified:i===1,
   retention_checked:i===1,actor_id:actor,captured_at:'2026-11-17T18:59:00Z',
   previous_hash:'GENESIS',issuer_id:issuer,key_id:'yw580-role',protocol:i%2?'1.0':'1.1'};
  events.push(event);
 }
 resign();return{packet:{...identity,events,issuers,usedEventIds:[]},resign};
}
const positive=inspectActivityTrail580(build().packet,now);
assert.equal(positive.state,'SOURCE_SHAPE_REVIEW_ONLY');
assert.equal(positive.eventsReviewed,3);
assert.equal(positive.photosReviewed,1);
for(const f of ['canCreate','canLink','canPost','canDispatch','canPay','canPublish','persisted'])assert.equal(positive[f],false);
let rejected=0;
function deny(label,mutate,resign=false){
 const p=build();mutate(p.packet);if(resign)p.resign();
 const result=inspectActivityTrail580(p.packet,now);
 assert.equal(result.state,'HOLD',label);rejected++;
}
deny('foreign tenant',p=>p.events[0].company_id=id(99),true);
deny('foreign customer',p=>p.events[1].customer_id=id(99),true);
deny('foreign property',p=>p.events[1].property_id=id(99),true);
deny('foreign job',p=>p.events[2].job_id=id(99),true);
deny('changed service',p=>p.events[1].service_key='skateparks',true);
deny('invalid module',p=>p.serviceKey='not_a_module');
deny('event tampering',p=>p.events[1].source_digest='f'.repeat(64));
deny('duplicate event',p=>p.events[2].event_id=p.events[1].event_id,true);
deny('already used event',p=>p.usedEventIds=[p.events[1].event_id]);
deny('same source revision',p=>{p.events[2].source_id=p.events[1].source_id;p.events[2].source_revision=p.events[1].source_revision;},true);
deny('stale observation',p=>p.events[1].captured_at='2026-11-01T00:00:00Z',true);
deny('future observation',p=>p.events[1].captured_at='2026-11-17T20:00:00Z',true);
deny('wrong order',p=>p.events.reverse());
deny('bad signature',p=>p.events[2].signature='BAD');
deny('missing evidence digest',p=>p.events[1].evidence_digest=null,true);
deny('photo without consent',p=>p.events[1].consent_verified=false,true);
deny('photo retention denied',p=>p.events[1].retention_checked=false,true);
deny('non-photo smuggled evidence',p=>p.events[0].evidence_digest=hex('covert'),true);
deny('no actual photo',p=>{p.events[1].event_type='job_authorized';p.events[1].evidence_digest=null;},true);
deny('revoked issuer',p=>p.issuers[p.events[0].issuer_id].revoked=true);
deny('issuer role mismatch',p=>p.issuers[p.events[0].issuer_id].actor_id=id(99));
deny('issuer tenant mismatch',p=>p.issuers[p.events[0].issuer_id].company_id=id(99));
deny('issuer expired',p=>p.issuers[p.events[0].issuer_id].expires_at='2026-11-01T00:00:00Z');
deny('missing signed source',p=>p.events.splice(1,2));
deny('not a real digest',p=>p.events[0].source_digest='invalid',true);
deny('invalid protocol',p=>p.events[0].protocol='2.0',true);
deny('wrong previous hash',p=>p.events[2].previous_hash='f'.repeat(64));
deny('wrong source revision',p=>p.events[0].source_revision=0,true);
deny('missing source issuer',p=>delete p.issuers[p.events[0].issuer_id]);
deny('wrong audience',p=>p.issuers[p.events[0].issuer_id].audience='other');
deny('capability absent',p=>p.issuers[p.events[0].issuer_id].capabilities=[]);
assert.ok(rejected>=30);
console.log('YW580 signed cross-module source REVIEW packet PASS; '+rejected+' negative replay, provenance, photo consent, tenant and job boundary cases; no durable writes claimed');
