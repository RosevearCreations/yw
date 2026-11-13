import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('sql/landscape_master_continuity_564.sql');
const ui=read('js/landscape-master-continuity-564.js');
const theme=read('js/theme-switcher-564.js');
const css=read('theme-futuristic-564.css');
const edge=read('supabase/functions/landscape-master-receipt-563/index.ts');
const html=read('index.html');
const pkg=JSON.parse(read('package.json'));
const must=(s,a,label)=>a.forEach(v=>assert.ok(s.includes(v),'YW564 '+label+' missing '+v));
new vm.Script(ui,{filename:'landscape-master-continuity-564.js'});
new vm.Script(theme,{filename:'theme-switcher-564.js'});
must(sql,[
 'ywi_landscape_master_replay_signals_564',
 'ywi_landscape_master_renewal_requests_564',
 'enable row level security',
 'unique(issuer,nonce_fingerprint,signature_sha256)',
 "'SIGNED_ADMISSION_REJECTED'",
 'ywi_rpc_landscape_master_replay_signal_564',
 "current_user<>'service_role'",
 'ywi_rpc_landscape_master_continuity_review_564',
 'ywi_rpc_landscape_master_receipt_review_563',
 'ywi_landscape_master_observations_563',
 'ywi_rpc_landscape_master_renewal_decide_564',
 'ywi_rpc_landscape_master_continuity_summary_564',
 'v_observation.verified_at>v_last_renewal.recorded_at',
 "'SIGNED_REPLAY_OR_ADMISSION_EXCEPTION'",
 "'CROSS_PLANE_DISCREPANCY'",
 "'resolution_sla_state',v_sla",
 "v_due<now() then 'BREACHED'",
 "'independent_renewal_evidence_current',v_renewed",
 "p_owner_attested is distinct from true",
 '564 fresh independently signed Master renewal required',
 '564 conflicting owner renewal replay',
 'for update;',
 "'master_owner_acceptance',false",
 "'master_connected',false",
 "'tenant_boundary','platform_shell'"
], 'SQL');
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_(?:replay_signals|renewal_requests)_564\s+to\s+authenticated/i.test(sql));
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*on\s+public\.ywi_landscape_master_renewal_requests_564\s+to\s+service_role/i.test(sql));
for(const original of ['jobs','work_orders','dispatch_schedule_items',
 'ywi_landscape_provider_verified_561',
 'ywi_landscape_master_observations_563']){
 assert.ok(!new RegExp('\\b(?:insert into|update|delete from)\\s+public\\.'+original+'\\b','i').test(sql),
  'YW564 must never mutate existing source '+original);
}
must(edge,[
 "sb.rpc('ywi_rpc_landscape_master_replay_signal_564'",
 'p_nonce_fingerprint:await sha256hex',
 'p_master_ref_fingerprint:await sha256hex',
 'p_signature_sha256:verified.signature_sha256',
 'verifyMasterObservation'
], 'Protected receiver integration');
assert.ok(!edge.includes('Access-Control-Allow-Origin'));
must(ui,[
 'owner564Company','owner564Case','owner564Receipt',
 'ywi_landscape_provider_verified_561',
 "sb.rpc('ywi_rpc_landscape_master_continuity_review_564'",
 "sb.rpc('ywi_rpc_landscape_master_renewal_decide_564'",
 'resolution_sla_state',
 'independent_renewal_evidence_current',
 'master_owner_acceptance===false','master_connected===false',
 "document.addEventListener('ywi:auth-changed'"
], 'Owner workspace');
assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!ui.includes('ywi_rpc_landscape_master_replay_signal_564'));
must(theme,[
 "const KEY='yw-theme-v1'",
 "standard:'Standard · Blue'",
 "futuristic:'Futuristic · Violet'",
 'root.dataset.ywTheme=theme',
 'localStorage.setItem(KEY,theme)',
 "document.addEventListener('ywi:auth-changed'",
 "const sysop=document.getElementById('workspace550SysopLink')",
 'aria-current'
], 'Theme selector');
assert.ok(!theme.includes('SUPABASE_SERVICE_ROLE_KEY'));
must(css,[
 'html[data-yw-theme="futuristic"]',
 '.yw564-side-rail',
 'prefers-reduced-motion:reduce',
 '@media (max-width:760px)',
 '--accent:#b58aff',
 'focus-visible'
], 'Futuristic CSS');
assert.ok(!/^\s*(?:body|html|:root)\s*\{/m.test(css),
 'YW564 must preserve global Standard blue selectors');
must(html,['theme-futuristic-564.css','theme-switcher-564.js',
 'landscape-master-continuity-564.js','document.documentElement.dataset.ywTheme'], 'Shell');
must(pkg.scripts['test:landscape-supervisor-resolution-558'],
 ['landscape-master-continuity-564-check.mjs'],'Retained source checks');
must(pkg.scripts['test:browser:landscape-supervisor-resolution-558'],
 ['landscape-master-continuity-564.spec.mjs','theme-futuristic-564.spec.mjs'],
 'Retained browser checks');
console.log('YW564 replay/SLA/renewal owner evidence HOLD + Standard/Futuristic dual-theme boundaries PASS');
