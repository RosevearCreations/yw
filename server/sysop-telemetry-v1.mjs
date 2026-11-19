import {createPrivateKey,randomBytes,randomUUID,sign,timingSafeEqual} from 'node:crypto';
export const SYSOP_TELEMETRY_PATH='/internal/rosevear/sysop/telemetry/v1';
export const SYSOP_TELEMETRY_SCHEMA='rosevear.sysop.statistics.v1';
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const safeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Access-Control-Allow-Origin':'none'}});
export async function handleSysopTelemetry({request,env=process.env,sourceCommit,nowMs=Date.now()}={}){
 const url=new URL(request.url);
 if(request.method!=='GET')return response({state:'DENY_METHOD',connected:false,authorizesAction:false},405);
 if(url.pathname!==SYSOP_TELEMETRY_PATH||url.search||url.hash)return response({state:'DENY_SCOPE',connected:false,authorizesAction:false},404);
 const token=env.ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN,pem=env.ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM;
 const commit=sourceCommit||env.VERCEL_GIT_COMMIT_SHA||env.GITHUB_SHA||'';
 if(!token||!pem||!/^[a-f0-9]{40}$/.test(commit))return response({state:'NOT_ENROLLED',connected:false,authorizesAction:false},503);
 if(!safeEqual(request.headers.get('x-rosevear-telemetry-token')||'',token))return response({state:'NOT_AUTHORIZED',connected:false,authorizesAction:false},401);
 try{
  const payload={schema:SYSOP_TELEMETRY_SCHEMA,protocolVersion:'1.1',appId:'yw',sourceCommit:commit,eventId:randomUUID().replaceAll('-',''),nonce:randomBytes(16).toString('hex'),issuedAtMs:nowMs,expiresAtMs:nowMs+60000,state:'UNKNOWN',metricsWindowSeconds:60,
   metrics:{requests:null,serverErrors:null,jobsCompleted:null,jobsFailed:null,queueDepth:null,latencyP95Ms:null,activeSessions:null},
   sysop:{eventKind:'HEARTBEAT',observedAtMs:nowMs,processUptimeSec:null,restartCount:null,lastRestartAtMs:null,bootTimeMs:null,rebootIsIndependentlyWitnessed:false},
   dataClass:'NON_SENSITIVE_AGGREGATE',tenantId:null,authorizesAction:false};
  const signature=sign(null,Buffer.from(canonical(payload)),createPrivateKey(pem)).toString('hex');
  return response({payload,signature});
 }catch{return response({state:'HOLD_SIGNER_UNAVAILABLE',connected:false,authorizesAction:false},503);}
}
