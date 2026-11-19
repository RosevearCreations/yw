/* YW584 independent staging migration + ORIGINAL job/photo pilot custody.
 * Offline assessor of separately gathered evidence. Never creates Supabase
 * branches, reads a production bucket, mutates customer records or fabricates
 * independently signed certificates. All source claims start HOLD until readback.
 */
import {createHash} from 'node:crypto';
import {inspectStagingReview582,inspectPrivatePhoto582} from './yw582-photo-custody.mjs';
export const REQUIRED_MIGRATIONS_584=Object.freeze([
 'yw_company_service_offering_registry_420',
 'yw_new_work_company_entitlement_gate_421',
 'company_customer_property_continuity_422',
 'pms_septic_arboriculture_451',
 'yw580_specialty_entitlements',
 'yw581_staging_acceptance_private_photo',
 'yw582_photo_integrity_retention',
 'yw584_tenant_support_site_drafts'
]);
const hold=reason=>Object.freeze({state:'HOLD',reason,
 stagingEnrolled:false,realPhotoPilotAccepted:false,productionSchemaChanged:false,
 publicTenantPortalReady:false});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function inspectMigrationReadback584(readback,{
 productionProjectRef,stagingProjectRef,expectedGitSha}={}){
 if(!productionProjectRef||!stagingProjectRef||
    productionProjectRef===stagingProjectRef||
    !/^[a-f0-9]{40}$/.test(expectedGitSha||'')||
    readback?.environment!=='staging'||readback?.project_ref!==stagingProjectRef||
    readback?.project_ref===productionProjectRef||
    readback?.source_sha!==expectedGitSha)
  return hold('Independent non-production staging project and exact source SHA not established');
 if(!Array.isArray(readback.applied_migrations)||readback.applied_migrations.length>300||
    new Set(readback.applied_migrations).size!==readback.applied_migrations.length||
    REQUIRED_MIGRATIONS_584.some(m=>!readback.applied_migrations.includes(m)))
  return hold('Full ordered seven-service and private-photo/support migration history missing');
 if(readback.backup_restore_verified!==true||
    readback.production_unmodified!==true||
    readback.tenant_rls_negative_tests_passed!==true||
    readback.storage_private_denials_passed!==true||
    readback.original_job_source_pinned!==true||
    readback.site_editor_company_boundary_passed!==true||
    readback.sysop_aggregate_boundary_passed!==true||
    readback.all_nine_services_reviewed!==true||
    readback.staged_580_581_582_584_tables_present!==true||
    readback.site_publication_disabled!==true||
    readback.rental_payment_disabled!==true)
  return hold('Tenant, staging, backup, source and publication negative proofs unavailable');
 return Object.freeze({state:'STAGING_MIGRATION_SELF_REPORT_ONLY',
  requiredMigrationCount:REQUIRED_MIGRATIONS_584.length,projectRef:readback.project_ref,
  sourceSha:readback.source_sha,requiresIndependentSignedWitness:true,
  requiresAuthenticatedLiveReadback:true,stagingEnrolled:false,
  realPhotoPilotAccepted:false,productionSchemaChanged:false,publicTenantPortalReady:false});
}
export function inspectOriginalJobPhoto584({claim,bytes,record,storage,witnesses}={}){
 if(!claim||!uuid(claim.company_id)||!uuid(claim.job_id)||
    !uuid(claim.client_id)||!uuid(claim.client_site_id)||
    claim.company_id!==record?.company_id||claim.job_id!==record?.job_id||
    claim.client_id!==record?.client_id||
    claim.client_site_id!==record?.client_site_id||
    claim.authenticated_server_readback!==true||
    claim.original_422_link_checked!==true||
    claim.jobs_permission_revocation_denied!==true||
    claim.foreign_company_read_denied!==true||
    claim.photo_upload_request_idempotent!==true||
    claim.audit_receipt_readback!==true||
    claim.owner_verified!==true||claim.legal_hold_custody_passed!==true||
    claim.object_read_private_to_foreign_users!==true)
  return hold('Original owner/job/photo custody and tenant isolation test evidence missing');
 const result=inspectPrivatePhoto582({bytes,record,storage});
 if(result.state!=='BYTE_HASH_MATCH_LOCAL_ONLY')return hold(result.reason||'Byte-integrity mismatch');
 if(!sha(claim.worker_observed_sha256)||claim.worker_observed_sha256!==result.sourceDigest||
    !uuid(claim.worker_receipt_id)||claim.worker_storage_readback!==true)
  return hold('No independently rehashed worker source receipt');
 if(!witnesses?.separately_pinned||witnesses?.owner_id===witnesses?.reviewer_id||
    witnesses?.source_signature_verified!==true||witnesses?.expiry_verified!==true)
  return hold('Independent original-photo witness binding missing');
 return Object.freeze({state:'PILOT_PACKET_REVIEW_REQUIRED',
  sourceDigest:result.sourceDigest,jobId:claim.job_id,
  hasLocalByteHashMatch:true,requiresIndependentLiveReadback:true,
  productionSchemaChanged:false,realPhotoPilotAccepted:false,
  publicTenantPortalReady:false});
}
export function inspectIndependentSignedReview584(packet,options){
 const r=inspectStagingReview582(packet,options);
 if(r.state!=='SIGNED_STAGING_REVIEW_PACKET_ONLY')
  return hold(r.reason||'Independent staging signatures not verified');
 return Object.freeze({state:'SIGNED_STAGING_REVIEW_PACKET_ONLY',
  requiresIndependentLiveReadback:true,stagingEnrolled:false,
  realPhotoPilotAccepted:false,productionSchemaChanged:false,
  publicTenantPortalReady:false});
}
export function digestSource584(files){
 if(!Array.isArray(files)||!files.length||files.length>25||
    files.some(x=>typeof x?.path!=='string'||typeof x?.content!=='string'||
      x.path.startsWith('/')||x.path.includes('..')))return null;
 const entries=[...files].sort((a,b)=>a.path.localeCompare(b.path));
 return createHash('sha256').update(entries.map(x=>
  x.path+'\n'+createHash('sha256').update(x.content).digest('hex')).join('\n')).digest('hex');
}
