/* YW583 live source-of-truth interpretation, never an activation authority.
 * 420/421/443 are historical six-service migration versions; later 451
 * explicitly evolves registry, audit, Jobs guard, seed and RPC to SEVEN.
 * Signed pilot/staging enrollment is separate from this metadata inspector.
 */
import {readFileSync} from 'node:fs';
export const SEVEN_583=Object.freeze([
 'landscape','construction','water_parks','snow_removal',
 'snow_plowing','septic','arboriculture']);
export const NINE_583=Object.freeze([...SEVEN_583,'ponds','skateparks']);
const holds=reason=>Object.freeze({state:'HOLD',reason,canActivate:false,
 nineServicesOperational:false,financeAuthorized:false,photoPilotAccepted:false});
const has=(s,part)=>typeof s==='string'&&s.includes(part);
export function inspectHistoricalSequence583({sql420,sql421,sql443,sql451,ui443}={}){
 if(![sql420,sql421,sql443,sql451,ui443].every(x=>typeof x==='string'&&x.length>300))
  return holds('Historical migration sources incomplete');
 if(!has(sql420,"'snow_plowing','septic'")||
    !has(sql443,'v_count<>6')||
    !has(sql451,"'septic','arboriculture'")||
    !has(sql451,"if v_count<>7")||
    !has(sql451,'on conflict(company_id,module_key) do nothing')||
    !has(sql451,"select c.id,'arboriculture',false")||
    !has(sql451,'create or replace function public.ywi_421_assert_company_new_work(')||
    !has(sql451,'create or replace function public.ywi_company_service_seed_420()')||
    !has(sql451,'create or replace function public.ywi_rpc_pms_navigation_443(')||
    !has(sql451,'create or replace function public.ywi_company_service')||
    !has(ui443,"'arboriculture'")||
    !has(sql421,"'snow_plowing','septic'"))
  return holds('Migration provenance or seven-service repair contract missing');
 return Object.freeze({state:'SOURCE_SEQUENCE_VERIFIED',
  originalServiceCount:6,post451ServiceCount:7,
  specialtyServiceCount:2,fullCatalogCount:9,
  historicalFilesIntentionallyUnchanged:true,
  stagingSchemaApplied:false,liveServiceActivation:false,
  canActivate:false,financeAuthorized:false,photoPilotAccepted:false});
}
const bools=Object.freeze(['registry_allows_arboriculture',
 'audit_allows_arboriculture','seed_has_seventh',
 'new_work_guard_is_seven_and_permission_checked',
 'navigation_requires_seven']);
export function inspectLiveReadback583(row,{expectedCompanyCount,observedProjectRef,
 expectedProjectRef,productionProjectRef,stagingReview=false}={}){
 if(!row||row.audit_source!=='YW583_LIVE_READ_ONLY'||
    !observedProjectRef||observedProjectRef!==expectedProjectRef||
    !Number.isSafeInteger(row.company_count)||row.company_count<0||
    !Number.isSafeInteger(row.row_count)||row.row_count<0||
    !Number.isSafeInteger(row.enabled_count)||row.enabled_count<0||
    !Number.isSafeInteger(row.companies_with_registry)||row.companies_with_registry<0||
    !Number.isSafeInteger(row.arboriculture_rows)||row.arboriculture_rows<0||
    !Number.isSafeInteger(expectedCompanyCount)||row.company_count!==expectedCompanyCount)
  return holds('Actual project or count evidence not independently bound');
 if(bools.some(key=>row[key]!==true)||
   row.row_count!==row.company_count*7||
   row.companies_with_registry!==row.company_count||
   row.arboriculture_rows!==row.company_count)
  return holds('Current database does not meet seven-service completeness');
 if(row.enabled_count!==0)return holds('At least one service enabled; independent entitlement review required');
 if(typeof row.specialty_580_enrolled!=='boolean'||
    typeof row.photo_staging_581_enrolled!=='boolean'||
    typeof row.photo_custody_582_enrolled!=='boolean')
   return holds('Staging catalog evidence malformed');
 const inProduction=observedProjectRef===productionProjectRef;
 return Object.freeze({state:inProduction?'LIVE_REGISTRY_READ_ONLY_VERIFIED':'STAGING_REGISTRY_READ_ONLY_VERIFIED',
  companyCount:row.company_count,sevenModuleEntries:row.row_count,
  enabledCount:row.enabled_count,liveOriginalRegistrySeven:true,
  stagingIsolated:!inProduction&&stagingReview===true,
  hasPrivatePhotoTables:row.photo_staging_581_enrolled&&row.photo_custody_582_enrolled,
  specializedModuleTables:row.specialty_580_enrolled,
  nineServicesOperational:false,financeAuthorized:false,photoPilotAccepted:false,
  canActivate:false});
}
export function validateStagingPilot583(p,{productionRef,approvedStagingRef,
 approvedSourceSha,now=Date.now()}={}){
 if(!p||typeof productionRef!=='string'||typeof approvedStagingRef!=='string'||
  !productionRef||!approvedStagingRef||approvedStagingRef===productionRef||
  p.project_ref!==approvedStagingRef||p.project_ref===productionRef||
  p.environment!=='staging'||p.production_unmodified!==true||
  p.original_company_job_bound!==true||p.all_nine_services_reviewed!==true||
  p.cross_tenant_denied!==true||p.revoked_jobs_denied!==true||
  p.consent_denied!==true||p.private_object_read_denied!==true||
  p.file_bytes_rehashed_by_independent_worker!==true||
  p.retention_legal_holds_tested!==true||
  p.separate_owner_and_dba_signoff!==true||
  p.backup_restore_proven!==true||p.schema_parity_verified!==true||
  p.source_sha!==approvedSourceSha||!/^[0-9a-f]{40}$/.test(approvedSourceSha||'')||
  !Number.isFinite(Date.parse(p.observed_at))||!Number.isFinite(now)||
  Date.parse(p.observed_at)>now+60000||now-Date.parse(p.observed_at)>600000)
  return holds('Independent real staging pilot evidence not proven');
 // Source receipt can be inspected but does not prove any of its assertions
 // without cryptographic independent witnesses and server-side readback.
 return Object.freeze({state:'STAGING_PILOT_SELF_REPORT_REQUIRES_WITNESS',
  sourceSha:p.source_sha,projectRef:p.project_ref,needsSignedWitness:true,
  needsAuthenticatedLiveReadback:true,photoPilotAccepted:false,
  canActivate:false,nineServicesOperational:false,financeAuthorized:false});
}
export function inspectRepo583(root='.'){
 const text=p=>readFileSync(root+'/'+p,'utf8');
 return inspectHistoricalSequence583({
  sql420:text('sql/company_service_offering_registry_420.sql'),
  sql421:text('sql/company_new_work_entitlement_421.sql'),
  sql443:text('sql/pms_tenant_module_navigation_443.sql'),
  sql451:text('sql/pms_septic_arboriculture_451.sql'),
  ui443:text('js/pms-module-navigation-443.js')});
}
