import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const source=read('js/workspace-organization.js');
const config=read('js/app-config.js');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const finance=read('js/finance-ui.js');
const it=read('js/it-readiness-ui.js');
const today=read('js/mobile-today.js');

const checks=[];
const add=(name,ok)=>checks.push({name,ok:!!ok});

add('organizer-loaded-before-protected-modules',/workspace-organization\.js\?v=2026-09-07a/.test(config)&&/data-ywi-workspace-organization/.test(config));
add('today-next-action-direction',/What needs attention now/.test(source)&&/todayPriority/.test(source)&&/groupTodayCards/.test(source));
add('today-no-new-server-read',!/(jsonFetch|loadAdminDirectory|fetchReferenceData)\s*\(/.test(source.match(/function todayPriority[\s\S]*?function itPanelState/)?.[0]||''));
add('finance-six-workspaces',/Finance Overview/.test(source)&&/Review Queue/.test(source)&&/Posting Controls/.test(source)&&/Reconciliation/.test(source)&&/Close & Tax/.test(source)&&/Account Mapping/.test(source));
add('finance-review-read-deferred',/finance-job-completion-review/.test(source)&&/state\.financeWorkspace !== 'review'/.test(source)&&/deferredReviewPayload/.test(source));
add('finance-posting-read-deferred',/finance-job-completion-posting-approval/.test(source)&&/state\.financeWorkspace !== 'posting'/.test(source)&&/deferredPostingPayload/.test(source));
add('finance-explicit-refresh-on-open',/key === 'review' \|\| key === 'posting'/.test(source)&&/financeRefresh/.test(source));
add('mapping-stays-explicit-on-demand',/Mapping remains an explicit human-accounting load/.test(source)&&/financeMappingWorkspace/.test(source));
add('it-five-operator-domains',/Release & Source/.test(source)&&/Database & Runtime/.test(source)&&/Finance & Accounting/.test(source)&&/Access & Security/.test(source)&&/Operations & Public/.test(source));
add('it-progressive-disclosure-details',/it-readiness-domain/.test(source)&&/document\.createElement\('details'\)/.test(source));
add('existing-it-bounded-runtime-retained',/admin-it-readiness-runtime/.test(it)&&/interactive_mode==='bounded_runtime'/.test(it));
add('existing-finance-provider-safety-retained',/Provider\/payment mutation remains OFF/.test(finance)&&/execution_release_enabled/.test(finance));
add('existing-today-sync-authority-retained',/Field sync health/.test(today)&&/Review conflict before retrying/.test(today));
add('no-finance-provider-enablement',!/(FINANCE_POSTING_EXECUTION_ENABLED\s*=\s*true|PAYMENT_PROVIDER_MUTATION_ENABLED\s*=\s*true|provider_mutation_allowed\s*=\s*true)/i.test(source+config));
add('source-command-wired',pkg.scripts?.['test:workspace-organization']==='node scripts/workspace-organization-check.mjs');
add('browser-command-wired',pkg.scripts?.['test:browser:workspace-organization']==='playwright test --config=playwright.config.mjs tests/browser/workspace-organization.spec.mjs');
add('workflow-source-gate-wired',/npm run test:workspace-organization/.test(workflow));
add('workflow-browser-gate-wired',/npm run test:browser:workspace-organization/.test(workflow));

for(const c of checks) console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}`);
const failed=checks.filter((c)=>!c.ok);
console.log(`\nBuild 231 workspace organization source gate: ${checks.length-failed.length}/${checks.length} passed.`);
if(failed.length) process.exit(1);
