import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-customer-property-crm-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const a=backend.indexOf("if (scope === 'crm'"),b=backend.indexOf("if (scope === 'routing'",a);
assert.ok(a>0&&b>a);
const crm=backend.slice(a,b);
for(const word of [
 "roleRank(actorRole) >= roleRank('supervisor')",
 "safeListEvidence(supabase,'v_crm_property_directory'",
 "safeListEvidence(supabase,'v_crm_service_plan_directory'",
 "crm_property_coverage_407:crmProperty407",
 "String(site.client_id)!==owner",
 "r.row_count>=r.limit",
 "a.open_end_date===true",
 "status==='active'",
 "a.start_date",
 "a.end_date",
 "'four_season'",
 "'spring_summer','fall','winter'",
 "state:'withheld'",
 "state:records.length?'recorded':'no_property'",
 "customer_only_not_site_evidence",
 "unclassified_season",
 "Date.parse(d+'T00:00:00Z')"
]) assert.ok(crm.includes(word),'Missing canonical coverage boundary: '+word);
assert.ok(!/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(/.test(crm),'CRM evidence branch must not write');
for(const word of [
 'data-build="407"','crm407Recheck','crm407Evidence','renderPropertyCoverage407()',
 'data-crm407-state="withheld"','data-crm407-state="no_property"',
 'data-crm407-season','active_agreement_recorded','not_verified',
 'Review','No verified active site agreement'
]) assert.ok(ui.includes(word),'Missing CRM property coverage surface '+word);
assert.ok(ui.includes("await api.manageOperations(payload)"),'Explicit canonical CRM save authority must remain unchanged');
new Function(ui);
assert.ok(help.includes('id="property-four-season-coverage-407"'));
assert.ok(roadmap.includes('#### 407 — Property & Four-Season Coverage Evidence'));
assert.ok(handbook.includes('**407 — Property & Four-Season Coverage Evidence**'));
for(const d of [roadmap,handbook])assert.ok(!/Build\s+\d+|Run\s+#?\d+|[0-9a-f]{40}/i.test(d),'No release ledger in active docs');
assert.equal(pkg.scripts['test:property-four-season-coverage-407'],'node scripts/property-four-season-coverage-407-check.mjs');
assert.equal(pkg.scripts['test:browser:property-four-season-coverage-407'],'playwright test --config=playwright.config.mjs tests/browser/property-four-season-coverage-407.spec.mjs');
assert.ok(workflow.includes('npm run test:property-four-season-coverage-407'));
assert.ok(workflow.includes('npm run test:browser:property-four-season-coverage-407'));
console.log('Build 407 source evidence, no-write authority and complete-site review acceptance PASS');
