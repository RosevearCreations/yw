import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const review=JSON.parse(read('docs/production_learning_review_390.json'));
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md'),handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md'),help=read('help.html');
const ui=read('js/admin-owner-management-command-ui.js'),pkg=JSON.parse(read('package.json'));
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.equal(review.item,390);
assert.equal(review.review_date,'2026-10-13');
assert.equal(review.learning_review.length,13,'Every 377–389 capability must have a learning gap');
for(let n=377;n<=389;n++){
  const row=review.learning_review.find(x=>x.item===n);
  assert.ok(row&&row.verified_release_contract.length>50&&row.outcome_gap.length>55,'Missing capability/gap '+n);
  assert.equal(row.production_learning_state,'unmeasured_in_inspected_sample');
}
const s=review.production_source_snapshot.sources;
assert.equal(s.length,10);
assert.equal(new Set(s.map(x=>x.source)).size,10,'Source table snapshot may not duplicate rows');
for(const x of s){
  assert.equal(x.all_time_count,0);assert.equal(x.last_30d,0);assert.equal(x.previous_60d,0);
  assert.equal(x.latest_created_at,null);
}
assert.equal(review.review_basis.measured_effect,'unknown_insufficient_live_operational_records');
assert.match(review.review_basis.limitations,/not the complete database/);
assert.match(review.review_basis.denominator_boundary,/Minimum-five/);
assert.equal(review.renewed_queue.length,15);
assert.deepEqual(review.renewed_queue.map(x=>x.item),Array.from({length:15},(_,i)=>i+391));
const forbidden=/auto(\s|-)?post|automatically (collect|send|approve)|auto(\s|-)?charge/i;
for(const row of review.renewed_queue){
 assert.ok(row.acceptance.length>65&&row.safety_boundary.length>40&&row.source_authority.length>15,'Missing bounded acceptance or authority: '+row.item);
 assert.ok(roadmap.includes('#### '+row.item+' — '+row.title),'Missing roadmap item '+row.item);
 assert.ok(handbook.includes('**'+row.item+' — '+row.title+'**'),'Missing handoff item '+row.item);
 assert.ok(!forbidden.test(row.acceptance),'Release acceptance cannot imply unattended external actions: '+row.item);
}
assert.ok(roadmap.includes('#### 390 — Production Learning & Autonomous Roadmap Renewal III (implemented)'));
assert.ok(roadmap.includes('Next: **391 — First-Use Readiness & Verified Data Intake**.'));
assert.ok(handbook.includes('docs/production_learning_review_390.json'));
assert.ok(help.includes('id="production-learning-roadmap-renewal-iii"'));
for(const t of ['zero rows across ten inspected operational tables','not a fleet-wide or company-wide claim','no source-supported operational improvement','Build 391','391–405','winter snow/storm/ice','This review creates no records','one-time snapshot']){
 assert.ok(help.includes(t),'Help missing evidence boundary '+t);
}
assert.ok(ui.includes('/help.html#production-learning-roadmap-renewal-iii'),'Owner management informational deep link missing');
assert.equal(pkg.scripts['test:production-learning-roadmap-renewal-iii'],'node scripts/production-learning-roadmap-renewal-iii-check.mjs');
assert.equal(pkg.scripts['test:browser:production-learning-roadmap-renewal-iii'],'playwright test --config=playwright.config.mjs tests/browser/production-learning-roadmap-renewal-iii.spec.mjs');
assert.ok(flow.includes('npm run test:production-learning-roadmap-renewal-iii')&&flow.includes('npm run test:browser:production-learning-roadmap-renewal-iii'));
new Function(ui);
console.log('Item 390 dated evidence review, 13 gaps, 15 bounded queue and safety checks: PASS');
