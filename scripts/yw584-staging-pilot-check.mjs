import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {REQUIRED_MIGRATIONS_584,inspectMigrationReadback584,
 inspectOriginalJobPhoto584,digestSource584} from './yw584-staging-pilot.mjs';
const src='a'.repeat(40),production='production-yw',staging='staging-yw';
const evidence={environment:'staging',project_ref:staging,source_sha:src,
 applied_migrations:[...REQUIRED_MIGRATIONS_584],
 backup_restore_verified:true,production_unmodified:true,
 tenant_rls_negative_tests_passed:true,storage_private_denials_passed:true,
 original_job_source_pinned:true,site_editor_company_boundary_passed:true,
 sysop_aggregate_boundary_passed:true,all_nine_services_reviewed:true,
 staged_580_581_582_584_tables_present:true,site_publication_disabled:true,
 rental_payment_disabled:true};
const opts={productionProjectRef:production,stagingProjectRef:staging,expectedGitSha:src};
const pass=inspectMigrationReadback584(evidence,opts);
assert.equal(pass.state,'STAGING_MIGRATION_SELF_REPORT_ONLY');
assert.equal(pass.stagingEnrolled,false);
assert.equal(pass.realPhotoPilotAccepted,false);
let negatives=0;
for(const [name,patch,options] of [
 ['production as staging',{project_ref:production},{}],
 ['actual ref mismatch',{project_ref:'foreign-yw'},{}],
 ['wrong environment',{environment:'production'},{}],
 ['wrong source',{source_sha:'b'.repeat(40)},{}],
 ['production ref collision',{}, {stagingProjectRef:production}],
 ['no migration 584',{applied_migrations:evidence.applied_migrations.slice(0,-1)},{}],
 ['duplicate migration',{applied_migrations:[...REQUIRED_MIGRATIONS_584,REQUIRED_MIGRATIONS_584[0]]},{}],
 ['no backup restore',{backup_restore_verified:false},{}],
 ['prod touched',{production_unmodified:false},{}],
 ['tenant RLS missing',{tenant_rls_negative_tests_passed:false},{}],
 ['public bucket risk',{storage_private_denials_passed:false},{}],
 ['original job not pinned',{original_job_source_pinned:false},{}],
 ['site editor cross-company risk',{site_editor_company_boundary_passed:false},{}],
 ['Sysop aggregate leaking',{sysop_aggregate_boundary_passed:false},{}],
 ['service test missing',{all_nine_services_reviewed:false},{}],
 ['staged tables missing',{staged_580_581_582_584_tables_present:false},{}],
 ['published without approval',{site_publication_disabled:false},{}],
 ['rental payment without approval',{rental_payment_disabled:false},{}]
 ]){
 assert.equal(inspectMigrationReadback584({...evidence,...patch},{...opts,...options}).state,'HOLD',name);negatives++;
}
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const company=uuid(10),job=uuid(11),client=uuid(12),site=uuid(13);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('independent-review-file-original-byte-content')]);
const h=b=>createHash('sha256').update(b).digest('hex');
const object=company+'/'+job+'/'+uuid(14)+'.png';
const record={company_id:company,job_id:job,client_id:client,client_site_id:site,
 service_key:'landscape',consent_scope:'job_documentation',consent_recorded:true,
 private_object_key:object,reported_sha256:h(png),media_type:'image/png'};
const storage={bucket:'ywi-private-job-photos-581',public:false,path:object};
const claim={company_id:company,job_id:job,client_id:client,client_site_id:site,
 authenticated_server_readback:true,original_422_link_checked:true,
 jobs_permission_revocation_denied:true,foreign_company_read_denied:true,
 photo_upload_request_idempotent:true,audit_receipt_readback:true,
 owner_verified:true,legal_hold_custody_passed:true,
 object_read_private_to_foreign_users:true,worker_observed_sha256:h(png),
 worker_receipt_id:uuid(16),worker_storage_readback:true};
const witnesses={separately_pinned:true,owner_id:uuid(20),reviewer_id:uuid(21),
 source_signature_verified:true,expiry_verified:true};
const ok=inspectOriginalJobPhoto584({claim,bytes:png,record,storage,witnesses});
assert.equal(ok.state,'PILOT_PACKET_REVIEW_REQUIRED');
assert.equal(ok.realPhotoPilotAccepted,false);
for(const [name,field,delta] of [
 ['foreign company','record',{company_id:uuid(19)}],
 ['wrong original site','claim',{client_site_id:uuid(9)}],
 ['no server readback','claim',{authenticated_server_readback:false}],
 ['Jobs revocation not denied','claim',{jobs_permission_revocation_denied:false}],
 ['foreign user read not denied','claim',{foreign_company_read_denied:false}],
 ['missing audit receipt','claim',{audit_receipt_readback:false}],
 ['legal hold not proven','claim',{legal_hold_custody_passed:false}],
 ['worker not rehashed','claim',{worker_storage_readback:false}],
 ['wrong observed digest','claim',{worker_observed_sha256:'c'.repeat(64)}],
 ['one reviewer only','witnesses',{reviewer_id:uuid(20)}],
 ['unsigned source','witnesses',{source_signature_verified:false}],
 ['no expiry witness','witnesses',{expiry_verified:false}]
]){
 const p={claim:{...claim},bytes:png,record:{...record},storage:{...storage},witnesses:{...witnesses}};
 Object.assign(p[field],delta);
 assert.equal(inspectOriginalJobPhoto584(p).state,'HOLD',name);negatives++;
}
assert.equal(inspectOriginalJobPhoto584({claim,bytes:Buffer.concat([png,Buffer.from('tamper')]),record,storage,witnesses}).state,'HOLD');
negatives++;
assert.ok(/^[a-f0-9]{64}$/.test(digestSource584([{path:'a.sql',content:'hello'}])));
assert.equal(digestSource584([{path:'../secrets',content:'bad'}]),null);
console.log('YW584 PASS: '+negatives+' fail-closed staging/photo cases, private bytes, owner/link/RLS and independent witness requirements. Live photo pilot remains unaccepted.');
