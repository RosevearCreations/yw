import fs from 'node:fs';import assert from 'node:assert/strict';
const r=f=>fs.readFileSync(f,'utf8');
const html=r('index.html'),platform=r('js/yw576-platform-shell.js'),tenant=r('js/yw576-company-journey.js'),
 style=r('theme-angular-576.css'),theme=r('js/theme-switcher-564.js'),command=r('js/operations-command-565.js'),
 help=r('help.html'),workspace=r('js/dual-workspace-550.js'),contract=JSON.parse(r('docs/integration/YW576_SIGNED_BOOKING_ROUTE_11.json'));
assert.ok(html.includes('/js/yw576-platform-shell.js')&&html.includes('/js/yw576-company-journey.js'));
assert.ok(html.includes('/theme-angular-576.css'));
assert.ok(theme.includes("angular:'Angular · Steel & Copper'"));
assert.ok(command.includes("location.hash!=='#sysop'"));
assert.ok(platform.includes("window.YWIDualWorkspace?.isSysopVerified?.()===true"));
assert.ok(platform.includes('not yet connected')&&platform.includes('No changes submitted'));
assert.ok(platform.includes('yw576SwitchCompany')&&platform.includes("showSection?.('company')"));
assert.ok(platform.includes("node('p','Company provisioning, subscriptions and system readiness."));
assert.ok(style.includes('html[data-yw-surface="platform"] #mainNav'));
assert.ok(style.includes('html[data-yw-surface="platform"] #moduleSectionNav'));
assert.ok(style.includes('html[data-yw-surface="platform"] .app-supporting-panels'));
for(const r of ['#workspace550CompanyLink','#workspace575Ponds','#workspace575Skateparks']){
 assert.ok(style.includes(r),'Tenant link must stay outside the Platform shell: '+r);}
assert.ok(style.includes('clip-path:polygon')&&style.includes('grid-template-columns'));
assert.ok(workspace.includes("sb.rpc('ywi_is_platform_administrator_489')"));
assert.ok(workspace.includes("sb.rpc('ywi_platform_company_directory_489')"));
assert.ok(!platform.includes("sb.from('jobs')")&&!platform.includes('service_role'));
assert.ok(tenant.includes('Canonical Job')||tenant.includes('canonical Job'));
assert.ok(help.includes('YW576 — Yard Workers SaaS Platform'));
assert.equal(contract.protocol,'1.1');assert.deepEqual(contract.supportedPeers,['1.0','1.1']);
assert.equal(contract.operation.companySiteCreated,false);
assert.equal(contract.operation.dispatchTriggered,false);
assert.equal(contract.integration.commsHub.deliveryAck,'HOLD');
console.log('YW576 isolated platform vs tenant DOM/navigation, geometry, provision HOLD and signed cross-app source policy PASS');
