import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(path,'utf8');
const reviewText=read('docs/production_learning_review_362.json');
const review=JSON.parse(reviewText);
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const help=read('help.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle), label + ': missing ' + needle));

for(let build=351;build<=361;build+=1){
  assert.ok(review.includes('| '+build+' |'),'Build 362 learning review must retain Build '+build+' evidence.');
}

const queue=[
  [363,'Management Decision Outcome Journal & Learning Loop'],
  [364,'Workability-to-Schedule Recovery Outcomes'],
  [365,'Route Plan-vs-Actual & Stop-Sequence Learning'],
  [366,'Recurring Renewal Conversion & Churn Outcomes'],
  [367,'Estimate Accuracy & Change-Order Margin Calibration'],
  [368,'Completed-to-Invoiced Cycle-Time & Cash Conversion'],
  [369,'Labour Capture Completeness & Payroll Exception Reduction'],
  [370,'Equipment Downtime Cost & Replacement Readiness'],
  [371,'Material Usage Variance & Reorder Calibration'],
  [372,'Customer Communication Outcome & Follow-Up Effectiveness'],
  [373,'Data Quality Remediation Outcome & Recurrence Prevention'],
  [374,'Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes'],
  [375,'Four-Season Capacity Mix & Profitability Scenario Evidence'],
  [376,'Production Learning & Autonomous Roadmap Renewal II']
];

assert.ok(queue.length>=10,'Build 362 must renew at least ten implementable autonomous releases.');
for(const [number,title] of queue){
  assert.ok(review.renewed_queue?.some((row)=>row.item===number && row.title===title),`Build 362 review queue ${number} missing or mismatched.`);
  must(roadmap,[`#### ${number} — ${title}`],`Build 362 roadmap queue ${number}`);
  must(handbook,[`- **${number} — ${title}**`],`Build 362 handbook queue ${number}`);
}

must(reviewText,[
  'Prefer measurable operator, reliability, seasonal, economic, or data-quality outcomes',
  'Do not require external provider credentials, real payments, real customer messages, staging acceptance, or manual signoff',
  'Finance posting, payment-provider mutation, external Auth controls, provider delivery, and destructive data reconciliation fail-closed',
  'spring/summer landscaping and lawn work',
  'fall cleanup/leaf work',
  'winter snow/storm/ice operations'
],'Build 362 renewal principles');

must(roadmap,[
  '#### **362 — Production Learning & Autonomous Roadmap Renewal** is implemented',
  'docs/production_learning_review_362.json',
  'The next planned autonomous item is **363 — Management Decision Outcome Journal & Learning Loop**.',
  'Items 363–376'
],'Build 362 roadmap closure');

must(handbook,[
  '## Production-learning renewal authority',
  '**362 — Production Learning & Autonomous Roadmap Renewal** are implemented',
  'After item 362, that item is 363 — Management Decision Outcome Journal & Learning Loop.',
  '- **376 — Production Learning & Autonomous Roadmap Renewal II**'
],'Build 362 durable handoff');

must(help,[
  'Build 362 — Production Learning &amp; Autonomous Roadmap Renewal',
  'What we learned:',
  'Renewed queue:',
  'Autonomous boundary:'
],'Build 362 help');

assert.equal(pkg.scripts?.['test:production-learning-roadmap-renewal'],'node scripts/production-learning-roadmap-renewal-check.mjs','Build 362 source gate must be registered.');
assert.equal(pkg.scripts?.['test:browser:production-learning-roadmap-renewal'],'playwright test --config=playwright.config.mjs tests/browser/production-learning-roadmap-renewal.spec.mjs','Build 362 browser gate must be registered.');
must(workflow,['npm run test:production-learning-roadmap-renewal','npm run test:browser:production-learning-roadmap-renewal'],'Build 362 CI wiring');

console.log('Build 362 Production Learning & Autonomous Roadmap Renewal checks: PASS');
