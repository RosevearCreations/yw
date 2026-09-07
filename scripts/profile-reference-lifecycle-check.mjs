import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const reference=read('js/reference-data.js');
const config=read('js/app-config.js');
const profile=read('js/profile-ui.js');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const handbook=read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const next=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});

add('reference-bounded-ttl',/REFERENCE_TTL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(reference));
add('reference-route-scoped',/REFERENCE_ROUTES/.test(reference)&&/routeNeedsReferenceData/.test(reference)&&/loadForRoute/.test(reference));
add('reference-inflight-coalescing',/state\.inflight/.test(reference)&&/state\.inflightIdentity/.test(reference)&&/return state\.inflight/.test(reference));
add('reference-explicit-force-refresh',/options\?\.force\s*===\s*true/.test(reference)&&/!force && isFresh/.test(reference));
add('reference-identity-invalidation',/identity-change/.test(reference)&&/state\.identityKey !== key/.test(reference));
add('reference-stale-response-guard',/loadVersion !== state\.loadVersion/.test(reference)&&/identityKey\(currentState\) !== key/.test(reference));
add('reference-failure-is-nonblocking',/Reference data refresh failed; the current screen remains usable/.test(reference));
add('reference-no-global-eager-load',!/function init\(\) \{ bind\(\); load\(\); \}/.test(reference));
add('profile-factory-decorated-not-replaced',/decorateProfileFactory/.test(reference)&&/originalCreate\(\{ \.\.\.config, api:createGuardedApi/.test(reference));
add('profile-self-route-guard',/scope === 'self'\) return route === 'me'/.test(reference));
add('profile-crew-route-guard',/scope === 'crew'\) return route === 'crew'/.test(reference));
add('profile-time-route-guard',/currentRoute\(\) !== 'me'/.test(reference)&&/active_entry:null, recent_entries:\[\], jobs:\[\]/.test(reference));
add('profile-identical-read-coalescing',/const inflight = new Map\(\)/.test(reference)&&/function coalesce\(key, run\)/.test(reference));
add('profile-save-invalidates-reference',/self-profile-save/.test(reference)&&/registry\.active\?\.invalidate/.test(reference));
add('legacy-profile-ui-authority-retained',/window\.YWIProfileUI = \{ create: createProfileUI \}/.test(profile));
add('auth-callback-prebootstrap-guard',/installAuthCallbackLifecycleGuard/.test(config)&&/supabase\.createClient = guardedCreateClient/.test(config));
add('auth-callback-synchronous-wrapper',/originalOnAuthStateChange\(\(event, session\) => \{ deferCallback\(callback, event, session\); \}\)/.test(config));
add('auth-callback-deferred-microtask',/queueMicrotask\(run\)/.test(config)&&/Promise\.resolve\(callback\(event, session\)\)/.test(config));
add('auth-callback-error-visible-not-throwing-lock',/auth-callback/.test(config)&&/reportCallbackFailure/.test(config));
add('no-finance-provider-enablement',!/(FINANCE_POSTING_EXECUTION_ENABLED\s*=\s*true|PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true|provider_mutation_allowed\s*=\s*true)/i.test(reference+config));
add('source-command-wired',pkg.scripts?.['test:profile-reference-lifecycle']==='node scripts/profile-reference-lifecycle-check.mjs');
add('browser-command-wired',pkg.scripts?.['test:browser:profile-reference-lifecycle']==='playwright test --config=playwright.config.mjs tests/browser/profile-reference-lifecycle.spec.mjs');
add('workflow-source-gate-wired',/npm run test:profile-reference-lifecycle/.test(workflow));
add('workflow-browser-gate-wired',/npm run test:browser:profile-reference-lifecycle/.test(workflow));
add('help-current-profile-lifecycle',/profile record first/i.test(help)&&/Crew.*only when/i.test(help));
add('handbook-current-profile-lifecycle',/reference data/i.test(handbook)&&/in-flight/i.test(handbook));
add('next-sanity-profile-lifecycle',/Profile.*Crew.*reference data/i.test(next));
add('active-docs-no-build-ledger',![handbook,next].some((text)=>/Build\s+230|35c65fa|194d5c2/i.test(text)));

for(const c of checks) console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}${c.detail?` — ${c.detail}`:''}`);
const failed=checks.filter((c)=>!c.ok);
console.log(`\nBuild 230 profile/reference lifecycle source gate: ${checks.length-failed.length}/${checks.length} passed.`);
if(failed.length) process.exit(1);
