import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const r=p=>fs.readFileSync(p,'utf8');
const html=r('index.html'),ui=r('js/yw577-finance-custody-ui.js'),
css=r('finance-custody-577.css'),help=r('help.html'),
builder=r('scripts/build-vercel-site.mjs'),contract=JSON.parse(r('docs/integration/YW577_FINANCIAL_CUSTODY_11.json')),
pms=r('js/pms-accounting-447.js'),payroll=r('js/pms-payroll-446.js'),
finance=r('js/finance-ui.js'),platform=r('js/yw576-platform-shell.js'),
pkg=JSON.parse(r('package.json'));
new vm.Script(ui,{filename:'yw577-finance-custody-ui.js'});
assert.ok(html.includes('/js/yw577-finance-custody-ui.js'), 'web entry contains finance evidence module');
assert.ok(html.includes('/finance-custody-577.css'), 'company finance style linked');
assert.ok(builder.includes("'finance-custody-577.css'"), 'Vercel publishes all styles');
assert.ok(ui.includes("document.documentElement.dataset.ywSurface!=='platform'"));
assert.ok(ui.includes("window.YWIDualWorkspace?.snapshot?.().ownedCompanies"));
assert.ok(ui.includes("canViewModule?.('finance'"));
assert.ok(ui.includes("host=$('finance')"));
assert.ok(ui.includes('UNKNOWN / HOLD'));
assert.ok(!ui.includes("sb.from('ar_invoices')")&&!ui.includes('service_role'));
assert.ok(css.includes('[aria-pressed="true"]')&&css.includes('@media(max-width:800px)'));
assert.ok(css.includes('html[data-yw-surface="platform"] #yw577Custody'));
assert.ok(help.includes('YW577 — Financial Custody'));
assert.ok(pms.includes('invoices_created!==false'));
assert.ok(payroll.includes('payroll_executed!==false'));
assert.ok(finance.includes('server-owned')&&platform.includes('Sysop'));
assert.equal(contract.protocol,'1.1');assert.deepEqual(contract.supportedPeers,['1.0','1.1']);
assert.equal(contract.mutations.invoice_posted,false);
assert.equal(contract.mutations.payroll_executed,false);
assert.equal(contract.mutations.tax_filed,false);
assert.equal(contract.mutations.provider_payment_captured,false);
assert.equal(contract.boundaries.sysop_access_to_tenant_finance,false);
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558'].includes('yw577-financial-custody-check.mjs'));
assert.ok(pkg.scripts['test:landscape-supervisor-resolution-558'].includes('yw577-finance-ui-check.mjs'));
console.log('YW577 tenant-only Finance navigation, asset publishing and server-source/RLS HOLD boundaries PASS');
