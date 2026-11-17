import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const r=f=>readFileSync(f,'utf8');
const html=r('index.html'),help=r('help.html'),script=r('js/yw578-activation-readiness-ui.js'),
 css=r('finance-activation-578.css'),build=r('scripts/build-vercel-site.mjs'),
 verifier=r('scripts/yw578-financial-activation.mjs'),contract=JSON.parse(r('docs/integration/YW578_FINANCIAL_ACTIVATION_11.json')),
 pkg=JSON.parse(r('package.json'));
new vm.Script(script,{filename:'js/yw578-activation-readiness-ui.js'});
assert.ok(html.includes('/js/yw578-activation-readiness-ui.js'));
assert.ok(html.includes('/finance-activation-578.css'));
assert.ok(html.indexOf('yw577-finance-custody-ui.js')<html.indexOf('yw578-activation-readiness-ui.js'));
assert.ok(build.includes("'finance-activation-578.css'"));
assert.ok(script.includes("window.YWIFinanceCustody577?.allowed?.()===true"));
assert.ok(script.includes("dataset.ywSurface!=='platform'"));
assert.ok(script.includes("host=$('finance')"));
assert.ok(script.includes('LIVE PROVIDER & BANK: NOT VERIFIED'));
assert.ok(!/\bfetch\s*\(|\bsupabase\b|\bsb\.from\(|service_role|localStorage|sessionStorage|window\.open|POST\b/i.test(script));
assert.ok(css.includes('html[data-yw-surface="platform"] #yw578Readiness'));
assert.ok(css.includes('@media(max-width:800px)'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(help.includes('YW578 — Financial Activation Readiness'));
assert.ok(verifier.includes('verifyFinancialCustody577'));
assert.ok(verifier.includes('externallyActivated:false'));
assert.ok(verifier.includes('canPayPayroll:false'));
assert.equal(contract.protocol,'1.1');
assert.deepEqual(contract.supportedPeers,['1.0','1.1']);
assert.equal(contract.mutations.capture,false);
assert.equal(contract.mutations.payrollExecution,false);
assert.equal(contract.mutations.taxFiling,false);
assert.equal(contract.mutations.periodClose,false);
assert.equal(contract.dependencies.providerEnrolled,false);
assert.equal(contract.crossApp.masterAck,'HOLD');
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558'].includes('yw578-activation-check.mjs'));
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558'].includes('yw578-activation-ui-check.mjs'));
console.log('YW578 company-only Finance UX, no-execution, Vercel asset and guarded external-approval contract PASS');
