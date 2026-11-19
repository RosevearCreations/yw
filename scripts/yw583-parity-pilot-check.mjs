import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectRepo583,inspectLiveReadback583,validateStagingPilot583,
 inspectHistoricalSequence583,SEVEN_583,NINE_583} from './yw583-parity-pilot.mjs';
const original=inspectRepo583();
assert.equal(original.state,'SOURCE_SEQUENCE_VERIFIED');
assert.equal(original.originalServiceCount,6);
assert.equal(original.post451ServiceCount,7);
assert.equal(original.fullCatalogCount,9);
assert.equal(original.historicalFilesIntentionallyUnchanged,true);
assert.deepEqual(NINE_583.slice(0,7),SEVEN_583);
const r={audit_source:'YW583_LIVE_READ_ONLY',
 company_count:1,row_count:7,enabled_count:0,companies_with_registry:1,
 arboriculture_rows:1,registry_allows_arboriculture:true,
 audit_allows_arboriculture:true,seed_has_seventh:true,
 new_work_guard_is_seven_and_permission_checked:true,
 navigation_requires_seven:true,specialty_580_enrolled:false,
 photo_staging_581_enrolled:false,photo_custody_582_enrolled:false};
const p={expectedCompanyCount:1,expectedProjectRef:'production-x',
 observedProjectRef:'production-x',productionProjectRef:'production-x'};
const good=inspectLiveReadback583(r,p);
assert.equal(good.state,'LIVE_REGISTRY_READ_ONLY_VERIFIED');
assert.equal(good.liveOriginalRegistrySeven,true);
assert.equal(good.nineServicesOperational,false);
assert.equal(good.photoPilotAccepted,false);
for(const [name,patch,args] of [
 ['wrong project',{}, {observedProjectRef:'outside'}],
 ['wrong company count',{}, {expectedCompanyCount:2}],
 ['six-only navigation',{navigation_requires_seven:false},{}],
 ['missing audit seven',{audit_allows_arboriculture:false},{}],
 ['missing seed seven',{seed_has_seventh:false},{}],
 ['Jobs gate not present',{new_work_guard_is_seven_and_permission_checked:false},{}],
 ['one service disabled/absent',{row_count:6},{}],
 ['owner company unmatched',{companies_with_registry:0},{}],
 ['arbor absent',{arboriculture_rows:0},{}],
 ['unreviewed enabled service',{enabled_count:1},{}],
 ['malformed photo evidence',{photo_staging_581_enrolled:'yes'},{}]
]){
 const result=inspectLiveReadback583({...r,...patch},{...p,...args});
 assert.equal(result.state,'HOLD',name);
}
const now=Date.parse('2026-11-19T03:30:00Z'),src='a'.repeat(40);
const signedClaim={project_ref:'staging-yw',environment:'staging',production_unmodified:true,
 original_company_job_bound:true,all_nine_services_reviewed:true,
 cross_tenant_denied:true,revoked_jobs_denied:true,consent_denied:true,
 private_object_read_denied:true,file_bytes_rehashed_by_independent_worker:true,
 retention_legal_holds_tested:true,separate_owner_and_dba_signoff:true,
 backup_restore_proven:true,schema_parity_verified:true,source_sha:src,
 observed_at:new Date(now).toISOString()};
const options={productionRef:'production-yw',approvedStagingRef:'staging-yw',
 approvedSourceSha:src,now};
const claim=validateStagingPilot583(signedClaim,options);
assert.equal(claim.state,'STAGING_PILOT_SELF_REPORT_REQUIRES_WITNESS');
assert.equal(claim.photoPilotAccepted,false);
for(const [name,patch,arg] of [
 ['production used as staging',{project_ref:'production-yw'},{}],
 ['invalid project',{project_ref:'unknown'},{}],
 ['cross-company not denied',{cross_tenant_denied:false},{}],
 ['missing private read deny',{private_object_read_denied:false},{}],
 ['missing worker proof',{file_bytes_rehashed_by_independent_worker:false},{}],
 ['owner signoff alone',{separate_owner_and_dba_signoff:false},{}],
 ['restore not proven',{backup_restore_proven:false},{}],
 ['photo job unbound',{original_company_job_bound:false},{}],
 ['source unpinned',{source_sha:'b'.repeat(40)},{}],
 ['expired evidence',{observed_at:'2026-11-15T03:30:00Z'},{}],
 ['no staging project',{}, {approvedStagingRef:'production-yw'}]
]){
 assert.equal(validateStagingPilot583({...signedClaim,...patch},{...options,...arg}).state,'HOLD',name);
}
const files=['sql/yw583_live_seven_service_AUDIT_READ_ONLY.sql',
 'sql/pms_septic_arboriculture_451.sql',
 'sql/pms_tenant_module_navigation_443.sql'];
const sql=readFileSync(files[0],'utf8');
assert.ok(/YW583_LIVE_READ_ONLY/.test(sql));
assert.ok(/to_regclass\('public\.ywi_581_service_acceptance'\)/.test(sql));
assert.ok(!/\b(insert|update|delete|alter|drop|truncate|create)\s+(into|table|function|trigger|policy|index|view)\b/i.test(sql.replace(/--[^\n]*/g,'')),'read-only query must not change database');
assert.ok(/six-service/.test(readFileSync(files[2],'utf8')),'historic 443 untouched');
assert.ok(/v_count<>7/.test(readFileSync(files[1],'utf8')),'later 451 authoritative');
console.log('YW583 PASS: historical migration 420→421→443→451 correctly resolves to SEVEN, nine catalogue identities remain separately gated, 22 fail-closed live/staging cases; no photo or production activation');
