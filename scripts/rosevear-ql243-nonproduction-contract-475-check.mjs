import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {canonicalGet,signGet,verifyNonproductionGet,emptyBodyHash}
 from '../server/rosevear-integration-ql243.mjs';
const tenant=randomUUID(),secret=randomBytes(32),now=1790000000000;
const req={path:'/api/integration/v1/health',timestamp:String(now),nonce:'np-'+randomBytes(16).toString('hex'),
 source:'ai-data-platform',destination:'yw',business:'yw',tenant,keyId:'np-yw-company-key'};
assert.equal(canonicalGet(req).split('\n').length,12);
assert.equal(canonicalGet(req).split('\n')[10],emptyBodyHash);
assert.ok(!canonicalGet(req).endsWith('\n'));
const headers={'x-rosevear-contract':'rosevear.integration.v1',
 'x-rosevear-environment':'nonproduction','x-rosevear-timestamp':req.timestamp,
 'x-rosevear-nonce':req.nonce,'x-rosevear-source':req.source,
 'x-rosevear-destination':req.destination,'x-rosevear-business':req.business,
 'x-rosevear-tenant':tenant,'x-rosevear-key-id':req.keyId,
 'x-rosevear-signature':signGet(secret,req)};
const scopes=['read_service_health'];
const registry=async()=>({source:req.source,destination:req.destination,business:req.business,
 tenant,keyId:req.keyId,environment:'nonproduction',paths:[req.path],
 scopes,serviceEnabled:true,modules:['jobs'],secret});
const used=new Set();
const claimNonce=async({source,business,tenant,keyId,nonce})=>{
 const id=[source,business,tenant,keyId,nonce].join(':');if(used.has(id))return false;used.add(id);return true;};
const base={method:'GET',path:req.path,headers,runtime:'nonproduction',registry,claimNonce,now};
assert.equal((await verifyNonproductionGet(base)).connection_status,'HOLD');
await assert.rejects(verifyNonproductionGet(base),/NONPRODUCTION_HOLD_DENIED/,'nonce replay');
const variant=(changes={})=>({...base,claimNonce:async()=>true,...changes});
for(const [name,changes] of [
 ['production',{runtime:'production'}],['write',{method:'POST'}],
 ['path',{path:'/api/integration/v1/commands'}],['query',{query:{tenant:'steal'}}],
 ['unsigned',{headers:{...headers,'x-rosevear-signature':'bad'}}],
 ['wrong company',{headers:{...headers,'x-rosevear-business':'icamp'}}],
 ['wrong tenant',{headers:{...headers,'x-rosevear-tenant':randomUUID()}}],
 ['stale',{now:now+301000}],['future',{now:now-301000}],
 ['wrong source',{headers:{...headers,'x-rosevear-source':'rosevear-comms-hub'}}],
 ['revoked',{registry:async()=>({...await registry(),revoked:true})}],
 ['disabled module',{registry:async()=>({...await registry(),modules:[]})}],
 ['disabled service',{registry:async()=>({...await registry(),serviceEnabled:false})}],
 ['missing scope',{registry:async()=>({...await registry(),scopes:[]})}],
 ['rotated key',{registry:async()=>({...await registry(),keyId:'rotated-key'})}],
 ['missing durable nonce store',{claimNonce:undefined}],
 ['fake nonce store',{claimNonce:async()=>false}],
 ['mismatched signature',{headers:{...headers,'x-rosevear-signature':signGet(randomBytes(32),req)}}]
])await assert.rejects(verifyNonproductionGet(variant(changes)),/NONPRODUCTION_HOLD_DENIED/,name);
// The existing public static discovery is not an authenticated connection.
assert.equal(existsSync('server/rosevear-integration-ql243.mjs'),true);
const build=readFileSync('scripts/build-vercel-site.mjs','utf8');
assert.ok(build.includes('static site, not Vercel Functions'));
assert.ok(!build.includes("'server'"));
const docs=readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
assert.match(docs,/QL-243/);
console.log('YW 475/QL-243: canonical HMAC, tenant/module, stale/replay/revocation negatives and no live connector: PASS');
