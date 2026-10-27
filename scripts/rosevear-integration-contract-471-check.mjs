import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import health from '../api/integration/v1/health.js';
import capabilities from '../api/integration/v1/capabilities.js';
const invoke=(handler,method)=>{
 const headers={};let statusCode=200;
 const res={setHeader:(k,v)=>{headers[k.toLowerCase()]=v;return res;},
  status:(n)=>{statusCode=n;return res;},json:(body)=>({body,statusCode,headers})};
 return handler({method,query:{tenant_id:'should-not-appear'},headers:{authorization:'Bearer secret'}},res);
};
for(const handler of [health,capabilities]){
 const {body,statusCode,headers}=invoke(handler,'GET');
 assert.equal(statusCode,200);assert.equal(body.contract_version,'1');
 assert.equal(body.app_id,'yard-workers');assert.equal(body.connection_status,'HOLD');
 assert.equal(body.events_enabled,false);assert.equal(body.commands_enabled,false);
 assert.match(headers['cache-control'],/no-store/);
 assert.equal(headers['access-control-allow-origin'],undefined);
 assert.ok(!JSON.stringify(body).includes('secret'));
 assert.ok(!JSON.stringify(body).includes('should-not-appear'));
 const post=invoke(handler,'POST');assert.equal(post.statusCode,405);
 assert.equal(post.headers.allow,'GET');
}
const c=invoke(capabilities,'GET').body;
assert.equal(c.tenant_scope,'required_before_connection');
assert.equal(c.service_module_scope,'required_before_connection');
assert.equal(c.owner_approval_required,true);
assert.ok(c.capabilities.length>=7);
assert.ok(c.capabilities.every(x=>x.enabled===false&&typeof x.name==='string'));
for(const name of ['read_client','read_property','read_job','read_route','create_handoff'])
 assert.ok(c.capabilities.some(x=>x.name===name));
const docs=readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
assert.match(docs,/AI Data Platform/);assert.match(docs,/signed server-to-server credentials/);
assert.match(docs,/No YW database credentials may be given to another application/);
console.log('Rosevear Integration v1: read-only identity, HOLD, disabled capabilities and no data leakage: PASS');
