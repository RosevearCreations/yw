import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_recovery_556.sql');
const ui=read('js/landscape-recovery-556.js');
const portal=read('js/customer-portal.js');
const edge=read('supabase/functions/customer-portal/index.ts');
const html=read('index.html');
const help=read('help.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const release=read('scripts/release-job-separation-check.mjs');
const pkg=JSON.parse(read('package.json'));
const must=(s,words,label)=>words.forEach(word=>assert.ok(s.includes(word),`${label} missing: ${word}`));
must(sql,['ywi_landscape_recovery_cases_556','ywi_landscape_recovery_audit_556',
 'ywi_landscape_customer_confirmations_556','enable row level security',
 'owner_user_id=(select auth.uid())','perform public.ywi_422_assert_owner(p_company_id)',
 'perform public.ywi_422_assert_jobs_create()',
 "v_handoff.state<>'verified_crew_handoff'",'p_expected_version',
 'p_idempotency_key','idempotency key reused','for update',
 'pg_advisory_xact_lock',
 'v_after.supersedes_dispatch_id is distinct from v_before.id',
 'public.ywi_rpc_job_dispatch_preflight_434',
 "v_item->>'conflict_count'","v_preflight->>'release_signed'",
 'v_customer.decision<>\'accepted\'','public.ywi_landscape_replacement_proof_556',
 "current_user<>'service_role'",'v_quote.public_token is distinct from p_public_token',
 'v_case.case_version is distinct from p_case_version',
 'grant execute on function public.ywi_rpc_landscape_customer_confirm_556',
 'to service_role','from public,anon,authenticated'], '556 SQL');
assert.ok(!/\b(?:insert into|update|delete from)\s+public\.(?:work_orders|dispatch_schedule_items|jobs|estimate_quote_packages|ywi_landscape_canonical_handoffs_555|ywi_landscape_booking_decisions_554)\b/i.test(sql),
 '556 may never mutate original operational sources');
assert.ok(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bon\s+public\.ywi_landscape_(?:recovery_cases|recovery_audit|customer_confirmations)_556\s+to\s+authenticated/i.test(sql),
 'No direct authenticated ledger writes');
assert.ok(!/grant\s+execute\b[^;]*\bto\s+anon/i.test(sql),'No anonymous RPC grants');
must(ui,['owner556Company','owner556Request','owner556Replacement','owner556Attest',
 'owner556Open','owner556Verify','owner556Close',
 "sb.rpc('ywi_rpc_landscape_recovery_candidates_556'",
 "sb.rpc('ywi_rpc_landscape_recovery_556'",'p_expected_version:c?.case_version||0',
 'authorizes_original_dispatch_mutation!==false','owner_user_id!==id',
 "document.addEventListener('ywi:auth-changed'",'HOLD'], '556 owner UI');
assert.ok(!/\.from\(['"](?:work_orders|dispatch_schedule_items|jobs)['"]\)\s*\.(?:insert|update|delete|upsert)/i.test(ui),
 'Owner browser cannot mutate original Dispatch');
must(portal,['recoveryConfirmationPanel','customerPortalRecoveryForm',
 "action:'confirm_landscape_recovery'",'Accept revised schedule','Decline and request follow-up'],'customer portal');
must(edge,['portalRecoveryConfirmation','recovery_confirmation',"action === 'confirm_landscape_recovery'",
 "'ywi_rpc_landscape_customer_confirm_556'",'p_public_token:token',
 "['42P01','PGRST205','PGRST116']"], 'service role portal');
must(html,['landscape-recovery-556.js'], 'app index');
must(help,['landscape-recovery-556','Original Dispatcher','service-role-only'], 'help');
assert.ok(pkg.scripts['test:landscape-recovery-556']&&pkg.scripts['test:browser:landscape-recovery-556']);
must(workflow,['npm run test:landscape-recovery-556','npm run test:browser:landscape-recovery-556'],'protected CI');
must(release,['219 browser suites','109 direct lane calls'],'release accounting');
console.log('YW556 original Dispatch authority, tenant boundary, version locks, customer receipts and CI: PASS');
