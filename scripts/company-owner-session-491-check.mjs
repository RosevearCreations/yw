import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>readFileSync(path,'utf8');
const owner=read('js/company-owner-workspace-490.js');
const registry=read('js/company-service-registry-420.js');
const platform=read('js/platform-account-audit-490.js');
for(const source of [owner,registry,platform])new Function(source);

for(const marker of ['generation++','assertCurrent()','ywi:auth-changed',
 'ywi:company-service-offering-changed','ywi:company-registry-loaded-491',
 'verifiedIds.has(focus.companyId)','owner420Refresh'])
 assert.ok(owner.includes(marker),`owner session/focus guard: ${marker}`);
for(const marker of ['let epoch=0','run!==epoch','assertCurrent()',
 'data-owner420-company','ywi:company-registry-loaded-491']) {
 const normalized=marker==='data-owner420-company'?'dataset.owner420Company':marker;
 assert.ok(registry.includes(normalized),`service registry session guard: ${normalized}`);
}
for(const marker of ['generation++','assertCurrent()','createDocumentFragment',
 'records.replaceChildren(view)','ywi:auth-changed'])
 assert.ok(platform.includes(marker),`platform audit session guard: ${marker}`);
assert.ok(!owner.includes('.update('),'Owner dashboard may not mutate company records');
assert.ok(!platform.includes('.update('),'Platform audit may not mutate roles');

const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:company-owner-session-491']);
assert.ok(pkg.scripts['test:browser:company-owner-session-491']);
const workflow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(workflow.includes('npm run test:company-owner-session-491'));
assert.ok(workflow.includes('npm run test:browser:company-owner-session-491'));
const index=read('index.html');
for(const path of ['company-service-registry-420.js','company-owner-workspace-490.js','platform-account-audit-490.js']) {
 const version=path==='company-service-registry-420.js'?'20261030b491':'20261031b495';
 assert.ok(index.includes(path+'?v='+version),`browser cache version ${path}`);
}
const spec=read('tests/browser/company-owner-session-491.spec.mjs');
const syntax=spawnSync(process.execPath,['--check','tests/browser/company-owner-session-491.spec.mjs'],{encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr||'Browser spec syntax invalid');
for(const marker of ['pending','second owned company','service change','platform audit','company module registry'])
 assert.ok(spec.includes(marker),`browser coverage ${marker}`);
console.log('Build 491: owner/platform session privacy and selected-company focus source gates PASS');
