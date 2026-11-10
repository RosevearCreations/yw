import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const sql=read('sql/landscape_canonical_handoff_555.sql');
const ui=read('js/landscape-canonical-handoff-555.js');
const html=read('index.html');
const help=read('help.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const release=read('scripts/release-job-separation-check.mjs');
const must=(src,terms,what)=>terms.forEach(x=>assert.ok(src.includes(x),`${what}: missing ${x}`));

must(sql,[
 'ywi_landscape_canonical_handoffs_555','ywi_landscape_handoff_audit_555',
 'enable row level security','from public,anon,authenticated',
 "coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false",
 'owner_user_id=(select auth.uid())',
 'perform public.ywi_422_assert_owner(p_company_id)',
 'perform public.ywi_422_assert_jobs_create()',
 "perform public.ywi_421_assert_company_new_work(p_company_id,'landscape'",
 'perform public.ywi_422_assert_link(',
 'p_idempotency_key','p_expected_version','p_decision_version','payload_hash',
 'for update','idempotent_replay',
 "v_decision.decision_state<>'approved_pending_dispatch'",
 "v_estimate.status<>'accepted'", "v_quote.package_status<>'accepted'",
 'v_quote.accepted_at<v_request.created_at',
 'v_estimate.deposit_required_percent',
 'v_paid<v_required',
 'public.ywi_rpc_landscape_availability_553',
 'public.ywi_rpc_job_dispatch_preflight_434',
 'v_dispatch.work_order_id is distinct from p_work_order_id',
 'v_dispatch.crew_id is null',
 'v_preflight->>\'release_signed\'<>\'true\'',
 "v_dispatch_proof->>'conflict_count'",
 'awaiting_original_job','awaiting_crew_dispatch','verified_crew_handoff',
 'on conflict(company_id,request_id) do update',
 'unique(company_id,estimate_id)','unique(company_id,work_order_id)',
 'grant execute on function public.ywi_rpc_landscape_canonical_handoff_555('
],'555 server contract');
assert.ok(!/\b(?:insert into|update|delete from)\s+public\.(?:work_orders|estimates|dispatch_schedule_items|jobs|ywi_landscape_booking_requests_552|ywi_landscape_booking_decisions_554|customer_deposit_requests)/i.test(sql),
 '555 may only persist its own handoff and audit, never change canonical source records');
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_(?:canonical_handoffs|handoff_audit)_555\s+to\s+authenticated/i.test(sql),
 'No direct authenticated ledger writes');
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon/i.test(sql),'No anonymous RPC grants');

must(ui,[
 'owner555','owner555Company','owner555Request','owner555Candidate',
 'owner555Stage','owner555Link','owner555Crew','owner555Attest',
 'sb.auth.getUser()', 'owner_user_id!==id',
 "sb.rpc('ywi_rpc_landscape_handoff_candidates_555'",
 "sb.rpc('ywi_rpc_landscape_canonical_handoff_555'",
 'p_idempotency_key:freshKey()', 'p_expected_version:h?.handoff_version||0',
 'original_source_writes!==false',
 "document.addEventListener('ywi:auth-changed'",
 'HOLD / NOT VERIFIED'
],'555 owner UI');
assert.ok(!/\.from\(['"](?:work_orders|dispatch_schedule_items|estimates|jobs)['"]\)\s*\.(?:insert|update|delete|upsert)/i.test(ui),
 '555 browser cannot change original operational sources');
assert.ok(!/\.innerHTML\s*=\s*(?!['"`])/m.test(ui),'UI has no unescaped data-driven HTML writes');
must(html,['landscape-canonical-handoff-555.js'], 'app');
must(help,['landscape-canonical-handoff-555','awaiting_original_job'], 'help');
assert.ok(pkg.scripts['test:landscape-canonical-handoff-555']);
assert.ok(pkg.scripts['test:browser:landscape-canonical-handoff-555']);
must(workflow,['npm run test:landscape-canonical-handoff-555','npm run test:browser:landscape-canonical-handoff-555'],'protected CI');
must(release,['219 browser suites','109 direct lane calls'],'release lane equivalence');
console.log('YW555 original Jobs/Dispatch agreement, owner isolation, idempotent audit and CI boundary: PASS');
