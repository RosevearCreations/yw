import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_master_stability_565.sql');
const ui=read('js/landscape-master-stability-565.js');
const deck=read('js/operations-command-565.js');
const css=read('theme-operations-command-565.css');
const html=read('index.html');
const pkg=JSON.parse(read('package.json'));
const must=(s,terms,name)=>terms.forEach(t=>assert.ok(s.includes(t),'YW565 '+name+' missing '+t));
new vm.Script(ui,{filename:'landscape-master-stability-565.js'});
new vm.Script(deck,{filename:'operations-command-565.js'});
must(sql,[
 'ywi_landscape_master_stability_reviews_565',
 'enable row level security',
 'ywi_rpc_landscape_master_stability_review_565',
 'ywi_rpc_landscape_master_continuity_review_564',
 'ywi_landscape_master_observations_563',
 'ywi_landscape_master_replay_signals_564',
 'ywi_landscape_master_renewal_requests_564',
 "comparison='MATCHED_RECEIPT_CLAIM'",
 "verified_at>=now()-interval '24 hours'",
 "verified_at>=now()-interval '7 days'",
 "verified_at>=now()-interval '30 days'",
 "detected_at>=now()-interval '24 hours'",
 "detected_at>=now()-interval '7 days'",
 "detected_at>=now()-interval '30 days'",
 'v_latest.verified_at>v_last_request.recorded_at',
 "v_first_30<=now()-interval '29 days'",
 "v_first_7<=now()-interval '6 days'",
 "'OPEN_SIGNED_ADMISSION_OR_DISCREPANCY'",
 "'STALE_INDEPENDENT_MASTER_RECEIPT'",
 "'THIRTY_DAY_OBSERVED_RECEIPT_SPAN'",
 "'SEVEN_DAY_OBSERVED_RECEIPT_SPAN'",
 "'continuity_is_observational_not_uptime',true",
 'ywi_rpc_landscape_master_stability_decide_565',
 'pg_advisory_xact_lock',
 'for update;',
 'p_owner_attested is distinct from true',
 '565 current independently signed source recovery required',
 '565 no current source stability drift to escalate',
 '565 conflicting owner idempotency replay',
 'ywi_rpc_landscape_master_stability_summary_565',
 "current_user<>'service_role'",
 "'tenant_boundary','platform_shell'",
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'recipient_delivery_independently_verified',false",
], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_stability_reviews_565\s+to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_stability_reviews_565\s+to\s+service_role/i.test(sql));
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_master_observations_563',
 'ywi_landscape_master_replay_signals_564',
 'ywi_landscape_provider_verified_561']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+original+'\\b','i').test(sql),
  'YW565 protected signed source cannot mutate '+original);
}
must(ui,[
 'owner565Company','owner565Case','owner565Receipt',
 "sb.rpc('ywi_rpc_landscape_master_stability_review_565'",
 "sb.rpc('ywi_rpc_landscape_master_stability_decide_565'",
 'source_recovery_evidence_effective',
 'continuity_is_observational_not_uptime===true',
 'signed_admission_exceptions_30d',
 'master_owner_acceptance===false',
 'master_connected===false',
 "document.addEventListener('ywi:auth-changed'"
], 'Owner UI');
assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!ui.includes('ywi_rpc_landscape_master_replay_signal_564'));
must(deck,[
 "root.dataset.ywTheme==='futuristic'",
 "window.YWI_AUTH?.getState?.()?.isAuthenticated===true",
 "const a=$('workspace550SysopLink')",
 'link.hidden=dest===',
 'Operations Command',
 "'yw:theme-changed'",
 "'ywi:auth-changed'",
 'aria-current'
], 'Operations Command shell');
must(css,[
 'html[data-yw-theme="futuristic"] .yw565-command',
 '.yw565-command-grid',
 '.yw565-command-link:focus-visible',
 '@media(max-width:760px)',
 '@media(prefers-reduced-motion:reduce)',
], 'Scoped theme');
assert.ok(!/^\s*(?:body|html|:root)\s*\{/m.test(css),'Standard Blue must not be rewritten');
must(html,['landscape-master-stability-565.js','operations-command-565.js',
 'theme-operations-command-565.css','theme-futuristic-564.css'], 'Index');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-master-stability-565-check.mjs'],'Retained source lane');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-master-stability-565.spec.mjs','theme-operations-command-565.spec.mjs'],
 'Retained browser lane');
console.log('YW565 original owner signed recovery horizon, fail-closed Master HOLD and two-theme shell PASS');
