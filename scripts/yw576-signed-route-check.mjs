import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifySignedJourney576,YW576Stages,YW576Canonical,YW576Hash} from './yw576-signed-route.mjs';
const id=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-16T23:00:00Z'),companyId=id(1),customerId=id(2),propertyId=id(3);
const kp=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pub=kp.publicKey.export({format:'pem',type:'spki'});
const issuer=id(40);
const make=()=>{
 const issuers={[issuer]:{server_enrolled:true,active:true,company_id:companyId,audience:'YW',
   provider:'YW',capabilities:YW576Stages.map(s=>s[1]),expires_at:'2026-11-17T05:00:00Z',public_key_pem:pub}};
 const envelopes=[],originalSources=[];let previous='GENESIS';
 for(let i=0;i<YW576Stages.length;i++){
  const e={stage:YW576Stages[i][0],company_id:companyId,customer_id:customerId,property_id:propertyId,
   source_id:id(100+i),source_revision:1,previous_hash:previous,nonce:id(200+i),
   issued_at:'2026-11-16T22:00:00Z',audience:'YW',issuer_id:issuer,protocol:i%2?'1.0':'1.1',
   original_verified:true};
  e.signature=sign('sha256',Buffer.from(YW576Canonical(e)),{key:kp.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  previous=YW576Hash(e);envelopes.push(e);
  originalSources.push({trusted_server_source:true,state_verified:true,company_id:companyId,
    customer_id:customerId,property_id:propertyId,source_id:e.source_id,
    source_revision:e.source_revision,stage:e.stage,revoked:false});
 }
 return {companyId,customerId,propertyId,envelopes,issuers,originalSources};
};
const baseline=make(),ok=verifySignedJourney576(baseline,now);
assert.equal(ok.status,'SOURCE_CHAIN_VERIFIED_ONLY');assert.equal(ok.canDispatch,false);
assert.equal(ok.commsAck,'HOLD');assert.equal(ok.icampAck,'HOLD');
const reject=(name,change)=>{const b=make();change(b);assert.equal(verifySignedJourney576(b,now).status,'HOLD',name)};
reject('cross tenant',b=>b.envelopes[2].company_id=id(7));
reject('cross customer',b=>b.envelopes[4].customer_id=id(8));
reject('reordered stages',b=>b.envelopes.reverse());
reject('unaccepted quote',b=>b.originalSources[1].state_verified=false);
reject('missing original Job',b=>b.originalSources.splice(2,1));
reject('revoked source',b=>b.originalSources[3].revoked=true);
reject('source revision changed',b=>b.envelopes[2].source_revision=2);
reject('signature tampered',b=>b.envelopes[1].signature='invalid');
reject('wrong source audience',b=>b.envelopes[0].audience='iCamp');
reject('unknown protocol',b=>b.envelopes[1].protocol='2.0');
reject('foreign issuer',b=>b.issuers[issuer].company_id=id(9));
reject('expired issuer',b=>b.issuers[issuer].expires_at='2026-11-16T22:00:00Z');
reject('unenrolled issuer',b=>b.issuers[issuer].server_enrolled=false);
reject('missing capability',b=>b.issuers[issuer].capabilities=['booking.approve']);
reject('replay nonce',b=>b.envelopes[2].nonce=b.envelopes[1].nonce);
reject('missing receipt',b=>b.envelopes.pop());
reject('old evidence',b=>b.envelopes[2].issued_at='2026-11-15T22:00:00Z');
let repeat=make();assert.equal(verifySignedJourney576({...repeat,usedNonces:[repeat.envelopes[0].nonce]},now).status,'HOLD');
console.log('YW576 signed booking/quote/job/crew/route, cross-tenant, replay, original-source and protocol 1.0/1.1 checks PASS');
