import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const start=backend.indexOf('function buildCommunicationFollowupConsentAging(');
const end=backend.indexOf('function buildCustomerCommunicationOutcomeFollowUpEffectiveness(',start);
assert.ok(start>=0&&end>start);
const body=backend.slice(start,end);
assert.ok(!/\.(insert|update|upsert|delete)\s*\(/.test(body),'No writes in Build 386');
const f=vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';buildCommunicationFollowupConsentAging;',{
  ontarioDateKey:v=>String(v||'').slice(0,10),Date,Map,Set
});
const followups=[
 {id:'a',interaction_id:'x',followup_status:'pending',due_at:'2026-10-11T12:00:00Z'},
 {id:'b',interaction_id:'x',followup_status:'in_progress',due_at:'2026-10-05T12:00:00Z'},
 {id:'c',interaction_id:'unknown',followup_status:'deferred',due_at:null},
 {id:'d',followup_status:'completed',due_at:'2026-10-10T13:00:00Z',completed_at:'2026-10-09T13:00:00Z'},
 {id:'e',followup_status:'cancelled'}
];
const interactions=[{id:'x',direction:'outbound',work_order_id:'work',occurred_at:'2026-10-01T12:00:00Z'},
 {id:'reply',direction:'inbound',work_order_id:'work',occurred_at:'2026-10-02T12:00:00Z'}];
const notificationQueue=[
 {id:'n1',work_order_id:'work',channel:'email',consent_status:'granted',live_work_update_opt_in:true,contact_email_configured:true,delivery_status:'sent'},
 {id:'n2',work_order_id:'work',channel:'email',consent_status:'withdrawn',live_work_update_opt_in:true,contact_email_configured:true,delivery_status:'failed'},
 {id:'n3',work_order_id:'work',channel:'sms',consent_status:'granted',live_work_update_opt_in:true,contact_email_configured:true,delivery_status:'queued'}
];
const input={today:'2026-10-12',jobsVisible:true,sourceQueriesOk:true,coverageComplete:true,confidence:{state:'current'},
 followups,interactions,notificationQueue};
const a=f(input);
assert.equal(a.state,'current');
assert.equal(a.summary.open_followups,3);
assert.equal(a.summary.overdue_1_2_days,1);
assert.equal(a.summary.overdue_3_7_days,1);
assert.equal(a.summary.open_missing_due_date,1);
assert.equal(a.summary.completed_on_time,1);
assert.equal(a.summary.cancelled,1);
assert.equal(a.summary.open_with_recorded_response,2);
assert.equal(a.summary.open_without_linked_interaction,1);
assert.equal(a.summary.email_consent_eligible_updates,1);
assert.equal(a.summary.email_consent_blocked_or_unverified_updates,2);
assert.equal(a.summary.delivery_attention_updates,1);
assert.equal(a.summary.due_date_coverage_percent,null);
assert.equal(a.notification_review[1].consent_state,'blocked_or_unverified');
for(const key of ['contact_email','provider_message_id','public_token','last_error','resolution_note','client_name']){
 assert.ok(!JSON.stringify(a).includes(key),'No sensitive fields: '+key);
}
assert.equal(f({...input,jobsVisible:false}).state,'permission_hidden');
assert.equal(f({...input,sourceQueriesOk:false}).state,'source_unavailable');
assert.equal(f({...input,coverageComplete:false}).state,'partial_coverage');
assert.equal(f({...input,confidence:{state:'stale'}}).state,'evidence_uncertain');
assert.equal(f({...input,followups:[...followups,{id:'f',followup_status:'pending',due_at:'2026-10-12'}]}).summary.due_date_coverage_percent,60);
assert.ok(backend.includes('communication_followup_consent_aging:communicationConsentAging'));
assert.ok(backend.includes('communication_consent_aging:buildManagementMetricConfidence'));
const ui=read('js/admin-owner-management-command-ui.js');
for(const token of ['owner386ConsentAging','renderCommunicationConsentAging();','communication_followup_consent_aging',"metricMeta('communication_consent_aging')"]){
 assert.ok(ui.includes(token),'UI missing '+token);
}
assert.ok(read('help.html').includes('id="communication-followup-consent-aging"'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('386 — Communication Follow-Up Coverage & Consent-Safe Queue Aging** (implemented)'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('387 — Data-Quality Fix Recurrence & Source Freshness'));
assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run test:communication-followup-consent-aging'));
console.log('Build 386 consent-safe follow-up queue source and behavioral checks PASS');
