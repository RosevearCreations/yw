import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,verify} from 'node:crypto';
import {handleQl364SourceHealth,hashQl364,canonicalQl364,
  QL364_PATH,QL364_ENVELOPE_SCHEMA,QL364_REPOSITORY} from '../server/ql364-source-health.mjs';
import deployedHealth from '../api/integration/v1/shell/health.js';
import {readFileSync} from 'node:fs';

const now=Date.UTC(2026,10,7,12,0,0);
const sourceId='yw',repository=QL364_REPOSITORY;
const keyPair=generateKeyPairSync('ed25519');
const spkiSha256=createHash('sha256').update(keyPair.publicKey.export({format:'der',type:'spki'})).digest('hex');
const intent=()=>({schema:'rosevear.hub.ql362.source-owner-one-get.v1',
  kind:'ONE_PRIVATE_HEALTH_GET_INTENT',archiveId:'offline-test-fixture',
  handoffSha256:'a'.repeat(64),sourceId,repository,
  operationId:'12345678-1234-4123-8123-123456789012',
  sourceCommitSha:'b'.repeat(40),manifestSha256:'c'.repeat(64),
  sourceOrigin:'https://original.example',environment:'TEST',method:'GET',
  path:QL364_PATH,issuedAt:new Date(now-1000).toISOString(),
  expiresAt:new Date(now+30000).toISOString(),customerDataAllowed:false,
  deviceActionsAllowed:false,persistentConnectionAllowed:false});
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const request=(v,method='GET',extra={})=>new Request('https://original.example'+QL364_PATH,{
  method,headers:{'x-rosevear-ql362-request':encode(v),...extra}});
function privateAdapters() {
  const used=new Set();
  return {
    approveOriginalGet:async ({requestSha256,operationId,intent:v})=>({
      state:'INDEPENDENT_ORIGINAL_SOURCE_AND_MASTER_OWNER_TEST_AUTHORIZED',
      sourceId,operationId,requestSha256,sourceCommitSha:v.sourceCommitSha,
      manifestSha256:v.manifestSha256,sourceOrigin:v.sourceOrigin,
      revoked:false,originalIssuerVerified:true,sourceOwnerVerified:true,
      masterOwnerVerified:true,originalSignerCustodyVerified:true,
      sourceSignerSpkiSha256:spkiSha256}),
    claimOperation:async ({operationId})=>{
      if(used.has(operationId))return false;
      used.add(operationId);return true;},
    signSourceReceipt:async bytes=>({
      attested:true,spkiSha256,keyId:'synthetic-only-k01',
      signature:sign(null,bytes,keyPair.privateKey).toString('base64url')})
  };
}
test('QL364 default original-owner trust HOLD; never uses a tenant or integration secret',async()=>{
  const result=await handleQl364SourceHealth({request:request(intent()),sourceId,repository,now});
  assert.equal(result.status,503);
  assert.equal((await result.json()).connected,false);
});
test('QL364 one verified private GET returns exact source-signed, redacted QL363 receipt',async()=>{
  const adapters=privateAdapters(),req=request(intent());
  const result=await handleQl364SourceHealth({request:req,sourceId,repository,now,...adapters});
  assert.equal(result.status,200);
  assert.equal(result.headers.get('Cache-Control'),'private, no-store');
  const body=await result.json();
  assert.equal(body.schema,QL364_ENVELOPE_SCHEMA);
  assert.deepEqual(Object.keys(body).sort(),['health','receipt','schema']);
  assert.equal(body.health.connected,false);
  assert.equal(body.health.customerDataAllowed,false);
  assert.equal(body.health.deviceActions,false);
  assert.equal(body.receipt.payload.receiptSha256,await hashQl364(body.health));
  assert.equal(body.receipt.payload.requestSha256,await hashQl364(intent()));
  assert.equal(verify(null,Buffer.from(canonicalQl364(body.receipt.payload)),
    keyPair.publicKey,Buffer.from(body.receipt.signature,'base64url')),true);
  assert.equal((await handleQl364SourceHealth({request:req,sourceId,repository,now,...adapters})).status,409);
});
test('QL364 rejects scope escalation, expiry, wrong source, unverified signer and mutation',async()=>{
  const adapters=privateAdapters();
  for(const v of [{...intent(),customerDataAllowed:true},{...intent(),sourceId:'unexpected-source'},
    {...intent(),expiresAt:new Date(now-500).toISOString()}]){
    assert.equal((await handleQl364SourceHealth({request:request(v),
      sourceId,repository,now,...adapters})).status,403);
  }
  assert.equal((await handleQl364SourceHealth({
    request:request(intent(),'POST'),sourceId,repository,now,...adapters})).status,405);
  assert.equal((await handleQl364SourceHealth({
    request:request(intent(),'GET',{'x-child-id':'some-tenant'}),
    sourceId,repository,now,...adapters})).status,403);
  assert.equal((await handleQl364SourceHealth({
    request:request(intent()),sourceId,repository,now,
    ...adapters,signSourceReceipt:async()=>({attested:false})})).status,503);
});
test('QL365D binds YW platform shell, immutable revision and full source repository',async()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/.well-known/rosevear-integration-manifest.json',import.meta.url)));
  assert.equal(manifest.source_id,sourceId);
  assert.equal(manifest.source_app_id,'yard-workers');
  assert.equal(manifest.source_role,'platform_shell');
  assert.equal(manifest.tenant_boundary,'platform_shell');
  assert.equal(manifest.repository,QL364_REPOSITORY);
  assert.equal(manifest.audience,'rosevear-master');
  assert.equal(manifest.source_revision,null);
  assert.equal(manifest.source_revision_state,'HOLD_UNVERIFIED_SOURCE_REVISION');
  assert.equal(manifest.source_revision_binding.production,'build_time_vercel_git_commit_sha');
  assert.equal(manifest.signature.state,'AWAITING_INDEPENDENT_SOURCE_SIGNER');
  for(const wrong of [{sourceId:'icamp',repository},{sourceId,repository:'yw'}]){
    assert.equal((await handleQl364SourceHealth({request:request(intent()),
      ...wrong,now,...privateAdapters()})).status,403);
  }
  const wrongIntent={...intent(),repository:'yw'};
  assert.equal((await handleQl364SourceHealth({request:request(wrongIntent),
    sourceId,repository,now,...privateAdapters()})).status,403);
});
test('QL365D deployed health endpoint has only fail-closed QL362 protocol',async()=>{
  async function call({method='GET',url=QL364_PATH,headers={}}={}){
    const response={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this;},
      status(n){this.statusCode=n;return this;},json(o){this.body=o;return this;}};
    await deployedHealth({method,url,headers,query:{}},response);
    return response;
  }
  const legacy=await call({headers:{'x-rosevear-shell-envelope':'synthetic'}});
  assert.equal(legacy.statusCode,503);
  assert.equal(legacy.body.connected,false);
  assert.equal(legacy.body.authenticated,false);
  const field=await call({headers:{'x-rosevear-ql362-request':encode(intent())}});
  assert.equal(field.statusCode,503);
  assert.equal(field.body.connectionState,'DISCONNECTED / HOLD');
  assert.equal((await call({method:'POST'})).statusCode,405);
  assert.equal((await call({url:QL364_PATH+'?tenant=rosevear-landscaping'})).statusCode,403);
});
test('QL365D requires original owner decisions, exact source revision and one-use custody',async()=>{
  const denied=[
    {approveOriginalGet:async()=>({state:'PENDING_APPROVAL'})},
    {approveOriginalGet:async ({requestSha256,operationId,intent:v})=>({
      state:'INDEPENDENT_ORIGINAL_SOURCE_AND_MASTER_OWNER_TEST_AUTHORIZED',
      sourceId,operationId,requestSha256,sourceCommitSha:'f'.repeat(40),
      manifestSha256:v.manifestSha256,sourceOrigin:v.sourceOrigin,revoked:false,
      originalIssuerVerified:true,sourceOwnerVerified:true,masterOwnerVerified:true,
      originalSignerCustodyVerified:true,sourceSignerSpkiSha256:spkiSha256})},
    {claimOperation:async()=>false},
    {signSourceReceipt:async()=>({attested:true,spkiSha256:'e'.repeat(64),
      keyId:'untrusted-source-key',signature:'a'.repeat(86)})},
  ];
  for(const overrides of denied){
    const result=await handleQl364SourceHealth({request:request(intent()),
      sourceId,repository,now,...privateAdapters(),...overrides});
    assert.notEqual(result.status,200);
    assert.equal((await result.json()).connected,false);
  }
  const extra={...intent(),tenantId:'rosevear-landscaping'};
  assert.equal((await handleQl364SourceHealth({request:request(extra),
    sourceId,repository,now,...privateAdapters()})).status,403);
});

