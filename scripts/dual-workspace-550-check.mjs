import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file,'utf8');
const html=read('index.html'), module=read('js/dual-workspace-550.js');
const security=read('js/security.js'), router=read('js/router.js');
const auth=read('js/auth.js'), edge=read('supabase/functions/admin-it-readiness-runtime/index.ts');
const it=read('js/it-readiness-ui.js'), comms=read('js/it-system-workspace.js');

for(const phrase of ['id="workspace550Nav"','id="workspace550Company"','id="workspace550Sysop"','/js/dual-workspace-550.js'])
  assert.ok(html.includes(phrase),'Missing dual-workspace shell: '+phrase);
for(const phrase of ["sb.auth.getUser()","sb.rpc('ywi_is_platform_administrator_489')", "sb.from('ywi_companies')",
  "sb.rpc('ywi_platform_company_directory_489')",'c.owner_user_id!==id',"state.companyRows=[]",'current(generation,id)',
  "element('td',value)","state.platformRows=summary.data.map",'isSysopVerified:'])
  assert.ok(module.includes(phrase),'Missing authority/isolation proof: '+phrase);
assert.ok(!module.includes('localStorage')&&!module.includes('sessionStorage'),'No platform or company data is stored in browser storage.');
assert.ok(!module.includes('owner_email'),'Platform view must not consume sensitive owner email.');
assert.ok(security.includes("id === 'sysop'" )&&security.includes("id === 'company'"));
assert.ok(router.includes('#workspace550Nav a[href^="#"]'));
assert.ok(!auth.includes('normalizeRole(user?.user_metadata?.role')&&!auth.includes('normalizeRole(user?.user_metadata?.staff_tier'),
  'Account-editable user metadata must not elevate roles.');
for(const phrase of ['ywi_platform_administrators_489',".eq(\"user_id\", actorId)","Verified platform Sysop membership is required for I.T. Readiness."])
  assert.ok(edge.includes(phrase),'I.T. authority must require curated Sysop membership: '+phrase);
assert.ok(it.includes('historicalTechnicalArchive()')&&it.includes('itHistoricalTechnicalArchive'));
assert.ok(!it.includes("${panel('schema_preflight','Preflight'"));
assert.ok(!comms.includes('<strong>DISCONNECTED / HOLD.</strong>'));
assert.ok(comms.includes('Live connection not verified by this screen.'));
console.log('YW 550 dual workspace, curated Sysop authority, tenant isolation and archived historic prelaunch checks GREEN');
