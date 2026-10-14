import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/237_mobile_production_transition_idempotency.sql');
const edge=read('supabase/functions/mobile-production-transition/index.ts');
const mobile=read('js/mobile-today.js');
const api=read('js/api.js');
const flow=read('.github/workflows/staging-browser-integration.yml');
const pkg=JSON.parse(read('package.json'));
const must=(s,parts,n)=>parts.forEach(p=>assert.ok(s.includes(p),n+' missing '+p));
must(sql,[
 'mobile_production_transition_intents','intent_key uuid primary key',
 'enable row level security','revoke all on table public.mobile_production_transition_intents from public, anon, authenticated',
 'security invoker','pg_advisory_xact_lock','p_intent_key','p_actor_profile_id',
 "v_existing.actor_profile_id<>p_actor_profile_id","p_transition not in ('start','finish')",
 "session_status='in_progress'","v_session.session_status='in_progress'",
 'ywi_rpc_landscape_production_session_save','v_existing.acknowledgment',
 "from public,anon,authenticated","to service_role"
],'Schema 237 canonical start/finish/retry guard');
must(edge,[
 'auth.getUser(token)','ywi_effective_module_access',
 "p_module_key:\"jobs\"",'assigned_crew_profile_ids','crew_members',
 'dispatch_schedule_items','ywi_rpc_mobile_production_transition',
 'p_intent_key:key','retry_safe:!conflict','session_status','Sign in'
],'authenticated mobile endpoint');
must(mobile,[
 'crewPendingAction','crewIntentKeys','crewActionStatus',
 'mobileProductionTransition','intent_key:intentKey','Retry the same action',
 'delete state.crewIntentKeys[retryKey]','session_id','Execution Proof'
],'mobile crew UI');
must(api,['async function mobileProductionTransition','mobile-production-transition','mobileProductionTransition,'],'API');
assert.ok(!mobile.includes("await crewOperation({ action:'landscape_production_session_save'"),'mobile starts and finishes must not use unprotected create');
assert.ok(!edge.includes('SUPABASE_ANON_KEY'),'mobile endpoint must use server authorization');
must(flow,['npm run test:mobile-production-transition','npm run test:browser:mobile-production-transition'],'workflow');
assert.ok(pkg.scripts['test:mobile-production-transition']);
assert.ok(pkg.scripts['test:browser:mobile-production-transition']);
console.log('Build 396 atomic retry, authorization, acknowledgement and wiring contract PASS');
