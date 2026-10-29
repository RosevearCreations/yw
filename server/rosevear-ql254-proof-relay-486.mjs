// QL-254: immutable-public-proof gap aging and in-memory reversible relay simulation ONLY.
import {reconcileQl253PublicSnapshot} from './rosevear-ql253-origin-registry-485.mjs';
const fail=(test,code)=>{if(!test)throw Error('QL254_486_HOLD_'+code);};
const isReceipt=x=>typeof x==='string'&&/^np-[a-z0-9][a-z0-9-]{2,100}$/.test(x);
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).sort().join('|')===[...fields].sort().join('|');
export const proofEvidenceClasses=Object.freeze([
 'public_signed_proof','source_ci_head_sha','two_sha_ancestry','original_signature',
 'independent_registry_snapshot','custodian_receipt','distinct_witness_signature',
 'private_owner_test_decision','original_health_capabilities_gets','seven_original_denials',
 'durable_audit_and_revocation']);

export function ageQl254Exceptions(rows,{now,renewAfterMs=86400000,escalateAfterMs=172800000}={}){
 fail(Number.isSafeInteger(now)&&now>=0&&Number.isSafeInteger(renewAfterMs)
  &&renewAfterMs>0&&Number.isSafeInteger(escalateAfterMs)
  &&escalateAfterMs>=renewAfterMs&&escalateAfterMs<=30*86400000,'CLOCK');
 fail(Array.isArray(rows)&&rows.length===proofEvidenceClasses.length,'ROW_COUNT');
 const seen=new Set(),queue=rows.map(row=>{
  fail(exact(row,['category','evidenceAt','renewalRequestedAt','independentReceiptId','evidenceState']),'ROW_FIELDS');
  fail(proofEvidenceClasses.includes(row.category)&&!seen.has(row.category),'CATEGORY');seen.add(row.category);
  fail(['MISSING','CLAIMED','REVIEW_CANDIDATE'].includes(row.evidenceState),'STATE');
  fail(row.evidenceAt===null||Number.isSafeInteger(row.evidenceAt)&&row.evidenceAt>=0&&row.evidenceAt<=now,'EVIDENCE_TIME');
  fail(row.renewalRequestedAt===null||Number.isSafeInteger(row.renewalRequestedAt)
   &&row.renewalRequestedAt>=0&&row.renewalRequestedAt<=now,'RENEWAL_TIME');
  fail(row.independentReceiptId===null||isReceipt(row.independentReceiptId),'RECEIPT');
  const age=row.evidenceAt===null?null:now-row.evidenceAt;
  const renewalAge=row.renewalRequestedAt===null?null:now-row.renewalRequestedAt;
  const stale=age===null||age>renewAfterMs;
  const escalate=stale&&(renewalAge===null||renewalAge>escalateAfterMs);
  return {category:row.category,age_ms:age,renewal_age_ms:renewalAge,
   evidence_status:'HOLD',escalate,action:escalate?'ESCALATE_PRIVATE_ORIGINAL_RECEIPT_REQUEST':
   stale?'RENEW_ORIGINAL_RECEIPT':'INDEPENDENTLY_RECHECK_ORIGINAL'};
 });
 return {queue,escalated_count:queue.filter(x=>x.escalate).length,
  verified_original_evidence:false,owner_test_authorized:false,
  connection_state:'DISCONNECTED',decision:'HOLD'};
}
export function emptyQl254Register(){return proofEvidenceClasses.map(category=>({
 category,evidenceAt:null,renewalRequestedAt:null,independentReceiptId:null,evidenceState:'MISSING'}));}

export function simulatePrivateRelay(actions,{checkSeconds=60}={}){
 fail(Number.isSafeInteger(checkSeconds)&&checkSeconds>=30&&checkSeconds<=300,'CHECK_INTERVAL');
 fail(Array.isArray(actions)&&actions.length>0&&actions.length<=50,'ACTIONS');
 let running=false,revoked=false;const trace=[];
 for(const action of actions){
  fail(['SIMULATE_START','SIMULATE_STOP','SIMULATE_REVOKE','SIMULATE_RESTORE'].includes(action),'ACTION');
  if(action==='SIMULATE_START'){fail(!revoked&&!running,'START_GUARD');running=true;}
  if(action==='SIMULATE_STOP')running=false;
  if(action==='SIMULATE_REVOKE'){running=false;revoked=true;}
  if(action==='SIMULATE_RESTORE'){fail(!running,'RESTORE_GUARD');revoked=false;}
  trace.push({action,running,revoked});
 }
 // Simulated start is never a real service state or permission to deploy.
 return {trace,simulation_final_running:running,simulation_revoked:revoked,
  real_relay_installed:false,real_process_started:false,network_requests:0,
  home_devices_accessed:false,credentials_provisioned:false,connection_state:'DISCONNECTED',decision:'HOLD'};
}

export function reviewQl254(snapshot,rows,options){
 const origin=reconcileQl253PublicSnapshot(snapshot);
 const aging=ageQl254Exceptions(rows,options);
 return {origin_status:origin.public_proof_status,escalated_count:aging.escalated_count,
  original_signature_verified:false,private_registry_witness_verified:false,
  relay_approved:false,owner_test_authorized:false,
  connection_state:'DISCONNECTED',decision:'HOLD'};
}
