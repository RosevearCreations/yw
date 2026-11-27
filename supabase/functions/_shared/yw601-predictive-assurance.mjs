// YW601: read-only evidence assessment; not a probability model, outage proof,
// provider send, recovery execution or physical certification.
import {canonical} from './yw599-independent-recovery.mjs';
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const iso=x=>new Date(x).toISOString();
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function verifyRaw(key,message,signature){
 if(typeof key!=='string'||enc.encode(key).length<32||!hash(signature))return false;
 const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',k,Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),enc.encode(message));
}
const need=(v)=>{if(!v)throw Error('YW601_EVIDENCE_HOLD')};
export async function verifyHealthSample({sample:s,enrollment:e,oldContractId,nextContractId,keys,now=Date.now()}){
 need(uuid(e?.id)&&uuid(e.company_id)&&uuid(e.owner_user_id)&&e.passive_monitor_only===true&&e.sample_period_minutes===15&&uuid(oldContractId)&&uuid(nextContractId)&&oldContractId!==nextContractId&&new Set([keys.old,keys.next,keys.local]).size===3);
 need(uuid(s?.id)&&uuid(s.challenge_nonce)&&s.company_id===e.company_id&&s.enrollment_id===e.id&&s.source_actor_id===e.owner_user_id&&s.actual_key_changed===false&&s.receiver_state==='SIGNED_OLD_AND_NEXT_MATCH');
 const at=Date.parse(s.verified_at);
 need(Number.isFinite(at)&&at>=Date.parse(e.started_at)&&at<Date.parse(e.expires_at)&&at<=now);
 const common=e.id+'|'+e.company_id+'|'+s.challenge_nonce+'|'+oldContractId+'|'+nextContractId+'|YW592-ACK';
 const remote=await sha(canonical({schema:'rosevear.yw.receiver-health-probe-ack.v1',companyId:e.company_id,enrollmentId:e.id,requestNonce:s.challenge_nonce,priorContractId:oldContractId,candidateContractId:nextContractId,acceptedAckSchema:'YW592-ACK',noKeyChange:true}));
 const msg=canonical({schema:'rosevear.yw.signed-master-health-sample.v1',companyId:e.company_id,enrollmentId:e.id,ownerId:e.owner_user_id,nonce:s.challenge_nonce,observedAt:iso(at),remoteResponseSha256:remote,state:s.receiver_state,actualSecretChanged:false,noAutomaticKeyAction:true});
 need(s.receiver_response_sha256===remote&&s.local_event_sha256===await sha(msg));
 need(await verifyRaw(keys.old,'YW597-HEALTH-OLD|'+common,s.prior_hmac)&&await verifyRaw(keys.next,'YW597-HEALTH-NEXT|'+common,s.next_hmac)&&await verifyRaw(keys.local,msg,s.local_event_hmac));
 return {sampleId:s.id,nonce:s.challenge_nonce,observedAt:iso(at)};
}
export async function assessEvidence({enrollment,rows,contractIds,keys,now=Date.now()}){
 const base={assessedAt:iso(now),sampleCount:0,lastVerifiedAt:null,ageMinutes:null,confidence:'INSUFFICIENT',outageConfirmed:false,recoveryConfirmed:false,automaticRecoveryPerformed:false,automaticNotificationSent:false,scope:'SIGNED_ACK_FRESHNESS_ONLY'};
 if(!enrollment||enrollment.passive_monitor_only!==true||enrollment.sample_period_minutes!==15||!(Date.parse(enrollment.started_at)<=now&&Date.parse(enrollment.expires_at)>now))return {...base,state:'UNKNOWN_NO_ACTIVE_WATCH'};
 if(!Array.isArray(rows)||rows.length>96)return {...base,state:'UNKNOWN_UNBOUNDED_INPUT'};
 if(!rows.length)return {...base,state:'UNKNOWN_NO_SIGNED_SAMPLES'};
 try{
  const verified=[],ids=new Set(),nonces=new Set();
  for(const sample of rows){
   const v=await verifyHealthSample({sample,enrollment,oldContractId:contractIds.old,nextContractId:contractIds.next,keys,now});
   need(!ids.has(v.sampleId)&&!nonces.has(v.nonce));ids.add(v.sampleId);nonces.add(v.nonce);verified.push(v);
  }
  verified.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
  const recent=verified.filter(v=>Date.parse(v.observedAt)>=now-86400000);
  const latest=verified.at(-1).observedAt,age=(now-Date.parse(latest))/60000;
  const bins=new Set(recent.map(v=>Math.floor(Date.parse(v.observedAt)/900000)));
  const gaps=recent.slice(1).map((v,i)=>(Date.parse(v.observedAt)-Date.parse(recent[i].observedAt))/60000);
  const lastGaps=gaps.slice(-3);
  const coverage=bins.size>=4?'LIMITED_OBSERVATIONS':'INSUFFICIENT';
  const state=age>=30?'STALE_SIGNED_EVIDENCE':age>=15?'RISK_FRESHNESS_DEGRADING':coverage==='INSUFFICIENT'?'UNKNOWN_INSUFFICIENT_HISTORY':lastGaps.length===3&&lastGaps.every((g,i)=>i===0||g>lastGaps[i-1])&&lastGaps[2]>=15?'RISK_WIDENING_OBSERVATION_GAPS':'RECENT_SIGNED_OBSERVATIONS';
  return {...base,state,sampleCount:verified.length,recentWindowCount:bins.size,lastVerifiedAt:latest,ageMinutes:Math.floor(age),confidence:coverage,observationWindowHours:24,reason:'Owner-initiated signed probes; gaps may reflect sampling inactivity, not an outage.'};
 }catch{return {...base,state:'UNKNOWN_EVIDENCE_VERIFICATION_FAILED'}}
}
