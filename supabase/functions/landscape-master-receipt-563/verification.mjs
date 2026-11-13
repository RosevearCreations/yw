/* YW563: signed AI Data Platform receipt-observation verifier.
 * Exact canonical payload; no provider private keys, customer PII or browser writes. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha40=/^[0-9a-f]{40}$/;
const sha64=/^[0-9a-f]{64}$/;
const keyId=/^[A-Za-z0-9_.:-]{6,96}$/;
const reference=/^[A-Za-z0-9_./:-]{10,160}$/;
const states=new Set(['acknowledged','discrepancy','rejected']);
const fields=[
 'schema','issuer','audience','source_id','source_role','tenant_boundary',
 'key_id','company_id','request_id','case_version',
 'provider_verified_receipt_id','source_pilot_decision_id',
 'controller_revision','master_receipt_ref','master_claimed_sha256',
 'observed_state','issued_at','nonce'
];
const encoder=new TextEncoder();

export function canonicalMasterObservation(value, now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value)||
   Object.keys(value).length!==fields.length||
   Object.keys(value).some(k=>!fields.includes(k)))
  throw Error('563 Master observation schema mismatch');
 const p={};
 for(const field of fields){
  if(value[field]===undefined)throw Error('563 signed observation field missing');
  p[field]=value[field];
 }
 if(p.schema!=='rosevear.yw.master-receipt-observation.v1'||
   p.issuer!=='ai-data-platform'||
   p.audience!=='yw-landscape-master-observer-563'||
   p.source_id!=='yw'||p.source_role!=='platform_shell'||
   p.tenant_boundary!=='company'||
   !keyId.test(p.key_id)||!uuid.test(p.company_id)||!uuid.test(p.request_id)||
   !Number.isSafeInteger(p.case_version)||p.case_version<3||p.case_version>10000||
   !uuid.test(p.provider_verified_receipt_id)||!uuid.test(p.source_pilot_decision_id)||
   !sha40.test(p.controller_revision)||!reference.test(p.master_receipt_ref)||
   !sha64.test(p.master_claimed_sha256)||!states.has(p.observed_state)||
   !uuid.test(p.nonce))
   throw Error('563 Master observation identity or source invalid');
 const issued=Date.parse(p.issued_at);
 if(!Number.isFinite(issued)||new Date(issued).toISOString()!==p.issued_at||
    issued<now-600_000||issued>now+120_000)
  throw Error('563 signed Master observation stale');
 return JSON.stringify(p);
}

function base64Bytes(s,length){
 if(typeof s!=='string'||s.length>256||s.length%4!==0||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('563 malformed binary base64');
 const decoded=atob(s);
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 if(bytes.length!==length||btoa(decoded)!==s)throw Error('563 malformed signed evidence length');
 return bytes;
}
export async function sha256hex(bytes){
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return [...digest].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function verifyMasterObservation(payload,signatureB64,publicKeyB64,now=Date.now()){
 const canonical=canonicalMasterObservation(payload,now);
 const signature=base64Bytes(signatureB64,64);
 const publicKey=base64Bytes(publicKeyB64,32);
 const imported=await crypto.subtle.importKey('raw',publicKey,'Ed25519',false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',imported,signature,encoder.encode(canonical)))
  throw Error('563 independent Master Ed25519 signature invalid');
 return {
  canonical_sha256:await sha256hex(encoder.encode(canonical)),
  signature_sha256:await sha256hex(signature),
  public_key_sha256:await sha256hex(publicKey),
 };
}
