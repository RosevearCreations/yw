import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifySourceShellGet,PATHS,CONTRACT} from '../server/rosevear-shell-ql335.mjs';
import health from '../api/integration/v1/shell/health.js';
import capabilities from '../api/integration/v1/shell/capabilities.js';

const now=Date.now();
const issuer=generateKeyPairSync('ed25519');
const source=generateKeyPairSync('ed25519');
const hex='a'.repeat(64);
const id='12345678-1234-4234-8234-123456789abc';
const canonical=v=>v&&typeof v==='object'&&!Array.isArray(v)?
  '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const trust={originalSourceOwnerTest:true,originalMasterOwnerTest:true,verifiedWorkload:true,
  verifiedIssuer:true,manifestVerified:true,keyHandleActive:true,pinnedOriginVerified:true,
  manifestSha256:hex,ownerReceiptSha256:hex,sourceOwnerReceiptSha256:hex,
  workloadId:id,brokerKeyId:'broker-test-key-2026',
  pinnedBrokerPublicKeyPem:issuer.publicKey.export({type:'spki',format:'pem'})};
const challenge=path=>({status:'SHELL_TEST_CHALLENGE',contract:CONTRACT,shell_id:'yw',
  source_app_id:'yard-workers',environment:'nonproduction',method:'GET',path,
  issuer:'ai-data-platform',audience:'yard-workers',scope:path.endsWith('/health')?'read_shell_health':'read_shell_capabilities',
  nonce:'a'.repeat(43),issued_at:now,expires_at:now+90_000,
  manifest_sha256:hex,owner_receipt_sha256:hex,source_owner_receipt_sha256:hex,
  workload_id:id});
function options(path=PATHS[0]){
  const c=challenge(path);
  return {path,method:'GET',runtime:'nonproduction',nowMs:now,query:{},trust,
    headers:{'x-rosevear-shell-envelope':Buffer.from(JSON.stringify({challenge:c,
      signature:sign(null,Buffer.from(canonical(c)),issuer.privateKey).toString('base64url'),
      keyId:'broker-test-key-2026'})).toString('base64url')},
    claimNonce:async()=>true,signWithSourceKms:async data=>({attested:true,
      signature:sign(null,data,source.privateKey).toString('base64url'),keyId:'source-test-key-2026'})};
}
test('YW platform shell independently signs both read-only nonproduction test paths',async()=>{
  for(const path of PATHS){
    const r=await verifySourceShellGet(options(path));
    assert.equal(r.httpStatus,200);
    assert.equal(r.envelope.receipt.shell_id,'yw');
    assert.equal(r.envelope.receipt.tenant_data_included,false);
    assert.equal(r.connected,false);
  }
});
test('YW denies missing trust, child injection, replay, tampering and production',async()=>{
  const base=options();
  assert.equal((await verifySourceShellGet({...base,trust:undefined})).httpStatus,503);
  assert.equal((await verifySourceShellGet({...base,runtime:'production'})).authenticated,false);
  assert.equal((await verifySourceShellGet({...base,claimNonce:async()=>false})).httpStatus,409);
  assert.equal((await verifySourceShellGet({...base,query:{tenant:id}})).authenticated,false);
  const tampered=options();
  const envelope=JSON.parse(Buffer.from(tampered.headers['x-rosevear-shell-envelope'],'base64url'));
  envelope.challenge.tenant_id=id;
  tampered.headers['x-rosevear-shell-envelope']=Buffer.from(JSON.stringify(envelope)).toString('base64url');
  assert.equal((await verifySourceShellGet(tampered)).authenticated,false);
});
test('deployed YW source endpoints have no synthetic signer or tenant fallback',async()=>{
  for(const handler of [health,capabilities]){
    const response={headers:{},setHeader(k,v){this.headers[k]=v;return this;},
      status(n){this.statusCode=n;return this;},json(o){this.body=o;return this;}};
    await handler({method:'GET',query:{},headers:{}},response);
    assert.equal(response.statusCode>=400,true);
    assert.equal(response.body.connected,false);
    assert.equal(response.body.authenticated,false);
  }
});
