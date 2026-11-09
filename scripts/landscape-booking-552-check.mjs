import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteFor,seasonFor} from '../supabase/functions/landscape-booking-552/pricing.mjs';

const company='11111111-1111-4111-8111-111111111111';
const base={company_id:company,active:true,code:'mow',name:'Lawn mowing',item_type:'service',unit:'visit',base_price_cents:7500,spring_price_cents:6500};
const fee={...base,code:'dump',name:'Estimated dump fee',item_type:'disposal',unit:'load',base_price_cents:2000,spring_price_cents:null};
assert.deepEqual(seasonFor('2027-04-15','2026-11-09'),{season:'spring',requestedDate:'2027-04-15'});
assert.equal(seasonFor(null,'2026-11-09').season,'fall');
for(const value of ['2026-02-30','2025-11-09','2028-11-09','no'])assert.throws(()=>seasonFor(value,'2026-11-09'),/date|month/i);
const q=quoteFor(company,[base,fee],[{code:'mow',quantity:2},{code:'dump',quantity:1}],'spring');
assert.equal(q.subtotal_cents,15000);
assert.equal(q.disposal_estimate_cents,2000);
assert.equal(q.availability_confirmed,false);
assert.equal(q.tax_included,false);
assert.equal(q.lines[0].unit_price_cents,6500);
for(const [rows,selections] of [
 [[{...base,company_id:'other'}],[{code:'mow',quantity:1}]],
 [[{...base,active:false}],[{code:'mow',quantity:1}]],
 [[base],[{code:'fake',quantity:1}]],
 [[base],[{code:'mow',quantity:0}]],
 [[base],[{code:'mow',quantity:1.5}]],
 [[base],[{code:'mow',quantity:1},{code:'mow',quantity:2}]],
 [[fee],[{code:'dump',quantity:1}]],
 [[base],[{code:'mow',quantity:101}]],
])assert.throws(()=>quoteFor(company,rows,selections,'spring'));

const sql=fs.readFileSync('sql/landscape_booking_request_552.sql','utf8');
const edge=fs.readFileSync('supabase/functions/landscape-booking-552/index.ts','utf8');
const js=fs.readFileSync('js/landscape-booking-552.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const cfg=fs.readFileSync('supabase/config.toml','utf8');
const api=fs.readFileSync('js/api.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const must=(source,strings,label)=>strings.forEach(term=>assert.ok(source.includes(term),`${label}: missing ${term}`));
must(sql,['enable row level security','revoke all on public.ywi_landscape_booking_requests_552 from public, anon, authenticated',
 'grant select on public.ywi_landscape_booking_requests_552 to authenticated','owner_user_id=(select auth.uid())',
 'idempotency_key','unique (company_id, idempotency_key)','request_status = \'owner_review\'',
 'ywi_company_booking_public_settings_552','public_enabled boolean not null default false'], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_booking_requests_552\s+to\s+(?:anon|authenticated)/i.test(sql));
must(edge,['quoteFor(companyId, rows, selections, season)','body.quote_digest !== quoteDigest',
 'body.privacy_consent !== true','idempotency_key','created_at','landscape','enabled.data?.enabled !== true',
 "action === 'catalogue'","action === 'preview'","status: 'owner_review'",'quotation_snapshot',
 'published.data?.public_enabled !== true'], 'Edge');
assert.ok(!/sendToFunction\(['"](?:comms|stripe|dispatch)/i.test(edge));
must(js,['owner552Requests','booking552Form','booking552Preview','booking552Submit','request_status',
 'privacy_consent','quote_digest','booking_company','owner552Link','owner552Access',
 'publishingRowExists', '.insert({company_id:companyId,public_enabled:true})',
 '.update({public_enabled:enable})'], 'client');
assert.ok(!js.includes('.upsert('),'Public publishing owner toggle must use column-restricted insert/update, never upsert');
must(html,['id="landscaping-quote-552"','landscape-booking-552.js'], 'HTML');
must(cfg,['[functions.landscape-booking-552]','verify_jwt = false'], 'config');
must(api,["jsonFetch('landscape-booking-552'",'landscapeBooking552,'], 'API');
assert.ok(pkg.scripts['test:landscape-booking-552'] && pkg.scripts['test:browser:landscape-booking-552']);
must(workflow,['npm run test:landscape-booking-552','npm run test:browser:landscape-booking-552'], 'CI');
console.log('YW 552 pricing, company isolation, request-only RLS, consent and CI: PASS');
