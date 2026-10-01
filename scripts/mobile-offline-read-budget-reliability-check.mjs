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

const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),`${label}: missing ${needle}`));

must(endpoint,[
  'MOBILE_BUSINESS_READ_BUDGET_MAX = 13',
  'MOBILE_PERMISSION_EVALUATION_BUDGET_MAX = 2',
  'MOBILE_READ_ROUND_BUDGET_MAX = 4',
  'MOBILE_PAYLOAD_BUDGET_BYTES = 180000',
  'effectiveModuleAccess(supabase, profile, "jobs")',
  'effectiveModuleAccess(supabase, profile, "safety")',
  'accessAtLeast(jobsAccess, "view")',
  'accessAtLeast(jobsAccess, "create")',
  'accessAtLeast(jobsAccess, "approve")',
  'quantity_count:workQuantities.length',
  'material_issue_count:workMaterials.length',
  'proof_count:workProofs.length',
  'optimization_build:361',
  'payload_contract:"mobile_summary_v361"',
  'payload_bytes_estimate'
],'Build 361 mobile endpoint');
assert.equal((endpoint.match(/effectiveModuleAccess\(supabase, profile,/g)||[]).length,2,'Build 361 must evaluate only Jobs and Safety permission domains in mobile context.');
assert.ok(!endpoint.includes('inRows(supabase,"work_order_live_updates"'),'Build 361 must not read live-update history only to render a count.');
assert.ok(!endpoint.includes('inRows(supabase,"routes"'),'Build 361 must not read route metadata when the field UI only needs route-stop order.');
assert.ok(!endpoint.includes('sessionIds = uniq'),'Build 361 quantities must stay in the bounded related-source fan-out instead of a second session-ID round.');

must(mobile,[
  'CREW_LIVE_TTL_MS = 5 * 60 * 1000',
  'CREW_CACHE_STALE_MS = 4 * 60 * 60 * 1000',
  'state.crewLoadedAt < CREW_LIVE_TTL_MS',
  'production.material_issue_count ?? production.material_issues?.length',
  'production.quantity_count ?? production.quantities?.length',
  'evidence.proof_count ?? evidence.proofs?.length',
  'Read budget ≤',
  "if (authState().isAuthenticated) loadMobileCrewContext(false);"
],'Build 361 mobile refresh');
const renderBlock=mobile.match(/function render\(\) \{([\s\S]*?)\n  \}\n\n  function bind\(\)/)?.[1]||'';
assert.ok(renderBlock && !renderBlock.includes('loadMobileCrewContext('),'The 30-second local render loop must not trigger a server read.');
assert.ok(!mobile.includes('state.crewLoadedAt < 60000'),'Retired one-minute automatic mobile refresh must stay removed.');

must(api,[
  'ADMIN_READ_COALESCE_MS = 3000',
  'const adminReadCache = new Map()',
  'const adminReadInflight = new Map()',
  'function adminReadOwnerKey()',
  'if (!forceFresh && adminReadInflight.has(key)) return adminReadInflight.get(key);',
  'Math.min(10000, requestedCacheMs)',
  'invalidateAdminReadCache();'
],'Build 361 admin read coalescing');

must(outbox,[
  'ACTION_REPLAY_BATCH_LIMIT = 12',
  'let actionReplayPromise = null',
  "if (item?.status === 'conflict')",
  'skippedConflicts += 1',
  'skippedOwner += 1',
  'if (processed >= maxItems)',
  'if (actionReplayPromise) return actionReplayPromise',
  'includeLegacy = config.includeLegacy === true'
],'Build 361 offline replay');
assert.ok(!outbox.includes("includeConflicts === true"),'Conflict replay must require an explicit recovery action, not a retry flag.');

must(worker,[
  "const CACHE_NAME = 'ywi-shell-v2026-09-30b361';",
  "if (req.mode === 'navigate')",
  'if (isShellAssetRequest(url))',
  'const network = fetch(req)',
  'if (cached)',
  'event.waitUntil(network.then(() => undefined));',
  'if (isApiLikeRequest(url) || isAuthCallbackUrl(url))'
],'Build 361 service-worker cache');
must(index,[
  '/server-worker.js?v=2026-09-30b361',
  '/js/mobile-today.js?v=2026-09-30b361',
  '/js/api.js?v=2026-09-30b361',
  '/js/outbox.js?v=2026-09-30b361'
],'Build 361 asset versions');

must(help,['Build 361 — Mobile, Offline &amp; Read-Budget Reliability Optimization'],'Build 361 help');
must(roadmap,['#### **361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented','The next planned autonomous item is **364 — Workability-to-Schedule Recovery Outcomes**.'],'Build 361 roadmap');
must(handbook,['**361 — Mobile, Offline & Read-Budget Reliability Optimization** is implemented','**362 — Production Learning & Autonomous Roadmap Renewal** is implemented','**363 — Management Decision Outcome Journal & Learning Loop** is implemented','- **364 — Workability-to-Schedule Recovery Outcomes**'],'Build 361 handbook');
assert.equal(pkg.scripts?.['test:mobile-offline-read-budget-reliability'],'node scripts/mobile-offline-read-budget-reliability-check.mjs','Build 361 source script must be registered.');
assert.equal(pkg.scripts?.['test:browser:mobile-offline-read-budget-reliability'],'playwright test --config=playwright.config.mjs tests/browser/mobile-offline-read-budget-reliability.spec.mjs','Build 361 browser script must be registered.');
must(workflow,['npm run test:mobile-offline-read-budget-reliability','npm run test:browser:mobile-offline-read-budget-reliability'],'Build 361 CI wiring');

new Function(mobile);
new Function(api);
new Function(outbox);
console.log('Build 361 Mobile, Offline & Read-Budget Reliability Optimization checks: PASS');
