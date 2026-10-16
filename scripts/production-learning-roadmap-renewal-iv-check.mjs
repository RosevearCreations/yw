import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const review=JSON.parse(read('docs/production_learning_review_405.json'));
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const help=read('help.html');
const ui=read('js/admin-owner-management-command-ui.js');
const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/staging-browser-integration.yml');
assert.equal(review.item,405);
assert.equal(review.review_date,'2026-10-16');
assert.equal(review.review_basis.measured_effect,'unknown_insufficient_live_operational_records');
assert.match(review.review_basis.limitations,/not the complete database/i);
const snapshot=review.production_source_snapshot.sources;
assert.equal(snapshot.length,6);
assert.equal(new Set(snapshot.map(x=>x.source)).size,6);
for(const x of snapshot){assert.equal(x.all_time_count,0);assert.equal(x.last_90d_count,x.source==='clients'?0:null);}
assert.equal(review.learning_review.length,14);
assert.deepEqual(review.learning_review.map(x=>x.item),Array.from({length:14},(_,i)=>i+391));
for(const x of review.learning_review){
 assert.equal(x.production_learning_state,'unmeasured_in_six_inspected_sources');
 assert.match(x.outcome_gap,/no comparative improvement is claimed/i);
}
assert.equal(review.renewed_queue.length,12);
assert.deepEqual(review.renewed_queue.map(x=>x.item),Array.from({length:12},(_,i)=>i+406));
for(const x of review.renewed_queue){
 assert.ok(x.title.length>12&&x.acceptance.length>75&&x.source_authority.length>12&&x.safety_boundary.length>30);
 assert.ok(roadmap.includes('#### '+x.item+' — '+x.title),'Roadmap missing '+x.item);
 assert.ok(handbook.includes('**'+x.item+' — '+x.title+'**'),'Handoff missing '+x.item);
 assert.ok(!/automatically (charge|message|renew|post)|unattended payment/i.test(x.acceptance));
}
for(const token of ['#### 405 — Production Learning & Autonomous Roadmap Renewal IV','docs/production_learning_review_405.json','zero recorded rows','Next build is **406','No automatic business writes'])assert.ok(roadmap.toLowerCase().includes(token.toLowerCase()),'Roadmap evidence '+token);
assert.ok(help.includes('id="production-learning-roadmap-renewal-iv"'));
for(const token of ['All six inspected tables returned zero rows','No ROI','406–417','this review creates no records','not a claim that the entire business'])assert.ok(help.toLowerCase().includes(token.toLowerCase()),'Help evidence '+token);
assert.ok(ui.includes('data-build="405"'));
assert.ok(ui.includes('/help.html#production-learning-roadmap-renewal-iv'));
new Function(ui);
assert.equal(pkg.scripts['test:production-learning-roadmap-renewal-iv'],'node scripts/production-learning-roadmap-renewal-iv-check.mjs');
assert.equal(pkg.scripts['test:browser:production-learning-roadmap-renewal-iv'],'playwright test --config=playwright.config.mjs tests/browser/production-learning-roadmap-renewal-iv.spec.mjs');
assert.ok(ci.includes('npm run test:production-learning-roadmap-renewal-iv')&&ci.includes('npm run test:browser:production-learning-roadmap-renewal-iv'));
console.log('Build 405 dated Production evidence, 14 release gaps, 12 safe successor builds: PASS');
