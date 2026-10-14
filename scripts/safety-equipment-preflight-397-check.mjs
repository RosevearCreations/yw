import assert from 'node:assert/strict';
import fs from 'node:fs';
const script=fs.readFileSync('js/safety-equipment-preflight-397.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert.match(index,/\/js\/safety-equipment-preflight-397\.js\?v=20261014b397/);
for(const s of ['fetchJobsDirectory','scope:\'all\'','LOCKED','lockout','BLOCKED / UNVERIFIED','Safety','training','inspection','rows.replaceChildren()','busy=true','button.disabled=true']){
  assert.ok(script.includes(s), 'Missing preflight safeguard '+s);
}
assert.ok(!/manageJobsEntity|manageSafety|updateJob|\.insert\(|\.update\(|\.delete\(/.test(script),'Preflight must not mutate canonical records');
assert.ok(script.includes('jobs.length>150'),'Cannot silently clear capped job lists');
assert.ok(script.includes('Array.isArray(v?.requirements)')&&script.includes('Array.isArray(v?.equipment)'),'Required evidence must be present');
console.log('Build 397 preflight source acceptance passed');
