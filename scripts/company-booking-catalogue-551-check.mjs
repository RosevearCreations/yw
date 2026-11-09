import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('js/company-booking-catalogue-551.js','utf8');
const sql=fs.readFileSync('sql/company_booking_catalogue_551.sql','utf8');
const html=fs.readFileSync('index.html','utf8');
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const context={window:{},document:{readyState:'loading',addEventListener(){}},Intl,Number,Set,Error};
vm.runInNewContext(code,context);
const {cents,priceFor,verifiedRows}=context.window.YWI551;
assert.equal(cents('42.08'),4208);
assert.equal(cents('0'),0);
assert.equal(cents('',true),null);
for(const invalid of ['-1','1.999','1e5','1000000.01','hello',' 2,000 '])
 assert.throws(()=>cents(invalid),/price|range/i);
assert.equal(priceFor({base_price_cents:7500,fall_price_cents:0},'fall'),0);
assert.equal(priceFor({base_price_cents:7500,spring_price_cents:null},'spring'),7500);
const row={id:'id-1',code:'mow',company_id:'company-a',item_type:'service',unit:'visit',active:true,base_price_cents:100};
assert.equal(verifiedRows([row],'company-a').length,1);
assert.throws(()=>verifiedRows([{...row,company_id:'company-b'}],'company-a'),/tenant/i);
assert.throws(()=>verifiedRows([row,row],'company-a'),/invalid/i);
assert.throws(()=>verifiedRows([{...row,base_price_cents:-1}],'company-a'),/invalid/i);
for(const requirement of [
 'enable row level security','ywi_booking_catalogue_owner_read_551','ywi_booking_catalogue_owner_create_551',
 'ywi_booking_catalogue_owner_update_551','ywi_booking_catalogue_audit_owner_read_551',
 'security definer','owner_user_id=(select auth.uid())','item_type in',
 'spring_price_cents','summer_price_cents','fall_price_cents','winter_price_cents'
])assert.ok(sql.toLowerCase().includes(requirement.toLowerCase()),`SQL missing ${requirement}`);
assert.ok(!/grant\s+(?:all|delete)\s+on\s+public\.ywi_company_booking_catalogue_551\s+to\s+(?:anon|authenticated)/i.test(sql));
assert.match(html,/company-booking-catalogue-551\.js/);
assert.match(workflow,/test:browser:company-booking-catalogue-551/);
assert.match(workflow,/test:company-booking-catalogue-551/);
console.log('YW 551 contract, price validation, tenant checks, RLS and CI registration: PASS');
