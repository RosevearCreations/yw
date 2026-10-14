import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('js/material-issue-return-reconciliation-398.js','utf8');
const index=fs.readFileSync('index.html','utf8');
for(const token of ['fetchJobsDirectory','material_stock_control','inventory_tracked','usage_variance_quantity','stock_on_hand','current_unit_cost','BLOCKED / UNAVAILABLE','job issue/return matching UNVERIFIED','button.disabled=true','materials.length>=1500'])assert.ok(s.includes(token),'Missing '+token);
assert.match(index,/material-issue-return-reconciliation-398\.js\?v=20261014b398/);
assert.ok(!/manageJobsEntity|\.insert\(|\.update\(|\.delete\(/.test(s),'Read-only reconciliation must not write');
console.log('Build 398 read-only source contract passed');
