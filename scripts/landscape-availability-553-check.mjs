import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const sql=read('sql/landscape_availability_553.sql');
const ui=read('js/landscape-availability-553.js');
const html=read('index.html');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const gate=read('scripts/release-job-separation-check.mjs');
const must=(source,phrases,subject)=>phrases.forEach(p=>
 assert.ok(source.includes(p),`${subject} missing ${p}`));

must(sql,[
 'ywi_landscape_service_areas_553','ywi_landscape_capacity_plans_553',
 'enable row level security','from public,anon,authenticated',
 'owner_user_id=(select auth.uid())','is_anonymous',
 'grant insert(company_id,area_key,display_name,coverage_state,active)',
 'grant update(display_name,coverage_state,active)',
 'grant update(crew_count,capacity_minutes,review_note)',
 'ywi_rpc_landscape_availability_553','perform public.ywi_422_assert_owner(p_company_id)',
 'where id=p_request_id and company_id=p_company_id',
 'public.ywi_rpc_shared_capacity_review_435(p_company_id,v_start,v_end)',
 "original_dispatch_fleet_equipment_material_423_435",
 'join public.work_orders w on w.id=d.work_order_id and w.company_id=p_company_id',
 "at time zone 'America/Toronto'",
 "'advisory_only',true","'availability_confirmed',false",
 "'dispatch_authorized',false","'no_business_writes',true",
 'grant execute on function public.ywi_rpc_landscape_availability_553(uuid,uuid,date) to authenticated'
], '553 SQL');
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_booking_requests_552/i.test(sql),
 '553 must not acquire customer-request write authority');
assert.ok(!/grant\s+(?:select|insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_(?:capacity_plans|service_areas)_553\s+to\s+anon/i.test(sql));
must(ui,[
 'owner553','owner553Company','owner553Request','owner553Review',
 'owner553Coverage','owner553CrewCount','owner553Minutes',
 "sb.auth.getUser()","sb.rpc('ywi_rpc_landscape_availability_553'",
 'owner_user_id!==id','result.replaceChildren',
 "proof?.availability_confirmed!==false","proof?.dispatch_authorized!==false",
 "proof?.no_business_writes!==true","document.addEventListener('ywi:auth-changed'",
 "action==='area'","action==='plan'","action==='review'"
], '553 owner UI');
assert.ok(!ui.includes('.upsert('),'553 company-owner column-restricted writes must not upsert');
assert.ok(!/\.innerHTML\s*=\s*(?![\x27\x22`])/m.test(ui),'Avoid dynamic HTML injection');
must(html,['landscape-availability-553.js'], 'HTML');
must(help,['landscape-availability-553','YW 553'], 'Help');
assert.ok(pkg.scripts['test:landscape-availability-553']&&pkg.scripts['test:browser:landscape-availability-553']);
must(workflow,['npm run test:landscape-availability-553','npm run test:browser:landscape-availability-553'],'CI');
must(gate,['221 browser suites','111 direct lane calls'],'release inventory');
console.log('YW 553 owner-only coverage/capacity, canonical 435, read-only HOLD and CI: PASS');
