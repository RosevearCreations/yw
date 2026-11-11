import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const sql=read('sql/landscape_booking_decisions_554.sql');
const ui=read('js/landscape-booking-review-554.js');
const html=read('index.html');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const release=read('scripts/release-job-separation-check.mjs');
const must=(value,parts,subject)=>parts.forEach(part=>
 assert.ok(value.includes(part),`${subject} missing ${part}`));

must(sql,[
 'ywi_landscape_booking_decisions_554','ywi_landscape_booking_decision_audit_554',
 'enable row level security','from public,anon,authenticated',
 "coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false",
 'owner_user_id=(select auth.uid())','grant select on public.ywi_landscape_booking_decisions_554 to authenticated',
 'perform public.ywi_422_assert_owner(p_company_id)',
 'from public.ywi_landscape_booking_requests_552',
 'where company_id=p_company_id and id=p_request_id for update',
 'perform public.ywi_421_assert_company_new_work',
 'public.ywi_rpc_landscape_availability_553(p_company_id,p_request_id,v_day)',
 "v_availability->>'availability_state'<>'review'",
 "v_availability->>'capacity_state'<>'potential_headroom'",
 'pg_catalog.pg_advisory_xact_lock','v_minutes+v_reserved>',
 'p_expected_version','idempotency_key','payload_hash',
 'approved_pending_dispatch','requote_draft','review_hold','declined',
 'terminal decision cannot be silently overwritten',
 'revised quote needs separately verified customer agreement',
 'on conflict(company_id,request_id) do update',
 'revoke all on function public.ywi_rpc_landscape_decide_554(',
 'grant execute on function public.ywi_rpc_landscape_decide_554('
],'554 SQL');
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_booking_decisions_554\s+to\s+authenticated/i.test(sql),
 '554 ledger may not allow direct authenticated writes');
assert.ok(!/\b(?:insert into|update|delete from)\s+public\.(?:work_orders|dispatch_schedule_items|ywi_landscape_booking_requests_552)/i.test(sql),
 '554 may not mutate canonical Jobs/Dispatch or original customer requests');
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon/i.test(sql),'554 must not expose the RPC to anon');

must(ui,[
 'owner554','owner554Request','owner554Quote','owner554Decline','owner554Hold',
 'owner554Approve','owner554Check','owner554Client','owner554Site','owner554Attest',
 'sb.auth.getUser()','owner_user_id!==id',
 "sb.rpc('ywi_rpc_landscape_decide_554'",
 "sb.rpc('ywi_rpc_landscape_availability_553'",
 "sb.rpc('ywi_rpc_company_customers_422'",
 "sb.rpc('ywi_rpc_customer_history_422'",
 'decision_version','p_idempotency_key:key()',
 'no_dispatch_write!==true','no_customer_message!==true',
 "document.addEventListener('ywi:auth-changed'"
], '554 UI');
assert.ok(!ui.includes('.upsert('),'554 may not upsert customer or tenant data directly');
assert.ok(!/\.innerHTML\s*=\s*(?![\x27\x22`])/m.test(ui),'No unsanitized dynamic HTML injection');
must(html,['landscape-booking-review-554.js'], 'app HTML');
must(help,['landscape-booking-review-554','approved_pending_dispatch'],'help');
assert.ok(pkg.scripts['test:landscape-booking-review-554']);
assert.ok(pkg.scripts['test:browser:landscape-booking-review-554']);
must(workflow,['npm run test:landscape-booking-review-554','npm run test:browser:landscape-booking-review-554'],'protected CI');
must(release,['221 browser suites','111 direct lane calls'],'release browser suite accounting');
console.log('YW554 company-owner, CRM/553/Dispatch boundary, atomic audit + browser CI: PASS');
