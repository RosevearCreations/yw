import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(path,'utf8');
const endpoint=read('supabase/functions/mobile-crew-context/index.ts');
const mobile=read('js/mobile-today.js');
const api=read('js/api.js');
const outbox=read('js/outbox.js');
const worker=read('server-worker.js');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const browser=read('tests/browser/mobile-offline-reliability-trend-outcomes.spec.mjs');

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),`${label}: missing ${needle}`));
const constNumber=(source,name)=>{
  const match=source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
  assert.ok(match,`Missing numeric constant ${name}`);
  return Number(match[1]);
};

const baseline={
  business_read_ceiling:13,
  payload_budget_bytes:180000,
  live_ttl_ms:300000,
  cache_stale_ms:14400000,
  replay_batch_max:12,
  admin_read_coalesce_ms:3000
};

assert.ok(constNumber(endpoint,'MOBILE_BUSINESS_READ_BUDGET_MAX')<=baseline.business_read_ceiling,'Build 374 release hold: Mobile Crew business-read ceiling may not rise above the retained item 361 baseline.');
assert.ok(constNumber(endpoint,'MOBILE_PAYLOAD_BUDGET_BYTES')<=baseline.payload_budget_bytes,'Build 374 release hold: payload budget may not rise above the retained item 361 baseline.');
assert.ok(constNumber(outbox,'ACTION_REPLAY_BATCH_LIMIT')<=baseline.replay_batch_max,'Build 374 release hold: offline replay batch ceiling may not rise above the retained item 361 baseline.');
assert.ok(constNumber(api,'ADMIN_READ_COALESCE_MS')>=baseline.admin_read_coalesce_ms,'Build 374 release hold: Admin read coalescing may not become more aggressive than the retained item 361 baseline.');

must(mobile,[
  'MOBILE_RELIABILITY_RELEASE_HISTORY',
  'build:361, business_read_ceiling:13, payload_budget_bytes:180000, live_ttl_ms:300000, cache_stale_ms:14400000, replay_batch_max:12, admin_read_coalesce_ms:3000',
  'build:374, business_read_ceiling:13, payload_budget_bytes:180000, live_ttl_ms:300000, cache_stale_ms:14400000, replay_batch_max:12, admin_read_coalesce_ms:3000',
  "state: regressions.length ? 'regression_hold' : 'within_guardrails'",
  "regressions.push('business read ceiling increased')",
  "regressions.push('observed payload exceeded the retained release budget')",
  "regressions.push('automatic live refresh became more frequent')",
  "regressions.push('signed-in session cache stale window increased')",
  "regressions.push('offline replay batch ceiling increased')",
  "regressions.push('admin read coalescing window decreased')",
  "conflict_rate_percent: conflictRatePercent",
  "refresh_contract: 'auth/route/visibility/reconnect or explicit Refresh after the five-minute live TTL; the 30-second local render loop never performs a server read'",
  'aggregate counts and release contracts only; no customer data, notes, queued payload bodies or device identifiers are retained by this evidence view',
  'Fix the regression; do not raise the retained budgets to clear this signal.',
  'mobile-reliability-v374',
  'reliabilityReleaseHistory'
],'Build 374 mobile reliability evidence');

must(mobile,[
  'const CREW_LIVE_TTL_MS = 5 * 60 * 1000',
  'const CREW_CACHE_STALE_MS = 4 * 60 * 60 * 1000'
],'Build 374 retained refresh/cache contracts');

const evidenceSlice=mobile.slice(mobile.indexOf('function mobileReliabilityEvidence('),mobile.indexOf('function countDraftForms()'));
assert.ok(evidenceSlice.length>500,'Build 374 reliability helper must be inspectable.');
for(const forbidden of ['sessionStorage.setItem','localStorage.setItem','fetch(','manageOperations(','my_jobs','my_route']){
  assert.equal(evidenceSlice.includes(forbidden),false,`Build 374 evidence must remain aggregate/read-only: ${forbidden}`);
}

must(endpoint,[
  'payload_budget_bytes:MOBILE_PAYLOAD_BUDGET_BYTES',
  'payload_bytes_estimate:0',
  'payload.meta.read_budget.payload_bytes_estimate = bytes',
  'payload.meta.read_budget.payload_budget_state = bytes <= MOBILE_PAYLOAD_BUDGET_BYTES ? "within_budget" : "over_budget"'
],'Build 374 runtime payload evidence');
must(outbox,['ACTION_REPLAY_BATCH_LIMIT = 12','getActionSummary'],'Build 374 offline aggregate evidence');
must(api,['ADMIN_READ_COALESCE_MS = 3000','const adminReadCache = new Map()','const adminReadInflight = new Map()'],'Build 374 Admin read coalescing evidence');

must(index,[
  "/server-worker.js?v=2026-10-08b374",
  "/js/mobile-today.js?v=2026-10-08b374",
  '/js/mobile-today.js?v=2026-09-30b361'
],'Build 374 shell asset evidence');
must(worker,[
  "const CACHE_NAME = 'ywi-shell-v2026-10-08b374';",
  "const CACHE_NAME = 'ywi-shell-v2026-09-30b361';"
],'Build 374 cache rotation/provenance');

must(help,['Build 374 — Mobile Offline Reliability Trend &amp; Read-Budget Guardrail Outcomes','No private payload retention','Fail-closed release guardrails'],'Build 374 help');
must(roadmap,['#### **374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes** is implemented','The next planned autonomous item is **375 — Four-Season Capacity Mix & Profitability Scenario Evidence**.'],'Build 374 roadmap');
must(handbook,['**374 — Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes** (implemented)','- **375 — Four-Season Capacity Mix & Profitability Scenario Evidence**'],'Build 374 handbook');
assert.equal(pkg.scripts?.['test:mobile-offline-reliability-trend-outcomes'],'node scripts/mobile-offline-reliability-trend-outcomes-check.mjs','Build 374 source script must be registered.');
assert.equal(pkg.scripts?.['test:browser:mobile-offline-reliability-trend-outcomes'],'playwright test --config=playwright.config.mjs tests/browser/mobile-offline-reliability-trend-outcomes.spec.mjs','Build 374 browser script must be registered.');
must(workflow,['npm run test:mobile-offline-reliability-trend-outcomes','npm run test:browser:mobile-offline-reliability-trend-outcomes'],'Build 374 CI wiring');
must(browser,['item 361 → 374','local conflict rate 33.3%','REGRESSION / RELEASE HOLD','do not raise the retained budgets','scrollWidth-document.documentElement.clientWidth'],'Build 374 browser acceptance');

new Function(mobile);
console.log('Build 374 Mobile Offline Reliability Trend & Read-Budget Guardrail Outcomes checks: PASS');
