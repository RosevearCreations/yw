#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const outbox=read('js/outbox.js'),mobile=read('js/mobile-today.js');
const begin=outbox.indexOf('function buildDeviceSafeReliabilityCohorts');
const end=outbox.indexOf('function getDeviceSafeReliabilityCohorts',begin);
assert.ok(begin>0&&end>begin,'Build 388 local decision helper');
const source=outbox.slice(begin,end);
assert.ok(!/localStorage\.|fetch\(|\.setItem\(|\.insert\(|\.update\(|\.delete\(/.test(source),'Build 388 cohort computation must be read-only');
const sandbox=vm.createContext({});
vm.runInContext(source,sandbox);
const run=input=>JSON.parse(JSON.stringify(vm.runInContext('buildDeviceSafeReliabilityCohorts',sandbox)(input,Date.parse('2026-10-12T12:00:00Z'))));
const record=(owner,day,action)=>({owner_key:owner,resolved_at:'2026-10-'+String(day).padStart(2,'0')+'T12:00:00Z',resolution_action:action,local_payload:{secret:'private'},resolution_note:'private note'});
const prior=(owner,day,action)=>({owner_key:owner,resolved_at:'2026-09-'+String(day).padStart(2,'0')+'T12:00:00Z',resolution_action:action});
const history=[...Array.from({length:6},(_,i)=>record('one',6+i,i%2?'keep_mine':'discard')),
  ...Array.from({length:6},(_,i)=>prior('one',14+i,i%2?'merge':'keep_server')),record('two',11,'discard')];
const input={ownerAuthenticated:true,ownerKey:'one',history,actions:[
  {owner_key:'one',status:'conflict',conflict_detected_at:'2026-10-03T12:00:00Z',payload:{secret:'hidden'}},
  {owner_key:'one',status:'pending',queued_at:'2026-10-12T10:00:00Z'},
  {owner_key:'two',status:'conflict',conflict_detected_at:'2026-10-01T12:00:00Z'}
]};
const ok=run(input);assert.equal(ok.state,'current');assert.equal(ok.summary.local_recovery_decisions,12);
assert.equal(ok.summary.active_conflicts,1);assert.equal(ok.queue_age.over_7_days,1);
assert.equal(ok.cohorts[0].decision_events,6);assert.equal(ok.cohorts[1].decision_events,6);
assert.equal(ok.cohorts[0].local_removal_choices,3);
assert.ok(!JSON.stringify(ok).includes('private')&&!JSON.stringify(ok).includes('two')&&!JSON.stringify(ok).includes('hidden'),'No payload/private/owner leakage');
assert.equal(run({...input,ownerAuthenticated:false}).state,'permission_hidden');
assert.equal(run({...input,ownerKey:''}).state,'permission_hidden');
assert.equal(run({...input,history:[...history,{owner_key:'one',resolved_at:'bad',resolution_action:'merge'}]}).state,'invalid_history');
assert.equal(run({...input,history:Array.from({length:50},()=>record('one',11,'discard'))}).state,'partial_history');
const noData=run({...input,history:[],actions:[]});assert.equal(noData.state,'no_local_evidence');
assert.equal(noData.cohorts[0].local_removal_share_percent,null);
assert.equal(run({...input,history:history.slice(0,3)}).state,'insufficient_sample');
assert.ok(outbox.includes('getDeviceSafeReliabilityCohorts,\n    getReplayReceipts\n  };'),'Outbox export must be read only');
assert.ok(outbox.includes('String(entry.owner_key || \'\') === currentOwner'),'Deduplication must be scoped to the active owner profile');
assert.ok(mobile.includes('deviceSafeReliabilityMarkup() +'),'Mobile crew panel displays local evidence');
assert.ok(!source.includes('owner_key:'),'Pure helper must not leak stored owner identity');
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.scripts['test:offline-conflict-device-safe-cohorts'],'node scripts/offline-conflict-device-safe-cohorts-check.mjs');
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:offline-conflict-device-safe-cohorts')&&flow.includes('npm run test:browser:offline-conflict-device-safe-cohorts'));
assert.ok(read('index.html').includes('/js/mobile-today.js?v=2026-10-12b388') && read('index.html').includes('/js/outbox.js?v=2026-10-12b388'),'Build 388 browser shell cache-busting');
assert.ok(read('server-worker.js').includes("const CACHE_NAME = 'ywi-shell-v2026-10-12b388';"),'Build 388 PWA cache rotation');
assert.ok(read('help.html').includes('Build 388 — Offline Conflict Closure &amp; Device-Safe Reliability Cohorts'));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('Next: **389 — Four-Season Crew-Day Mix Constraint & Scenario Backtesting**'));
assert.ok(read('docs/ACTIVE_PROJECT_HANDBOOK.md').includes('After item 388, the next is **389'));
new Function(outbox);new Function(mobile);
console.log('Build 388 deterministic local privacy, profile, cohort, age and UI source checks GREEN');
