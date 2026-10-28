// QL-243/YW 475 source-only nonproduction protocol. NOT published to dist/.
// A separately approved Vercel/server runtime, durable nonce store, server-only
// credential registry and independent gateway signatures are required to activate.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const contract='rosevear.integration.v1';
export const emptyBodyHash='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const exactPaths=new Set(['/api/integration/v1/health','/api/integration/v1/capabilities']);
const ascii=x=>typeof x==='string'&&x.length<256&&!/[\r\n\0]/.test(x);
const deny=()=>{throw new Error('NONPRODUCTION_HOLD_DENIED');};
export function canonicalGet({path,timestamp,nonce,source,destination,business,tenant,keyId}){
 if(!exactPaths.has(path)||![timestamp,nonce,source,destination,business,tenant,keyId].every(ascii))deny();
 return [contract,'GET',path,timestamp,nonce,source,destination,business,tenant,
  'nonproduction',emptyBodyHash,keyId].join('\n');
}
export function signGet(secret,request){
 if(!Buffer.isBuffer(secret)||secret.length!==32)deny();
 return createHmac('sha256',secret).update(canonicalGet(request),'utf8').digest('base64url');
}
export function publicPin(publicSpkiDer){return createHash('sha256').update(publicSpkiDer).digest('hex');}

// registry must be loaded from a server-only, per-company/per-tenant key registry.
// claimNonce must atomically persist and reject replays, across redeploys/regions.
// In-memory maps MUST NOT be passed in production as a substitute for durable replay storage.
export async function verifyNonproductionGet({method,path,query,body,headers={},runtime,
 registry,claimNonce,now=Date.now()}){
 if(runtime!=='nonproduction'||method!=='GET'||!exactPaths.has(path)||
  (query&&Object.keys(query).length)||body!==undefined&&body!==null&&body.length!==0||
  typeof claimNonce!=='function'||typeof registry!=='function')deny();
 const get=name=>headers[name.toLowerCase()];
 const request={path,timestamp:get('x-rosevear-timestamp'),nonce:get('x-rosevear-nonce'),
  source:get('x-rosevear-source'),destination:get('x-rosevear-destination'),
  business:get('x-rosevear-business'),tenant:get('x-rosevear-tenant'),
  keyId:get('x-rosevear-key-id')};
 if(get('x-rosevear-contract')!==contract||get('x-rosevear-environment')!=='nonproduction'||
  request.destination!=='yw'||request.business!=='yw'||request.source!=='ai-data-platform'||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.tenant)||
  !/^\d{13}$/.test(request.timestamp)||!/^np-[0-9a-f]{32}$/.test(request.nonce)||
  !ascii(request.keyId)||!Number.isSafeInteger(now)||
  Math.abs(now-Number(request.timestamp))>300000||
  typeof get('x-rosevear-signature')!=='string'||
  !/^[A-Za-z0-9_-]{43}$/.test(get('x-rosevear-signature')))deny();
 // No implicit wildcard, defaults, partial tenant match or key fallbacks.
 const entry=await registry({source:request.source,destination:request.destination,
  business:request.business,tenant:request.tenant,environment:'nonproduction',
  method:'GET',path,keyId:request.keyId});
 if(!entry||entry.revoked===true||entry.environment!=='nonproduction'||
  entry.source!==request.source||entry.destination!==request.destination||
  entry.business!==request.business||entry.tenant!==request.tenant||entry.keyId!==request.keyId||
  !Array.isArray(entry.paths)||!entry.paths.includes(path)||
  !Array.isArray(entry.scopes)||!entry.scopes.includes('read_service_health')||
  !Buffer.isBuffer(entry.secret)||entry.secret.length!==32||entry.serviceEnabled!==true||
  entry.modules?.includes('jobs')!==true)deny();
 const expected=Buffer.from(signGet(entry.secret,request),'base64url');
 const received=Buffer.from(get('x-rosevear-signature'),'base64url');
 if(expected.length!==received.length||!timingSafeEqual(expected,received))deny();
 const claimed=await claimNonce({source:request.source,business:request.business,tenant:request.tenant,
  keyId:request.keyId,nonce:request.nonce,expiresAt:Number(request.timestamp)+300000});
 if(claimed!==true)deny();
 // This proves authenticated request syntax ONLY; it never grants a pilot.
 return Object.freeze({connection_status:'HOLD',tenant_id:request.tenant,
  method:'GET',path,capabilities_enabled:false,events_enabled:false,commands_enabled:false});
}
