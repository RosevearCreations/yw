import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
const review=JSON.parse(read('docs/production_learning_review_376.json'));
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const help=read('help.html');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const browser=read('tests/browser/production-learning-roadmap-renewal-ii.spec.mjs');
const pkg=JSON.parse(read('package.json'));
assert.equal(review.item,376);
assert.match(review.review_basis.confidence,/unknown/);
assert.match(review.review_basis.data_quality,/No live/);
assert.equal(review.learning_review.length,13);
for(let item=363;item<=375;item++) {
 const entry=review.learning_review.find(row=>row.item===item);
 assert.ok(entry,'Missing reviewed delivery '+item);
 assert.ok(entry.learning?.length>60 && entry.remaining_gap?.length>40,'Review detail incomplete: '+item);
}
assert.ok(review.renewal_principles.some(x=>x.includes('fail-closed')));
assert.ok(review.renewal_principles.some(x=>x.includes('four-season operations')));
assert.ok(review.renewal_principles.some(x=>x.includes('No ordinary item may depend on live payments')));
assert.ok(review.renewed_queue.length>=10,'Renewal queue cannot run dry.');
const expected=[[377,"Management Outcome Confidence & Cohort Trend"],[378,"Workability Forecast-vs-Recovery Calibration"],[379,"Route Stop-Sequence Friction Hotspots by Season"],[380,"Recurring Retention Cohort & Renewal Lag"],[381,"Estimate Margin Drift & Change-Order Follow-through"],[382,"Invoice Aging Handoff & Receivables Leakage"],[383,"Labour Capture Exception Closure & Shift Readiness"],[384,"Fleet Maintenance Cost Trend & Downtime Concentration"],[385,"Material Demand vs Stockout Trend & Season Transition"],[386,"Communication Follow-Up Coverage & Consent-Safe Queue Aging"],[387,"Data-Quality Fix Recurrence & Source Freshness"],[388,"Offline Conflict Closure & Device-Safe Reliability Cohorts"],[389,"Four-Season Crew-Day Mix Constraint & Scenario Backtesting"],[390,"Production Learning & Autonomous Roadmap Renewal III"]];
assert.deepEqual(review.renewed_queue.map(row=>[row.item,row.title]),expected);
for(const [number,title] of expected) {
 assert.ok(roadmap.includes('#### '+number+' — '+title),'Missing planned roadmap '+number);
 assert.ok(handbook.includes('- **'+number+' — '+title+'**'),'Missing handbook queue '+number);
}
assert.ok(roadmap.includes('#### **376 — Production Learning & Autonomous Roadmap Renewal II** is implemented'));
assert.ok(roadmap.includes('The next planned autonomous item is **377 — Management Outcome Confidence & Cohort Trend**.'));
assert.ok(handbook.includes('**376 — Production Learning & Autonomous Roadmap Renewal II** (implemented)'));
assert.ok(handbook.includes('After item 376, that item is 377'));
assert.ok(help.includes('id="production-learning-roadmap-renewal-ii"'));
for(const part of ['Learning confidence:','Remaining outcome gaps:','Four-season review:','Renewed queue:','Autonomous boundary:','Build 390','Unknown, permission-hidden, capped, stale'])assert.ok(help.includes(part),'Missing Help contract '+part);
assert.ok(browser.includes('390'),'Missing phone rendered acceptance');
assert.equal(pkg.scripts['test:production-learning-roadmap-renewal-ii'],'node scripts/production-learning-roadmap-renewal-ii-check.mjs');
assert.equal(pkg.scripts['test:browser:production-learning-roadmap-renewal-ii'],'playwright test --config=playwright.config.mjs tests/browser/production-learning-roadmap-renewal-ii.spec.mjs');
assert.ok(workflow.includes('npm run test:production-learning-roadmap-renewal-ii'));
assert.ok(workflow.includes('npm run test:browser:production-learning-roadmap-renewal-ii'));
console.log('Build 376 Production Learning & Autonomous Roadmap Renewal II checks: PASS');
