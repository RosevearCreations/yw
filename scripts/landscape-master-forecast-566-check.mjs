import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_master_forecast_566.sql');
const ui=read('js/landscape-master-forecast-566.js');
const guard=read('js/command-navigation-acceptance-566.js');
const deck=read('js/operations-command-565.js');
const rail=read('js/theme-switcher-564.js');
const css=read('theme-navigation-acceptance-566.css');
const html=read('index.html');
const pkg=JSON.parse(read('package.json'));
const must=(s,a,label)=>a.forEach(k=>assert.ok(s.includes(k),'YW566 '+label+' missing '+k));
new vm.Script(ui,{filename:'landscape-master-forecast-566.js'});
new vm.Script(guard,{filename:'command-navigation-acceptance-566.js'});
new vm.Script(deck,{filename:'operations-command-565.js'});
new vm.Script(rail,{filename:'theme-switcher-564.js'});
must(sql,[
 'ywi_landscape_master_escalation_outcomes_566',
 'enable row level security',
 'ywi_rpc_landscape_master_drift_forecast_review_566',
 'ywi_rpc_landscape_master_stability_review_565',
 'ywi_landscape_master_observations_563',
 'ywi_landscape_master_stability_reviews_565',
 "'escalate_long_horizon_drift'",
 'v_latest_observed_at>v_escalation.recorded_at',
 'v_last_risk>=v_latest_observed_at',
 "'forecast_horizon_hours',24",
 "'forecast_is_deterministic_watch_not_prediction',true",
 "'SOURCE_SIGNED_RISK_ACTIVE'",
 "'SOURCE_SLA_BREACHED'",
 "'SOURCE_SLA_DUE_SOON'",
 "'SOURCE_RECEIPT_STALE'",
 "'SOURCE_RENEWAL_RECOVERY_WATCH'",
 "'SOURCE_RECOVERY_RECONCILED_MASTER_HOLD'",
 'ywi_rpc_landscape_master_escalation_outcome_decide_566',
 'pg_advisory_xact_lock',
 'for update;',
 'p_owner_attested is distinct from true',
 '566 new independently signed recovery after escalation required',
 '566 original signed observation or escalation changed',
 '566 conflicting owner idempotency replay',
 'ywi_rpc_landscape_master_forecast_summary_566',
 "current_user<>'service_role'",
 "'tenant_boundary','platform_shell'",
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'recipient_delivery_independently_verified',false"
], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_escalation_outcomes_566\s+to\s+(?:authenticated|service_role)/i.test(sql),
 'YW566 signed owner ledger cannot be directly inserted/changed');
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_master_observations_563','ywi_landscape_master_replay_signals_564',
 'ywi_landscape_master_stability_reviews_565']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+original+'\\b','i').test(sql),
  'YW566 cannot modify original signed source '+original);
}
must(ui,[
 'owner566Company','owner566Case','owner566Receipt',
 "sb.rpc('ywi_rpc_landscape_master_drift_forecast_review_566'",
 "sb.rpc('ywi_rpc_landscape_master_escalation_outcome_decide_566'",
 'post_escalation_signed_evidence_current===true',
 'source_recovery_effective_after_escalation===true',
 'forecast_is_deterministic_watch_not_prediction===true',
 'master_owner_acceptance===false',
 'master_connected===false',
 "document.addEventListener('ywi:auth-changed'"
], 'Owner UI');
assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
must(guard,[
 "'#company','#today','#finance','#admin','#toolbox','#settings','#sysop'",
 "document.getElementById",
 "window.YWI_AUTH?.getState?.()?.isAuthenticated===true",
 "const expected=sources[route]",
 "'workspace550SysopLink'",
 "'workspace550CompanyLink'",
 'a.getAttribute(\\'aria-disabled\\')',
 'e.preventDefault()',
 "document.addEventListener('ywi:auth-changed'",
 "document.addEventListener('yw:theme-changed'",
 'YWNavigationAcceptance566'
], 'Route acceptance');
assert.ok(!/\['#it',/.test(deck),'YW566 no dead I.T. command route');
assert.ok(!/\['#it',/.test(rail),'YW566 no dead I.T. rail route');
must(deck,["['#settings','System & settings'","['#sysop','Platform Sysop'"],'Command routes');
must(css,[
 'html[data-yw-theme="futuristic"]',
 '#yw566NavigationStatus',
 '#owner566 .panel566',
 '@media(max-width:760px)',
 'prefers-reduced-motion'
], 'Scoped CSS');
assert.ok(!/^\s*(?:body|html|:root)\s*\{/m.test(css),'YW566 cannot alter Standard Blue global style');
must(html,[
 'landscape-master-forecast-566.js',
 'command-navigation-acceptance-566.js',
 'theme-navigation-acceptance-566.css',
 'theme-futuristic-564.css'
], 'Index');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-master-forecast-566-check.mjs'],'Retained source lane');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-master-forecast-566.spec.mjs',
  'command-navigation-acceptance-566.spec.mjs'],'Retained browser lane');
assert.ok(!guard.includes('SUPABASE_SERVICE_ROLE_KEY'));
console.log('YW566 independent signed source forecast/outcome HOLD & cross-module route acceptance PASS');
