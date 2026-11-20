/* YW585 · Non-authoritative, offline customer portal and pilot evidence inspector.
 * No Supabase branch creation, no private customer reads, no acceptance signing.
 */
export const CUSTOMER_SERVICES_585=Object.freeze([
 'landscape','snow_removal','snow_plowing','septic','arboriculture',
 'construction','water_parks'
]);
export const PLANNING_SPECIALTIES_585=Object.freeze(['ponds','skateparks']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const hold=reason=>Object.freeze({state:'HOLD',reason,canCreateJobs:false,
 accountActivated:false,photoPilotAccepted:false,productionMutation:false,
 liveCustomerPortalReady:false});
const safeNumber=n=>Number.isSafeInteger(n)&&n>=0&&n<=7;
export function inspectCustomerScope585(scope,{companyId,clientId,now=Date.now()}={}){
 const ts=Date.parse(scope?.captured_at);
 if(!uuid(companyId)||!uuid(clientId)||
    scope?.scope!=='original_customer_company_only'||
    scope.company_id!==companyId||scope.client_id!==clientId||
    typeof scope.company_name!=='string'||scope.company_name.trim().length<2||
    scope.company_name.trim().length>160||
    !safeNumber(scope.service_count_enabled)||
    !Number.isFinite(now)||!Number.isFinite(ts)||ts>now+60000||now-ts>300000||
    scope.can_view_work_orders!==false||scope.can_view_photos!==false||
    scope.can_submit_booking!==false||scope.can_charge_account!==false||
    scope.can_change_company_settings!==false||
    scope.public_site_published!==false||
    scope.owner_or_sysop_authority!==false)
  return hold('Original company/customer permission and identity proof incomplete');
 return Object.freeze({state:'SOURCE_SCOPE_PACKET_CONSISTENT_ONLY',
  companyId,clientId,displayName:scope.company_name,
  enabledServiceCount:scope.service_count_enabled,
  mustVerifyAuthenticatedRLSReadback:true,
  canCreateJobs:false,accountActivated:false,photoPilotAccepted:false,
  liveCustomerPortalReady:false,productionMutation:false});
}
export function inspectCustomerRequest585({request,original,expectedCompanyId,
 expectedClientId,expectedActorId,allowedServices=CUSTOMER_SERVICES_585}={}){
 if(!uuid(expectedCompanyId)||!uuid(expectedClientId)||!uuid(expectedActorId)||
  original?.company_id!==expectedCompanyId||original?.client_id!==expectedClientId||
  original?.customer_user_id!==expectedActorId||original?.membership_state!=='active'||
  request?.company_id!==expectedCompanyId||request?.client_id!==expectedClientId||
  request?.customer_user_id!==expectedActorId||
  request?.lifecycle_state!=='private_draft'||
  !Array.isArray(allowedServices)||!allowedServices.includes(request?.service_module_key)||
  !CUSTOMER_SERVICES_585.includes(request?.service_module_key)||
  !['quote_planning','maintenance_question','rental_question','event_interest'].includes(request?.request_kind)||
  typeof request?.short_summary!=='string'||request.short_summary.trim().length<10||
  request.short_summary.trim().length>160||
  typeof request?.details!=='string'||request.details.length<10||request.details.length>800)
  return hold('Original customer-only draft linkage, service or field bounds unavailable');
 return Object.freeze({state:'SOURCE_CUSTOMER_DRAFT_PACKET_ONLY',
  companyId:expectedCompanyId,clientId:expectedClientId,
  requiresLiveServiceEnabledCheck:true,requiresRLSReadback:true,
  canCreateJobs:false,photoPilotAccepted:false,accountActivated:false,
  productionMutation:false,liveCustomerPortalReady:false});
}
export function inspectIndependentPilot585(packet,{
 trustedProductionRef,trustedStagingRef,sourceSha,
 now=Date.now(),zeroSpend=true
}={}){
 if(zeroSpend!==true)return hold('Unexpected nonzero-cost authorization context');
 if(!packet||!trustedProductionRef||!trustedStagingRef||
    trustedProductionRef===trustedStagingRef||
    packet.environment!=='staging'||packet.project_ref!==trustedStagingRef||
    packet.project_ref===trustedProductionRef||
    !/^[0-9a-f]{40}$/.test(sourceSha||'')||packet.source_revision!==sourceSha||
    packet.production_unmodified!==true||packet.original_422_links_proven!==true||
    packet.customer_revocation_denied!==true||
    packet.cross_company_denied!==true||
    packet.anonymous_enrollment_denied!==true||
    packet.foreign_job_photo_denied!==true||
    packet.private_object_rehash_proven!==true||
    packet.retention_legal_hold_verified!==true||
    packet.backup_restore_verified!==true||
    packet.service_off_denied!==true||
    packet.independent_owner_and_dba_review!==true||
    packet.paid_branch_created===true||
    !Number.isFinite(now)||!Number.isFinite(Date.parse(packet.recorded_at))||
    Date.parse(packet.recorded_at)>now+60000||
    now-Date.parse(packet.recorded_at)>300000)
  return hold('Independent non-production migration and original-job/customer/photo proof missing');
 // Self-reported fields cannot authorize enrollment, production writes or
 // a real photo pilot. Exact witnessed DB/storage readback still required.
 return Object.freeze({state:'UNATTESTED_PILOT_PACKET_REQUIRES_INDEPENDENT_LIVE_PROOF',
  sourceSha:packet.source_revision,
  signedIndependentReviewRequired:true,
  liveStorageReadbackRequired:true,
  privacyAndBillingGatesClosed:true,
  canCreateJobs:false,accountActivated:false,photoPilotAccepted:false,
  productionMutation:false,liveCustomerPortalReady:false});
}
