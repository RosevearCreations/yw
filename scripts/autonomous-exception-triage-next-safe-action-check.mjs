#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const endpoint=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),label+': missing '+needle));

must(endpoint,[
  'function attentionDateState','function attentionAuthority','function attentionNextSafeAction','function explainAttention',
  'function deduplicateAttentionItems','function strongerAttentionItem','duplicate_count:1','triage_score:triageScore',
  'priority_reason:parts.join','owner_state:ownerState','source_authority:{','next_safe_action:attentionNextSafeAction',
  'dedupedItems=deduplicateAttentionItems(items)','Number(b.triage_score||0)-Number(a.triage_score||0)',
  'duplicates_collapsed:collapsedCount','build:352','foundation_build:320','deterministic_triage:true','advisory_next_safe_action:true',
  'This triage layer cannot unlock equipment','No match, posting or provider mutation is automatic',
  'This triage layer cannot resolve or close Safety work'
],'Build 352 server');

must(ui,[
  'Build 352 adds deterministic deduplication','function attentionAgeLabel','function attentionCardHtml',
  'data-triage-score','Source authority','Why this priority','Mutation authority','Next safe action:',
  'duplicate candidate(s) collapsed','deterministic advisory triage','window.YWIOperationsAttentionTriage',
  'triage never dispatches, resolves Safety, unlocks equipment, changes Finance, sends messages or mutates a provider'
],'Build 352 UI');

assert.ok(!endpoint.includes("action:'dispatch_schedule'") || endpoint.includes('Advisory navigation/preparation only'));
assert.ok(!ui.includes('data-oc-action="attention-auto-dispatch"'));
assert.ok(!ui.includes('data-oc-action="attention-auto-resolve"'));
assert.equal(pkg.scripts['test:autonomous-exception-triage-next-safe-action'],'node scripts/autonomous-exception-triage-next-safe-action-check.mjs');
assert.equal(pkg.scripts['test:browser:autonomous-exception-triage-next-safe-action'],'playwright test --config=playwright.config.mjs tests/browser/autonomous-exception-triage-next-safe-action.spec.mjs');
must(workflow,['npm run test:autonomous-exception-triage-next-safe-action','npm run test:browser:autonomous-exception-triage-next-safe-action'],'Build 352 CI');
must(help,['Build 352 — Autonomous Exception Triage &amp; Next-Safe-Action','One source exception, one queue item','Next-safe-action is advisory'],'Build 352 help');
must(roadmap,['#### **352 — Autonomous Exception Triage & Next-Safe-Action** is implemented','#### **353 — Four-Season Capacity & Workability Forecast** is implemented','#### **354 — Route & Crew Efficiency Evidence** is implemented','#### **355 — Recurring Service Renewal & Retention Workbench** is implemented','The next planned autonomous item is **356 — Estimate-to-Cash Leakage & Margin Recovery**.'],'Build 352 roadmap');
must(handbook,['**352 — Autonomous Exception Triage & Next-Safe-Action**','**353 — Four-Season Capacity & Workability Forecast**','**354 — Route & Crew Efficiency Evidence** is implemented','**355 — Recurring Service Renewal & Retention Workbench** is implemented','- **356 — Estimate-to-Cash Leakage & Margin Recovery**'],'Build 352 handoff');

console.log('Build 352 Autonomous Exception Triage & Next-Safe-Action source gate GREEN');
