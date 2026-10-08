import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const directory=read('supabase/functions/admin-directory/index.ts');
const ui=read('js/admin-owner-management-command-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const index=read('index.html');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const browser=read('tests/browser/four-season-capacity-profitability-scenario-evidence.spec.mjs');
const must=(s,a,l)=>a.forEach(x=>assert.ok(s.includes(x),l+': missing '+x));

must(directory,[
  'function buildFourSeasonCapacityProfitabilityScenarioEvidence',
  "spring_summer:'Spring / summer landscaping & lawn'",
  "fall:'Fall cleanup & leaf'",
  "winter:'Winter snow / storm / ice'",
  "four_season:'General four-season operations'",
  'planned_mix_share_percent',
  'shared_active_crew_day_evidence',
  'configured_route_capacity_headroom_minutes',
  'workability_recovery_rate_percent',
  'recurring_visits_without_quantified_material_plan',
  'recorded_job_profit_total',
  'recorded_recurring_profit_total',
  'missing_assumptions:missing',
  "No scheduled dispatch or recurring-visit demand is recorded in the current 14-day horizon; demand is not invented.",
  "No configured route daily-capacity headroom evidence is recorded for this season; capacity headroom is not assumed.",
  "Finance profitability evidence is hidden by permission; no margin or profit assumption is substituted.",
  "profitability_boundary:'Job-family profitability and recurring-agreement profitability are displayed as separate recorded sources and are not added together",
  "authority_boundary:'Read-only decision support only. This layer cannot auto-price, dispatch, hire, schedule, purchase, contact suppliers/customers, create estimates/invoices, or commit customer/vendor work.'",
  'four_season_capacity_profitability_scenarios:buildManagementMetricConfidence',
  'four_season_capacity_profitability_scenario_evidence:fourSeasonCapacityProfitabilityScenarioEvidence'
],'Build 375 server');

const start=directory.indexOf('function buildFourSeasonCapacityProfitabilityScenarioEvidence');
const end=directory.indexOf('\nserve(async (req) => {',start);
const helper=directory.slice(start,end);
assert.ok(helper.length>4000,'Build 375 helper slice missing');
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(helper),'Build 375 helper must remain read-only.');
for(const forbidden of ['auto_price','auto_dispatch','auto_hire','create_purchase_order','supplier_message_send']){
  assert.equal(helper.includes(forbidden),false,'Build 375 helper may not add mutation authority: '+forbidden);
}

must(ui,[
  'Four-season capacity mix &amp; profitability scenario evidence',
  'owner375Scenarios',
  'renderFourSeasonCapacityProfitabilityScenarios',
  "metricMeta('four_season_capacity_profitability_scenarios')",
  'Evidence scenarios only — no automatic commitments:',
  '14-day planned',
  'Configured route capacity',
  'Recorded profitability',
  'Missing assumptions / evidence gaps',
  'data-owner375-season',
  'Finance profitability hidden by permission; no substitute assumption used.',
  'Mix, capacity, profitability, materials &amp; authority boundaries',
  'renderFourSeasonCapacityProfitabilityScenarios();'
],'Build 375 UI');

assert.equal(pkg.scripts?.['test:four-season-capacity-profitability-scenario-evidence'],'node scripts/four-season-capacity-profitability-scenario-evidence-check.mjs');
assert.equal(pkg.scripts?.['test:browser:four-season-capacity-profitability-scenario-evidence'],'playwright test --config=playwright.config.mjs tests/browser/four-season-capacity-profitability-scenario-evidence.spec.mjs');
must(workflow,['npm run test:four-season-capacity-profitability-scenario-evidence','npm run test:browser:four-season-capacity-profitability-scenario-evidence'],'Build 375 CI');
must(index,['/js/admin-owner-management-command-ui.js?v=2026-10-08b375','/js/admin-owner-management-command-ui.js?v=2026-09-30b360'],'Build 375 asset/provenance');
must(help,['Build 375 — Four-Season Capacity Mix &amp; Profitability Scenario Evidence','Recorded mix, not invented demand','Profit sources stay separate','Missing assumptions stay visible','No automatic commercial or operating commitment'],'Build 375 help');
must(roadmap,['#### **375 — Four-Season Capacity Mix & Profitability Scenario Evidence** is implemented','The next planned autonomous item is **376 — Production Learning & Autonomous Roadmap Renewal II**.'],'Build 375 roadmap');
must(handbook,['**375 — Four-Season Capacity Mix & Profitability Scenario Evidence** (implemented)','- **376 — Production Learning & Autonomous Roadmap Renewal II**','After item 375, that item is 376 — Production Learning & Autonomous Roadmap Renewal II.'],'Build 375 handbook');
must(browser,['Spring / summer landscaping & lawn','Fall cleanup & leaf','Winter snow / storm / ice','General four-season operations','Finance profitability hidden by permission','document.documentElement.scrollWidth>document.documentElement.clientWidth'],'Build 375 browser');

new Function(ui);
console.log('Build 375 Four-Season Capacity Mix & Profitability Scenario Evidence checks: PASS');
