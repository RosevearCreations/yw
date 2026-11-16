import fs from 'node:fs';import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');
const index=read('index.html'),help=read('help.html'),security=read('js/security.js');
const companyNav=read('js/pms-module-navigation-443.js'),registry=read('js/company-service-registry-420.js'),specialty=read('js/yw575-specialty-ui.js');
const files=['js/yw575-specialty-ui.js','js/ponds-module-575.js','js/skateparks-module-575.js','js/yw575-identity-readiness-ui.js'];
for(const p of files)assert.ok(read(p).length>300,p+' source present');
for(const route of ['ponds','skateparks']){
 assert.ok(index.includes('id="'+route+'" class="card"'),route+' real routed view');
 assert.ok(!index.includes('id="workspace575'+(route==='ponds'?'Ponds':'Skateparks')+'"'),route+' absent from top workspace navigation');
 assert.ok(companyNav.includes("route:'"+route+"'"),route+' in verified company service navigator');
 assert.ok(registry.includes("route:'"+route+"'"),route+' in company service registry');
 assert.ok(security.includes("id === '"+route+"'"),route+' authenticated owner guard');
 assert.ok(help.includes('YW575 Specialty Modules'),'help and scope');
}
assert.ok(read('js/ponds-module-575.js').includes('Pond maintenance service'));
assert.ok(read('js/skateparks-module-575.js').includes('Lifecycle & repairs'));
assert.ok(read('js/yw575-specialty-ui.js').includes('no data saved'));
assert.ok(!security.includes('w.ownedCompanies > 0 || window.YWIDualWorkspace'));
assert.ok(!specialty.includes('w.ownedCompanies>0||window.YWIDualWorkspace'));
assert.ok(companyNav.includes('data.pms443Specialty')||companyNav.includes('dataset.pms443Specialty'));
assert.ok(registry.includes('dataset.owner420Specialty'));
assert.ok(read('js/yw575-identity-readiness-ui.js').includes('no admin privileges') ||
 read('js/yw575-identity-readiness-ui.js').includes('no admin privileges or real revocation'));
for(const p of ['index.html','help.html','README.md']){
 assert.ok(!/Yard Weasels/i.test(read(p)),p+' must not show retired company brand');
}
assert.ok(index.includes('yardweasels.ca'),'existing verified URL retained pending separate redirect');
console.log('YW575 separate specialty routes, access guards, readiness panel and public-facing brand test passed');
