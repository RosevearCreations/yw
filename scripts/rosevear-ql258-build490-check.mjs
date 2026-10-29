import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptSanitizedYwOwnerHandoff,noOwnerHandoffYet,STEP_KEYS,
 QL258_RELEASE,YW_PUBLIC_SNAPSHOT_SHA,REQUIRED_PATH}
 from '../server/rosevear-ql258-owner-intake-490.mjs';
const read=p=>readFileSync(p,'utf8');
const progress=Object.fromEntries(STEP_KEYS.map(k=>[k,'NOT_REPORTED']));
const packet={
 release:QL258_RELEASE,system:'yw',repository:'yw',
 publicGitHubSnapshot:{observed:'29 October 2026',mainSha:YW_PUBLIC_SNAPSHOT_SHA,
  requiredPath:REQUIRED_PATH,httpStatusAtObservedSha:404},
 ownerReportedUnverifiedProgress:progress,
 independentCustodyAuthenticated:false,sourceProofAccepted:false,
 ownerTestAuthorization:'NOT_GIVEN',authenticatedGatewayGets:0,
 connection:'DISCONNECTED',livePilotHolds:12,
 disposition:'OWNER_SELF_REPORT_ONLY_NOT_SECURITY_EVIDENCE_HELD'
};
const initial=acceptSanitizedYwOwnerHandoff(packet);
assert.equal(initial.owner_report_accepted,true);
assert.equal(initial.next_owner_action,'PRIVATELY_ASSIGN_OR_AUTHENTICATE_SIGNER_CUSTODIAN');
assert.equal(initial.decision,'HOLD');
assert.equal(noOwnerHandoffYet().owner_report_accepted,false);
const allDone=acceptSanitizedYwOwnerHandoff({...packet,
 ownerReportedUnverifiedProgress:Object.fromEntries(STEP_KEYS.map(k=>[k,'OWNER_REPORTS_DONE_NOT_VERIFIED']))});
assert.equal(allDone.reported_steps,7);
assert.equal(allDone.proof_b_published,false);
assert.equal(allDone.nonproduction_tenant_verified,false);
assert.equal(allDone.owner_test_authorization,'NOT_GIVEN');
for(const tamper of [
 {...packet,apiKey:'fake'},
 {...packet,ownerTestAuthorization:'APPROVED'},
 {...packet,sourceProofAccepted:true},
 {...packet,ownerReportedUnverifiedProgress:{...progress,tenantIsolation:'NOT_APPLICABLE'}},
 {...packet,ownerReportedUnverifiedProgress:{...progress,privateCustodian:'INDEPENDENTLY_AUTHENTICATED'}},
 {...packet,publicGitHubSnapshot:{...packet.publicGitHubSnapshot,httpStatusAtObservedSha:200}},
 {...packet,publicGitHubSnapshot:{...packet.publicGitHubSnapshot,mainSha:'f'.repeat(40)}},
 {...packet,system:'icamp'}
])assert.throws(()=>acceptSanitizedYwOwnerHandoff(tamper),/QL258_490_REJECT_/);

const sql=read('sql/ql258_platform_account_audit_490.sql');
for(const marker of ['ywi_platform_account_audit_490','ywi_is_platform_administrator_489',
 'PLATFORM_ADMIN_REQUIRED','join auth.users','revoke all on function',
 'grant execute on function','profile_email_matches_auth'])assert.ok(sql.includes(marker),marker);
assert.ok(!sql.includes('create policy')&&!sql.includes('UPDATE public.profiles'));
for(const path of ['js/company-owner-workspace-490.js','js/platform-account-audit-490.js'])
 new Function(read(path));
assert.ok(read('js/company-owner-workspace-490.js').includes('c.owner_user_id!==session.user.id'));
assert.ok(read('js/platform-account-audit-490.js').includes("sb.rpc('ywi_platform_account_audit_490')"));
assert.ok(read('index.html').includes('company-owner-workspace-490.js'));
assert.ok(read('index.html').includes('platform-account-audit-490.js'));
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:rosevear-ql258-build490']);
const flow=read('.github/workflows/staging-browser-integration.yml');
assert.ok(flow.includes('npm run test:rosevear-ql258-build490'));
assert.ok(flow.includes('npm run test:browser:company-owner-workspace-490'));
assert.ok(flow.includes('npm run test:browser:platform-account-audit-490'));
const doc=read('docs/integration/ql258-build490-REAL-STATUS.txt');
for(const marker of ['LEGACY_GLOBAL_ADMIN_REVIEW','OWNER_HANDOFF_NOT_RECEIVED',
 'SIGNER_STATUS_UNKNOWN','No authenticated signer','Separate nonproduction tenant NOT VERIFIED'])
 assert.ok(doc.includes(marker),marker);
console.log('Build 490 QL258 sanitized intake, owner/primary account gates PASS (network HOLD)');
